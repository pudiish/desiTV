import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import AppInitializer from './components/AppInitializer'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppInitializer>
      <App />
    </AppInitializer>
  </React.StrictMode>
)

