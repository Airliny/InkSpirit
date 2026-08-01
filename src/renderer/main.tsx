import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initThemeSync, loadThemePreference, applyTheme } from './design/theme'
import './design/tokens.css'

initThemeSync()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
