import { convertElapsedTime, simulationTimeRules } from './simulationTime.ts'

export type Nation = { id: string; name: string; status: string; relation: 'Ally' | 'Friendly' | 'Neutral' | 'Tense'; opinion: number; mark: string; symbol: string }
export type GameEvent = { id: number; text: string; when: string; tone: string; icon: string }
export type ScheduledGameEvent = { id: string; date: string; type: string; payload?: unknown }
export type GameClock = { lastTimestamp: number; remainderMs: number }
export type Decision = { id: string; name: string; description: string; effect: string; cost: number; tone: string; icon: string }
export type SpendingCategory = 'administration' | 'infrastructure' | 'healthcare' | 'defense'
export type SpendingPlan = Record<SpendingCategory, number>
export type EconomyState = {
  treasury: number
  gdp: number
  growth: number
  taxBase: number
  taxRate: number
  spending: SpendingPlan
  lastSettledPeriod: string
  lastBudgetShortfall: number
  lastFundedSpending: SpendingPlan
}
export type GameState = {
  date: string; day: number; month: number; year: number; turn: number; paused: boolean; speed: number; clock: GameClock; scheduledEvents: ScheduledGameEvent[]; economy: EconomyState; approval: number; stability: number; decisionsTaken: number; notifications: number; focus: string; nations: Nation[]; events: GameEvent[]; decisions: Decision[]; enactedDecisions: string[]
}

const dateEventHandlers = new Map<string, (state: GameState, event: ScheduledGameEvent) => GameState>()

/** Register a pure state transition for a dated event (for example, a future construction completion). */
export function registerGameDateEventHandler(type: string, handler: (state: GameState, event: ScheduledGameEvent) => GameState): () => void {
  dateEventHandlers.set(type, handler)
  return () => { if (dateEventHandlers.get(type) === handler) dateEventHandlers.delete(type) }
}

export const economyRules = {
  initialTreasury: 24.8,
  initialGdp: 186.4,
  initialGrowth: 2.6,
  initialTaxRate: 12,
  minimumTaxRate: 5,
  maximumTaxRate: 30,
  taxRateStep: 1,
  taxBaseExplanation: 'Tax base is a simplified game value, initially equal to GDP and grown at the same rate.',
  baseSpending: { administration: 0.35, infrastructure: 0.45, healthcare: 0.4, defense: 0.55 } satisfies SpendingPlan,
  spendingMultiplierMin: 0.5,
  spendingMultiplierMax: 1.5,
  spendingStep: 0.05,
  taxGrowthPenaltyPerPoint: 0.04,
  taxApprovalPenaltyPerPoint: 0.05,
  monthlyGrowthChangeLimit: { min: -0.5, max: 0.3 },
  monthlyApprovalChangeLimit: { min: -1, max: 1 },
  monthlyStabilityChangeLimit: { min: -1, max: 1 },
} as const

export type EconomySummary = {
  treasury: number; gdp: number; growth: number; taxBase: number; taxRate: number; monthlyIncome: number; monthlyRecurringExpenses: number; monthlyNetBalance: number; projectedBudgetShortfall: number; lastBudgetShortfall: number; spending: SpendingPlan; lastFundedSpending: SpendingPlan; oneTimeInvestments: number
}

