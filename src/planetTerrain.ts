import { PLANETARY_GEOGRAPHY } from './planetGeography.ts'
import type { PlanetGeometry, PlanetPoint } from './geographyTypes.ts'

/** Version 2 keeps the same authored planet outlines and coordinate contract, but replaces the radial fields with regional controls. */
export const PLANET_TERRAIN_RULES = {
  generatorId: 'ninth-state-global-terrain', generatorVersion: 3, seed: 902_417,
  width: 360, height: 180, westLongitude: -180, northLatitude: 90,
  cellSizeDegrees: 1, seaLevelMetres: 0, noData: -32768 as const,
  detailLevel: 'global' as const, verticalUnits: 'metres' as const,
} as const

export const PLANET_TERRAIN_LOD = [
  { id: 'global', status: 'available', cellSizeDegrees: 1 },
  { id: 'continental', status: 'pending', cellSizeDegrees: null },
  { id: 'regional', status: 'pending', cellSizeDegrees: null },
] as const
export const PLANET_TERRAIN_RENDERING = { hillshadeVerticalExaggeration: 6, hillshadeAzimuthDegrees: 315, hillshadeAltitudeDegrees: 38 } as const

export const PLANET_TERRAIN_CLASS = {
  deepOcean: 0, continentalShelf: 1, coastalPlain: 2, plains: 3, hills: 4,
  plateau: 5, mountains: 6, highMountains: 7, riftValley: 8, volcanic: 9,
} as const
export type PlanetTerrainClass = keyof typeof PLANET_TERRAIN_CLASS
const CLASS_CODE = PLANET_TERRAIN_CLASS

export type PlanetElevationTile = {
  type: 'PlanetElevationTile'; id: string; coordinateReferenceId: string; detailLevel: 'global'
  origin: readonly [westLongitude: number, northLatitude: number]
  cellSize: readonly [longitudeDegrees: number, latitudeDegrees: number]
  width: number; height: number; noData: -32768; seaLevelMetres: 0; units: 'metres'
  generator: { id: string; version: number; seed: number }; values: Int16Array
}
export type PlanetTerrainClassGrid = {
  type: 'PlanetTerrainClassGrid'; id: string; coordinateReferenceId: string; detailLevel: 'global'
  width: number; height: number; values: Uint8Array
}
export type PlanetTerrainModel = {
  elevation: PlanetElevationTile; classes: PlanetTerrainClassGrid; landMask: Uint8Array
  slopeDegrees: Float32Array; localReliefMetres: Uint16Array; shelfMask: Uint8Array
}

type Ridge = { id: string; points: readonly PlanetPoint[]; widthKm: number; peakMetres: number; seed: number }
type LineControl = { id: string; points: readonly PlanetPoint[]; widthKm: number; effectMetres: number }
type RegionControl = { id: string; polygon: readonly PlanetPoint[]; transitionKm: number; effectMetres: number }
type VolcanoArc = { id: string; points: readonly PlanetPoint[]; spacingKm: number; radiusKm: number; peakMetres: number }

