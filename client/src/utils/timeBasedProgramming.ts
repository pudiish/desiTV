/**
 * Time-Based Programming Utility
 * 
 * Suggests default channel based on time of day,
 * mimicking how real Indian TV had scheduled programming
 * 
 * Time Slots (IST vibes):
 * - 06:00-09:00: Morning (Devotional/Classics)
 * - 09:00-12:00: Late Morning (Retro Gold)
 * - 12:00-15:00: Afternoon (Desi Beats)
 * - 15:00-18:00: Evening (Cartoon Adda - kids home from school)
 * - 18:00-21:00: Prime Time (Retro Gold)
 * - 21:00-00:00: Night (Club Nights)
 * - 00:00-06:00: Late Night (Late Night Love)
 */

import type { Channel } from '../types';

// Channel name to time slot mapping
const TIME_SLOTS: Record<string, string> = {
  '06-09': 'Retro Gold',           // Subah Savera - Classics
  '09-12': 'Retro Gold',           // Late Morning - Chitrahaar vibes
  '12-15': 'Desi Beats',           // Afternoon - Indie/Punjabi
  '15-18': 'Cartoon Adda',         // Kids time - Shinchan!
  '18-21': 'Retro Gold',           // Prime Time - Bollywood
  '21-00': 'Club Nights',          // Party time
  '00-06': 'Late Night Love'       // Romantic midnight
};

// Friendly time slot names for display
const TIME_SLOT_NAMES: Record<string, string> = {
  '06-09': 'Subah Savera',
  '09-12': 'Dopahar Ki Dhun',
  '12-15': 'Afternoon Beats',
  '15-18': 'Bacchon Ka Time',
  '18-21': 'Prime Time',
  '21-00': 'Club Hours',
  '00-06': 'Late Night Love'
};

type TimeSlotKey = '06-09' | '09-12' | '12-15' | '15-18' | '18-21' | '21-00' | '00-06';

/**
 * Get current time slot key based on hour
 */
function getTimeSlotKey(hour: number): TimeSlotKey {
  if (hour >= 6 && hour < 9) return '06-09';
  if (hour >= 9 && hour < 12) return '09-12';
  if (hour >= 12 && hour < 15) return '12-15';
  if (hour >= 15 && hour < 18) return '15-18';
  if (hour >= 18 && hour < 21) return '18-21';
  if (hour >= 21 && hour < 24) return '21-00';
  return '00-06'; // 0-6
}

/**
 * Get suggested channel name based on current time
 */
export function getSuggestedChannel(timezone: string | null = null): string {
  let hour: number;
  if (timezone) {
    // Use timezone-aware hour calculation
    const time = new Date().toLocaleString('en-US', { timeZone: timezone, hour: 'numeric', hour12: false });
    hour = parseInt(time.split(':')[0], 10);
  } else {
    hour = new Date().getHours();
  }
  const slotKey = getTimeSlotKey(hour);
  return TIME_SLOTS[slotKey] || 'Retro Gold';
}

/**
 * Get current time slot display name
 */
export function getCurrentTimeSlotName(timezone: string | null = null): string {
  let hour: number;
  if (timezone) {
    // Use timezone-aware hour calculation
    const time = new Date().toLocaleString('en-US', { timeZone: timezone, hour: 'numeric', hour12: false });
    hour = parseInt(time.split(':')[0], 10);
  } else {
    hour = new Date().getHours();
  }
  const slotKey = getTimeSlotKey(hour);
  return TIME_SLOT_NAMES[slotKey] || 'Prime Time';
}

/**
 * Alias for getCurrentTimeSlotName (for compatibility)
 */
export function getTimeSlotName(timezone: string | null = null): string {
  return getCurrentTimeSlotName(timezone);
}

/**
 * Get time-based greeting
 */
export function getTimeBasedGreeting(timezone: string | null = null): string {
  let hour: number;
  if (timezone) {
    // Use timezone-aware hour calculation
    const time = new Date().toLocaleString('en-US', { timeZone: timezone, hour: 'numeric', hour12: false });
    hour = parseInt(time.split(':')[0], 10);
  } else {
    hour = new Date().getHours();
  }
  
  if (hour >= 5 && hour < 12) {
    return 'SUPRABHAT! ☀️';
  } else if (hour >= 12 && hour < 17) {
    return 'NAMASTE! 🙏';
  } else if (hour >= 17 && hour < 21) {
    return 'SHUBH SANDHYA! 🌅';
  } else {
    return 'SHUBH RATRI! 🌙';
  }
}

export interface TimeSuggestion {
  channel: Channel | null;
  channelName: string;
  slotName: string;
  greeting: string;
  hour: number;
}

/**
 * Get channel suggestion with explanation
 */
export function getTimeSuggestion(categories: Channel[] | null | undefined): TimeSuggestion {
  const suggestedName = getSuggestedChannel();
  const slotName = getCurrentTimeSlotName();
  const greeting = getTimeBasedGreeting();
  
  // Find the category that matches the suggested name
  const channel = categories?.find(cat => cat.name === suggestedName) || null;
  
  return {
    channel,
    channelName: suggestedName,
    slotName,
    greeting,
    hour: new Date().getHours()
  };
}

/**
 * Format current time in Indian style
 */
export function getIndianTime(): string {
  return new Date().toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

export default {
  getSuggestedChannel,
  getCurrentTimeSlotName,
  getTimeSlotName,
  getTimeBasedGreeting,
  getTimeSuggestion,
  getIndianTime
};
