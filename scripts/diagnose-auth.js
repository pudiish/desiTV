#!/usr/bin/env node

/**
 * DesiTV™ Authentication Diagnostic Script
 * 
 * Usage: node scripts/diagnose-auth.js
 * 
 * This script checks:
 * ✓ Environment variables
 * ✓ Firebase service account validity
 * ✓ Firebase Admin SDK initialization
 * ✓ JWT configuration
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 DesiTV™ Authentication Diagnostic\n');
console.log('='.repeat(60));

// Load .env file
require('dotenv').config();

let issuesFound = 0;
let warningsFound = 0;

// Helper functions
const check = (name, condition, errorMsg = '', warningMsg = '') => {
  if (!condition) {
    console.log(`❌ ${name}`);
    if (errorMsg) console.log(`   └─ ${errorMsg}`);
    issuesFound++;
  } else {
    console.log(`✅ ${name}`);
    if (warningMsg) {
      console.log(`   ⚠️  ${warningMsg}`);
      warningsFound++;
    }
  }
};

// 1. Check environment variables
console.log('\n📋 Environment Variables');
console.log('-'.repeat(60));

const hasFirebaseServiceAccount = !!process.env.FIREBASE_SERVICE_ACCOUNT;
const hasJwtSecret = !!process.env.JWT_SECRET;
const hasClientUrl = !!process.env.CLIENT_URL;
const hasCorsOrigin = !!process.env.CORS_ORIGIN;

check('FIREBASE_SERVICE_ACCOUNT', hasFirebaseServiceAccount, 
  'Required for Firebase token verification');

check('JWT_SECRET', hasJwtSecret,
  'Required for JWT token fallback');

check('CLIENT_URL', hasClientUrl,
  'Recommended for CORS configuration');

check('CORS_ORIGIN', hasCorsOrigin,
  'Recommended for CORS configuration');

// 2. Validate Firebase Service Account JSON
if (hasFirebaseServiceAccount) {
  console.log('\n🔐 Firebase Service Account Validation');
  console.log('-'.repeat(60));
  
  try {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    
    check('Valid JSON', true);
    check('Has type', sa.type === 'service_account', 'Expected type: "service_account"');
    check('Has project_id', !!sa.project_id, 'Project ID is required');
    check('Has private_key', !!sa.private_key, 'Private key is required');
    check('Has client_email', !!sa.client_email, 'Client email is required');
    
    if (sa.project_id) {
      console.log(`   Project: ${sa.project_id}`);
    }
    if (sa.client_email) {
      console.log(`   Email: ${sa.client_email}`);
    }
  } catch (err) {
    check('Valid JSON', false, 'Firebase service account is not valid JSON: ' + err.message);
  }
}

// 3. Test Firebase Admin SDK initialization
console.log('\n🔥 Firebase Admin SDK Initialization');
console.log('-'.repeat(60));

try {
  const admin = require('firebase-admin');
  
  if (hasFirebaseServiceAccount) {
    try {
      if (admin.apps.length === 0) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: 'desitv-81d8d'
        });
      }
      
      check('Firebase Admin SDK', true, '', 'Successfully initialized');
      
      const auth = admin.auth();
      check('Firebase Auth instance', !!auth, '', 'Ready for token verification');
    } catch (err) {
      check('Firebase Admin SDK', false, err.message);
    }
  } else {
    console.log('⏭️  Skipping (FIREBASE_SERVICE_ACCOUNT not set)');
  }
} catch (err) {
  check('Firebase Admin SDK', false, 'firebase-admin module not found');
}

// 4. Check client-side Firebase config
console.log('\n📱 Client-Side Firebase Config');
console.log('-'.repeat(60));

const clientFirebaseFile = path.join(
  __dirname,
  '../client/src/config/firebase.js'
);

if (fs.existsSync(clientFirebaseFile)) {
  try {
    const content = fs.readFileSync(clientFirebaseFile, 'utf8');
    check('Firebase config file exists', true);
    check('Has apiKey', content.includes('apiKey'), 'Firebase config incomplete');
    check('Has projectId', content.includes('projectId'), 'Firebase config incomplete');
    check('Has authDomain', content.includes('authDomain'), 'Firebase config incomplete');
  } catch (err) {
    check('Firebase config file', false, err.message);
  }
} else {
  check('Firebase config file', false, 'File not found: ' + clientFirebaseFile);
}

// 5. Check authentication middleware
console.log('\n🛡️  Authentication Middleware');
console.log('-'.repeat(60));

const authMiddlewareFile = path.join(
  __dirname,
  '../server/middleware/auth.js'
);

if (fs.existsSync(authMiddlewareFile)) {
  try {
    const content = fs.readFileSync(authMiddlewareFile, 'utf8');
    check('Auth middleware file exists', true);
    check('Has requireAuth export', content.includes('module.exports.requireAuth'), 
      'requireAuth not exported');
    check('Firebase verification implemented', content.includes('verifyFirebaseToken'),
      'Firebase token verification not found');
    check('JWT fallback implemented', content.includes('verifyJwtToken'),
      'JWT token verification not found');
  } catch (err) {
    check('Auth middleware', false, err.message);
  }
} else {
  check('Auth middleware file', false, 'File not found: ' + authMiddlewareFile);
}

// 6. Summary
console.log('\n' + '='.repeat(60));
console.log('\n📊 Summary');
console.log('-'.repeat(60));

if (issuesFound === 0 && warningsFound === 0) {
  console.log('✅ All checks passed! Your authentication setup looks good.');
  console.log('\nNext step: Test with actual login');
  console.log('1. Go to http://localhost:5173/admin/login');
  console.log('2. Login with your Firebase credentials');
  console.log('3. Try adding a video');
} else {
  console.log(`⚠️  Found ${issuesFound} issue(s) and ${warningsFound} warning(s)\n`);
  
  if (issuesFound > 0) {
    console.log('🔧 Quick fixes:');
    
    if (!hasFirebaseServiceAccount) {
      console.log('\n1. Get Firebase Service Account:');
      console.log('   - Go to: https://console.firebase.google.com/project/desitv-81d8d/settings/serviceaccounts/adminsdk');
      console.log('   - Click "Generate New Private Key"');
      console.log('   - Minify the JSON: cat desitv-81d8d-*.json | jq -c .');
      console.log('   - Add to .env: FIREBASE_SERVICE_ACCOUNT=<minified-json>');
    }
    
    if (!hasJwtSecret) {
      console.log('\n2. Generate JWT_SECRET:');
      console.log('   - node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
      console.log('   - Add to .env: JWT_SECRET=<generated-secret>');
    }
    
    console.log('\n3. Restart your server after updating .env');
    console.log('   - Local: npm run dev');
    console.log('   - Production: Redeploy to Render');
  }
}

console.log('\n' + '='.repeat(60) + '\n');

process.exit(issuesFound > 0 ? 1 : 0);