/** Authored regional controls (locations, axes and purpose); the procedural fields only add restrained deterministic variation. */
export const PLANET_TERRAIN_CONTROLS = {
  mountainSystems: [
    { id: 'aurelian-spine-global', points: [[3, 36], [13, 31], [24, 23], [35, 17], [49, 13]], widthKm: 220, peakMetres: 2050, seed: 11 },
    { id: 'varos-cordillera', points: [[-156, 57], [-143, 52], [-130, 49], [-117, 45], [-104, 39], [-94, 36]], widthKm: 285, peakMetres: 3150, seed: 23 },
    { id: 'veyra-collision-belt', points: [[97, 61], [108, 60], [119, 56], [129, 53], [140, 48], [150, 45]], widthKm: 310, peakMetres: 3550, seed: 37 },
    { id: 'sere-western-range', points: [[-84, -9], [-78, -18], [-75, -28], [-69, -37], [-64, -47]], widthKm: 205, peakMetres: 3500, seed: 41 },
    { id: 'kharad-highlands', points: [[-5, -27], [4, -31], [14, -35], [25, -38], [35, -43]], widthKm: 290, peakMetres: 2400, seed: 53 },
    { id: 'orthean-rift-rim', points: [[-157, -27], [-149, -32], [-140, -39], [-132, -47], [-125, -53]], widthKm: 190, peakMetres: 2200, seed: 67 },
    { id: 'talyra-backbone', points: [[64, -24], [73, -29], [83, -33], [95, -37], [107, -39]], widthKm: 230, peakMetres: 2850, seed: 71 },
    { id: 'namar-volcanic-arc', points: [[125, -12], [135, -17], [146, -22], [157, -29], [169, -32]], widthKm: 175, peakMetres: 2300, seed: 89 },
    { id: 'north-varos-foreland', points: [[-147, 62], [-131, 57], [-116, 53], [-101, 46]], widthKm: 190, peakMetres: 1120, seed: 97 },
    { id: 'veyra-eastern-foreland', points: [[105, 48], [116, 44], [127, 40], [139, 37]], widthKm: 230, peakMetres: 1380, seed: 101 },
    { id: 'sere-eastern-foothills', points: [[-77, -25], [-70, -34], [-62, -42]], widthKm: 165, peakMetres: 980, seed: 113 },
    { id: 'kharad-northern-escarpment', points: [[-8, -22], [6, -25], [21, -29], [34, -34]], widthKm: 205, peakMetres: 1250, seed: 127 },
  ] satisfies readonly Ridge[],
  plateaus: [
    { id: 'varos-interior-plateau', polygon: [[-139, 60], [-127, 63], [-111, 60], [-108, 51], [-118, 46], [-133, 49], [-141, 55], [-139, 60]], transitionKm: 310, effectMetres: 920 },
    { id: 'veyra-western-tableland', polygon: [[93, 55], [101, 60], [113, 57], [118, 50], [111, 46], [100, 48], [94, 51], [93, 55]], transitionKm: 275, effectMetres: 780 },
    { id: 'kharad-central-plateau', polygon: [[2, -29], [9, -27], [20, -31], [27, -37], [19, -43], [8, -41], [1, -36], [2, -29]], transitionKm: 340, effectMetres: 830 },
    { id: 'talyra-highland', polygon: [[68, -29], [77, -26], [88, -31], [97, -37], [89, -42], [77, -40], [70, -35], [68, -29]], transitionKm: 260, effectMetres: 690 },
    { id: 'aurelia-northern-tableland', polygon: [[17, 35], [25, 39], [35, 36], [38, 30], [32, 26], [22, 28], [17, 35]], transitionKm: 220, effectMetres: 500 },
  ] satisfies readonly RegionControl[],
  basins: [
    { id: 'sere-interior-basin', polygon: [[-73, -20], [-66, -18], [-59, -23], [-58, -31], [-65, -36], [-73, -31], [-76, -25], [-73, -20]], transitionKm: 250, effectMetres: -780 },
    { id: 'namar-low-basin', polygon: [[143, -17], [151, -15], [160, -20], [162, -27], [154, -31], [146, -27], [143, -17]], transitionKm: 230, effectMetres: -620 },
    { id: 'aurelia-western-lowland', polygon: [[-4, 17], [5, 20], [14, 16], [17, 9], [9, 5], [0, 9], [-4, 17]], transitionKm: 230, effectMetres: -420 },
    { id: 'varos-great-lowland', polygon: [[-121, 43], [-113, 46], [-103, 43], [-100, 35], [-108, 31], [-118, 35], [-121, 43]], transitionKm: 330, effectMetres: -550 },
    { id: 'veyra-east-river-basin', polygon: [[130, 36], [139, 40], [148, 36], [151, 29], [144, 25], [135, 29], [130, 36]], transitionKm: 250, effectMetres: -480 },
  ] satisfies readonly RegionControl[],
  rifts: [
    { id: 'sere-east-rift', points: [[-59, -8], [-56, -19], [-54, -30], [-51, -39]], widthKm: 95, effectMetres: -820 },
    { id: 'orthea-central-rift', points: [[-139, -24], [-136, -34], [-133, -44], [-130, -52]], widthKm: 78, effectMetres: -900 },
    { id: 'veyra-north-rift', points: [[110, 69], [121, 67], [132, 63]], widthKm: 105, effectMetres: -740 },
  ] satisfies readonly LineControl[],
  volcanicArcs: [
    { id: 'ash-arc-west', points: [[-51, 14], [-45, 8], [-39, 1], [-32, -7]], spacingKm: 150, radiusKm: 70, peakMetres: 1650 },
    { id: 'veyra-north-arc', points: [[72, 68], [79, 63], [86, 57]], spacingKm: 190, radiusKm: 85, peakMetres: 1850 },
    { id: 'namar-arc-west', points: [[128, -9], [138, -16], [148, -22]], spacingKm: 180, radiusKm: 75, peakMetres: 1600 },
    { id: 'namar-arc-east', points: [[157, -24], [165, -30], [174, -36]], spacingKm: 210, radiusKm: 88, peakMetres: 1950 },
  ] satisfies readonly VolcanoArc[],
  oceanTrenches: [
    { id: 'veyra-east-trench', points: [[165, 56], [162, 45], [160, 34], [158, 23]], widthKm: 210, effectMetres: -2750 },
    { id: 'namar-south-trench', points: [[171, -8], [174, -19], [173, -31], [168, -42]], widthKm: 230, effectMetres: -3000 },
    { id: 'varos-west-trench', points: [[-171, 45], [-168, 34], [-163, 22]], widthKm: 190, effectMetres: -2400 },
  ] satisfies readonly LineControl[],
  oceanRidges: [
    { id: 'western-mid-ocean-ridge', points: [[-35, 58], [-29, 36], [-26, 14], [-31, -8], [-37, -31], [-45, -54]], widthKm: 320, effectMetres: 1850 },
    { id: 'southern-ridge', points: [[-104, -61], [-63, -65], [-20, -63], [24, -66], [68, -64], [111, -67]], widthKm: 280, effectMetres: 1550 },
    { id: 'eastern-basin-ridge', points: [[57, 20], [61, -2], [56, -24], [48, -45]], widthKm: 245, effectMetres: 1050 },
  ] satisfies readonly LineControl[],
  /** Offshore areas are authored individually: no coast-distance ring is treated as a shelf by default. */
  shelves: [
    { id: 'varos-northwest-shelf', polygon: [[-169, 67], [-153, 70], [-135, 66], [-126, 59], [-137, 54], [-153, 55], [-169, 61], [-169, 67]], transitionKm: 300, effectMetres: 3100 },
    { id: 'varos-southeast-shelf', polygon: [[-112, 39], [-101, 42], [-91, 39], [-87, 32], [-97, 28], [-108, 31], [-112, 39]], transitionKm: 260, effectMetres: 2500 },
    { id: 'veyra-east-shelf', polygon: [[145, 55], [157, 58], [168, 53], [169, 44], [160, 39], [149, 43], [145, 55]], transitionKm: 310, effectMetres: 2700 },
    { id: 'aurelia-west-shelf', polygon: [[-13, 42], [-3, 44], [8, 39], [11, 31], [2, 26], [-8, 31], [-13, 42]], transitionKm: 250, effectMetres: 2400 },
    { id: 'sere-south-shelf', polygon: [[-91, -39], [-82, -47], [-70, -53], [-58, -53], [-56, -45], [-67, -39], [-80, -35], [-91, -39]], transitionKm: 270, effectMetres: 2500 },
    { id: 'namar-southern-shelf', polygon: [[121, -29], [129, -37], [143, -43], [158, -42], [160, -34], [148, -29], [133, -26], [121, -29]], transitionKm: 300, effectMetres: 2550 },
  ] satisfies readonly RegionControl[],
  /** Broad, authored ocean-floor provinces. These shape bathymetry independently from shelf margins and ridges. */
  oceanBasins: [
    { id: 'western-abyssal-basin', polygon: [[-172, 34], [-151, 40], [-139, 25], [-143, 5], [-155, -13], [-169, -8], [-176, 12], [-172, 34]], transitionKm: 900, effectMetres: -850 },
    { id: 'meridian-abyssal-basin', polygon: [[-72, 62], [-47, 66], [-31, 53], [-34, 27], [-45, 9], [-61, 13], [-77, 37], [-72, 62]], transitionKm: 1100, effectMetres: -650 },
    { id: 'eastern-abyssal-basin', polygon: [[50, 31], [72, 36], [83, 19], [77, -7], [64, -22], [49, -13], [43, 9], [50, 31]], transitionKm: 850, effectMetres: -950 },
    { id: 'southern-abyssal-basin', polygon: [[-109, -58], [-71, -56], [-40, -57], [-12, -60], [-18, -72], [-76, -78], [-108, -70], [-109, -58]], transitionKm: 1400, effectMetres: -700 },
  ] satisfies readonly RegionControl[],
} as const

