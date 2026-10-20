import { AURELIA_GEOGRAPHY } from './physicalGeography.ts'
import type { ElevationTile, GeographicFeature, MapPoint, TerrainMorphologyTile } from './geographyTypes'

export const TERRAIN_CLASSES = ['coastal-plain', 'steep-coast', 'plains', 'river-lowland', 'foothills', 'low-mountains', 'high-mountains', 'plateau'] as const
export type TerrainClass = typeof TERRAIN_CLASSES[number]
export const TERRAIN_CLASS_CODE: Record<TerrainClass, number> = {
  'coastal-plain': 1, 'steep-coast': 2, plains: 3, 'river-lowland': 4, foothills: 5, 'low-mountains': 6, 'high-mountains': 7, plateau: 8,
}
const TERRAIN_CODE_CLASS = Object.fromEntries(Object.entries(TERRAIN_CLASS_CODE).map(([name, code]) => [code, name])) as Record<number, TerrainClass>
export const TERRAIN_RENDER_SIZE = { width: 1920, height: 1140 } as const
export const TERRAIN_LIGHTING = { azimuthDegrees: 315, altitudeDegrees: 38, verticalScaleMetresPerMapUnit: 180, minimum: 0.62, maximum: 1.28 } as const
const lightAzimuth = TERRAIN_LIGHTING.azimuthDegrees * Math.PI / 180
const lightAltitude = TERRAIN_LIGHTING.altitudeDegrees * Math.PI / 180
const lightVector = { x: Math.sin(lightAzimuth) * Math.cos(lightAltitude), y: -Math.cos(lightAzimuth) * Math.cos(lightAltitude), z: Math.sin(lightAltitude) }

export const AURELIA_ELEVATION_RULES = {
  width: 120,
  height: 72,
  seaLevelMetres: 0,
  noData: -32768 as const,
  detailLevel: 'continental' as const,
  /** Synthetic range axes are broad tectonic belts, not drawn relief polygons. */
  ridgeSystems: [
    { id: 'aurelian-spine', points: [[388, 94], [417, 142], [449, 192], [463, 242], [486, 286], [534, 329], [568, 370]], width: 26, peakMetres: 1650, branches: [{ points: [[453, 191], [499, 187], [540, 167]], width: 17, peakMetres: 680 }, { points: [[485, 282], [450, 310], [418, 333]], width: 19, peakMetres: 590 }] },
    { id: 'southern-arc', points: [[374, 331], [422, 349], [468, 370], [522, 389], [577, 415], [624, 444]], width: 31, peakMetres: 1190, branches: [{ points: [[522, 389], [544, 358], [574, 339]], width: 17, peakMetres: 540 }] },
    { id: 'western-rim', points: [[273, 181], [292, 225], [301, 268], [292, 313], [310, 354], [347, 390]], width: 23, peakMetres: 1020, branches: [{ points: [[296, 260], [256, 281], [229, 300]], width: 15, peakMetres: 430 }] },
  ] as const,
}

export const AURELIA_TERRAIN_REGIONS = {
  easternTableland: {
    id: 'ostaran-tableland',
    kind: 'plateau',
    outline: [[582, 215], [598, 185], [630, 166], [674, 162], [711, 185], [728, 219], [717, 253], [688, 277], [638, 281], [601, 263], [581, 240]] as const,
    riseMetres: 650,
    transitionWidth: 20,
  },
} as const

const scanlineCache = new WeakMap<GeographicFeature, Map<number, number[][][]>>()

function intersectionsAtY(feature: GeographicFeature, y: number): number[][][] {
  let cache = scanlineCache.get(feature)
  if (!cache) {
    cache = new Map<number, number[][][]>()
    scanlineCache.set(feature, cache)
  }
  const cached = cache.get(y)
  if (cached) return cached
  const geometry = feature.geometry
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : []
  const intersections = polygons.map(rings => rings.map(ring => {
    const xs: number[] = []
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x1, y1] = ring[j]
      const [x2, y2] = ring[i]
      if ((y1 > y) !== (y2 > y)) xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1))
    }
    return xs.sort((a, b) => a - b)
  }))
  cache.set(y, intersections)
  return intersections
}

function insideCrossings(x: number, intersections: readonly number[]): boolean {
  let low = 0
  let high = intersections.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (intersections[middle] < x) low = middle + 1
    else high = middle
  }
  return low % 2 === 1
}

