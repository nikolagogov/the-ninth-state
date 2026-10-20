import { PLANETARY_GEOGRAPHY } from './planetGeography.ts'
import { EQUAL_EARTH_VIEW } from './planetProjection.ts'
import { PLANET_TERRAIN, PLANET_TERRAIN_RULES, buildCoastDistance, inverseEqualEarth, type PlanetElevationTile } from './planetTerrain.ts'
import type { PlanetPoint } from './geographyTypes.ts'

/** Thresholds reflect the global 1° source grid; they do not imply regional river detail. */
export const PLANET_HYDROLOGY_RULES = {
  generatorId: 'ninth-state-global-hydrology', generatorVersion: 1,
  sinkDepressionDepthMetres: 180, sinkMinimumCoastDistanceKm: 450, sinkMinimumSeparationKm: 400, maximumEndorheicSinks: 16,
  tributaryThresholdKm2: 180_000, mainRiverThresholdKm2: 1_500_000, deltaThresholdKm2: 1_000_000,
  minimumLakeAreaKm2: 20_000,
} as const

const DIRECTIONS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const
const UNROUTED = -1

export type HydroOutletKind = 'ocean' | 'endorheic'
export type HydroBasin = { id: string; outletCellIndex: number; kind: HydroOutletKind; areaKm2: number; outlet: PlanetPoint }
export type HydroRiver = {
  id: string; systemId: string; order: 'main' | 'tributary';
  /** Consecutive grid cells follow flowTo; wrap links may cross ±180° while remaining connected here. */
  cellIndices: number[]; /** Render-ready paths split at the map seam. */
  segments: PlanetPoint[][]; outletCellIndex: number; maximumAccumulationKm2: number
}
export type HydroLake = { id: string; basinId: string; center: PlanetPoint; areaKm2: number; depressionDepthMetres: number }
export type HydroDelta = { id: string; riverId: string; outletCellIndex: number; position: PlanetPoint; contributingAreaKm2: number }
export type PlanetHydrologyModel = {
  id: string; demId: string; width: number; height: number; cellSizeDegrees: number;
  conditionedElevationMetres: Float32Array; flowTo: Int32Array; visitOrder: Uint32Array;
  accumulationKm2: Float64Array; basinRoot: Int32Array; landMask: Uint8Array;
  depressionFillMetres: Float32Array; terminalOutletKind: Uint8Array;
  basins: HydroBasin[]; rivers: HydroRiver[]; lakes: HydroLake[]; deltas: HydroDelta[];
  diagnostics: { filledCellCount: number; maximumFillMetres: number; meanFillMetres: number; seaConnectedFilledCellCount: number; seaConnectedMaximumFillMetres: number; seaConnectedMeanFillMetres: number; flatLandCellCount: number; sinkCandidateCount: number; riverCellCount: number; runtimeMs: number }
}

type FloodResult = { filled: Float32Array; flowTo: Int32Array; visitOrder: Uint32Array; outletKind: Uint8Array }
class MinHeap {
  private nodes: number[] = []
  private readonly score: Float32Array
  constructor(score: Float32Array) { this.score = score }
  get length() { return this.nodes.length }
  push(node: number) {
    const a = this.nodes; a.push(node); let i = a.length - 1
    while (i > 0) { const p = (i - 1) >> 1; if (!this.before(a[i], a[p])) break; [a[i], a[p]] = [a[p], a[i]]; i = p }
  }
  pop(): number {
    const a = this.nodes, first = a[0], last = a.pop()!
    if (a.length) { a[0] = last; let i = 0
      while (true) { const l = i * 2 + 1, r = l + 1; let best = i
        if (l < a.length && this.before(a[l], a[best])) best = l
        if (r < a.length && this.before(a[r], a[best])) best = r
        if (best === i) break
        ;[a[i], a[best]] = [a[best], a[i]]; i = best
      }
    }
    return first
  }
  private before(a: number, b: number) { return this.score[a] < this.score[b] || (this.score[a] === this.score[b] && a < b) }
}

