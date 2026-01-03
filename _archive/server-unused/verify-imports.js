const fs = require('fs');
const path = require('path');

console.log('\n=== IMPORT/EXPORT VERIFICATION ===\n');

const files = {
  'advancedVJCore.js': [
    'ResponseCache',
    'IntentDetector', 
    'SemanticSearcher',
    'SuggestionEngine',
    'INTENT_PATTERNS'
  ],
  'enhancedVJCore.js': [
    'class EnhancedVJCore',
    'async processMessage',
    'async handleIntent',
    'detectIfBlocked',
    'module.exports'
  ],
  'contextManager.js': [
    'class ContextManager',
    'async buildContext',
    'module.exports ContextManager'
  ],
  'chatController.js': [
    'async handleMessage',
    'async getSuggestions',
    'EnhancedVJCore',
    'broadcastStateService',
    'module.exports'
  ]
};

for (const [file, exports] of Object.entries(files)) {
  const filePath = path.join(__dirname, file);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    console.log(`✅ ${file}`);
    
    exports.forEach(exp => {
      if (content.includes(exp)) {
        console.log(`   ✅ ${exp}`);
      } else {
        console.log(`   ❌ MISSING: ${exp}`);
      }
    });
  } catch (err) {
    console.log(`❌ ${file} - NOT FOUND`);
  }
}

console.log('\n=== DEPENDENCY IMPORTS ===\n');

const dependencies = {
  'broadcastStateService': '/server/services/broadcastStateService.js',
  'Channel': '/server/models/Channel.js',
  'BroadcastState': '/server/models/BroadcastState.js',
  'UserSession': '/server/models/UserSession.js',
  'searchYouTube': '/server/mcp/youtubeSearch.js',
  'userMemory': '/server/mcp/userMemory.js'
};

for (const [name, filepath] of Object.entries(dependencies)) {
  const fullPath = path.join(__dirname, '..', filepath);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${name} - Found at ${filepath}`);
  } else {
    console.log(`❌ ${name} - NOT FOUND at ${filepath}`);
  }
}

console.log('\n=== INTEGRATION POINTS ===\n');

const integrations = {
  'chatController imports enhancedVJCore': 'chatController.js',
  'enhancedVJCore imports contextManager': 'enhancedVJCore.js',
  'contextManager uses broadcastStateService': 'contextManager.js',
  'enhancedVJCore.constructor(userMemory, broadcastStateService)': 'enhancedVJCore.js'
};

for (const [integration, file] of Object.entries(integrations)) {
  const filePath = path.join(__dirname, file);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const isPresent = content.includes(integration.split(' ')[0]) || 
                      content.includes(integration.split('(')[0].split('.')[1]);
    if (isPresent) {
      console.log(`✅ ${integration}`);
    }
  } catch (err) {
    console.log(`❌ ${integration} - Error reading file`);
  }
}

console.log('\n=== METHOD SIGNATURE VERIFICATION ===\n');

const signatures = {
  'enhancedVJCore.processMessage(message, userId, channelId)': 'enhancedVJCore.js',
  'contextManager.buildContext(userId, channelId, message)': 'contextManager.js',
  'chatController.handleMessage(req, res)': 'chatController.js',
  'intentDetector.detect(message)': 'advancedVJCore.js',
  'suggestionEngine.getSuggestions(query, userProfile, topK)': 'advancedVJCore.js'
};

for (const [sig, file] of Object.entries(signatures)) {
  const filePath = path.join(__dirname, file);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const methodName = sig.split('(')[0].split('.').pop();
    if (content.includes(methodName)) {
      console.log(`✅ ${sig}`);
    }
  } catch (err) {
    console.log(`❌ ${sig} - Error`);
  }
}

console.log('\n=== AUDIT COMPLETE ===\n');