function geometryContains(point: MapPoint, feature: GeographicFeature): boolean {
  return intersectionsAtY(feature, point[1]).some(rings => rings.length > 0 && insideCrossings(point[0], rings[0]) && !rings.slice(1).some(intersections => insideCrossings(point[0], intersections)))
}

export function isAureliaLandPoint(point: MapPoint): boolean {
  return AURELIA_GEOGRAPHY.features.some(feature => (feature.properties.kind === 'landmass' || feature.properties.kind === 'island') && geometryContains(point, feature))
}

function distanceToSegment(point: MapPoint, start: MapPoint, end: MapPoint): number {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared))
  return Math.hypot(point[0] - (start[0] + t * dx), point[1] - (start[1] + t * dy))
}

function distanceToLine(point: MapPoint, line: readonly MapPoint[]): number {
  let distance = Infinity
  for (let i = 1; i < line.length; i++) distance = Math.min(distance, distanceToSegment(point, line[i - 1], line[i]))
  return distance
}

function pointInPolygon(point: MapPoint, polygon: readonly MapPoint[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [x, y] = polygon[i]
    const [previousX, previousY] = polygon[j]
    if ((y > point[1]) !== (previousY > point[1]) && point[0] < ((previousX - x) * (point[1] - y)) / (previousY - y) + x) inside = !inside
  }
  return inside
}

function signedDistanceToPolygon(point: MapPoint, polygon: readonly MapPoint[]): number {
  const distance = distanceToLine(point, [...polygon, polygon[0]])
  return pointInPolygon(point, polygon) ? distance : -distance
}

function smoothstep(minimum: number, maximum: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)))
  return t * t * (3 - 2 * t)
}

function ridgeHeight(point: MapPoint): number {
  return AURELIA_ELEVATION_RULES.ridgeSystems.reduce((total, range) => {
    const distance = distanceToLine(point, range.points)
    const core = range.peakMetres * Math.exp(-(distance * distance) / (2 * range.width * range.width))
    const foothills = range.peakMetres * 0.28 * Math.exp(-(distance * distance) / (2 * (range.width * 2.5) ** 2))
    const branches = range.branches.reduce((height, branch) => {
      const branchDistance = distanceToLine(point, branch.points)
      return height + branch.peakMetres * Math.exp(-(branchDistance * branchDistance) / (2 * branch.width * branch.width)) + branch.peakMetres * 0.25 * Math.exp(-(branchDistance * branchDistance) / (2 * (branch.width * 2.6) ** 2))
    }, 0)
    const summits = range.points.reduce((height, summit, index) => height + (index % 2 === 1 ? 310 * Math.exp(-(((point[0] - summit[0]) / 17) ** 2 + ((point[1] - summit[1]) / 20) ** 2) / 2) : 0), 0)
    return total + core + foothills + branches + summits
  }, 0)
}

function valleyHeight(point: MapPoint): number {
  const valleys: readonly (readonly MapPoint[])[] = [
    [[344, 248], [384, 282], [423, 319], [462, 352], [495, 400]],
    [[503, 188], [551, 214], [604, 247], [657, 279], [711, 309]],
    [[399, 351], [454, 372], [510, 396], [562, 423]],
  ]
  return valleys.reduce((lowering, line) => {
    const distance = distanceToLine(point, line)
    return lowering + 230 * Math.exp(-(distance * distance) / (2 * 21 * 21))
  }, 0)
}

function syntheticElevation(point: MapPoint, island: boolean, coastDistance: number): number {
  const [x, y] = point
  const broadRelief = 24 + 82 * Math.sin((x / 960) * Math.PI) * Math.sin((y / 570) * Math.PI) + Math.min(170, coastDistance * 3.2)
  const plateauEdge = signedDistanceToPolygon(point, AURELIA_TERRAIN_REGIONS.easternTableland.outline)
  const plateau = AURELIA_TERRAIN_REGIONS.easternTableland.riseMetres * smoothstep(-AURELIA_TERRAIN_REGIONS.easternTableland.transitionWidth, AURELIA_TERRAIN_REGIONS.easternTableland.transitionWidth, plateauEdge)
  const westernPlain = -120 * Math.exp(-(((x - 350) / 125) ** 2 + ((y - 332) / 82) ** 2) / 2)
  const southernBasin = -125 * Math.exp(-(((x - 524) / 100) ** 2 + ((y - 418) / 62) ** 2) / 2)
  const relief = broadRelief + plateau + ridgeHeight(point) - valleyHeight(point) + westernPlain + southernBasin
  return Math.round(Math.max(12, island ? relief * 0.52 : relief))
}

