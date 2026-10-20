import { useEffect, useRef, useState } from 'react'
import { PLANETARY_CONCEPT_PREVIEW } from './geography/planet-concept-preview'
import { EQUAL_EARTH_VIEW, projectEqualEarth } from './planetProjection'
import { PLANET_TERRAIN, PLANET_TERRAIN_RENDERING, PLANET_TERRAIN_RULES, renderPlanetTerrainPixels, type TerrainRenderMode } from './planetTerrain'
import { PLANET_TERRAIN as PLANET_TERRAIN_BASELINE } from './planetTerrainLegacy'
import { PLANET_HYDROLOGY, renderHydrologyCatchmentPixels } from './planetHydrology'
import type { PlanetFeature, PlanetGeometry } from './geographyTypes'
import './GeographyConceptPreview.css'

type Camera = { x: number; y: number; width: number; height: number }
type PreviewMapMode = 'outline' | TerrainRenderMode | 'hydrology'
const elevationLegendStops = [
  ['−9,000 m', '0%'], ['−5,000', '22.4%'], ['0', '50.4%'], ['2,200', '62.8%'], ['5,000', '78.3%'], ['8,848 m', '100%'],
] as const
const bathymetryLegendStops = [['−9,000 m', '0%'], ['−5,000', '44.4%'], ['−2,000', '77.8%'], ['0 m', '100%']] as const
const slopeLegendStops = [['0°', '0%'], ['14°', '15.6%'], ['28°', '31.1%'], ['55°', '61.1%'], ['90°', '100%']] as const
function TerrainLegend({ mode }: { mode: TerrainRenderMode }) {
  const stops = mode === 'slope' ? slopeLegendStops : mode === 'bathymetry' ? bathymetryLegendStops : elevationLegendStops
  const title = mode === 'slope' ? 'SLOPE FROM DEM GRADIENT' : mode === 'bathymetry' ? 'UNSHADED OCEAN DEPTH' : mode === 'shaded-relief' ? `HEIGHT + ${PLANET_TERRAIN_RENDERING.hillshadeVerticalExaggeration}× DEM-DERIVED SHADE` : 'UNSHADED HEIGHT'
  return <div className={`concept-legend terrain-legend ${mode}`}><div className="terrain-scale"><i/>{stops.map(([label, left]) => <span key={label} style={{ left }}>{label}</span>)}</div><b>{title}</b></div>
}
function pathFor(points: readonly (readonly [number, number])[], close = false) {
  const result = points.map((point, index) => { const [x, y] = projectEqualEarth(point); return `${index ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}` }).join(' ')
  return close ? `${result} Z` : result
}
function geometryPath(geometry: PlanetGeometry) {
  switch (geometry.type) {
    case 'Point': return ''
    case 'LineString': return pathFor(geometry.coordinates)
    case 'MultiLineString': return geometry.coordinates.map(line => pathFor(line)).join(' ')
    case 'Polygon': return geometry.coordinates.map(ring => pathFor(ring, true)).join(' ')
    case 'MultiPolygon': return geometry.coordinates.flatMap(polygon => polygon.map(ring => pathFor(ring, true))).join(' ')
  }
}