function neighbors(index: number, width: number, height: number): number[] {
  const x = index % width, y = Math.floor(index / width), result: number[] = []
  for (const [dx, dy] of DIRECTIONS) {
    const ny = y + dy
    if (ny < 0 || ny >= height) continue
    const next = ny * width + ((x + dx + width) % width)
    if (next !== index && !result.includes(next)) result.push(next)
  }
  return result
}
function cellPoint(index: number, width: number = PLANET_TERRAIN_RULES.width): PlanetPoint {
  return [PLANET_TERRAIN_RULES.westLongitude + (index % width + 0.5) * PLANET_TERRAIN_RULES.cellSizeDegrees,
    PLANET_TERRAIN_RULES.northLatitude - (Math.floor(index / width) + 0.5) * PLANET_TERRAIN_RULES.cellSizeDegrees]
}
function cellAreaKm2(index: number, width: number): number {
  const row = Math.floor(index / width), lat = 90 - (row + 0.5), half = PLANET_TERRAIN_RULES.cellSizeDegrees / 2
  const radians = Math.PI / 180, radius = PLANETARY_GEOGRAPHY.coordinateReference.radiusKm
  return radius * radius * PLANET_TERRAIN_RULES.cellSizeDegrees * radians * (Math.sin((lat + half) * radians) - Math.sin((lat - half) * radians))
}
function greatCircleKm(a: PlanetPoint, b: PlanetPoint): number {
  const rad = Math.PI / 180, dLat = (b[1] - a[1]) * rad, dLon = (((b[0] - a[0] + 540) % 360) - 180) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2
  return 2 * PLANETARY_GEOGRAPHY.coordinateReference.radiusKm * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))))
}
function priorityFlood(dem: PlanetElevationTile, land: Uint8Array, sinkSeeds: readonly number[] = []): FloodResult {
  const size = dem.width * dem.height, filled = new Float32Array(dem.values.length), flowTo = new Int32Array(size), visitOrder = new Uint32Array(size)
  const outletKind = new Uint8Array(size), visited = new Uint8Array(size), heap = new MinHeap(filled)
  flowTo.fill(UNROUTED)
  for (let i = 0; i < size; i++) if (!land[i]) { visited[i] = 1; filled[i] = dem.values[i]; flowTo[i] = i; outletKind[i] = 1; heap.push(i) }
  for (const sink of sinkSeeds) if (!visited[sink]) { visited[sink] = 1; filled[sink] = dem.values[sink]; flowTo[sink] = sink; outletKind[sink] = 2; heap.push(sink) }
  let order = 0
  while (heap.length) {
    const current = heap.pop(); visitOrder[current] = order++
    for (const next of neighbors(current, dem.width, dem.height)) {
      if (visited[next]) continue
      visited[next] = 1
      filled[next] = Math.max(dem.values[next], filled[current])
      flowTo[next] = current
      heap.push(next)
    }
  }
  return { filled, flowTo, visitOrder, outletKind }
}
function detectEndorheicSinks(dem: PlanetElevationTile, land: Uint8Array, flood: FloodResult): number[] {
  const coast = buildCoastDistance(land, dem.width, dem.height), candidates: Array<{ index: number; depth: number }> = []
  for (let i = 0; i < land.length; i++) {
    if (!land[i]) continue
    const depth = flood.filled[i] - dem.values[i]
    if (depth < PLANET_HYDROLOGY_RULES.sinkDepressionDepthMetres || coast[i] < PLANET_HYDROLOGY_RULES.sinkMinimumCoastDistanceKm) continue
    const adjacent = neighbors(i, dem.width, dem.height)
    if (adjacent.every(next => dem.values[next] >= dem.values[i])) candidates.push({ index: i, depth })
  }
  candidates.sort((a, b) => b.depth - a.depth || a.index - b.index)
  const selected: number[] = [], selectedPoints: PlanetPoint[] = []
  for (const candidate of candidates) {
    const point = cellPoint(candidate.index, dem.width)
    if (selectedPoints.some(other => greatCircleKm(point, other) < PLANET_HYDROLOGY_RULES.sinkMinimumSeparationKm)) continue
    selected.push(candidate.index); selectedPoints.push(point)
    if (selected.length >= PLANET_HYDROLOGY_RULES.maximumEndorheicSinks) break
  }
  return selected
}
function stableCellId(prefix: string, index: number, width: number): string {
  return `${prefix}-${Math.floor(index / width).toString().padStart(3, '0')}-${(index % width).toString().padStart(3, '0')}`
}
function lineSegments(indices: readonly number[], width: number): PlanetPoint[][] {
  const segments: PlanetPoint[][] = []
  for (const index of indices) {
    const point = cellPoint(index, width), previous = segments.at(-1)?.at(-1)
    if (!previous) { segments.push([point]); continue }
    if (Math.abs(point[0] - previous[0]) > 180) {
      const unwrappedLongitude = point[0] + (previous[0] > 0 ? 360 : -360)
      const edgeLongitude = previous[0] > 0 ? 180 : -180
      const t = (edgeLongitude - previous[0]) / (unwrappedLongitude - previous[0])
      const edgeLatitude = previous[1] + (point[1] - previous[1]) * t
      segments.at(-1)!.push([edgeLongitude, edgeLatitude])
      segments.push([[-edgeLongitude, edgeLatitude], point])
    } else segments.at(-1)!.push(point)
  }
  return segments.filter(segment => segment.length >= 2)
}
function extractRivers(flowTo: Int32Array, order: Uint32Array, accumulation: Float64Array, land: Uint8Array, basinRoot: Int32Array, width: number): { rivers: HydroRiver[]; streamMask: Uint8Array; streamOrder: Uint8Array } {
  const size = flowTo.length, incoming = new Uint16Array(size), streamMask = new Uint8Array(size), streamOrder = new Uint8Array(size)
  for (let i = 0; i < size; i++) if (land[i] && accumulation[i] >= PLANET_HYDROLOGY_RULES.tributaryThresholdKm2) streamMask[i] = 1
  for (let i = 0; i < size; i++) if (streamMask[i] && flowTo[i] !== i && streamMask[flowTo[i]]) incoming[flowTo[i]]++
  const maxOrder = new Uint8Array(size), maxOrderCount = new Uint8Array(size)
  const byReverseOrder = Array.from({ length: size }, (_, i) => i).sort((a, b) => order[b] - order[a])
  for (const i of byReverseOrder) {
    if (!streamMask[i]) continue
    const value = Math.max(1, maxOrder[i] + Number(maxOrderCount[i] > 1))
    streamOrder[i] = value
    const next = flowTo[i]
    if (next !== i && streamMask[next]) {
      if (value > maxOrder[next]) { maxOrder[next] = value; maxOrderCount[next] = 1 }
      else if (value === maxOrder[next]) maxOrderCount[next]++
    }
  }
  const rivers: HydroRiver[] = [], visitedEdges = new Set<number>()
  for (let start = 0; start < size; start++) {
    if (!streamMask[start] || incoming[start] === 1) continue
    let current = start
    const cells = [start]
    while (flowTo[current] !== current) {
      const next = flowTo[current]
      if (!land[next]) { cells.push(next); break }
      if (!streamMask[next] || incoming[next] !== 1) { cells.push(next); break }
      if (visitedEdges.has(current)) break
      visitedEdges.add(current); current = next; cells.push(current)
    }
    let maximumAccumulationKm2 = 0
    for (const cell of cells) maximumAccumulationKm2 = Math.max(maximumAccumulationKm2, accumulation[cell])
    const outletCellIndex = cells.at(-1)!
    const main = maximumAccumulationKm2 >= PLANET_HYDROLOGY_RULES.mainRiverThresholdKm2
    rivers.push({ id: `river-${main ? 'main' : 'tributary'}-${stableCellId('cell', start, width).slice(5)}`, systemId: stableCellId('system', basinRoot[start], width), order: main ? 'main' : 'tributary', cellIndices: cells, segments: lineSegments(cells, width), outletCellIndex, maximumAccumulationKm2 })
  }
  return { rivers: rivers.filter(river => river.segments.length > 0), streamMask, streamOrder }
}

