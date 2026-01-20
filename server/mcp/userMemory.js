/**
 * User Memory System for DesiTV VJ
 * 
 * Stores user preferences and interaction history
 * for personalized responses.
 * 
 * Now backed by MongoDB (UserActivity) for persistence across server restarts.
 * Uses IP address as the primary identifier for anonymous users.
 */

const UserActivity = require('../models/UserActivity');

// In-memory cache to reduce DB hits (LRU-like)
const memoryCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

/**
 * User preference schema (default structure)
 */
function createUserProfile() {
  return {
    // Preferences learned from interactions
    favoriteGenres: [],
    favoriteArtists: [],
    preferredPersona: null,
    preferredMood: null,
    
    // Behavior signals (detected from messages)
    detectedGender: 'neutral', // 'male', 'female', 'neutral'
    detectedMood: 'neutral', // 'chill', 'energetic', 'romantic', 'neutral'
    likesTrivia: false,
    likesShayari: false,
    prefersActions: false, // true if often uses "play", "switch" vs asking
    prefersQuestions: false, // true if often asks vs commands
    
    // Interaction history
    channelsVisited: [],
    songsPlayed: [],
    triviaScore: { correct: 0, total: 0 },
    moodDistribution: {}, // track mood over time
    
    // Time-based patterns
    activeHours: [],
    lastInteraction: null,
    interactionCount: 0,
    
    // Created timestamp
    createdAt: Date.now()
  };
}

/**
 * Get or create user profile (Async)
 * @param {string} userId - IP Address or Session ID
 */
async function getUserProfile(userId) {
  if (!userId) return createUserProfile();
  
  // Check cache first
  if (memoryCache.has(userId)) {
    const cached = memoryCache.get(userId);
    if (Date.now() - cached.ts < CACHE_TTL) {
      return cached.profile;
    }
  }
  
  try {
    // Fetch from DB
    let userActivity = await UserActivity.findOne({ ipAddress: userId });
    
    if (!userActivity) {
      // Create new if not exists
      userActivity = new UserActivity({
        ipAddress: userId,
        profile: createUserProfile()
      });
      await userActivity.save();
    }
    
    // Update cache
    const profile = userActivity.profile || createUserProfile();
    
    // Update interaction stats in memory (will be saved later)
    profile.lastInteraction = Date.now();
    profile.interactionCount = (profile.interactionCount || 0) + 1;
    
    // Track active hours
    const hour = new Date().getHours();
    if (!profile.activeHours) profile.activeHours = [];
    if (!profile.activeHours.includes(hour)) {
      profile.activeHours.push(hour);
    }
    
    memoryCache.set(userId, { profile, ts: Date.now() });
    
    // Async save to DB (fire and forget)
    UserActivity.updateOne(
      { ipAddress: userId },
      { 
        $set: { 
          'profile.lastInteraction': new Date(),
          'profile.interactionCount': profile.interactionCount,
          'profile.activeHours': profile.activeHours,
          lastActiveAt: new Date()
        }
      }
    ).catch(err => console.error('[UserMemory] Background save error:', err.message));
    
    return profile;
  } catch (error) {
    console.error('[UserMemory] DB Error:', error.message);
    return createUserProfile(); // Fallback to empty profile
  }
}

/**
 * Update user preferences based on interaction (Async)
 */
