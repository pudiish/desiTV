/**
 * FRONTEND INTEGRATION GUIDE
 * 
 * How to integrate EnhancedVJCore with React frontend
 * Handles: Clickable suggestions, auto-play, action execution
 */

// ============================================================================
// STEP 1: Updated Chat Hook Integration
// ============================================================================
// In your VJChat.jsx or chat hook, modify the chat handler:

/*
const handleSendMessage = async (message) => {
  // Add user message to chat
  setMessages(prev => [...prev, { role: 'user', content: message }]);

  try {
    // CALL EnhancedVJCore instead of direct Gemini
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        userId: currentUser?.id || 'anonymous',
        context: {
          currentSong: nowPlaying,
          previousMessages: messages,
          userPreferences: userProfile
        }
      })
    });

    const result = await response.json();
    
    // IMPORTANT: Result now has:
    // {
    //   response: "🎵 Playing: Rangrez...",
    //   action: { type: 'PLAY_EXTERNAL', videoId: '...' },
    //   intent: 'PLAY_SUGGESTED_SONG',
    //   suggestions: [...]
    // }

    // Add bot response
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: result.response,
      action: result.action,
      suggestions: result.suggestions
    }]);

    // EXECUTE ACTION if present
    if (result.action) {
      await executeAction(result.action);
    }
  } catch (error) {
    console.error('Chat error:', error);
  }
};

// ============================================================================
// STEP 2: Action Executor
// ============================================================================

const executeAction = async (action) => {
  switch (action.type) {
    case 'PLAY_EXTERNAL':
      // Play song in embedded player or redirect
      playVideo(action.videoId, action.videoTitle);
      break;

    case 'PLAY_YOUTUBE':
      // Play from YouTube
      openYouTubePlayer(action.videoId);
      break;

    case 'SHOW_OPTIONS':
      // Already rendered in UI (buttons)
      console.log('Options displayed to user');
      break;

    case 'NOW_PLAYING':
      // Update now playing info
      setNowPlaying(action.song);
      break;

    default:
      console.log('Unknown action:', action.type);
  }
};

const playVideo = (videoId, title) => {
  // Your video player implementation
  const player = document.getElementById('video-player');
  if (player) {
    player.src = `https://www.youtube.com/embed/${videoId}`;
    player.play();
  }
};

// ============================================================================
// STEP 3: Clickable Suggestion Handler
// ============================================================================

const handleSuggestionClick = async (videoId, title, artist) => {
  // When user clicks on a suggestion:
  // 1. Send confirmation to backend
  // 2. Track as accepted suggestion
  // 3. Play the video
  // 4. Learn preference

  try {
    // Track the selection
    await fetch('/api/track-selection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser?.id,
        videoId,
        title,
        artist,
        accepted: true
      })
    });

    // Play the video
    playVideo(videoId, title);

    // Add to chat
    setMessages(prev => [...prev, {
      role: 'user',
      content: `${title} by ${artist}`,
      action: 'SELECTED_SONG'
    }]);
  } catch (error) {
    console.error('Selection error:', error);
  }
};

// ============================================================================
// STEP 4: Update VJChat.jsx Renderer
// ============================================================================

// In renderMessageContent function, update to handle suggestions:

const renderMessageContent = (message) => {
  const parts = [];

  // Parse markdown
  const markdown = parseMessageContent(message);

  markdown.forEach((item, idx) => {
    if (item.type === 'option') {
      // Render as clickable button
      parts.push(
        <button
          key={idx}
          className="vj-msg-option"
          onClick={() => {
            const match = item.text.match(/\[(.+?)\s*-\s*(.+?)\]/);
            const title = match?.[1] || item.text;
            const artist = match?.[2] || 'Unknown';
            const videoId = item.videoId;

            handleSuggestionClick(videoId, title, artist);
          }}
        >
          {item.text}
        </button>
      );
    } else if (item.type === 'heading') {
      parts.push(
        <h3 key={idx} className="vj-msg-heading">{item.text}</h3>
      );
    } else if (item.type === 'bold') {
      parts.push(
        <span key={idx} className="vj-msg-bold">{item.text}</span>
      );
    } else if (item.type === 'italic') {
      parts.push(
        <span key={idx} className="vj-msg-italic">{item.text}</span>
      );
    } else {
      parts.push(
        <span key={idx}>{item.text}</span>
      );
    }
  });

  return <div className="vj-message-content">{parts}</div>;
};

// ============================================================================
// STEP 5: Update CSS for Better UX
// ============================================================================

/*
.vj-msg-option {
  display: inline-block;
  padding: 8px 12px;
  margin: 4px 4px;
  background: linear-gradient(135deg, #d4a574, #c49060);
  color: white;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.vj-msg-option:hover {
  background: linear-gradient(135deg, #e8c580, #d4a574);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.vj-msg-option:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.vj-message-content {
  line-height: 1.6;
  word-wrap: break-word;
}

.vj-message-content * {
  display: inline;
}

.vj-message-content h3 {
  display: block;
  margin: 8px 0 4px 0;
  font-size: 16px;
  font-weight: 700;
}

.vj-message-content .vj-msg-bold {
  color: #d4a574;
  font-weight: 700;
}

.vj-message-content .vj-msg-italic {
  font-style: italic;
  opacity: 0.8;
}
*/

