/**
 * Content Filter Test Suite
 */

const vjCore = require('./server/mcp/vjCore');

async function runTests() {
  console.log('\n========================================');
  console.log('CONTENT FILTERING TEST SUITE');
  console.log('========================================\n');
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Explicit content
  console.log('TEST 1: Explicit content (should be blocked)');
  const explicit = await vjCore.processMessage('sex xxx porn', {});
  if (!explicit.passToAI && explicit.message.includes('DJ Desi')) {
    console.log('✅ PASS - Explicit blocked with DJ Desi response');
    passed++;
  } else {
    console.log('❌ FAIL - Explicit not blocked properly');
    console.log('Response:', explicit.message);
    failed++;
  }
  
  // Test 2: General knowledge (should be blocked)
  console.log('\nTEST 2: General knowledge (should be blocked)');
  const general = await vjCore.processMessage('how does photosynthesis work', {});
  if (!general.passToAI && general.message.includes('DJ Desi')) {
    console.log('✅ PASS - General knowledge blocked');
    passed++;
  } else {
    console.log('❌ FAIL - General knowledge not blocked');
    console.log('Response:', general.message);
    failed++;
  }
  
  // Test 3: DesiTV-related query (should pass through or be handled)
  console.log('\nTEST 3: DesiTV query (should NOT be blocked)');
  const valid = await vjCore.processMessage('tell me about Bollywood music', {});
  if (valid.passToAI && valid.message === null) {
    console.log('✅ PASS - DesiTV query allowed to AI');
    passed++;
  } else if (!valid.passToAI && valid.message.includes('Channel')) {
    console.log('✅ PASS - DesiTV query handled by pre-built');
    passed++;
  } else {
    console.log('❌ FAIL - DesiTV query handling failed');
    console.log('Result:', { passToAI: valid.passToAI, message: valid.message?.substring(0, 50) });
    failed++;
  }
  
  // Test 4: Song query (should not be blocked)
  console.log('\nTEST 4: Song query (should NOT be blocked)');
  const song = await vjCore.processMessage('what song is this', { 
    currentVideo: { title: 'Test Song by Artist' } 
  });
  if (!song.passToAI && song.message.includes('Song')) {
    console.log('✅ PASS - Pre-built song response (no AI needed)');
    passed++;
  } else {
    console.log('❌ FAIL - Song query handling failed');
    failed++;
  }
  
  // Test 5: Behavior detection - male signal
  console.log('\nTEST 5: Behavior detection - male signal');
  const male = await vjCore.processMessage('Yaar, play some party music bhai', {});
  if (male.userBehavior && male.userBehavior.gender === 'male') {
    console.log('✅ PASS - Detected male user signals');
    passed++;
  } else {
    console.log('❌ FAIL - Male behavior not detected');
    failed++;
  }
  
  // Test 6: Behavior detection - female signal
  console.log('\nTEST 6: Behavior detection - female signal');
  const female = await vjCore.processMessage('Sister, play some romantic songs', {});
  if (female.userBehavior && female.userBehavior.gender === 'female') {
    console.log('✅ PASS - Detected female user signals');
    passed++;
  } else {
    console.log('❌ FAIL - Female behavior not detected');
    failed++;
  }
  
  // Test 7: Behavior detection - mood
  console.log('\nTEST 7: Behavior detection - mood');
  const mood = await vjCore.processMessage('I am feeling sad, play chill songs', {});
  if (mood.userBehavior && mood.userBehavior.mood === 'chill') {
    console.log('✅ PASS - Detected chill mood');
    passed++;
  } else {
    console.log('❌ FAIL - Mood not detected');
    failed++;
  }
  
  console.log('\n========================================');
  console.log(`RESULTS: ${passed}/${passed + failed} passed`);
  console.log('========================================\n');
  
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
