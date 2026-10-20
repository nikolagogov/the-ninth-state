import assert from 'node:assert/strict'
import test from 'node:test'
import { advanceDay, advanceGameDays, applyOfflineProgress, economyRules, getEconomySummary, initialGame, makeDecision, migrateGameState, registerGameDateEventHandler, setSpending, setTaxRate, type GameState } from '../src/game.ts'
import { convertElapsedTime, realMillisecondsPerGameDay, simulationTimeRules } from '../src/simulationTime.ts'
import { AURELIA_CITIES, AURELIA_MAP_LAYERS, AURELIA_TERRITORIES } from '../src/mapData.ts'
import { AURELIA_GEOGRAPHY, AURELIA_HYDROGRAPHY, AURELIA_ISLANDS, AURELIA_LANDMASSES, AURELIA_MAP_COORDINATES, AURELIA_WATER_LABELS, AURELIA_WORLD_REFERENCE } from '../src/physicalGeography.ts'
import { AURELIA_ELEVATION, AURELIA_ELEVATION_RULES, AURELIA_MORPHOLOGY, TERRAIN_CLASS_CODE, TERRAIN_CLASSES, TERRAIN_CLASS_COLORS, TERRAIN_LIGHTING, TERRAIN_RENDER_SIZE, calculateHillshade, classifyTerrain, generateAureliaElevationTile, generateAureliaTerrainMorphologyTile, hillshadeFromGradient, isAureliaLandPoint, renderElevationPixels, sampleElevation, terrainColor } from '../src/elevationModel.ts'
import { AURELIA_PLANETARY_EXTENT, PLANETARY_GEOGRAPHY, aureliaGeometryToPlanet, aureliaLocalToPlanet, aureliaSourceFeatureCount } from '../src/planetGeography.ts'
import { EQUAL_EARTH_VIEW, projectEqualEarth } from '../src/planetProjection.ts'
import { CAMPAIGN_INDEX_KEY, CAMPAIGN_KEY_PREFIX, LEGACY_SAVE_KEY, CampaignStorageError, LocalCampaignRepository, type CampaignStorage } from '../src/campaignStore.ts'
import { AURELIA_DETAIL_LEVELS, INITIAL_MAP_CAMERA, getGeographicDetailLevel, getGeographicDetailStatus, initialCameraFromViewBox, mapUnitsPerPixel, mapZoom, panMapCamera, zoomMapCameraAt } from '../src/mapViewport.ts'
import { ACCOUNT_FEATURE_NOTICE, resumeCampaign, startQuickPlay } from '../src/worldAtlas.ts'
import { PLANETARY_CONCEPT_PREVIEW } from '../src/geography/planet-concept-preview.ts'
import { PLANETARY_LAYER_CATALOG, getPlanetaryLayer } from '../src/planetDataCatalog.ts'
import { PLANET_TERRAIN, PLANET_TERRAIN_CLASS, PLANET_TERRAIN_CONTROLS, PLANET_TERRAIN_LOD, PLANET_TERRAIN_RULES, buildCoastDistance, distanceToLineKm, generatePlanetTerrain, inverseEqualEarth, isPlanetLand, renderPlanetTerrainPixels, samplePlanetElevation } from '../src/planetTerrain.ts'
import { PLANET_TERRAIN as PLANET_TERRAIN_BASELINE } from '../src/planetTerrainLegacy.ts'
import { PLANET_HYDROLOGY, PLANET_HYDROLOGY_RULES, generatePlanetHydrology, renderHydrologyCatchmentPixels } from '../src/planetHydrology.ts'

const freshGame = (): GameState => ({
  ...initialGame,
  economy: { ...initialGame.economy, spending: { ...initialGame.economy.spending }, lastFundedSpending: { ...initialGame.economy.lastFundedSpending } },
  nations: initialGame.nations.map(nation => ({ ...nation })),
  events: [...initialGame.events],
  enactedDecisions: [],
})

const atMonthEnd = (state: GameState): GameState => ({ ...state, day: new Date(state.year, state.month + 1, 0).getDate() })

function sampledSvgPolygons(path: string): Array<Array<[number, number]>> {
  const tokens = path.match(/[MLCZ]|-?\d+(?:\.\d+)?/g) ?? []
  const polygons: Array<Array<[number, number]>> = []
  let polygon: Array<[number, number]> = []
  let current: [number, number] = [0, 0]
  let index = 0
  while (index < tokens.length) {
    const command = tokens[index++]
    if (command === 'M') {
      if (polygon.length) polygons.push(polygon)
      polygon = []
      current = [Number(tokens[index++]), Number(tokens[index++])]
      polygon.push(current)
    } else if (command === 'L') {
      current = [Number(tokens[index++]), Number(tokens[index++])]
      polygon.push(current)
    } else if (command === 'C') {
      const [x1, y1, x2, y2, x3, y3] = tokens.slice(index, index + 6).map(Number)
      index += 6
      const [x0, y0] = current
      for (let step = 1; step <= 24; step++) {
        const t = step / 24
        const u = 1 - t
        polygon.push([u ** 3 * x0 + 3 * u ** 2 * t * x1 + 3 * u * t ** 2 * x2 + t ** 3 * x3, u ** 3 * y0 + 3 * u ** 2 * t * y1 + 3 * u * t ** 2 * y2 + t ** 3 * y3])
      }
      current = [x3, y3]
    } else if (command === 'Z' && polygon.length) {
      polygons.push(polygon)
      polygon = []
    }
  }
  if (polygon.length) polygons.push(polygon)
  return polygons
}

function pathContains(path: string, point: readonly [number, number]): boolean {
  return sampledSvgPolygons(path).some(polygon => {
    let inside = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i]
      const [xj, yj] = polygon[j]
      if ((yi > point[1]) !== (yj > point[1]) && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) inside = !inside
    }
    return inside
  })
}

