import { PLANETARY_GEOGRAPHY } from './planetGeography.ts'
import type { PlanetFeature, PlanetGeometry, PlanetPoint } from './geographyTypes.ts'

export const PLANET_TERRAIN_RULES = {
  generatorId: 'ninth-state-global-terrain',
  generatorVersion: 1,
  seed: 902_417,
  width: 360,
  height: 180,
  westLongitude: -180,
  northLatitude: 90,
  cellSizeDegrees: 1,
  seaLevelMetres: 0,
  noData: -32768 as const,
  detailLevel: 'global' as const,
  verticalUnits: 'metres' as const,
} as const

export const PLANET_TERRAIN_LOD = [
  { id: 'global', status: 'available', cellSizeDegrees: 1 },
  { id: 'continental', status: 'pending', cellSizeDegrees: null },
  { id: 'regional', status: 'pending', cellSizeDegrees: null },
] as const

export const PLANET_TERRAIN_CLASS = {
  deepOcean: 0, continentalShelf: 1, coastalPlain: 2, plains: 3, hills: 4,
  plateau: 5, mountains: 6, highMountains: 7, riftValley: 8, volcanic: 9,
} as const
export type PlanetTerrainClass = keyof typeof PLANET_TERRAIN_CLASS
const CLASS_CODE = PLANET_TERRAIN_CLASS

export type PlanetElevationTile = {
  type: 'PlanetElevationTile'
  id: string
  coordinateReferenceId: string
  detailLevel: 'global'
  origin: readonly [westLongitude: number, northLatitude: number]
  cellSize: readonly [longitudeDegrees: number, latitudeDegrees: number]
  width: number
  height: number
  noData: -32768
  seaLevelMetres: 0
  units: 'metres'
  generator: { id: string; version: number; seed: number }
  values: Int16Array
}

export type PlanetTerrainClassGrid = {
  type: 'PlanetTerrainClassGrid'
  id: string
  coordinateReferenceId: string
  detailLevel: 'global'
  width: number
  height: number
  values: Uint8Array
}

export type PlanetTerrainModel = { elevation: PlanetElevationTile; classes: PlanetTerrainClassGrid; landMask: Uint8Array }

type Ridge = { id: string; points: readonly PlanetPoint[]; widthKm: number; peakMetres: number }
type LineControl = { id: string; points: readonly PlanetPoint[]; widthKm: number; effectMetres: number }
type RegionControl = { id: string; polygon: readonly PlanetPoint[]; transitionKm: number; effectMetres: number }
type VolcanoControl = { id: string; position: PlanetPoint; radiusKm: number; peakMetres: number }

