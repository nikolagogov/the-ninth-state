/** Canonical map coordinates are projected local map units, not screen pixels. */
export type MapPoint = readonly [x: number, y: number]
/** Planetary coordinates use east-positive longitude and north-positive latitude, in degrees. */
export type PlanetPoint = readonly [longitude: number, latitude: number]
export type MapViewBox = readonly [x: number, y: number, width: number, height: number]
export type WaterLabel = { id: string; name: string; position: MapPoint }
export type CoordinateReference = {
  id: string
  projection: string
  units: string
  origin: string
  bounds: MapViewBox
}

export type PolygonGeometry = { type: 'Polygon'; coordinates: readonly (readonly MapPoint[])[] }
export type MultiPolygonGeometry = { type: 'MultiPolygon'; coordinates: readonly (readonly (readonly MapPoint[])[])[] }
export type LineStringGeometry = { type: 'LineString'; coordinates: readonly MapPoint[] }
export type MultiLineStringGeometry = { type: 'MultiLineString'; coordinates: readonly (readonly MapPoint[])[] }
export type GeographicGeometry = PolygonGeometry | MultiPolygonGeometry | LineStringGeometry | MultiLineStringGeometry

export type GeographicFeatureProperties = {
  kind: string
  detailLevel: 'global' | 'continental' | 'regional' | 'local'
  name?: string
  systemId?: string
  basinId?: string
}
export type GeographicFeature = {
  type: 'Feature'
  id: string
  properties: GeographicFeatureProperties
  geometry: GeographicGeometry
}
export type GeographicFeatureCollection = {
  type: 'GeographicFeatureCollection'
  id: string
  detailLevel: 'global' | 'continental' | 'regional' | 'local'
  coordinateReference: CoordinateReference
  extent: MapViewBox
  features: readonly GeographicFeature[]
}

/** Tiled, regular-grid elevation model; Int16 samples store metres, -32768 means no data. */
export type ElevationTile = {
  type: 'ElevationTile'
  id: string
  detailLevel: 'global' | 'continental' | 'regional' | 'local'
  coordinateReferenceId: string
  origin: MapPoint
  cellSize: MapPoint
  width: number
  height: number
  noData: -32768
  seaLevelMetres: number
  units: 'metres'
  values: Int16Array
}

/** Morphology and terrain metrics are parallel to, but independent from, DEM height samples. */
export type TerrainMorphologyTile = {
  type: 'TerrainMorphologyTile'
  id: string
  detailLevel: ElevationTile['detailLevel']
  coordinateReferenceId: string
  origin: MapPoint
  cellSize: MapPoint
  width: number
  height: number
  noData: 255
  classes: Uint8Array
  slopeDegrees: Float32Array
  localReliefMetres: Float32Array
  coastDistance: Float32Array
  riverDistance: Float32Array
}

/** Future vector collections reference features by stable IDs across LOD packages. */
export type GeographicDatasetDescriptor = {
  id: string
  detailLevel: GeographicFeatureCollection['detailLevel']
  coordinateReferenceId: string
  status: 'available' | 'pending'
  source?: string
  parentDatasetId?: string
}

export type PlanetCoordinateReference = {
  id: string
  datum: 'fictional-sphere'
  radiusKm: number
  angularUnit: 'degrees'
  longitudeRange: readonly [-180, 180]
  latitudeRange: readonly [-90, 90]
}

export type PlanetGeometry =
  | { type: 'Point'; coordinates: PlanetPoint }
  | { type: 'Polygon'; coordinates: readonly (readonly PlanetPoint[])[] }
  | { type: 'MultiPolygon'; coordinates: readonly (readonly (readonly PlanetPoint[])[])[] }
  | { type: 'LineString'; coordinates: readonly PlanetPoint[] }
  | { type: 'MultiLineString'; coordinates: readonly (readonly PlanetPoint[])[] }

export type PlanetFeature = {
  type: 'Feature'
  id: string
  properties: { kind: 'continent' | 'island' | 'ocean' | 'sea' | 'strait'; name: string; labelPosition?: PlanetPoint; source: 'authored' | 'aurelia-adapter' }
  geometry: PlanetGeometry
}

export type PlanetFeatureCollection = {
  type: 'PlanetFeatureCollection'
  id: string
  coordinateReference: PlanetCoordinateReference
  features: readonly PlanetFeature[]
}