function pointInRing(ring: readonly (readonly [number, number])[], point: readonly [number, number]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if ((yi > point[1]) !== (yj > point[1]) && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function planetaryPolygonContains(feature: (typeof PLANETARY_GEOGRAPHY.features)[number], point: readonly [number, number]): boolean {
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates : []
  return polygons.some(rings => rings.reduce((inside, ring) => pointInRing(ring, point) ? !inside : inside, false))
}

function terrainComponents(classes: Uint8Array, width: number, height: number, code: number): number[] {
  const seen = new Uint8Array(classes.length)
  const sizes: number[] = []
  for (let index = 0; index < classes.length; index++) {
    if (classes[index] !== code || seen[index]) continue
    let size = 0
    const queue = [index]
    seen[index] = 1
    for (let head = 0; head < queue.length; head++) {
      const current = queue[head]
      size++
      const column = current % width
      const row = Math.floor(current / width)
      for (const neighbor of [column > 0 ? current - 1 : -1, column + 1 < width ? current + 1 : -1, row > 0 ? current - width : -1, row + 1 < height ? current + width : -1]) {
        if (neighbor < 0 || seen[neighbor] || classes[neighbor] !== code) continue
        seen[neighbor] = 1
        queue.push(neighbor)
      }
    }
    sizes.push(size)
  }
  return sizes.sort((a, b) => b - a)
}

class MemoryCampaignStorage implements CampaignStorage {
  private readonly values = new Map<string, string>()
  readonly reads: string[] = []
  get length(): number { return this.values.size }
  getItem(key: string): string | null { this.reads.push(key); return this.values.get(key) ?? null }
  setItem(key: string, value: string): void { this.values.set(key, value) }
  removeItem(key: string): void { this.values.delete(key) }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null }
  put(key: string, value: string): void { this.values.set(key, value) }
  raw(key: string): string | null { return this.values.get(key) ?? null }
  clearReads(): void { this.reads.length = 0 }
}

test('physical geography is independent and both map modes share its coordinate system', () => {
  const expectedIds = ['velis', ...initialGame.nations.map(nation => nation.id)].sort()
  const mapIds = AURELIA_TERRITORIES.map(territory => territory.id).sort()
  assert.deepEqual(mapIds, expectedIds)
  assert.equal(AURELIA_CITIES.length, 8)
  assert.equal(new Set(AURELIA_CITIES.map(city => city.name)).size, 8)
  assert.deepEqual(AURELIA_CITIES.map(city => city.nationId).sort(), expectedIds)
  assert.ok(AURELIA_TERRITORIES.every(territory => !('capital' in territory) && !('capitalPosition' in territory)))
  assert.ok(AURELIA_TERRITORIES.every(territory => territory.path.startsWith('M') && territory.path.endsWith('Z')))
  assert.equal(AURELIA_LANDMASSES.length, 1)
  assert.ok(AURELIA_LANDMASSES[0].path.startsWith('M') && AURELIA_LANDMASSES[0].path.endsWith('Z'))
  assert.equal(AURELIA_ISLANDS.length, 3)
  assert.ok(AURELIA_HYDROGRAPHY.rivers.length >= 4)
  assert.ok(AURELIA_HYDROGRAPHY.lakes.length >= 1)
  assert.ok(AURELIA_GEOGRAPHY.features.every(feature => !['lowland', 'foothill', 'plateau', 'mountain-mass', 'ridge-line'].includes(feature.properties.kind)), 'manual terrain polygons are replaced by the elevation grid')
  assert.deepEqual(AURELIA_WATER_LABELS.map(label => label.name), ['THE AURELIAN SEA', 'VESPER STRAIT'])
  assert.equal(AURELIA_MAP_COORDINATES.width, 960)
  assert.equal(AURELIA_MAP_COORDINATES.height, 570)
  assert.equal(AURELIA_WORLD_REFERENCE.id, 'aurelia-local-equirectangular')
  assert.equal(AURELIA_WORLD_REFERENCE.units, 'map units')
  assert.equal(AURELIA_GEOGRAPHY.detailLevel, 'continental')
  assert.deepEqual(AURELIA_GEOGRAPHY.extent, AURELIA_WORLD_REFERENCE.bounds)
  assert.equal(AURELIA_GEOGRAPHY.features.filter(feature => feature.properties.kind === 'landmass').length, 1)
  assert.equal(AURELIA_GEOGRAPHY.features.filter(feature => feature.properties.kind === 'island').length, 3)
  assert.equal(AURELIA_GEOGRAPHY.features.filter(feature => feature.properties.kind === 'sea').length, 1)
  assert.deepEqual(AURELIA_GEOGRAPHY.features.map(feature => feature.id), ['aurelian-waters', 'aurelia-mainland', 'west-island', 'outer-east-island', 'southern-islet', 'velis-river', 'caldria-river', 'northmere-river', 'ostaran-river', 'thalor-river', 'lyria-river', 'lake-lyr'])
  assert.ok(AURELIA_GEOGRAPHY.features.filter(feature => feature.properties.kind === 'river').every(feature => feature.properties.basinId))
  assert.ok(AURELIA_GEOGRAPHY.features.every(feature => feature.properties.detailLevel === AURELIA_GEOGRAPHY.detailLevel))
  assert.ok(AURELIA_GEOGRAPHY.features.every(feature => !['city', 'capital', 'political-territory'].includes(feature.properties.kind)))
  assert.deepEqual(AURELIA_MAP_COORDINATES.compactViewBox, [150, 25, 750, 530])
  assert.deepEqual(AURELIA_MAP_COORDINATES.fullViewBox, [145, 25, 770, 530])
  assert.deepEqual(AURELIA_CITIES.map(city => city.name), ['EIRHOLM', 'AVENNE', 'KARSOV', 'SOLENNE', 'HIGHMERE', 'RIVERMARK', 'SUNSPIRE', 'VELIS CITY'])
  assert.deepEqual(AURELIA_CITIES.map(city => city.position), [[334, 190], [468, 180], [705, 205], [820, 325], [752, 452], [624, 477], [370, 426], [491, 292]])
  assert.ok(AURELIA_CITIES.every(city => AURELIA_TERRITORIES.some(territory => territory.id === city.nationId && pathContains(territory.path, city.position))), 'existing city metadata remains attached to its existing political territory')
  assert.deepEqual(AURELIA_MAP_LAYERS, ['political'])
})

test('Equal Earth projection maps valid planetary coordinates with bounded, symmetric results', () => {
  assert.deepEqual(projectEqualEarth([0, 0]), [EQUAL_EARTH_VIEW.centerX, EQUAL_EARTH_VIEW.centerY])
  const east = projectEqualEarth([45, 0])
  const west = projectEqualEarth([-45, 0])
  assert.ok(east[0] > EQUAL_EARTH_VIEW.centerX && west[0] < EQUAL_EARTH_VIEW.centerX)
  assert.ok(Math.abs((east[0] - EQUAL_EARTH_VIEW.centerX) - (EQUAL_EARTH_VIEW.centerX - west[0])) < 1e-9)
  for (const point of [[-180, -90], [-180, 90], [180, -90], [180, 90], [0, 90], [0, -90]] as const) {
    const projected = projectEqualEarth(point)
    assert.ok(projected.every(Number.isFinite))
    assert.ok(projected[0] >= 0 && projected[0] <= EQUAL_EARTH_VIEW.width)
    assert.ok(projected[1] >= 0 && projected[1] <= EQUAL_EARTH_VIEW.height)
  }
  assert.throws(() => projectEqualEarth([181, 0]), RangeError)
  assert.throws(() => projectEqualEarth([0, 91]), RangeError)
})

test('global geography has eight authored continents, water regions, valid geometry, and unique stable IDs', () => {
  const ids = PLANETARY_GEOGRAPHY.features.map(feature => feature.id)
  assert.equal(new Set(ids).size, ids.length)
  const continents = PLANETARY_GEOGRAPHY.features.filter(feature => feature.properties.kind === 'continent')
  assert.deepEqual(continents.map(feature => feature.properties.name).sort(), ['Aurelia', 'Kharad', 'Namar', 'Orthea', 'Sere', 'Talyra', 'Varos', 'Veyra'])
  assert.ok(PLANETARY_GEOGRAPHY.features.some(feature => feature.properties.kind === 'island'))
  assert.ok(PLANETARY_GEOGRAPHY.features.some(feature => feature.properties.kind === 'ocean'))
  assert.ok(PLANETARY_GEOGRAPHY.features.some(feature => feature.properties.kind === 'sea'))
  assert.ok(PLANETARY_GEOGRAPHY.features.some(feature => feature.properties.kind === 'strait'))
  for (const feature of PLANETARY_GEOGRAPHY.features) {
    const geometry = feature.geometry
    if (geometry.type === 'Point') {
      const [longitude, latitude] = geometry.coordinates
      assert.ok(Number.isFinite(longitude) && longitude >= -180 && longitude <= 180 && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90, `${feature.id} point has valid lon/lat`)
      continue
    }
    const lines = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.type === 'MultiLineString' ? geometry.coordinates : geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat()
    assert.ok(lines.length > 0, `${feature.id} has coordinates`)
    for (const line of lines) {
      assert.ok(line.length >= (geometry.type.includes('Polygon') ? 4 : 2), `${feature.id} has enough vertices`)
      for (const [longitude, latitude] of line) assert.ok(Number.isFinite(longitude) && longitude >= -180 && longitude <= 180 && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90, `${feature.id} has valid lon/lat`)
      for (let index = 1; index < line.length; index++) assert.ok(Math.abs(line[index][0] - line[index - 1][0]) <= 180, `${feature.id} does not draw a segment across the antimeridian`)
      if (geometry.type.includes('Polygon')) {
        assert.deepEqual(line[0], line[line.length - 1], `${feature.id} ring is closed`)
        const twiceArea = line.slice(1).reduce((area, point, index) => area + line[index][0] * point[1] - point[0] * line[index][1], 0)
        assert.ok(Math.abs(twiceArea) > 1e-8, `${feature.id} ring has non-zero area`)
      }
    }
  }
  const aurelia = continents.find(feature => feature.properties.name === 'Aurelia')!
  assert.equal(aurelia.properties.source, 'aurelia-adapter')
  assert.ok(aurelia.id.startsWith('planet-aurelia-'))
  const islands = PLANETARY_GEOGRAPHY.features.filter(feature => feature.properties.kind === 'island' && feature.properties.source === 'authored' && feature.geometry.type === 'Polygon')
  for (const island of islands) {
    const ring = island.geometry.coordinates[0]
    const center = ring.slice(0, -1).reduce(([x, y], point) => [x + point[0] / (ring.length - 1), y + point[1] / (ring.length - 1)] as [number, number], [0, 0] as [number, number])
    assert.ok(continents.every(continent => !planetaryPolygonContains(continent, center)), `${island.id} center remains offshore from continent land`)
  }
})

test('Phase 1 concept has eight physical continents and preserves Aurelia adapter geometry', () => {
  const conceptContinents = PLANETARY_CONCEPT_PREVIEW.features.filter(feature => feature.properties.kind === 'continent')
  const conceptIds = PLANETARY_CONCEPT_PREVIEW.features.map(feature => feature.id)
  assert.deepEqual(conceptContinents.map(feature => feature.properties.name).sort(), ['Aurelia', 'Kharad', 'Namar', 'Orthea', 'Sere', 'Talyra', 'Varos', 'Veyra'])
  assert.equal(new Set(conceptIds).size, conceptIds.length)
  const existingAurelia = PLANETARY_GEOGRAPHY.features.filter(feature => feature.properties.source === 'aurelia-adapter')
  const previewAurelia = PLANETARY_CONCEPT_PREVIEW.features.filter(feature => feature.properties.source === 'aurelia-adapter')
  assert.deepEqual(previewAurelia, existingAurelia, 'the preview reuses Aurelia and its island geometries without editing them')
  assert.ok(conceptContinents.every(feature => feature.geometry.type === 'Polygon'))
  for (const feature of PLANETARY_CONCEPT_PREVIEW.features) {
    const geometry = feature.geometry
    const paths = geometry.type === 'Polygon' ? geometry.coordinates : geometry.type === 'MultiPolygon' ? geometry.coordinates.flat() : []
    for (const ring of paths) {
      assert.deepEqual(ring[0], ring[ring.length - 1], `${feature.id} rings close`)
      for (const [longitude, latitude] of ring) assert.ok(longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90)
    }
  }
})

test('Aurelia registration is reversible in scope and leaves political, city, and game data untouched', () => {
  assert.deepEqual(aureliaLocalToPlanet([0, 0]), [AURELIA_PLANETARY_EXTENT.west, AURELIA_PLANETARY_EXTENT.north])
  assert.deepEqual(aureliaLocalToPlanet([960, 570]), [AURELIA_PLANETARY_EXTENT.east, AURELIA_PLANETARY_EXTENT.south])
  const sample: readonly [number, number] = [480, 285]
  const [longitude, latitude] = aureliaLocalToPlanet(sample)
  const recovered = [(longitude - AURELIA_PLANETARY_EXTENT.west) / (AURELIA_PLANETARY_EXTENT.east - AURELIA_PLANETARY_EXTENT.west) * 960, (AURELIA_PLANETARY_EXTENT.north - latitude) / (AURELIA_PLANETARY_EXTENT.north - AURELIA_PLANETARY_EXTENT.south) * 570]
  assert.ok(Math.abs(recovered[0] - sample[0]) < 1e-10 && Math.abs(recovered[1] - sample[1]) < 1e-10)
  assert.throws(() => aureliaLocalToPlanet([-1, 0]), RangeError)
  assert.equal(aureliaSourceFeatureCount(), AURELIA_GEOGRAPHY.features.length)
  assert.equal(AURELIA_GEOGRAPHY.coordinateReference.id, AURELIA_WORLD_REFERENCE.id)
  assert.equal(AURELIA_WORLD_REFERENCE.id, 'aurelia-local-equirectangular')
  assert.deepEqual(AURELIA_TERRITORIES.map(nation => nation.id).sort(), [...initialGame.nations.map(nation => nation.id), 'velis'].sort())
  assert.deepEqual(initialGame.nations.map(nation => [nation.id, nation.relation, nation.opinion]), [
    ['nordmark', 'Friendly', 42], ['caldria', 'Ally', 76], ['ostara', 'Tense', -18], ['meridia', 'Neutral', 12],
    ['thalor', 'Neutral', 4], ['lyria', 'Friendly', 31], ['vesper', 'Neutral', -3],
  ])
  assert.equal(new Set(AURELIA_CITIES.map(city => city.id)).size, AURELIA_CITIES.length)
  assert.deepEqual(AURELIA_CITIES.map(city => city.id), ['nordmark-capital', 'caldria-capital', 'ostara-capital', 'meridia-capital', 'thalor-capital', 'lyria-capital', 'vesper-capital', 'velis-city'])
  const sourceLand = AURELIA_GEOGRAPHY.features.find(feature => feature.id === 'aurelia-mainland')!
  assert.notEqual(aureliaGeometryToPlanet(sourceLand.geometry), sourceLand.geometry)
  assert.equal(initialGame.economy.treasury, 24.8)
  assert.equal(initialGame.day, 14)
})

test('Aurelia elevation grid is valid, coast-aligned, and spatially continuous', () => {
  const dem = AURELIA_ELEVATION
  assert.equal(dem.detailLevel, 'continental')
  assert.equal(dem.coordinateReferenceId, AURELIA_GEOGRAPHY.coordinateReference.id)
  assert.deepEqual(dem.origin, [AURELIA_GEOGRAPHY.extent[0], AURELIA_GEOGRAPHY.extent[1]])
  assert.deepEqual(dem.cellSize, [AURELIA_GEOGRAPHY.extent[2] / dem.width, AURELIA_GEOGRAPHY.extent[3] / dem.height])
  assert.equal(dem.width, AURELIA_ELEVATION_RULES.width)
  assert.equal(dem.height, AURELIA_ELEVATION_RULES.height)
  assert.equal(dem.values.length, dem.width * dem.height)
  assert.ok(dem.values instanceof Int16Array)
  let landCells = 0
  let seaCells = 0
  let maximumNeighborDifference = 0
  for (let row = 0; row < dem.height; row++) {
    for (let column = 0; column < dem.width; column++) {
      const value = dem.values[row * dem.width + column]
      const point = [dem.origin[0] + (column + 0.5) * dem.cellSize[0], dem.origin[1] + (row + 0.5) * dem.cellSize[1]] as const
      if (value === dem.noData) {
        seaCells++
        assert.equal(isAureliaLandPoint(point), false, `no-data sample at ${column},${row} must be outside land`)
        continue
      }
      landCells++
      assert.equal(isAureliaLandPoint(point), true, `height sample at ${column},${row} must be inside land`)
      assert.ok(Number.isInteger(value) && value > dem.seaLevelMetres && value < 9000)
      for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
        if (column + dx >= dem.width || row + dy >= dem.height) continue
        const neighbor = dem.values[(row + dy) * dem.width + column + dx]
        if (neighbor !== dem.noData) maximumNeighborDifference = Math.max(maximumNeighborDifference, Math.abs(value - neighbor))
      }
    }
  }
  assert.ok(landCells > 1000)
  assert.ok(seaCells > 1000)
  assert.ok(maximumNeighborDifference < 1200, `neighboring terrain jump ${maximumNeighborDifference}m must remain plausible`)
})