export default function GeographyConceptPreview() {
  const [labels, setLabels] = useState(true)
  const [mapMode, setMapMode] = useState<PreviewMapMode>('outline')
  const [terrainSource, setTerrainSource] = useState<'phase1' | 'phase2'>('phase2')
  const [terrainImage, setTerrainImage] = useState<string | null>(null)
  const [hydroLayers, setHydroLayers] = useState({ basins: true, main: true, tributaries: true, lakes: true, deltas: true })
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, width: EQUAL_EARTH_VIEW.width, height: EQUAL_EARTH_VIEW.height })
  const drag = useRef<{ x: number; y: number; camera: Camera; units: number; pointerId: number } | null>(null)
  const moved = useRef(false)
  useEffect(() => {
    if (mapMode === 'outline') return
    const frame = window.requestAnimationFrame(() => {
      const width = 720, height = 360
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) return
      const pixels = mapMode === 'hydrology'
        ? renderHydrologyCatchmentPixels(PLANET_HYDROLOGY, width, height)
        : terrainSource === 'phase1'
        ? renderPlanetTerrainPixels(PLANET_TERRAIN_BASELINE.elevation, width, height, mapMode === 'bathymetry' ? 'bathymetry' : 'elevation')
        : renderPlanetTerrainPixels(PLANET_TERRAIN, width, height, mapMode)
      const image = context.createImageData(width, height)
      image.data.set(pixels)
      context.putImageData(image, 0, 0)
      setTerrainImage(canvas.toDataURL('image/png'))
    })
    return () => window.cancelAnimationFrame(frame)
  }, [mapMode, terrainSource])
  const features = PLANETARY_CONCEPT_PREVIEW.features
  const continents = features.filter(feature => feature.properties.kind === 'continent')
  const islands = features.filter(feature => feature.properties.kind === 'island')
  const seas = features.filter(feature => feature.properties.kind === 'sea')
  const straits = features.filter(feature => feature.properties.kind === 'strait')
  const zoomAt = (x: number, y: number, factor: number) => setCamera(current => {
    const width = Math.max(EQUAL_EARTH_VIEW.width / 4, Math.min(EQUAL_EARTH_VIEW.width, current.width * factor))
    const height = width * EQUAL_EARTH_VIEW.height / EQUAL_EARTH_VIEW.width, ratio = width / current.width
    return { x: Math.max(-100, Math.min(EQUAL_EARTH_VIEW.width - width + 100, x - (x - current.x) * ratio)), y: Math.max(-60, Math.min(EQUAL_EARTH_VIEW.height - height + 60, y - (y - current.y) * ratio)), width, height }
  })
  const onWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault()
    const matrix = event.currentTarget.getScreenCTM()
    const point = matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : new DOMPoint(camera.x + camera.width / 2, camera.y + camera.height / 2)
    zoomAt(point.x, point.y, event.deltaY < 0 ? .84 : 1 / .84)
  }
  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return
    const bounds = event.currentTarget.getBoundingClientRect()
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, camera, units: camera.width / Math.max(1, bounds.width) }
    moved.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    const dx = event.clientX - current.x, dy = event.clientY - current.y
    if (Math.abs(dx) + Math.abs(dy) > 3) moved.current = true
    if (moved.current) setCamera({ ...current.camera, x: Math.max(-100, Math.min(EQUAL_EARTH_VIEW.width - current.camera.width + 100, current.camera.x - dx * current.units)), y: Math.max(-60, Math.min(EQUAL_EARTH_VIEW.height - current.camera.height + 60, current.camera.y - dy * current.units)) })
  }
  const finishPan = (event: React.PointerEvent<SVGSVGElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const onKeyDown = (event: React.KeyboardEvent<SVGSVGElement>) => {
    const step = camera.width * .08
    if (event.key === 'Home') { event.preventDefault(); setCamera({ x: 0, y: 0, width: EQUAL_EARTH_VIEW.width, height: EQUAL_EARTH_VIEW.height }) }
    else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomAt(camera.x + camera.width / 2, camera.y + camera.height / 2, .84) }
    else if (event.key === '-') { event.preventDefault(); zoomAt(camera.x + camera.width / 2, camera.y + camera.height / 2, 1 / .84) }
    else if (event.key.startsWith('Arrow')) { event.preventDefault(); setCamera(current => ({ ...current, x: current.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0), y: current.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0) })) }
  }
  const reset = () => setCamera({ x: 0, y: 0, width: EQUAL_EARTH_VIEW.width, height: EQUAL_EARTH_VIEW.height })
  const label = (feature: PlanetFeature) => {
    const point = feature.properties.labelPosition
    if (!point) return null
    const [x, y] = projectEqualEarth(point)
    return <text key={`label-${feature.id}`} x={x} y={y} className="concept-continent-label">{feature.properties.name.toUpperCase()}</text>
  }

  return <main className="geo-concept-page">
    <header className="geo-concept-header">
      <div className="geo-concept-brand"><span>THE NINTH STATE</span><i>/</i><strong>PLANETARY ATLAS</strong><em>PHASE 4 · GLOBAL HYDROLOGY</em></div>
      <div className="geo-concept-actions">
        <div className="geo-terrain-modes" role="group" aria-label="Physical map diagnostic">
          {([
            ['outline', 'Coastlines'], ['elevation', 'Height'], ['slope', 'Slope'], ['morphology', 'Terrain class'], ['shaded-relief', 'Shaded relief'], ['bathymetry', 'Bathymetry'], ['hydrology', 'Hydrology'],
          ] as const).map(([mode, label]) => <button key={mode} className={mapMode === mode ? 'pressed' : ''} aria-pressed={mapMode === mode} onClick={() => { setMapMode(mode); if (mode === 'slope' || mode === 'morphology' || mode === 'shaded-relief') setTerrainSource('phase2') }}>{label}</button>)}
        </div>
        {mapMode === 'hydrology' && <div className="geo-hydrology-layers" role="group" aria-label="Hydrology layers">{([
          ['basins', 'Catchments'], ['main', 'Main rivers'], ['tributaries', 'Tributaries'], ['lakes', 'Lakes'], ['deltas', 'Deltas'],
        ] as const).map(([layer, label]) => <button key={layer} className={hydroLayers[layer] ? 'pressed' : ''} aria-pressed={hydroLayers[layer]} onClick={() => setHydroLayers(current => ({ ...current, [layer]: !current[layer] }))}>{label}</button>)}</div>}
        <div className="geo-terrain-compare" role="group" aria-label="Terrain generation comparison">
          <button className={terrainSource === 'phase1' ? 'pressed' : ''} aria-pressed={terrainSource === 'phase1'} disabled={!['elevation', 'bathymetry'].includes(mapMode)} onClick={() => setTerrainSource('phase1')}>Baseline</button>
          <button className={terrainSource === 'phase2' ? 'pressed' : ''} aria-pressed={terrainSource === 'phase2'} disabled={!['elevation', 'bathymetry'].includes(mapMode)} onClick={() => setTerrainSource('phase2')}>Reconstructed</button>
        </div>
        <button className={labels ? 'pressed' : ''} aria-pressed={labels} onClick={() => setLabels(value => !value)}>Labels {labels ? 'On' : 'Off'}</button><button onClick={reset}>Reset view <kbd>Home</kbd></button><a href="/">Return to World Atlas</a>
      </div>
    </header>
    <section className="geo-concept-map">
      <svg viewBox={`${camera.x} ${camera.y} ${camera.width} ${camera.height}`} aria-label="Global terrain and hydrology preview: eight continents, DEM diagnostics and drainage networks" role="application" tabIndex={0} onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={finishPan} onPointerCancel={finishPan} onKeyDown={onKeyDown}>
        <defs>
          <radialGradient id="concept-ocean" cx="48%" cy="46%" r="78%"><stop stopColor="#19303a"/><stop offset=".58" stopColor="#0d1c25"/><stop offset="1" stopColor="#081219"/></radialGradient>
          <linearGradient id="concept-land" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#a8a797"/><stop offset=".55" stopColor="#858d88"/><stop offset="1" stopColor="#717e7e"/></linearGradient>
          <filter id="concept-coast-shadow" x="-12%" y="-12%" width="124%" height="124%"><feGaussianBlur in="SourceAlpha" stdDeviation="5"/><feOffset dy="3"/><feComponentTransfer><feFuncA type="linear" slope=".46"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect x={camera.x - 200} y={camera.y - 200} width={camera.width + 400} height={camera.height + 400} fill="url(#concept-ocean)"/>
        {mapMode !== 'outline' && terrainImage && (mapMode !== 'hydrology' || hydroLayers.basins) && <image href={terrainImage} x="0" y="0" width={EQUAL_EARTH_VIEW.width} height={EQUAL_EARTH_VIEW.height} preserveAspectRatio="none" pointerEvents="none" aria-label={mapMode === 'hydrology' ? 'Global catchments derived from DEM v3' : `Global ${mapMode} diagnostic, ${terrainSource === 'phase1' ? 'baseline phase one' : 'phase three reconstruction'}`}/>}
        <g className="concept-graticule" aria-hidden="true">
          {[-60, -30, 0, 30, 60].map(latitude => <path key={`lat-${latitude}`} d={pathFor(Array.from({ length: 73 }, (_, i) => [-180 + i * 5, latitude] as const))}/>) }
          {[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map(longitude => <path key={`lon-${longitude}`} d={pathFor(Array.from({ length: 37 }, (_, i) => [longitude, -90 + i * 5] as const))}/>) }
        </g>
        <g className={`concept-land ${mapMode !== 'outline' ? 'terrain-coast-overlay' : ''}`} filter={mapMode === 'outline' ? 'url(#concept-coast-shadow)' : undefined}>{[...continents, ...islands].map(feature => <path key={feature.id} d={geometryPath(feature.geometry)} fill={mapMode === 'outline' ? 'url(#concept-land)' : 'transparent'} fillRule="evenodd" className={feature.properties.name === 'Aurelia' ? 'concept-aurelia-coast' : ''}><title>{feature.properties.name} · provisional physical outline</title></path>)}</g>
        <g className="concept-inner-waters">{seas.map(feature => <path key={feature.id} d={geometryPath(feature.geometry)} fill="url(#concept-ocean)" stroke="#75909a" strokeWidth="1.4" fillRule="evenodd"><title>{feature.properties.name}</title></path>)}{straits.map(feature => <path key={feature.id} d={geometryPath(feature.geometry)} fill="none" stroke="#17303a" strokeWidth="14" strokeLinecap="round"><title>{feature.properties.name}</title></path>)}</g>
        {mapMode === 'hydrology' && <g className="concept-hydrology" aria-label="DEM-derived global hydrology">
          {hydroLayers.main && PLANET_HYDROLOGY.rivers.filter(river => river.order === 'main').map(river => river.segments.map((segment, index) => <path key={`${river.id}-${index}`} className="hydro-main-river" d={pathFor(segment)}><title>{river.id} · {Math.round(river.maximumAccumulationKm2).toLocaleString()} km² catchment</title></path>))}
          {hydroLayers.tributaries && PLANET_HYDROLOGY.rivers.filter(river => river.order === 'tributary').map(river => river.segments.map((segment, index) => <path key={`${river.id}-${index}`} className="hydro-tributary" d={pathFor(segment)}><title>{river.id}</title></path>))}
          {hydroLayers.lakes && PLANET_HYDROLOGY.lakes.map(lake => { const [x, y] = projectEqualEarth(lake.center); return <ellipse key={lake.id} className="hydro-lake" cx={x} cy={y} rx={Math.max(2.5, Math.min(11, Math.sqrt(lake.areaKm2) / 80))} ry={Math.max(2, Math.min(7, Math.sqrt(lake.areaKm2) / 115))}><title>{lake.id} · {Math.round(lake.areaKm2).toLocaleString()} km² · endorheic basin</title></ellipse> })}
          {hydroLayers.deltas && PLANET_HYDROLOGY.deltas.map(delta => { const [x, y] = projectEqualEarth(delta.position); return <path key={delta.id} className="hydro-delta" d={`M${x} ${y - 4} L${x - 4} ${y + 3} L${x + 4} ${y + 3} Z`}><title>{delta.id} · {Math.round(delta.contributingAreaKm2).toLocaleString()} km² contributing area</title></path> })}
        </g>}
        {labels && <g className="concept-labels">{continents.map(label)}{seas.map(feature => { const position = feature.properties.labelPosition; if (!position) return null; const [x, y] = projectEqualEarth(position); return <text key={`water-${feature.id}`} x={x} y={y} className="concept-water-label">{feature.properties.name.toUpperCase()}</text> })}</g>}
        <g className="concept-map-edge-labels" aria-hidden="true"><text x="800" y="28">NORTH</text><text x="800" y="785">SOUTHERN OCEAN</text></g>
      </svg>
      <div className="geo-concept-title"><span>PHYSICAL GEOGRAPHY · GLOBAL BASE</span><h1>One planet. Eight continents.</h1><p>{mapMode === 'outline' ? 'The authored outline remains unchanged. Switch diagnostic layers to inspect the current terrain reconstruction.' : mapMode === 'hydrology' ? `DEM v3 · 1° flow routing · ${PLANET_HYDROLOGY.basins.length} catchments · ${PLANET_HYDROLOGY.rivers.length} connected river reaches · ${PLANET_HYDROLOGY.diagnostics.runtimeMs.toFixed(0)} ms generation.` : mapMode === 'elevation' ? `${terrainSource === 'phase1' ? 'Baseline v1' : 'Reconstruction v3'} · raw height colors, no hillshade · ${PLANET_TERRAIN_RULES.width} × ${PLANET_TERRAIN_RULES.height} samples.` : mapMode === 'bathymetry' ? `${terrainSource === 'phase1' ? 'Baseline v1' : 'Reconstruction v3'} · ocean depths without hillshade; land muted.` : `Reconstruction v3 · ${mapMode === 'slope' ? 'slope derived from neighboring DEM samples' : mapMode === 'morphology' ? 'classes derived from height, slope, relief and authored regions' : `hillshade derived from DEM gradients · ${PLANET_TERRAIN_RENDERING.hillshadeVerticalExaggeration}× display exaggeration`}.`}</p></div>
      <div className="geo-concept-map-tools"><button aria-label="Zoom in" onClick={() => zoomAt(camera.x + camera.width / 2, camera.y + camera.height / 2, .84)}>+</button><button aria-label="Zoom out" onClick={() => zoomAt(camera.x + camera.width / 2, camera.y + camera.height / 2, 1 / .84)}>−</button><button onClick={reset}>Fit</button></div>
      <div className="geo-concept-scale">EQUAL EARTH <i/> 180° <b>·</b> SPHERICAL VIEW</div>
    </section>
    <footer className="geo-concept-footer">
      {mapMode === 'hydrology' ? <div className="concept-legend hydrology-legend"><span><i className="hydro-basin-key"/> Catchment</span><span><i className="hydro-main-key"/> Main river</span><span><i className="hydro-tributary-key"/> Tributary</span><span><i className="hydro-lake-key"/> Endorheic lake</span><span><i className="hydro-delta-key"/> Delta</span><b>{PLANET_HYDROLOGY.basins.filter(basin => basin.kind === 'endorheic').length} ENDORHEIC BASINS</b></div> : mapMode === 'outline' ? <div className="concept-legend"><span><i/> Continental land</span><span><i className="island-key"/> Islands</span><span><i className="sea-key"/> Inner sea / strait</span><b>GEOGRAPHY UNCHANGED</b></div> : mapMode === 'morphology' ? <div className="concept-legend morphology-legend"><span><i className="morph-shelf"/> Shelf / deep ocean</span><span><i className="morph-plain"/> Plains / coastal plain</span><span><i className="morph-hill"/> Hills / plateau</span><span><i className="morph-mountain"/> Mountains</span><span><i className="morph-volcanic"/> Rift / volcanic</span></div> : <TerrainLegend mode={mapMode}/>}
      <div className="concept-count">{continents.length} CONTINENTS <b>·</b> {islands.length} ISLAND FEATURES <b>·</b> GLOBAL 1° DEM ONLY</div>
      <p>{mapMode === 'hydrology' ? 'DEM-derived global drainage · 1° source grid · depression filling is stored as a separate conditioned surface · no regional river detail is implied.' : 'Phase 1 baseline and Phase 3 terrain reconstruction share the same outlines. Deterministic global 1° DEM · hydrology, climate and biomes are separate layers · zoom, drag, arrow keys, Home to reset.'}</p>
    </footer>
  </main>
}
