import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

const container = document.getElementById('root')!
const app = <StrictMode><App /></StrictMode>

// Only "/" ships prerendered Landing markup (scripts/prerender.mjs). /c/:slug and /arhiva are
// rewritten (see public/_redirects) to the pristine app-shell.html, not this file, but guard on
// the real path too: hydrating Landing markup under any other route would mismatch the
// PublicPriceList tree App() renders there.
if (window.location.pathname === '/' && container.hasChildNodes()) hydrateRoot(container, app)
else createRoot(container).render(app)