/** Authored major structures. These are interpretive controls, not plate-boundary observations. */
export const PLANET_TERRAIN_CONTROLS = {
  mountainSystems: [
    { id: 'aurelian-spine-global', points: [[3, 36], [13, 31], [24, 23], [35, 17], [49, 13]] as const, widthKm: 145, peakMetres: 2500 },
    { id: 'varos-cordillera', points: [[-156, 57], [-143, 52], [-130, 49], [-117, 45], [-104, 39], [-94, 36]] as const, widthKm: 190, peakMetres: 3650 },
    { id: 'veyra-collision-belt', points: [[97, 61], [108, 60], [119, 56], [129, 53], [140, 48], [150, 45]] as const, widthKm: 175, peakMetres: 4200 },
    { id: 'sere-western-range', points: [[-84, -9], [-78, -18], [-75, -28], [-69, -37], [-64, -47]] as const, widthKm: 135, peakMetres: 3900 },
    { id: 'kharad-highlands', points: [[-5, -27], [4, -31], [14, -35], [25, -38], [35, -43]] as const, widthKm: 180, peakMetres: 2850 },
    { id: 'orthean-rift-rim', points: [[-157, -27], [-149, -32], [-140, -39], [-132, -47], [-125, -53]] as const, widthKm: 145, peakMetres: 2500 },
    { id: 'talyra-backbone', points: [[64, -24], [73, -29], [83, -33], [95, -37], [107, -39]] as const, widthKm: 145, peakMetres: 3250 },
    { id: 'namar-volcanic-arc', points: [[125, -12], [135, -17], [146, -22], [157, -29], [169, -32]] as const, widthKm: 125, peakMetres: 3100 },
  ] satisfies readonly Ridge[],
  plateaus: [
    { id: 'varos-interior-plateau', polygon: [[-139, 60], [-127, 63], [-111, 60], [-108, 51], [-118, 46], [-133, 49], [-141, 55], [-139, 60]], transitionKm: 240, effectMetres: 1050 },
    { id: 'veyra-western-tableland', polygon: [[93, 55], [101, 60], [113, 57], [118, 50], [111, 46], [100, 48], [94, 51], [93, 55]], transitionKm: 210, effectMetres: 850 },
    { id: 'kharad-central-plateau', polygon: [[2, -29], [9, -27], [20, -31], [27, -37], [19, -43], [8, -41], [1, -36], [2, -29]], transitionKm: 230, effectMetres: 800 },
    { id: 'talyra-highland', polygon: [[68, -29], [77, -26], [88, -31], [97, -37], [89, -42], [77, -40], [70, -35], [68, -29]], transitionKm: 180, effectMetres: 700 },
  ] satisfies readonly RegionControl[],
  basins: [
    { id: 'sere-interior-basin', polygon: [[-73, -20], [-66, -18], [-59, -23], [-58, -31], [-65, -36], [-73, -31], [-76, -25], [-73, -20]], transitionKm: 190, effectMetres: -420 },
    { id: 'namar-low-basin', polygon: [[143, -17], [151, -15], [160, -20], [162, -27], [154, -31], [146, -27], [143, -17]], transitionKm: 170, effectMetres: -330 },
    { id: 'aurelia-western-lowland', polygon: [[-4, 17], [5, 20], [14, 16], [17, 9], [9, 5], [0, 9], [-4, 17]], transitionKm: 160, effectMetres: -230 },
  ] satisfies readonly RegionControl[],
  rifts: [
    { id: 'sere-east-rift', points: [[-59, -8], [-56, -19], [-54, -30], [-51, -39]] as const, widthKm: 65, effectMetres: -620 },
    { id: 'orthea-central-rift', points: [[-139, -24], [-136, -34], [-133, -44], [-130, -52]] as const, widthKm: 58, effectMetres: -760 },
    { id: 'veyra-north-rift', points: [[110, 69], [121, 67], [132, 63]] as const, widthKm: 72, effectMetres: -510 },
  ] satisfies readonly LineControl[],
  volcanoes: [
    { id: 'ash-arc-west', position: [-39, 6], radiusKm: 90, peakMetres: 1850 },
    { id: 'ash-arc-east', position: [-24, -4], radiusKm: 75, peakMetres: 1450 },
    { id: 'veyra-north-arc', position: [78, 64], radiusKm: 105, peakMetres: 2100 },
    { id: 'namar-arc-west', position: [132, -14], radiusKm: 100, peakMetres: 1900 },
    { id: 'namar-arc-east', position: [158, -28], radiusKm: 110, peakMetres: 2300 },
  ] satisfies readonly VolcanoControl[],
  oceanTrenches: [
    { id: 'veyra-east-trench', points: [[165, 56], [162, 45], [160, 34], [158, 23]] as const, widthKm: 255, effectMetres: -2500 },
    { id: 'namar-south-trench', points: [[171, -8], [174, -19], [173, -31], [168, -42]] as const, widthKm: 270, effectMetres: -2600 },
    { id: 'varos-west-trench', points: [[-171, 45], [-168, 34], [-163, 22]] as const, widthKm: 240, effectMetres: -2200 },
  ] satisfies readonly LineControl[],
  oceanRidges: [
    { id: 'western-mid-ocean-ridge', points: [[-35, 58], [-29, 36], [-26, 14], [-31, -8], [-37, -31], [-45, -54]] as const, widthKm: 240, effectMetres: 1600 },
    { id: 'southern-ridge', points: [[-104, -61], [-63, -65], [-20, -63], [24, -66], [68, -64], [111, -67]] as const, widthKm: 210, effectMetres: 1250 },
  ] satisfies readonly LineControl[],
} as const

const polygonFeatures = PLANETARY_GEOGRAPHY.features.filter(feature => feature.properties.kind === 'continent' || feature.properties.kind === 'island')
const featureBounds = polygonFeatures.map(feature => {
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates : []
  const points = polygons.flatMap(rings => rings.flat())
  return { feature, west: Math.min(...points.map(point => point[0])), east: Math.max(...points.map(point => point[0])), south: Math.min(...points.map(point => point[1])), north: Math.max(...points.map(point => point[1])) }
})