export function generatePlanetHydrology(dem: PlanetElevationTile = PLANET_TERRAIN.elevation, land: Uint8Array = PLANET_TERRAIN.landMask): PlanetHydrologyModel {
  const started = performance.now(), { width, height } = dem, size = width * height
  if (land.length !== size || dem.values.length !== size) throw new RangeError('Hydrology inputs must match the elevation grid dimensions.')
  if (land.every(value => value !== 0)) throw new RangeError('Hydrology requires at least one ocean outlet cell.')
  // First pass is strictly DEM-derived. Its fill depths identify closed depressions;
  // those original elevations are never rewritten.
  const oceanFlood = priorityFlood(dem, land)
  const sinkSeeds = detectEndorheicSinks(dem, land, oceanFlood)
  const flood = sinkSeeds.length ? priorityFlood(dem, land, sinkSeeds) : oceanFlood
  const accumulation = new Float64Array(size), basinRoot = new Int32Array(size); basinRoot.fill(UNROUTED)
  for (let i = 0; i < size; i++) if (land[i]) accumulation[i] = cellAreaKm2(i, width)
  const topo = Array.from({ length: size }, (_, i) => i).sort((a, b) => flood.visitOrder[a] - flood.visitOrder[b])
  for (let n = topo.length - 1; n >= 0; n--) {
    const i = topo[n], next = flood.flowTo[i]
    if (next !== UNROUTED && next !== i) accumulation[next] += accumulation[i]
  }
  for (const i of topo) {
    const next = flood.flowTo[i]
    if (land[i]) basinRoot[i] = next === i || !land[next] ? next : basinRoot[next]
  }
  const outletAreas = new Map<number, number>()
  for (let i = 0; i < size; i++) if (land[i] && basinRoot[i] >= 0) outletAreas.set(basinRoot[i], (outletAreas.get(basinRoot[i]) ?? 0) + cellAreaKm2(i, width))
  const basins: HydroBasin[] = [...outletAreas.entries()].map(([root, areaKm2]) => ({
    id: stableCellId(flood.outletKind[root] === 2 ? 'endorheic-basin' : 'ocean-basin', root, width), outletCellIndex: root,
    kind: (flood.outletKind[root] === 2 ? 'endorheic' : 'ocean') as HydroOutletKind, areaKm2, outlet: cellPoint(root, width),
  })).sort((a, b) => a.id.localeCompare(b.id))
  const streams = extractRivers(flood.flowTo, flood.visitOrder, accumulation, land, basinRoot, width)
  const lakes: HydroLake[] = []
  const coast = buildCoastDistance(land, width, height)
  const endorheic = basins.filter(basin => basin.kind === 'endorheic')
  for (const basin of endorheic) {
    const root = basin.outletCellIndex
    let lakeCells = 0, lakeAreaKm2 = 0, depthSum = 0, maxDepth = 0
    for (let i = 0; i < size; i++) if (land[i] && basinRoot[i] === root) {
      const depth = oceanFlood.filled[i] - dem.values[i]
      if (depth >= 80 && coast[i] > PLANET_HYDROLOGY_RULES.sinkMinimumCoastDistanceKm) { lakeCells++; lakeAreaKm2 += cellAreaKm2(i, width); depthSum += depth; maxDepth = Math.max(maxDepth, depth) }
    }
    const areaKm2 = lakeAreaKm2
    if (areaKm2 >= PLANET_HYDROLOGY_RULES.minimumLakeAreaKm2) lakes.push({ id: stableCellId('lake', root, width), basinId: basin.id, center: cellPoint(root, width), areaKm2, depressionDepthMetres: lakeCells ? depthSum / lakeCells : maxDepth })
  }
  const deltas: HydroDelta[] = []
  for (const river of streams.rivers) {
    const mouth = river.outletCellIndex
    if (land[mouth] || river.maximumAccumulationKm2 < PLANET_HYDROLOGY_RULES.deltaThresholdKm2) continue
    const lastLand = [...river.cellIndices].reverse().find(index => land[index])
    if (lastLand === undefined || PLANET_TERRAIN.slopeDegrees[lastLand] > 8 || dem.values[lastLand] > 800) continue
    deltas.push({ id: `delta-${river.id}`, riverId: river.id, outletCellIndex: mouth, position: cellPoint(mouth, width), contributingAreaKm2: river.maximumAccumulationKm2 })
  }
  let filledCellCount = 0, fillSum = 0, maximumFillMetres = 0, seaConnectedFilledCellCount = 0, seaConnectedFillSum = 0, seaConnectedMaximumFillMetres = 0, flatLandCellCount = 0
  for (let i = 0; i < size; i++) if (land[i]) {
    const fill = Math.max(0, flood.filled[i] - dem.values[i])
    if (fill > 0.5) { filledCellCount++; fillSum += fill; maximumFillMetres = Math.max(maximumFillMetres, fill) }
    const seaFill = Math.max(0, oceanFlood.filled[i] - dem.values[i])
    if (seaFill > 0.5) { seaConnectedFilledCellCount++; seaConnectedFillSum += seaFill; seaConnectedMaximumFillMetres = Math.max(seaConnectedMaximumFillMetres, seaFill) }
    if (neighbors(i, width, height).some(next => land[next] && dem.values[next] === dem.values[i])) flatLandCellCount++
  }
  const riverCellCount = streams.streamMask.reduce((sum, value) => sum + value, 0)
  return {
    id: `planet-hydrology-global-1deg-v${PLANET_HYDROLOGY_RULES.generatorVersion}`, demId: dem.id, width, height, cellSizeDegrees: PLANET_TERRAIN_RULES.cellSizeDegrees,
    conditionedElevationMetres: flood.filled, flowTo: flood.flowTo, visitOrder: flood.visitOrder, accumulationKm2: accumulation,
    basinRoot, landMask: new Uint8Array(land), depressionFillMetres: Float32Array.from(flood.filled, (value, i) => Math.max(0, value - dem.values[i])), terminalOutletKind: flood.outletKind,
    basins, rivers: streams.rivers, lakes, deltas,
    diagnostics: { filledCellCount, maximumFillMetres, meanFillMetres: filledCellCount ? fillSum / filledCellCount : 0, seaConnectedFilledCellCount, seaConnectedMaximumFillMetres, seaConnectedMeanFillMetres: seaConnectedFilledCellCount ? seaConnectedFillSum / seaConnectedFilledCellCount : 0, flatLandCellCount, sinkCandidateCount: sinkSeeds.length, riverCellCount, runtimeMs: performance.now() - started },
  }
}
export const PLANET_HYDROLOGY = generatePlanetHydrology()

