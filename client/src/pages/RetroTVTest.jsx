import React, { useState, useEffect } from 'react'
import RetroTV from '../components/RetroTV'
import { channelManager } from '../logic/channel/index.js'

export default function RetroTVTest() {
  const [allChannels, setAllChannels] = useState([])
  const [activeChannelIndex, setActiveChannelIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadChannels() {
      try {
        const channels = await channelManager.loadChannels()
        
        // Keep channels in their original format with full playlist info
        const validChannels = channels.filter(channel => 
          channel.items && Array.isArray(channel.items) && channel.items.length > 0
        )
        
        setAllChannels(validChannels)
        setLoading(false)
      } catch (err) {
        console.error('Error loading channels:', err)
        setLoading(false)
      }
    }
    
    loadChannels()
  }, [])

  const handleChannelUp = () => {
    setActiveChannelIndex(prev => (prev + 1) % allChannels.length)
  }

  const handleChannelDown = () => {
    setActiveChannelIndex(prev => prev === 0 ? allChannels.length - 1 : prev - 1)
  }

  const handleChannelDirect = (index) => {
    if (index >= 0 && index < allChannels.length) {
      setActiveChannelIndex(index)
    }
  }

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontFamily: 'monospace',
        color: '#7CFFBC'
      }}>
        Loading channels...
      </div>
    )
  }

  if (allChannels.length === 0) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontFamily: 'monospace',
        color: '#ff6b6b'
      }}>
        No channels found
      </div>
    )
  }

  const activeChannel = allChannels[activeChannelIndex]
  const totalVideos = allChannels.reduce((sum, ch) => sum + (ch.items?.length || 0), 0)

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#0a0a0a',
      padding: '20px'
    }}>
      <h1 style={{ 
        textAlign: 'center', 
        color: '#7CFFBC', 
        fontFamily: 'monospace',
        marginBottom: '10px'
      }}>
        DesiTV - Retro Phone Compatible
      </h1>
      
      <div style={{
        textAlign: 'center',
        color: '#7CFFBC',
        fontFamily: 'monospace',
        fontSize: '14px',
        marginBottom: '20px'
      }}>
        <p style={{ margin: '5px 0' }}>
          Channel: {activeChannelIndex + 1}/{allChannels.length} - {activeChannel.name}
        </p>
        <p style={{ margin: '5px 0', color: '#666' }}>
          {activeChannel.items.length} videos in this channel | {totalVideos} total videos
        </p>
      </div>
      
      <RetroTV 
        channel={activeChannel}
        onChannelUp={handleChannelUp}
        onChannelDown={handleChannelDown}
      />
      
      {/* Channel selector */}
      <div style={{
        marginTop: '20px',
        maxWidth: '640px',
        margin: '20px auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: '10px'
      }}>
        {allChannels.map((channel, index) => (
          <button
            key={channel._id || index}
            onClick={() => handleChannelDirect(index)}
            style={{
              background: index === activeChannelIndex ? '#7CFFBC' : '#1a1a1a',
              color: index === activeChannelIndex ? '#0a0a0a' : '#7CFFBC',
              border: '1px solid ' + (index === activeChannelIndex ? '#7CFFBC' : '#333'),
              padding: '10px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontSize: '12px',
              transition: 'all 0.2s'
            }}
          >
            {index + 1}. {channel.name}
            <br />
            <span style={{ fontSize: '10px', opacity: 0.7 }}>
              ({channel.items.length} videos)
            </span>
          </button>
        ))}
      </div>
      
      <div style={{
        textAlign: 'center',
        color: '#666',
        fontFamily: 'monospace',
        fontSize: '11px',
        marginTop: '20px'
      }}>
        <p>iPhone Compatible - Tap POWER to start • Use CH ▲/▼ or click channel buttons</p>
      </div>
    </div>
  )
}