const landFeatures = PLANETARY_GEOGRAPHY.features.filter(feature => feature.properties.kind === 'continent' || feature.properties.kind === 'island')
const featureBounds = landFeatures.map(feature => {
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates : []
  const points = polygons.flatMap(rings => rings.flat())
  return { feature, west: Math.min(...points.map(point => point[0])), east: Math.max(...points.map(point => point[0])), south: Math.min(...points.map(point => point[1])), north: Math.max(...points.map(point => point[1])) }
})

function mod(value: number, divisor: number): number { return ((value % divisor) + divisor) % divisor }
function smoothstep01(t: number): number { const v = Math.max(0, Math.min(1, t)); return v * v * (3 - 2 * v) }
function hash(x: number, y: number, seed: number): number {
  let n = Math.imul(x, 0x1f123bb5) ^ Math.imul(y, 0x5f356495) ^ seed
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b)
  return ((n ^ (n >>> 16)) >>> 0) / 0xffffffff
}
/** Smooth, longitude-periodic value noise. Its modest amplitude is detail over the authored structure, never a substitute for it. */
function periodicNoise(longitude: number, latitude: number, cellsX: number, cellsY: number, seed: number): number {
  const x = mod(longitude + 180, 360) / 360 * cellsX, y = Math.max(0, Math.min(cellsY, (90 - latitude) / 180 * cellsY))
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = smoothstep01(x - x0), fy = smoothstep01(y - y0)
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
function wrapLongitudeDelta(delta: number): number { return mod(delta + 180, 360) - 180 }
function nearestLine(point: PlanetPoint, line: readonly PlanetPoint[]): { distanceKm: number; segment: number; t: number } {
  let nearest = { distanceKm: Infinity, segment: 0, t: 0 }
  const cosLatitude = Math.max(0.035, Math.cos(point[1] * Math.PI / 180))
  const px = 0, py = 0
  // Work in a local tangent plane relative to the query point, with wrapped
  // longitudes so a line crossing the antimeridian takes the short route.
  for (let i = 1; i < line.length; i++) {
    const segmentLongitude = wrapLongitudeDelta(line[i][0] - line[i - 1][0])
    const startLongitude = wrapLongitudeDelta(line[i - 1][0] - point[0])
    const ax = startLongitude * 111.195 * cosLatitude
    const ay = (line[i - 1][1] - point[1]) * 111.195
    // Keep segment vertices on the same unwrapped copy of the globe. Wrapping
    // each endpoint independently creates a false line across the map edge.
    const bx = (startLongitude + segmentLongitude) * 111.195 * cosLatitude
    const by = (line[i][1] - point[1]) * 111.195
    const dx = bx - ax, dy = by - ay, length2 = dx * dx + dy * dy
    const t = length2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length2)) : 0
    const distanceKm = Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
    if (distanceKm < nearest.distanceKm) nearest = { distanceKm, segment: i - 1, t }
  }
  return nearest
}
export function distanceToLineKm(point: PlanetPoint, line: readonly PlanetPoint[]): number { return nearestLine(point, line).distanceKm }
function distanceToRingKm(point: PlanetPoint, ring: readonly PlanetPoint[]): number { return distanceToLineKm(point, [...ring, ring[0]]) }
function regionWeight(point: PlanetPoint, region: RegionControl): number {
  const inside = pointInRing(point, region.polygon), distance = distanceToRingKm(point, region.polygon)
  // Signed-distance fade: zero beyond the outer transition, half strength at
  // the authored boundary, and full strength inside. The old inside/outside
  // branches jumped from ~1 to 0 exactly at polygon edges.
  const signedDistance = inside ? distance : -distance
  return smoothstep01((signedDistance + region.transitionKm) / (2 * region.transitionKm))
}
function ridgeContribution(point: PlanetPoint, ridge: Ridge): number {
  const nearest = nearestLine(point, ridge.points)
  // Along-axis modulation and gentle coordinate warping break the repeated parallel Gaussian bands.
  const along = nearest.segment + nearest.t
  const modulation = 0.72 + 0.28 * Math.sin(along * 2.17 + ridge.seed)
  // Broad, low-amplitude deterministic axis warp gives the authored range
  // irregular margins without inventing detail below the 1° source spacing.
  const warp = (periodicNoise(point[0], point[1], 9, 7, PLANET_TERRAIN_RULES.seed + ridge.seed) - 0.5) * 170
  const distance = Math.max(0, nearest.distanceKm + warp)
  const widthNoise = periodicNoise(point[0], point[1], 13, 9, PLANET_TERRAIN_RULES.seed + ridge.seed * 3)
  const width = ridge.widthKm * (0.72 + 0.32 * Math.sin(along * 1.31 + ridge.seed * 0.7) + (widthNoise - 0.5) * 0.24)
  const core = Math.exp(-(distance * distance) / (2 * width ** 2))
  const foreland = Math.exp(-(distance * distance) / (2 * (width * 2.1) ** 2))
  const shoulder = Math.exp(-(distance * distance) / (2 * (width * 3.8) ** 2))
  return ridge.peakMetres * modulation * (core + 0.24 * foreland + 0.055 * shoulder)
}
function lineContribution(point: PlanetPoint, line: LineControl): number {
  const distance = distanceToLineKm(point, line.points)
  return line.effectMetres * Math.exp(-(distance * distance) / (2 * line.widthKm ** 2))
}
function arcContribution(point: PlanetPoint, arc: VolcanoArc): number {
  const nearest = nearestLine(point, arc.points)
  const lineLength = arc.points.slice(1).reduce((sum, next, i) => {
    const a = arc.points[i], dx = wrapLongitudeDelta(next[0] - a[0]) * 111.195 * Math.cos(point[1] * Math.PI / 180), dy = (next[1] - a[1]) * 111.195
    return sum + Math.hypot(dx, dy)
  }, 0)
  const centerIndex = Math.round((nearest.segment + nearest.t) * Math.max(1, lineLength / arc.spacingKm))
  const alongKm = (nearest.segment + nearest.t) * lineLength / Math.max(1, arc.points.length - 1)
  const centerKm = centerIndex * arc.spacingKm
  const alongDistance = Math.abs(alongKm - centerKm)
  const distance = Math.hypot(nearest.distanceKm, alongDistance * 0.38)
  return arc.peakMetres * Math.exp(-(distance * distance) / (2 * arc.radiusKm ** 2))
}

