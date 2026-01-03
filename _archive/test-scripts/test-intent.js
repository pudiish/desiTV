const msg = 'hey tell me about adnan shami';
const patterns = {
  greeting: { pattern: /(?:^hi$|^hey$|^hello$|^hiya$|^yo$|^sup$|^namaste$|^howdy$|good\s+(?:morning|evening|night|day)|^g'day$|^howdy$|good\s+night)/i, confidence: 0.99 },
};

console.log('Testing message:', msg);

// First try exact pattern
for (const [name, config] of Object.entries(patterns)) {
  const match = msg.match(config.pattern);
  if (match) {
    console.log('✓ Pattern match found:', name);
    process.exit(0);
  }
}

console.log('✗ No pattern matched');

// Fallback: artist search detection
const lowerMsg = msg.toLowerCase();
if ((lowerMsg.includes('about') || lowerMsg.includes('who') || lowerMsg.includes('info')) && msg.length > 5) {
  const words = msg.split(/\s+/);
  const meaningfulWords = words.filter(w => w.length > 3 && !['about', 'tell', 'who', 'is', 'that'].includes(w.toLowerCase()));
  if (meaningfulWords.length > 0) {
    const artistName = meaningfulWords.slice(-2).join(' ');
    console.log('✓ Artist search detected for:', artistName);
  }
}
