import { applyOfflineProgress, initialGame, migrateGameState, type GameState } from './game.ts'

export const LEGACY_SAVE_KEY = 'the-ninth-state-save-v1'
export const CAMPAIGN_INDEX_KEY = 'the-ninth-state-campaign-index-v2'
export const CAMPAIGN_KEY_PREFIX = 'the-ninth-state-campaign-v2:'
export const CAMPAIGN_SCHEMA_VERSION = 1 as const

export type CampaignStatus = 'active' | 'archived'
export type CampaignSnapshot = {
  schemaVersion: typeof CAMPAIGN_SCHEMA_VERSION
  id: string
  name: string
  status: CampaignStatus
  createdAt: string
  savedAt: string
  selectedNationId: string
  gameState: GameState
}

export type CampaignListItem = Omit<CampaignSnapshot, 'gameState'> & {
  gameDate: string
  turn: number
}

type CampaignIndex = {
  schemaVersion: typeof CAMPAIGN_SCHEMA_VERSION
  currentCampaignId: string | null
  campaigns: CampaignListItem[]
}

export interface CampaignStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  key(index: number): string | null
  readonly length: number
}

export class CampaignStorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'CampaignStorageError'
  }
}

function cloneGame(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function makeId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `campaign-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

function listItem(snapshot: CampaignSnapshot): CampaignListItem {
  return {
    schemaVersion: snapshot.schemaVersion,
    id: snapshot.id,
    name: snapshot.name,
    status: snapshot.status,
    createdAt: snapshot.createdAt,
    savedAt: snapshot.savedAt,
    selectedNationId: snapshot.selectedNationId,
    gameDate: snapshot.gameState.date,
    turn: snapshot.gameState.turn,
  }
}

function campaignKey(id: string): string {
  return `${CAMPAIGN_KEY_PREFIX}${id}`
}

function parseSnapshot(raw: string, expectedId?: string): CampaignSnapshot {
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch (error) { throw new CampaignStorageError('Campaign data is not valid JSON.', { cause: error }) }
  if (!isRecord(parsed) || parsed.schemaVersion !== CAMPAIGN_SCHEMA_VERSION || typeof parsed.id !== 'string' || !parsed.id
    || (expectedId !== undefined && parsed.id !== expectedId) || typeof parsed.name !== 'string' || !parsed.name.trim()
    || (parsed.status !== 'active' && parsed.status !== 'archived') || !isIsoDate(parsed.createdAt) || !isIsoDate(parsed.savedAt)
    || typeof parsed.selectedNationId !== 'string' || !parsed.selectedNationId || !isRecord(parsed.gameState)) {
    throw new CampaignStorageError('Campaign snapshot has an unsupported or invalid structure.')
  }
  const gameState = migrateGameState(parsed.gameState)
  if (gameState === initialGame) throw new CampaignStorageError('Campaign game state is invalid; the stored data was left untouched.')
  if (parsed.selectedNationId !== 'velis' && !gameState.nations.some(nation => nation.id === parsed.selectedNationId)) {
    throw new CampaignStorageError('Campaign selection does not match a nation in its game state.')
  }
  return { schemaVersion: CAMPAIGN_SCHEMA_VERSION, id: parsed.id, name: parsed.name.trim(), status: parsed.status, createdAt: parsed.createdAt, savedAt: parsed.savedAt, selectedNationId: parsed.selectedNationId, gameState }
}

function parseIndex(raw: string): CampaignIndex {
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch (error) { throw new CampaignStorageError('Campaign index is not valid JSON.', { cause: error }) }
  if (!isRecord(parsed) || parsed.schemaVersion !== CAMPAIGN_SCHEMA_VERSION || !Array.isArray(parsed.campaigns)
    || !(parsed.currentCampaignId === null || typeof parsed.currentCampaignId === 'string')) {
    throw new CampaignStorageError('Campaign index has an unsupported or invalid structure.')
  }
  const campaigns = parsed.campaigns.filter((item): item is CampaignListItem => isRecord(item)
    && item.schemaVersion === CAMPAIGN_SCHEMA_VERSION && typeof item.id === 'string' && typeof item.name === 'string'
    && (item.status === 'active' || item.status === 'archived') && isIsoDate(item.createdAt) && isIsoDate(item.savedAt)
    && typeof item.selectedNationId === 'string' && typeof item.gameDate === 'string' && Number.isInteger(item.turn))
  if (campaigns.length !== parsed.campaigns.length || new Set(campaigns.map(item => item.id)).size !== campaigns.length) {
    throw new CampaignStorageError('Campaign index contains invalid or duplicate entries.')
  }
  if (parsed.currentCampaignId !== null && !campaigns.some(item => item.id === parsed.currentCampaignId && item.status === 'active')) {
    throw new CampaignStorageError('Campaign index points to a missing or archived current campaign.')
  }
  return { schemaVersion: CAMPAIGN_SCHEMA_VERSION, currentCampaignId: parsed.currentCampaignId, campaigns }
}

/** Local multi-campaign repository. The index stores summaries only; each full snapshot has its own key. */
export class LocalCampaignRepository {
  private readonly storage: CampaignStorage
  private readonly idFactory: () => string

  constructor(storage: CampaignStorage, idFactory: () => string = makeId) {
    this.storage = storage
    this.idFactory = idFactory
  }

  listCampaigns(): CampaignListItem[] {
    return this.readIndex().campaigns.map(item => ({ ...item }))
  }

  createCampaign(name?: string, now = Date.now()): CampaignSnapshot {
    const index = this.readIndex(now)
    const id = this.uniqueId(index)
    const timestamp = new Date(now).toISOString()
    const snapshot: CampaignSnapshot = {
      schemaVersion: CAMPAIGN_SCHEMA_VERSION,
      id,
      name: name?.trim() || `Campaign ${index.campaigns.length + 1}`,
      status: 'active',
      createdAt: timestamp,
      savedAt: timestamp,
      selectedNationId: 'velis',
      gameState: cloneGame(initialGame),
    }
    this.commit(snapshot, { ...index, currentCampaignId: id, campaigns: [...index.campaigns, listItem(snapshot)] })
    return snapshot
  }

  loadCampaign(id: string, now = Date.now()): CampaignSnapshot {
    const index = this.readIndex(now)
    const item = index.campaigns.find(campaign => campaign.id === id)
    if (!item) throw new CampaignStorageError(`Campaign ${id} was not found.`)
    if (item.status !== 'active') throw new CampaignStorageError('Archived campaigns must be restored before continuing.')
    const raw = this.storage.getItem(campaignKey(id))
    if (raw === null) throw new CampaignStorageError(`Campaign ${id} has no stored snapshot.`)
    const stored = parseSnapshot(raw, id)
    if (stored.status !== item.status) throw new CampaignStorageError('Campaign index and snapshot status do not match; the stored data was left untouched.')
    const caughtUp = applyOfflineProgress(stored.gameState, now)
    const snapshot: CampaignSnapshot = { ...stored, savedAt: new Date(now).toISOString(), gameState: caughtUp }
    this.commit(snapshot, { ...index, currentCampaignId: id, campaigns: index.campaigns.map(entry => entry.id === id ? listItem(snapshot) : entry) })
    return snapshot
  }

  loadCurrentCampaign(now = Date.now()): CampaignSnapshot {
    const index = this.readIndex(now)
    if (index.currentCampaignId) return this.loadCampaign(index.currentCampaignId, now)
    const next = index.campaigns.find(item => item.status === 'active')
    if (next) return this.loadCampaign(next.id, now)
    return this.createCampaign(undefined, now)
  }

  saveCampaign(snapshot: CampaignSnapshot, now = Date.now()): CampaignSnapshot {
    const index = this.readIndex(now)
    const item = index.campaigns.find(campaign => campaign.id === snapshot.id)
    if (!item) throw new CampaignStorageError(`Campaign ${snapshot.id} was not found.`)
    if (item.status !== 'active') throw new CampaignStorageError('Archived campaigns cannot be saved until restored.')
    const normalized = parseSnapshot(JSON.stringify({ ...snapshot, savedAt: new Date(now).toISOString(), gameState: { ...snapshot.gameState, clock: { ...snapshot.gameState.clock, lastTimestamp: now } } }), snapshot.id)
    this.commit(normalized, { ...index, currentCampaignId: snapshot.id, campaigns: index.campaigns.map(entry => entry.id === snapshot.id ? listItem(normalized) : entry) })
    return normalized
  }

  archiveCampaign(id: string, now = Date.now()): CampaignListItem {
    return this.setStatus(id, 'archived', now)
  }

  restoreCampaign(id: string, now = Date.now()): CampaignListItem {
    return this.setStatus(id, 'active', now)
  }

  private setStatus(id: string, status: CampaignStatus, now: number): CampaignListItem {
    const index = this.readIndex(now)
    const item = index.campaigns.find(campaign => campaign.id === id)
    if (!item) throw new CampaignStorageError(`Campaign ${id} was not found.`)
    const raw = this.storage.getItem(campaignKey(id))
    if (raw === null) throw new CampaignStorageError(`Campaign ${id} has no stored snapshot.`)
    const snapshot = parseSnapshot(raw, id)
    if (snapshot.status !== item.status) throw new CampaignStorageError('Campaign index and snapshot status do not match; the stored data was left untouched.')
    const updated: CampaignSnapshot = { ...snapshot, status, savedAt: new Date(now).toISOString() }
    const currentCampaignId = status === 'archived' && index.currentCampaignId === id
      ? index.campaigns.find(candidate => candidate.id !== id && candidate.status === 'active')?.id ?? null
      : status === 'active' ? id : index.currentCampaignId
    this.commit(updated, { ...index, currentCampaignId, campaigns: index.campaigns.map(entry => entry.id === id ? listItem(updated) : entry) })
    return listItem(updated)
  }

  private uniqueId(index: CampaignIndex): string {
    let id = this.idFactory()
    while (index.campaigns.some(item => item.id === id) || this.storage.getItem(campaignKey(id)) !== null) id = this.idFactory()
    if (!id || id.includes(':')) throw new CampaignStorageError('Campaign ID generator returned an invalid ID.')
    return id
  }

  private readIndex(now = Date.now()): CampaignIndex {
    const raw = this.storage.getItem(CAMPAIGN_INDEX_KEY)
    if (raw !== null) return parseIndex(raw)
    return this.migrateOrInitialize(now)
  }

  private migrateOrInitialize(now: number): CampaignIndex {
    const legacy = this.storage.getItem(LEGACY_SAVE_KEY)
    if (legacy !== null) {
      let parsed: unknown
      try { parsed = JSON.parse(legacy) } catch (error) { throw new CampaignStorageError('Legacy save is corrupt; it was preserved for recovery.', { cause: error }) }
      const gameState = migrateGameState(parsed)
      if (gameState === initialGame) throw new CampaignStorageError('Legacy save is invalid; it was preserved for recovery.')
      const caughtUp = applyOfflineProgress(gameState, now)
      const timestamp = new Date(now).toISOString()
      const legacySelection = isRecord(parsed) && typeof parsed.selectedNationId === 'string' ? parsed.selectedNationId : 'velis'
      const selectedNationId = legacySelection === 'velis' || caughtUp.nations.some(nation => nation.id === legacySelection) ? legacySelection : 'velis'
      const snapshot: CampaignSnapshot = { schemaVersion: CAMPAIGN_SCHEMA_VERSION, id: this.uniqueId({ schemaVersion: CAMPAIGN_SCHEMA_VERSION, currentCampaignId: null, campaigns: [] }), name: 'Migrated Campaign', status: 'active', createdAt: timestamp, savedAt: timestamp, selectedNationId, gameState: caughtUp }
      const index: CampaignIndex = { schemaVersion: CAMPAIGN_SCHEMA_VERSION, currentCampaignId: snapshot.id, campaigns: [listItem(snapshot)] }
      this.writeSnapshot(snapshot)
      this.writeIndex(index)
      const verified = this.storage.getItem(campaignKey(snapshot.id))
      if (verified === null) throw new CampaignStorageError('Migrated campaign could not be read back; the legacy save was preserved.')
      parseSnapshot(verified, snapshot.id)
      if (!this.storage.getItem(CAMPAIGN_INDEX_KEY)) throw new CampaignStorageError('Migrated campaign index could not be read back; the legacy save was preserved.')
      parseIndex(this.storage.getItem(CAMPAIGN_INDEX_KEY)!)
      const verifiedIndex = parseIndex(this.storage.getItem(CAMPAIGN_INDEX_KEY)!)
      if (verifiedIndex.currentCampaignId !== snapshot.id || !verifiedIndex.campaigns.some(item => item.id === snapshot.id)) {
        throw new CampaignStorageError('Migrated campaign index does not reference the verified snapshot; the legacy save was preserved.')
      }
      this.storage.removeItem(LEGACY_SAVE_KEY)
      return index
    }
    const recovered = this.rebuildIndexFromSnapshots()
    this.writeIndex(recovered)
    return recovered
  }

  private rebuildIndexFromSnapshots(): CampaignIndex {
    const campaigns: CampaignListItem[] = []
    for (let keyIndex = 0; keyIndex < this.storage.length; keyIndex++) {
      const key = this.storage.key(keyIndex)
      if (!key?.startsWith(CAMPAIGN_KEY_PREFIX)) continue
      const id = key.slice(CAMPAIGN_KEY_PREFIX.length)
      const raw = this.storage.getItem(key)
      if (raw === null) continue
      try { campaigns.push(listItem(parseSnapshot(raw, id))) } catch { /* Keep corrupt snapshots untouched; omit them from the usable index. */ }
    }
    campaigns.sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    return { schemaVersion: CAMPAIGN_SCHEMA_VERSION, currentCampaignId: campaigns.find(item => item.status === 'active')?.id ?? null, campaigns }
  }

  private commit(snapshot: CampaignSnapshot, index: CampaignIndex): void {
    const snapshotKey = campaignKey(snapshot.id)
    const previousSnapshot = this.storage.getItem(snapshotKey)
    const previousIndex = this.storage.getItem(CAMPAIGN_INDEX_KEY)
    try {
      this.writeSnapshot(snapshot)
      this.writeIndex(index)
      const readBack = this.storage.getItem(snapshotKey)
      if (readBack === null) throw new CampaignStorageError('Campaign write could not be read back.')
      parseSnapshot(readBack, snapshot.id)
      const indexReadBack = this.storage.getItem(CAMPAIGN_INDEX_KEY)
      if (indexReadBack === null || !parseIndex(indexReadBack).campaigns.some(item => item.id === snapshot.id)) throw new CampaignStorageError('Campaign index write could not be verified.')
    } catch (error) {
      // localStorage has no transactions; best-effort rollback prevents a partial two-key commit.
      try { if (previousSnapshot === null) this.storage.removeItem(snapshotKey); else this.storage.setItem(snapshotKey, previousSnapshot) } catch { /* Preserve the original storage error. */ }
      try { if (previousIndex === null) this.storage.removeItem(CAMPAIGN_INDEX_KEY); else this.storage.setItem(CAMPAIGN_INDEX_KEY, previousIndex) } catch { /* Preserve the original storage error. */ }
      throw error
    }
  }

  private writeSnapshot(snapshot: CampaignSnapshot): void {
    try { this.storage.setItem(campaignKey(snapshot.id), JSON.stringify(snapshot)) } catch (error) { throw new CampaignStorageError('Campaign snapshot could not be written.', { cause: error }) }
  }

  private writeIndex(index: CampaignIndex): void {
    try { this.storage.setItem(CAMPAIGN_INDEX_KEY, JSON.stringify(index)) } catch (error) { throw new CampaignStorageError('Campaign index could not be written.', { cause: error }) }
  }
}

export function createLocalCampaignRepository(storage: CampaignStorage = localStorage): LocalCampaignRepository {
  return new LocalCampaignRepository(storage)
}
