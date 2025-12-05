import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import '../AdminDashboard.css'

const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/
const YOUTUBE_URL_REGEX = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/

export default function VideoChannelManager() {
  const { getAuthHeaders } = useAuth()
  const navigate = useNavigate()
  const [selectedChannel, setSelectedChannel] = useState(null)
  const [youtubeInput, setYoutubeInput] = useState('')
  const [title, setTitle] = useState('')
  const [videoId, setVideoId] = useState('')
  const [channels, setChannels] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  // Fetch channels on component mount
  React.useEffect(() => {
    fetchChannels()
  }, [])

  const fetchChannels = async () => {
    try {
      const response = await fetch('/api/channels')
      if (response.ok) {
        const data = await response.json()
        setChannels(data)
      }
    } catch (err) {
      setMessage({ type: 'error', text: '❌ Failed to load channels' })
    }
  }

  const extractYoutubeId = (input) => {
    // Try full URL match first
    const urlMatch = input.match(YOUTUBE_URL_REGEX)
    if (urlMatch) return urlMatch[1]
    
    // Try direct ID
    if (YOUTUBE_ID_REGEX.test(input)) return input
    
    return null
  }

  const handleYoutubeInputChange = (e) => {
    const input = e.target.value.trim()
    setYoutubeInput(input)
    
    if (input) {
      const extracted = extractYoutubeId(input)
      if (extracted) {
        setVideoId(extracted)
        setMessage({ type: 'success', text: '✅ Video ID extracted' })
      } else {
        setVideoId('')
        setMessage({ type: 'error', text: '❌ Invalid YouTube URL or Video ID' })
      }
    } else {
      setVideoId('')
      setMessage({ type: '', text: '' })
    }
  }

  const handleAddVideo = async (e) => {
    e.preventDefault()
    
    if (!selectedChannel) {
      setMessage({ type: 'error', text: '❌ Select a channel' })
      return
    }
    if (!videoId) {
      setMessage({ type: 'error', text: '❌ Invalid YouTube Video ID' })
      return
    }
    if (!title.trim()) {
      setMessage({ type: 'error', text: '❌ Enter a title' })
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/channels/${selectedChannel}/add-video`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: title.trim(),
          youtubeId: videoId
        })
      })

      const data = await response.json()
      if (response.ok) {
        setMessage({ type: 'success', text: '✅ Video added successfully!' })
        setTimeout(() => {
          setTitle('')
          setYoutubeInput('')
          setVideoId('')
        }, 500)
      } else {
        setMessage({ type: 'error', text: `❌ ${data.message || 'Failed to add video'}` })
      }
    } catch (err) {
      setMessage({ type: 'error', text: `❌ ${err.message}` })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="video-add-container">
      {/* Header */}
      <div className="video-add-header">
        <h1>📺 ADD VIDEO TO CHANNEL</h1>
        <button
          onClick={() => navigate('/admin/dashboard')}
          className="btn btn-secondary"
          style={{ position: 'absolute', top: '20px', right: '20px' }}
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`video-add-message alert-${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleAddVideo} className="video-add-form">
        {/* Channel Selector */}
        <div className="video-add-field">
          <label className="video-add-label">SELECT CHANNEL *</label>
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            disabled={loading}
            className="video-add-input video-add-select"
          >
            <option value="">-- CHOOSE A CHANNEL --</option>
            {channels.map(ch => (
              <option key={ch._id} value={ch._id}>
                {ch.name}
              </option>
            ))}
          </select>
        </div>

        {/* YouTube Input with Auto-Extract */}
        <div className="video-add-field">
          <label className="video-add-label">YOUTUBE URL OR VIDEO ID *</label>
          <input
            type="text"
            placeholder="Paste YouTube URL or Video ID"
            value={youtubeInput}
            onChange={handleYoutubeInputChange}
            disabled={loading}
            className="video-add-input"
          />
          <small className="video-add-hint">
            Paste full URL (youtube.com/watch?v=...) or just the ID
          </small>
        </div>

        {/* Video ID Status */}
        {videoId && (
          <div className="video-add-status-ok">
            ✓ Video ID: <code>{videoId}</code>
          </div>
        )}

        {/* Title Input */}
        <div className="video-add-field">
          <label className="video-add-label">VIDEO TITLE *</label>
          <input
            type="text"
            placeholder="Enter video title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={loading}
            className="video-add-input"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !selectedChannel || !videoId || !title}
          className="video-add-submit"
        >
          {loading ? '⏳ ADDING VIDEO...' : '▶️ ADD VIDEO'}
        </button>
      </form>

      {/* Pro Tip */}
      <div style={{
        marginTop: '20px',
        border: '1px solid rgba(0, 212, 255, 0.2)',
        padding: '16px',
        borderRadius: '6px',
        color: '#00d4ff'
      }}>
        <strong>💡 Pro Tip:</strong> Get channel IDs from the Channels tab. Copy the entire JSON/CSV from a spreadsheet!
      </div>
    </div>
  )
}
``