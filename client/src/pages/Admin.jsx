import React, { useEffect, useState } from 'react'
import axios from 'axios'

export default function Admin(){
  const [channels, setChannels] = useState([])
  const [selectedChannel, setSelectedChannel] = useState(null)
  const [newChannelName, setNewChannelName] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [duration, setDuration] = useState('30')
  const [tags, setTags] = useState('')

  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5002'
  const API = (path) => `${API_BASE}${path}`

  // Modern color palette
  const colors = {
    bg: '#0f1419',
    bgSecondary: '#1a1f2e',
    bgTertiary: '#252d3d',
    primary: '#00d4ff',
    primaryDark: '#0099cc',
    accent: '#ff006e',
    success: '#00f5a0',
    warning: '#ffa500',
    danger: '#ff3860',
    text: '#e0e0e0',
    textMuted: '#808080',
    border: '#2a3340'
  }

  useEffect(()=>{ fetchChannels() }, [])

  async function fetchChannels(){
    try{
      setLoading(true)
      const res = await axios.get(API('/api/channels'))
      setChannels(res.data || [])
      if(res.data && res.data[0] && !selectedChannel) setSelectedChannel(res.data[0])
    }catch(e){ 
      setChannels([])
      showMessage('Failed to load channels', 'error')
    }finally{
      setLoading(false)
    }
  }

  async function createChannel(e){
    e.preventDefault()
    if(!newChannelName.trim()) return showMessage('Provide channel name', 'error')
    try{
      setLoading(true)
      await axios.post(API('/api/channels'), { name: newChannelName })
      setNewChannelName('')
      showMessage('Channel created successfully!', 'success')
      fetchChannels()
    }catch(err){ 
      showMessage(err?.response?.data?.message || 'Error creating channel', 'error')
    }finally{
      setLoading(false)
    }
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
    if(!selectedChannel) return showMessage('Select channel', 'error')
    const youtubeId = extractYoutubeId(url)
    if(!youtubeId) return showMessage('Invalid YouTube URL/ID', 'error')
    try{
      setLoading(true)
      await axios.post(API(`/api/channels/${selectedChannel._id}/videos`), {
        title: title || `Video ${youtubeId}`,
        youtubeId,
        duration: Number(duration) || 30,
        tags: tags ? tags.split(',').map(t=>t.trim()).filter(Boolean) : []
      })
      setTitle(''); setUrl(''); setDuration('30'); setTags('')
      showMessage('Video added successfully!', 'success')
      fetchChannels()
    }catch(err){ 
      showMessage(err?.response?.data?.message || 'Error adding video', 'error')
    }finally{
      setLoading(false)
    }
  }

  async function deleteVideo(channelId, videoId){
    if(!videoId) return showMessage('Video ID not found', 'error')
    if(!confirm('Delete this video?')) return
    try{
      setLoading(true)
      await axios.delete(API(`/api/channels/${channelId}/videos/${videoId}`))
      fetchChannels()
      showMessage('Video deleted successfully', 'success')
    }catch(e){ 
      showMessage(e.response?.data?.message || 'Delete failed', 'error')
    }finally{
      setLoading(false)
    }
  }

  async function deleteChannel(channelId, channelName){
    if(!confirm(`Delete channel "${channelName}" and all its videos?`)) return
    try{
      setLoading(true)
      await axios.delete(API(`/api/channels/${channelId}`))
      setSelectedChannel(null)
      setChannels(prev => prev.filter(ch => ch._id !== channelId))
      showMessage(`Channel "${channelName}" deleted successfully`, 'success')
    }catch(e){ 
      showMessage(e.response?.data?.message || 'Delete failed', 'error')
    }finally{
      setLoading(false)
    }
  }

  function showMessage(msg, type = 'info') {
    setSuccessMessage(`[${type.toUpperCase()}] ${msg}`)
    setTimeout(() => setSuccessMessage(''), 4000)
  }

  const styles = {
    container: {
      minHeight: '100vh',
      background: `linear-gradient(135deg, ${colors.bg} 0%, ${colors.bgSecondary} 100%)`,
      color: colors.text,
      padding: '30px',
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
    },
    header: {
      marginBottom: '40px',
      borderBottom: `2px solid ${colors.primary}`,
      paddingBottom: '20px'
    },
    title: {
      fontSize: '32px',
      fontWeight: '700',
      color: colors.primary,
      textShadow: `0 0 20px ${colors.primary}33`,
      margin: 0
    },
    section: {
      marginTop: '30px'
    },
    label: {
      fontSize: '14px',
      color: colors.textMuted,
      marginBottom: '10px',
      textTransform: 'uppercase',
      letterSpacing: '1px'
    },
    input: {
      background: colors.bgTertiary,
      border: `1px solid ${colors.border}`,
      color: colors.text,
      padding: '12px 16px',
      borderRadius: '6px',
      fontSize: '14px',
      transition: 'all 0.3s ease',
      outline: 'none',
      '&:focus': { borderColor: colors.primary }
    },
    button: {
      background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryDark})`,
      color: colors.bg,
      border: 'none',
      padding: '12px 24px',
      borderRadius: '6px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    },
    buttonSecondary: {
      background: colors.bgTertiary,
      color: colors.primary,
      border: `1px solid ${colors.primary}`,
      padding: '10px 20px',
      borderRadius: '6px',
      fontSize: '13px',
      cursor: 'pointer',
      transition: 'all 0.3s ease'
    },
    buttonDanger: {
      background: colors.danger,
      color: 'white',
      border: 'none',
      padding: '8px 16px',
      borderRadius: '4px',
      fontSize: '12px',
      cursor: 'pointer',
      transition: 'all 0.3s ease'
    },
    card: {
      background: colors.bgSecondary,
      border: `1px solid ${colors.border}`,
      borderRadius: '8px',
      padding: '20px',
      marginBottom: '20px',
      transition: 'all 0.3s ease'
    },
    cardActive: {
      background: colors.bgTertiary,
      borderColor: colors.primary,
      boxShadow: `0 0 15px ${colors.primary}22`
    },
    messageBox: {
      background: successMessage.includes('SUCCESS') ? `${colors.success}15` : `${colors.danger}15`,
      border: `1px solid ${successMessage.includes('SUCCESS') ? colors.success : colors.danger}`,
      color: successMessage.includes('SUCCESS') ? colors.success : colors.danger,
      padding: '12px 16px',
      borderRadius: '6px',
      marginBottom: '20px',
      fontSize: '13px'
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: '20px'
    },
    videoItem: {
      background: colors.bgTertiary,
      border: `1px solid ${colors.border}`,
      padding: '12px',
      borderRadius: '6px',
      marginBottom: '10px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      transition: 'all 0.3s ease'
    }
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>⚙️ ADMIN CONTROL PANEL</h1>
        <p style={{color: colors.textMuted, margin: '10px 0 0 0'}}>Manage channels and videos</p>
      </div>

      {/* Success/Error Message */}
      {successMessage && (
        <div style={styles.messageBox}>
          {successMessage}
        </div>
      )}

      {/* Create Channel Section */}
      <div style={styles.section}>
        <h3 style={{color: colors.primary, marginTop: 0}}>📺 Create New Channel</h3>
        <form onSubmit={createChannel} style={{display:'flex', gap:'12px'}}>
          <input 
            placeholder="Channel name" 
            value={newChannelName} 
            onChange={e=>setNewChannelName(e.target.value)}
            style={{...styles.input, flex: 1}}
            disabled={loading}
          />
          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Creating...' : 'Create'}
          </button>
        </form>
      </div>

      {/* Main Content */}
      <div style={{...styles.section, display: 'grid', gridTemplateColumns: '320px 1fr', gap: '30px'}}>
        {/* Channels List */}
        <div>
          <h3 style={{color: colors.primary, marginTop: 0}}>📡 Channels ({channels.length})</h3>
          <div style={{maxHeight: '70vh', overflowY: 'auto'}}>
            {channels.map(c => (
              <div
                key={c._id}
                onClick={() => setSelectedChannel(c)}
                style={{
                  ...styles.card,
                  ...(selectedChannel?._id === c._id ? styles.cardActive : {}),
                  cursor: 'pointer',
                  marginBottom: '10px'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateX(5px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateX(0)'}
              >
                <div style={{fontWeight: '600', color: colors.primary}}>{c.name}</div>
                <div style={{fontSize: '12px', color: colors.textMuted, marginTop: '5px'}}>
                  {c.items?.length || 0} videos
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Manage Channel */}
        <div>
          {!selectedChannel ? (
            <div style={{...styles.card, textAlign: 'center'}}>
              <div style={{color: colors.textMuted}}>Select a channel to manage</div>
            </div>
          ) : (
            <div>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                <h3 style={{color: colors.primary, margin: 0}}>{selectedChannel.name}</h3>
                <button 
                  onClick={() => deleteChannel(selectedChannel._id, selectedChannel.name)} 
                  style={styles.buttonDanger}
                  disabled={loading}
                >
                  🗑️ Delete Channel
                </button>
              </div>

              {/* Add Video Form */}
              <div style={styles.card}>
                <h4 style={{color: colors.accent, marginTop: 0}}>➕ Add Video to Playlist</h4>
                <form onSubmit={addVideo} style={{display: 'grid', gap: '12px'}}>
                  <input 
                    placeholder="Video title" 
                    value={title} 
                    onChange={e=>setTitle(e.target.value)}
                    style={styles.input}
                    disabled={loading}
                  />
                  
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 100px', gap: '12px'}}>
                    <input 
                      placeholder="YouTube URL or ID" 
                      value={url} 
                      onChange={e=>setUrl(e.target.value)}
                      onBlur={e=>fetchMetadataForUrl(e.target.value)}
                      style={styles.input}
                      disabled={loading}
                    />
                    <button 
                      type="button" 
                      onClick={() => fetchMetadataForUrl(url)}
                      style={styles.buttonSecondary}
                      disabled={loading}
                    >
                      🔍 Fetch
                    </button>
                  </div>

                  <input 
                    placeholder="Duration (seconds)" 
                    value={duration} 
                    onChange={e=>setDuration(e.target.value)}
                    type="number"
                    style={styles.input}
                    disabled={loading}
                  />

                  <input 
                    placeholder="Tags (comma separated)" 
                    value={tags} 
                    onChange={e=>setTags(e.target.value)}
                    style={styles.input}
                    disabled={loading}
                  />

                  <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
                    <button 
                      type="submit" 
                      style={styles.button}
                      disabled={loading}
                    >
                      {loading ? 'Adding...' : 'Add Video'}
                    </button>
                    <div style={{color: metaStatus === 'OK' ? colors.success : metaStatus === 'Fetching...' ? colors.warning : colors.danger, fontSize: '12px'}}>
                      {metaStatus && `Metadata: ${metaStatus}`}
                    </div>
                  </div>
                </form>
              </div>

              {/* Playlist */}
              <div style={styles.card}>
                <h4 style={{color: colors.accent, marginTop: 0}}>🎬 Playlist ({selectedChannel.items?.length || 0})</h4>
                {selectedChannel.items?.length === 0 ? (
                  <div style={{color: colors.textMuted}}>No videos yet</div>
                ) : (
                  <div style={{maxHeight: '50vh', overflowY: 'auto'}}>
                    {selectedChannel.items?.map((video, idx) => (
                      <div 
                        key={video._id || video.youtubeId || idx}
                        style={styles.videoItem}
                        onMouseEnter={e => e.currentTarget.style.borderColor = colors.primary}
                        onMouseLeave={e => e.currentTarget.style.borderColor = colors.border}
                      >
                        <div style={{flex: 1}}>
                          <div style={{fontWeight: '600', fontSize: '14px'}}>{idx + 1}. {video.title}</div>
                          <div style={{fontSize: '11px', color: colors.textMuted, marginTop: '4px'}}>
                            ID: {video.youtubeId} • ⏱️ {video.duration}s
                          </div>
                          {video.tags?.length > 0 && (
                            <div style={{fontSize: '10px', color: colors.primary, marginTop: '4px'}}>
                              {video.tags.map(t => `#${t}`).join(' ')}
                            </div>
                          )}
                        </div>
                        <button 
                          onClick={() => deleteVideo(selectedChannel._id, video._id || video.youtubeId)}
                          style={{...styles.buttonDanger, marginLeft: '10px'}}
                          disabled={loading}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{color: colors.primary, fontSize: '20px'}}>⏳ Processing...</div>
        </div>
      )}
    </div>
  )
}
