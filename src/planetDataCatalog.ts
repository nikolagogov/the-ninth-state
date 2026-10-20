
export type PlanetaryLayerId = 'global-coastlines' | 'tectonics' | 'elevation' | 'hydrology' | 'climate' | 'biomes' | 'settlements' | 'political'
export type PlanetaryLayerStatus = 'available' | 'partial' | 'pending'
export type PlanetaryLayerDescriptor = {
  id: PlanetaryLayerId
  label: string
  status: PlanetaryLayerStatus
  coverage: string
  detailLevel: 'global' | 'continental' | 'regional' | 'local' | 'none'
  source: 'authored' | 'generated' | 'not-built'
  description: string
}

/**
 * Truthful inventory of data packages. The global coastline set is authored;
 * Aurelia's independent local elevation and river data are not planetary tiles.
 */
export const PLANETARY_LAYER_CATALOG: readonly PlanetaryLayerDescriptor[] = [
  { id: 'global-coastlines', label: 'Global coastlines', status: 'available', coverage: 'Eight continent outlines and authored island/marine features', detailLevel: 'global', source: 'authored', description: 'Provisional global outline; only Aurelia currently has a detailed independent source map.' },
  { id: 'tectonics', label: 'Tectonic plates', status: 'pending', coverage: 'None', detailLevel: 'none', source: 'not-built', description: 'No plate polygons, boundaries, or causal terrain links are authored yet.' },
  { id: 'elevation', label: 'Elevation', status: 'partial', coverage: 'Global 1° grid; continental and finer tiles pending', detailLevel: 'global', source: 'generated', description: 'Global base DEM is deterministic and synthetic; Aurelia retains its separate local DEM. No higher-resolution planetary DEM is available.' },
  { id: 'hydrology', label: 'Hydrology', status: 'partial', coverage: 'Aurelia local rivers and lakes only', detailLevel: 'local', source: 'authored', description: 'Aurelia vectors remain in their source coordinate system; global basin topology is not available.' },
  { id: 'climate', label: 'Climate', status: 'pending', coverage: 'None', detailLevel: 'none', source: 'not-built', description: 'No climate fields or climate-derived effects are present.' },
  { id: 'biomes', label: 'Biomes', status: 'pending', coverage: 'None', detailLevel: 'none', source: 'not-built', description: 'No biome or vegetation layer is present.' },
  { id: 'settlements', label: 'Settlements', status: 'partial', coverage: 'Existing Aurelia city metadata only', detailLevel: 'local', source: 'authored', description: 'City metadata remains separate and is not used to shape physical geography.' },
  { id: 'political', label: 'Political geography', status: 'partial', coverage: 'Existing eight Aurelia territories only', detailLevel: 'local', source: 'authored', description: 'Current Velis and neighboring state data remain a separate game layer.' },
]

export function getPlanetaryLayer(id: PlanetaryLayerId): PlanetaryLayerDescriptor {
  const layer = PLANETARY_LAYER_CATALOG.find(candidate => candidate.id === id)
  if (!layer) throw new RangeError(`Unknown planetary layer: ${id}`)
  return layer
}

