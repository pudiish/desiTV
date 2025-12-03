import React, { useEffect, useState } from 'react'
import axios from 'axios'

export default function Admin(){
  const [channels, setChannels] = useState([])
  const [selectedChannel, setSelectedChannel] = useState(null)
  const [newChannelName, setNewChannelName] = useState('')

  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [duration, setDuration] = useState('30')
  const [tags, setTags] = useState('')

  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5002'
  const API = (path) => `${API_BASE}${path}`

  useEffect(()=>{ fetchChannels() }, [])

  async function fetchChannels(){
    try{
      const res = await axios.get(API('/api/channels'))
      setChannels(res.data || [])
      if(res.data && res.data[0] && !selectedChannel) setSelectedChannel(res.data[0])
    }catch(e){ setChannels([]) }
  }

  async function createChannel(e){
    e.preventDefault()
    if(!newChannelName) return alert('Provide channel name')
    try{
      await axios.post(API('/api/channels'), { name: newChannelName })
      setNewChannelName('')
      fetchChannels()
    }catch(err){ alert(err?.response?.data?.message || 'Error creating channel') }
  }

  function extractYoutubeId(u){
    try{ const urlObj = new URL(u); return urlObj.searchParams.get('v') || urlObj.pathname.split('/').pop() }catch(e){ return u }
  }

  const [metaStatus, setMetaStatus] = useState('')

  async function fetchMetadataForUrl(u){
    const id = extractYoutubeId(u)
    if(!id) return setMetaStatus('Invalid URL/ID')
    setMetaStatus('Fetching...')
    try{
      const res = await axios.post(API('/api/youtube/metadata'), { youtubeId: id })
      if(res.data.title) setTitle(res.data.title)
      if(res.data.duration) setDuration(String(res.data.duration))
      setMetaStatus('OK')
    }catch(err){
      setMetaStatus('Failed')
    }
    setTimeout(()=>setMetaStatus(''), 2500)
  }

  async function addVideo(e){
    e.preventDefault()
    if(!selectedChannel) return alert('Select channel')
    const youtubeId = extractYoutubeId(url)
    if(!youtubeId) return alert('Invalid YouTube URL/ID')
    try{
      await axios.post(API(`/api/channels/${selectedChannel._id}/videos`), {
        title: title || `Video ${youtubeId}`,
        youtubeId,
        duration: Number(duration) || 30,
        tags: tags ? tags.split(',').map(t=>t.trim()).filter(Boolean) : []
      })
      setTitle(''); setUrl(''); setDuration('30'); setTags('')
      fetchChannels()
    }catch(err){ alert(err?.response?.data?.message || 'Error adding video') }
  }

  async function deleteVideo(channelId, videoId){
    if(!confirm('Delete this video?')) return
    try{
      await axios.delete(API(`/api/channels/${channelId}/videos/${videoId}`))
      fetchChannels()
    }catch(e){ alert('Delete failed') }
  }

  return (
    <div style={{padding:20}}>
      <h2>Admin Panel</h2>

      <section style={{marginTop:12}}>
        <form onSubmit={createChannel} style={{display:'flex',gap:8}}>
          <input placeholder="New channel name" value={newChannelName} onChange={e=>setNewChannelName(e.target.value)} />
          <button type="submit">Create Channel</button>
        </form>
      </section>

      <section style={{display:'flex',gap:20, marginTop:20}}>
        <div style={{width:300}}>
          <h4>Channels</h4>
          <ul style={{listStyle:'none', padding:0}}>
            {channels.map(c=> (
              <li key={c._id} style={{marginBottom:8}}>
                <button onClick={()=>setSelectedChannel(c)} style={{width:'100%', textAlign:'left', padding:8, background:selectedChannel && selectedChannel._id===c._id ? '#eee' : 'transparent'}}>
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div style={{flex:1}}>
          <h4>Manage Channel</h4>
          {!selectedChannel && <div>Select a channel to manage</div>}
          {selectedChannel && (
            <div>
              <h5>{selectedChannel.name}</h5>
              <form onSubmit={addVideo} style={{display:'grid', gridTemplateColumns:'1fr 120px', gap:8}}>
                <input placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />
                <input placeholder="Duration (s)" value={duration} onChange={e=>setDuration(e.target.value)} />
                <div style={{gridColumn:'1 / -1', display:'flex', gap:8}}>
                  <input placeholder="YouTube URL or ID" value={url} onChange={e=>setUrl(e.target.value)} onBlur={e=>fetchMetadataForUrl(e.target.value)} onPaste={e=>{ const pasted = (e.clipboardData || window.clipboardData).getData('text'); setTimeout(()=>fetchMetadataForUrl(pasted),50) }} style={{flex:1}} />
                  <button type="button" onClick={()=>fetchMetadataForUrl(url)}>Fetch metadata</button>
                </div>
                <input style={{gridColumn:'1 / -1'}} placeholder="Tags (comma separated)" value={tags} onChange={e=>setTags(e.target.value)} />
                <div style={{gridColumn:'1 / -1', display:'flex', gap:8, alignItems:'center'}}>
                  <button type="submit">Add Video</button>
                  <button type="button" onClick={()=>fetchChannels()}>Refresh</button>
                  <div style={{marginLeft:8,color:'#999'}}>{metaStatus}</div>
                </div>
              </form>

              <div style={{marginTop:12}}>
                <h6>Playlist</h6>
                <ul style={{listStyle:'none', padding:0}}>
                  {(selectedChannel.items||[]).map(it=> (
                    <li key={it._id||it.youtubeId} style={{display:'flex', justifyContent:'space-between', padding:6, borderBottom:'1px solid #eee'}}>
                      <div>
                        <strong>{it.title}</strong>
                        <div style={{fontSize:12,color:'#666'}}>{it.youtubeId} • {it.duration}s</div>
                      </div>
                      <div>
                        <button onClick={()=>deleteVideo(selectedChannel._id, it._id)} style={{color:'red'}}>Delete</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
