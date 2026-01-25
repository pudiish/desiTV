/**
 * VJChat - Netflix-Grade AI Assistant Chat
 * 
 * DESIGN PRINCIPLES:
 * - Clean, minimal interface (only essential UI)
 * - Fast response feedback
 * - Focus on experimentation & understanding
 * - App-integrated styling (matches DesiTV aesthetic)
 * - Progressive disclosure (more features as needed)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { sendMessage } from '../../services/chatService';
import './VJChat.css';

// DesiAgent - AI Assistant for DesiTV
const DesiAgent = { name: 'DesiAgent', avatar: '🤖', color: '#d4a574' };

// High-confidence actions for instant response
const QUICK_ACTIONS = [
  { id: 'playing', label: "What's playing?", message: "What song is playing?", icon: '🎵' },
  { id: 'channels', label: 'Channels', message: 'What channels do you have?', icon: '📺' },
  { id: 'trivia', label: 'Trivia', message: 'Give me a trivia!', icon: '🎯' }
];

const VJChat = ({ 
  currentChannel,
  currentChannelId,
  currentVideo,
  nextVideo,
  currentVideoIndex,
  totalVideos,
  channels = [],
  onChangeChannel,
  onPlayVideo,
  onPlayExternal, // YouTube external video handler
  onGoLive, // NEW: Go live handler
  mode = 'live', // NEW: Current playback mode
  isPlaying = false, // NEW: Is video playing
  isVisible = true,
  isOpen: externalIsOpen, // Controlled state
  onToggle, // Controlled toggle handler
  showToggle = true // Whether to show the built-in toggle button
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  
  // Determine effective state (controlled vs uncontrolled)
  const isControlled = externalIsOpen !== undefined;
  const isOpen = isControlled ? externalIsOpen : internalIsOpen;
  
  const handleToggle = () => {
    if (isControlled && onToggle) {
      onToggle(!isOpen);
    } else {
      setInternalIsOpen(!isOpen);
    }
  };

  const handleClose = () => {
    if (isControlled && onToggle) {
      onToggle(false);
    } else {
      setInternalIsOpen(false);
    }
  };

  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Add welcome message when opened - use reliable video source
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Use currentVideo from props (which now comes from reliable source in Home.jsx)
      const videoTitle = currentVideo?.title;
      const welcomeMsg = videoTitle 
        ? `${DesiAgent.avatar} Hey! I'm ${DesiAgent.name}. You're watching "${videoTitle}". Ask me anything!`
        : `${DesiAgent.avatar} Yo! I'm ${DesiAgent.name}, your AI sidekick on DesiTV! Try the buttons below or drop a command!`;
      setMessages([{ role: 'assistant', content: welcomeMsg }]);
    }
  }, [isOpen, messages.length, currentVideo]);

  // Execute action from response
  const executeAction = useCallback((action) => {
    if (!action) return;
    console.log('[VJChat] Executing action:', action);

    switch (action.type) {
      case 'CHANGE_CHANNEL':
        if (onChangeChannel) {
          const channel = channels.find(
            ch => ch._id === action.channelId || 
                  ch.name?.toLowerCase() === action.channelName?.toLowerCase()
          );
          onChangeChannel(channel || { _id: action.channelId, name: action.channelName });
        }
        break;
      
      case 'PLAY_VIDEO':
        if (onPlayVideo) {
          onPlayVideo({
            channelId: action.channelId,
            channelName: action.channelName,
            videoIndex: action.videoIndex,
            videoTitle: action.videoTitle
          });
        }
        break;
      
      case 'PLAY_YOUTUBE':
      case 'PLAY_EXTERNAL':
        // Play external YouTube video on main TV
        console.log('[VJChat] Playing YouTube video on TV:', action.videoId);
        // Validate videoId is a string, not an object
        const validVideoId = typeof action.videoId === 'string' ? action.videoId : null;
        if (!validVideoId) {
          console.error('[VJChat] Invalid videoId passed to PLAY_YOUTUBE/PLAY_EXTERNAL:', action.videoId);
          return;
        }
        if (onPlayExternal) {
          onPlayExternal({
            videoId: validVideoId,
            videoTitle: action.videoTitle || 'Unknown',
            thumbnail: action.thumbnail,
            channel: action.channel
          });
        }
        break;
      
      case 'SHOW_OPTIONS':
        // Show multiple search result options
        console.log('[VJChat] Showing search options:', action.suggestions);
        if (action.suggestions && action.suggestions.length > 0) {
          // Create clickable options - truncate titles for clean display
          const truncate = (str, maxLen = 40) => str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
          const optionsContent = action.suggestions
            .slice(0, 5)
            .map(s => `[🎵 ${truncate(s.title)}](play:${s.id || s.videoId})`)
            .join('\n\n');
            
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: optionsContent
          }]);
        }
        break;
      
      case 'GO_LIVE':
        // Return to live/timeline mode
        console.log('[VJChat] Going LIVE - returning to broadcast timeline');
        if (onGoLive) {
          onGoLive(action.channelId);
        }
        break;
      
      default:
        console.log('[VJChat] Unknown action:', action.type);
    }
  }, [onChangeChannel, onPlayVideo, onPlayExternal, onGoLive, channels]);

  const handleSend = useCallback(async (text = inputValue) => {
    if (!text.trim() || isLoading) return;

    const userMessage = text.trim();
    setInputValue('');
    setShowQuickActions(false);
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Build enriched context for backend - use reliable video source
      // Ensure we always send what's ACTUALLY playing, not stale state
      const reliableVideo = currentVideo ? {
        title: currentVideo.title || 'Unknown',
        duration: currentVideo.duration || 0,
        youtubeId: currentVideo.youtubeId || currentVideo.id || null,
        videoId: currentVideo.youtubeId || currentVideo.id || null, // Alias for compatibility
        thumbnail: currentVideo.thumbnail || null
      } : null;
      
      const context = {
        currentChannel,
        currentChannelId,
        currentVideo: reliableVideo,
        nextVideo: nextVideo ? { 
          title: nextVideo.title || 'Unknown',
          youtubeId: nextVideo.youtubeId || nextVideo.id || null
        } : null,
        currentVideoIndex,
        totalVideos,
        mode, // 'live' | 'manual' | 'external'
        isPlaying,
        // Add timestamp to help backend detect stale data
        timestamp: Date.now()
      };
      
      console.log('[VJChat] Sending:', { 
        message: userMessage, 
        context: {
          ...context,
          currentVideo: reliableVideo ? {
            title: reliableVideo.title,
            youtubeId: reliableVideo.youtubeId,
            source: currentVideo?.source || 'unknown'
          } : null
        }
      });
      const result = await sendMessage(userMessage, context);
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: result.response
      }]);
      
      if (result.action) {
        executeAction(result.action);
      }
    } catch (error) {
      console.error('[VJChat] Error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: error.message || 'Oops! Try again? 😅'
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, currentChannel, currentChannelId, currentVideo, nextVideo, currentVideoIndex, totalVideos, mode, isPlaying, executeAction]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (action) => {
    handleSend(action.message);
  };

  // Parse markdown for clickable options
  const parseMessageContent = (content) => {
    if (typeof content !== 'string') return content;
    
    // Check for clickable option format: [🎵 Song Name - Artist](play:video-id)
    const optionRegex = /\[([^\]]+)\]\(play:([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = optionRegex.exec(content)) !== null) {
      // Add text before link
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: content.substring(lastIndex, match.index)
        });
      }
      
      // Add clickable option
      const [, label, videoId] = match;
      parts.push({
        type: 'option',
        label,
        videoId
      });
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < content.length) {
      parts.push({
        type: 'text',
        content: content.substring(lastIndex)
      });
    }
    
    return parts.length > 0 ? parts : [{ type: 'text', content }];
  };

  // Parse markdown formatting
  const parseMarkdownLine = (line) => {
    if (!line) return <br key={Math.random()} />;

    // Headings: # Title → <h3>, ## Title → <h4>, ### Title → <h5>
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingLevel = 2 + level; // # = h3, ## = h4, ### = h5
      const HeadingTag = `h${headingLevel}`;
      return (
        <HeadingTag key={Math.random()} className="vj-msg-heading">
          {parseInlineMarkdown(headingMatch[2])}
        </HeadingTag>
      );
    }

    // Dividers: --- or ===
    if (/^[-=]{3,}$/.test(line)) {
      return <hr key={Math.random()} className="vj-msg-divider" />;
    }

    // Unordered lists: -, *, or +
    const listMatch = line.match(/^[\s]*[-*+]\s+(.+)$/);
    if (listMatch) {
      return (
        <li key={Math.random()} className="vj-msg-list-item">
          {parseInlineMarkdown(listMatch[1])}
        </li>
      );
    }

    // Ordered lists: 1., 2., etc.
    const orderedMatch = line.match(/^[\s]*\d+\.\s+(.+)$/);
    if (orderedMatch) {
      return (
        <li key={Math.random()} className="vj-msg-list-item">
          {parseInlineMarkdown(orderedMatch[1])}
        </li>
      );
    }

    // Regular paragraph with inline markdown
    return (
      <span key={Math.random()}>
        {parseInlineMarkdown(line)}
      </span>
    );
  };

  // Parse inline markdown: **bold**, *italic*, `code`
  const parseInlineMarkdown = (text) => {
    const parts = [];
    let lastIndex = 0;
    
    // Match **bold**, *italic*, `code`, and [links](url)
    const regex = /(\*\*[^\*]+\*\*|\*[^\*]+\*|`[^`]+`|\[[^\]]+\]\([^\)]+\))/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      const matched = match[0];
      
      // Bold: **text**
      if (matched.startsWith('**') && matched.endsWith('**')) {
        parts.push(
          <strong key={match.index} className="vj-msg-bold">
            {matched.slice(2, -2)}
          </strong>
        );
      }
      // Italic: *text*
      else if (matched.startsWith('*') && matched.endsWith('*')) {
        parts.push(
          <em key={match.index} className="vj-msg-italic">
            {matched.slice(1, -1)}
          </em>
        );
      }
      // Code: `text`
      else if (matched.startsWith('`') && matched.endsWith('`')) {
        parts.push(
          <code key={match.index} className="vj-msg-code">
            {matched.slice(1, -1)}
          </code>
        );
      }

      lastIndex = match.index + matched.length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  // Parse option label to extract title, channel, duration
  const parseOptionLabel = (label) => {
    // Remove emoji prefixes and clean up
    const cleanLabel = label.replace(/^[🎵📺🎯⭐✨1️⃣2️⃣3️⃣4️⃣5️⃣]*\s*/g, '').trim();
    
    // Try to extract parts: "Title • Channel • Duration" or "Title - Artist"
    const bulletParts = cleanLabel.split(' • ');
    if (bulletParts.length >= 2) {
      return {
        title: bulletParts[0].trim(),
        channel: bulletParts[1]?.trim() || '',
        duration: bulletParts[2]?.trim() || ''
      };
    }
    
    // Fallback: just use the whole label as title
    return { title: cleanLabel, channel: '', duration: '' };
  };

  const renderMessageContent = (content) => {
    const parts = parseMessageContent(content);
    
    // Check if this message contains options
    const options = parts.filter(p => p.type === 'option');
    const hasOptions = options.length > 0;
    const hasOnlyOptions = parts.every(p => p.type === 'option' || (p.type === 'text' && !p.content.trim()));
    
    if (hasOnlyOptions && options.length > 0) {
      // Render as clean options list with badges
      return (
        <div className="vj-options-list">
          {options.map((part, idx) => {
            const parsed = parseOptionLabel(part.label);
            const isFirst = idx === 0;
            
            return (
              <button
                key={idx}
                className="vj-msg-option"
                onClick={() => {
                  const videoAction = {
                    type: 'PLAY_EXTERNAL',
                    videoId: part.videoId,
                    videoTitle: parsed.title
                  };
                  executeAction(videoAction);
                  setInputValue('');
                  // Add confirmation message
                  setMessages(prev => [...prev, { 
                    role: 'assistant', 
                    content: `▶️ Playing: **${parsed.title}**` 
                  }]);
                }}
                title={`Play: ${parsed.title}`}
              >
                <div className="vj-option-info">
                  <span className="vj-option-title">{parsed.title}</span>
                  {(parsed.channel || parsed.duration) && (
                    <span className="vj-option-meta">
                      {parsed.channel}{parsed.channel && parsed.duration ? ' • ' : ''}{parsed.duration}
                    </span>
                  )}
                </div>
                {isFirst && <span className="vj-option-badge">Best</span>}
              </button>
            );
          })}
        </div>
      );
    }
    
    return parts.map((part, idx) => {
      if (part.type === 'text') {
        // Split by newlines and parse markdown formatting
        const lines = part.content.split('\n');
        return (
          <div key={idx} className="vj-msg-text">
            {lines.map((line, lineIdx) => (
              <React.Fragment key={lineIdx}>
                {parseMarkdownLine(line)}
                {lineIdx < lines.length - 1 && <div style={{ height: '4px' }} />}
              </React.Fragment>
            ))}
          </div>
        );
      } else if (part.type === 'option') {
        const parsed = parseOptionLabel(part.label);
        
        return (
          <button
            key={idx}
            className="vj-msg-option"
            onClick={() => {
              const videoAction = {
                type: 'PLAY_EXTERNAL',
                videoId: part.videoId,
                videoTitle: parsed.title
              };
              executeAction(videoAction);
              setInputValue('');
            }}
            title={`Play: ${parsed.title}`}
          >
            <div className="vj-option-info">
              <span className="vj-option-title">{parsed.title}</span>
              {(parsed.channel || parsed.duration) && (
                <span className="vj-option-meta">
                  {parsed.channel}{parsed.channel && parsed.duration ? ' • ' : ''}{parsed.duration}
                </span>
              )}
            </div>
          </button>
        );
      }
      return null;
    });
  };

  if (!isVisible) return null;

  // Get current video title for Now Playing banner - use reliable source
  // currentVideo prop now comes from playbackInfo (source of truth) in Home.jsx
  const nowPlayingTitle = currentVideo?.title || null;
  const nowPlayingChannel = currentChannel || 'DesiTV';

  return (
    <div className={`vj-chat-container ${isOpen ? 'open' : ''}`}>
      {/* Chat Window */}
      {isOpen && (
        <div className="vj-chat-window">
          {/* Header */}
          <div className="vj-chat-header">
            <div className="vj-header-info">
              <span className="vj-avatar">{DesiAgent.avatar}</span>
              <div className="vj-header-text">
                <span className="vj-title">{DesiAgent.name}</span>
                <span className="vj-status">LIVE</span>
              </div>
            </div>
            <button 
              className="vj-close-btn" 
              onClick={handleClose}
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>
          
          {/* Now Playing Banner */}
          {nowPlayingTitle && (
            <div className="vj-now-playing">
              <span className="vj-now-playing-icon">🎵</span>
              <div className="vj-now-playing-text">
                <div className="vj-now-playing-label">Now Playing on {nowPlayingChannel}</div>
                <div className="vj-now-playing-title">{nowPlayingTitle}</div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="vj-chat-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`vj-message ${msg.role}`}>
                {msg.role === 'assistant' && (
                  <span className="vj-msg-avatar">{DesiAgent.avatar}</span>
                )}
                <div className="vj-msg-content">
                  {renderMessageContent(msg.content)}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="vj-message assistant">
                <span className="vj-msg-avatar">{DesiAgent.avatar}</span>
                <div className="vj-msg-content vj-typing">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          {showQuickActions && messages.length <= 2 && (
            <div className="vj-quick-actions">
              {QUICK_ACTIONS.map(action => (
                <button 
                  key={action.id}
                  className="vj-quick-action-btn"
                  onClick={() => handleQuickAction(action)}
                  title={action.label}
                >
                  <span className="icon">{action.icon}</span>
                  <span className="label">{action.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="vj-chat-input">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask DesiAgent..."
              disabled={isLoading}
              maxLength={200}
            />
            <button 
              className="vj-send-btn"
              onClick={() => handleSend()}
              disabled={!inputValue.trim() || isLoading}
            >
              ➤
            </button>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      {showToggle && (
        <button
          className={`vj-toggle-btn ${isOpen ? 'active' : ''}`}
          onClick={handleToggle}
          title="Ask DesiAgent"
          aria-label="Toggle DesiAgent Chat"
        >
          <span className="vj-btn-icon">{DesiAgent.avatar}</span>
          {!isOpen && <span className="vj-btn-pulse"></span>}
        </button>
      )}
    </div>
  );
};

export default VJChat;