const initialNations: Nation[] = [
  { id: 'nordmark', name: 'Nordmark', status: 'Northern Kingdom', relation: 'Friendly', opinion: 42, mark: 'mark-nord', symbol: '✳' },
  { id: 'caldria', name: 'Caldria', status: 'Trade Federation', relation: 'Ally', opinion: 76, mark: 'mark-cald', symbol: '✦' },
  { id: 'ostara', name: 'Ostara', status: 'Eastern Empire', relation: 'Tense', opinion: -18, mark: 'mark-osta', symbol: '◈' },
  { id: 'meridia', name: 'Meridia', status: 'Coastal Republic', relation: 'Neutral', opinion: 12, mark: 'mark-mer', symbol: '☼' },
  { id: 'thalor', name: 'Thalor', status: 'Mountain Principality', relation: 'Neutral', opinion: 4, mark: 'mark-thal', symbol: '▲' },
  { id: 'lyria', name: 'Lyria', status: 'Riverland Union', relation: 'Friendly', opinion: 31, mark: 'mark-lyr', symbol: '❋' },
  { id: 'vesper', name: 'Vesper', status: 'Southern Isles', relation: 'Neutral', opinion: -3, mark: 'mark-ves', symbol: '☾' },
]
const decisions: Decision[] = [
  { id: 'infrastructure', name: 'Modernize Rail Network', description: 'Connect the industrial heartland to the coast.', effect: '+0.4% growth · +2 stability', cost: 3.5, tone: 'gold-tone', icon: '⌁' },
  { id: 'reform', name: 'Expand Public Clinics', description: 'Improve access to care across all provinces.', effect: '+6 approval · +2 stability', cost: 2.8, tone: 'green-tone', icon: '✚' },
  { id: 'diplomacy', name: 'Host the Aurelia Summit', description: 'Invite neighboring powers to the capital.', effect: '+12 regional relations', cost: 1.5, tone: 'blue-tone', icon: '◎' },
]
const initialEvents: GameEvent[] = [
  { id: 4, text: 'Caldria proposes a bilateral trade agreement', when: '2 days ago · DIPLOMACY', tone: 'blue-tone', icon: '⇌' },
  { id: 3, text: 'Harvest yields exceed projections in the south', when: '5 days ago · ECONOMY', tone: 'green-tone', icon: '✳' },
  { id: 2, text: 'Border patrols report increased Ostaran activity', when: '8 days ago · INTELLIGENCE', tone: 'rose-tone', icon: '⌖' },
  { id: 1, text: 'Parliament opens the autumn session', when: '12 days ago · DOMESTIC', tone: 'gold-tone', icon: '▤' },
]

function periodKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

function copyPlan(plan: SpendingPlan): SpendingPlan {
  return { administration: plan.administration, infrastructure: plan.infrastructure, healthcare: plan.healthcare, defense: plan.defense }
}

export const initialGame: GameState = {
  date: '14 October, 1924', day: 14, month: 9, year: 1924, turn: 14, paused: true, speed: 1,
  clock: { lastTimestamp: 0, remainderMs: 0 }, scheduledEvents: [],
  economy: {
    treasury: economyRules.initialTreasury, gdp: economyRules.initialGdp, growth: economyRules.initialGrowth,
    taxBase: economyRules.initialGdp, taxRate: economyRules.initialTaxRate,
    spending: copyPlan(economyRules.baseSpending), lastSettledPeriod: '1924-10', lastBudgetShortfall: 0,
    lastFundedSpending: copyPlan(economyRules.baseSpending),
  },
  approval: 64, stability: 78, decisionsTaken: 0, notifications: 3, focus: 'Economic recovery',
  nations: initialNations, events: initialEvents, decisions, enactedDecisions: [],
}

export function getEconomySummary(state: GameState): EconomySummary {
  const { economy } = state
  const monthlyIncome = (economy.taxBase / 12) * (economy.taxRate / 100)
  const monthlyRecurringExpenses = sumPlan(economy.spending)
  const oneTimeInvestments = state.decisions.filter(decision => state.enactedDecisions.includes(decision.id)).reduce((total, decision) => total + decision.cost, 0)
  return {
    treasury: economy.treasury, gdp: economy.gdp, growth: economy.growth, taxBase: economy.taxBase, taxRate: economy.taxRate,
    monthlyIncome: roundMoney(monthlyIncome), monthlyRecurringExpenses: roundMoney(monthlyRecurringExpenses),
    monthlyNetBalance: roundMoney(monthlyIncome - monthlyRecurringExpenses),
    projectedBudgetShortfall: roundMoney(Math.max(0, monthlyRecurringExpenses - (economy.treasury + monthlyIncome))),
    lastBudgetShortfall: economy.lastBudgetShortfall, spending: economy.spending, lastFundedSpending: economy.lastFundedSpending,
    oneTimeInvestments: roundMoney(oneTimeInvestments),
  }
}