function buildCoastDistance(landMask: Uint8Array, width: number, height: number, cellSize: MapPoint): Float32Array {
  const distances = new Float32Array(width * height)
  distances.fill(Number.POSITIVE_INFINITY)
  const diagonal = Math.hypot(cellSize[0], cellSize[1])
  for (let index = 0; index < landMask.length; index++) if (!landMask[index]) distances[index] = 0
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
    const index = row * width + column
    if (!landMask[index]) continue
    let distance = distances[index]
    for (const [dx, dy, weight] of [[-1, 0, cellSize[0]], [0, -1, cellSize[1]], [-1, -1, diagonal], [1, -1, diagonal]] as const) {
      const x = column + dx
      const y = row + dy
      if (x >= 0 && x < width && y >= 0 && y < height) distance = Math.min(distance, distances[y * width + x] + weight)
    }
    distances[index] = distance
  }
  for (let row = height - 1; row >= 0; row--) for (let column = width - 1; column >= 0; column--) {
    const index = row * width + column
    if (!landMask[index]) continue
    let distance = distances[index]
    for (const [dx, dy, weight] of [[1, 0, cellSize[0]], [0, 1, cellSize[1]], [1, 1, diagonal], [-1, 1, diagonal]] as const) {
      const x = column + dx
      const y = row + dy
      if (x >= 0 && x < width && y >= 0 && y < height) distance = Math.min(distance, distances[y * width + x] + weight)
    }
    distances[index] = distance
  }
  return distances
}

export type TerrainMetrics = { elevation: number; slopeDegrees: number; localReliefMetres: number; coastDistance: number; riverDistance: number }

export function classifyTerrain(metrics: TerrainMetrics): TerrainClass {
  const { elevation, slopeDegrees, localReliefMetres, coastDistance, riverDistance } = metrics
  if (coastDistance < 13) return slopeDegrees > 21 || localReliefMetres > 270 ? 'steep-coast' : 'coastal-plain'
  if (riverDistance < 21 && elevation < 560 && slopeDegrees < 17 && localReliefMetres < 260) return 'river-lowland'
  if (elevation >= 700 && slopeDegrees < 12 && localReliefMetres < 180) return 'plateau'
  if (elevation >= 1450 || (elevation >= 1000 && slopeDegrees > 21 && localReliefMetres > 320)) return 'high-mountains'
  if (elevation >= 650 && (slopeDegrees >= 12 || localReliefMetres >= 230)) return 'low-mountains'
  if (slopeDegrees >= 5.5 || localReliefMetres >= 100) return 'foothills'
  return 'plains'
}

function extractRiverLines(): readonly (readonly MapPoint[])[] {
  return AURELIA_GEOGRAPHY.features.filter(feature => feature.properties.kind === 'river').flatMap(feature => {
    const lines = feature.geometry.type === 'LineString' ? [feature.geometry.coordinates] : feature.geometry.type === 'MultiLineString' ? feature.geometry.coordinates : []
    return lines.map(line => line.filter((_, index) => index % 8 === 0 || index === line.length - 1))
  })
}