export function buildCoastDistance(mask: Uint8Array, width: number, height: number): Float32Array {
  const distance = new Float32Array(mask.length); distance.fill(Infinity)
  for (let i = 0; i < mask.length; i++) {
    const x = i % width, y = Math.floor(i / width)
    const west = y * width + mod(x - 1, width), east = y * width + mod(x + 1, width)
    if (mask[west] !== mask[i] || mask[east] !== mask[i] || (y > 0 && mask[i - width] !== mask[i]) || (y + 1 < height && mask[i + width] !== mask[i])) distance[i] = 0
  }
  const relax = (x: number, y: number, nx: number, ny: number) => {
    if (ny < 0 || ny >= height) return
    const index = y * width + x, next = ny * width + mod(nx, width)
    if (mask[index] !== mask[next]) return
    const lat = 90 - (y + 0.5), weight = 111.195 * Math.hypot(nx === x ? 0 : Math.cos(lat * Math.PI / 180), ny === y ? 0 : 1)
    distance[index] = Math.min(distance[index], distance[next] + weight)
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) for (const [dx, dy] of [[-1, 0], [0, -1], [-1, -1], [1, -1]] as const) relax(x, y, x + dx, y + dy)
  for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]] as const) relax(x, y, x + dx, y + dy)
  return distance
}

