import type { MapViewBox } from './geographyTypes'

export type MapCamera = { x: number; y: number; width: number; height: number }
export type GeographicDetailLevel = 'global' | 'continental' | 'regional' | 'local'

export const INITIAL_MAP_CAMERA: MapCamera = { x: 145, y: 25, width: 770, height: 530 }
export const MAP_ZOOM_LIMITS = { minimum: 0.72, maximum: 4 } as const
export const AURELIA_WORLD_BOUNDS: MapViewBox = [0, 0, 960, 570]

/** Data availability is explicit: the current hand-authored dataset is continental only. */
export const AURELIA_DETAIL_LEVELS = [
  { id: 'global', minZoom: 0.72, maxZoom: 0.9, data: 'pending' },
  { id: 'continental', minZoom: 0.9, maxZoom: 1.8, data: 'available' },
  { id: 'regional', minZoom: 1.8, maxZoom: 3, data: 'pending' },
  { id: 'local', minZoom: 3, maxZoom: 4, data: 'pending' },
] as const satisfies readonly { id: GeographicDetailLevel; minZoom: number; maxZoom: number; data: 'available' | 'pending' }[]

export function getGeographicDetailLevel(zoom: number): GeographicDetailLevel {
  return AURELIA_DETAIL_LEVELS.find(level => zoom >= level.minZoom && zoom < level.maxZoom)?.id ?? 'local'
}

/** Selects an available dataset without pretending that pending finer/coarser data exists. */
export function getGeographicDetailStatus(zoom: number) {
  const requestedLevel = getGeographicDetailLevel(zoom)
  const requested = AURELIA_DETAIL_LEVELS.find(level => level.id === requestedLevel)!
  const available = AURELIA_DETAIL_LEVELS.find(level => level.data === 'available')!
  return {
    requestedLevel,
    requestedData: requested.data,
    displayedLevel: available.id,
  } as const
}

export function cameraToViewBox(camera: MapCamera): string {
  return `${camera.x} ${camera.y} ${camera.width} ${camera.height}`
}

function clampAxis(position: number, size: number, boundsStart: number, boundsSize: number): number {
  if (size >= boundsSize) return Math.max(boundsStart + boundsSize - size, Math.min(boundsStart, position))
  return Math.max(boundsStart, Math.min(boundsStart + boundsSize - size, position))
}

export function clampMapCamera(camera: MapCamera): MapCamera {
  const minWidth = INITIAL_MAP_CAMERA.width / MAP_ZOOM_LIMITS.maximum
  const maxWidth = INITIAL_MAP_CAMERA.width / MAP_ZOOM_LIMITS.minimum
  const width = Math.max(minWidth, Math.min(maxWidth, camera.width))
  const height = width * (INITIAL_MAP_CAMERA.height / INITIAL_MAP_CAMERA.width)
  return {
    x: clampAxis(camera.x, width, AURELIA_WORLD_BOUNDS[0], AURELIA_WORLD_BOUNDS[2]),
    y: clampAxis(camera.y, height, AURELIA_WORLD_BOUNDS[1], AURELIA_WORLD_BOUNDS[3]),
    width,
    height,
  }
}

/** Keeps the geographic point below the pointer fixed during zoom. */
export function zoomMapCameraAt(camera: MapCamera, point: readonly [number, number], factor: number): MapCamera {
  if (!Number.isFinite(factor) || factor <= 0) return camera
  const anchorX = (point[0] - camera.x) / camera.width
  const anchorY = (point[1] - camera.y) / camera.height
  const desiredWidth = camera.width * factor
  const next = clampMapCamera({
    x: point[0] - anchorX * desiredWidth,
    y: point[1] - anchorY * desiredWidth * (camera.height / camera.width),
    width: desiredWidth,
    height: desiredWidth * (camera.height / camera.width),
  })
  return next
}

/** Drag deltas are supplied in map-coordinate units; positive drag moves land with the pointer. */
export function panMapCamera(camera: MapCamera, deltaX: number, deltaY: number): MapCamera {
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return camera
  return clampMapCamera({ ...camera, x: camera.x - deltaX, y: camera.y - deltaY })
}

export function mapZoom(camera: MapCamera): number {
  return INITIAL_MAP_CAMERA.width / camera.width
}

/** Equal map-unit scale for pointer drag across narrow, wide, and tall canvases. */
export function mapUnitsPerPixel(viewportWidth: number, viewportHeight: number, camera: MapCamera): number {
  if (viewportWidth <= 0 || viewportHeight <= 0) return 0
  return Math.min(viewportWidth / camera.width, viewportHeight / camera.height) ** -1
}

export function initialCameraFromViewBox(viewBox: MapViewBox): MapCamera {
  return clampMapCamera({ x: viewBox[0], y: viewBox[1], width: viewBox[2], height: viewBox[3] })
}
