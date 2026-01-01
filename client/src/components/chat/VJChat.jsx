/**
 * VJChat - Retro TV VJ Assistant Chat Component
 * 
 * A creative, theme-matching chat interface styled like a retro TV overlay
 * Appears as a small VJ button that expands into a chat bubble
 * Supports actions: channel changes, video playback, etc.
 * 
 * ARCHITECTURE:
 * - Receives FULL context from parent (current video, channel, playlist)
 * - Sends context with every message to server
 * - Server uses context for accurate "what's playing" responses
 * - Server returns actions for channel/video changes
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { sendMessage, getSuggestions } from '../../services/chatService';
import './VJChat.css';

const VJChat = ({ 
  // Current state from parent
  currentChannel,           // Channel name (string)
  currentChannelId,         // Channel ID for actions
  currentVideo,             // Current video object {title, artist, youtubeId, duration}
  currentVideoIndex,        // Index in playlist (number)
  totalVideos,              // Total videos in current channel
  
  // Available data
  channels = [],            // All available channels [{_id, name, items}]
  
  // Action handlers
  onChangeChannel,          // (channel) => void
  onPlayVideo,              // ({channelId, videoIndex}) => void
  
  // UI state
  isVisible = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load suggestions on mount
  useEffect(() => {
    getSuggestions().then(setSuggestions).catch(() => {});
  }, []);

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

  // Add welcome message when opened for first time
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMsg = currentVideo?.title 
        ? `Hey yaar! 🎙️ I see you're watching "${currentVideo.title}" on ${currentChannel}! Ask me anything - switch channels, find songs, or get recommendations!`
        : 'Hey yaar! 🎙️ DesiTV VJ here! Ask me to switch channels, find songs, or get mood-based recommendations!';
      setMessages([{ role: 'assistant', content: welcomeMsg }]);
    }
  }, [isOpen, messages.length, currentVideo?.title, currentChannel]);

  /**
   * Execute action from AI response
   */
  const executeAction = useCallback((action) => {
    if (!action) return;

    console.log('[VJChat] Executing action:', action);

    switch (action.type) {
      case 'CHANGE_CHANNEL':
        if (onChangeChannel) {
          // Find channel from available channels or use ID
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
        } else if (onChangeChannel) {
          // Fallback: at least change to the right channel
          const channel = channels.find(ch => ch._id === action.channelId);
          onChangeChannel(channel || { _id: action.channelId, name: action.channelName });
        }
        break;
      
      default:
        console.log('[VJChat] Unknown action type:', action.type);
    }
  }, [onChangeChannel, onPlayVideo, channels]);

  const handleSend = useCallback(async (text = inputValue) => {
    if (!text.trim() || isLoading) return;

    const userMessage = text.trim();
    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Build FULL context to send to server
      const context = {
        // Current playback state
        currentChannel,
        currentChannelId,
        currentVideo: currentVideo ? {
          title: currentVideo.title,
          artist: currentVideo.artist || currentVideo.channelTitle,
          duration: currentVideo.duration,
          youtubeId: currentVideo.youtubeId || currentVideo.id
        } : null,
        currentVideoIndex,
        totalVideos,
        
        // Available channels (names only to reduce payload)
        availableChannels: channels.map(ch => ({ id: ch._id, name: ch.name }))
      };
      
      console.log('[VJChat] Sending with context:', context);
      const result = await sendMessage(userMessage, context);
      console.log('[VJChat] Response:', result);
      
      setMessages(prev => [...prev, { role: 'assistant', content: result.response }]);
      
      // Execute any action returned by the AI
      if (result.action) {
        console.log('[VJChat] Executing action:', result.action);
        executeAction(result.action);
      }
    } catch (error) {
      console.error('[VJChat] Error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: error.message || 'Oops! Technical glitch 📺 Try again?' 
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, currentChannel, currentChannelId, currentVideo, currentVideoIndex, totalVideos, channels, executeAction]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (suggestion) => {
    handleSend(suggestion);
  };

  if (!isVisible) return null;

  return (
    <div className={`vj-chat-container ${isOpen ? 'open' : ''}`}>
      {/* Chat Window */}
      {isOpen && (
        <div className="vj-chat-window">
          {/* Header */}
          <div className="vj-chat-header">
            <div className="vj-header-info">
              <span className="vj-avatar">🎙️</span>
              <span className="vj-title">VJ Assistant</span>
              <span className="vj-status">● LIVE</span>
            </div>
            <button 
              className="vj-close-btn" 
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="vj-chat-messages">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`vj-message ${msg.role}`}
              >
                {msg.role === 'assistant' && <span className="vj-msg-avatar">🎙️</span>}
                <div className="vj-msg-content">{msg.content}</div>
              </div>
            ))}
            {isLoading && (
              <div className="vj-message assistant">
                <span className="vj-msg-avatar">🎙️</span>
                <div className="vj-msg-content vj-typing">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          {messages.length <= 2 && suggestions.length > 0 && (
            <div className="vj-suggestions">
              {suggestions.slice(0, 3).map((sug, idx) => (
                <button 
                  key={idx}
                  className="vj-suggestion-chip"
                  onClick={() => handleSuggestionClick(sug)}
                >
                  {sug}
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
              placeholder="Ask VJ anything..."
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

      {/* VJ Toggle Button - Retro mic style */}
      <button
        className={`vj-toggle-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Ask VJ Assistant"
        aria-label="Toggle VJ Chat"
      >
        <span className="vj-btn-icon">🎙️</span>
        {!isOpen && <span className="vj-btn-pulse"></span>}
      </button>
    </div>
  );
};

export default VJChat;