function sumPlan(plan: SpendingPlan): number {
  return plan.administration + plan.infrastructure + plan.healthcare + plan.defense
}

function roundMoney(value: number): number {
  return Number(value.toFixed(3))
}

function roundOne(value: number): number {
  return Number(value.toFixed(1))
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function clampDelta(value: number, limits: { min: number; max: number }): number {
  return clamp(value, limits.min, limits.max)
}

export function setTaxRate(state: GameState, requestedRate: number): GameState {
  if (!Number.isFinite(requestedRate)) return state
  const stepped = Math.round(requestedRate / economyRules.taxRateStep) * economyRules.taxRateStep
  const taxRate = clamp(stepped, economyRules.minimumTaxRate, economyRules.maximumTaxRate)
  return taxRate === state.economy.taxRate ? state : { ...state, economy: { ...state.economy, taxRate } }
}

export function setSpending(state: GameState, category: SpendingCategory, requestedAmount: number): GameState {
  if (!Number.isFinite(requestedAmount)) return state
  const { min, max } = getSpendingBounds(category)
  const stepped = Math.round(requestedAmount / economyRules.spendingStep) * economyRules.spendingStep
  const amount = Number(clamp(stepped, min, max).toFixed(2))
  if (amount === state.economy.spending[category]) return state
  return { ...state, economy: { ...state.economy, spending: { ...state.economy.spending, [category]: amount } } }
}

export function getSpendingBounds(category: SpendingCategory): { min: number; max: number } {
  const baseline = economyRules.baseSpending[category]
  const step = economyRules.spendingStep
  return {
    min: Number((Math.ceil((baseline * economyRules.spendingMultiplierMin) / step - 1e-9) * step).toFixed(2)),
    max: Number((Math.floor((baseline * economyRules.spendingMultiplierMax) / step + 1e-9) * step).toFixed(2)),
  }
}

export function advanceDay(state: GameState): GameState {
  const next = advanceGameDays(state, 1)
  return { ...next, clock: { ...next.clock, remainderMs: 0 } }
}

function serialDate(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month, day) / 86_400_000)
}

