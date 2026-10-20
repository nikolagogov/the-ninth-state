import { useRef, useState } from 'react'
import { PLANETARY_GEOGRAPHY } from './planetGeography'
import { EQUAL_EARTH_VIEW, projectEqualEarth } from './planetProjection'
import type { PlanetFeature, PlanetGeometry } from './geographyTypes'

function linePath(points: readonly (readonly [number, number])[], close = false): string {
  const path = points.map((point, index) => { const [x, y] = projectEqualEarth(point); return `${index ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}` }).join(' ')
  return close ? `${path} Z` : path
}
function geometryPath(geometry: PlanetGeometry): string {
  switch (geometry.type) {
    case 'Point': return ''
    case 'LineString': return linePath(geometry.coordinates)
    case 'MultiLineString': return geometry.coordinates.map(line => linePath(line)).join(' ')
    case 'Polygon': return geometry.coordinates.map(ring => linePath(ring, true)).join(' ')
    case 'MultiPolygon': return geometry.coordinates.flatMap(polygon => polygon.map(ring => linePath(ring, true))).join(' ')
  }
}
const landColors: Record<string, string> = { Aurelia: '#a98950', Varos: '#687a70', Veyra: '#778174', Sere: '#777867', Kharad: '#8a785f', Orthea: '#777e72', Talyra: '#7c8170', Namar: '#85806f' }
type Camera = { x: number; y: number; width: number; height: number }

