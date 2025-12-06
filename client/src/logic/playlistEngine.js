/**
 * PlaylistEngine - Pseudo-live playlist calculation
 * Determines which video should be playing at any given time
 */

/**
 * Calculate which video should be playing based on broadcast epoch
 * @param {Array} playlist - Array of video items
 * @param {Date|string} startEpoch - When the playlist started broadcasting
 * @returns {Object} { item, offset, videoIndex, totalElapsed, cyclePosition }
 */
export function calculatePseudoLivePosition(playlist, startEpoch) {
  if (!playlist || playlist.length === 0) {
    return {
      item: null,
      offset: 0,
      videoIndex: -1,
      totalElapsed: 0,
      cyclePosition: 0,
    };
  }

  const durations = playlist.map(item => item.duration || 30);
  const totalDuration = durations.reduce((a, b) => a + b, 0) || 1;
  
  const startTime = new Date(startEpoch).getTime();
  const now = Date.now();
  
  // Total seconds elapsed since broadcast started
  const totalElapsed = Math.floor((now - startTime) / 1000);
  
  // Position within current cycle (playlist repeats)
  const cyclePosition = totalElapsed % totalDuration;
  
  // Find which video should be playing
  let cumulative = 0;
  for (let i = 0; i < playlist.length; i++) {
    const duration = durations[i];
    if (cumulative + duration > cyclePosition) {
      return {
        item: playlist[i],
        offset: cyclePosition - cumulative,
        videoIndex: i,
        totalElapsed,
        cyclePosition,
      };
    }
    cumulative += duration;
  }
  
  // Fallback to first video
  return {
    item: playlist[0],
    offset: 0,
    videoIndex: 0,
    totalElapsed,
    cyclePosition,
  };
}

/**
 * Get next video in sequence
 * @param {Array} playlist - Array of video items
 * @param {number} currentIndex - Current video index
 * @returns {Object} { nextIndex, nextItem, timeUntilSwitch }
 */
export function getNextVideo(playlist, currentIndex) {
  if (!playlist || playlist.length === 0) {
    return { nextIndex: 0, nextItem: null, timeUntilSwitch: 0 };
  }

  const durations = playlist.map(item => item.duration || 30);
  const currentDuration = durations[currentIndex] || 30;
  const nextIndex = (currentIndex + 1) % playlist.length;
  const nextItem = playlist[nextIndex];

  return {
    nextIndex,
    nextItem,
    timeUntilSwitch: currentDuration,
  };
}

/**
 * Shuffle playlist - pick random video (not last played)
 * @param {Array} playlist - Array of video items
 * @param {number} lastIndex - Last played video index
 * @returns {number} Random index
 */
export function getRandomVideoIndex(playlist, lastIndex = -1) {
  if (!playlist || playlist.length === 0) return 0;
  if (playlist.length === 1) return 0;

  let randomIndex;
  do {
    randomIndex = Math.floor(Math.random() * playlist.length);
  } while (randomIndex === lastIndex && playlist.length > 1);

  return randomIndex;
}

/**
 * Get video at specific time offset
 * @param {Array} playlist - Array of video items
 * @param {Date|string} startEpoch - Broadcast start time
 * @param {number} offsetSeconds - Time offset in seconds
 * @returns {Object} { item, offset, videoIndex }
 */
export function getVideoAtOffset(playlist, startEpoch, offsetSeconds) {
  if (!playlist || playlist.length === 0) {
    return { item: null, offset: 0, videoIndex: -1 };
  }

  const durations = playlist.map(item => item.duration || 30);
  const totalDuration = durations.reduce((a, b) => a + b, 0) || 1;
  const cyclePosition = offsetSeconds % totalDuration;

  let cumulative = 0;
  for (let i = 0; i < playlist.length; i++) {
    const duration = durations[i];
    if (cumulative + duration > cyclePosition) {
      return {
        item: playlist[i],
        offset: cyclePosition - cumulative,
        videoIndex: i,
      };
    }
    cumulative += duration;
  }

  return {
    item: playlist[0],
    offset: 0,
    videoIndex: 0,
  };
}