/** Transparent, deterministic catchment tint for the global Equal Earth preview. */
export function renderHydrologyCatchmentPixels(model: PlanetHydrologyModel, width: number, height: number): Uint8ClampedArray {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new RangeError('Hydrology render dimensions must be positive integers.')
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const point = inverseEqualEarth((x + 0.5) / width * EQUAL_EARTH_VIEW.width, (y + 0.5) / height * EQUAL_EARTH_VIEW.height)
    if (!point) continue
    const column = Math.floor(((point[0] + 180) % 360 + 360) % 360), row = Math.max(0, Math.min(model.height - 1, Math.floor(90 - point[1])))
    const index = row * model.width + column
    if (!model.landMask[index] || model.basinRoot[index] < 0) continue
    const root = model.basinRoot[index], hue = (root * 137.508) % 360, c = 0.24, xh = c * (1 - Math.abs((hue / 60) % 2 - 1)), m = 0.42 - c / 2
    const rgb = hue < 60 ? [c, xh, 0] : hue < 120 ? [xh, c, 0] : hue < 180 ? [0, c, xh] : hue < 240 ? [0, xh, c] : hue < 300 ? [xh, 0, c] : [c, 0, xh]
    const offset = (y * width + x) * 4
    pixels[offset] = Math.round((rgb[0] + m) * 255); pixels[offset + 1] = Math.round((rgb[1] + m) * 255); pixels[offset + 2] = Math.round((rgb[2] + m) * 255); pixels[offset + 3] = 105
  }
  return pixels
}