export function generateAureliaTerrainMorphologyTile(): TerrainMorphologyTile {
  const { width, height, noData } = AURELIA_ELEVATION
  const land = new Uint8Array(width * height)
  for (let index = 0; index < land.length; index++) land[index] = AURELIA_ELEVATION.values[index] === noData ? 0 : 1
  const coastDistance = buildCoastDistance(land, width, height, AURELIA_ELEVATION.cellSize)
  const classes = new Uint8Array(width * height)
  classes.fill(255)
  const slopeDegrees = new Float32Array(width * height)
  const localReliefMetres = new Float32Array(width * height)
  const riverDistance = new Float32Array(width * height)
  slopeDegrees.fill(Number.NaN)
  localReliefMetres.fill(Number.NaN)
  riverDistance.fill(Number.NaN)
  const riverLines = extractRiverLines()
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
    const index = row * width + column
    const elevation = AURELIA_ELEVATION.values[index]
    if (elevation === noData) continue
    const west = elevationAtCell(Math.max(0, column - 1), row)
    const east = elevationAtCell(Math.min(width - 1, column + 1), row)
    const north = elevationAtCell(column, Math.max(0, row - 1))
    const south = elevationAtCell(column, Math.min(height - 1, row + 1))
    const fallback = elevation
    const dzdx = ((east === noData ? fallback : east) - (west === noData ? fallback : west)) / (2 * AURELIA_ELEVATION.cellSize[0])
    const dzdy = ((south === noData ? fallback : south) - (north === noData ? fallback : north)) / (2 * AURELIA_ELEVATION.cellSize[1])
    const slope = Math.atan(Math.hypot(dzdx, dzdy) / TERRAIN_LIGHTING.verticalScaleMetresPerMapUnit) * 180 / Math.PI
    slopeDegrees[index] = slope
    let low = elevation
    let high = elevation
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const x = column + dx
      const y = row + dy
      if (x < 0 || x >= width || y < 0 || y >= height) continue
      const nearby = elevationAtCell(x, y)
      if (nearby === noData) continue
      low = Math.min(low, nearby)
      high = Math.max(high, nearby)
    }
    const relief = high - low
    localReliefMetres[index] = relief
    const point: MapPoint = [AURELIA_ELEVATION.origin[0] + (column + 0.5) * AURELIA_ELEVATION.cellSize[0], AURELIA_ELEVATION.origin[1] + (row + 0.5) * AURELIA_ELEVATION.cellSize[1]]
    const nearestRiver = riverLines.reduce((nearest, line) => Math.min(nearest, distanceToLine(point, line)), Infinity)
    riverDistance[index] = nearestRiver
    const terrainClass = classifyTerrain({ elevation, slopeDegrees: slope, localReliefMetres: relief, coastDistance: coastDistance[index], riverDistance: nearestRiver })
    classes[index] = TERRAIN_CLASS_CODE[terrainClass]
  }
  return { type: 'TerrainMorphologyTile', id: 'aurelia-morphology-continental-v1', detailLevel: AURELIA_ELEVATION.detailLevel, coordinateReferenceId: AURELIA_ELEVATION.coordinateReferenceId, origin: AURELIA_ELEVATION.origin, cellSize: AURELIA_ELEVATION.cellSize, width, height, noData: 255, classes, slopeDegrees, localReliefMetres, coastDistance, riverDistance }
}

export function generateAureliaElevationTile(): ElevationTile {
  const { width, height, noData } = AURELIA_ELEVATION_RULES
  const [originX, originY, extentWidth, extentHeight] = AURELIA_GEOGRAPHY.extent
  const cellSize: MapPoint = [extentWidth / width, extentHeight / height]
  const values = new Int16Array(width * height)
  values.fill(noData)
  const landMask = new Uint8Array(width * height)
  const islandMask = new Uint8Array(width * height)
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const point: MapPoint = [originX + (column + 0.5) * cellSize[0], originY + (row + 0.5) * cellSize[1]]
      if (!isAureliaLandPoint(point)) continue
      const index = row * width + column
      landMask[index] = 1
      islandMask[index] = Number(AURELIA_GEOGRAPHY.features.some(feature => feature.properties.kind === 'island' && geometryContains(point, feature)))
    }
  }
  const coastDistance = buildCoastDistance(landMask, width, height, cellSize)
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
    const index = row * width + column
    if (!landMask[index]) continue
    const point: MapPoint = [originX + (column + 0.5) * cellSize[0], originY + (row + 0.5) * cellSize[1]]
    values[index] = syntheticElevation(point, Boolean(islandMask[index]), coastDistance[index])
  }
  return { type: 'ElevationTile', id: 'aurelia-elevation-continental-v1', detailLevel: AURELIA_ELEVATION_RULES.detailLevel, coordinateReferenceId: AURELIA_GEOGRAPHY.coordinateReference.id, origin: [originX, originY], cellSize, width, height, noData, seaLevelMetres: AURELIA_ELEVATION_RULES.seaLevelMetres, units: 'metres', values }
}

/** One deterministic synthetic continental DEM, generated on the regular coast-aligned grid. */
export const AURELIA_ELEVATION: ElevationTile = generateAureliaElevationTile()
export const AURELIA_MORPHOLOGY: TerrainMorphologyTile = generateAureliaTerrainMorphologyTile()

export function elevationAtCell(column: number, row: number): number {
  if (!Number.isInteger(column) || !Number.isInteger(row) || column < 0 || row < 0 || column >= AURELIA_ELEVATION.width || row >= AURELIA_ELEVATION.height) return AURELIA_ELEVATION.noData
  return AURELIA_ELEVATION.values[row * AURELIA_ELEVATION.width + column]
}

