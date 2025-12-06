import React, { useState, useEffect } from 'react'
import RetroTV from '../components/RetroTV'
import channelManager from '../logic/channelManager'

export default function RetroTVTest() {
  const [channels, setChannels] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadChannels() {
      try {
        const allChannels = await channelManager.loadChannels()
        
        // Convert our channel format to RetroTV format
        // Extract all video IDs from all channels
        const videoChannels = []
        allChannels.forEach(channel => {
          if (channel.items && Array.isArray(channel.items)) {
            channel.items.forEach(item => {
              if (item.videoId) {
                videoChannels.push({
                  id: item.videoId,
                  title: `${channel.name} - ${item.title || 'Video'}`
                })
              }
            })
          }
        })
        
        setChannels(videoChannels)
        setLoading(false)
      } catch (err) {
        console.error('Error loading channels:', err)
        setLoading(false)
      }
    }
    
    loadChannels()
  }, [])

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

  if (channels.length === 0) {
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
        marginBottom: '20px'
      }}>
        DesiTV - Retro Phone Compatible
      </h1>
      
      <RetroTV 
        initialVideoId={channels[0].id} 
        channels={channels} 
      />
      
      <div style={{
        textAlign: 'center',
        color: '#666',
        fontFamily: 'monospace',
        fontSize: '12px',
        marginTop: '20px'
      }}>
        <p>iPhone Compatible - Tap POWER to start</p>
        <p>Total Videos: {channels.length}</p>
      </div>
    </div>
  )
}
