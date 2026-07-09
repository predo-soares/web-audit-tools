import '../assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PanelHost } from './panel-host'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PanelHost />
  </StrictMode>
)
