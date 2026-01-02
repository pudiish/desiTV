const Channel = require('../models/Channel');
const { searchYouTube } = require('./youtubeSearch');

class ResponseCache {
  constructor(ttl = 30 * 60 * 1000) {
    this.cache = new Map();
    this.ttl = ttl;
  }

  generateKey(query, context = {}) {
    const normalizedQuery = query.toLowerCase().trim();
    return `${normalizedQuery}::${context.userId || 'anon'}::${context.channelId || 'all'}`;
  }

  set(key, value) {
    const expiresAt = Date.now() + this.ttl;
    this.cache.set(key, { value, expiresAt });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item || Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  cleanup() {
    let count = 0;
    for (const [key, item] of this.cache.entries()) {
      if (Date.now() > item.expiresAt) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  stats() {
    return { size: this.cache.size, ttl: this.ttl };
  }
}

const INTENT_PATTERNS = {
  play_suggestion: { pattern: /(?:play|chal)\s+(.+)/i, confidence: 0.95 },
  search_song: { pattern: /(?:search|find|dhundo)\s+(.+)/i, confidence: 0.9 },
  mood_suggestion: { pattern: /(?:feeling|vibe|mood)\s+(.+)/i, confidence: 0.85 },
  artist_search: { pattern: /(?:artist|singer)\s+(.+)/i, confidence: 0.9 },
  genre_search: { pattern: /(?:genre|type)\s+(.+)/i, confidence: 0.9 },
  current_playing: { pattern: /(?:what'?s? playing|now playing|current)/i, confidence: 0.95 },
  yes_response: { pattern: /^(?:yes|yeah|sure|ok|haan|bilkul)$/i, confidence: 0.98 },
  no_response: { pattern: /^(?:no|nah|nope|nahin|mat|nahi)$/i, confidence: 0.98 }
};

class IntentDetector {
  constructor() {
    this.lastSuggestion = null;
  }

  detect(message) {
    for (const [name, config] of Object.entries(INTENT_PATTERNS)) {
      const match = message.match(config.pattern);
      if (match) {
        return {
          intent: name,
          confidence: config.confidence,
          payload: match[1] || match[0],
          match
        };
      }
    }
    return null;
  }

  setLastSuggestion(song) {
    this.lastSuggestion = song;
  }

  getLastSuggestion() {
    return this.lastSuggestion;
  }
}

class SemanticSearcher {
  constructor() {
    this.documents = [];
    this.vocabulary = new Set();
    this.tfidf = new Map();
  }

  indexSongs(songs) {
    this.documents = songs.map(song => ({
      id: song._id || song.id,
      title: song.title || '',
      artist: song.artist || song.channel || '',
      genre: song.genre || '',
      fullText: `${song.title || ''} ${song.artist || ''} ${song.genre || ''}`.toLowerCase()
    }));

    this.documents.forEach(doc => {
      this.tokenize(doc.fullText).forEach(word => this.vocabulary.add(word));
    });

    this.calculateTFIDF();
  }

  tokenize(text) {
    return text.split(/\s+/).filter(word => word.length > 2);
  }

  calculateTFIDF() {
    this.documents.forEach(doc => {
      const words = this.tokenize(doc.fullText);
      const tfs = new Map();
      words.forEach(word => tfs.set(word, (tfs.get(word) || 0) + 1));
      tfs.forEach((count, word) => tfs.set(word, count / words.length));
      this.tfidf.set(`${doc.id}`, tfs);
    });
  }

  getIDF(word) {
    const docCount = this.documents.length;
    let docsWithWord = 0;
    this.tfidf.forEach(tfs => { if (tfs.has(word)) docsWithWord++; });
    return Math.log(docCount / (1 + docsWithWord));
  }

  search(query, topK = 3) {
    const queryWords = this.tokenize(query);
    const scores = [];

    this.documents.forEach(doc => {
      const docTFs = this.tfidf.get(`${doc.id}`) || new Map();
      let dotProduct = 0;
      let queryMag = 0;
      let docMag = 0;

      const queryVec = new Map();
      queryWords.forEach(word => {
        const tfidf = (docTFs.get(word) || 0) * this.getIDF(word);
        queryVec.set(word, tfidf);
        queryMag += tfidf * tfidf;
      });

      docTFs.forEach((tf, word) => {
        const idf = this.getIDF(word);
        const tfidfScore = tf * idf;
        docMag += tfidfScore * tfidfScore;
        if (queryVec.has(word)) dotProduct += queryVec.get(word) * tfidfScore;
      });

      const similarity = (queryMag === 0 || docMag === 0) ? 0 : dotProduct / (Math.sqrt(queryMag) * Math.sqrt(docMag));
      scores.push({ ...doc, similarity });
    });

    scores.sort((a, b) => b.similarity - a.similarity);
    return scores.slice(0, topK);
  }

  quickSearch(query) {
    const q = query.toLowerCase();
    return this.documents
      .map(doc => ({ ...doc, score: this.calcMatchScore(q, doc) }))
      .filter(d => d.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  calcMatchScore(query, doc) {
    let score = 0;
    if (doc.title.toLowerCase() === query) score += 100;
    else if (doc.title.toLowerCase().includes(query)) score += 80;
    if (doc.artist && doc.artist.toLowerCase().includes(query)) score += 60;
    query.split(/\s+/).forEach(word => {
      if (doc.fullText.includes(word)) score += 10;
    });
    return score;
  }
}

class SuggestionEngine {
  constructor(searcher) {
    this.searcher = searcher;
  }

  async rankSuggestions(candidates, userProfile = {}) {
    return candidates.map(song => ({
      ...song,
      scores: {
        relevance: song.similarity || 0.5,
        popularity: (song.views || 0) / 1000000,
        userMatch: this.getUserMatch(song, userProfile),
        final: this.calculateFinalScore(song, userProfile)
      }
    })).sort((a, b) => b.scores.final - a.scores.final);
  }

  getUserMatch(song, profile) {
    if (!profile) return 0.5;
    let score = 0;
    if (profile.favoriteArtists?.some(a => (song.artist || '').includes(a))) score += 0.3;
    if (profile.favoriteGenres?.includes(song.genre)) score += 0.2;
    return Math.min(score, 1);
  }

  calculateFinalScore(song, profile = {}) {
    const relevance = song.similarity || 0.5;
    const userMatch = this.getUserMatch(song, profile);
    const popularity = Math.min((song.views || 0) / 1000000, 1);
    return (relevance * 0.4) + (userMatch * 0.3) + (popularity * 0.3);
  }

  async getSuggestions(query, userProfile = {}, topK = 3) {
    try {
      const dbResults = await Channel.find({
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { artist: { $regex: query, $options: 'i' } },
          { genre: { $regex: query, $options: 'i' } }
        ]
      }).limit(10).lean();

      let candidates = [...dbResults];

      if (candidates.length < topK && this.searcher) {
        const semanticResults = this.searcher.search(query, topK);
        candidates.push(...semanticResults.filter(s => !candidates.find(c => c._id?.toString() === s.id?.toString())));
      }

      if (candidates.length === 0) {
        return { suggestions: [], message: 'No songs found' };
      }

      const ranked = await this.rankSuggestions(candidates, userProfile);
      const suggestions = ranked.slice(0, topK).map((song, idx) => ({
        rank: idx + 1,
        title: song.title,
        artist: song.artist,
        videoId: song.videoId || song._id,
        score: song.scores.final
      }));

      return { suggestions, message: this.formatSuggestions(suggestions) };
    } catch (err) {
      console.error('[SuggestionEngine] Error:', err.message);
      return { suggestions: [], message: 'Search error' };
    }
  }

  formatSuggestions(suggestions) {
    if (!suggestions.length) return '';
    let msg = '🎵 **Suggestions**\n\n';
    suggestions.forEach((s, i) => {
      const emoji = ['🥇', '🥈', '🥉'][i] || '🎵';
      msg += `${emoji} [${s.title} - ${s.artist}](play:${s.videoId})\n`;
    });
    return msg;
  }
}

module.exports = {
  ResponseCache,
  IntentDetector,
  SemanticSearcher,
  SuggestionEngine,
  INTENT_PATTERNS
};
