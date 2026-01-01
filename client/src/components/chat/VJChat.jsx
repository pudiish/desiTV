/**
 * VJChat - Retro TV VJ Assistant Chat Component
 * 
 * Enhanced with:
 * - 4 VJ Personas (Bindaas, LateNight, Comedy, Retro)
 * - Quick action buttons (Trivia, Shayari, Throwback)
 * - Time-aware greetings
 * - Mood-based persona switching
 * 
 * ARCHITECTURE:
 * - Receives FULL context from parent (current video, channel, playlist)
 * - Sends context + persona with every message to server
 * - Server uses context for accurate responses + persona for personality
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { sendMessage, getSuggestions } from '../../services/chatService';
import './VJChat.css';

// VJ Persona definitions (mirrors server)
const PERSONAS = {
  bindaas: { id: 'bindaas', name: 'DJ Bindaas', avatar: '🎧', desc: 'Party Mode!' },
  latenight: { id: 'latenight', name: 'RJ Chaand', avatar: '🌙', desc: 'Late Night' },
  comedy: { id: 'comedy', name: 'Pappu VJ', avatar: '😂', desc: 'Comedy' },
  retro: { id: 'retro', name: 'Nostalgia Aunty', avatar: '📺', desc: 'Retro' }
};

// Quick action buttons
const QUICK_ACTIONS = [
  { id: 'trivia', label: '🎯 Trivia', message: 'Give me a trivia question!' },
  { id: 'shayari', label: '💕 Shayari', message: 'Share a romantic shayari' },
  { id: 'throwback', label: '📅 Throwback', message: 'This day in history' },
  { id: 'dedicate', label: '🎁 Dedicate', message: 'Dedicate a song to my friend' },
  { id: 'movie', label: '🎬 Movies', message: 'Movie memories' }
];

const VJChat = ({ 
  // Current state from parent
  currentChannel,
  currentChannelId,
  currentVideo,
  nextVideo,
  currentVideoIndex,
  totalVideos,
  
  // Available data
  channels = [],
  
  // Action handlers
  onChangeChannel,
  onPlayVideo,
  
  // UI state
  isVisible = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedPersona, setSelectedPersona] = useState('comedy'); // Default persona
  const [showQuickActions, setShowQuickActions] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Get time-appropriate default persona
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 5) {
      setSelectedPersona('latenight');
    } else if (hour >= 6 && hour < 12) {
      setSelectedPersona('bindaas');
    } else {
      // Channel-based selection
      const channelLower = (currentChannel || '').toLowerCase();
      if (channelLower.includes('retro') || channelLower.includes('gold')) {
        setSelectedPersona('retro');
      } else if (channelLower.includes('love') || channelLower.includes('night')) {
        setSelectedPersona('latenight');
      } else if (channelLower.includes('party') || channelLower.includes('club')) {
        setSelectedPersona('bindaas');
      }
    }
  }, [currentChannel]);

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
      const persona = PERSONAS[selectedPersona];
      const hour = new Date().getHours();
      let greeting = '';
      
      if (hour >= 5 && hour < 12) greeting = 'Good morning';
      else if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
      else if (hour >= 17 && hour < 21) greeting = 'Good evening';
      else greeting = 'Late night vibes';
      
      const welcomeMsg = currentVideo?.title 
        ? `${persona.avatar} ${greeting}! I'm ${persona.name}! You're watching "${currentVideo.title}" on ${currentChannel}. Ask me anything - trivia, shayari, song search, or mood recommendations!`
        : `${persona.avatar} ${greeting}! I'm ${persona.name}, your DesiTV VJ! Try the quick actions below or ask me anything!`;
      setMessages([{ role: 'assistant', content: welcomeMsg, persona: selectedPersona }]);
    }
  }, [isOpen, messages.length, currentVideo?.title, currentChannel, selectedPersona]);

  /**
   * Execute action from AI response
   */
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
        } else if (onChangeChannel) {
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
    setShowQuickActions(false); // Hide quick actions after first message
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
        nextVideo: nextVideo ? {
          title: nextVideo.title,
          artist: nextVideo.artist || nextVideo.channelTitle,
          duration: nextVideo.duration
        } : null,
        currentVideoIndex,
        totalVideos,
        
        // Persona preference
        persona: selectedPersona,
        
        // Available channels
        availableChannels: channels.map(ch => ({ id: ch._id, name: ch.name }))
      };
      
      console.log('[VJChat] Sending with context:', context);
      const result = await sendMessage(userMessage, context);
      console.log('[VJChat] Response:', result);
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: result.response,
        persona: selectedPersona 
      }]);
      
      // Execute any action returned by the AI
      if (result.action) {
        console.log('[VJChat] Executing action:', result.action);
        executeAction(result.action);
      }
    } catch (error) {
      console.error('[VJChat] Error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: error.message || 'Oops! Technical glitch 📺 Try again?',
        persona: selectedPersona
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, currentChannel, currentChannelId, currentVideo, nextVideo, currentVideoIndex, totalVideos, channels, executeAction, selectedPersona]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (action) => {
    handleSend(action.message);
  };

  const handlePersonaChange = (personaId) => {
    setSelectedPersona(personaId);
    const persona = PERSONAS[personaId];
    // Add persona switch message
    setMessages(prev => [...prev, { 
      role: 'system', 
      content: `${persona.avatar} Switched to ${persona.name}!`
    }]);
  };

  if (!isVisible) return null;

  const currentPersona = PERSONAS[selectedPersona];

  return (
    <div className={`vj-chat-container ${isOpen ? 'open' : ''}`}>
      {/* Chat Window */}
      {isOpen && (
        <div className="vj-chat-window">
          {/* Header */}
          <div className="vj-chat-header">
            <div className="vj-header-info">
              <span className="vj-avatar">{currentPersona.avatar}</span>
              <div className="vj-header-text">
                <span className="vj-title">{currentPersona.name}</span>
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

          {/* Persona Tabs */}
          <div className="vj-persona-tabs">
            {Object.values(PERSONAS).map(persona => (
              <button
                key={persona.id}
                className={`vj-persona-tab ${selectedPersona === persona.id ? 'active' : ''}`}
                onClick={() => handlePersonaChange(persona.id)}
                title={persona.desc}
              >
                {persona.avatar}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="vj-chat-messages">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`vj-message ${msg.role}`}
              >
                {msg.role === 'assistant' && (
                  <span className="vj-msg-avatar">
                    {PERSONAS[msg.persona]?.avatar || '🎙️'}
                  </span>
                )}
                {msg.role === 'system' ? (
                  <div className="vj-msg-system">{msg.content}</div>
                ) : (
                  <div className="vj-msg-content">{msg.content}</div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="vj-message assistant">
                <span className="vj-msg-avatar">{currentPersona.avatar}</span>
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

          {/* Suggestions */}
          {!showQuickActions && messages.length <= 4 && suggestions.length > 0 && (
            <div className="vj-suggestions">
              {suggestions.slice(0, 3).map((sug, idx) => (
                <button 
                  key={idx}
                  className="vj-suggestion-chip"
                  onClick={() => handleSend(sug)}
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
              placeholder={`Ask ${currentPersona.name} anything...`}
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

      {/* VJ Toggle Button */}
      <button
        className={`vj-toggle-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Ask VJ Assistant"
        aria-label="Toggle VJ Chat"
      >
        <span className="vj-btn-icon">{currentPersona.avatar}</span>
        {!isOpen && <span className="vj-btn-pulse"></span>}
      </button>
    </div>
  );
};

export default VJChat;
