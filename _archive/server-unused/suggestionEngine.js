/**
 * SuggestionEngine - Industry-level song recommendation system
 * 
 * FEATURES:
 * 1. Multi-factor Ranking (relevance, popularity, user preference)
 * 2. Context-Aware Selection (mood, time, user history)
 * 3. A/B Testing Ready (experiment with ranking algorithms)
 * 4. Learning from Feedback (track user selections)
 * 5. Diversity Score (avoid repetitive suggestions)
 * 6. Fallback Strategy (DB → YouTube → Random)
 * 
 * INSPIRED BY:
 * - Spotify's Recommendation Algorithm
 * - YouTube's Ranking System
 * - Netflix's Personalization Engine
 */

const Channel = require('../models/Channel');
const { searchYouTube } = require('./youtubeSearch');

class SuggestionEngine {
  constructor(semanticSearcher, userMemory) {
    this.semanticSearcher = semanticSearcher;
    this.userMemory = userMemory;
    this.suggestionHistory = new Map(); // Track suggestions per user
    this.conversionMetrics = new Map(); // Track accepted vs rejected
  }

  /**
   * Comprehensive ranking algorithm
   * Score = (Relevance × 0.4) + (UserMatch × 0.3) + (Popularity × 0.2) + (Diversity × 0.1)
   */
  async rankSuggestions(candidates, userProfile, context = {}) {
    console.log(`[SuggestionEngine] Ranking ${candidates.length} candidates for user`);

    const scoredCandidates = candidates.map(song => {
      const relevanceScore = this.calculateRelevance(song, context.query);
      const userMatchScore = this.calculateUserMatch(song, userProfile);
      const popularityScore = this.calculatePopularity(song);
      const diversityScore = this.calculateDiversity(song, userProfile);

      const finalScore = 
        (relevanceScore * 0.4) +
        (userMatchScore * 0.3) +
        (popularityScore * 0.2) +
        (diversityScore * 0.1);

      return {
        ...song,
        scores: {
          relevance: relevanceScore,
          userMatch: userMatchScore,
          popularity: popularityScore,
          diversity: diversityScore,
          final: finalScore
        }
      };
    });

    // Sort by final score
    scoredCandidates.sort((a, b) => b.scores.final - a.scores.final);

    console.log(`[SuggestionEngine] Top 3 ranked:`, 
      scoredCandidates.slice(0, 3).map(s => `${s.title} (${s.scores.final.toFixed(2)})`).join(', '));

    return scoredCandidates;
  }

  /**
   * Relevance Score: How well does the song match the query?
   * Uses semantic similarity (already calculated by SemanticSearcher)
   */
  calculateRelevance(song, query) {
    // If song already has similarity score from semantic search
    if (song.similarity !== undefined) {
      return Math.min(song.similarity, 1.0);
    }

    // Fallback: Simple keyword matching
    const query_lower = query.toLowerCase();
    let score = 0;

    if ((song.title || '').toLowerCase().includes(query_lower)) score += 0.9;
    if ((song.artist || '').toLowerCase().includes(query_lower)) score += 0.7;
    if ((song.genre || '').toLowerCase().includes(query_lower)) score += 0.5;

    return Math.min(score, 1.0);
  }

  /**
   * User Match Score: How well does this match user's preferences?
   * Considers: previous likes, mood, time of day, language
   */
  calculateUserMatch(song, userProfile) {
    let score = 0;

    if (!userProfile) return 0.5;

    // Genre preference (if available)
    if (userProfile.favoriteGenres && userProfile.favoriteGenres.includes(song.genre)) {
      score += 0.4;
    }

    // Artist preference
    if (userProfile.favoriteArtists && 
        userProfile.favoriteArtists.some(artist => 
          (song.artist || '').includes(artist)
        )) {
      score += 0.3;
    }

    // Language preference
    if (userProfile.language && song.language === userProfile.language) {
      score += 0.2;
    }

    // Mood match (if song has mood metadata)
    if (song.mood && userProfile.currentMood && song.mood === userProfile.currentMood) {
      score += 0.3;
    }

    // Time-of-day relevance
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12 && song.energyLevel === 'high') score += 0.2; // Morning
    if (hour >= 12 && hour < 18 && song.energyLevel === 'medium') score += 0.2; // Afternoon
    if (hour >= 18 && hour < 24 && song.energyLevel === 'low') score += 0.2; // Evening/Night