export const TERRAIN_CLASS_COLORS: Record<TerrainClass, readonly [number, number, number]> = {
  'coastal-plain': [99, 130, 91], 'steep-coast': [116, 126, 104], plains: [104, 137, 83], 'river-lowland': [138, 151, 93],
  foothills: [128, 130, 86], 'low-mountains': [153, 146, 107], 'high-mountains': [189, 187, 168], plateau: [158, 144, 105],
}
export function sampleElevation(x: number, y: number): number {
  const gridX = (x - AURELIA_ELEVATION.origin[0]) / AURELIA_ELEVATION.cellSize[0] - 0.5
  const gridY = (y - AURELIA_ELEVATION.origin[1]) / AURELIA_ELEVATION.cellSize[1] - 0.5
  if (gridX < -1 || gridY < -1 || gridX > AURELIA_ELEVATION.width || gridY > AURELIA_ELEVATION.height) return AURELIA_ELEVATION.noData
  const x0 = Math.floor(gridX)
  const y0 = Math.floor(gridY)
  const fx = gridX - x0
  const fy = gridY - y0
  let weightedHeight = 0
  let totalWeight = 0
  const weight00 = (1 - fx) * (1 - fy)
  const value00 = elevationAtCell(x0, y0)
  if (value00 !== AURELIA_ELEVATION.noData && weight00 > 0) { weightedHeight += value00 * weight00; totalWeight += weight00 }
  const weight10 = fx * (1 - fy)
  const value10 = elevationAtCell(x0 + 1, y0)
  if (value10 !== AURELIA_ELEVATION.noData && weight10 > 0) { weightedHeight += value10 * weight10; totalWeight += weight10 }
  const weight01 = (1 - fx) * fy
  const value01 = elevationAtCell(x0, y0 + 1)
  if (value01 !== AURELIA_ELEVATION.noData && weight01 > 0) { weightedHeight += value01 * weight01; totalWeight += weight01 }
  const weight11 = fx * fy
  const value11 = elevationAtCell(x0 + 1, y0 + 1)
  if (value11 !== AURELIA_ELEVATION.noData && weight11 > 0) { weightedHeight += value11 * weight11; totalWeight += weight11 }
  return totalWeight ? weightedHeight / totalWeight : AURELIA_ELEVATION.noData
}

export function hillshadeFromGradient(dzdx: number, dzdy: number): number {
  if (!Number.isFinite(dzdx) || !Number.isFinite(dzdy)) return 1
  const nx = -dzdx / TERRAIN_LIGHTING.verticalScaleMetresPerMapUnit
  const ny = -dzdy / TERRAIN_LIGHTING.verticalScaleMetresPerMapUnit
  const normalLength = Math.hypot(nx, ny, 1)
  const dot = (nx * lightVector.x + ny * lightVector.y + lightVector.z) / normalLength
  return Math.max(TERRAIN_LIGHTING.minimum, Math.min(TERRAIN_LIGHTING.maximum, 0.96 + dot * 0.24))
}

export function calculateHillshade(x: number, y: number): number {
  const elevation = sampleElevation(x, y)
  if (elevation === AURELIA_ELEVATION.noData) return 1
  const [cellX, cellY] = AURELIA_ELEVATION.cellSize
  const west = sampleElevation(x - cellX * 0.5, y)
  const east = sampleElevation(x + cellX * 0.5, y)
  const north = sampleElevation(x, y - cellY * 0.5)
  const south = sampleElevation(x, y + cellY * 0.5)
  const fallback = elevation
  const valid = (value: number) => value === AURELIA_ELEVATION.noData ? fallback : value
  const dzdx = (valid(east) - valid(west)) / cellX
  const dzdy = (valid(south) - valid(north)) / cellY
  return hillshadeFromGradient(dzdx, dzdy)
}

export function terrainColor(elevation: number, terrainClass: TerrainClass): readonly [number, number, number] {
  const base = TERRAIN_CLASS_COLORS[terrainClass]
  const elevationTint = Math.max(0.84, Math.min(1.12, 0.92 + elevation / 10000))
  return base.map(channel => Math.round(channel * elevationTint)) as [number, number, number]
}

