/**
 * User Memory - Client-Side (localStorage)
 * Stores user preferences and interaction history
 */

const STORAGE_KEY = 'desitv-user-memory';

function createUserProfile() {
  return {
    favoriteGenres: [],
    favoriteArtists: [],
    preferredPersona: null,
    preferredMood: null,
    channelsVisited: [],
    songsPlayed: [],
    triviaScore: { correct: 0, total: 0 },
    lastInteraction: Date.now(),
    interactionCount: 0,
    createdAt: Date.now()
  };
}

/**
 * Get user profile from localStorage
 */
export function getUserProfile(userId = 'default') {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY}-${userId}`);
    if (stored) {
      const profile = JSON.parse(stored);
      profile.lastInteraction = Date.now();
      profile.interactionCount = (profile.interactionCount || 0) + 1;
      saveUserProfile(userId, profile);
      return profile;
    }
  } catch (err) {
    console.warn('[UserMemory] Error loading profile:', err);
  }
  
  const profile = createUserProfile();
  saveUserProfile(userId, profile);
  return profile;
}

/**
 * Save user profile to localStorage
 */
function saveUserProfile(userId, profile) {
  try {
    localStorage.setItem(`${STORAGE_KEY}-${userId}`, JSON.stringify(profile));
  } catch (err) {
    console.warn('[UserMemory] Error saving profile:', err);
  }
}

/**
 * Update user preferences
 */
export function updateUserPreferences(userId, updates = {}) {
  const profile = getUserProfile(userId);
  
  if (updates.genre && !profile.favoriteGenres.includes(updates.genre)) {
    profile.favoriteGenres.push(updates.genre);
    if (profile.favoriteGenres.length > 5) profile.favoriteGenres.shift();
  }
  
  if (updates.artist && !profile.favoriteArtists.includes(updates.artist)) {
    profile.favoriteArtists.push(updates.artist);
    if (profile.favoriteArtists.length > 10) profile.favoriteArtists.shift();
  }
  
  if (updates.channel && !profile.channelsVisited.includes(updates.channel)) {
    profile.channelsVisited.push(updates.channel);
  }
  
  if (updates.song) {
    if (!profile.songsPlayed) profile.songsPlayed = [];
    profile.songsPlayed.push(updates.song);
    if (profile.songsPlayed.length > 20) profile.songsPlayed.shift();
  }
  
  if (updates.triviaResult !== undefined) {
    if (!profile.triviaScore) profile.triviaScore = { total: 0, correct: 0 };
    profile.triviaScore.total++;
    if (updates.triviaResult) profile.triviaScore.correct++;
  }
  
  saveUserProfile(userId, profile);
  return profile;
}

/**
 * Get personalized suggestions
 */
export function getPersonalizedSuggestions(userId) {
  const profile = getUserProfile(userId);
  const suggestions = [];
  
  if (profile.favoriteGenres?.length > 0) {
    const topGenre = profile.favoriteGenres[profile.favoriteGenres.length - 1];
    suggestions.push(`Play some ${topGenre} music 🎵`);
  }
  
  if (profile.favoriteArtists?.length > 0) {
    const topArtist = profile.favoriteArtists[profile.favoriteArtists.length - 1];
    suggestions.push(`Play ${topArtist} songs 🎤`);
  }
  
  if (suggestions.length === 0) {
    suggestions.push("What's playing? 🎵", "Play party music 🎉", "Show me channels 📺");
  }
  
  return suggestions.slice(0, 5);
}
