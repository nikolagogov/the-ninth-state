import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import GeographyPreviewRoute from './GeographyPreviewRoute.tsx'

const showGeographyConceptPreview = new URLSearchParams(window.location.search).get('geography-preview') === 'phase1'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {showGeographyConceptPreview ? <GeographyPreviewRoute /> : <App />}
  </StrictMode>,
)