function sampleTerrainColor(x: number, y: number, elevation: number): readonly [number, number, number] {
  const gridX = (x - AURELIA_MORPHOLOGY.origin[0]) / AURELIA_MORPHOLOGY.cellSize[0] - 0.5
  const gridY = (y - AURELIA_MORPHOLOGY.origin[1]) / AURELIA_MORPHOLOGY.cellSize[1] - 0.5
  const x0 = Math.floor(gridX)
  const y0 = Math.floor(gridY)
  const fx = gridX - x0
  const fy = gridY - y0
  const colors = [
    TERRAIN_CODE_CLASS[AURELIA_MORPHOLOGY.classes[y0 * AURELIA_MORPHOLOGY.width + x0]],
    TERRAIN_CODE_CLASS[AURELIA_MORPHOLOGY.classes[y0 * AURELIA_MORPHOLOGY.width + x0 + 1]],
    TERRAIN_CODE_CLASS[AURELIA_MORPHOLOGY.classes[(y0 + 1) * AURELIA_MORPHOLOGY.width + x0]],
    TERRAIN_CODE_CLASS[AURELIA_MORPHOLOGY.classes[(y0 + 1) * AURELIA_MORPHOLOGY.width + x0 + 1]],
  ]
  const weights = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy]
  let red = 0
  let green = 0
  let blue = 0
  let total = 0
  for (let index = 0; index < 4; index++) {
    const terrainClass = colors[index]
    const weight = weights[index]
    if (!terrainClass || weight <= 0) continue
    const color = TERRAIN_CLASS_COLORS[terrainClass]
    red += color[0] * weight
    green += color[1] * weight
    blue += color[2] * weight
    total += weight
  }
  if (total === 0) return terrainColor(elevation, classifyTerrain({ elevation, slopeDegrees: 0, localReliefMetres: 0, coastDistance: Infinity, riverDistance: Infinity }))
  const elevationTint = Math.max(0.84, Math.min(1.12, 0.92 + elevation / 10000))
  return [Math.round(red / total * elevationTint), Math.round(green / total * elevationTint), Math.round(blue / total * elevationTint)]
}

/** Build only a render buffer: bilinear resampling improves display, but DEM LOD remains 120×72. */
export function renderElevationPixels(width: number = TERRAIN_RENDER_SIZE.width, height: number = TERRAIN_RENDER_SIZE.height): Uint8ClampedArray {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new RangeError('Elevation render dimensions must be positive integers.')
  const pixels = new Uint8ClampedArray(width * height * 4)
  const heights = new Float32Array(width * height)
  heights.fill(AURELIA_ELEVATION.noData)
  const [originX, originY, extentWidth, extentHeight] = AURELIA_GEOGRAPHY.extent
  const pixelSizeX = extentWidth / width
  const pixelSizeY = extentHeight / height
  for (let row = 0; row < height; row++) {
    const y = originY + (row + 0.5) * pixelSizeY
    for (let column = 0; column < width; column++) {
      heights[row * width + column] = sampleElevation(originX + (column + 0.5) * pixelSizeX, y)
    }
  }
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const index = row * width + column
      const elevation = heights[index]
      const offset = index * 4
      if (elevation === AURELIA_ELEVATION.noData) continue
      const x = originX + (column + 0.5) * pixelSizeX
      const y = originY + (row + 0.5) * pixelSizeY
      const [red, green, blue] = sampleTerrainColor(x, y, elevation)
      const west = heights[row * width + Math.max(0, column - 1)]
      const east = heights[row * width + Math.min(width - 1, column + 1)]
      const north = heights[Math.max(0, row - 1) * width + column]
      const south = heights[Math.min(height - 1, row + 1) * width + column]
      const dzdx = ((east === AURELIA_ELEVATION.noData ? elevation : east) - (west === AURELIA_ELEVATION.noData ? elevation : west)) / (column === 0 || column === width - 1 ? pixelSizeX : 2 * pixelSizeX)
      const dzdy = ((south === AURELIA_ELEVATION.noData ? elevation : south) - (north === AURELIA_ELEVATION.noData ? elevation : north)) / (row === 0 || row === height - 1 ? pixelSizeY : 2 * pixelSizeY)
      const shade = hillshadeFromGradient(dzdx, dzdy)
      pixels[offset] = Math.min(255, Math.round(red * shade))
      pixels[offset + 1] = Math.min(255, Math.round(green * shade))
      pixels[offset + 2] = Math.min(255, Math.round(blue * shade))
      pixels[offset + 3] = 255
    }
  }
  return pixels
}