function parsedEventDate(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const [, y, m, d] = match
  const year = Number(y), month = Number(m) - 1, day = Number(d)
  const serial = serialDate(year, month, day)
  const date = new Date(Date.UTC(year, month, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day ? serial : null
}

function processDateEvents(state: GameState): GameState {
  const today = serialDate(state.year, state.month, state.day)
  const due = state.scheduledEvents
    .map(event => ({ event, serial: parsedEventDate(event.date) }))
    .filter((item): item is { event: ScheduledGameEvent; serial: number } => item.serial === today && dateEventHandlers.has(item.event.type))
  let next = state
  for (const { event } of due) {
    next = { ...next, scheduledEvents: next.scheduledEvents.filter(item => item.id !== event.id) }
    next = dateEventHandlers.get(event.type)?.(next, event) ?? next
  }
  return next
}

/** Advances calendar time in jumps between monthly settlements and dated events. */
export function advanceGameDays(state: GameState, days: number): GameState {
  let remaining = Math.max(0, Math.floor(days))
  let next = processDateEvents(state)
  while (remaining > 0) {
    const currentSerial = serialDate(next.year, next.month, next.day)
    const nextMonthStart = serialDate(next.year, next.month + 1, 1)
    let jump = Math.min(remaining, nextMonthStart - currentSerial)
    for (const event of next.scheduledEvents) {
      if (!dateEventHandlers.has(event.type)) continue
      const serial = parsedEventDate(event.date)
      if (serial !== null && serial > currentSerial) jump = Math.min(jump, serial - currentSerial)
    }
    const date = new Date(Date.UTC(next.year, next.month, next.day + jump))
    const day = date.getUTCDate(), month = date.getUTCMonth(), year = date.getUTCFullYear()
    next = {
      ...next, day, month, year, turn: next.turn + jump,
      date: new Date(year, month, day).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    }
    remaining -= jump
    if (day === 1) {
      const period = periodKey(year, month)
      if (period !== next.economy.lastSettledPeriod) next = settleMonth(next, period)
    }
    next = processDateEvents(next)
  }
  return next
}

/** Applies elapsed wall time on load; paused saves intentionally earn no offline progress. */
export function applyOfflineProgress(state: GameState, now: number): GameState {
  const previous = state.clock?.lastTimestamp ?? 0
  if (!Number.isFinite(now) || now < 0) return state
  if (!Number.isFinite(previous) || previous <= 0) return { ...state, clock: { lastTimestamp: now, remainderMs: 0 } }
  const elapsed = Math.min(simulationTimeRules.maximumOfflineProgressMilliseconds, Math.max(0, now - previous))
  const converted = convertElapsedTime(elapsed, state.speed, state.clock.remainderMs)
  const days = state.paused ? 0 : converted.days
  const remainderMs = state.paused ? 0 : converted.remainderMs
  return { ...advanceGameDays(state, days), clock: { lastTimestamp: now, remainderMs } }
}

function settleMonth(state: GameState, period: string): GameState {
  const summary = getEconomySummary(state)
  const requestedTotal = summary.monthlyRecurringExpenses
  const available = Math.max(0, state.economy.treasury) + summary.monthlyIncome
  const fundedRatio = requestedTotal === 0 ? 1 : Math.min(1, available / requestedTotal)
  const funded = Object.fromEntries((Object.keys(economyRules.baseSpending) as SpendingCategory[]).map(category => [category, Number((Math.floor((state.economy.spending[category] * fundedRatio + Number.EPSILON) * 100) / 100).toFixed(2))])) as SpendingPlan
  const actualPaid = sumPlan(funded)
  const shortfall = roundMoney(Math.max(0, requestedTotal - actualPaid))

  const taxExcess = Math.max(0, state.economy.taxRate - 15)
  const growthDelta = clampDelta(
    ((funded.infrastructure - economyRules.baseSpending.infrastructure) / 0.1) * 0.1 - taxExcess * economyRules.taxGrowthPenaltyPerPoint,
    economyRules.monthlyGrowthChangeLimit,
  )
  const approvalDelta = clampDelta(
    ((funded.healthcare - economyRules.baseSpending.healthcare) / 0.1) * 0.2 - taxExcess * economyRules.taxApprovalPenaltyPerPoint,
    economyRules.monthlyApprovalChangeLimit,
  )
  const stabilityDelta = clampDelta(
    ((funded.administration - economyRules.baseSpending.administration) / 0.1) * 0.1 + ((funded.defense - economyRules.baseSpending.defense) / 0.1) * 0.15,
    economyRules.monthlyStabilityChangeLimit,
  )
  const growth = roundOne(clamp(state.economy.growth + growthDelta, 0, 20))
  const growthFactor = growth / 100 / 12
  const gdp = roundOne(state.economy.gdp * (1 + growthFactor))
  const taxBase = roundOne(state.economy.taxBase * (1 + growthFactor))
  const treasury = roundMoney(Math.max(0, available - actualPaid))

  return {
    ...state,
    economy: { ...state.economy, treasury, gdp, taxBase, growth, lastSettledPeriod: period, lastBudgetShortfall: shortfall, lastFundedSpending: funded },
    approval: roundOne(clamp(state.approval + approvalDelta, 0, 100)),
    stability: roundOne(clamp(state.stability + stabilityDelta, 0, 100)),
  }
}

export function makeDecision(state: GameState, id: string): GameState {
  const decision = state.decisions.find(item => item.id === id)
  if (!decision || state.enactedDecisions.includes(id) || state.economy.treasury < decision.cost) return state
  const updateEvent = (text: string, tone: string, icon: string): GameEvent[] => [{ id: Math.max(0, ...state.events.map(event => event.id)) + 1, text, when: 'Just now · GOVERNMENT', tone, icon }, ...state.events].slice(0, 20)
  const base = { ...state, economy: { ...state.economy, treasury: roundOne(state.economy.treasury - decision.cost) }, decisionsTaken: state.decisionsTaken + 1, notifications: state.notifications + 1, enactedDecisions: [...state.enactedDecisions, id] }
  if (id === 'infrastructure') return { ...base, economy: { ...base.economy, growth: roundOne(base.economy.growth + 0.4) }, stability: Math.min(100, state.stability + 2), events: updateEvent('Rail modernization funding approved by the cabinet', 'gold-tone', '⌁') }
  if (id === 'reform') return { ...base, approval: Math.min(100, state.approval + 6), stability: Math.min(100, state.stability + 2), events: updateEvent('Public clinic expansion passes parliament', 'green-tone', '✚') }
  if (id === 'diplomacy') return { ...base, nations: state.nations.map(n => ({ ...n, opinion: Math.max(-100, Math.min(100, n.opinion + 12)), relation: Math.min(100, n.opinion + 12) >= 60 ? 'Friendly' : n.relation === 'Tense' ? 'Neutral' : n.relation } as Nation)), events: updateEvent('The Aurelia Summit is announced in Velis City', 'blue-tone', '◎') }
  if (id === 'cabinet') return { ...state, focus: state.focus === 'Economic recovery' ? 'National cohesion' : 'Economic recovery', events: updateEvent(`National focus shifts to ${state.focus === 'Economic recovery' ? 'cohesion' : 'economic recovery'}`, 'violet-tone', '▤') }
  if (id === 'intel') return { ...state, notifications: state.notifications + 1, events: updateEvent('Intelligence service submits a regional briefing', 'rose-tone', '⌖') }
  return state
}

function isSpendingPlan(value: unknown): value is SpendingPlan {
  if (!value || typeof value !== 'object') return false
  const plan = value as Record<string, unknown>
  return (Object.keys(economyRules.baseSpending) as SpendingCategory[]).every(category => typeof plan[category] === 'number' && Number.isFinite(plan[category]))
}

function isEconomyState(value: unknown): value is EconomyState {
  if (!value || typeof value !== 'object') return false
  const economy = value as Partial<EconomyState>
  return [economy.treasury, economy.gdp, economy.growth, economy.taxBase, economy.taxRate, economy.lastBudgetShortfall].every(n => typeof n === 'number' && Number.isFinite(n))
    && isSpendingPlan(economy.spending) && isSpendingPlan(economy.lastFundedSpending)
    && typeof economy.lastSettledPeriod === 'string'
}

export function migrateGameState(parsed: unknown): GameState {
  if (!parsed || typeof parsed !== 'object') return initialGame
  const value = parsed as Partial<GameState> & { treasury?: number; gdp?: number; growth?: number; economy?: unknown }
  const validCore = Number.isInteger(value.day) && Number.isInteger(value.month) && Number.isInteger(value.year) && Number.isInteger(value.turn)
    && typeof value.paused === 'boolean' && [1, 2, 3].includes(value.speed ?? 0)
    && [value.approval, value.stability].every(n => typeof n === 'number' && Number.isFinite(n))
    && Array.isArray(value.nations) && value.nations.length === initialNations.length && value.nations.every(n => initialNations.some(base => base.id === n.id) && typeof n.name === 'string' && typeof n.opinion === 'number' && ['Ally', 'Friendly', 'Neutral', 'Tense'].includes(n.relation))
    && Array.isArray(value.events) && value.events.every(e => e && typeof e.text === 'string' && typeof e.when === 'string') && Array.isArray(value.enactedDecisions)
  if (!validCore) return initialGame
  const date = new Date(value.year!, value.month!, value.day!)
  if (date.getFullYear() !== value.year || date.getMonth() !== value.month || date.getDate() !== value.day) return initialGame

  let economy: EconomyState
  if (isEconomyState(value.economy)) {
    economy = {
      ...value.economy,
      treasury: Math.max(0, value.economy.treasury),
      taxRate: clamp(Math.round(value.economy.taxRate), economyRules.minimumTaxRate, economyRules.maximumTaxRate),
      spending: normalizeSpending(value.economy.spending),
      lastFundedSpending: normalizeFundedSpending(value.economy.lastFundedSpending),
      lastBudgetShortfall: Math.max(0, value.economy.lastBudgetShortfall),
    }
  } else {
    const legacyGdp = Number.isFinite(value.gdp) ? value.gdp! : economyRules.initialGdp
    economy = {
      treasury: Math.max(0, Number.isFinite(value.treasury) ? value.treasury! : economyRules.initialTreasury),
      gdp: legacyGdp,
      growth: Number.isFinite(value.growth) ? value.growth! : economyRules.initialGrowth,
      taxBase: legacyGdp,
      taxRate: economyRules.initialTaxRate,
      spending: copyPlan(economyRules.baseSpending),
      lastSettledPeriod: periodKey(value.year!, value.month!),
      lastBudgetShortfall: 0,
      lastFundedSpending: copyPlan(economyRules.baseSpending),
    }
  }
  const enactedDecisions = (value.enactedDecisions as string[]).filter(id => decisions.some(decision => decision.id === id))
  const clockValue = value.clock as Partial<GameClock> | undefined
  const clock: GameClock = clockValue && Number.isFinite(clockValue.lastTimestamp) && Number.isFinite(clockValue.remainderMs)
    ? { lastTimestamp: Math.max(0, clockValue.lastTimestamp!), remainderMs: clamp(clockValue.remainderMs!, 0, simulationTimeRules.realMillisecondsPerGameDay) }
    : { lastTimestamp: 0, remainderMs: 0 }
  const scheduledEvents = Array.isArray(value.scheduledEvents)
    ? value.scheduledEvents.filter((event): event is ScheduledGameEvent => !!event && typeof event.id === 'string' && typeof event.date === 'string' && parsedEventDate(event.date) !== null && typeof event.type === 'string')
    : []
  return {
    ...initialGame, ...value,
    date: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    economy,
    clock,
    scheduledEvents,
    notifications: Math.max(0, Math.floor(value.notifications ?? 0)),
    decisionsTaken: enactedDecisions.length,
    decisions,
    events: (value.events as GameEvent[]).slice(0, 20),
    enactedDecisions,
  }
}

function normalizeSpending(plan: SpendingPlan): SpendingPlan {
  const result = {} as SpendingPlan
  for (const category of Object.keys(economyRules.baseSpending) as SpendingCategory[]) {
    const baseline = economyRules.baseSpending[category]
    const { min, max } = getSpendingBounds(category)
    const amount = Number.isFinite(plan[category]) ? plan[category] : baseline
    const stepped = Math.round(amount / economyRules.spendingStep) * economyRules.spendingStep
    result[category] = Number(clamp(stepped, min, max).toFixed(2))
  }
  return result
}

function normalizeFundedSpending(plan: SpendingPlan): SpendingPlan {
  const result = {} as SpendingPlan
  for (const category of Object.keys(economyRules.baseSpending) as SpendingCategory[]) {
    result[category] = roundMoney(clamp(plan[category], 0, economyRules.baseSpending[category] * economyRules.spendingMultiplierMax))
  }
  return result
}


