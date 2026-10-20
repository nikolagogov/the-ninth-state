import { lazy, Suspense } from 'react'

const GeographyConceptPreview = lazy(() => import('./GeographyConceptPreview.tsx'))

export default function GeographyPreviewRoute() {
  return <Suspense fallback={<div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#080f14', color: '#b1bfbd' }}>Preparing planetary terrain…</div>}>
    <GeographyConceptPreview />
  </Suspense>
}
