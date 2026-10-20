import type { LocalCampaignRepository } from './campaignStore.ts'

export const ACCOUNT_FEATURE_NOTICE = 'Accounts and cloud campaign sync are not connected yet. Your campaigns remain on this device.'

/** Starts a fresh local campaign without touching existing campaign snapshots. */
export function startQuickPlay(repository: Pick<LocalCampaignRepository, 'createCampaign'>, now?: number) {
  return repository.createCampaign('Quick Play', now)
}

/** Resolves a campaign from its saved snapshot, not from UI-only state. */
export function resumeCampaign(repository: Pick<LocalCampaignRepository, 'loadCampaign' | 'loadCurrentCampaign'>, id?: string, now?: number) {
  return id ? repository.loadCampaign(id, now) : repository.loadCurrentCampaign(now)
}