function mod(value: number, divisor: number): number { return ((value % divisor) + divisor) % divisor }
function smoothstep01(t: number): number { const v = Math.max(0, Math.min(1, t)); return v * v * (3 - 2 * v) }
function hash(x: number, y: number, seed: number): number {
  let n = Math.imul(x, 0x1f123bb5) ^ Math.imul(y, 0x5f356495) ^ seed
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b)
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b)
  return ((n ^ (n >>> 16)) >>> 0) / 0xffffffff
}

/** Smooth periodic value noise; the x lattice wraps exactly at the antimeridian. */
function periodicNoise(longitude: number, latitude: number, cellsX: number, cellsY: number, seed: number): number {
  const x = mod(longitude + 180, 360) / 360 * cellsX
  const y = Math.max(0, Math.min(cellsY, (90 - latitude) / 180 * cellsY))
  const x0 = Math.floor(x), y0 = Math.floor(y)
  const fx = smoothstep01(x - x0), fy = smoothstep01(y - y0)
  const sample = (ix: number, iy: number) => hash(mod(ix, cellsX), Math.max(0, Math.min(cellsY, iy)), seed)
  const a = sample(x0, y0) * (1 - fx) + sample(x0 + 1, y0) * fx
  const b = sample(x0, y0 + 1) * (1 - fx) + sample(x0 + 1, y0 + 1) * fx
  return a * (1 - fy) + b * fy
}

function pointInRing(point: PlanetPoint, ring: readonly PlanetPoint[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if ((yi > point[1]) !== (yj > point[1]) && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function geometryContains(point: PlanetPoint, geometry: PlanetGeometry): boolean {
  if (geometry.type === 'Polygon') return geometry.coordinates.reduce((inside, ring) => pointInRing(point, ring) ? !inside : inside, false)
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.some(rings => rings.reduce((inside, ring) => pointInRing(point, ring) ? !inside : inside, false))
  return false
}

export function isPlanetLand(point: PlanetPoint): boolean {
  return featureBounds.some(({ feature, west, east, south, north }) => point[0] >= west && point[0] <= east && point[1] >= south && point[1] <= north && geometryContains(point, feature.geometry))
}

function localKm(point: PlanetPoint, referenceLatitude: number): readonly [number, number] {
  return [point[0] * 111.195 * Math.max(0.035, Math.cos(referenceLatitude * Math.PI / 180)), point[1] * 111.195]
}
function distanceToLineKm(point: PlanetPoint, line: readonly PlanetPoint[]): number {
  let nearest = Infinity
  const [px, py] = localKm(point, point[1])
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = localKm(line[i - 1], point[1]), [bx, by] = localKm(line[i], point[1])
    const dx = bx - ax, dy = by - ay, length2 = dx * dx + dy * dy
    const t = length2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length2)) : 0
    nearest = Math.min(nearest, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)))
  }
  return nearest
}
function distanceToRingKm(point: PlanetPoint, ring: readonly PlanetPoint[]): number {
  return distanceToLineKm(point, [...ring, ring[0]])
}
function smoothRegion(point: PlanetPoint, region: RegionControl): number {
  const inside = pointInRing(point, region.polygon)
  const distance = distanceToRingKm(point, region.polygon)
  const amount = inside ? smoothstep01(distance / region.transitionKm) : 1 - smoothstep01(distance / region.transitionKm)
  return amount * region.effectMetres
}
function ridgeContribution(point: PlanetPoint, ridge: Ridge): number {
  const distance = distanceToLineKm(point, ridge.points)
  const core = Math.exp(-(distance * distance) / (2 * ridge.widthKm ** 2))
  const foothill = Math.exp(-(distance * distance) / (2 * (ridge.widthKm * 2.7) ** 2))
  return ridge.peakMetres * (core + 0.22 * foothill)
}
function lineContribution(point: PlanetPoint, line: LineControl): number {
  const distance = distanceToLineKm(point, line.points)
  return line.effectMetres * Math.exp(-(distance * distance) / (2 * line.widthKm ** 2))
}
function volcanoContribution(point: PlanetPoint, volcano: VolcanoControl): number {
  const distance = distanceToLineKm(point, [volcano.position, volcano.position])
  return volcano.peakMetres * Math.exp(-(distance * distance) / (2 * volcano.radiusKm ** 2))
}

