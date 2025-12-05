import React, { useState, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import '../AdminDashboard.css'

const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/
const YOUTUBE_URL_REGEX = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/

// Error Boundary for VideoManager
class VideoManagerErrorBoundary extends React.Component {
	constructor(props) {
		super(props)
		this.state = { hasError: false }
	}

	static getDerivedStateFromError(error) {
		return { hasError: true }
	}

	componentDidCatch(error, errorInfo) {
		console.error('[VideoManager] Error boundary caught:', error, errorInfo)
	}

	render() {
		if (this.state.hasError) {
			return (
				<div className="section">
					<div className="section-title">📹 Add Video to Channel</div>
					<div className="alert alert-error" style={{ marginTop: '16px' }}>
						❌ An error occurred. Please refresh the page.
					</div>
					<button 
						onClick={() => window.location.reload()} 
						className="btn btn-secondary"
					>
						🔄 Reload Page
					</button>
				</div>
			)
		}

		return this.props.children
	}
}

function VideoManagerContent() {
  const { getAuthHeaders } = useAuth()
  
  // Form states
  const [selectedChannel, setSelectedChannel] = useState('')
  const [youtubeInput, setYoutubeInput] = useState('')
  const [videoData, setVideoData] = useState({
    title: '',
    duration: 30,
    year: new Date().getFullYear(),
    tags: '',
    category: ''
  })
  const [videoId, setVideoId] = useState('')
  
  // UI states
  const [channels, setChannels] = useState([])
  const [loading, setLoading] = useState(false)
  const [fetchingYT, setFetchingYT] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [ytPreview, setYtPreview] = useState(null)

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
      console.error('[VideoManager] Fetch channels error:', err)
      setMessage({ type: 'error', text: '❌ Failed to load channels' })
    }
  }

  const extractYoutubeId = (input) => {
    const urlMatch = input.match(YOUTUBE_URL_REGEX)
    if (urlMatch) return urlMatch[1]
    if (YOUTUBE_ID_REGEX.test(input)) return input
    return null
  }

  // Fetch YouTube metadata
  const fetchYouTubeMetadata = useCallback(async (id) => {
    setFetchingYT(true)
    try {
      const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`)
      if (response.ok) {
        const data = await response.json()
        setYtPreview({
          title: data.title,
          thumbnail: data.thumbnail_url,
          author: data.author_name
        })
        setVideoData(prev => ({
          ...prev,
          title: data.title
        }))
        setMessage({ type: 'success', text: '✅ YouTube data fetched' })
      } else {
        setMessage({ type: 'error', text: '❌ Could not fetch YouTube data' })
      }
    } catch (err) {
      // YouTube oEmbed might be blocked, use manual input
      setMessage({ type: 'warn', text: '⚠️ Enter title manually' })
    } finally {
      setFetchingYT(false)
    }
  }, [])

  const handleYoutubeInputChange = (e) => {
    const input = e.target.value.trim()
    setYoutubeInput(input)
    
    if (input) {
      const extracted = extractYoutubeId(input)
      if (extracted) {
        setVideoId(extracted)
        setYtPreview(null)
        fetchYouTubeMetadata(extracted)
      } else {
        setVideoId('')
        setYtPreview(null)
        setMessage({ type: 'error', text: '❌ Invalid YouTube URL or ID' })
      }
    } else {
      setVideoId('')
      setYtPreview(null)
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
    if (!videoData.title.trim()) {
      setMessage({ type: 'error', text: '❌ Enter a title' })
      return
    }

    setLoading(true)
    try {
      const payload = {
        title: videoData.title.trim(),
        youtubeId: videoId,
        duration: Number(videoData.duration) || 30
      }

      if (videoData.year) payload.year = Number(videoData.year)
      if (videoData.category) payload.category = videoData.category
      if (videoData.tags) payload.tags = videoData.tags.split(',').map(t => t.trim()).filter(t => t)

      const response = await fetch(`/api/channels/${selectedChannel}/videos`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()
      if (response.ok) {
        setMessage({ type: 'success', text: '✅ Video added successfully!' })
        setTimeout(() => {
          setYoutubeInput('')
          setVideoId('')
          setYtPreview(null)
          setVideoData({
            title: '',
            duration: 30,
            year: new Date().getFullYear(),
            tags: '',
            category: ''
          })
        }, 1500)
      } else {
        setMessage({ type: 'error', text: `❌ ${data.message || 'Failed to add video'}` })
      }
    } catch (err) {
      console.error('[VideoManager] Add video error:', err)
      setMessage({ type: 'error', text: `❌ ${err.message}` })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="section">
      <div className="section-title">📹 Add Video to Channel</div>
      <div className="section-subtitle">Paste YouTube link, fetch details automatically, customize if needed</div>

      {message.text && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
          <button 
            onClick={() => setMessage({ type: '', text: '' })} 
            style={{ marginLeft: '12px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      <form onSubmit={handleAddVideo}>
        {/* Channel Selector */}
        <div className="form-group">
          <label className="form-label">SELECT CHANNEL *</label>
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            disabled={loading}
          >
            <option value="">-- Choose a channel --</option>
            {channels.map(ch => (
              <option key={ch._id} value={ch._id}>
                {ch.name}
              </option>
            ))}
          </select>
        </div>

        {/* YouTube URL/ID Input */}
        <div className="form-group">
          <label className="form-label">YOUTUBE URL OR VIDEO ID *</label>
          <input
            type="text"
            placeholder="Paste YouTube URL or Video ID"
            value={youtubeInput}
            onChange={handleYoutubeInputChange}
            disabled={loading}
          />
          <small style={{ color: '#888', display: 'block', marginTop: '4px' }}>
            Examples: https://youtube.com/watch?v=dQw4w9WgXcQ or dQw4w9WgXcQ
          </small>
        </div>

        {/* Video ID Status */}
        {videoId && (
          <div style={{
            background: 'rgba(0, 255, 136, 0.1)',
            border: '1px solid rgba(0, 255, 136, 0.3)',
            borderRadius: '6px',
            padding: '10px 12px',
            marginBottom: '16px',
            fontSize: '12px',
            color: '#00ff88'
          }}>
            ✓ Video ID: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '3px' }}>{videoId}</code>
            {fetchingYT && <span style={{ marginLeft: '8px' }}>🔄 Fetching...</span>}
          </div>
        )}

        {/* YouTube Preview */}
        {ytPreview && (
          <div style={{
            background: 'rgba(0, 212, 255, 0.08)',
            border: '1px solid rgba(0, 212, 255, 0.2)',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '16px',
            fontSize: '12px',
            color: '#d0d0d0'
          }}>
            <strong style={{ color: '#00d4ff' }}>📺 YouTube Info:</strong><br />
            Title: {ytPreview.title}<br />
            Channel: {ytPreview.author}
            {ytPreview.thumbnail && <br />}
            {ytPreview.thumbnail && <img src={ytPreview.thumbnail} alt="thumb" style={{ marginTop: '8px', maxWidth: '100%', borderRadius: '4px' }} />}
          </div>
        )}

        {/* Title (editable) */}
        <div className="form-group">
          <label className="form-label">VIDEO TITLE *</label>
          <input
            type="text"
            placeholder="Video title (auto-filled if available)"
            value={videoData.title}
            onChange={(e) => setVideoData({ ...videoData, title: e.target.value })}
            disabled={loading || fetchingYT}
          />
        </div>

        {/* Duration */}
        <div className="form-group">
          <label className="form-label">DURATION (seconds)</label>
          <input
            type="number"
            placeholder="30"
            value={videoData.duration}
            onChange={(e) => setVideoData({ ...videoData, duration: e.target.value })}
            disabled={loading}
            min="1"
          />
          <small style={{ color: '#888', display: 'block', marginTop: '4px' }}>
            Default: 30 seconds
          </small>
        </div>

        {/* Year */}
        <div className="form-group">
          <label className="form-label">YEAR</label>
          <input
            type="number"
            placeholder={new Date().getFullYear()}
            value={videoData.year}
            onChange={(e) => setVideoData({ ...videoData, year: e.target.value })}
            disabled={loading}
            min="1900"
            max={new Date().getFullYear()}
          />
        </div>

        {/* Category */}
        <div className="form-group">
          <label className="form-label">CATEGORY</label>
          <input
            type="text"
            placeholder="e.g., Music, Comedy, News"
            value={videoData.category}
            onChange={(e) => setVideoData({ ...videoData, category: e.target.value })}
            disabled={loading}
          />
        </div>

        {/* Tags */}
        <div className="form-group">
          <label className="form-label">TAGS</label>
          <input
            type="text"
            placeholder="Comma-separated tags (e.g., retro, 80s, nostalgia)"
            value={videoData.tags}
            onChange={(e) => setVideoData({ ...videoData, tags: e.target.value })}
            disabled={loading}
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !selectedChannel || !videoId || !videoData.title}
          className="btn btn-full btn-success"
          style={{ marginTop: '20px' }}
        >
          {loading ? '⏳ ADDING VIDEO...' : '▶️ ADD TO DATABASE'}
        </button>
      </form>
    </div>
  )
}

export default function VideoManager() {
  return (
    <VideoManagerErrorBoundary>
      <VideoManagerContent />
    </VideoManagerErrorBoundary>
  )
}
