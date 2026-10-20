import aureliaSource from './geography/aurelia-continental.json' with { type: 'json' }
import type { GeographicFeature, GeographicGeometry, PlanetFeature, PlanetFeatureCollection, PlanetPoint } from './geographyTypes'
import { PLANETARY_GEOGRAPHY_BASE } from './geography/planet-global.ts'

export const AURELIA_PLANETARY_EXTENT = { west: -12, east: 66, north: 44, south: -14 } as const

/** Explicit, reversible registration from Aurelia's authored local map units to planetary longitude/latitude. The source JSON is never mutated. */
export function aureliaLocalToPlanet(point: readonly [number, number]): PlanetPoint {
  const [x, y] = point
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 960 || y < 0 || y > 570) throw new RangeError('Aurelia local coordinates must be inside its 960 × 570 authored extent.')
  return [AURELIA_PLANETARY_EXTENT.west + x / 960 * (AURELIA_PLANETARY_EXTENT.east - AURELIA_PLANETARY_EXTENT.west), AURELIA_PLANETARY_EXTENT.north - y / 570 * (AURELIA_PLANETARY_EXTENT.north - AURELIA_PLANETARY_EXTENT.south)]
}

export function aureliaGeometryToPlanet(geometry: GeographicGeometry): PlanetFeature['geometry'] {
  switch (geometry.type) {
    case 'LineString': return { type: 'LineString', coordinates: geometry.coordinates.map(aureliaLocalToPlanet) }
    case 'MultiLineString': return { type: 'MultiLineString', coordinates: geometry.coordinates.map(line => line.map(aureliaLocalToPlanet)) }
    case 'Polygon': return { type: 'Polygon', coordinates: geometry.coordinates.map(ring => ring.map(aureliaLocalToPlanet)) }
    case 'MultiPolygon': return { type: 'MultiPolygon', coordinates: geometry.coordinates.map(polygon => polygon.map(ring => ring.map(aureliaLocalToPlanet))) }
  }
}

function adaptAureliaFeature(feature: GeographicFeature): PlanetFeature | null {
  if (feature.properties.kind !== 'landmass' && feature.properties.kind !== 'island') return null
  return {
    type: 'Feature',
    id: `planet-${feature.id}`,
    properties: {
      kind: feature.properties.kind === 'landmass' ? 'continent' : 'island',
      name: feature.id === 'aurelia-mainland' ? 'Aurelia' : feature.properties.name ?? feature.id,
      source: 'aurelia-adapter',
      ...(feature.id === 'aurelia-mainland' ? { labelPosition: aureliaLocalToPlanet([514, 167]) } : {}),
    },
    geometry: aureliaGeometryToPlanet(feature.geometry),
  }
}

const source = aureliaSource as unknown as { features: readonly GeographicFeature[] }
const aureliaFeatures = source.features.map(adaptAureliaFeature).filter((feature): feature is PlanetFeature => feature !== null)
export const PLANETARY_GEOGRAPHY: PlanetFeatureCollection = {
  ...PLANETARY_GEOGRAPHY_BASE,
  id: 'ninth-state-world-v1',
  features: [...PLANETARY_GEOGRAPHY_BASE.features, ...aureliaFeatures],
}

/** Prevent accidental mutation of the source collection through this adapter surface. */
export function aureliaSourceFeatureCount(): number {
  return source.features.length
}