function buildCoastDistance(mask: Uint8Array, width: number, height: number): Float32Array {
  const distance = new Float32Array(mask.length)
  distance.fill(Infinity)
  for (let i = 0; i < mask.length; i++) {
    const x = i % width, y = Math.floor(i / width)
    if (x > 0 && mask[i - 1] !== mask[i] || x + 1 < width && mask[i + 1] !== mask[i] || y > 0 && mask[i - width] !== mask[i] || y + 1 < height && mask[i + width] !== mask[i]) distance[i] = 0
  }
  const relax = (x: number, y: number, nx: number, ny: number, base: Float32Array) => {
    if (ny < 0 || ny >= height) return
    const index = y * width + x, next = ny * width + mod(nx, width)
    if (mask[index] !== mask[next]) return
    const lat = 90 - (y + 0.5)
    const weight = 111.195 * Math.hypot((nx === x ? 0 : Math.cos(lat * Math.PI / 180)), ny === y ? 0 : 1)
    base[index] = Math.min(base[index], base[next] + weight)
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) for (const [dx, dy] of [[-1, 0], [0, -1], [-1, -1], [1, -1]] as const) relax(x, y, x + dx, y + dy, distance)
  for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]] as const) relax(x, y, x + dx, y + dy, distance)
  return distance
}

function landElevation(point: PlanetPoint, coastDistanceKm: number): number {
  const [longitude, latitude] = point
  const regional = (periodicNoise(longitude, latitude, 7, 5, PLANET_TERRAIN_RULES.seed + 1) - 0.5) * 270
  const local = (periodicNoise(longitude, latitude, 23, 13, PLANET_TERRAIN_RULES.seed + 2) - 0.5) * 115
  const coastRise = 65 + 360 * smoothstep01(coastDistanceKm / 620)
  const ridges = PLANET_TERRAIN_CONTROLS.mountainSystems.reduce((sum, feature) => sum + ridgeContribution(point, feature), 0)
  const plateaus = PLANET_TERRAIN_CONTROLS.plateaus.reduce((sum, region) => sum + smoothRegion(point, region), 0)
  const basins = PLANET_TERRAIN_CONTROLS.basins.reduce((sum, region) => sum + smoothRegion(point, region), 0)
  const rifts = PLANET_TERRAIN_CONTROLS.rifts.reduce((sum, line) => sum + lineContribution(point, line), 0)
  const volcanoes = PLANET_TERRAIN_CONTROLS.volcanoes.reduce((sum, volcano) => sum + volcanoContribution(point, volcano), 0)
  const inlandFactor = smoothstep01(coastDistanceKm / 230)
  const structuralRelief = (ridges + plateaus + rifts + volcanoes) * inlandFactor + basins
  return Math.max(8, coastRise + regional + local + structuralRelief)
}

function oceanElevation(point: PlanetPoint, coastDistanceKm: number): number {
  const shelf = coastDistanceKm < 100 ? -40 - 1.5 * coastDistanceKm : -190 - 2.65 * Math.min(800, coastDistanceKm - 100)
  const basinNoise = (periodicNoise(point[0], point[1], 9, 6, PLANET_TERRAIN_RULES.seed + 11) - 0.5) * 680
  const deepening = -3300 * smoothstep01((coastDistanceKm - 180) / 1250)
  const ridges = PLANET_TERRAIN_CONTROLS.oceanRidges.reduce((sum, line) => sum + lineContribution(point, line), 0)
  const trenches = PLANET_TERRAIN_CONTROLS.oceanTrenches.reduce((sum, line) => sum + lineContribution(point, line), 0)
  return Math.min(-5, shelf + deepening + basinNoise + ridges + trenches)
}

