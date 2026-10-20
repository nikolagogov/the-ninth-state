import type { MapPoint } from './geographyTypes'

/** Political overlays are independent of the physical geography module. */
export type MapLayerId = 'political'
export const AURELIA_MAP_LAYERS: readonly MapLayerId[] = ['political']

export type AureliaTerritory = {
  id: string
  path: string
  label: MapPoint
  color: string
  home?: boolean
}

/** Existing capital metadata retained separately from both land and borders. */
export type AureliaCity = {
  id: string
  nationId: string
  name: string
  position: MapPoint
  kind: 'capital'
}

// Territory paths remain the existing political data; physical geography does
// not import or derive any shape from this collection.
export const AURELIA_TERRITORIES: readonly AureliaTerritory[] = [
  { id: 'nordmark', path: 'M390 96 C385 145 400 201 408 253 C415 291 420 331 420 370 C350 340 286 300 231 263 L150 120 Z', label: [318, 154], color: '#718a9a' },
  { id: 'caldria', path: 'M390 96 L570 82 C556 130 540 184 520 237 C484 240 445 248 408 253 C400 201 385 145 390 96 Z', label: [477, 145], color: '#a28b70' },
  { id: 'ostara', path: 'M570 82 C620 47 691 51 742 124 C776 165 798 183 820 192 C770 206 708 237 660 270 C614 248 568 232 520 237 C540 184 556 130 570 82 Z', label: [679, 162], color: '#829078' },
  { id: 'meridia', path: 'M820 192 L920 180 L920 460 L806 432 C790 380 732 318 660 270 C708 237 770 206 820 192 Z M861 374 C874 365 889 370 891 381 C887 393 872 396 863 389 Z M873 405 C883 399 895 403 897 412 C892 421 880 423 872 417 Z', label: [790, 291], color: '#9c806e' },
  { id: 'thalor', path: 'M806 432 L800 550 L664 506 C645 466 614 428 590 390 C615 353 643 310 660 270 C732 318 790 380 806 432 Z', label: [718, 421], color: '#718697' },
  { id: 'lyria', path: 'M664 506 L400 449 C435 433 473 411 510 397 C537 400 563 400 590 390 C614 428 645 466 664 506 Z', label: [535, 442], color: '#8c8c6c' },
  { id: 'vesper', path: 'M231 263 C286 300 350 340 420 370 C445 380 475 392 510 397 C473 411 435 433 400 449 L200 500 Z M174 277 C184 267 199 269 203 280 C200 291 187 296 177 290 Z M191 302 C199 296 211 299 214 307 C210 316 198 319 191 313 Z', label: [322, 359], color: '#7e987d' },
  { id: 'velis', path: 'M408 253 C445 248 484 240 520 237 C568 232 614 248 660 270 C643 310 615 353 590 390 C563 400 537 400 510 397 C475 392 445 380 420 370 C420 331 415 291 408 253 Z', label: [500, 356], color: '#c19a55', home: true },
]

export const AURELIA_CITIES: readonly AureliaCity[] = [
  { id: 'nordmark-capital', nationId: 'nordmark', name: 'EIRHOLM', position: [334, 190], kind: 'capital' },
  { id: 'caldria-capital', nationId: 'caldria', name: 'AVENNE', position: [468, 180], kind: 'capital' },
  { id: 'ostara-capital', nationId: 'ostara', name: 'KARSOV', position: [705, 205], kind: 'capital' },
  { id: 'meridia-capital', nationId: 'meridia', name: 'SOLENNE', position: [820, 325], kind: 'capital' },
  { id: 'thalor-capital', nationId: 'thalor', name: 'HIGHMERE', position: [752, 452], kind: 'capital' },
  { id: 'lyria-capital', nationId: 'lyria', name: 'RIVERMARK', position: [624, 477], kind: 'capital' },
  { id: 'vesper-capital', nationId: 'vesper', name: 'SUNSPIRE', position: [370, 426], kind: 'capital' },
  { id: 'velis-city', nationId: 'velis', name: 'VELIS CITY', position: [491, 292], kind: 'capital' },
]
