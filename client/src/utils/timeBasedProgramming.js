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

// Channel name to time slot mapping
const TIME_SLOTS = {
  '06-09': 'Retro Gold',           // Subah Savera - Classics
  '09-12': 'Retro Gold',           // Late Morning - Chitrahaar vibes
  '12-15': 'Desi Beats',           // Afternoon - Indie/Punjabi
  '15-18': 'Cartoon Adda',         // Kids time - Shinchan!
  '18-21': 'Retro Gold',           // Prime Time - Bollywood
  '21-00': 'Club Nights',          // Party time
  '00-06': 'Late Night Love'       // Romantic midnight
}

// Friendly time slot names for display
const TIME_SLOT_NAMES = {
  '06-09': 'Subah Savera',
  '09-12': 'Dopahar Ki Dhun',
  '12-15': 'Afternoon Beats',
  '15-18': 'Bacchon Ka Time',
  '18-21': 'Prime Time',
  '21-00': 'Club Hours',
  '00-06': 'Late Night Love'
}

/**
 * Get current time slot key based on hour
 * @param {number} hour - Hour in 24-hour format (0-23)
 * @returns {string} Time slot key
 */
function getTimeSlotKey(hour) {
  if (hour >= 6 && hour < 9) return '06-09'
  if (hour >= 9 && hour < 12) return '09-12'
  if (hour >= 12 && hour < 15) return '12-15'
  if (hour >= 15 && hour < 18) return '15-18'
  if (hour >= 18 && hour < 21) return '18-21'
  if (hour >= 21 && hour < 24) return '21-00'
  return '00-06' // 0-6
}

/**
 * Get suggested channel name based on current time
 * @returns {string} Suggested channel name
 */
export function getSuggestedChannel() {
  const hour = new Date().getHours()
  const slotKey = getTimeSlotKey(hour)
  return TIME_SLOTS[slotKey] || 'Retro Gold'
}

/**
 * Get current time slot display name
 * @returns {string} Friendly time slot name
 */
export function getCurrentTimeSlotName() {
  const hour = new Date().getHours()
  const slotKey = getTimeSlotKey(hour)
  return TIME_SLOT_NAMES[slotKey] || 'Prime Time'
}

/**
 * Get time-based greeting
 * @returns {string} Greeting based on time of day
 */
export function getTimeBasedGreeting() {
  const hour = new Date().getHours()
  
  if (hour >= 5 && hour < 12) {
    return 'SUPRABHAT! ☀️'
  } else if (hour >= 12 && hour < 17) {
    return 'NAMASTE! 🙏'
  } else if (hour >= 17 && hour < 21) {
    return 'SHUBH SANDHYA! 🌅'
  } else {
    return 'SHUBH RATRI! 🌙'
  }
}

/**
 * Get channel suggestion with explanation
 * @param {Array} categories - Available categories
 * @returns {Object} { channel, slotName, greeting }
 */
export function getTimeSuggestion(categories) {
  const suggestedName = getSuggestedChannel()
  const slotName = getCurrentTimeSlotName()
  const greeting = getTimeBasedGreeting()
  
  // Find the category that matches the suggested name
  const channel = categories?.find(cat => cat.name === suggestedName) || null
  
  return {
    channel,
    channelName: suggestedName,
    slotName,
    greeting,
    hour: new Date().getHours()
  }
}

/**
 * Format current time in Indian style
 * @returns {string} Formatted time like "9:30 PM"
 */
export function getIndianTime() {
  return new Date().toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

export default {
  getSuggestedChannel,
  getCurrentTimeSlotName,
  getTimeBasedGreeting,
  getTimeSuggestion,
  getIndianTime
}