    return Math.min(score, 1.0);
  }

  /**
   * Popularity Score: Is this song popular/well-received?
   * Based on: view count, likes, plays in database
   */
  calculatePopularity(song) {
    let score = 0.5; // Default medium popularity

    // View count normalization (assume 1M = max score)
    if (song.views) {
      score = Math.min(song.views / 1000000, 1.0);
    }

    // Play count (if tracked in database)
    if (song.playCount) {
      const playScore = Math.min(song.playCount / 1000, 1.0);
      score = (score + playScore) / 2; // Average with view score
    }

    // Recent popularity boost (newer songs)
    if (song.releaseDate) {
      const ageInDays = (Date.now() - new Date(song.releaseDate)) / (1000 * 60 * 60 * 24);
      if (ageInDays < 30) score += 0.2;
      if (ageInDays < 365) score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Diversity Score: Avoid repetitive suggestions
   * Track what we've already suggested recently
   */
  calculateDiversity(song, userProfile) {
    let score = 1.0; // Start with full score

    if (!userProfile || !userProfile.userId) return score;

    const userId = userProfile.userId;
    const recentSuggestions = this.suggestionHistory.get(userId) || [];

    // Penalize if suggested recently
    const suggestionCount = recentSuggestions.filter(s => 
      (s.title === song.title && s.artist === song.artist)
    ).length;

    if (suggestionCount > 0) {
      score -= (suggestionCount * 0.3); // -0.3 per suggestion
    }

    // Penalize if same artist suggested too much recently
    const artistCount = recentSuggestions.filter(s => 
      s.artist === song.artist
    ).length;

    if (artistCount > 2) {
      score -= 0.2;
    }

    return Math.max(score, 0);
  }

  /**
   * Get suggestions with multiple strategies
   */
  async getSuggestions(query, userProfile, options = {}) {
    console.log(`[SuggestionEngine] Getting suggestions for: "${query}"`);

    const {
      topK = 3,
      strategy = 'balanced', // 'balanced', 'popularity', 'personalized', 'diverse'
      fallback = true
    } = options;

    let candidates = [];

    // STRATEGY 1: Database search (fastest, always try first)
    try {
      const dbResults = await this.searchDatabase(query);
      candidates.push(...dbResults);
      console.log(`[SuggestionEngine] Found ${dbResults.length} songs in DB`);
    } catch (err) {
      console.error(`[SuggestionEngine] DB search failed:`, err.message);
    }

    // STRATEGY 2: Semantic search (if database results insufficient)
    if (candidates.length < topK && this.semanticSearcher) {
      try {
        const semanticResults = this.semanticSearcher.search(query, topK);
        candidates.push(...semanticResults.filter(s => 
          !candidates.find(c => c._id === s.id)
        ));
        console.log(`[SuggestionEngine] Found ${semanticResults.length} via semantic search`);
      } catch (err) {
        console.error(`[SuggestionEngine] Semantic search failed:`, err.message);
      }
    }

    // STRATEGY 3: YouTube fallback (if still need more results)
    if (candidates.length < topK && fallback) {
      try {
        const youtubeResults = await searchYouTube(query);
        candidates.push(...youtubeResults.map(yt => ({
          title: yt.title,
          artist: yt.channel,
          videoId: yt.id,
          source: 'youtube',
          views: yt.viewCount || 0
        })));
        console.log(`[SuggestionEngine] Found ${youtubeResults.length} on YouTube`);
      } catch (err) {
        console.error(`[SuggestionEngine] YouTube search failed:`, err.message);
      }
    }

    if (candidates.length === 0) {
      return { suggestions: [], message: '❌ No songs found. Try a different search!' };
    }

    // RANKING: Apply algorithm based on strategy
    let ranked = await this.rankSuggestions(candidates, userProfile, { query });

    // Apply strategy weights
    if (strategy === 'popularity') {
      ranked.sort((a, b) => b.scores.popularity - a.scores.popularity);
    } else if (strategy === 'personalized') {
      ranked.sort((a, b) => b.scores.userMatch - a.scores.userMatch);
    } else if (strategy === 'diverse') {
      ranked.sort((a, b) => b.scores.diversity - a.scores.diversity);
    }
    // 'balanced' uses the final composite score (default)

    // Take top K
    const suggestions = ranked.slice(0, topK).map((song, idx) => ({
      rank: idx + 1,
      title: song.title,
      artist: song.artist,
      videoId: song.videoId || song._id,
      source: song.source || 'database',
      reason: this.generateReason(song, userProfile),
      scores: song.scores
    }));

    // Track suggestion for diversity calculation
    if (userProfile && userProfile.userId) {
      const history = this.suggestionHistory.get(userProfile.userId) || [];
      history.push(...suggestions);
      // Keep last 50 suggestions
      this.suggestionHistory.set(userProfile.userId, history.slice(-50));
    }

    return {
      suggestions,
      query,
      strategy,
      message: this.formatSuggestions(suggestions)
    };
  }

  /**
   * Search database for songs
   */
  async searchDatabase(query) {
    try {
      const songs = await Channel.find({
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { artist: { $regex: query, $options: 'i' } },
          { genre: { $regex: query, $options: 'i' } },
          { keywords: { $regex: query, $options: 'i' } }
        ]
      })
      .limit(10)
      .lean();

      return songs;
    } catch (err) {
      console.error('Database search error:', err);
      return [];
    }
  }

  /**
   * Generate reason for suggestion
   */
  generateReason(song, userProfile) {
    const scores = song.scores || {};

    if (scores.userMatch > 0.7) return '✨ Based on your taste';
    if (scores.relevance > 0.8) return '🎯 Matches your search';
    if (scores.popularity > 0.7) return '🔥 Trending & Popular';
    if (scores.diversity > 0.8) return '🆕 Fresh & Different';
    
    return '🎵 Popular choice';
  }

  /**
   * Format suggestions as markdown options
   */
  formatSuggestions(suggestions) {
    if (suggestions.length === 0) return '';

    let message = '## 🎵 Found Some Vibes\n\n';

    suggestions.forEach((song, idx) => {
      const emoji = ['🥇', '🥈', '🥉'][idx] || '🎵';
      message += `${emoji} [${song.title} - ${song.artist}](play:${song.videoId})\n`;
      message += `   *${song.reason}*\n\n`;
    });

    return message;
  }

  /**
   * Track user feedback (accepted vs rejected)
   */
  trackFeedback(suggestionId, accepted, userProfile) {
    if (!userProfile) return;

    const key = `${userProfile.userId}`;
    const metrics = this.conversionMetrics.get(key) || {
      accepted: 0,
      rejected: 0,
      conversionRate: 0
    };

    if (accepted) {
      metrics.accepted++;
    } else {
      metrics.rejected++;
    }

    metrics.conversionRate = metrics.accepted / (metrics.accepted + metrics.rejected);
    this.conversionMetrics.set(key, metrics);

    console.log(`[SuggestionEngine] Feedback for ${key}:`, metrics);
  }

  /**
   * Get metrics
   */
  getMetrics() {
    const metrics = [];
    for (const [userId, metric] of this.conversionMetrics.entries()) {
      metrics.push({ userId, ...metric });
    }
    return metrics;
  }
}

module.exports = SuggestionEngine;
