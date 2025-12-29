/**
 * useCategoryNavigation Hook
 * 
 * Manages category (playlist) selection and navigation.
 * Extracted from Home.jsx for better separation of concerns.
 */

import { useState, useRef, useCallback } from 'react';
import { broadcastStateManager } from '../logic/broadcast';
import { checksumSyncService } from '../services/checksumSync';

export function useCategoryNavigation(categories = []) {
  const [selectedCategory, setSelectedCategoryState] = useState(null);
  const currentCategoryIndexRef = useRef(-1);
  const categoryChangeTimeoutRef = useRef(null);
  const isChangingCategoryRef = useRef(false);

  /**
   * Set selected category and load its videos
   * Updates broadcast state and disables manual mode (returns to LIVE)
   * @param {string|Object} categoryNameOrObject - Category name string or category object
   * @param {Function} onCategoryChange - Optional callback when category changes
   */
  const setCategory = useCallback((categoryNameOrObject, onCategoryChange) => {
    // Support both string (category name) and object (category object)
    const categoryName = typeof categoryNameOrObject === 'string' 
      ? categoryNameOrObject 
      : categoryNameOrObject?.name;
    
    // If object passed, use it directly; otherwise find by name
    const category = typeof categoryNameOrObject === 'object' && categoryNameOrObject
      ? categoryNameOrObject
      : categories.find((cat) => cat.name === categoryName);
    if (!category) {
      console.warn(`[useCategoryNavigation] Category not found: ${categoryName}`);
      return;
    }

    // Update ref immediately for synchronous access (before state update)
    const categoryIndex = categories.findIndex((cat) => cat._id === category._id);
    if (categoryIndex === -1) {
      console.warn(`[useCategoryNavigation] Category index not found for: ${categoryName}`);
      return;
    }

    // CRITICAL: Always update ref to keep it in sync
    currentCategoryIndexRef.current = categoryIndex;
    console.log(`[useCategoryNavigation] Setting category: ${categoryName} at index ${categoryIndex} (total: ${categories.length})`);

    // Initialize channel state FIRST, then disable manual mode
    try {
      broadcastStateManager.initializeChannel(category);
      broadcastStateManager.setManualMode(category._id, false);

      // Clear manual mode for old category if different
      const previousCategory = selectedCategory;
      if (previousCategory && previousCategory._id !== category._id) {
        broadcastStateManager.setManualMode(previousCategory._id, false);
      }

      // Only sync epoch if not in manual mode (manual mode should stay independent)
      // Category change already disabled manual mode above, so safe to sync
      broadcastStateManager.initializeGlobalEpoch(true).catch((error) => {
        console.warn('[useCategoryNavigation] ⚠️ Global epoch refresh failed:', error);
      });
      // Trigger sync only after manual mode is disabled (now in LIVE mode)
      checksumSyncService.triggerFastSync();
    } catch (error) {
      console.error('[useCategoryNavigation] Error initializing category state:', error);
    }

    setSelectedCategoryState(category);

    // Calculate and jump to live timeline position
    let calculatedVideoIndex = 0;
    try {
      const position = broadcastStateManager.calculateCurrentPosition(category);
      if (position && position.videoIndex >= 0) {
        calculatedVideoIndex = position.videoIndex;
        broadcastStateManager.jumpToVideo(
          category._id,
          position.videoIndex,
          position.offset,
          category.items
        );
      }
    } catch (error) {
      console.error('[useCategoryNavigation] Error calculating position:', error);
    }

    // Callback to notify parent component
    if (onCategoryChange) {
      onCategoryChange({
        category,
        categoryIndex,
        calculatedVideoIndex,
      });
    }

    console.log(`[useCategoryNavigation] Selected category: ${categoryName} with ${category.items?.length || 0} videos`);
  }, [categories, selectedCategory]);

  /**
   * Navigate to next category (with debouncing to prevent rapid switching)
   */
  const handleCategoryUp = useCallback((onCategoryChange) => {
    if (categories.length === 0) return;
    if (isChangingCategoryRef.current) {
      console.log('[useCategoryNavigation] Category change already in progress, ignoring...');
      return;
    }

    // Clear any pending category change
    if (categoryChangeTimeoutRef.current) {
      clearTimeout(categoryChangeTimeoutRef.current);
    }

    // Use ref for immediate, synchronous access (fixes race condition)
    let currentIndex = currentCategoryIndexRef.current;

    // Fallback: if ref is invalid, find from selectedCategory
    if (currentIndex === -1 || currentIndex >= categories.length) {
      currentIndex = categories.findIndex((cat) => cat._id === selectedCategory?._id);
      if (currentIndex === -1) {
        currentIndex = 0;
        currentCategoryIndexRef.current = 0;
      } else {
        currentCategoryIndexRef.current = currentIndex;
      }
    }

    // Switch to next category (wrap around)
    const nextIndex = (currentIndex + 1) % categories.length;
    const nextCategory = categories[nextIndex];

    if (!nextCategory || nextCategory._id === selectedCategory?._id) {
      return;
    }

    console.log(`[useCategoryNavigation] Category UP: ${currentIndex} -> ${nextIndex} (${nextCategory.name})`);

    // Mark as changing
    isChangingCategoryRef.current = true;

    // Update ref immediately for next click (before setCategory)
    currentCategoryIndexRef.current = nextIndex;

    // Debounce the actual category change
    categoryChangeTimeoutRef.current = setTimeout(() => {
      setCategory(nextCategory.name, onCategoryChange);
      // Reset flag after state update completes
      setTimeout(() => {
        isChangingCategoryRef.current = false;
      }, 300);
    }, 50); // Small delay to batch rapid clicks
  }, [categories, selectedCategory, setCategory]);

  /**
   * Navigate to previous category (with debouncing)
   */
  const handleCategoryDown = useCallback((onCategoryChange) => {
    if (categories.length === 0) return;
    if (isChangingCategoryRef.current) {
      console.log('[useCategoryNavigation] Category change already in progress, ignoring...');
      return;
    }

    // Clear any pending category change
    if (categoryChangeTimeoutRef.current) {
      clearTimeout(categoryChangeTimeoutRef.current);
    }

    // Use ref for immediate, synchronous access
    let currentIndex = currentCategoryIndexRef.current;

    // Fallback: if ref is invalid, find from selectedCategory
    if (currentIndex === -1 || currentIndex >= categories.length) {
      currentIndex = categories.findIndex((cat) => cat._id === selectedCategory?._id);
      if (currentIndex === -1) {
        currentIndex = 0;
        currentCategoryIndexRef.current = 0;
      } else {
        currentCategoryIndexRef.current = currentIndex;
      }
    }

    // Switch to previous category (wrap around)
    const prevIndex = currentIndex === 0
      ? categories.length - 1
      : currentIndex - 1;
    const prevCategory = categories[prevIndex];

    if (!prevCategory || prevCategory._id === selectedCategory?._id) {
      return;
    }

    console.log(`[useCategoryNavigation] Category DOWN: ${currentIndex} -> ${prevIndex} (${prevCategory.name})`);

    // Mark as changing
    isChangingCategoryRef.current = true;

    // Update ref immediately for next click (before setCategory)
    currentCategoryIndexRef.current = prevIndex;

    // Debounce the actual category change
    categoryChangeTimeoutRef.current = setTimeout(() => {
      setCategory(prevCategory.name, onCategoryChange);
      // Reset flag after state update completes
      setTimeout(() => {
        isChangingCategoryRef.current = false;
      }, 300);
    }, 50); // Small delay to batch rapid clicks
  }, [categories, selectedCategory, setCategory]);

  return {
    selectedCategory,
    currentCategoryIndexRef,
    setCategory,
    handleCategoryUp,
    handleCategoryDown,
    setSelectedCategory: setSelectedCategoryState, // Direct setter for initialization
  };
}