test('terrain morphology is separate from height, covers the major classes, and forms coherent regions', () => {
  const morphology = AURELIA_MORPHOLOGY
  assert.equal(morphology.type, 'TerrainMorphologyTile')
  assert.equal(morphology.coordinateReferenceId, AURELIA_ELEVATION.coordinateReferenceId)
  assert.equal(morphology.width, AURELIA_ELEVATION.width)
  assert.equal(morphology.height, AURELIA_ELEVATION.height)
  assert.equal(morphology.classes.length, AURELIA_ELEVATION.values.length)
  const counts = new Map<string, number>()
  for (let index = 0; index < morphology.classes.length; index++) {
    const terrainCode = morphology.classes[index]
    if (terrainCode === morphology.noData) {
      assert.equal(AURELIA_ELEVATION.values[index], AURELIA_ELEVATION.noData)
      continue
    }
    const terrainClass = TERRAIN_CLASSES[terrainCode - 1]
    assert.ok(terrainClass, `valid morphology code ${terrainCode}`)
    assert.ok(Number.isFinite(morphology.slopeDegrees[index]) && morphology.slopeDegrees[index] >= 0)
    assert.ok(Number.isFinite(morphology.localReliefMetres[index]) && morphology.localReliefMetres[index] >= 0)
    assert.ok(Number.isFinite(morphology.coastDistance[index]) && morphology.coastDistance[index] >= 0)
    assert.ok(Number.isFinite(morphology.riverDistance[index]) && morphology.riverDistance[index] >= 0)
    counts.set(terrainClass, (counts.get(terrainClass) ?? 0) + 1)
  }
  for (const terrainClass of TERRAIN_CLASSES) assert.ok((counts.get(terrainClass) ?? 0) > 0, `${terrainClass} is represented in the continent`)
  for (const terrainClass of ['plains', 'river-lowland', 'high-mountains', 'plateau'] as const) {
    const components = terrainComponents(morphology.classes, morphology.width, morphology.height, TERRAIN_CLASS_CODE[terrainClass])
    assert.ok(components[0] > 8, `${terrainClass} has a coherent region, components: ${components.join(',')}`)
  }
  const terrainMetrics = (overrides: Partial<Parameters<typeof classifyTerrain>[0]>) => ({ elevation: 900, slopeDegrees: 3, localReliefMetres: 40, coastDistance: 80, riverDistance: 80, ...overrides })
  assert.equal(classifyTerrain(terrainMetrics({})), 'plateau')
  assert.equal(classifyTerrain(terrainMetrics({ slopeDegrees: 38, localReliefMetres: 430 })), 'low-mountains')
  assert.equal(classifyTerrain(terrainMetrics({ coastDistance: 4, slopeDegrees: 2 })), 'coastal-plain')
  assert.equal(classifyTerrain(terrainMetrics({ coastDistance: 4, slopeDegrees: 35 })), 'steep-coast')
  assert.equal(classifyTerrain(terrainMetrics({ elevation: 280, riverDistance: 8, slopeDegrees: 3, localReliefMetres: 40 })), 'river-lowland')
  assert.equal(new Set(Object.values(TERRAIN_CLASS_COLORS).map(color => color.join(','))).size, TERRAIN_CLASSES.length)
  const repeatedMorphology = generateAureliaTerrainMorphologyTile()
  assert.deepEqual(repeatedMorphology.classes, morphology.classes)
  assert.deepEqual(repeatedMorphology.slopeDegrees, morphology.slopeDegrees)
  assert.deepEqual(repeatedMorphology.localReliefMetres, morphology.localReliefMetres)
  assert.deepEqual(repeatedMorphology.coastDistance, morphology.coastDistance)
  assert.deepEqual(repeatedMorphology.riverDistance, morphology.riverDistance)
})

test('elevation generation is deterministic and interpolation does not claim a finer DEM', () => {
  const repeated = generateAureliaElevationTile()
  assert.deepEqual(repeated.values, AURELIA_ELEVATION.values)
  assert.equal(repeated.id, AURELIA_ELEVATION.id)
  assert.equal(repeated.detailLevel, 'continental')
  const column = 54
  const row = 37
  const centerX = AURELIA_ELEVATION.origin[0] + (column + 0.5) * AURELIA_ELEVATION.cellSize[0]
  const centerY = AURELIA_ELEVATION.origin[1] + (row + 0.5) * AURELIA_ELEVATION.cellSize[1]
  assert.equal(sampleElevation(centerX, centerY), AURELIA_ELEVATION.values[row * AURELIA_ELEVATION.width + column])
  const nextValue = AURELIA_ELEVATION.values[row * AURELIA_ELEVATION.width + column + 1]
  const currentValue = AURELIA_ELEVATION.values[row * AURELIA_ELEVATION.width + column]
  if (nextValue !== AURELIA_ELEVATION.noData && currentValue !== AURELIA_ELEVATION.noData) {
    assert.equal(sampleElevation(centerX + AURELIA_ELEVATION.cellSize[0] / 2, centerY), (currentValue + nextValue) / 2)
  }
  assert.ok(TERRAIN_RENDER_SIZE.width > AURELIA_ELEVATION.width)
  assert.equal(AURELIA_ELEVATION.width, AURELIA_ELEVATION_RULES.width)
  assert.equal(AURELIA_ELEVATION.height, AURELIA_ELEVATION_RULES.height)
})

