/**
 * VJ Core Test Suite
 */

const vjCore = require('./mcp/vjCore');

async function runTests() {
  console.log('\n========================================');
  console.log('VJ REARCHITECTURE - FULL TEST SUITE');
  console.log('========================================\n');
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Now Playing with actual context
  console.log('TEST 1: Now Playing (Critical Fix)');
  const nowPlaying = await vjCore.processMessage('what song is playing now', {
    currentVideo: { title: 'Full Video: Mauja Hi Mauja | Jab We Met | Shahid Kapoor, Kareena Kapoor | Mika Singh | Pritam' },
    currentChannel: 'Late Night Love',
    currentVideoIndex: 2,
    totalVideos: 10
  });
  
  if (nowPlaying.message && nowPlaying.message.includes('Mauja Hi Mauja')) {
    console.log('✅ PASS - Correct song name in response');
    passed++;
  } else {
    console.log('❌ FAIL - Song name mismatch');
    console.log('Response:', nowPlaying.message);
    failed++;
  }
  
  // Test 2: Artist extraction
  console.log('\nTEST 2: Artist Extraction');
  const artist = vjCore.extractArtistFromTitle('Dil Diyan Gallan | Tiger Zinda Hai | Atif Aslam');
  if (artist === 'Atif Aslam') {
    console.log('✅ PASS - Extracted artist:', artist);
    passed++;
  } else {
    console.log('❌ FAIL - Expected Atif Aslam, got:', artist);
    failed++;
  }
  
  // Test 3: Greeting
  console.log('\nTEST 3: Greeting');
  const greeting = await vjCore.processMessage('hello', {});
  if (greeting.message && (greeting.message.includes('DesiTV') || greeting.message.includes('VJ') || greeting.message.includes('Good'))) {
    console.log('✅ PASS - Greeting response');
    passed++;
  } else {
    console.log('❌ FAIL - Greeting failed');
    failed++;
  }
  
  // Test 4: General passes to AI
  console.log('\nTEST 4: General Message (should pass to AI)');
  const general = await vjCore.processMessage('tell me about Bollywood', {});
  if (general.passToAI) {
    console.log('✅ PASS - General message flagged for AI');
    passed++;
  } else {
    console.log('❌ FAIL - General not passed to AI');
    failed++;
  }
  
  // Test 5: No context handling
  console.log('\nTEST 5: Now Playing without context');
  const noCtx = await vjCore.processMessage('what is playing', {});
  if (noCtx.success === false && noCtx.message.includes('TV on')) {
    console.log('✅ PASS - Gracefully handles missing context');
    passed++;
  } else {
    console.log('❌ FAIL - Bad handling of no context');
    console.log('Response:', noCtx.message);
    failed++;
  }
  
  // Test 6: Trivia
  console.log('\nTEST 6: Trivia');
  const trivia = await vjCore.processMessage('give me a trivia', {});
  if (trivia.message && trivia.message.includes('TRIVIA')) {
    console.log('✅ PASS - Trivia working');
    passed++;
  } else {
    console.log('❌ FAIL - Trivia failed');
    console.log('Response:', trivia.message);
    failed++;
  }
  
  // Test 7: Shayari
  console.log('\nTEST 7: Shayari');
  const shayari = await vjCore.processMessage('share a shayari', {});
  if (shayari.message && shayari.message.includes('shayari')) {
    console.log('✅ PASS - Shayari working');
    passed++;
  } else {
    console.log('❌ FAIL - Shayari failed');
    console.log('Response:', shayari.message);
    failed++;
  }
  
  // Test 8: Thanks
  console.log('\nTEST 8: Thanks');
  const thanks = await vjCore.processMessage('thank you', {});
  if (thanks.message) {
    console.log('✅ PASS - Thanks response');
    passed++;
  } else {
    console.log('❌ FAIL - Thanks failed');
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
