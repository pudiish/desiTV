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
const VJ = { name: 'DesiAgent', avatar: '🤖', color: '#d4a574' };

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
        : `${VJ.avatar} Yo! I'm ${VJ.name}, your AI sidekick on DesiTV! Try the buttons below or drop a command!`;
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
        // Validate videoId is a string, not an object
        const validVideoId = typeof action.videoId === 'string' ? action.videoId : null;
        if (!validVideoId) {
          console.error('[VJChat] Invalid videoId passed to PLAY_EXTERNAL:', action.videoId);
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
      // Build enriched context for backend
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
        totalVideos,
        mode, // 'live' | 'manual' | 'external'
        isPlaying
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

  const renderMessageContent = (content) => {
    const parts = parseMessageContent(content);
    
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
        return (
          <button
            key={idx}
            className="vj-msg-option"
            onClick={() => {
              // Extract video data from label if it contains it
              const videoAction = {
                type: 'PLAY_EXTERNAL',
                videoId: part.videoId,
                videoTitle: part.label.replace(/^[🎵📺🎯]*\s*/, '') // Remove emoji prefix
              };
              executeAction(videoAction);
              setInputValue('');
            }}
            title={`Play: ${part.label}`}
          >
            {part.label}
          </button>
        );
      }
    });
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
                <div className="vj-msg-content">
                  {renderMessageContent(msg.content)}
                </div>
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
      <button
        className={`vj-toggle-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Ask DesiAgent"
        aria-label="Toggle VJ Chat"
      >
        <span className="vj-btn-icon">{VJ.avatar}</span>
        {!isOpen && <span className="vj-btn-pulse"></span>}
      </button>
    </div>
  );
};

export default VJChat;
