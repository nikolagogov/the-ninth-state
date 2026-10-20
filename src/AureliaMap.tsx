import { useEffect, useRef } from 'react'
import { AURELIA_CITIES, AURELIA_TERRITORIES, type AureliaTerritory } from './mapData'
import { AURELIA_HYDROGRAPHY, AURELIA_ISLANDS, AURELIA_LANDMASSES, AURELIA_MAP_COORDINATES, AURELIA_SEAS, AURELIA_WATER_LABELS } from './physicalGeography'
import { renderElevationPixels, TERRAIN_RENDER_SIZE } from './elevationModel'
import { cameraToViewBox, type MapCamera } from './mapViewport'

type SvgInteractions = {
  camera?: MapCamera
  svgRef?: React.Ref<SVGSVGElement>
  onWheel?: React.WheelEventHandler<SVGSVGElement>
  onPointerDown?: React.PointerEventHandler<SVGSVGElement>
  onPointerMove?: React.PointerEventHandler<SVGSVGElement>
  onPointerUp?: React.PointerEventHandler<SVGSVGElement>
  onPointerCancel?: React.PointerEventHandler<SVGSVGElement>
  onKeyDown?: React.KeyboardEventHandler<SVGSVGElement>
}

type MapMode = 'compact' | 'full'
type Props = {
  selected: string
  onSelect: (id: string) => void
  names: Readonly<Record<string, string>>
  mode: MapMode
  showNames?: boolean
} & SvgInteractions

let cachedElevationRaster: string | null = null

