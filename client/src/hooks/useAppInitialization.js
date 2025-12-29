/**
 * useAppInitialization Hook
 * 
 * Handles app initialization: loading categories, restoring session, setting up sync.
 * Extracted from Home.jsx for better separation of concerns.
 */

import { useState, useEffect, useRef } from 'react';
import { channelManager } from '../logic/channel';
import { broadcastStateManager } from '../logic/broadcast';
import { SessionManager } from '../services/storage';
import { checksumSyncService } from '../services/checksumSync';
import { clearEpochCache } from '../services/api/globalEpochService';
import { getTimeSuggestion } from '../utils/timeBasedProgramming';

export function useAppInitialization(onInitialized) {
  const [categories, setCategories] = useState([]);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [initializationError, setInitializationError] = useState(null);
  const initializationCompleteRef = useRef(false);

  useEffect(() => {
    const initializeApp = async () => {
      // Prevent multiple initializations
      if (initializationCompleteRef.current) {
        return;
      }

      try {
        // CRITICAL SYNC FIX: Clear all caches on reload for fresh sync
        console.log('[useAppInitialization] 🔄 Clearing caches for fresh sync...');
        broadcastStateManager.clearAll();
        clearEpochCache();
        localStorage.removeItem('desitv-global-epoch-cached');
        localStorage.removeItem('desitv-broadcast-state');

        // CRITICAL: Always fetch global epoch from server FIRST (for true sync)
        await broadcastStateManager.initializeGlobalEpoch(true);
        const epoch = broadcastStateManager.getGlobalEpoch();
        if (!epoch) {
          throw new Error('Failed to initialize global epoch');
        }
        console.log('[useAppInitialization] ✅ Global epoch from server:', epoch.toISOString());

        // Start periodic epoch refresh to maintain sync
        broadcastStateManager.startEpochRefresh();

        // Start checksum sync service
        checksumSyncService.start();

        // Force immediate sync after initial load (1s delay)
        setTimeout(() => {
          checksumSyncService.forceSync().catch((error) => {
            console.warn('[useAppInitialization] Initial checksum sync failed:', error);
          });
        }, 1000);

        // Load channel states (but NOT epoch - epoch comes from server only)
        broadcastStateManager.loadFromStorage();

        // Initialize session manager (loads from localStorage)
        const sessionResult = await SessionManager.initialize();

        // Load categories (playlists) from JSON
        console.log('[useAppInitialization] Loading channels...');
        const allCategories = await channelManager.loadChannels();
        console.log('[useAppInitialization] Loaded categories:', allCategories.length);

        if (!allCategories || allCategories.length === 0) {
          console.error('[useAppInitialization] No categories loaded!');
          // Try to reload once more
          try {
            await channelManager.reload();
            const retryCategories = channelManager.getAllCategories();
            if (retryCategories && retryCategories.length > 0) {
              setCategories(retryCategories);
              setSessionRestored(true);
              initializationCompleteRef.current = true;
              if (onInitialized) {
                onInitialized({
                  categories: retryCategories,
                  sessionResult,
                  error: null,
                });
              }
              return;
            }
          } catch (reloadError) {
            console.error('[useAppInitialization] Reload failed:', reloadError);
          }
          setSessionRestored(true);
          initializationCompleteRef.current = true;
          if (onInitialized) {
            onInitialized({
              categories: [],
              sessionResult,
              error: new Error('No categories available'),
            });
          }
          return;
        }

        setCategories(allCategories);
        console.log('[useAppInitialization] Categories set:', allCategories.map((c) => c.name));

        // Determine initial category (restored from session or time-based)
        let initialCategory = null;
        let categoryRestored = false;

        if (sessionResult.restored && sessionResult.state) {
          const savedState = sessionResult.state;
          console.log('[useAppInitialization] Restoring session from localStorage:', savedState);

          // Restore selected category if available
          if (savedState.activeCategoryId || savedState.activeCategoryName) {
            const restoredCategory = allCategories.find((cat) =>
              cat._id === savedState.activeCategoryId ||
              cat.name === savedState.activeCategoryName
            );

            if (restoredCategory) {
              initialCategory = restoredCategory;
              categoryRestored = true;
              console.log(`[useAppInitialization] Restored category: ${restoredCategory.name}`);
            }
          }
        }

        // If no category was restored, use time-based suggestion
        if (!categoryRestored && allCategories.length > 0) {
          const timeSuggestion = getTimeSuggestion(allCategories);
          initialCategory = timeSuggestion.channel || allCategories[0];
          console.log(`[useAppInitialization] Using time-based category: ${initialCategory.name} (${timeSuggestion.slotName})`);
        }

        setSessionRestored(true);
        initializationCompleteRef.current = true;

        // Callback to notify parent component
        if (onInitialized) {
          onInitialized({
            categories: allCategories,
            sessionResult,
            initialCategory,
            categoryRestored,
            error: null,
          });
        }
      } catch (error) {
        console.error('[useAppInitialization] Error initializing app:', error);
        setInitializationError(error);

        // Try to load categories anyway
        try {
          const allCategories = await channelManager.loadChannels();
          setCategories(allCategories);
          setSessionRestored(true);
          initializationCompleteRef.current = true;
          if (onInitialized) {
            onInitialized({
              categories: allCategories,
              sessionResult: { restored: false },
              initialCategory: allCategories[0] || null,
              categoryRestored: false,
              error,
            });
          }
        } catch (loadError) {
          console.error('[useAppInitialization] Failed to load categories:', loadError);
          setSessionRestored(true);
          initializationCompleteRef.current = true;
          if (onInitialized) {
            onInitialized({
              categories: [],
              sessionResult: { restored: false },
              initialCategory: null,
              categoryRestored: false,
              error: loadError,
            });
          }
        }
      }
    };

    initializeApp();

    // Cleanup on unmount
    return () => {
      checksumSyncService.stop();
    };
  }, []); // Run only once on mount

  return {
    categories,
    sessionRestored,
    initializationError,
  };
}


