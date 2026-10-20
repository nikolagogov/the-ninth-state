import { initialGame, type GameState } from './game'
import { createLocalCampaignRepository, type CampaignSnapshot } from './campaignStore'

/** Compatibility adapter for callers that only need the current campaign's game state. */
export function loadGame(now = Date.now()): GameState {
  try { return createLocalCampaignRepository().loadCurrentCampaign(now).gameState }
  catch { return initialGame }
}

/** Compatibility adapter; selected country remains the current campaign's saved selection. */
export function saveGame(state: GameState, now = Date.now()): void {
  try {
    const repository = createLocalCampaignRepository()
    const current = repository.loadCurrentCampaign(now)
    repository.saveCampaign({ ...current, gameState: state }, now)
  } catch {
    // Keep the game usable when browser storage is unavailable, as in the previous adapter.
  }
}

export function loadCurrentCampaign(now = Date.now()): CampaignSnapshot {
  try { return createLocalCampaignRepository().loadCurrentCampaign(now) }
  catch (error) {
    console.error('Local campaign storage is unavailable or invalid; the stored data has been left untouched.', error)
    const timestamp = new Date(now).toISOString()
    return { schemaVersion: 1, id: `unsaved-session-${now}`, name: 'Unsaved Recovery Session', status: 'active', createdAt: timestamp, savedAt: timestamp, selectedNationId: 'velis', gameState: JSON.parse(JSON.stringify(initialGame)) as GameState }
  }
}

export function saveCampaign(snapshot: CampaignSnapshot, now = Date.now()): CampaignSnapshot {
  try { return createLocalCampaignRepository().saveCampaign(snapshot, now) }
  catch (error) {
    console.error('Campaign could not be saved; the previous stored snapshot is preserved.', error)
    return snapshot
  }
}

export { createLocalCampaignRepository } from './campaignStore'
export type { CampaignListItem, CampaignSnapshot, CampaignStatus } from './campaignStore'