function terrainClass(point: PlanetPoint, elevation: number, coastDistance: number): PlanetTerrainClass {
  if (elevation < -5200) return 'deepOcean'
  if (elevation < 0) return coastDistance < 220 ? 'continentalShelf' : 'deepOcean'
  if (PLANET_TERRAIN_CONTROLS.volcanoes.some(volcano => volcanoContribution(point, volcano) > 480)) return 'volcanic'
  if (PLANET_TERRAIN_CONTROLS.rifts.some(line => lineContribution(point, line) < -230)) return 'riftValley'
  if (PLANET_TERRAIN_CONTROLS.plateaus.some(region => smoothRegion(point, region) > region.effectMetres * 0.6)) return 'plateau'
  if (elevation > 3100) return 'highMountains'
  if (elevation > 1300) return 'mountains'
  if (coastDistance < 180 && elevation < 420) return 'coastalPlain'
  if (elevation < 850) return 'plains'
  return 'hills'
}

export function generatePlanetTerrain(): PlanetTerrainModel {
  const { width, height, westLongitude, northLatitude, cellSizeDegrees, noData } = PLANET_TERRAIN_RULES
  const landMask = new Uint8Array(width * height)
  const values = new Int16Array(width * height); values.fill(noData)
  const classes = new Uint8Array(width * height)
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
    const point: PlanetPoint = [westLongitude + (column + 0.5) * cellSizeDegrees, northLatitude - (row + 0.5) * cellSizeDegrees]
    landMask[row * width + column] = Number(isPlanetLand(point))
  }
  const coastDistance = buildCoastDistance(landMask, width, height)
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
    const index = row * width + column
    const point: PlanetPoint = [westLongitude + (column + 0.5) * cellSizeDegrees, northLatitude - (row + 0.5) * cellSizeDegrees]
    const elevation = landMask[index] ? landElevation(point, coastDistance[index]) : oceanElevation(point, coastDistance[index])
    values[index] = Math.round(Math.max(-9000, Math.min(8848, elevation)))
    classes[index] = CLASS_CODE[terrainClass(point, values[index], coastDistance[index])]
  }
  return {
    elevation: { type: 'PlanetElevationTile', id: 'planet-dem-global-1deg-v1', coordinateReferenceId: PLANETARY_GEOGRAPHY.coordinateReference.id, detailLevel: 'global', origin: [westLongitude, northLatitude], cellSize: [cellSizeDegrees, cellSizeDegrees], width, height, noData, seaLevelMetres: 0, units: 'metres', generator: { id: PLANET_TERRAIN_RULES.generatorId, version: PLANET_TERRAIN_RULES.generatorVersion, seed: PLANET_TERRAIN_RULES.seed }, values },
    classes: { type: 'PlanetTerrainClassGrid', id: 'planet-morphology-global-1deg-v1', coordinateReferenceId: PLANETARY_GEOGRAPHY.coordinateReference.id, detailLevel: 'global', width, height, values: classes },
    landMask,
  }
}

export const PLANET_TERRAIN = generatePlanetTerrain()

export function samplePlanetElevation(tile: PlanetElevationTile, point: PlanetPoint): number {
  const [longitude, latitude] = point
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) return tile.noData
  const x = mod((longitude - tile.origin[0]) / tile.cellSize[0] - 0.5, tile.width)
  const y = Math.max(0, Math.min(tile.height - 1, (tile.origin[1] - latitude) / tile.cellSize[1] - 0.5))
  const x0 = Math.floor(x), x1 = (x0 + 1) % tile.width, y0 = Math.floor(y), y1 = Math.min(tile.height - 1, y0 + 1)
  const fx = x - x0, fy = y - y0
  const at = (cx: number, cy: number) => tile.values[cy * tile.width + cx]
  const top = at(x0, y0) * (1 - fx) + at(x1, y0) * fx
  const bottom = at(x0, y1) * (1 - fx) + at(x1, y1) * fx
  return top * (1 - fy) + bottom * fy
}

export function samplePlanetTerrainClass(grid: PlanetTerrainClassGrid, point: PlanetPoint): number {
  const x = mod(Math.floor(mod(point[0] + 180, 360)), grid.width)
  const y = Math.max(0, Math.min(grid.height - 1, Math.floor(90 - point[1])))
  return grid.values[y * grid.width + x]
}

