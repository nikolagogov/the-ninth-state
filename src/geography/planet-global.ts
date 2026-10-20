import type { PlanetCoordinateReference, PlanetFeature, PlanetFeatureCollection, PlanetPoint } from '../geographyTypes'

export const PLANET_COORDINATES: PlanetCoordinateReference = {
  id: 'ninth-state-planetographic-v1',
  datum: 'fictional-sphere',
  radiusKm: 6371,
  angularUnit: 'degrees',
  longitudeRange: [-180, 180],
  latitudeRange: [-90, 90],
}

type Ring = readonly PlanetPoint[]
const land = (id: string, name: string, coast: Ring, labelPosition: PlanetPoint, innerRings: readonly Ring[] = []): PlanetFeature => ({ type: 'Feature', id, properties: { kind: 'continent', name, source: 'authored', labelPosition }, geometry: { type: 'Polygon', coordinates: [coast, ...innerRings] } })
const island = (id: string, name: string, ring: Ring, labelPosition?: PlanetPoint): PlanetFeature => ({ type: 'Feature', id, properties: { kind: 'island', name, source: 'authored', ...(labelPosition ? { labelPosition } : {}) }, geometry: { type: 'Polygon', coordinates: [ring] } })
const sea = (id: string, name: string, ring: Ring, labelPosition: PlanetPoint): PlanetFeature => ({ type: 'Feature', id, properties: { kind: 'sea', name, source: 'authored', labelPosition }, geometry: { type: 'Polygon', coordinates: [ring] } })
const oceanLabel = (id: string, name: string, position: PlanetPoint): PlanetFeature => ({ type: 'Feature', id, properties: { kind: 'ocean', name, source: 'authored', labelPosition: position }, geometry: { type: 'Point', coordinates: position } })
const strait = (id: string, name: string, coordinates: readonly PlanetPoint[]): PlanetFeature => ({ type: 'Feature', id, properties: { kind: 'strait', name, source: 'authored' }, geometry: { type: 'LineString', coordinates } })

/**
 * Versioned, hand-authored global coast outline. Non-Aurelia outlines are a
 * provisional world composition, not surveyed or procedurally generated data.
 * Relief, plate boundaries, hydrology, climate and biomes are separate layers
 * and are intentionally not implied by these polygons.
 */
