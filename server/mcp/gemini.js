/**
 * Google Gemini API Client
 * 
 * Uses Gemma 3 4B IT (free tier with 30 RPM quota) for DesiTV chatbot
 * Now with persona support!
 */

const { selectPersona, buildSystemPrompt, detectMood, getTimeOfDay } = require('./personas');

const GEMINI_API_KEY = process.env.GOOGLE_AI_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemma-3-4b-it:generateContent';

// Debug: log API key status (not the key itself)
if (!GEMINI_API_KEY) {
  console.warn('[Gemini] WARNING: GOOGLE_AI_KEY environment variable not configured!');
  console.warn('[Gemini] Please set GOOGLE_AI_KEY in your environment');
} else {
  const keyPreview = GEMINI_API_KEY.substring(0, 20) + '...' + GEMINI_API_KEY.substring(GEMINI_API_KEY.length - 5);
  console.log('[Gemini] API Key loaded successfully:', keyPreview);
}
console.log('[Gemini] Using model: gemma-3-4b-it (30 RPM free tier)');

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
  
  // For factual/knowledge queries, ensure accuracy but KEEP the persona
  const looksLikeFactualQuery = /^(tell|what|who|when|where|why|how|about|explain|describe|list)/i.test(userMessage.trim());
  
  if (looksLikeFactualQuery) {
    systemContext += '\n\n[INSTRUCTION: The user asked a factual question. Answer it ACCURATELY, but keep your "Desi" persona. Don\'t be boring. Explain it like you are talking to a friend over chai. Use your Hinglish style.]';
  }
  
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
    const requestBody = {
      contents,
      generationConfig: {
        temperature: 0.85,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      }
    };

    console.log('[Gemini] Making API request to:', GEMINI_API_URL);
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    console.log('[Gemini] Response status:', response.status, response.statusText);

    if (!response.ok) {
      const error = await response.text();
      console.error('[Gemini] API error response:', {
        status: response.status,
        statusText: response.statusText,
        body: error
      });
      
      // Parse error details if JSON
      let errorMessage = `Gemini API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(error);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch (e) {}
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('No response from Gemini');
    }

    console.log('[Gemini] Response text length:', text.length);
    console.log('[Gemini] Response preview:', text.substring(0, 100));

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
