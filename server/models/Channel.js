const mongoose = require('mongoose');

const VideoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  youtubeId: { type: String, required: true },
  duration: { type: Number, default: 30 },
  year: Number,
  tags: [String],
  category: { type: String }
});

// Channel represents a single broadcast channel (category) containing a playlist
const ChannelSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  playlistStartEpoch: { type: Date, default: () => new Date('2020-01-01T00:00:00Z') },
  items: [VideoSchema]
});

module.exports = mongoose.model('Channel', ChannelSchema);