// ============================================================================
// STEP 6: Track User Preferences
// ============================================================================

const trackUserPreference = async (songId, accepted) => {
  // Call this when user accepts/rejects a suggestion
  try {
    await fetch('/api/track-preference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser?.id,
        songId,
        accepted,
        timestamp: new Date()
      })
    });

    // Preferences are now stored in userMemory
    // Next suggestions will be personalized!
  } catch (error) {
    console.error('Preference tracking error:', error);
  }
};

// ============================================================================
// STEP 7: Display Cache Stats (Optional - for debugging)
// ============================================================================

const getCacheStats = async () => {
  try {
    const response = await fetch('/api/vjcore-metrics');
    const metrics = await response.json();

    console.log('Cache Stats:', {
      cacheSize: metrics.cache.size,
      cacheHitRate: `${(metrics.cache.hitRate * 100).toFixed(2)}%`,
      indexedSongs: metrics.semanticSearchVocab,
      vocabSize: metrics.indexedSongs
    });

    return metrics;
  } catch (error) {
    console.error('Metrics error:', error);
  }
};

// ============================================================================
// STEP 8: Example Backend API Changes (in chatController.js)
// ============================================================================

/*
exports.chat = async (req, res) => {
  try {
    const { message, userId, context } = req.body;

    // Use EnhancedVJCore instead of vjCore
    const result = await enhancedVJCore.processMessage(
      message,
      userId,
      context
    );

    // Return rich response with action
    res.json({
      response: result.response,
      action: result.action,
      intent: result.intent,
      suggestions: result.suggestions || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// New endpoint for tracking selections
exports.trackSelection = async (req, res) => {
  try {
    const { userId, videoId, title, artist, accepted } = req.body;

    // Track in user memory
    await userMemory.trackUserBehavior(userId, {
      type: 'SONG_SELECTION',
      videoId,
      title,
      artist,
      accepted,
      timestamp: new Date()
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// New endpoint for metrics
exports.vjcoreMetrics = (req, res) => {
  try {
    const metrics = enhancedVJCore.getMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
*/

// ============================================================================
// STEP 9: User Experience Flow
// ============================================================================

/*
FLOW 1: Simple Song Search
User types: "play rangrez"
    ↓
VJChat sends to /api/chat
    ↓
EnhancedVJCore processes:
  1. Intent: PLAY_SUGGESTED_SONG
  2. Cache: MISS
  3. Search: Found in DB
  4. Rank: Score 0.98
    ↓
Response: {
  response: "🎵 Playing: Rangrez by Arijit Singh",
  action: { type: 'PLAY_EXTERNAL', videoId: 'xyz' },
  intent: 'PLAY_SUGGESTED_SONG'
}
    ↓
Frontend executes action:
  1. Displays message
  2. Calls playVideo('xyz')
  3. Video starts playing immediately ✅

---

FLOW 2: Multi-Option Suggestion
User types: "happy songs"
    ↓
VJChat sends to /api/chat
    ↓
EnhancedVJCore processes:
  1. Intent: SEARCH_SONG
  2. Cache: MISS
  3. Semantic Search: Find happy songs
  4. Rank: Top 3 by score
    ↓
Response: {
  response: "## 🎵 Happy Vibes\n\n[Song1](play:id1)\n[Song2](play:id2)\n[Song3](play:id3)",
  action: { type: 'SHOW_OPTIONS', suggestions: [...] },
  suggestions: [
    { title: 'Song1', videoId: 'id1' },
    { title: 'Song2', videoId: 'id2' },
    { title: 'Song3', videoId: 'id3' }
  ]
}
    ↓
Frontend renders:
  1. Heading: "Happy Vibes"
  2. Three clickable buttons (styled)
    ↓
User clicks button:
  1. Calls handleSuggestionClick()
  2. Tracks selection: accepted=true
  3. Plays video
  4. Learns preference ✅

---

FLOW 3: Learning Over Time
Session 1:
  User accepts 3 Arijit Singh songs
  Learn: User loves Arijit Singh
    ↓
Session 2:
  User searches "sad songs"
  System suggests: Arijit Singh first
  User: "Yes this is perfect!"
  Learn: Preference confirmed
    ↓
Session 3:
  User says "similar songs"
  System suggests: More Arijit Singh
  (Personalized based on learning!)
*/

// ============================================================================
// FINAL CHECKLIST
// ============================================================================

/*
Frontend Integration Checklist:

□ Update chat handler to send context (currentSong, userPreferences)
□ Update API endpoint to use EnhancedVJCore
□ Create executeAction() function
□ Create handleSuggestionClick() function
□ Update renderMessageContent() for clickable options
□ Update CSS for .vj-msg-option styling
□ Create trackUserPreference() function
□ Create backend endpoints for tracking
□ Test with sample messages
□ Monitor cache hit rate
□ Deploy to production
□ Gather user feedback
*/
