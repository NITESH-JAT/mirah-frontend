import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import favicon from './assets/favicon.png'

// Set favicon from bundled asset (works in dev + prod builds)
const existing =
  document.querySelector("link[rel='icon']") ||
  document.querySelector("link[rel='shortcut icon']")
if (existing) {
  existing.setAttribute('href', favicon)
} else {
  const link = document.createElement('link')
  link.rel = 'icon'
  link.type = 'image/png'
  link.href = favicon
  document.head.appendChild(link)
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)