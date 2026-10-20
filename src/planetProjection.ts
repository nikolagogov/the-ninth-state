import type { MapPoint, PlanetPoint } from './geographyTypes'

/** Equal Earth world view, expressed as SVG-friendly projected coordinates. */
export const EQUAL_EARTH_VIEW = { width: 1600, height: 800, scale: 270, centerX: 800, centerY: 400 } as const
export const EQUAL_EARTH_CONSTANTS = { A1: 1.340264, A2: -0.081106, A3: 0.000893, A4: 0.003796 } as const

/** Equal Earth is a suitable global overview projection: it is pseudocylindrical, balances area distortion, and is defined at both poles. */
export function projectEqualEarth(point: PlanetPoint): MapPoint {
  const [longitude, latitude] = point
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    throw new RangeError('Planet coordinates must have longitude in [-180, 180] and latitude in [-90, 90].')
  }
  const { A1, A2, A3, A4 } = EQUAL_EARTH_CONSTANTS
  const lambda = longitude * Math.PI / 180
  const phi = latitude * Math.PI / 180
  const theta = Math.asin(Math.sqrt(3) / 2 * Math.sin(phi))
  const theta2 = theta * theta
  const theta6 = theta2 * theta2 * theta2
  const theta8 = theta6 * theta2
  const denominator = 3 * (9 * A4 * theta8 + 7 * A3 * theta6 + 3 * A2 * theta2 + A1)
  const x = 2 * Math.sqrt(3) * lambda * Math.cos(theta) / denominator
  const y = theta * (A1 + A2 * theta2 + A3 * theta6 + A4 * theta8)
  return [EQUAL_EARTH_VIEW.centerX + x * EQUAL_EARTH_VIEW.scale, EQUAL_EARTH_VIEW.centerY - y * EQUAL_EARTH_VIEW.scale]
}