function landElevation(point: PlanetPoint, coastDistanceKm: number): number {
  const broad = (periodicNoise(point[0], point[1], 8, 6, PLANET_TERRAIN_RULES.seed + 1) - 0.5) * 420
  const regional = (periodicNoise(point[0], point[1], 19, 12, PLANET_TERRAIN_RULES.seed + 2) - 0.5) * 210
  const detail = (periodicNoise(point[0], point[1], 53, 31, PLANET_TERRAIN_RULES.seed + 3) - 0.5) * 80
  const c = PLANET_TERRAIN_CONTROLS
  const ridges = c.mountainSystems.reduce((sum, ridge) => sum + ridgeContribution(point, ridge), 0)
  // Tablelands are interior structures; taper them into lower coastal relief instead of letting every edge end as a sheer escarpment.
  const plateauInterior = smoothstep01(coastDistanceKm / 220)
  const plateaus = c.plateaus.reduce((sum, area) => sum + regionWeight(point, area) * area.effectMetres, 0) * plateauInterior
  const basins = c.basins.reduce((sum, area) => sum + regionWeight(point, area) * area.effectMetres, 0)
  const rifts = c.rifts.reduce((sum, line) => sum + lineContribution(point, line), 0)
  const volcanoes = c.volcanicArcs.reduce((sum, arc) => sum + arcContribution(point, arc), 0)
  return Math.max(25, 500 + broad + regional + detail + ridges + plateaus + basins + rifts + volcanoes)
}
function oceanElevation(point: PlanetPoint, coastDistanceKm: number): number {
  const c = PLANET_TERRAIN_CONTROLS
  const broadBasin = (periodicNoise(point[0], point[1], 7, 5, PLANET_TERRAIN_RULES.seed + 11) - 0.5) * 820
  const basinTexture = (periodicNoise(point[0], point[1], 17, 10, PLANET_TERRAIN_RULES.seed + 12) - 0.5) * 380
  // A broad continental slope avoids placing abyssal depths immediately beside every coast.
  // This is deliberately low-contrast and does not classify the whole margin as a shelf.
  const continentalSlope = 1700 * (1 - smoothstep01(coastDistanceKm / 700))
  const shelfRise = c.shelves.reduce((sum, shelf) => sum + regionWeight(point, shelf) * shelf.effectMetres, 0)
  const basinRelief = c.oceanBasins.reduce((sum, basin) => sum + regionWeight(point, basin) * basin.effectMetres, 0)
  const ridges = c.oceanRidges.reduce((sum, ridge) => sum + lineContribution(point, ridge), 0)
  // Trenches are offshore subduction forms: fade their depth as they approach the continental margin.
  const trenchApproach = smoothstep01(coastDistanceKm / 360)
  const trenches = c.oceanTrenches.reduce((sum, trench) => sum + lineContribution(point, trench) * trenchApproach, 0)
  return Math.min(-25, -4550 + continentalSlope + broadBasin + basinTexture + shelfRise + basinRelief + ridges + trenches)
}
function slopeFromHeights(west: number, east: number, north: number, south: number, longitudeStep: number, latitudeStep: number, latitude: number): number {
  const dx = Math.max(1, 2 * longitudeStep * 111_195 * Math.max(0.04, Math.cos(latitude * Math.PI / 180)))
  const dy = Math.max(1, 2 * latitudeStep * 111_195)
  return Math.atan(Math.hypot((east - west) / dx, (north - south) / dy)) * 180 / Math.PI
}