async function updateUserPreferences(userId, updates = {}) {
  const profile = await getUserProfile(userId);
  
  // Update favorite genres
  if (updates.genre && !profile.favoriteGenres.includes(updates.genre)) {
    profile.favoriteGenres.push(updates.genre);
    // Keep only last 5
    if (profile.favoriteGenres.length > 5) {
      profile.favoriteGenres.shift();
    }
  }
  
  // Update favorite artists
  if (updates.artist && !profile.favoriteArtists.includes(updates.artist)) {
    profile.favoriteArtists.push(updates.artist);
    if (profile.favoriteArtists.length > 10) {
      profile.favoriteArtists.shift();
    }
  }
  
  // Update preferred persona
  if (updates.persona) {
    profile.preferredPersona = updates.persona;
  }
  
  // Track channel visits
  if (updates.channel && !profile.channelsVisited.includes(updates.channel)) {
    profile.channelsVisited.push(updates.channel);
  }
  
  // Track songs played
  if (updates.song) {
    if (!profile.songsPlayed) profile.songsPlayed = [];
    profile.songsPlayed.push(updates.song); // Store string only for simplicity in DB array
    // Keep only last 20
    if (profile.songsPlayed.length > 20) {
      profile.songsPlayed.shift();
    }
  }
  
  // Update trivia score
  if (updates.triviaResult !== undefined) {
    if (!profile.triviaScore) profile.triviaScore = { total: 0, correct: 0 };
    profile.triviaScore.total++;
    if (updates.triviaResult) {
      profile.triviaScore.correct++;
    }
  }
  
  // Update cache
  memoryCache.set(userId, { profile, ts: Date.now() });
  
  // Persist to DB
  try {
    await UserActivity.updateOne(
      { ipAddress: userId },
      { 
        $set: { profile: profile, lastActiveAt: new Date() },
        $push: { 
          activities: {
            type: 'chat',
            content: JSON.stringify(updates),
            timestamp: new Date()
          }
        }
      }
    );
  } catch (err) {
    console.error('[UserMemory] Failed to persist updates:', err.message);
  }
  
  return profile;
}

/**
 * Get personalized suggestions based on user history (Async)
 */
async function getPersonalizedSuggestions(userId) {
  const profile = await getUserProfile(userId);
  const suggestions = [];
  
  // Based on favorite genres
  if (profile.favoriteGenres && profile.favoriteGenres.length > 0) {
    const topGenre = profile.favoriteGenres[profile.favoriteGenres.length - 1];
    suggestions.push(`Play some ${topGenre} music 🎵`);
  }
  
  // Based on favorite artists
  if (profile.favoriteArtists && profile.favoriteArtists.length > 0) {
    const topArtist = profile.favoriteArtists[profile.favoriteArtists.length - 1];
    suggestions.push(`Play ${topArtist} songs 🎤`);
  }
  
  // Based on trivia performance
  if (profile.triviaScore && profile.triviaScore.total > 0) {
    const accuracy = (profile.triviaScore.correct / profile.triviaScore.total) * 100;
    if (accuracy > 70) {
      suggestions.push('Try a hard trivia! 🎯');
    } else {
      suggestions.push('Another trivia round? 🎯');
    }
  }
  
  // Based on time patterns
  const hour = new Date().getHours();
  if (hour >= 22 || hour < 5) {
    suggestions.push('Late night romantic shayari 🌙');
  } else if (hour >= 18 && hour < 22) {
    suggestions.push("It's party time! 🎉");
  }
  
  // Default suggestions if no history
  if (suggestions.length === 0) {
    suggestions.push(
      "What channels do you have? 📺",
      "Play some party music 🎉",
      "Give me a trivia! 🎯"
    );
  }
  
  return suggestions.slice(0, 5);
}

/**
 * Generate a personalized greeting based on user history (Async)
 */
async function getPersonalizedGreeting(userId, persona) {
  const profile = await getUserProfile(userId);
  const hour = new Date().getHours();
  
  let greeting = '';
  
  // Time-based greeting
  if (hour >= 5 && hour < 12) greeting = 'Good morning';
  else if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
  else if (hour >= 17 && hour < 21) greeting = 'Good evening';
  else greeting = 'Late night vibes';
  
  // Returning user
  if (profile.interactionCount > 1) {
    greeting = 'Welcome back! ' + greeting;
  }
  
  // Add persona flair
  if (persona?.avatar) {
    greeting = `${persona.avatar} ${greeting}!`;
  }
  
  // Add personalized touch based on history
  if (profile.favoriteArtists && profile.favoriteArtists.length > 0) {
    const artist = profile.favoriteArtists[profile.favoriteArtists.length - 1];
    greeting += ` Want more ${artist} today?`;
  } else if (profile.triviaScore && profile.triviaScore.total > 0) {
    const accuracy = Math.round((profile.triviaScore.correct / profile.triviaScore.total) * 100);
    greeting += ` Your trivia score: ${accuracy}% 🎯`;
  }
  
  return greeting;
}

