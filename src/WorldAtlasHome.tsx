import { useState } from 'react'
import { createLocalCampaignRepository, type CampaignListItem, type CampaignSnapshot } from './campaignStore'
import type { Nation } from './game'
import { PLANETARY_GEOGRAPHY } from './planetGeography'
import type { PlanetFeature } from './geographyTypes'
import { PlanetaryMapCanvas } from './PlanetaryMap'
import { ACCOUNT_FEATURE_NOTICE, resumeCampaign, startQuickPlay } from './worldAtlas'

type Props = {
  campaign: CampaignSnapshot
  nations: Nation[]
  onSelectNation: (id: string) => void
  onStart: (campaign: CampaignSnapshot) => void
  onContinue: (campaign: CampaignSnapshot) => void
}

export function WorldAtlasHome({ campaign, nations, onSelectNation, onStart, onContinue }: Props) {
  const [selectedFeature, setSelectedFeature] = useState<PlanetFeature | null>(() => PLANETARY_GEOGRAPHY.features.find(feature => feature.id === 'planet-aurelia-mainland') ?? null)
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>(() => { try { return createLocalCampaignRepository().listCampaigns() } catch { return [] } })
  const [campaignsOpen, setCampaignsOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'create' | null>(null)
  const [message, setMessage] = useState('')
  const selectedNation = nations.find(nation => nation.id === campaign.selectedNationId) ?? nations.find(nation => nation.id === 'velis')!
  const repository = () => createLocalCampaignRepository()
  const refreshCampaigns = () => { try { setCampaigns(repository().listCampaigns()) } catch (error) { setMessage(error instanceof Error ? error.message : 'Local campaign storage is unavailable.') } }

  const begin = () => {
    if (campaign.selectedNationId !== 'velis') return
    try { const next = startQuickPlay(repository()); onStart(next); refreshCampaigns() }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Quick Play could not be saved locally.') }
  }
  const resume = (id?: string) => {
    try { onContinue(resumeCampaign(repository(), id)); setCampaignsOpen(false); refreshCampaigns() }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Campaign could not be loaded.') }
  }
  const updateCampaignStatus = (id: string, status: 'active' | 'archived') => {
    try { const store = repository(); if (status === 'archived') store.archiveCampaign(id); else store.restoreCampaign(id); refreshCampaigns() }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Campaign could not be updated.') }
  }
  const selectedInfo = selectedFeature?.properties

  return <main className="atlas-home">
    <header className="atlas-topbar">
      <a className="atlas-brand" href="#world-atlas" aria-label="The Ninth State World Atlas"><span className="atlas-crest">✦</span><span><strong>THE NINTH STATE</strong><small>WORLD ATLAS</small></span></a>
      <div className="atlas-world-status"><i/> FICTIONAL WORLD <b>·</b> GLOBAL OUTLINE</div>
      <div className="atlas-account-actions"><button className="atlas-text-button" onClick={() => setCampaignsOpen(v => !v)}>My Campaigns <span>{campaigns.filter(item => item.status === 'active').length}</span></button><button className="atlas-outline-button" onClick={() => setAuthMode('login')}>Log In</button><button className="atlas-primary-button" onClick={() => setAuthMode('create')}>Create Account</button></div>
    </header>
    <div className="atlas-map-stage" id="world-atlas">
      <PlanetaryMapCanvas selectedId={selectedFeature?.id ?? null} onSelect={setSelectedFeature}/>
      <div className="atlas-map-heading"><span>WORLD ATLAS <b>/</b> OVERVIEW</span><h1>A world in motion.</h1><p>Explore the known outlines of the Ninth State.</p></div>
      <aside className="atlas-inspector">
        <div className="atlas-inspector-kicker">ATLAS INSPECTOR <span>01 / 01</span></div>
        <h2>{selectedInfo?.name ?? 'Select a region'}</h2>
        <p>{selectedFeature ? `${selectedInfo?.kind === 'continent' ? 'Continental landmass' : selectedInfo?.kind === 'island' ? 'Island group' : selectedInfo?.kind} · geographic outline available` : 'Choose a highlighted landmass to inspect.'}</p>
        {selectedFeature?.id === 'planet-aurelia-mainland' ? <>
          <div className="atlas-detail-label">AVAILABLE NATIONAL DATA</div>
          <div className="atlas-country-list">{nations.map(nation => <button key={nation.id} className={campaign.selectedNationId === nation.id ? 'selected' : ''} onClick={() => onSelectNation(nation.id)}><span>{nation.id === 'velis' ? '✦' : nation.symbol}</span><span><strong>{nation.id === 'velis' ? 'Republic of Velis' : nation.name}</strong><small>{nation.id === 'velis' ? 'Playable campaign' : nation.status}</small></span><b>{nation.id === 'velis' ? 'HOME' : `${nation.opinion > 0 ? '+' : ''}${nation.opinion}`}</b></button>)}</div>
          <div className="atlas-selected-nation"><span className="atlas-detail-label">SELECTED COUNTRY</span><strong>{selectedNation.id === 'velis' ? 'Republic of Velis' : selectedNation.name}</strong><span>{selectedNation.relation} relations · {selectedNation.opinion > 0 ? '+' : ''}{selectedNation.opinion}</span></div>
          <button className="atlas-primary-button atlas-play-button" onClick={begin} disabled={campaign.selectedNationId !== 'velis'}>{campaign.selectedNationId === 'velis' ? 'Start Quick Play' : 'Campaign data unavailable'} <span>→</span></button>
          {campaign.selectedNationId !== 'velis' && <small className="atlas-limitation">Only Velis has a complete playable campaign at this stage.</small>}
        </> : <div className="atlas-unavailable"><strong>Outline data only</strong><span>Political and regional data is not available for this area yet.</span></div>}
        <div className="atlas-inspector-foot"><i/> MAP DATA <b>·</b> NO ELEVATION LAYER</div>
      </aside>
      <div className="atlas-map-footer"><span><i className="atlas-key-land"/> Landmass</span><span><i className="atlas-key-water"/> Waterbody</span><span>Drag to pan · Scroll to zoom</span></div>
    </div>
    <div className="atlas-bottom-bar"><div><i/> QUICK PLAY <span>·</span> No account required</div><button onClick={() => campaign.name === 'Unsaved Recovery Session' ? begin() : resume()}>{campaign.name === 'Unsaved Recovery Session' ? 'Start local campaign' : `Continue ${campaign.name}`} <span>→</span></button><small>Campaigns are saved on this device.</small></div>

    {campaignsOpen && <div className="atlas-drawer-backdrop" onClick={() => setCampaignsOpen(false)}><section className="atlas-drawer" aria-label="My Campaigns" onClick={event => event.stopPropagation()}><div className="atlas-drawer-heading"><div><span>LOCAL LIBRARY</span><h2>My Campaigns</h2></div><button onClick={() => setCampaignsOpen(false)} aria-label="Close campaigns">×</button></div><p className="atlas-local-note">Saved on this device · cloud accounts are not connected.</p><button className="atlas-new-campaign" onClick={begin} disabled={campaign.selectedNationId !== 'velis'}>＋ Start new Quick Play</button><div className="atlas-campaign-list">{campaigns.length === 0 ? <p>No saved campaigns yet.</p> : campaigns.map(item => <article key={item.id} className="atlas-campaign-row"><div><strong>{item.name}</strong><span>{item.gameDate} · Turn {item.turn} · {item.status === 'archived' ? 'Archived' : 'Active'}</span></div><div>{item.status === 'active' ? <button onClick={() => resume(item.id)}>Continue</button> : <button onClick={() => updateCampaignStatus(item.id, 'active')}>Restore</button>}<button className="subtle" onClick={() => updateCampaignStatus(item.id, item.status === 'active' ? 'archived' : 'active')}>{item.status === 'active' ? 'Archive' : 'Unarchive'}</button></div></article>)}</div></section></div>}
    {authMode && <div className="atlas-modal-backdrop" onClick={() => setAuthMode(null)}><section className="atlas-auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" onClick={event => event.stopPropagation()}><button className="atlas-modal-close" onClick={() => setAuthMode(null)} aria-label="Close">×</button><div className="atlas-modal-mark">✦</div><span className="atlas-inspector-kicker">PLAYER PROFILE</span><h2 id="auth-title">{authMode === 'create' ? 'Create Account & Continue' : 'Log In'}</h2><p>{ACCOUNT_FEATURE_NOTICE}</p><label>Email address<input type="email" disabled placeholder="name@example.com"/></label><label>Password<input type="password" disabled placeholder="••••••••••"/></label><button className="atlas-primary-button" disabled>{authMode === 'create' ? 'Create account' : 'Log in'}</button><small>Sign-in and cloud campaign transfer will be available in a future release. Nothing has been submitted.</small></section></div>}
    {message && <div className="atlas-toast" role="status">{message}<button onClick={() => setMessage('')} aria-label="Dismiss">×</button></div>}
  </main>
}
