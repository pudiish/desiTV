/**
 * Gemini API Service - Client-Side
 * Direct API calls from browser to Google Gemini
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemma-3-4b-it:generateContent';

/**
 * Get API key from environment (VITE_GOOGLE_AI_KEY)
 */
function getApiKey() {
  return import.meta.env.VITE_GOOGLE_AI_KEY || null;
}

/**
 * Detect mood from message
 */
function detectMood(message) {
  const lower = message.toLowerCase();
  if (lower.match(/\b(party|dance|club|energetic|pump|hype)\b/)) return 'energetic';
  if (lower.match(/\b(romantic|love|soft|slow)\b/)) return 'romantic';
  if (lower.match(/\b(chill|relax|calm|peaceful)\b/)) return 'chill';
  if (lower.match(/\b(nostalgic|old|retro|classic)\b/)) return 'nostalgic';
  return 'neutral';
}

/**
 * Get time of day
 */
function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/**
 * Simple persona selection
 */
function selectPersona(context = {}) {
  const mood = context.mood || detectMood(context.message || '');
  const timeOfDay = context.timeOfDay || getTimeOfDay();
  
  // Default persona
  return {
    name: 'DesiAgent',
    avatar: '🤖',
    catchphrases: ['Yo! Main DesiAgent hoon!', 'Kya chal raha hai?', 'Bolo bhai!']
  };
}

/**
 * Build system prompt
 */
function buildSystemPrompt(persona, context = {}) {
  let prompt = `You are ${persona.name}, a friendly AI assistant for DesiTV - a music streaming platform.
  
You help users discover music, answer questions about what's playing, and suggest songs.
Keep responses short, friendly, and in Hinglish style (mix of Hindi and English).
Use emojis naturally. Be helpful and fun!

Current context:
- Channel: ${context.currentChannel?.name || 'None'}
- Video: ${context.currentVideo?.title || 'None'}
- Mode: ${context.mode || 'live'}`;

  return prompt;
}

/**
 * Chat with Gemini API
 */
export async function chat(userMessage, conversationHistory = [], context = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('VITE_GOOGLE_AI_KEY not configured. Please set it in your .env file.');
  }

  const mood = detectMood(userMessage);
  const timeOfDay = getTimeOfDay();
  const persona = selectPersona({ mood, timeOfDay, ...context });
  const systemPrompt = buildSystemPrompt(persona, context);

  const contents = [];
  
  // System prompt as first message
  contents.push({
    role: 'user',
    parts: [{ text: `[System Instructions]\n${systemPrompt}\n\n[End instructions. Respond as ${persona.name}.]` }]
  });
  contents.push({
    role: 'model',
    parts: [{ text: `${persona.avatar} ${persona.catchphrases[0]}` }]
  });

  // Add conversation history (last 6 messages)
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
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.85,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
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

    return text;
  } catch (error) {
    console.error('[GeminiService] Error:', error);
    throw error;
  }
}