function classify(elevation: number, slope: number, relief: number, coastKm: number, shelf: boolean, plateauWeight: number, riftWeight: number, volcanicWeight: number): PlanetTerrainClass {
  if (elevation < 0) return shelf ? 'continentalShelf' : 'deepOcean'
  if (volcanicWeight > 0.56 && elevation > 500) return 'volcanic'
  if (riftWeight > 0.38 && elevation < 2100) return 'riftValley'
  if (plateauWeight > 0.55 && slope < 10) return 'plateau'
  if (elevation > 3000 && (slope > 7 || relief > 500)) return 'highMountains'
  if (elevation > 1450 && (slope > 5 || relief > 280)) return 'mountains'
  if (coastKm < 190 && elevation < 450 && slope < 5) return 'coastalPlain'
  if (slope > 4.5 || relief > 260 || elevation > 850) return 'hills'
  return 'plains'
}

export function generatePlanetTerrain(): PlanetTerrainModel {
  const { width, height, westLongitude, northLatitude, cellSizeDegrees, noData } = PLANET_TERRAIN_RULES
  const size = width * height, landMask = new Uint8Array(size), shelfMask = new Uint8Array(size)
  const values = new Int16Array(size); values.fill(noData)
  const classes = new Uint8Array(size), slopes = new Float32Array(size), reliefs = new Uint16Array(size)
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
    const point: PlanetPoint = [westLongitude + (column + 0.5) * cellSizeDegrees, northLatitude - (row + 0.5) * cellSizeDegrees]
    landMask[row * width + column] = Number(isPlanetLand(point))
  }
  const coastDistance = buildCoastDistance(landMask, width, height)
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
    const index = row * width + column, point: PlanetPoint = [westLongitude + (column + 0.5) * cellSizeDegrees, northLatitude - (row + 0.5) * cellSizeDegrees]
    const shelfWeight = PLANET_TERRAIN_CONTROLS.shelves.reduce((sum, shelf) => sum + regionWeight(point, shelf), 0)
    shelfMask[index] = Number(!landMask[index] && shelfWeight > 0.45)
    const elevation = landMask[index] ? landElevation(point, coastDistance[index]) : oceanElevation(point, coastDistance[index])
    values[index] = Math.round(Math.max(-9000, Math.min(8848, elevation)))
  }
  const heightAt = (x: number, y: number) => values[Math.max(0, Math.min(height - 1, y)) * width + mod(x, width)]
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
    const index = row * width + column, point: PlanetPoint = [westLongitude + (column + 0.5) * cellSizeDegrees, northLatitude - (row + 0.5) * cellSizeDegrees]
    const value = values[index]
    slopes[index] = slopeFromHeights(heightAt(column - 1, row), heightAt(column + 1, row), heightAt(column, row - 1), heightAt(column, row + 1), cellSizeDegrees, cellSizeDegrees, point[1])
    let low = value, high = value
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const neighbor = heightAt(column + dx, row + dy); low = Math.min(low, neighbor); high = Math.max(high, neighbor) }
    reliefs[index] = Math.min(65535, high - low)
    const c = PLANET_TERRAIN_CONTROLS
    const plateauWeight = c.plateaus.reduce((sum, area) => sum + regionWeight(point, area), 0) * smoothstep01(coastDistance[index] / 220)
    const riftWeight = c.rifts.reduce((sum, line) => sum + Math.max(0, -lineContribution(point, line) / Math.abs(line.effectMetres)), 0)
    const volcanicWeight = c.volcanicArcs.reduce((sum, arc) => sum + arcContribution(point, arc) / arc.peakMetres, 0)
    classes[index] = CLASS_CODE[classify(value, slopes[index], reliefs[index], coastDistance[index], Boolean(shelfMask[index]), plateauWeight, riftWeight, volcanicWeight)]
  }
  return {
    elevation: { type: 'PlanetElevationTile', id: 'planet-dem-global-1deg-v3', coordinateReferenceId: PLANETARY_GEOGRAPHY.coordinateReference.id, detailLevel: 'global', origin: [westLongitude, northLatitude], cellSize: [cellSizeDegrees, cellSizeDegrees], width, height, noData, seaLevelMetres: 0, units: 'metres', generator: { id: PLANET_TERRAIN_RULES.generatorId, version: PLANET_TERRAIN_RULES.generatorVersion, seed: PLANET_TERRAIN_RULES.seed }, values },
    classes: { type: 'PlanetTerrainClassGrid', id: 'planet-morphology-global-1deg-v3', coordinateReferenceId: PLANETARY_GEOGRAPHY.coordinateReference.id, detailLevel: 'global', width, height, values: classes },
    landMask, slopeDegrees: slopes, localReliefMetres: reliefs, shelfMask,
  }
}
export const PLANET_TERRAIN = generatePlanetTerrain()

