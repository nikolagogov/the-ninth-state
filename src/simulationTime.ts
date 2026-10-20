/** Existing client simulation cadence. Keep legacy saves and gameplay timing stable. */
export const simulationTimeRules = {
  realMillisecondsPerGameDay: 1_800,
  maximumOfflineProgressMilliseconds: 24 * 60 * 60 * 1_000,
  minimumLegacySpeed: 1,
  maximumLegacySpeed: 3,
} as const

export type ElapsedGameTime = { days: number; remainderMs: number }

export function realMillisecondsPerGameDay(speed: number): number {
  const requestedSpeed = Number.isFinite(speed) ? speed : simulationTimeRules.minimumLegacySpeed
  const safeSpeed = Math.max(simulationTimeRules.minimumLegacySpeed, Math.min(simulationTimeRules.maximumLegacySpeed, requestedSpeed))
  return simulationTimeRules.realMillisecondsPerGameDay / safeSpeed
}

/** Converts wall-clock duration to whole game days and a carry-over remainder. */
export function convertElapsedTime(elapsedMs: number, speed: number, remainderMs = 0): ElapsedGameTime {
  const interval = realMillisecondsPerGameDay(speed)
  const elapsed = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0)
  const carried = Math.max(0, Number.isFinite(remainderMs) ? remainderMs : 0)
  const total = elapsed + carried
  const days = Math.floor(total / interval)
  return { days, remainderMs: Number((total - days * interval).toFixed(3)) }
}