test('terrain classification, color interpolation, and directional hillshade are independent and bounded', () => {
  const sameHeight = 900
  assert.equal(classifyTerrain({ elevation: sameHeight, slopeDegrees: 2, localReliefMetres: 40, coastDistance: 80, riverDistance: 80 }), 'plateau')
  assert.equal(classifyTerrain({ elevation: sameHeight, slopeDegrees: 38, localReliefMetres: 430, coastDistance: 80, riverDistance: 80 }), 'low-mountains')
  assert.notDeepEqual(terrainColor(sameHeight, 'plateau'), terrainColor(sameHeight, 'low-mountains'))
  const flatLight = hillshadeFromGradient(0, 0)
  const northWestFacing = hillshadeFromGradient(180, 0)
  const southEastFacing = hillshadeFromGradient(-180, 0)
  assert.ok(flatLight >= TERRAIN_LIGHTING.minimum && flatLight <= TERRAIN_LIGHTING.maximum)
  assert.ok(northWestFacing > southEastFacing, 'slope facing the northwest light must be brighter')
  assert.ok([flatLight, northWestFacing, southEastFacing].every(shade => shade >= TERRAIN_LIGHTING.minimum && shade <= TERRAIN_LIGHTING.maximum))
  const midColumn = 56
  const midRow = 34
  const x = AURELIA_ELEVATION.origin[0] + (midColumn + 0.5) * AURELIA_ELEVATION.cellSize[0]
  const y = AURELIA_ELEVATION.origin[1] + (midRow + 0.5) * AURELIA_ELEVATION.cellSize[1]
  assert.ok(calculateHillshade(x, y) >= TERRAIN_LIGHTING.minimum)
  assert.ok(calculateHillshade(x, y) <= TERRAIN_LIGHTING.maximum)
  assert.equal(calculateHillshade(-100, -100), 1)
})

