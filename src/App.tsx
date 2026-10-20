import { useEffect, useRef, useState } from 'react'
import { advanceDay, economyRules, getEconomySummary, getSpendingBounds, makeDecision, setSpending, setTaxRate, type GameState, type Nation, type SpendingCategory } from './game'
import { loadCurrentCampaign, saveCampaign, type CampaignSnapshot } from './saveGame'
import { realMillisecondsPerGameDay } from './simulationTime.ts'
import { AureliaMap } from './AureliaMap'
import { PlanetaryMap } from './PlanetaryMap'
import { WorldAtlasHome } from './WorldAtlasHome'
import { AURELIA_MAP_COORDINATES } from './physicalGeography'
import { getGeographicDetailStatus, initialCameraFromViewBox, mapUnitsPerPixel, mapZoom, panMapCamera, zoomMapCameraAt, type MapCamera } from './mapViewport'
import './App.css'

function Icon({ name }: { name: string }) {
  const common = { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const paths: Record<string, React.ReactNode> = {
    treasury: <><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M7 6V4h10v2M3 10h18M10 14h4"/></>,
    gdp: <><path d="M3 19h18M5 16l5-5 4 3 6-8"/><path d="M16 6h4v4"/></>,
    growth: <><path d="M4 17l6-6 4 3 6-8"/><path d="M15 6h5v5"/></>,
    approval: <><path d="M20.8 8.7c0 4.3-8.8 10-8.8 10S3.2 13 3.2 8.7A4.7 4.7 0 0 1 12 6.3a4.7 4.7 0 0 1 8.8 2.4Z"/></>,
    stability: <><path d="M12 3 20 6v5c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6l8-3Z"/><path d="m9 12 2 2 4-4"/></>,
    notifications: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
  }
  return <svg {...common}>{paths[name]}</svg>
}

type View = 'overview' | 'economy' | 'cabinet' | 'diplomacy' | 'intelligence' | 'map' | 'planet'

function App() {
  const [campaign, setCampaign] = useState<CampaignSnapshot>(loadCurrentCampaign)
  const game = campaign.gameState
  const selected = campaign.selectedNationId
  const setGame = (update: GameState | ((state: GameState) => GameState)) => setCampaign(current => ({
    ...current,
    gameState: typeof update === 'function' ? update(current.gameState) : update,
  }))
  const setSelected = (selectedNationId: string) => setCampaign(current => ({ ...current, selectedNationId }))
  const [view, setView] = useState<View>('overview')
  const [mode, setMode] = useState<'atlas' | 'game'>('atlas')
  const [showNames, setShowNames] = useState(true)
  const [showAllEvents, setShowAllEvents] = useState(false)
  const [oldestFirst, setOldestFirst] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  useEffect(() => {
    try { saveCampaign(campaign) }
    catch (error) { console.error('Campaign could not be saved; the previous local snapshot is preserved.', error) }
  }, [campaign])
  useEffect(() => {
    if (game.paused) return
    const firstTickDelay = Math.max(1, realMillisecondsPerGameDay(game.speed) - game.clock.remainderMs)
    const timer = window.setInterval(() => setGame(s => advanceDay(s)), firstTickDelay)
    return () => window.clearInterval(timer)
  }, [game.paused, game.speed, game.clock.remainderMs])
  const act = (id: string) => setGame(s => makeDecision(s, id))
  const nation = game.nations.find(n => n.id === selected) ?? game.nations[0]
  const navigate = (next: View) => setView(next)
  if (mode === 'atlas') return <WorldAtlasHome campaign={campaign} nations={[{ id: 'velis', name: 'Republic of Velis', status: 'Republic', relation: 'Ally', opinion: 100, mark: 'mark-velis', symbol: '✦' }, ...game.nations]} onSelectNation={setSelected} onStart={next => { setCampaign(next); setView('overview'); setMode('game') }} onContinue={next => { setCampaign(next); setView('overview'); setMode('game') }}/>
  return <main className="game-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-crest"><span>✦</span></div><div><div className="brand-name">THE NINTH STATE</div><div className="brand-sub">A GRAND STRATEGY EXPERIENCE</div></div></div>
      <nav className="main-nav" aria-label="Main navigation">{([['overview', '◈', 'Overview'], ['economy', '↗', 'Economy'], ['cabinet', '▤', 'Cabinet'], ['diplomacy', '◎', 'Diplomacy'], ['intelligence', '⌁', 'Intelligence']] as [View, string, string][]).map(([key, icon, label]) => <button key={key} className={`nav-item ${view === key || ((view === 'map' || view === 'planet') && key === 'overview') ? 'active' : ''}`} aria-current={view === key || ((view === 'map' || view === 'planet') && key === 'overview') ? 'page' : undefined} onClick={() => navigate(key)}><span>{icon}</span>{label}</button>)}</nav>
      <div className="top-actions"><button className="atlas-return-button" onClick={() => setMode('atlas')}>World Atlas</button><div className="turn-indicator"><span className={`live-dot ${game.paused ? 'paused-dot' : ''}`}/> {game.paused ? 'SIMULATION PAUSED' : 'SIMULATION LIVE'}</div><button className="icon-button" aria-label="Clear notifications" title="Clear notifications" onClick={() => setGame(s => ({ ...s, notifications: 0 }))}><Icon name="notifications"/>{game.notifications > 0 && <i>{game.notifications}</i>}</button><button className="avatar" aria-label="Open leader profile" aria-expanded={profileOpen} onClick={() => setProfileOpen(v => !v)}>AV</button>{profileOpen && <div className="profile-popover"><strong>President Adrian Voss</strong><span>Republic of Velis</span><small>Campaign leader</small></div>}</div>
    </header>
    <section className="nation-heading"><div><div className="eyebrow"><span className="flag-mini">✦</span> {view === 'planet' ? 'THE NINTH STATE' : 'AURELIA'} <span className="slash">/</span> {view === 'map' ? 'FULL MAP' : view === 'planet' ? 'GLOBAL ATLAS' : view.toUpperCase()}</div><h1>Republic of Velis</h1><p>Steer a young republic through a changing world.</p></div><div className="date-controls"><div className="date-box"><span className="date-icon">▦</span><div><small>CAMPAIGN DATE</small><strong>{game.date}</strong></div></div><div className="sim-controls"><button className={`control-button ${game.paused ? 'selected' : ''}`} onClick={() => setGame(s => ({ ...s, paused: !s.paused }))} aria-label={game.paused ? 'Resume simulation' : 'Pause simulation'}>{game.paused ? '▶' : 'Ⅱ'}</button>{[1, 2, 3].map(speed => <button key={speed} className={`speed-button ${game.speed === speed ? 'selected' : ''}`} onClick={() => setGame(s => ({ ...s, speed }))}>{speed}<span>×</span></button>)}</div></div></section>
    <section className="view-content" key={view}>
      {view === 'overview' && <OverviewView game={game} act={act} selected={selected} setSelected={setSelected} setView={setView} showNames={showNames} setShowNames={setShowNames} showAllEvents={showAllEvents} setShowAllEvents={setShowAllEvents} oldestFirst={oldestFirst} setOldestFirst={setOldestFirst}/>}
      {view === 'map' && <FullMapView setView={setView}/>}
      {view === 'planet' && <PlanetaryMap onBack={() => setView('overview')} onOpenAurelia={() => setView('map')}/>}
      {view === 'economy' && <EconomyView game={game} onTaxRateChange={rate => setGame(state => setTaxRate(state, rate))} onSpendingChange={(category, amount) => setGame(state => setSpending(state, category, amount))}/>}
      {view === 'cabinet' && <CabinetView game={game} act={act}/>}
      {view === 'diplomacy' && <DiplomacyView game={game} selected={selected} setSelected={setSelected}/>}
      {view === 'intelligence' && <IntelligenceView game={game} showAllEvents={showAllEvents} setShowAllEvents={setShowAllEvents} oldestFirst={oldestFirst} setOldestFirst={setOldestFirst}/>}
    </section>
    <footer className="statusbar"><div><span className="live-dot"/> NATIONAL FOCUS: <strong>{game.focus}</strong></div><div>TURN {game.turn.toString().padStart(3, '0')} <span className="status-divider">/</span> VELIS CAMPAIGN</div><div>BUILD 0.1.0 <span className="status-divider">·</span> AURELIA</div></footer>
    {selected !== 'velis' && view !== 'map' && <div className="nation-popover"><button onClick={() => setSelected('velis')} aria-label="Close">×</button><small>FOREIGN NATION</small><strong>{nation.name}</strong><span>{nation.relation} relations <b>{nation.opinion > 0 ? '+' : ''}{nation.opinion}</b></span><em>{nation.status}</em></div>}
  </main>
}

function MetricCards({ game, compact = false }: { game: GameState; compact?: boolean }) {
  const economy = getEconomySummary(game)
  const metrics = [
    { id: 'treasury', label: 'TREASURY', value: `₡${economy.treasury.toFixed(1)}B`, change: `${economy.monthlyNetBalance >= 0 ? '+' : ''}₡${economy.monthlyNetBalance.toFixed(1)}B net / mo`, icon: 'treasury', color: 'gold' },
    { id: 'gdp', label: 'GDP', value: `₡${game.economy.gdp.toFixed(1)}B`, change: 'National output', icon: 'gdp', color: 'blue' },
    { id: 'growth', label: 'GROWTH', value: `${game.economy.growth.toFixed(1)}%`, change: 'Annual rate', icon: 'growth', color: 'green' },
    { id: 'approval', label: 'APPROVAL', value: `${game.approval.toFixed(game.approval % 1 === 0 ? 0 : 1)}%`, change: 'Public sentiment', icon: 'approval', color: 'rose' },
    { id: 'stability', label: 'STABILITY', value: `${game.stability.toFixed(game.stability % 1 === 0 ? 0 : 1)}%`, change: 'Domestic order', icon: 'stability', color: 'violet' },
  ]
  return <section className={`metrics-grid ${compact ? 'compact-metrics' : ''}`}>{metrics.map(m => <article className="metric-card" key={m.id}><div className="metric-top"><span>{m.label}</span><span className={`metric-icon ${m.color}`}><Icon name={m.icon}/></span></div><div className="metric-value">{m.value}</div><div className="metric-change"><span className={`change-dot ${m.color}`}/>{m.change}</div></article>)}</section>
}

function MapPanel({ selected, setSelected, setView, showNames, setShowNames, names }: { selected: string; setSelected: (id: string) => void; setView: (view: View) => void; showNames: boolean; setShowNames: React.Dispatch<React.SetStateAction<boolean>>; names: Readonly<Record<string, string>> }) {
  return <section className="panel map-panel"><div className="panel-heading"><div><div className="panel-title">The Continent of Aurelia</div><div className="panel-subtitle">Political map · Northern hemisphere</div></div><div className="map-panel-actions"><button className="map-open-button" onClick={() => setView('map')}>Open Full Map <span>↗</span></button><button className="more-button" aria-label="Toggle map labels" aria-pressed={showNames} title="Toggle map labels" onClick={() => setShowNames(v => !v)}>Aa</button></div></div><div className="map-wrap"><AureliaMap selected={selected} onSelect={id => { setSelected(id); setView('diplomacy') }} names={names} mode="compact" showNames={showNames}/><div className="map-scale"><span/> 500 km</div></div><div className="map-footer"><div><span className="footer-marker amber"/> Your nation</div><div><span className="footer-marker slate"/> Neighboring states</div><div className="map-hint">Select a nation to inspect relations</div></div></section>
}

function DecisionPanel({ game, act, compact = false }: { game: GameState; act: (id: string) => void; compact?: boolean }) {
  return <section className={`panel decisions-panel ${compact ? 'compact-panel' : ''}`}><div className="panel-heading"><div><div className="panel-title">State Decisions</div><div className="panel-subtitle">Shape the future of Velis</div></div><span className="available-pill">{game.decisionsTaken} ENACTED</span></div><div className="decision-list">{game.decisions.map(d => { const enacted = game.enactedDecisions.includes(d.id); return <article className="decision-card" key={d.id}><div className={`decision-icon ${d.tone}`}>{d.icon}</div><div className="decision-copy"><div className="decision-name">{d.name}</div><div className="decision-desc">{d.description}</div><div className="decision-effect">{d.effect}</div></div><button className="enact-button" onClick={() => act(d.id)} disabled={enacted || game.economy.treasury < d.cost}>{enacted ? 'Enacted' : <>Enact <span>₡{d.cost}B</span></>}</button></article> })}</div><div className="decision-note"><span>✦</span> Decisions take effect immediately and influence the nation over time.</div></section>
}

function DiplomacyPanel({ game, selected, setSelected, full = false }: { game: GameState; selected: string; setSelected: (id: string) => void; full?: boolean }) {
  const nations = game.nations.filter(n => n.id !== 'velis')
  return <section className={`panel diplomacy-panel ${full ? 'full-panel' : ''}`}><div className="panel-heading"><div><div className="panel-title">Diplomatic Relations</div><div className="panel-subtitle">Velis and the neighboring powers</div></div>{!full && <span className="text-button">7 NATIONS</span>}</div><div className="relation-list">{(full ? nations : nations.slice(0, 3)).map(n => <NationRow key={n.id} nation={n} onClick={() => setSelected(n.id)} selected={n.id === selected}/>)}</div>{!full && <div className="relation-footer"><span>7 neighboring states</span><span>Select a nation for details</span></div>}</section>
}

function EventsPanel({ game, showAllEvents, setShowAllEvents, oldestFirst, setOldestFirst, full = false }: { game: GameState; showAllEvents: boolean; setShowAllEvents: React.Dispatch<React.SetStateAction<boolean>>; oldestFirst: boolean; setOldestFirst: React.Dispatch<React.SetStateAction<boolean>>; full?: boolean }) {
  const events = oldestFirst ? [...game.events].reverse() : game.events
  return <section className={`panel events-panel ${full ? 'full-panel' : ''}`}><div className="panel-heading"><div><div className="panel-title">{full ? 'Intelligence & Events' : 'Recent Events'}</div><div className="panel-subtitle">{full ? 'Reports and developments across Aurelia' : 'The latest from across Aurelia'}</div></div><button className="more-button" aria-label="Toggle event order" aria-pressed={oldestFirst} title="Toggle event order" onClick={() => setOldestFirst(v => !v)}>···</button></div><div className="event-list">{events.slice(0, full || showAllEvents ? 20 : 3).map(e => <article className="event-row" key={e.id}><div className={`event-symbol ${e.tone}`}>{e.icon}</div><div className="event-copy"><div>{e.text}</div><small>{e.when}</small></div></article>)}</div>{(full || game.events.length > 3) && <button className="all-events" onClick={() => setShowAllEvents(v => !v)}>{showAllEvents ? 'Show recent events' : 'View event history'} <span>→</span></button>}</section>
}

function OverviewView({ game, act, selected, setSelected, setView, showNames, setShowNames, showAllEvents, setShowAllEvents, oldestFirst, setOldestFirst }: { game: GameState; act: (id: string) => void; selected: string; setSelected: (id: string) => void; setView: (view: View) => void; showNames: boolean; setShowNames: React.Dispatch<React.SetStateAction<boolean>>; showAllEvents: boolean; setShowAllEvents: React.Dispatch<React.SetStateAction<boolean>>; oldestFirst: boolean; setOldestFirst: React.Dispatch<React.SetStateAction<boolean>> }) {
  const names = Object.fromEntries(game.nations.map(n => [n.id, n.name]))
  return <><MetricCards game={game}/><div className="overview-grid"><MapPanel selected={selected} setSelected={setSelected} setView={setView} showNames={showNames} setShowNames={setShowNames} names={names}/><DecisionPanel game={game} act={act} compact/><DiplomacyPanel game={game} selected={selected} setSelected={setSelected}/><EventsPanel game={game} showAllEvents={showAllEvents} setShowAllEvents={setShowAllEvents} oldestFirst={oldestFirst} setOldestFirst={setOldestFirst}/></div></>
}

function FullMapView({ setView }: { setView: (view: View) => void }) {
  const [camera, setCamera] = useState<MapCamera>(() => initialCameraFromViewBox(AURELIA_MAP_COORDINATES.fullViewBox))
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ pointerId: number; clientX: number; clientY: number; startCamera: MapCamera; unitsPerPixel: number } | null>(null)
  const [panning, setPanning] = useState(false)
  const zoomBy = (factor: number) => setCamera(current => zoomMapCameraAt(current, [current.x + current.width / 2, current.y + current.height / 2], factor))
  const handleWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault()
    const matrix = event.currentTarget.getScreenCTM()
    const local = matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : new DOMPoint(camera.x + camera.width / 2, camera.y + camera.height / 2)
    setCamera(current => zoomMapCameraAt(current, [local.x, local.y], event.deltaY < 0 ? 0.82 : 1 / 0.82))
  }
  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    const unitsPerPixel = mapUnitsPerPixel(rect.width, rect.height, camera)
    if (!Number.isFinite(unitsPerPixel) || unitsPerPixel <= 0) return
    drag.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, startCamera: camera, unitsPerPixel }
    event.currentTarget.setPointerCapture(event.pointerId)
    setPanning(true)
  }
  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const activeDrag = drag.current
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return
    const deltaX = (event.clientX - activeDrag.clientX) / activeDrag.unitsPerPixel
    const deltaY = (event.clientY - activeDrag.clientY) / activeDrag.unitsPerPixel
    setCamera(panMapCamera(activeDrag.startCamera, deltaX, deltaY))
  }
  const endPan = (event: React.PointerEvent<SVGSVGElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = null
    setPanning(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const handleMapKeys = (event: React.KeyboardEvent<SVGSVGElement>) => {
    const step = camera.width * 0.08
    if (event.key === 'Home') {
      event.preventDefault()
      setCamera(initialCameraFromViewBox(AURELIA_MAP_COORDINATES.fullViewBox))
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault()
      zoomBy(0.82)
    } else if (event.key === '-') {
      event.preventDefault()
      zoomBy(1 / 0.82)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setCamera(current => panMapCamera(current, -step, 0))
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      setCamera(current => panMapCamera(current, step, 0))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setCamera(current => panMapCamera(current, 0, -step))
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setCamera(current => panMapCamera(current, 0, step))
    }
  }
  const zoom = mapZoom(camera)
  const detailStatus = getGeographicDetailStatus(zoom)
  const detailLevel = detailStatus.requestedLevel
  return <div className="full-map-view">
    <section className="panel full-map-panel">
      <div className="panel-heading full-map-heading"><div><div className="panel-title">Aurelia · Physical Atlas</div><div className="panel-subtitle">Elevation, drainage and coastal waters</div></div><div className="planetary-map-actions"><button className="map-back-button" onClick={() => setView('planet')}>Global Atlas</button><button className="map-back-button" onClick={() => setView('overview')}>← Back to Overview</button></div></div>
      <div className={`full-map-canvas ${panning ? 'is-panning' : ''}`} data-geographic-detail={detailLevel} data-geographic-source={detailStatus.displayedLevel}>
        <AureliaMap selected="velis" onSelect={() => undefined} names={{}} mode="full" camera={camera} svgRef={svgRef} onWheel={handleWheel} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={endPan} onPointerCancel={endPan} onKeyDown={handleMapKeys}/>
        <div className="map-compass" aria-label="North"><span>N</span><i/></div>
        <div className="map-scale"><span/> {Math.round(500 / zoom)} km</div>
        <div className="map-camera-controls" aria-label="Map navigation controls">
          <button onClick={() => zoomBy(0.82)} aria-label="Zoom in" title="Zoom in">+</button>
          <button onClick={() => zoomBy(1 / 0.82)} aria-label="Zoom out" title="Zoom out">−</button>
          <button onClick={() => setCamera(initialCameraFromViewBox(AURELIA_MAP_COORDINATES.fullViewBox))} aria-label="Reset map view" title="Reset view">⌂</button>
          <output aria-live="polite">{zoom.toFixed(1)}×</output>
        </div>
        <div className="map-detail-status" aria-live="polite">{detailStatus.requestedData === 'available' ? `${detailStatus.displayedLevel} data` : `${detailStatus.requestedLevel} data unavailable · showing ${detailStatus.displayedLevel}`}</div>
        <span id="map-keyboard-help" className="visually-hidden">Use the mouse wheel to zoom, drag to pan, plus and minus keys to zoom, arrow keys to pan, and Home to reset the map view.</span>
      </div>
      <div className="full-map-legend physical-map-legend"><span><i className="map-legend-relief"/> Synthetic elevation · 120 × 72 grid</span><span><i className="map-legend-river"/> River systems</span><span><i className="map-legend-water"/> Lakes &amp; coastal waters</span><span className="full-map-hint">Political layers hidden</span></div>
    </section>
  </div>
}

function EconomyView({ game, onTaxRateChange, onSpendingChange }: { game: GameState; onTaxRateChange: (rate: number) => void; onSpendingChange: (category: SpendingCategory, amount: number) => void }) {
  const economy = getEconomySummary(game)
  const spendingNames: Record<SpendingCategory, string> = { administration: 'Administration', infrastructure: 'Infrastructure', healthcare: 'Healthcare', defense: 'Defense' }
  return <div className="economy-view"><MetricCards game={game} compact/><div className="economy-grid">
    <section className="panel economy-panel"><div className="panel-heading"><div><div className="panel-title">Budget Overview</div><div className="panel-subtitle">Taxation and monthly accounts</div></div><span className="available-pill">MONTHLY</span></div><div className="tax-control"><div><label htmlFor="tax-rate">Tax rate</label><strong>{economy.taxRate}%</strong></div><input id="tax-rate" type="range" min={economyRules.minimumTaxRate} max={economyRules.maximumTaxRate} step={economyRules.taxRateStep} value={economy.taxRate} onChange={event => onTaxRateChange(Number(event.target.value))}/><div className="range-limits"><span>{economyRules.minimumTaxRate}%</span><span>{economyRules.maximumTaxRate}%</span></div></div><div className="economy-rows"><div><span>Tax base</span><strong>₡{economy.taxBase.toFixed(1)}B</strong></div><div><span>Monthly tax revenue</span><strong className="economy-positive">₡{economy.monthlyIncome.toFixed(2)}B</strong></div><div><span>Monthly expenses</span><strong>₡{economy.monthlyRecurringExpenses.toFixed(2)}B</strong></div><div><span>Monthly net balance</span><strong className={economy.monthlyNetBalance >= 0 ? 'economy-positive' : 'economy-negative'}>{economy.monthlyNetBalance >= 0 ? '+' : '−'}₡{Math.abs(economy.monthlyNetBalance).toFixed(2)}B</strong></div><div><span>One-time investments</span><strong>₡{economy.oneTimeInvestments.toFixed(1)}B</strong></div></div><p className="economy-note">Tax revenue = tax base ÷ 12 × rate. {economyRules.taxBaseExplanation}</p></section>
    <section className="panel economy-panel spending-panel"><div className="panel-heading"><div><div className="panel-title">Recurring Spending</div><div className="panel-subtitle">Adjust monthly budgets · values in ₡B</div></div></div><div className="spending-controls">{(Object.keys(spendingNames) as SpendingCategory[]).map(category => { const { min, max } = getSpendingBounds(category); return <div className="spending-control" key={category}><div className="spending-label"><label htmlFor={`spend-${category}`}>{spendingNames[category]}</label><strong>₡{economy.spending[category].toFixed(2)}B</strong></div><input id={`spend-${category}`} type="range" min={min} max={max} step={economyRules.spendingStep} value={economy.spending[category]} onChange={event => onSpendingChange(category, Number(event.target.value))}/><div className="spending-paid">Last month funded: ₡{economy.lastFundedSpending[category].toFixed(2)}B</div></div> })}</div><div className={`shortfall-box ${economy.lastBudgetShortfall > 0 || economy.projectedBudgetShortfall > 0 ? 'has-shortfall' : ''}`}><span>{economy.projectedBudgetShortfall > 0 ? 'Projected cash shortfall' : economy.lastBudgetShortfall > 0 ? 'Unfunded at last settlement' : 'No projected shortfall'}</span><strong>₡{(economy.projectedBudgetShortfall > 0 ? economy.projectedBudgetShortfall : economy.lastBudgetShortfall).toFixed(2)}B</strong><small>Unfunded amounts are not paid and do not create debt.</small></div></section>
    <section className="panel economy-panel production-panel"><div className="panel-heading"><div><div className="panel-title">Production & Growth</div><div className="panel-subtitle">National output indicators</div></div><span className="metric-icon blue"><Icon name="gdp"/></span></div><div className="production-total"><strong>₡{economy.gdp.toFixed(1)}B</strong><span>GDP</span></div><div className="production-growth"><span>Annual economic growth</span><strong>{economy.growth.toFixed(1)}%</strong></div><div className="economy-note">Sector output breakdown is not available in this campaign.</div></section>
  </div></div>
}

function CabinetView({ game, act }: { game: GameState; act: (id: string) => void }) {
  return <div className="cabinet-view"><section className="panel focus-panel"><div><div className="panel-title">National Focus</div><div className="panel-subtitle">Current cabinet priority</div></div><div className="focus-current"><span className="focus-star">✦</span><strong>{game.focus}</strong><button className="enact-button" onClick={() => act('cabinet')}>Change focus <span>↗</span></button></div></section><DecisionPanel game={game} act={act}/></div>
}

function DiplomacyView({ game, selected, setSelected }: { game: GameState; selected: string; setSelected: (id: string) => void }) {
  return <div className="diplomacy-view"><DiplomacyPanel game={game} selected={selected} setSelected={setSelected} full/><section className="panel selected-nation-panel"><div className="panel-heading"><div><div className="panel-title">Selected Nation</div><div className="panel-subtitle">Diplomatic intelligence</div></div></div>{selected === 'velis' ? <div className="selected-copy"><strong>Republic of Velis</strong><span>Select a neighboring state to inspect its current standing.</span></div> : <NationDetail nation={game.nations.find(n => n.id === selected) ?? game.nations[0]}/>}</section></div>
}

function NationDetail({ nation }: { nation: Nation }) {
  return <div className="selected-copy"><span className={`nation-mark ${nation.mark}`}>{nation.symbol}</span><strong>{nation.name}</strong><small>{nation.status}</small><div className="selected-relation"><span className={`relation-tag ${nation.relation.toLowerCase()}`}>{nation.relation}</span><b>{nation.opinion > 0 ? '+' : ''}{nation.opinion}</b><span>opinion of Velis</span></div></div>
}

function IntelligenceView({ game, showAllEvents, setShowAllEvents, oldestFirst, setOldestFirst }: { game: GameState; showAllEvents: boolean; setShowAllEvents: React.Dispatch<React.SetStateAction<boolean>>; oldestFirst: boolean; setOldestFirst: React.Dispatch<React.SetStateAction<boolean>> }) {
  const tense = game.nations.filter(n => n.relation === 'Tense').length
  const allies = game.nations.filter(n => n.relation === 'Ally' || n.relation === 'Friendly').length
  return <div className="intelligence-view"><div className="intel-summary"><article className="panel intel-card"><span className="intel-symbol rose-tone">⌖</span><div><small>REGIONAL ALERTS</small><strong>{tense} Tense relation{tense === 1 ? '' : 's'}</strong><span>Based on current diplomatic standing</span></div></article><article className="panel intel-card"><span className="intel-symbol green-tone">◎</span><div><small>DIPLOMATIC NETWORK</small><strong>{allies} Friendly partner{allies === 1 ? '' : 's'}</strong><span>Allies and friendly neighbors</span></div></article><article className="panel intel-card"><span className="intel-symbol blue-tone">▤</span><div><small>CAMPAIGN REPORTS</small><strong>{game.events.length} Recent reports</strong><span>Domestic, economic and foreign updates</span></div></article></div><EventsPanel game={game} showAllEvents={showAllEvents} setShowAllEvents={setShowAllEvents} oldestFirst={oldestFirst} setOldestFirst={setOldestFirst} full/></div>
}

function NationRow({ nation, onClick, selected }: { nation: Nation; onClick: () => void; selected: boolean }) {
  return <button className={`nation-row ${selected ? 'row-selected' : ''}`} onClick={onClick}><span className={`nation-mark ${nation.mark}`}>{nation.symbol}</span><span className="nation-info"><strong>{nation.name}</strong><small>{nation.status}</small></span><span className={`relation-tag ${nation.relation.toLowerCase()}`}>{nation.relation}</span><span className={`opinion ${nation.opinion > 0 ? 'positive' : nation.opinion < 0 ? 'negative' : ''}`}>{nation.opinion > 0 ? '+' : ''}{nation.opinion}</span><span className="row-arrow">›</span></button>
}

export default App
