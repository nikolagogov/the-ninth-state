import continentalDataset from './geography/aurelia-continental.json' with { type: 'json' }
import type { GeographicFeature, GeographicFeatureCollection, GeographicGeometry, MapPoint, MapViewBox, WaterLabel } from './geographyTypes'

/** Canonical map and geographic data share this projected local coordinate space. */
export const AURELIA_MAP_COORDINATES = {
  width: 960,
  height: 570,
  compactViewBox: [150, 25, 750, 530] as MapViewBox,
  fullViewBox: [145, 25, 770, 530] as MapViewBox,
} as const

// JSON tuple arrays lose fixed-length information in TypeScript; the source file
// is authored and checked against the collection schema in the geography tests.
export const AURELIA_GEOGRAPHY = continentalDataset as unknown as GeographicFeatureCollection
export const AURELIA_WORLD_REFERENCE = AURELIA_GEOGRAPHY.coordinateReference

const featuresOf = (kind: string): readonly GeographicFeature[] => AURELIA_GEOGRAPHY.features.filter(feature => feature.properties.kind === kind)

function lineToPath(points: readonly MapPoint[], close = false): string {
  if (!points.length) return ''
  const path = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x} ${y}`).join(' ')
  return close ? `${path} Z` : path
}

/** Convert canonical vector coordinates to SVG only at the renderer boundary. */
export function geometryToSvgPath(geometry: GeographicGeometry): string {
  switch (geometry.type) {
    case 'LineString':
      return lineToPath(geometry.coordinates)
    case 'MultiLineString':
      return geometry.coordinates.map(points => lineToPath(points)).join(' ')
    case 'Polygon':
      return geometry.coordinates.map(ring => lineToPath(ring, true)).join(' ')
    case 'MultiPolygon':
      return geometry.coordinates.flatMap(polygon => polygon.map(ring => lineToPath(ring, true))).join(' ')
  }
}

const renderedFeatures = (kind: string) => featuresOf(kind).map(feature => ({
  id: feature.id,
  path: geometryToSvgPath(feature.geometry),
  basinId: feature.properties.basinId,
}))

export const AURELIA_LANDMASSES = featuresOf('landmass').map(feature => ({ ...feature, path: geometryToSvgPath(feature.geometry) }))
export const AURELIA_ISLANDS = featuresOf('island').map(feature => ({ ...feature, path: geometryToSvgPath(feature.geometry) }))
export const AURELIA_SEAS = featuresOf('sea').map(feature => ({ ...feature, path: geometryToSvgPath(feature.geometry) }))

export const AURELIA_HYDROGRAPHY = {
  rivers: renderedFeatures('river'),
  lakes: renderedFeatures('lake'),
} as const

/** Text labels are cartographic annotations, stored outside geographic geometry. */
export const AURELIA_WATER_LABELS: readonly WaterLabel[] = [
  { id: 'aurelian-sea', name: 'THE AURELIAN SEA', position: [180, 74] },
  { id: 'vesper-strait', name: 'VESPER STRAIT', position: [774, 503] },
]