export function samplePlanetElevation(tile: PlanetElevationTile, point: PlanetPoint): number {
  const [longitude, latitude] = point
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) return tile.noData
  const x = mod((longitude - tile.origin[0]) / tile.cellSize[0] - 0.5, tile.width)
  const y = Math.max(0, Math.min(tile.height - 1, (tile.origin[1] - latitude) / tile.cellSize[1] - 0.5))
  const x0 = Math.floor(x), x1 = (x0 + 1) % tile.width, y0 = Math.floor(y), y1 = Math.min(tile.height - 1, y0 + 1)
  const at = (cx: number, cy: number) => tile.values[cy * tile.width + cx]
  const fx = x - x0, fy = y - y0, top = at(x0, y0) * (1 - fx) + at(x1, y0) * fx, bottom = at(x0, y1) * (1 - fx) + at(x1, y1) * fx
  return top * (1 - fy) + bottom * fy
}
export function samplePlanetTerrainClass(grid: PlanetTerrainClassGrid, point: PlanetPoint): number {
  const x = mod(Math.floor(mod(point[0] + 180, 360)), grid.width), y = Math.max(0, Math.min(grid.height - 1, Math.floor(90 - point[1])))
  return grid.values[y * grid.width + x]
}

export type TerrainRenderMode = 'elevation' | 'slope' | 'morphology' | 'shaded-relief' | 'bathymetry'
function ramp(value: number, stops: readonly (readonly [number, readonly [number, number, number]])[]): readonly [number, number, number] {
  if (value <= stops[0][0]) return stops[0][1]
  for (let i = 1; i < stops.length; i++) if (value <= stops[i][0]) {
    const [lo, ca] = stops[i - 1], [hi, cb] = stops[i], t = (value - lo) / (hi - lo)
    return [0, 1, 2].map(channel => Math.round(ca[channel] * (1 - t) + cb[channel] * t)) as [number, number, number]
  }
  return stops[stops.length - 1][1]
}
const landStops = [[0, [103, 132, 105]], [250, [132, 151, 111]], [700, [160, 158, 111]], [1300, [173, 147, 105]], [2200, [164, 127, 98]], [3400, [183, 157, 130]], [5000, [237, 230, 209]], [8848, [255, 255, 248]]] as const
const oceanStops = [[-9000, [8, 24, 47]], [-7000, [11, 37, 64]], [-5000, [17, 55, 79]], [-3500, [23, 76, 99]], [-2000, [35, 101, 119]], [-700, [54, 129, 139]], [-25, [83, 153, 151]]] as const
const classColor: Record<PlanetTerrainClass, readonly [number, number, number]> = {
  deepOcean: [12, 41, 68], continentalShelf: [47, 111, 126], coastalPlain: [125, 159, 115], plains: [151, 163, 112], hills: [159, 143, 103],
  plateau: [176, 133, 99], mountains: [181, 120, 93], highMountains: [225, 216, 196], riftValley: [111, 137, 104], volcanic: [150, 83, 69],
}
const CLASS_BY_CODE: readonly PlanetTerrainClass[] = Object.keys(CLASS_CODE) as PlanetTerrainClass[]
function shadeAt(tile: PlanetElevationTile, point: PlanetPoint): number {
  const [dx, dy] = tile.cellSize, latCos = Math.max(0.04, Math.cos(point[1] * Math.PI / 180))
  const west = samplePlanetElevation(tile, [mod(point[0] - dx + 180, 360) - 180, point[1]]), east = samplePlanetElevation(tile, [mod(point[0] + dx + 180, 360) - 180, point[1]])
  const north = samplePlanetElevation(tile, [point[0], Math.min(90, point[1] + dy)]), south = samplePlanetElevation(tile, [point[0], Math.max(-90, point[1] - dy)])
  const dzdx = (east - west) / (2 * dx * 111_195 * latCos), dzdy = (north - south) / (2 * dy * 111_195)
  // Vertical exaggeration affects only the derived shade, not stored elevation values.
  const nx = -dzdx * PLANET_TERRAIN_RENDERING.hillshadeVerticalExaggeration, ny = -dzdy * PLANET_TERRAIN_RENDERING.hillshadeVerticalExaggeration
  const length = Math.hypot(nx, ny, 1), azimuth = PLANET_TERRAIN_RENDERING.hillshadeAzimuthDegrees * Math.PI / 180, altitude = PLANET_TERRAIN_RENDERING.hillshadeAltitudeDegrees * Math.PI / 180
  const dot = (nx * Math.sin(azimuth) * Math.cos(altitude) + ny * Math.cos(azimuth) * Math.cos(altitude) + Math.sin(altitude)) / length
  return Math.max(0.58, Math.min(1.24, 0.82 + dot * 0.42))
}
export function inverseEqualEarth(x: number, y: number): PlanetPoint | null {
  const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, scale = 270
  const xNorm = (x - 800) / scale, yNorm = (400 - y) / scale
  let theta = yNorm / A1
  for (let i = 0; i < 6; i++) {
    const t2 = theta * theta, t6 = t2 ** 3, t8 = t6 * t2
    const f = theta * (A1 + A2 * t2 + A3 * t6 + A4 * t8) - yNorm, derivative = A1 + 3 * A2 * t2 + 7 * A3 * t6 + 9 * A4 * t8
    theta -= f / derivative
  }
  const sinePhi = Math.sin(theta) / (Math.sqrt(3) / 2)
  if (Math.abs(sinePhi) > 1) return null
  const latitude = Math.asin(sinePhi) * 180 / Math.PI, denominator = 3 * (9 * A4 * theta ** 8 + 7 * A3 * theta ** 6 + 3 * A2 * theta ** 2 + A1)
  const longitude = xNorm * denominator / (2 * Math.sqrt(3) * Math.cos(theta)) * 180 / Math.PI
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude > 180) return null
  return [longitude, latitude]
}

