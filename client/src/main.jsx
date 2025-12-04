import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Home from './pages/Home'
// DecadePage removed in simplified app
import Admin from './pages/Admin'
import './styles.css'

function App(){
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<Landing/>} />
        <Route path='/tv' element={<Home/>} />
        <Route path='/admin' element={<Admin/>} />
      </Routes>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')).render(<App />)

