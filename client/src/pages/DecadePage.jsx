import React, { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import Player from '../components/Player'
import '../styles/tv.css'


export default function DecadePage(){
const { decade } = useParams()
const [channels,setChannels]=useState([])
const [i,setI]=useState(0)
const noiseRef = useRef(null)
const API = import.meta.env.VITE_API_BASE || 'http://localhost:5002'


useEffect(()=>{
axios.get(`${API}/api/channels/${decade}`).then(r=>setChannels(r.data||[]))
},[decade])


if(!channels.length) return <div style={{padding:40}}>Loading...</div>


const active = channels[i]


function next(){ triggerStatic(); setI(x=>Math.min(channels.length-1,x+1)) }
function prev(){ triggerStatic(); setI(x=>Math.max(0,x-1)) }


function triggerStatic(){
if(noiseRef.current){
noiseRef.current.classList.add('active')
setTimeout(()=>noiseRef.current.classList.remove('active'),200)
}
}


return (
<div className="tv-page">
<div className="tv-frame">
<div className="tv-screen">
<Player channel={active} />
<div ref={noiseRef} className="static-noise" />
</div>
</div>


<div style={{display:'flex',gap:20,marginTop:20}}>
<button onClick={prev}>Prev</button>
<div>{active.name}</div>
<button onClick={next}>Next</button>
</div>
</div>
)
}