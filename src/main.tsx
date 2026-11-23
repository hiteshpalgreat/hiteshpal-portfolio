import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

import { readResume } from './resume'

// A fresh visit starts at the door, at the top. A reload continues where the visitor was (see resume.ts),
// which the site does itself once the room has loaded: the browser's own restore would land underneath
// the door screen, where the page can't be scrolled.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
readResume()
window.scrollTo(0, 0)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
