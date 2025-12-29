/**
 * useChannelNavigation Hook
 * 
 * Manages channel (video) navigation within a category.
 * Extracted from Home.jsx for better separation of concerns.
 */

import { useState, useCallback } from 'react';
import { broadcastStateManager } from '../logic/broadcast';
import { analytics, performanceMonitor } from '../services/analytics';

export function useChannelNavigation(selectedCategory, videosInCategory = []) {
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const [videoSwitchTimestamp, setVideoSwitchTimestamp] = useState(Date.now());

  /**
   * Navigate to next video within selected category
   * Enables manual mode (user-controlled playback)
   */
  const handleChannelUp = useCallback((power, onSwitchComplete) => {
    if (!power || videosInCategory.length === 0 || !selectedCategory) {
      console.warn('[useChannelNavigation] Channel up blocked:', {
        power,
        videosCount: videosInCategory.length,
        hasCategory: !!selectedCategory,
      });
      return;
    }

    const startTime = performance.now();
    const fromChannel = activeVideoIndex;

    // Switch to next video within the selected category
    const nextIndex = (activeVideoIndex + 1) % videosInCategory.length;
    console.log(`[useChannelNavigation] Channel UP: ${activeVideoIndex} -> ${nextIndex}`);

    // Update state first
    setActiveVideoIndex(nextIndex);

    // Jump to this video in broadcast state (so Player plays it)
    try {
      broadcastStateManager.jumpToVideo(
        selectedCategory._id,
        nextIndex,
        0, // Start at beginning of video
        videosInCategory
      );
      // Enable manual mode (user manually switched)
      broadcastStateManager.setManualMode(selectedCategory._id, true);
      // Force Player to recalculate by updating timestamp
      const newTimestamp = Date.now();
      setVideoSwitchTimestamp(newTimestamp);
      console.log(`[useChannelNavigation] ✅ Jumped to video ${nextIndex}, manual mode enabled, timestamp: ${newTimestamp}`);
    } catch (error) {
      console.error('[useChannelNavigation] ❌ Error jumping to video:', error);
    }

    // Track analytics
    const switchTime = performanceMonitor.trackChannelSwitch(startTime);
    analytics.trackChannelChange('up', fromChannel, nextIndex, selectedCategory.name);
    analytics.trackPerformance('channel_switch_time', switchTime);

    if (onSwitchComplete) {
      onSwitchComplete(nextIndex);
    }
  }, [activeVideoIndex, videosInCategory, selectedCategory]);

  /**
   * Navigate to previous video within selected category
   * Enables manual mode (user-controlled playback)
   */
  const handleChannelDown = useCallback((power, onSwitchComplete) => {
    if (!power || videosInCategory.length === 0 || !selectedCategory) {
      console.warn('[useChannelNavigation] Channel down blocked:', {
        power,
        videosCount: videosInCategory.length,
        hasCategory: !!selectedCategory,
      });
      return;
    }

    // Switch to previous video within the selected category
    const newIndex = activeVideoIndex === 0
      ? videosInCategory.length - 1
      : activeVideoIndex - 1;
    console.log(`[useChannelNavigation] Channel DOWN: ${activeVideoIndex} -> ${newIndex}`);

    // Update state first
    setActiveVideoIndex(newIndex);

    // Jump to this video in broadcast state (so Player plays it)
    try {
      broadcastStateManager.jumpToVideo(
        selectedCategory._id,
        newIndex,
        0, // Start at beginning of video
        videosInCategory
      );
      // Enable manual mode (user manually switched)
      broadcastStateManager.setManualMode(selectedCategory._id, true);
      // Force Player to recalculate by updating timestamp
      setVideoSwitchTimestamp(Date.now());
      console.log(`[useChannelNavigation] ✅ Jumped to video ${newIndex}, manual mode enabled`);
    } catch (error) {
      console.error('[useChannelNavigation] ❌ Error jumping to video:', error);
    }

    if (onSwitchComplete) {
      onSwitchComplete(newIndex);
    }
  }, [activeVideoIndex, videosInCategory, selectedCategory]);

  /**
   * Navigate directly to a specific video index
   * Enables manual mode (user-controlled playback)
   */
  const handleChannelDirect = useCallback((index, power, onSwitchComplete) => {
    if (!power || videosInCategory.length === 0 || !selectedCategory) return;
    if (index < 0 || index >= videosInCategory.length) {
      return false; // Invalid index
    }

    // Jump to this video in broadcast state (so Player plays it)
    try {
      broadcastStateManager.jumpToVideo(
        selectedCategory._id,
        index,
        0, // Start at beginning of video
        videosInCategory
      );
      // Enable manual mode (user manually switched)
      broadcastStateManager.setManualMode(selectedCategory._id, true);
      // Force Player to recalculate by updating timestamp
      setVideoSwitchTimestamp(Date.now());
    } catch (error) {
      console.error('[useChannelNavigation] Error jumping to video:', error);
      return false;
    }

    setActiveVideoIndex(index);

    if (onSwitchComplete) {
      onSwitchComplete(index);
    }

    return true;
  }, [videosInCategory, selectedCategory]);

  return {
    activeVideoIndex,
    videoSwitchTimestamp,
    setActiveVideoIndex,
    setVideoSwitchTimestamp,
    handleChannelUp,
    handleChannelDown,
    handleChannelDirect,
  };
}


