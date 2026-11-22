import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

// The site always starts at the door, so a reload must start at the top too. Without this the browser
// restores the old scroll position underneath the door screen and the page can't be scrolled past it.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
window.scrollTo(0, 0)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