test('render buffer interpolates sampled DEM colors and leaves sea transparent', () => {
  const width = 160
  const height = 95
  const pixels = renderElevationPixels(width, height)
  assert.equal(pixels.length, width * height * 4)
  assert.ok(pixels instanceof Uint8ClampedArray)
  const colors = new Set<string>()
  let transparent = 0
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] === 0) transparent++
    else colors.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`)
  }
  assert.ok(transparent > 100)
  assert.ok(colors.size > 100, `expected smoothly varying color and shade, found ${colors.size} colors`)
  assert.equal(pixels.slice(0, 4).every(channel => channel === 0), true, 'ocean outside the land mask remains transparent')
})

test('map zoom keeps the cursor anchor stable and respects scale limits', () => {
  const start = initialCameraFromViewBox(AURELIA_MAP_COORDINATES.fullViewBox)
  const anchor: readonly [number, number] = [500, 260]
  const fractionX = (anchor[0] - start.x) / start.width
  const fractionY = (anchor[1] - start.y) / start.height
  const zoomed = zoomMapCameraAt(start, anchor, 0.7)
  assert.ok(Math.abs(zoomed.x + fractionX * zoomed.width - anchor[0]) < 1e-8)
  assert.ok(Math.abs(zoomed.y + fractionY * zoomed.height - anchor[1]) < 1e-8)
  assert.equal(mapZoom(zoomMapCameraAt(start, anchor, 0.00001)), 4)
  assert.ok(Math.abs(mapZoom(zoomMapCameraAt(start, anchor, 100)) - 0.72) < 1e-10)
  assert.deepEqual(start, INITIAL_MAP_CAMERA)
})

test('map detail status reports the real continental fallback when another level is requested', () => {
  assert.deepEqual(getGeographicDetailStatus(1), { requestedLevel: 'continental', requestedData: 'available', displayedLevel: 'continental' })
  assert.deepEqual(getGeographicDetailStatus(2.2), { requestedLevel: 'regional', requestedData: 'pending', displayedLevel: 'continental' })
  assert.deepEqual(getGeographicDetailStatus(3.5), { requestedLevel: 'local', requestedData: 'pending', displayedLevel: 'continental' })
})

test('map pan stays inside the world and keeps the world in frame when zoomed out', () => {
  const start = initialCameraFromViewBox(AURELIA_MAP_COORDINATES.fullViewBox)
  const zoomedIn = zoomMapCameraAt(start, [500, 260], 0.5)
  const northeast = panMapCamera(zoomedIn, 100_000, 100_000)
  assert.equal(northeast.x, 0)
  assert.equal(northeast.y, 0)
  const southwest = panMapCamera(zoomedIn, -100_000, -100_000)
  assert.ok(Math.abs(southwest.x + southwest.width - 960) < 1e-9)
  assert.ok(Math.abs(southwest.y + southwest.height - 570) < 1e-9)
  const zoomedOut = zoomMapCameraAt(start, [530, 290], 100)
  const movedOut = panMapCamera(zoomedOut, 100_000, -100_000)
  assert.ok(movedOut.x <= 0 && movedOut.x + movedOut.width >= 960)
  assert.ok(movedOut.y <= 0 && movedOut.y + movedOut.height >= 570)
})

test('camera reset baseline, responsive drag scale, and geography detail availability are explicit', () => {
  const reset = initialCameraFromViewBox(AURELIA_MAP_COORDINATES.fullViewBox)
  assert.deepEqual(reset, INITIAL_MAP_CAMERA)
  assert.ok(mapUnitsPerPixel(1440, 700, reset) > 0)
  assert.ok(mapUnitsPerPixel(720, 560, reset) > mapUnitsPerPixel(1440, 700, reset))
  assert.equal(getGeographicDetailLevel(1.2), 'continental')
  assert.equal(AURELIA_DETAIL_LEVELS.find(level => level.id === 'regional')?.data, 'pending')
  assert.equal(AURELIA_DETAIL_LEVELS.find(level => level.id === 'local')?.data, 'pending')
})

test('rapid zoom camera updates remain bounded and inexpensive', () => {
  let camera = initialCameraFromViewBox(AURELIA_MAP_COORDINATES.fullViewBox)
  const anchor: readonly [number, number] = [487, 292]
  const started = performance.now()
  for (let index = 0; index < 10_000; index++) camera = zoomMapCameraAt(camera, anchor, index % 2 === 0 ? 0.995 : 1.005)
  const elapsed = performance.now() - started
  assert.ok(mapZoom(camera) >= 0.72 && mapZoom(camera) <= 4)
  assert.ok(elapsed < 5_000, `10,000 camera updates took ${elapsed.toFixed(1)} ms`)
})

test('tax revenue uses the separate tax base and the approved monthly formula', () => {
  const summary = getEconomySummary(freshGame())
  assert.equal(initialGame.economy.taxBase, initialGame.economy.gdp)
  assert.equal(summary.monthlyIncome, 1.864)
  assert.equal(summary.monthlyRecurringExpenses, 1.75)
  assert.equal(summary.monthlyNetBalance, 0.114)
})

test('tax rate is clamped to 5–30% and snapped to whole percentage points', () => {
  const state = freshGame()
  assert.equal(setTaxRate(state, -100).economy.taxRate, 5)
  assert.equal(setTaxRate(state, 100).economy.taxRate, 30)
  assert.equal(setTaxRate(state, 14.6).economy.taxRate, 15)
  assert.equal(setTaxRate(state, Number.NaN), state)
})

test('spending controls clamp to their category range and use 0.05 increments', () => {
  const state = freshGame()
  assert.equal(setSpending(state, 'administration', 0).economy.spending.administration, 0.2)
  assert.equal(setSpending(state, 'healthcare', 5).economy.spending.healthcare, 0.6)
  assert.equal(setSpending(state, 'infrastructure', 0.52).economy.spending.infrastructure, 0.5)
})

test('monthly policy effects use funded spending and stay within the monthly limits', () => {
  let state = atMonthEnd(freshGame())
  state = setSpending(state, 'administration', 0.45)
  state = setSpending(state, 'infrastructure', 0.55)
  state = setSpending(state, 'healthcare', 0.5)
  state = setSpending(state, 'defense', 0.65)
  const next = advanceDay(state)
  assert.equal(next.economy.growth, 2.7)
  assert.equal(next.approval, 64.2)
  assert.equal(next.stability, 78.3)

  let highTax = setTaxRate(atMonthEnd(freshGame()), 30)
  highTax = setSpending(highTax, 'infrastructure', 0.225)
  const affected = advanceDay(highTax)
  assert.ok(Math.abs(affected.economy.growth - highTax.economy.growth) <= economyRules.monthlyGrowthChangeLimit.max - economyRules.monthlyGrowthChangeLimit.min)
  assert.equal(affected.economy.growth, 2.1)
  assert.equal(affected.approval, 63.3)
})

test('shortfall is prorated, unpaid costs create no debt, and effects use only paid allocations', () => {
  let state = { ...freshGame(), economy: { ...freshGame().economy, treasury: 0.1 } }
  state = setTaxRate(state, 5)
  state = setSpending(state, 'administration', 0.5)
  state = setSpending(state, 'infrastructure', 0.65)
  state = setSpending(state, 'healthcare', 0.6)
  state = setSpending(state, 'defense', 0.8)
  state = atMonthEnd(state)
  const next = advanceDay(state)
  const summary = getEconomySummary(next)
  assert.ok(summary.lastBudgetShortfall > 0)
  assert.ok(next.economy.treasury >= 0 && next.economy.treasury < 0.02)
  assert.ok(Object.values(next.economy.lastFundedSpending).every(amount => amount >= 0))
  assert.ok((Object.keys(state.economy.spending) as Array<keyof typeof state.economy.spending>).every(category => next.economy.lastFundedSpending[category] <= state.economy.spending[category]))
  assert.ok(next.economy.growth < state.economy.growth)
})

test('monthly net is applied once for each new month and not again on following days', () => {
  const state = atMonthEnd(freshGame())
  const afterSettlement = advanceDay(state)
  assert.equal(afterSettlement.day, 1)
  assert.equal(afterSettlement.economy.lastSettledPeriod, '1924-11')
  assert.equal(afterSettlement.economy.treasury, 24.914)
  assert.equal(advanceDay(afterSettlement).economy.treasury, afterSettlement.economy.treasury)
  const nextMonth = advanceDay({ ...afterSettlement, day: 30 })
  assert.equal(nextMonth.economy.lastSettledPeriod, '1924-12')
  assert.equal(nextMonth.economy.treasury, 25.032)
})

test('legacy local saves migrate without losing campaign progress or old financial values', () => {
  const current = freshGame()
  const { economy: _economy, ...legacy } = current
  const migrated = migrateGameState({
    ...legacy, day: 22, month: 3, year: 1927, date: 'old date', turn: 901,
    treasury: 8.6, gdp: 203.7, growth: 3.2, approval: 57, stability: 69,
    enactedDecisions: ['infrastructure'], focus: 'National cohesion',
  })
  assert.equal(migrated.date, '22 April 1927')
  assert.equal(migrated.turn, 901)
  assert.equal(migrated.economy.treasury, 8.6)
  assert.equal(migrated.economy.gdp, 203.7)
  assert.equal(migrated.economy.growth, 3.2)
  assert.equal(migrated.economy.taxBase, 203.7)
  assert.equal(migrated.economy.taxRate, 12)
  assert.equal(migrated.approval, 57)
  assert.equal(migrated.stability, 69)
  assert.equal(migrated.focus, 'National cohesion')
  assert.deepEqual(migrated.enactedDecisions, ['infrastructure'])
  assert.equal(migrated.economy.lastSettledPeriod, '1927-04')
})

test('one-time decisions preserve their prices and do not alter monthly net balance', () => {
  const before = freshGame()
  const afterInfrastructure = makeDecision(before, 'infrastructure')
  assert.equal(afterInfrastructure.economy.treasury, before.economy.treasury - 3.5)
  assert.equal(getEconomySummary(afterInfrastructure).oneTimeInvestments, 3.5)
  assert.equal(getEconomySummary(afterInfrastructure).monthlyNetBalance, getEconomySummary(before).monthlyNetBalance)
  assert.equal(makeDecision(afterInfrastructure, 'infrastructure'), afterInfrastructure)
  const insufficient = { ...before, economy: { ...before.economy, treasury: 1 } }
  assert.equal(makeDecision(insufficient, 'infrastructure'), insufficient)
})

test('campaign migration preserves legacy progress, defaults the selection, and removes the old key only after round-trip verification', () => {
  const storage = new MemoryCampaignStorage()
  const legacy = { ...freshGame(), day: 22, month: 3, year: 1927, turn: 901, treasury: 8.6, gdp: 203.7, growth: 3.2, approval: 57, stability: 69, enactedDecisions: ['infrastructure'] } as Record<string, unknown>
  delete legacy.economy
  storage.put(LEGACY_SAVE_KEY, JSON.stringify(legacy))
  const repository = new LocalCampaignRepository(storage, () => 'migrated-campaign')
  const migrated = repository.loadCurrentCampaign(Date.UTC(2025, 0, 1))
  assert.equal(migrated.schemaVersion, 1)
  assert.equal(migrated.name, 'Migrated Campaign')
  assert.equal(migrated.selectedNationId, 'velis')
  assert.equal(migrated.gameState.turn, 901)
  assert.equal(migrated.gameState.economy.treasury, 8.6)
  assert.equal(migrated.gameState.economy.gdp, 203.7)
  assert.equal(migrated.gameState.approval, 57)
  assert.deepEqual(migrated.gameState.enactedDecisions, ['infrastructure'])
  assert.equal(storage.raw(LEGACY_SAVE_KEY), null)
  assert.equal(repository.listCampaigns().length, 1)

  class FailedRoundTripStorage extends MemoryCampaignStorage {
    failSnapshotReadback = false
    override getItem(key: string): string | null {
      if (this.failSnapshotReadback && key.startsWith(CAMPAIGN_KEY_PREFIX)) return null
      return super.getItem(key)
    }
  }
  const failing = new FailedRoundTripStorage()
  failing.put(LEGACY_SAVE_KEY, JSON.stringify(freshGame()))
  failing.failSnapshotReadback = true
  assert.throws(() => new LocalCampaignRepository(failing, () => 'not-verified').loadCurrentCampaign(Date.UTC(2025, 0, 1)), CampaignStorageError)
  assert.ok(failing.raw(LEGACY_SAVE_KEY), 'legacy key remains when the new snapshot cannot be read back')
})

test('campaign selection and game state round-trip as one snapshot', () => {
  const storage = new MemoryCampaignStorage()
  const repository = new LocalCampaignRepository(storage, () => 'selection-save')
  const created = repository.createCampaign('Velis campaign', Date.UTC(2025, 0, 1))
  const saved = repository.saveCampaign({ ...created, selectedNationId: 'ostara', gameState: { ...created.gameState, turn: 88, focus: 'Foreign policy' } }, Date.UTC(2025, 0, 2))
  const loaded = repository.loadCampaign(saved.id, Date.UTC(2025, 0, 2))
  assert.equal(loaded.selectedNationId, 'ostara')
  assert.equal(loaded.gameState.turn, 88)
  assert.equal(loaded.gameState.focus, 'Foreign policy')
})

test('World Atlas exposes real global landmasses and Aurelia selection maps to existing national IDs', () => {
  const selectable = PLANETARY_GEOGRAPHY.features.filter(feature => feature.properties.kind === 'continent' || feature.properties.kind === 'island')
  assert.ok(selectable.length >= 5)
  assert.ok(selectable.some(feature => feature.id === 'planet-aurelia-mainland' && feature.properties.name === 'Aurelia'))
  assert.deepEqual(AURELIA_TERRITORIES.map(territory => territory.id).sort(), ['caldria', 'lyria', 'meridia', 'nordmark', 'ostara', 'thalor', 'velis', 'vesper'])
  assert.ok(PLANETARY_GEOGRAPHY.features.every(feature => !feature.id.includes('real-earth')))
})

test('planetary layer catalog distinguishes real coverage from unavailable world systems', () => {
  assert.equal(getPlanetaryLayer('global-coastlines').status, 'available')
  assert.equal(getPlanetaryLayer('tectonics').status, 'pending')
  assert.equal(getPlanetaryLayer('elevation').status, 'partial')
  assert.match(getPlanetaryLayer('elevation').coverage, /Global 1° grid/)
  assert.equal(getPlanetaryLayer('hydrology').status, 'partial')
  assert.equal(getPlanetaryLayer('climate').status, 'pending')
  assert.equal(getPlanetaryLayer('biomes').status, 'pending')
  assert.equal(new Set(PLANETARY_LAYER_CATALOG.map(layer => layer.id)).size, PLANETARY_LAYER_CATALOG.length)
})

test('global DEM covers land and ocean with deterministic, seam-safe height and morphology data', () => {
  const { elevation, classes, landMask } = PLANET_TERRAIN
  assert.equal(elevation.width, 360)
  assert.equal(elevation.height, 180)
  assert.equal(elevation.values.length, 360 * 180)
  assert.equal(classes.values.length, elevation.values.length)
  assert.equal(landMask.length, elevation.values.length)
  assert.equal(PLANET_TERRAIN.slopeDegrees.length, elevation.values.length)
  assert.equal(PLANET_TERRAIN.localReliefMetres.length, elevation.values.length)
  assert.equal(PLANET_TERRAIN.shelfMask.length, elevation.values.length)
  assert.deepEqual(elevation.cellSize, [1, 1])
  assert.equal(elevation.generator.seed, PLANET_TERRAIN_RULES.seed)
  assert.equal(elevation.generator.version, 3)
  assert.deepEqual(PLANET_TERRAIN_LOD.map(level => level.status), ['available', 'pending', 'pending'])
  assert.ok(landMask.includes(1) && landMask.includes(0), 'grid contains both land and ocean')
  assert.ok(PLANET_TERRAIN.shelfMask.includes(1), 'authored offshore shelf regions are represented')
  assert.ok(PLANET_TERRAIN.shelfMask.filter(Boolean).length < landMask.filter(value => value === 0).length * 0.65, 'shelves are regional rather than a universal coast ring')
  assert.ok(elevation.values.every(value => value !== elevation.noData && value >= -9000 && value <= 8848))
  assert.ok(PLANET_TERRAIN.slopeDegrees.every(value => Number.isFinite(value) && value >= 0 && value <= 90))
  assert.ok(PLANET_TERRAIN.localReliefMetres.every(Number.isFinite))
  assert.ok([...classes.values].every(value => Object.values(PLANET_TERRAIN_CLASS).includes(value)))
  const classCounts = new Map<number, number>()
  let largestSameSurfaceStep = 0
  let largestMountainCoastStep = 0
  for (let index = 0; index < elevation.values.length; index++) {
    assert.equal(landMask[index] ? elevation.values[index] > 0 : elevation.values[index] < 0, true, `cell ${index} respects sea level and coastline`)
    classCounts.set(classes.values[index], (classCounts.get(classes.values[index]) ?? 0) + 1)
    const x = index % elevation.width, y = Math.floor(index / elevation.width)
    const neighbors = [y * elevation.width + (x + 1) % elevation.width, ...(y + 1 < elevation.height ? [(y + 1) * elevation.width + x] : [])]
    for (const neighbor of neighbors) {
      const step = Math.abs(elevation.values[index] - elevation.values[neighbor])
      if (landMask[index] === landMask[neighbor]) largestSameSurfaceStep = Math.max(largestSameSurfaceStep, step)
      else if (step > largestMountainCoastStep) {
        largestMountainCoastStep = step
      }
      if (landMask[index] !== landMask[neighbor] && step > 6000) {
        const landIndex = landMask[index] ? index : neighbor, oceanIndex = landMask[index] ? neighbor : index
        assert.ok(elevation.values[landIndex] > 1100 && elevation.values[oceanIndex] < -2000, `steep coast is supported by a mountainous coast and deep ocean (${elevation.values[landIndex]} m / ${elevation.values[oceanIndex]} m)`)
        assert.ok([PLANET_TERRAIN_CLASS.mountains, PLANET_TERRAIN_CLASS.highMountains, PLANET_TERRAIN_CLASS.volcanic].includes(classes.values[landIndex]), 'steep coastal cliffs occur only beside classified mountain or volcanic terrain')
      }
    }
  }
  assert.ok(largestSameSurfaceStep < 3500, `terrain remains continuous within land and sea surfaces (max ${largestSameSurfaceStep} m)`)
  assert.ok(largestMountainCoastStep < 9500, `steep coastal relief remains bounded (max ${largestMountainCoastStep} m)`)
  assert.ok(Object.values(PLANET_TERRAIN_CLASS).every(code => (classCounts.get(code) ?? 0) > 0), 'all declared global relief classes occur in the generated model')
  for (let index = 0; index < classes.values.length; index++) {
    if (classes.values[index] === PLANET_TERRAIN_CLASS.plateau) assert.ok(PLANET_TERRAIN.slopeDegrees[index] < 10, 'plateau class is supported by low measured slope')
    if (classes.values[index] === PLANET_TERRAIN_CLASS.continentalShelf) assert.equal(PLANET_TERRAIN.shelfMask[index], 1, 'shelf class follows explicit shelf data')
  }
  for (const feature of PLANETARY_GEOGRAPHY.features.filter(item => item.properties.kind === 'continent' && item.properties.labelPosition)) assert.equal(isPlanetLand(feature.properties.labelPosition!), true, `${feature.properties.name} label sits on land`)
  const aureliaLabel = PLANETARY_GEOGRAPHY.features.find(feature => feature.id === 'planet-aurelia-mainland')!.properties.labelPosition!
  assert.equal(isPlanetLand(aureliaLabel), true)
  assert.ok(samplePlanetElevation(elevation, aureliaLabel) > 0)
  assert.ok(samplePlanetElevation(elevation, [0, -75]) < 0, 'southern ocean sample is below sea level')
  assert.equal(samplePlanetElevation(elevation, [-180, 50]), samplePlanetElevation(elevation, [180, 50]), 'longitude wraps at the antimeridian')
  const second = generatePlanetTerrain()
  assert.deepEqual(second.elevation.values, elevation.values)
  assert.deepEqual(second.classes.values, classes.values)
  assert.deepEqual(second.slopeDegrees, PLANET_TERRAIN.slopeDegrees)
})

test('global terrain controls and coastline distance wrap continuously at the antimeridian', () => {
  const mask = Uint8Array.from([1, 0, 0, 0, 1, 1, 0, 0, 0, 1])
  const distance = buildCoastDistance(mask, 5, 2)
  assert.equal(distance[0], 0)
  assert.equal(distance[4], 0)
  assert.equal(distance[5], 0)
  assert.equal(distance[9], 0)
  assert.ok(distanceToLineKm([180, 0], [[179, 0], [-179, 0]]) < 1)
  assert.ok(distanceToLineKm([-180, 0], [[179, 0], [-179, 0]]) < 1)
  assert.ok(distanceToLineKm([-11.5, 42.5], PLANET_TERRAIN_CONTROLS.shelves.find(item => item.id === 'veyra-east-shelf')!.polygon) > 10_000, 'a distant eastern control ring does not fold across the longitude seam')
  assert.equal(inverseEqualEarth(0, 400), null, 'outside-projection pixels are not assigned false geographic coordinates')
})

test('authored ocean basins differentiate bathymetry without moving coastlines', () => {
  const centers: Record<string, readonly [number, number]> = {
    'western-abyssal-basin': [-158, 17],
    'meridian-abyssal-basin': [-54, 42],
    'eastern-abyssal-basin': [64, 8],
    'southern-abyssal-basin': [-65, -68],
  }
  const basinDepths = Object.entries(centers).map(([id, point]) => {
    assert.equal(isPlanetLand(point), false, `${id} is authored offshore`)
    return samplePlanetElevation(PLANET_TERRAIN.elevation, point)
  })
  assert.ok(new Set(basinDepths).size >= 3, `basin centers have distinct authored depth outcomes: ${basinDepths.join(', ')}`)
  assert.ok(basinDepths.every(value => value < -4000))
  const westShelfInside = samplePlanetElevation(PLANET_TERRAIN.elevation, [-11.5, 42.5])
  const westShelfOutside = samplePlanetElevation(PLANET_TERRAIN.elevation, [-10.5, 42.5])
  assert.ok(Math.abs(westShelfInside - westShelfOutside) < 1000, `regional shelf fades continuously across its edge (${westShelfInside} m / ${westShelfOutside} m)`)
  assert.equal(PLANET_TERRAIN_CONTROLS.oceanBasins.length, 4)
  const coastCases = PLANET_TERRAIN.elevation.values
  for (let row = 0; row < 180; row++) {
    const first = row * 360, last = first + 359
    if (PLANET_TERRAIN.landMask[first] !== PLANET_TERRAIN.landMask[last]) {
      assert.equal(coastCases[first] < 0, !PLANET_TERRAIN.landMask[first])
      assert.equal(coastCases[last] < 0, !PLANET_TERRAIN.landMask[last])
    }
  }
})

test('global hydrology routes an acyclic network from DEM v3 into oceans and supported endorheic basins', () => {
  const originalDem = new Int16Array(PLANET_TERRAIN.elevation.values)
  const hydro = PLANET_HYDROLOGY
  assert.equal(hydro.demId, PLANET_TERRAIN.elevation.id)
  assert.equal(hydro.width, PLANET_TERRAIN.elevation.width)
  assert.equal(hydro.height, PLANET_TERRAIN.elevation.height)
  assert.ok(hydro.basins.length > 100)
  assert.ok(hydro.basins.some(basin => basin.kind === 'ocean'))
  assert.ok(hydro.basins.some(basin => basin.kind === 'endorheic'))
  assert.ok(hydro.rivers.some(river => river.order === 'main'))
  assert.ok(hydro.rivers.some(river => river.order === 'tributary'))
  assert.ok(hydro.lakes.length > 0)
  assert.ok(hydro.deltas.length > 0)
  assert.ok(hydro.diagnostics.filledCellCount > 0)
  assert.ok(hydro.diagnostics.maximumFillMetres > 0 && hydro.diagnostics.maximumFillMetres < 500)
  assert.ok(hydro.diagnostics.seaConnectedFilledCellCount >= hydro.diagnostics.filledCellCount)
  assert.ok(hydro.diagnostics.seaConnectedMaximumFillMetres >= hydro.diagnostics.maximumFillMetres)
  assert.ok(hydro.diagnostics.flatLandCellCount > 0)
  assert.ok(hydro.diagnostics.runtimeMs < 2500, `global flow conditioning completes in ${hydro.diagnostics.runtimeMs.toFixed(0)} ms`)
  assert.ok(hydro.conditionedElevationMetres.some((height, index) => height > originalDem[index]), 'depression filling is stored separately as a derived hydrology surface')
  assert.deepEqual(PLANET_TERRAIN.elevation.values, originalDem, 'hydrology leaves the canonical DEM unchanged')
  assert.equal(new Set(hydro.basins.map(basin => basin.id)).size, hydro.basins.length)
  assert.equal(new Set(hydro.rivers.map(river => river.id)).size, hydro.rivers.length)
  const rootKinds = new Map(hydro.basins.map(basin => [basin.outletCellIndex, basin.kind]))
  for (let i = 0; i < hydro.flowTo.length; i++) {
    const next = hydro.flowTo[i]
    assert.ok(next >= 0 && next < hydro.flowTo.length, `cell ${i} has a valid flow receiver`)
    if (!hydro.landMask[i]) assert.equal(next, i, 'ocean cells terminate catchments')
    else {
      assert.ok(hydro.accumulationKm2[i] > 0)
      assert.ok(hydro.basinRoot[i] >= 0 && rootKinds.has(hydro.basinRoot[i]), `land cell ${i} has a mapped outlet`)
      if (next !== i) {
        assert.ok(hydro.visitOrder[next] < hydro.visitOrder[i], `flow at cell ${i} decreases topological rank, preventing cycles`)
        assert.ok(hydro.conditionedElevationMetres[next] <= hydro.conditionedElevationMetres[i], `conditioned flow from cell ${i} is non-uphill`)
      } else assert.equal(rootKinds.get(i), 'endorheic', 'only selected inland terminal basins retain land sinks')
    }
  }
  for (const river of hydro.rivers) {
    assert.ok(river.cellIndices.length >= 2)
    for (let i = 1; i < river.cellIndices.length; i++) assert.equal(hydro.flowTo[river.cellIndices[i - 1]], river.cellIndices[i], `${river.id} follows connected DEM flow links`)
    for (const segment of river.segments) for (let i = 1; i < segment.length; i++) assert.ok(Math.abs(segment[i][0] - segment[i - 1][0]) <= 180, `${river.id} rendering is split at ±180°`)
    const root = hydro.basinRoot[river.cellIndices[0]]
    assert.ok(rootKinds.has(root), `${river.id} reaches an identified ocean or lake sink through its flow system`)
  }
  for (const lake of hydro.lakes) {
    const basin = hydro.basins.find(item => item.id === lake.basinId)
    assert.equal(basin?.kind, 'endorheic')
    assert.ok(lake.areaKm2 >= PLANET_HYDROLOGY_RULES.minimumLakeAreaKm2)
  }
  for (const delta of hydro.deltas) {
    assert.equal(hydro.landMask[delta.outletCellIndex], 0, `${delta.id} terminates in ocean water`)
    assert.ok(delta.contributingAreaKm2 >= PLANET_HYDROLOGY_RULES.deltaThresholdKm2)
  }
  const pixels = renderHydrologyCatchmentPixels(hydro, 96, 48)
  assert.equal(pixels.length, 96 * 48 * 4)
  assert.ok(pixels.some((value, index) => index % 4 === 3 && value > 0), 'catchment overlay renders visible basin cells')
  const second = generatePlanetHydrology()
  assert.deepEqual(second.flowTo, hydro.flowTo)
  assert.deepEqual(second.accumulationKm2, hydro.accumulationKm2)
  assert.deepEqual(second.basinRoot, hydro.basinRoot)
  assert.deepEqual(second.rivers.map(river => river.id), hydro.rivers.map(river => river.id))
})

test('hydrology routes correctly across the periodic longitude edge', () => {
  const dem = { ...PLANET_TERRAIN.elevation, values: new Int16Array(360 * 180).fill(-1000) }
  const land = new Uint8Array(360 * 180)
  const west = 90 * 360, east = west + 359
  land[west] = 1; land[east] = 1
  const values = new Int16Array(dem.values); values[west] = 500; values[east] = 1000
  const model = generatePlanetHydrology({ ...dem, id: 'seam-test-dem', values }, land)
  const receiver = model.flowTo[east]
  assert.ok(Math.abs((receiver % 360) - (east % 360)) > 350, 'the selected D8 receiver may cross the periodic longitude edge')
  assert.ok(Math.abs(Math.floor(receiver / 360) - Math.floor(east / 360)) <= 1)
  assert.ok(model.visitOrder[receiver] < model.visitOrder[east])
})

test('Phase 1 terrain remains available as a like-for-like preview baseline', () => {
  assert.equal(PLANET_TERRAIN_BASELINE.elevation.generator.version, 1)
  assert.equal(PLANET_TERRAIN_BASELINE.elevation.width, PLANET_TERRAIN.elevation.width)
  assert.equal(PLANET_TERRAIN_BASELINE.elevation.height, PLANET_TERRAIN.elevation.height)
  assert.equal(PLANET_TERRAIN_BASELINE.elevation.coordinateReferenceId, PLANET_TERRAIN.elevation.coordinateReferenceId)
  assert.equal(PLANET_TERRAIN_BASELINE.landMask.length, PLANET_TERRAIN.landMask.length)
  const baseline = renderPlanetTerrainPixels(PLANET_TERRAIN_BASELINE.elevation, 96, 48, 'elevation')
  const reconstruction = renderPlanetTerrainPixels(PLANET_TERRAIN.elevation, 96, 48, 'elevation')
  assert.ok(baseline.some((channel, index) => index % 4 !== 3 && channel !== reconstruction[index]), 'the preview can compare different elevation fields through one renderer')
})

test('terrain diagnostics separate height, slope, morphology, hillshade and unshaded bathymetry', () => {
  const rawHeight = renderPlanetTerrainPixels(PLANET_TERRAIN, 96, 48, 'elevation')
  const slope = renderPlanetTerrainPixels(PLANET_TERRAIN, 96, 48, 'slope')
  const morphology = renderPlanetTerrainPixels(PLANET_TERRAIN, 96, 48, 'morphology')
  const shaded = renderPlanetTerrainPixels(PLANET_TERRAIN, 96, 48, 'shaded-relief')
  const depths = renderPlanetTerrainPixels(PLANET_TERRAIN, 96, 48, 'bathymetry')
  assert.equal(rawHeight.length, 96 * 48 * 4)
  for (const pixels of [rawHeight, slope, morphology, shaded, depths]) assert.ok(pixels.some((_, index) => index % 4 === 3 && pixels[index] === 255))
  assert.ok(depths.some((_, index) => index % 4 === 3 && depths[index] === 0), 'pixels beyond the Equal Earth globe are transparent instead of painted as ocean')
  assert.ok(rawHeight.some((channel, index) => index % 4 !== 3 && channel !== depths[index]), 'bathymetry uses a distinct depth palette')
  assert.ok(rawHeight.some((channel, index) => index % 4 !== 3 && channel !== shaded[index]), 'hillshade is a separate effect from height')
  assert.ok(rawHeight.some((channel, index) => index % 4 !== 3 && channel !== slope[index]), 'slope mode renders derived gradients')
  assert.ok(rawHeight.some((channel, index) => index % 4 !== 3 && channel !== morphology[index]), 'morphology mode renders derived classes')

  const flat = { ...PLANET_TERRAIN.elevation, values: new Int16Array(360 * 180).fill(-1500) }
  const perturbedValues = new Int16Array(flat.values)
  for (const x of [179, 180] as const) perturbedValues[88 * 360 + x] = 30_000
  const perturbed = { ...flat, values: perturbedValues }
  const baseBathymetry = renderPlanetTerrainPixels(flat, 97, 49, 'bathymetry')
  const alteredBathymetry = renderPlanetTerrainPixels(perturbed, 97, 49, 'bathymetry')
  const baseShade = renderPlanetTerrainPixels(flat, 97, 49, 'shaded-relief')
  const alteredShade = renderPlanetTerrainPixels(perturbed, 97, 49, 'shaded-relief')
  const center = (24 * 97 + 48) * 4
  assert.deepEqual([...alteredBathymetry.slice(center, center + 3)], [...baseBathymetry.slice(center, center + 3)], 'bathymetry color is independent of hillshade')
  assert.notDeepEqual([...alteredShade.slice(center, center + 3)], [...baseShade.slice(center, center + 3)], 'hillshade responds to local DEM gradients')
})

test('global ocean and land relief avoid repeated bands and broad clipped lowland plateaus', () => {
  const { values, width } = PLANET_TERRAIN.elevation
  const northernOceanRow = values.slice(5 * width, 6 * width)
  const nextOceanRow = values.slice(10 * width, 11 * width)
  assert.equal(PLANET_TERRAIN.landMask.slice(5 * width, 6 * width).some(Boolean), false)
  assert.equal(PLANET_TERRAIN.landMask.slice(10 * width, 11 * width).some(Boolean), false)
  assert.ok(new Set(northernOceanRow).size > 200, 'an ocean transect varies spatially instead of resolving into repeated color bands')
  assert.ok(northernOceanRow.some((value, index) => value !== nextOceanRow[index]), 'adjacent ocean latitude bands are not copies')
  const landCells = PLANET_TERRAIN.landMask.reduce((count, value) => count + value, 0)
  const clippedLandCells = PLANET_TERRAIN.landMask.reduce((count, value, index) => count + Number(value === 1 && values[index] === 25), 0)
  assert.ok(clippedLandCells / landCells < 0.05, 'the lowland floor does not flatten a large share of the continents')
})

test('Quick Play creates an independent local campaign and resumes its saved nation after reload', () => {
  const storage = new MemoryCampaignStorage()
  let sequence = 0
  const repository = new LocalCampaignRepository(storage, () => `atlas-${++sequence}`)
  const previous = repository.createCampaign('Earlier campaign', Date.UTC(2025, 0, 1))
  const quickPlay = startQuickPlay(repository, Date.UTC(2025, 0, 2))
  assert.equal(quickPlay.name, 'Quick Play')
  assert.equal(repository.listCampaigns().length, 2)
  const saved = repository.saveCampaign({ ...quickPlay, selectedNationId: 'caldria', gameState: { ...quickPlay.gameState, turn: 32 } }, Date.UTC(2025, 0, 3))
  const restored = resumeCampaign(repository, saved.id, Date.UTC(2025, 0, 3))
  assert.equal(restored.selectedNationId, 'caldria')
  assert.equal(restored.gameState.turn, 32)
  assert.equal(repository.loadCampaign(previous.id, Date.UTC(2025, 0, 3)).gameState.turn, initialGame.turn)
  assert.equal(repository.listCampaigns().length, 2)
})

test('account and cloud actions are clearly unavailable without claiming success', () => {
  assert.match(ACCOUNT_FEATURE_NOTICE, /not connected yet/i)
  assert.match(ACCOUNT_FEATURE_NOTICE, /on this device/i)
  assert.doesNotMatch(ACCOUNT_FEATURE_NOTICE, /account created|cloud saved|transferred successfully/i)
})

test('campaigns remain independent and summaries list without reading snapshots', () => {
  const storage = new MemoryCampaignStorage()
  let id = 0
  const repository = new LocalCampaignRepository(storage, () => `campaign-${++id}`)
  const first = repository.createCampaign('First', Date.UTC(2025, 0, 1))
  const second = repository.createCampaign('Second', Date.UTC(2025, 0, 2))
  repository.saveCampaign({ ...first, gameState: { ...first.gameState, turn: 41, economy: { ...first.gameState.economy, treasury: 11 } } }, Date.UTC(2025, 0, 3))
  storage.clearReads()
  const summaries = repository.listCampaigns()
  assert.deepEqual(storage.reads, [CAMPAIGN_INDEX_KEY])
  assert.ok(summaries.every(summary => !('gameState' in summary)))
  assert.equal(repository.loadCampaign(first.id, Date.UTC(2025, 0, 3)).gameState.economy.treasury, 11)
  assert.equal(repository.loadCampaign(second.id, Date.UTC(2025, 0, 3)).gameState.economy.treasury, initialGame.economy.treasury)
})

test('campaign archive and restore preserve state and corrupted snapshots are not overwritten', () => {
  const storage = new MemoryCampaignStorage()
  const repository = new LocalCampaignRepository(storage, () => 'archive-campaign')
  const created = repository.createCampaign('Archive test', Date.UTC(2025, 0, 1))
  repository.saveCampaign({ ...created, gameState: { ...created.gameState, turn: 123 } }, Date.UTC(2025, 0, 2))
  assert.equal(repository.archiveCampaign(created.id, Date.UTC(2025, 0, 3)).status, 'archived')
  assert.throws(() => repository.loadCampaign(created.id, Date.UTC(2025, 0, 4)), CampaignStorageError)
  assert.equal(repository.restoreCampaign(created.id, Date.UTC(2025, 0, 5)).status, 'active')
  assert.equal(repository.loadCampaign(created.id, Date.UTC(2025, 0, 5)).gameState.turn, 123)

  storage.put(`${CAMPAIGN_KEY_PREFIX}${created.id}`, '{broken json')
  assert.throws(() => repository.loadCampaign(created.id, Date.UTC(2025, 0, 6)), CampaignStorageError)
  assert.equal(storage.raw(`${CAMPAIGN_KEY_PREFIX}${created.id}`), '{broken json')
  assert.equal(repository.listCampaigns().length, 1, 'metadata index can still list the campaign without parsing its damaged state')
})

test('malformed legacy data is reported and preserved instead of replaced by a blank campaign', () => {
  const storage = new MemoryCampaignStorage()
  storage.put(LEGACY_SAVE_KEY, '{broken legacy')
  const repository = new LocalCampaignRepository(storage, () => 'must-not-be-created')
  assert.throws(() => repository.loadCurrentCampaign(Date.UTC(2025, 0, 1)), CampaignStorageError)
  assert.equal(storage.raw(LEGACY_SAVE_KEY), '{broken legacy')
  assert.equal(storage.raw(CAMPAIGN_INDEX_KEY), null)
})

test('offline progress respects pause and advances at 1x, 2x, and 3x', () => {
  const startedAt = 1_800_000_000_000
  for (const speed of [1, 2, 3]) {
    const state = { ...freshGame(), paused: false, speed, clock: { lastTimestamp: startedAt, remainderMs: 0 } }
    const result = applyOfflineProgress(state, startedAt + 18_000)
    assert.equal(result.turn - state.turn, 10 * speed)
    assert.equal(result.clock.remainderMs, 0)
    assert.equal(result.clock.lastTimestamp, startedAt + 18_000)
  }
  const paused = { ...freshGame(), paused: true, clock: { lastTimestamp: startedAt, remainderMs: 500 } }
  const resumed = applyOfflineProgress(paused, startedAt + 60_000)
  assert.equal(resumed.turn, paused.turn)
  assert.equal(resumed.clock.remainderMs, 0)
})

test('offline progress carries fractional time and caps one opening at 24 hours', () => {
  const startedAt = 1_800_000_000_000
  const state = { ...freshGame(), paused: false, speed: 2, clock: { lastTimestamp: startedAt, remainderMs: 300 } }
  const fractional = applyOfflineProgress(state, startedAt + 600)
  assert.equal(fractional.turn, state.turn + 1)
  assert.equal(fractional.clock.remainderMs, 0)
  const carried = applyOfflineProgress(state, startedAt + 100)
  assert.equal(carried.turn, state.turn)
  assert.equal(carried.clock.remainderMs, 400)
  assert.equal(advanceDay(carried).clock.remainderMs, 0)
  const capped = applyOfflineProgress(state, startedAt + 48 * 60 * 60 * 1000)
  assert.equal(capped.turn - state.turn, 24 * 60 * 60 * 1000 / (1800 / 2))
  assert.equal(capped.clock.lastTimestamp, startedAt + 48 * 60 * 60 * 1000)
})

test('legacy save migration initializes offline timestamp without granting old offline time', () => {
  const { clock: _clock, scheduledEvents: _scheduled, ...legacy } = freshGame()
  const migrated = migrateGameState(legacy)
  assert.deepEqual(migrated.clock, { lastTimestamp: 0, remainderMs: 0 })
  assert.deepEqual(migrated.scheduledEvents, [])
  const opened = applyOfflineProgress({ ...migrated, paused: false }, 2_000_000_000_000)
  assert.equal(opened.turn, migrated.turn)
  assert.equal(opened.clock.lastTimestamp, 2_000_000_000_000)
})

test('long offline progression settles each month once while skipping ordinary days', () => {
  const startedAt = 1_800_000_000_000
  const state = { ...freshGame(), paused: false, speed: 3, clock: { lastTimestamp: startedAt, remainderMs: 0 } }
  const started = performance.now()
  const result = applyOfflineProgress(state, startedAt + 24 * 60 * 60 * 1000)
  const elapsed = performance.now() - started
  assert.equal(result.turn - state.turn, 144_000)
  const expectedDate = new Date(state.year, state.month, state.day + 144_000)
  assert.equal(result.year, expectedDate.getFullYear())
  assert.equal(result.month, expectedDate.getMonth())
  assert.equal(result.day, expectedDate.getDate())
  assert.equal(result.economy.lastSettledPeriod, `${result.year}-${String(result.month + 1).padStart(2, '0')}`)
  assert.ok(result.economy.treasury >= 0)
  assert.ok(elapsed < 5_000, `24-hour 3x catch-up took ${elapsed.toFixed(1)} ms`)
})

test('dated events are dispatched in calendar order after that date monthly settlement', () => {
  const seen: string[] = []
  const unregister = registerGameDateEventHandler('test-event', (state, event) => {
    seen.push(`${event.id}:${state.economy.lastSettledPeriod}`)
    return { ...state, focus: event.id }
  })
  try {
    const state: GameState = {
      ...freshGame(), day: 30, month: 9,
      scheduledEvents: [
        { id: 'second', date: '1924-11-02', type: 'test-event' },
        { id: 'first', date: '1924-11-01', type: 'test-event' },
      ],
    }
    const result = advanceGameDays(state, 3)
    assert.deepEqual(seen, ['first:1924-11', 'second:1924-11'])
    assert.equal(result.scheduledEvents.length, 0)
    assert.equal(result.day, 2)
    assert.equal(result.economy.lastSettledPeriod, '1924-11')
  } finally {
    unregister()
  }
})

test('the extracted time conversion preserves the existing 1x, 2x, and 3x cadence', () => {
  assert.equal(realMillisecondsPerGameDay(1), 1_800)
  assert.equal(realMillisecondsPerGameDay(2), 900)
  assert.equal(realMillisecondsPerGameDay(3), 600)
  assert.deepEqual(convertElapsedTime(18_000, 1), { days: 10, remainderMs: 0 })
  assert.deepEqual(convertElapsedTime(18_000, 2), { days: 20, remainderMs: 0 })
  assert.deepEqual(convertElapsedTime(18_000, 3), { days: 30, remainderMs: 0 })
  assert.equal(simulationTimeRules.maximumOfflineProgressMilliseconds, 86_400_000)
})
