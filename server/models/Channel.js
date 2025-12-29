const mongoose = require('mongoose');

const VideoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  youtubeId: { type: String, required: true },
  duration: { type: Number, default: 30 },
  year: Number,
  tags: [String],
  category: { type: String },
  thumbnail: { type: String } // Optional thumbnail URL (can be generated from youtubeId if not provided)
}, { _id: true }); // Ensure each video has an _id

// Channel represents a single broadcast channel (category) containing a playlist
const ChannelSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  playlistStartEpoch: { type: Date, default: () => new Date('2020-01-01T00:00:00Z') },
  // Default playlist (backward compatible)
  items: [VideoSchema],
  // Time-based playlists for authentic 9XM experience (optional - falls back to items if not set)
  timeBasedPlaylists: {
    morning: [VideoSchema],      // 6-9 AM: Subah Savera (Devotional/Classics)
    lateMorning: [VideoSchema],  // 9-12 PM: Dopahar Ki Dhun
    afternoon: [VideoSchema],     // 12-3 PM: Afternoon Beats (After school)
    evening: [VideoSchema],       // 3-6 PM: Bacchon Ka Time
    primeTime: [VideoSchema],     // 6-9 PM: Prime Time (Bollywood)
    night: [VideoSchema],         // 9-12 AM: Club Hours (Party)
    lateNight: [VideoSchema],     // 12-6 AM: Late Night Love (Romantic)
  },
  // Day-based playlists (optional - for weekend specials, etc.)
  dayBasedPlaylists: {
    weekday: {
      morning: [VideoSchema],
      lateMorning: [VideoSchema],
      afternoon: [VideoSchema],
      evening: [VideoSchema],
      primeTime: [VideoSchema],
      night: [VideoSchema],
      lateNight: [VideoSchema],
    },
    saturday: {
      morning: [VideoSchema],
      lateMorning: [VideoSchema],
      afternoon: [VideoSchema],
      evening: [VideoSchema],
      primeTime: [VideoSchema],
      night: [VideoSchema],
      lateNight: [VideoSchema],
    },
    sunday: {
      morning: [VideoSchema],
      lateMorning: [VideoSchema],
      afternoon: [VideoSchema],
      evening: [VideoSchema],
      primeTime: [VideoSchema],
      night: [VideoSchema],
      lateNight: [VideoSchema],
    },
  },
  // Special event playlists (optional - for holidays, festivals, etc.)
  specialEvents: [{
    name: String,           // Event name (e.g., "Diwali", "New Year")
    startDate: Date,        // When event starts
    endDate: Date,          // When event ends
    playlists: {
      morning: [VideoSchema],
      lateMorning: [VideoSchema],
      afternoon: [VideoSchema],
      evening: [VideoSchema],
      primeTime: [VideoSchema],
      night: [VideoSchema],
      lateNight: [VideoSchema],
    },
  }],
  // Custom time slot boundaries (optional - overrides defaults)
  customTimeSlots: {
    morning: { start: Number, end: Number },      // Hours (0-23)
    lateMorning: { start: Number, end: Number },
    afternoon: { start: Number, end: Number },
    evening: { start: Number, end: Number },
    primeTime: { start: Number, end: Number },
    night: { start: Number, end: Number },
    lateNight: { start: Number, end: Number },
  },
  // Metadata
  description: { type: String },
  thumbnail: { type: String },
  isActive: { type: Boolean, default: true },
});

// PERFORMANCE OPTIMIZATION: Add indexes for frequent queries
// Index on name (used for lookups)
ChannelSchema.index({ name: 1 });

// Index on youtubeId in items (used for video lookups)
ChannelSchema.index({ 'items.youtubeId': 1 });

// Index on playlistStartEpoch (used for position calculations)
ChannelSchema.index({ playlistStartEpoch: 1 });

// Compound index for common queries (name + isActive)
ChannelSchema.index({ name: 1, isActive: 1 });

module.exports = mongoose.model('Channel', ChannelSchema);