export type TerrainRenderMode = 'elevation' | 'bathymetry'
function ramp(value: number, stops: readonly (readonly [number, readonly [number, number, number]])[]): readonly [number, number, number] {
  if (value <= stops[0][0]) return stops[0][1]
  for (let i = 1; i < stops.length; i++) if (value <= stops[i][0]) {
    const [lo, ca] = stops[i - 1], [hi, cb] = stops[i], t = (value - lo) / (hi - lo)
    return [0, 1, 2].map(channel => Math.round(ca[channel] * (1 - t) + cb[channel] * t)) as [number, number, number]
  }
  return stops[stops.length - 1][1]
}
const landStops = [[0, [104, 139, 100]], [350, [145, 157, 103]], [900, [171, 157, 112]], [1800, [178, 160, 129]], [3000, [189, 181, 160]], [4800, [241, 238, 222]]] as const
const oceanStops = [[-8500, [8, 25, 49]], [-6000, [11, 40, 68]], [-4000, [16, 59, 85]], [-2500, [26, 82, 105]], [-1000, [38, 107, 126]], [-200, [61, 135, 143]], [0, [83, 153, 151]]] as const

function shadeAt(tile: PlanetElevationTile, point: PlanetPoint, center: number): number {
  const [dx, dy] = tile.cellSize
  const latCos = Math.max(0.04, Math.cos(point[1] * Math.PI / 180))
  const west = samplePlanetElevation(tile, [mod(point[0] - dx + 180, 360) - 180, point[1]])
  const east = samplePlanetElevation(tile, [mod(point[0] + dx + 180, 360) - 180, point[1]])
  const north = samplePlanetElevation(tile, [point[0], Math.min(90, point[1] + dy)])
  const south = samplePlanetElevation(tile, [point[0], Math.max(-90, point[1] - dy)])
  const dzdx = (east - west) / (2 * dx * 111.195 * latCos)
  const dzdy = (north - south) / (2 * dy * 111.195)
  const nx = -dzdx * 18, ny = -dzdy * 18, length = Math.hypot(nx, ny, 1)
  const azimuth = 315 * Math.PI / 180, altitude = 38 * Math.PI / 180
  const dot = (nx * Math.sin(azimuth) * Math.cos(altitude) + ny * Math.cos(azimuth) * Math.cos(altitude) + Math.sin(altitude)) / length
  return Math.max(0.58, Math.min(1.22, 0.9 + dot * 0.32 + Math.max(-0.12, Math.min(0.12, center / 9000))))
}

function inverseEqualEarth(x: number, y: number): PlanetPoint | null {
  const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796
  const scale = 270, xNorm = (x - 800) / scale, yNorm = (400 - y) / scale
  let theta = yNorm / A1
  for (let i = 0; i < 6; i++) {
    const t2 = theta * theta, t6 = t2 * t2 * t2, t8 = t6 * t2
    const f = theta * (A1 + A2 * t2 + A3 * t6 + A4 * t8) - yNorm
    const derivative = A1 + 3 * A2 * t2 + 7 * A3 * t6 + 9 * A4 * t8
    theta -= f / derivative
  }
  const sinePhi = Math.sin(theta) / (Math.sqrt(3) / 2)
  if (Math.abs(sinePhi) > 1) return null
  const latitude = Math.asin(sinePhi) * 180 / Math.PI
  const denominator = 3 * (9 * A4 * theta ** 8 + 7 * A3 * theta ** 6 + 3 * A2 * theta ** 2 + A1)
  const lambda = xNorm * denominator / (2 * Math.sqrt(3) * Math.cos(theta))
  return [lambda * 180 / Math.PI, latitude]
}

/** Pure RGBA renderer. It resamples the 1° data for display only; it adds no DEM information. */
export function renderPlanetTerrainPixels(tile: PlanetElevationTile, width: number, height: number, mode: TerrainRenderMode = 'elevation'): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
    const point = inverseEqualEarth((column + 0.5) / width * 1600, (row + 0.5) / height * 800)
    const offset = (row * width + column) * 4
    if (!point) { pixels[offset + 3] = 0; continue }
    const elevation = samplePlanetElevation(tile, point)
    const colors = elevation < 0 ? oceanStops : landStops
    const color = mode === 'bathymetry' && elevation >= 0 ? [87, 105, 89] as const : ramp(elevation, colors)
    const shade = shadeAt(tile, point, elevation)
    pixels[offset] = Math.round(color[0] * shade)
    pixels[offset + 1] = Math.round(color[1] * shade)
    pixels[offset + 2] = Math.round(color[2] * shade)
    pixels[offset + 3] = 255
  }
  return pixels
}

export function planetaryTerrainFeatures(): readonly PlanetFeature[] { return polygonFeatures }
