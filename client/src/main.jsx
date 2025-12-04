import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Home from './pages/Home'
import Admin from './pages/Admin'
import AppInitializer from './components/AppInitializer'
import './styles.css'

function App(){
  return (
    <AppInitializer>
      <BrowserRouter>
        <Routes>
          <Route path='/' element={<Landing/>} />
          <Route path='/tv' element={<Home/>} />
          <Route path='/admin' element={<Admin/>} />
        </Routes>
      </BrowserRouter>
    </AppInitializer>
  )
}

createRoot(document.getElementById('root')).render(<App />)