/**
 * Extract preferences from user message
 */
function extractPreferencesFromMessage(message) {
  const lower = message.toLowerCase();
  const preferences = {};
  
  // Detect genres
  const genres = ['party', 'romantic', 'retro', 'sad', 'chill', 'dance', 'club'];
  for (const genre of genres) {
    if (lower.includes(genre)) {
      preferences.genre = genre;
      break;
    }
  }
  
  // Detect artists
  const artists = ['honey singh', 'arijit', 'neha kakkar', 'badshah', 'atif', 'shreya'];
  for (const artist of artists) {
    if (lower.includes(artist)) {
      preferences.artist = artist;
      break;
    }
  }
  
  return preferences;
}

/**
 * Track user behavior to understand gender/mood preferences (Async)
 */
async function trackUserBehavior(userId, behavior, intentType) {
  const profile = await getUserProfile(userId);
  
  // Update detected gender (weighted average of signals)
  if (behavior.gender !== 'neutral') {
    // Simple exponential moving average
    const current = profile.detectedGender || 'neutral';
    if (current !== behavior.gender) {
      // Gradually shift towards detected gender
      if (Math.random() > 0.3) {
        profile.detectedGender = behavior.gender;
      }
    } else {
      profile.detectedGender = behavior.gender;
    }
  }
  
  // Update detected mood
  if (behavior.mood !== 'neutral') {
    profile.detectedMood = behavior.mood;
    if (!profile.moodDistribution) profile.moodDistribution = {};
    profile.moodDistribution[behavior.mood] = (profile.moodDistribution[behavior.mood] || 0) + 1;
  }
  
  // Track interaction style
  if (behavior.isAction) {
    profile.prefersActions = true;
    profile.prefersQuestions = false;
  } else if (behavior.isQuestion) {
    profile.prefersQuestions = true;
    profile.prefersActions = false;
  }
  
  // Track intent preferences
  if (intentType === 'TRIVIA') {
    profile.likesTrivia = true;
  } else if (intentType === 'SHAYARI') {
    profile.likesShayari = true;
  }
  
  // Update cache
  memoryCache.set(userId, { profile, ts: Date.now() });
  
  // Persist to DB
  try {
    await UserActivity.updateOne(
      { ipAddress: userId },
      { $set: { profile: profile, lastActiveAt: new Date() } }
    );
  } catch (err) {
    console.error('[UserMemory] Failed to persist behavior:', err.message);
  }
  
  return profile;
}

/**
 * Get behavior-aware response recommendation (Async)
 */
async function getBehaviorAwareResponse(userId) {
  const profile = await getUserProfile(userId);
  
  // If detected as female-leaning, avoid certain topics
  if (profile.detectedGender === 'female') {
    return {
      avoidExplicit: true,
      favorTone: 'warm', // warmer, more empathetic
      suggestions: ['Song trivia', 'Comedy videos', 'Shayari']
    };
  }
  
  // If detected as male-leaning, more energetic tone
  if (profile.detectedGender === 'male') {
    return {
      avoidExplicit: true,
      favorTone: 'energetic', // fun, bro-like
      suggestions: ['Party music', 'Comedy', 'Trivia']
    };
  }
  
  // Default neutral
  return {
    avoidExplicit: true,
    favorTone: 'neutral',
    suggestions: ['What would you like?']
  };
}

module.exports = {
  getUserProfile,
  updateUserPreferences,
  getPersonalizedSuggestions,
  getPersonalizedGreeting,
  extractPreferencesFromMessage,
  trackUserBehavior,
  getBehaviorAwareResponse
};
