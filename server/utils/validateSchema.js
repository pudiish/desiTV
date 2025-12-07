/**
 * Validate channel schema before saving to MongoDB
 * Ensures data consistency
 */

function validateChannelSchema(data) {
  const errors = [];

  // Validate name
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('Channel name is required and must be a non-empty string');
  }

  // Validate playlistStartEpoch (optional, defaults to 2020-01-01)
  if (data.playlistStartEpoch) {
    const epoch = new Date(data.playlistStartEpoch);
    if (isNaN(epoch.getTime())) {
      errors.push('playlistStartEpoch must be a valid date');
    }
  }

  // Validate items array
  if (data.items && Array.isArray(data.items)) {
    data.items.forEach((item, index) => {
      if (!item.youtubeId || typeof item.youtubeId !== 'string') {
        errors.push(`Item ${index}: youtubeId is required`);
      }
      if (!item.title || typeof item.title !== 'string') {
        errors.push(`Item ${index}: title is required`);
      }
      if (item.duration && (typeof item.duration !== 'number' || item.duration <= 0)) {
        errors.push(`Item ${index}: duration must be a positive number`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateVideoSchema(data) {
  const errors = [];

  if (!data.youtubeId || typeof data.youtubeId !== 'string') {
    errors.push('youtubeId is required');
  }
  if (!data.title || typeof data.title !== 'string') {
    errors.push('title is required');
  }
  if (data.duration && (typeof data.duration !== 'number' || data.duration <= 0)) {
    errors.push('duration must be a positive number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = {
  validateChannelSchema,
  validateVideoSchema,
};