export const PLANETARY_BASE_FEATURES: readonly PlanetFeature[] = [
  land('continent-varos', 'Varos', [
    [-166, 48], [-164, 58], [-157, 66], [-149, 69], [-143, 75], [-133, 73], [-127, 69], [-119, 71], [-112, 66], [-104, 67], [-98, 62], [-92, 58], [-90, 52], [-84, 48], [-87, 43], [-94, 40], [-97, 35], [-103, 34], [-108, 29], [-115, 32], [-120, 28], [-126, 34], [-130, 39], [-138, 40], [-143, 45], [-152, 44], [-159, 48], [-166, 48],
  ], [-128, 54], [[[-123, 57], [-119, 60], [-112, 61], [-107, 58], [-108, 54], [-114, 52], [-120, 53], [-123, 57]]]),
  land('continent-veyra', 'Veyra', [
    [86, 54], [91, 62], [100, 67], [108, 66], [112, 72], [123, 74], [130, 69], [139, 70], [148, 65], [158, 63], [164, 56], [159, 50], [163, 45], [155, 41], [152, 35], [145, 32], [141, 25], [134, 27], [130, 34], [124, 37], [120, 43], [113, 42], [108, 47], [101, 45], [97, 50], [91, 49], [86, 54],
  ], [122, 57], [[ [132, 53], [136, 57], [143, 58], [149, 54], [149, 49], [144, 46], [138, 47], [134, 50], [132, 53] ]]),
  land('continent-sere', 'Sere', [
    [-91, -5], [-84, 1], [-78, 3], [-73, 0], [-68, 2], [-63, -3], [-57, -4], [-53, -10], [-48, -13], [-45, -20], [-48, -26], [-46, -31], [-51, -37], [-56, -41], [-59, -48], [-67, -52], [-72, -48], [-76, -42], [-82, -38], [-85, -31], [-90, -27], [-92, -19], [-96, -13], [-94, -8], [-91, -5],
  ], [-70, -27]),
  land('continent-kharad', 'Kharad', [
    [-10, -23], [-6, -18], [1, -19], [5, -24], [11, -22], [16, -27], [22, -29], [27, -33], [35, -34], [41, -40], [39, -46], [33, -49], [28, -54], [20, -55], [14, -51], [8, -50], [3, -45], [-2, -43], [-5, -37], [-11, -34], [-14, -28], [-10, -23],
  ], [14, -38]),
  land('continent-orthea', 'Orthea', [
    [-160, -20], [-152, -15], [-145, -17], [-140, -22], [-133, -20], [-127, -24], [-120, -26], [-115, -32], [-110, -36], [-112, -42], [-116, -47], [-119, -55], [-127, -59], [-136, -57], [-141, -52], [-148, -51], [-154, -46], [-160, -43], [-165, -36], [-163, -29], [-168, -25], [-160, -20],
  ], [-140, -37]),
  land('continent-talyra', 'Talyra', [
    [59, -20], [65, -16], [72, -18], [77, -23], [84, -22], [89, -26], [96, -25], [102, -29], [110, -32], [114, -39], [109, -44], [104, -48], [96, -49], [89, -46], [84, -42], [78, -43], [72, -39], [67, -36], [62, -32], [57, -28], [59, -20],
  ], [101, -38], [[[79, -28], [83, -26], [88, -27], [91, -30], [89, -34], [85, -35], [81, -33], [79, -28]]]),
  land('continent-namar', 'Namar', [
    [119, -8], [126, -5], [132, -8], [138, -12], [146, -11], [151, -15], [160, -14], [168, -18], [175, -23], [177, -29], [173, -34], [166, -38], [158, -40], [151, -37], [145, -39], [138, -35], [132, -33], [128, -28], [123, -26], [120, -20], [116, -16], [117, -11], [119, -8],
  ], [146, -25]),

  // Existing stable Aurelia-adjacent island IDs and authored island chains.
  island('island-ashen-arc', 'Ashen Arc', [[-43, 8], [-39, 12], [-34, 10], [-31, 5], [-34, 0], [-39, 1], [-43, 8]], [-37, 7]),
  island('island-ashen-arc-east', 'Ashen Arc', [[-27, -2], [-24, 1], [-21, -2], [-22, -7], [-26, -8], [-27, -2]]),
  island('island-veyra-north', 'North Veyra Isles', [[69, 68], [75, 72], [82, 69], [83, 63], [78, 59], [72, 61], [69, 68]], [76, 66]),
  island('island-veyra-east', 'Jade Isles', [[168, 17], [174, 22], [179, 18], [177, 11], [171, 9], [168, 17]], [174, 16]),
  island('island-sere-south', 'Sere South Isles', [[-32, -53], [-27, -50], [-23, -54], [-25, -60], [-31, -61], [-32, -53]], [-28, -56]),
  island('island-kharad-west', 'Kharad Shelf Islands', [[-21, -4], [-17, -1], [-14, -4], [-15, -9], [-20, -10], [-21, -4]], [-18, -6]),
  island('island-orthea-sere-chain', 'Southwestern Arc', [[-108, -6], [-104, -3], [-100, -5], [-99, -9], [-103, -11], [-107, -9], [-108, -6]]),
  island('island-talyra-south-chain', 'Talyra Southern Isles', [[69, -54], [74, -51], [78, -54], [77, -59], [72, -61], [69, -54]]),
  island('island-namar-east-chain', 'Namar Outer Isles', [[178, -17], [179, -14], [176, -12], [173, -16], [174, -21], [178, -17]]),

  // Ocean names are point labels; the global ocean is the map background, not fabricated polygons.
  oceanLabel('ocean-western', 'Western Ocean', [-150, 3]),
  oceanLabel('ocean-north-meridian', 'North Meridian Ocean', [-4, 57]),
  oceanLabel('ocean-southern', 'Southern Ocean', [8, -75]),
  oceanLabel('ocean-eastern', 'Eastern Ocean', [67, 2]),
  sea('sea-inner-aurelian', 'Inner Aurelian Sea', [[-2, 25], [4, 32], [15, 33], [23, 29], [26, 23], [20, 18], [10, 18], [2, 21], [-2, 25]], [12, 26]),
  sea('sea-veyra-bight', 'Veyran Bight', [[67, 37], [74, 45], [86, 45], [91, 39], [86, 33], [76, 31], [67, 37]], [79, 39]),
  sea('sea-sere-gulf', 'Gulf of Sere', [[-89, -2], [-82, 4], [-72, 3], [-68, -4], [-75, -10], [-85, -9], [-89, -2]], [-78, -3]),
  sea('sea-veyra-inner', 'Veyran Inner Sea', [[132, 53], [136, 57], [143, 58], [149, 54], [149, 49], [144, 46], [138, 47], [134, 50], [132, 53]], [141, 52]),
  sea('sea-talyra-inner', 'Talyra Inner Sea', [[79, -28], [83, -26], [88, -27], [91, -30], [89, -34], [85, -35], [81, -33], [79, -28]], [85, -30]),
  strait('strait-vesper', 'Vesper Passage', [[-12, 4], [-6, 2], [0, 0], [7, -1]]),
  strait('strait-veyra-east', 'Eastern Veyran Gate', [[149, 53], [151, 54], [153, 55], [156, 55]]),
  strait('strait-talyra-east', 'Talyra Passage', [[91, -30], [93, -29], [95, -28], [98, -27]]),
]

export const PLANETARY_GEOGRAPHY_BASE: PlanetFeatureCollection = {
  type: 'PlanetFeatureCollection',
  id: 'ninth-state-world-outline-v2',
  coordinateReference: PLANET_COORDINATES,
  features: PLANETARY_BASE_FEATURES,
}