/** RGBA diagnostic renderer. Display resampling interpolates existing samples; it does not add terrain information. */
export function renderPlanetTerrainPixels(model: PlanetTerrainModel | PlanetElevationTile, width: number, height: number, mode: TerrainRenderMode = 'elevation'): Uint8ClampedArray {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new RangeError('Terrain render dimensions must be positive integers.')
  const tile = 'elevation' in model ? model.elevation : model, pixels = new Uint8ClampedArray(width * height * 4)
  const classes = 'elevation' in model ? model.classes : null
  const slopes = 'elevation' in model ? model.slopeDegrees : null
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
    const point = inverseEqualEarth((column + 0.5) / width * 1600, (row + 0.5) / height * 800), offset = (row * width + column) * 4
    if (!point) { pixels[offset + 3] = 0; continue }
    const elevation = samplePlanetElevation(tile, point), x = mod(Math.floor(mod(point[0] + 180, 360)), tile.width), y = Math.max(0, Math.min(tile.height - 1, Math.floor(90 - point[1]))), index = y * tile.width + x
    if (elevation === tile.noData) { pixels[offset + 3] = 0; continue }
    let color: readonly [number, number, number]
    if (mode === 'slope') color = ramp(slopes?.[index] ?? 0, [[0, [25, 68, 75]], [2, [46, 105, 111]], [6, [107, 148, 130]], [14, [189, 162, 115]], [28, [218, 120, 83]], [55, [238, 214, 178]], [90, [255, 250, 239]]])
    else if (mode === 'morphology' && classes) color = classColor[CLASS_BY_CODE[classes.values[index]] ?? 'plains']
    else if (mode === 'bathymetry') color = elevation < 0 ? ramp(elevation, oceanStops) : [93, 107, 92]
    else color = elevation < 0 ? ramp(elevation, oceanStops) : ramp(elevation, landStops)
    const shade = mode === 'shaded-relief' ? shadeAt(tile, point) : 1
    pixels[offset] = Math.round(color[0] * shade); pixels[offset + 1] = Math.round(color[1] * shade); pixels[offset + 2] = Math.round(color[2] * shade); pixels[offset + 3] = 255
  }
  return pixels
}

export function planetaryTerrainFeatures() { return landFeatures }
