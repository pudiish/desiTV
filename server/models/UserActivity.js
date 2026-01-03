/**
 * UserActivity.js
 * MongoDB model for storing anonymous user activity and profile based on IP
 */

const mongoose = require('mongoose');

const UserActivitySchema = new mongoose.Schema({
  ipAddress: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // User Profile (Agent Memory)
  profile: {
    favoriteGenres: [String],
    favoriteArtists: [String],
    preferredPersona: String,
    preferredMood: String,
    
    detectedGender: { type: String, default: 'neutral' },
    detectedMood: { type: String, default: 'neutral' },
    likesTrivia: { type: Boolean, default: false },
    likesShayari: { type: Boolean, default: false },
    prefersActions: { type: Boolean, default: false },
    prefersQuestions: { type: Boolean, default: false },
    
    channelsVisited: [String],
    songsPlayed: [String],
    triviaScore: {
      correct: { type: Number, default: 0 },
      total: { type: Number, default: 0 }
    },
    moodDistribution: { type: Map, of: Number, default: {} },
    activeHours: [Number],
    interactionCount: { type: Number, default: 0 }
  },
  // Activity Log
  activities: [{
    type: { type: String, enum: ['chat', 'action', 'view'], required: true },
    content: String, // Message content or action details
    channelId: String,
    timestamp: { type: Date, default: Date.now }
  }],
  lastActiveAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Auto-delete inactive users after 30 days
UserActivitySchema.index({ lastActiveAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('UserActivity', UserActivitySchema);
