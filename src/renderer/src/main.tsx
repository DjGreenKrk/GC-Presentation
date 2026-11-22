import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ProgramOut from './ProgramOut'
import PresenterOut from './PresenterOut'

// The About dialog's data file ships a version baked at sync time; this is the
// one the build actually produced. Spread, not assign: about-data.js may not
// have run yet, and it merges rather than overwriting. See public/about.js.
window.STOATWORKS_ABOUT = { ...window.STOATWORKS_ABOUT, version: __APP_VERSION__ }

const outputMode = new URLSearchParams(window.location.search).get('mode')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {outputMode === 'presenter-out' ? (
      <PresenterOut />
    ) : outputMode === 'program-out' || outputMode === 'next-out' ? (
      <ProgramOut mode={outputMode === 'next-out' ? 'next' : 'program'} />
    ) : (
      <App />
    )}
  </StrictMode>
)