export function PlanetaryMapCanvas({ selectedId, onSelect, compact = false }: { selectedId: string | null; onSelect: (feature: PlanetFeature) => void; compact?: boolean }) {
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, width: EQUAL_EARTH_VIEW.width, height: EQUAL_EARTH_VIEW.height })
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ pointerId: number; x: number; y: number; camera: Camera; units: number } | null>(null)
  const moved = useRef(false)
  const land = PLANETARY_GEOGRAPHY.features.filter(feature => feature.properties.kind === 'continent' || feature.properties.kind === 'island')
  const water = PLANETARY_GEOGRAPHY.features.filter(feature => ['ocean', 'sea', 'strait'].includes(feature.properties.kind))
  const zoomAt = (x: number, y: number, factor: number) => setCamera(current => {
    const width = Math.max(EQUAL_EARTH_VIEW.width / 4, Math.min(EQUAL_EARTH_VIEW.width, current.width * factor))
    const height = width * EQUAL_EARTH_VIEW.height / EQUAL_EARTH_VIEW.width, ratio = width / current.width
    return { x: Math.max(-120, Math.min(EQUAL_EARTH_VIEW.width - width + 120, x - (x - current.x) * ratio)), y: Math.max(-80, Math.min(EQUAL_EARTH_VIEW.height - height + 80, y - (y - current.y) * ratio)), width, height }
  })
  const onWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault()
    const matrix = event.currentTarget.getScreenCTM()
    const point = matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : new DOMPoint(camera.x + camera.width / 2, camera.y + camera.height / 2)
    zoomAt(point.x, point.y, event.deltaY < 0 ? .82 : 1 / .82)
  }
  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, camera, units: camera.width / Math.max(1, rect.width) }
    moved.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const active = drag.current
    if (!active || active.pointerId !== event.pointerId) return
    const dx = event.clientX - active.x, dy = event.clientY - active.y
    if (Math.abs(dx) + Math.abs(dy) > 4) moved.current = true
    if (moved.current) setCamera({ ...active.camera, x: Math.max(-120, Math.min(EQUAL_EARTH_VIEW.width - active.camera.width + 120, active.camera.x - dx * active.units)), y: Math.max(-80, Math.min(EQUAL_EARTH_VIEW.height - active.camera.height + 80, active.camera.y - dy * active.units)) })
  }
  const endPointer = (event: React.PointerEvent<SVGSVGElement>) => { if (drag.current?.pointerId === event.pointerId) { drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) } }
  const handleKeys = (event: React.KeyboardEvent<SVGSVGElement>) => {
    const step = camera.width * .08
    if (event.key === 'Home') { event.preventDefault(); setCamera({ x: 0, y: 0, width: EQUAL_EARTH_VIEW.width, height: EQUAL_EARTH_VIEW.height }) }
    else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomAt(camera.x + camera.width / 2, camera.y + camera.height / 2, .82) }
    else if (event.key === '-') { event.preventDefault(); zoomAt(camera.x + camera.width / 2, camera.y + camera.height / 2, 1 / .82) }
    else if (event.key.startsWith('Arrow')) { event.preventDefault(); setCamera(current => ({ ...current, x: Math.max(-120, Math.min(EQUAL_EARTH_VIEW.width - current.width + 120, current.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0))), y: Math.max(-80, Math.min(EQUAL_EARTH_VIEW.height - current.height + 80, current.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0))) })) }
  }
  const select = (event: React.MouseEvent<SVGPathElement> | React.KeyboardEvent<SVGPathElement>, feature: PlanetFeature) => { if (moved.current) { event.preventDefault(); return }; onSelect(feature) }
  return <div className={`planetary-map-canvas ${compact ? 'atlas-map-canvas' : ''}`}>
    <svg ref={svgRef} viewBox={`${camera.x} ${camera.y} ${camera.width} ${camera.height}`} role="application" aria-label="Interactive global atlas. Use the mouse wheel to zoom, drag to pan, plus and minus keys to zoom, and arrow keys to pan." tabIndex={0} onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endPointer} onPointerCancel={endPointer} onKeyDown={handleKeys}>
      <defs><radialGradient id="planet-ocean" cx="50%" cy="48%" r="72%"><stop stopColor="#1c3540"/><stop offset="1" stopColor="#09141e"/></radialGradient></defs>
      <rect x={camera.x - 200} y={camera.y - 200} width={camera.width + 400} height={camera.height + 400} fill="url(#planet-ocean)"/>
      <g className="planet-graticule" aria-hidden="true">{[-60, -30, 0, 30, 60].map(latitude => <path key={`lat-${latitude}`} d={linePath(Array.from({ length: 73 }, (_, index) => [-180 + index * 5, latitude] as const))}/>)}{[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map(longitude => <path key={`lon-${longitude}`} d={linePath(Array.from({ length: 37 }, (_, index) => [longitude, -90 + index * 5] as const))}/>)}</g>
      <g className="planet-land-layer">{land.map(feature => <path key={feature.id} d={geometryPath(feature.geometry)} fill={landColors[feature.properties.name] ?? '#728078'} fillRule="evenodd" className={`planet-continent ${feature.properties.name === 'Aurelia' ? 'aurelia-highlight' : ''} ${selectedId === feature.id ? 'atlas-selected' : ''}`} role="button" tabIndex={0} aria-label={`Inspect ${feature.properties.name}, ${feature.properties.kind}`} aria-pressed={selectedId === feature.id} onClick={event => select(event, feature)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(event, feature) } }}><title>{feature.properties.name} · {feature.properties.kind}</title></path>)}</g>
      <g className="planet-water-layer" aria-hidden="true">{water.filter(feature => feature.properties.kind === 'sea' || feature.properties.kind === 'strait').map(feature => <path key={feature.id} d={geometryPath(feature.geometry)} className={`planet-water-feature ${feature.properties.kind}`} fillRule="evenodd"/>)}</g>
      <g className="planet-water-labels">{water.map(feature => feature.properties.labelPosition && <text key={feature.id} x={projectEqualEarth(feature.properties.labelPosition)[0]} y={projectEqualEarth(feature.properties.labelPosition)[1]}>{feature.properties.name}</text>)}</g>
      {land.filter(feature => feature.properties.kind === 'continent' && feature.properties.labelPosition).map(feature => { const [x, y] = projectEqualEarth(feature.properties.labelPosition!); return <text key={`label-${feature.id}`} x={x} y={y} className={`planet-continent-label ${feature.properties.name === 'Aurelia' ? 'aurelia-label' : ''}`}>{feature.properties.name.toUpperCase()}</text> })}
      <g className="planet-graticule-labels" aria-hidden="true"><text x="800" y="28">NORTH</text><text x="800" y="785">SOUTH</text></g>
    </svg>
    {!compact && <div className="atlas-zoom-controls"><button onClick={() => zoomAt(camera.x + camera.width / 2, camera.y + camera.height / 2, .82)} aria-label="Zoom in">+</button><button onClick={() => zoomAt(camera.x + camera.width / 2, camera.y + camera.height / 2, 1 / .82)} aria-label="Zoom out">−</button><button onClick={() => setCamera({ x: 0, y: 0, width: EQUAL_EARTH_VIEW.width, height: EQUAL_EARTH_VIEW.height })} aria-label="Reset map view">Reset</button></div>}
  </div>
}

export function PlanetaryMap({ onBack, onOpenAurelia }: { onBack: () => void; onOpenAurelia: () => void }) {
  return <div className="full-map-view planetary-map-view"><section className="panel full-map-panel planetary-map-panel">
    <div className="panel-heading full-map-heading"><div><div className="panel-title">The Ninth State · Global Atlas</div><div className="panel-subtitle">Eight authored continent outlines · Equal Earth · provisional world composition</div></div><div className="planetary-map-actions"><button className="map-back-button" onClick={onOpenAurelia}>Open Aurelia</button><button className="map-back-button" onClick={onBack}>Back to Overview</button></div></div>
    <PlanetaryMapCanvas selectedId={null} onSelect={feature => { if (feature.id === 'planet-aurelia-mainland') onOpenAurelia() }}/>
    <div className="full-map-legend planetary-map-legend"><span><i className="planet-legend-land"/> Continents</span><span><i className="planet-legend-aurelia"/> Aurelia · separate local map available</span><span><i className="planet-legend-water"/> Seas &amp; straits</span><span className="full-map-hint">Global DEM, tectonics, hydrology and climate unavailable</span></div>
  </section></div>
}
