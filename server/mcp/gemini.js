/**
 * Google Gemini API Client
 * 
 * Uses Gemma 3 4B (free tier with high quota) for DesiTV chatbot
 * Now with persona support!
 */

const { selectPersona, buildSystemPrompt, detectMood, getTimeOfDay } = require('./personas');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.google_ai || process.env.GOOGLE_AI_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemma-3-4b-it:generateContent';

// Debug: log API key status (not the key itself)
console.log('[Gemini] API Key configured:', !!GEMINI_API_KEY, 'Length:', GEMINI_API_KEY?.length || 0);
console.log('[Gemini] Using model: gemma-3-4b-it (free tier)');

/**
 * Make a request to Gemini API with persona support
 * @param {string} userMessage - User's message
 * @param {Array} conversationHistory - Previous messages
 * @param {Object} context - Additional context (current channel, persona, etc.)
 * @returns {Promise<string>} AI response
 */
async function chat(userMessage, conversationHistory = [], context = {}) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured');
  }

  // Detect mood from user message
  const mood = detectMood(userMessage);
  const timeOfDay = getTimeOfDay();
  
  // Select persona based on context
  const persona = selectPersona({
    mood,
    channel: context.currentChannel,
    timeOfDay,
    userPreference: context.persona
  });
  
  console.log(`[Gemini] Selected persona: ${persona.name} (mood: ${mood}, time: ${timeOfDay})`);

  // Build persona-aware system prompt
  let systemContext = buildSystemPrompt(persona, context);
  
  // Add user profile info for personalization
  if (context.userProfile) {
    const profile = context.userProfile;
    systemContext += `\n\n[USER PREFERENCES - Use these to personalize]:`;
    if (profile.favoriteArtists?.length > 0) {
      systemContext += `\n- Favorite artists: ${profile.favoriteArtists.join(', ')}`;
    }
    if (profile.favoriteGenres?.length > 0) {
      systemContext += `\n- Likes: ${profile.favoriteGenres.join(', ')} music`;
    }
    if (profile.triviaScore?.total > 0) {
      const accuracy = Math.round((profile.triviaScore.correct / profile.triviaScore.total) * 100);
      systemContext += `\n- Trivia score: ${accuracy}% (${profile.triviaScore.correct}/${profile.triviaScore.total})`;
    }
    if (profile.interactionCount > 3) {
      systemContext += `\n- Returning user (${profile.interactionCount} interactions)`;
    }
  }
  
  // Add tool results if available
  if (context.toolResults) {
    systemContext += `\n\nDATA FROM DATABASE:`;
    if (context.toolResults.nowPlaying) {
      const np = context.toolResults.nowPlaying;
      systemContext += `\n- Song: "${np.title}" by ${np.artist}`;
      systemContext += `\n- On: ${np.channel}`;
      systemContext += `\n- ${np.position}`;
    } else if (context.toolResults.upNext) {
      const un = context.toolResults.upNext;
      systemContext += `\n- Next Up: "${un.title}" by ${un.artist}`;
      systemContext += `\n- ${un.position}`;
    } else {
      systemContext += `\n${JSON.stringify(context.toolResults, null, 2)}`;
    }
  }

  // Build conversation contents
  const contents = [];
  
  // Add system prompt as first user message for Gemma
  contents.push({
    role: 'user',
    parts: [{ text: `[System Instructions - Follow these guidelines]\n${systemContext}\n\n[End of instructions. Now respond to the user as ${persona.name}.]` }]
  });
  contents.push({
    role: 'model', 
    parts: [{ text: `${persona.avatar} ${persona.catchphrases[0]}` }]
  });

  // Add conversation history
  for (const msg of conversationHistory.slice(-6)) {
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
          temperature: 0.85, // Slightly higher for more personality
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 256,
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Gemini] API error:', error);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    
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
 * Now persona-aware!
 */
function getQuickResponse(message, context = {}) {
  const normalized = message.toLowerCase().trim();
  const { selectPersona, getGreeting, getTimeOfDay } = require('./personas');
  
  const persona = selectPersona({
    channel: context.currentChannel,
    timeOfDay: getTimeOfDay(),
    userPreference: context.persona
  });
  
  // Persona-aware greetings
  if (normalized === 'hi' || normalized === 'hello' || normalized === 'hey') {
    return getGreeting(persona.id);
  }
  
  if (normalized === 'help') {
    return `${persona.avatar} Main ${persona.name} hoon! Ask me about songs, channels, or tell me your mood - party 🎉, romantic 💕, nostalgic 📺, ya chill 🌙!`;
  }
  
  return null;
}

/**
 * Get persona info for frontend
 */
function getPersonaInfo(personaId) {
  const { personas } = require('./personas');
  return personas[personaId] || personas.comedy;
}

module.exports = {
  chat,
  getQuickResponse,
  getPersonaInfo
};
