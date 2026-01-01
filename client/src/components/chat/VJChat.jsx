/**
 * VJChat - Minimal VJ Assistant Chat Component
 * 
 * SIMPLIFIED:
 * - Single persona: DJ Desi
 * - Only high-accuracy quick actions
 * - Clean, minimal UI
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { sendMessage } from '../../services/chatService';
import './VJChat.css';

// Single VJ Persona
const VJ = { name: 'DJ Desi', avatar: '🎧' };

// Only high-accuracy quick actions
const QUICK_ACTIONS = [
  { id: 'playing', label: "🎵 What's playing?", message: "What song is playing?" },
  { id: 'channels', label: '📺 Channels', message: 'What channels do you have?' },
  { id: 'trivia', label: '🎯 Trivia', message: 'Give me a trivia!' }
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
  isVisible = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
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

  // Add welcome message when opened
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMsg = currentVideo?.title 
        ? `${VJ.avatar} Hey! I'm ${VJ.name}. You're watching "${currentVideo.title}". Ask me anything!`
        : `${VJ.avatar} Hey! I'm ${VJ.name}, your DesiTV VJ! Try the buttons below or just ask!`;
      setMessages([{ role: 'assistant', content: welcomeMsg }]);
    }
  }, [isOpen, messages.length, currentVideo?.title]);

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
      
      case 'PLAY_EXTERNAL':
        // Play external YouTube video on main TV
        console.log('[VJChat] Playing external YouTube on TV:', action.videoId);
        if (onPlayExternal) {
          onPlayExternal({
            videoId: action.videoId,
            videoTitle: action.videoTitle,
            thumbnail: action.thumbnail,
            channel: action.channel
          });
        }
        break;
      
      default:
        console.log('[VJChat] Unknown action:', action.type);
    }
  }, [onChangeChannel, onPlayVideo, onPlayExternal, channels]);

  const handleSend = useCallback(async (text = inputValue) => {
    if (!text.trim() || isLoading) return;

    const userMessage = text.trim();
    setInputValue('');
    setShowQuickActions(false);
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Build context
      const context = {
        currentChannel,
        currentChannelId,
        currentVideo: currentVideo ? {
          title: currentVideo.title,
          duration: currentVideo.duration,
          youtubeId: currentVideo.youtubeId || currentVideo.id
        } : null,
        nextVideo: nextVideo ? { title: nextVideo.title } : null,
        currentVideoIndex,
        totalVideos
      };
      
      console.log('[VJChat] Sending:', { message: userMessage, context });
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
  }, [inputValue, isLoading, currentChannel, currentChannelId, currentVideo, nextVideo, currentVideoIndex, totalVideos, executeAction]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (action) => {
    handleSend(action.message);
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
              <span className="vj-avatar">{VJ.avatar}</span>
              <div className="vj-header-text">
                <span className="vj-title">{VJ.name}</span>
                <span className="vj-status">● LIVE</span>
              </div>
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
              <div key={idx} className={`vj-message ${msg.role}`}>
                {msg.role === 'assistant' && (
                  <span className="vj-msg-avatar">{VJ.avatar}</span>
                )}
                <div className="vj-msg-content">{msg.content}</div>
              </div>
            ))}
            {isLoading && (
              <div className="vj-message assistant">
                <span className="vj-msg-avatar">{VJ.avatar}</span>
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
                >
                  {action.label}
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
              placeholder="Ask DJ Desi anything..."
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
      <button
        className={`vj-toggle-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Ask DJ Desi"
        aria-label="Toggle VJ Chat"
      >
        <span className="vj-btn-icon">{VJ.avatar}</span>
        {!isOpen && <span className="vj-btn-pulse"></span>}
      </button>
    </div>
  );
};

export default VJChat;