function ElevationRaster() {
  const imageRef = useRef<SVGImageElement>(null)
  useEffect(() => {
    if (cachedElevationRaster) {
      imageRef.current?.setAttribute('href', cachedElevationRaster)
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = TERRAIN_RENDER_SIZE.width
    canvas.height = TERRAIN_RENDER_SIZE.height
    const context = canvas.getContext('2d')
    if (!context) return
    const pixels = context.createImageData(canvas.width, canvas.height)
    pixels.data.set(renderElevationPixels(canvas.width, canvas.height))
    context.putImageData(pixels, 0, 0)
    cachedElevationRaster = canvas.toDataURL('image/png')
    imageRef.current?.setAttribute('href', cachedElevationRaster)
  }, [])
  return <image ref={imageRef} x="0" y="0" width="960" height="570" preserveAspectRatio="none" className="elevation-raster"/>
}

export function AureliaMap({ selected, onSelect, names, mode, showNames = true, camera, svgRef, onWheel, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onKeyDown }: Props) {
  const full = mode === 'full'
  const selectFromKey = (event: React.KeyboardEvent<SVGGElement>, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect(id)
    }
  }

  const mainLandmass = AURELIA_LANDMASSES[0]
  return <svg ref={svgRef} className={`map-svg ${full ? 'map-svg-full' : 'map-svg-compact'}`} viewBox={camera ? cameraToViewBox(camera) : (full ? AURELIA_MAP_COORDINATES.fullViewBox : AURELIA_MAP_COORDINATES.compactViewBox).join(' ')} preserveAspectRatio={full ? 'xMidYMid meet' : 'none'} role={full ? 'img' : 'group'} aria-label={full ? 'Physical relief map of Aurelia' : 'Political map of Aurelia'} aria-describedby={full ? 'map-keyboard-help' : undefined} tabIndex={full ? 0 : undefined} onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onKeyDown={onKeyDown}>
    <defs>
      <radialGradient id="aurelia-sea" cx="48%" cy="48%" r="72%"><stop stopColor="#1d3441"/><stop offset=".55" stopColor="#10232e"/><stop offset="1" stopColor="#09141e"/></radialGradient>
      <linearGradient id="aurelia-land" x1=".08" y1=".08" x2=".85" y2=".95"><stop stopColor="#827f65"/><stop offset=".24" stopColor="#66745c"/><stop offset=".5" stopColor="#49634f"/><stop offset=".76" stopColor="#425c4b"/><stop offset="1" stopColor="#81785c"/></linearGradient>
      <linearGradient id="aurelia-river" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#b3d4ce"/><stop offset=".48" stopColor="#5a9cac"/><stop offset="1" stopColor="#3c748b"/></linearGradient>
      <radialGradient id="aurelia-lake" cx="38%" cy="30%"><stop stopColor="#9fc8c2"/><stop offset=".45" stopColor="#548fa0"/><stop offset="1" stopColor="#315f74"/></radialGradient>
      <pattern id="aurelia-water-texture" width="38" height="38" patternUnits="userSpaceOnUse"><path d="M1 19 Q10 15 19 19 T37 19" fill="none" stroke="#497080" strokeWidth=".7" opacity=".2"/></pattern>
      <pattern id="velis-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#997443"/><path d="M0 0V8" stroke="#e4c67f" strokeWidth="2" opacity=".32"/></pattern>
      <clipPath id="aurelia-land-clip"><path d={mainLandmass.path}/>{AURELIA_ISLANDS.map(island => <path key={island.id} d={island.path}/>)}</clipPath>
      <filter id="aurelia-land-shadow" x="-15%" y="-15%" width="130%" height="140%"><feGaussianBlur in="SourceAlpha" stdDeviation="10" result="blur"/><feOffset dy="6" dx="3"/><feComponentTransfer><feFuncA type="linear" slope=".62"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>

    {AURELIA_SEAS.map(sea => <path key={sea.id} d={sea.path} className="map-sea-surface" aria-hidden="true"/>)}
    <rect width="960" height="570" fill="url(#aurelia-water-texture)"/>
    <g className="sea-depth-lines" aria-hidden="true"><path d="M20 104 C101 87 145 99 207 119 M26 119 C101 102 142 113 198 132 M779 117 C849 98 900 105 951 91 M787 131 C852 115 902 120 955 108 M54 450 C110 423 145 428 194 441 M39 465 C105 438 148 444 201 457 M808 472 C862 448 916 451 958 438"/><path d="M8 87 C92 70 155 81 222 105 M768 98 C846 77 909 83 958 67" className="sea-shelf"/></g>
    <g className="map-landmass" filter="url(#aurelia-land-shadow)">
      <path d={mainLandmass.path} className="continent-coast"/>
      {AURELIA_ISLANDS.map(island => <path key={island.id} d={island.path} className="aurelia-island"/>)}
    </g>
    {full && <g className="physical-relief" clipPath="url(#aurelia-land-clip)" aria-label="Terrain and elevation">
      <ElevationRaster/>
      {AURELIA_HYDROGRAPHY.rivers.map(river => <g key={river.id} className="river-course"><path d={river.path} className="river-bank"/><path d={river.path} className="map-river"/></g>)}
      {AURELIA_HYDROGRAPHY.lakes.map(lake => <path key={lake.id} d={lake.path} className="map-lake"/>)}
    </g>}
    <g className="map-water-labels" aria-label="Seas and waterways">
      {AURELIA_WATER_LABELS.map(label => <text key={label.id} x={label.position[0]} y={label.position[1]} className="map-water-label">{label.name}</text>)}
    </g>

    {!full && <g className="map-layer map-layer-political" data-map-layer="political" clipPath="url(#aurelia-land-clip)">
      {AURELIA_TERRITORIES.map((territory: AureliaTerritory) => {
        const name = territory.home ? 'Republic of Velis' : names[territory.id] ?? territory.id
        const city = AURELIA_CITIES.find(item => item.nationId === territory.id)
        return <g key={territory.id} className={`map-country ${territory.home ? 'home-country' : ''} ${selected === territory.id ? 'selected' : ''}`} onClick={() => onSelect(territory.id)} onKeyDown={event => selectFromKey(event, territory.id)} role="button" tabIndex={0} aria-pressed={selected === territory.id} aria-label={`Select ${name}${full && city ? `, capital ${city.name}` : ''}`}>
          <path d={territory.path} fill={territory.home ? 'url(#velis-hatch)' : territory.color} fillOpacity={full ? (selected === territory.id ? '.48' : '.24') : (selected === territory.id ? '.94' : '.72')} stroke="#26343a" strokeWidth={full ? '2.5' : '2'} className="country-shape"/>
          <path d={territory.path} fill="none" stroke="#d0d5ca" strokeWidth={full ? '1.1' : '1.2'} className="country-border-highlight" pointerEvents="none"/>
          {full && city && <circle cx={city.position[0]} cy={city.position[1]} r="3.8" className="capital-marker" pointerEvents="none"/>}
          {(full || showNames || territory.home) && <text x={territory.label[0]} y={territory.label[1]} className={territory.home ? 'velis-label' : 'country-label'}>{name.toUpperCase()}</text>}
          {full && city && <text x={city.position[0] + 8} y={city.position[1] + 4} className="capital-label">{city.name}</text>}
        </g>
      })}
    </g>}

    {!full && <g className="compass" transform="translate(854 83)" aria-hidden="true"><circle r="21" fill="#172833" stroke="#617780"/><path d="M0-14 L5 0 0 14 -5 0Z" fill="#d9b976"/><text x="0" y="-26">N</text></g>}
  </svg>
}

