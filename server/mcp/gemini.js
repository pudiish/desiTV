/**
 * Google Gemini API Client
 * 
 * Uses Gemma 3 4B (free tier with high quota) for DesiTV chatbot
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.google_ai || process.env.GOOGLE_AI_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemma-3-4b-it:generateContent';

// Debug: log API key status (not the key itself)
console.log('[Gemini] API Key configured:', !!GEMINI_API_KEY, 'Length:', GEMINI_API_KEY?.length || 0);
console.log('[Gemini] Using model: gemma-3-4b-it (free tier)');

/**
 * System prompt for DesiTV VJ Assistant
 */
const SYSTEM_PROMPT = `You are DesiTV VJ (Video Jockey), a fun and nostalgic AI assistant for DesiTV - a retro Indian music streaming platform celebrating 2000s Bollywood and Indipop music.

Your personality:
- Enthusiastic about 2000s Indian pop culture and music
- Use casual Hindi words naturally (yaar, mast, dhamaal, bindaas, etc.)
- Reference classic 9XM VJ style humor and catchphrases
- Keep responses SHORT (2-3 sentences max) - you're a VJ, not a lecturer!
- Add relevant emojis sparingly

IMPORTANT - Using Context Data:
- When asked "what's playing?", ONLY use the PROVIDED nowPlaying data
- When you receive data from tools, use EXACTLY what's provided - don't make up information
- If no data is available, say you need to check or ask user to try again

You can help users:
- Tell them what's currently playing (use provided data ONLY)
- Find songs by artist, title, or mood
- Get recommendations based on mood (party, chill, romantic, nostalgic)
- Navigate between channels
- Search for specific songs

When you receive channel/video data from tools, present it in a fun, engaging way.
Always be helpful but brief - this is a TV experience!`;

/**
 * Make a request to Gemini API
 * @param {string} userMessage - User's message
 * @param {Array} conversationHistory - Previous messages
 * @param {Object} context - Additional context (current channel, etc.)
 * @returns {Promise<string>} AI response
 */
async function chat(userMessage, conversationHistory = [], context = {}) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured');
  }

  // Build conversation contents
  const contents = [];
  
  // Build system context as first message (Gemma doesn't support systemInstruction)
  let systemContext = SYSTEM_PROMPT;
  
  // Add current playback context if available
  if (context.currentChannel) {
    systemContext += `\n\nCURRENT STATE:`;
    systemContext += `\n- Channel: ${context.currentChannel}`;
  }
  if (context.currentVideo) {
    systemContext += `\n- Now Playing: "${context.currentVideo.title || 'Unknown'}"`;
    if (context.currentVideo.artist) {
      systemContext += ` by ${context.currentVideo.artist}`;
    }
    systemContext += `\n- Position: Video ${(context.currentVideoIndex || 0) + 1} of ${context.totalVideos || '?'}`;
  }
  
  // Add tool results if available (search results, channel lists, etc.)
  if (context.toolResults) {
    systemContext += `\n\nDATA FROM DATABASE:`;
    if (context.toolResults.nowPlaying) {
      // For now playing queries, format nicely
      const np = context.toolResults.nowPlaying;
      systemContext += `\n- Song: "${np.title}" by ${np.artist}`;
      systemContext += `\n- On: ${np.channel}`;
      systemContext += `\n- ${np.position}`;
    } else {
      systemContext += `\n${JSON.stringify(context.toolResults, null, 2)}`;
    }
  }

  // Add system prompt as first user message for Gemma
  contents.push({
    role: 'user',
    parts: [{ text: `[System Instructions - Follow these guidelines]\n${systemContext}\n\n[End of instructions. Now respond to the user.]` }]
  });
  contents.push({
    role: 'model', 
    parts: [{ text: 'Understood! I\'m DesiTV VJ, ready to help! 🎙️' }]
  });

  // Add conversation history
  for (const msg of conversationHistory.slice(-6)) { // Keep last 6 messages for context
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    });
  }

  // Add current message
  contents.push({
    role: 'user',
    parts: [{ text: userMessage }]
  });

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.8,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 256, // Keep responses short
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Gemini] API error:', error);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract text from response
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('No response from Gemini');
    }

    return text;
  } catch (error) {
    console.error('[Gemini] Chat error:', error);
    throw error;
  }
}

/**
 * Quick response for common queries (cached responses)
 */
const quickResponses = {
  'hi': 'Hey yaar! 👋 Welcome to DesiTV! Kya sun-na hai aaj? Tell me your mood!',
  'hello': 'Namaste! 🙏 DesiTV VJ here! Ready for some 2000s dhamaal?',
  'help': 'Main help karun? 🎵 Ask me about songs, channels, or just tell me your mood - party, chill, romantic, ya nostalgic!',
};

/**
 * Get quick response if available
 */
function getQuickResponse(message) {
  const normalized = message.toLowerCase().trim();
  return quickResponses[normalized] || null;
}

module.exports = {
  chat,
  getQuickResponse,
  SYSTEM_PROMPT
};
