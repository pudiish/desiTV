require('dotenv').config();
const { gemini } = require('./server/mcp');

async function test() {
  try {
    const response = await gemini.chat('tell me about adnan shmai', []);
    console.log('\n=== RESPONSE ===');
    console.log('Length:', response.length);
    console.log('Content:', response);
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Full error:', error);
  }
}

test();
