#!/bin/bash

# ============================================
# Firebase Service Account Setup Helper
# ============================================
# This script helps you convert a Firebase service account JSON
# to the format needed for your .env file

echo "🔐 Firebase Service Account Setup Helper"
echo "=========================================="
echo ""

# Check if a file was provided
if [ -z "$1" ]; then
    echo "❌ Error: No file provided"
    echo ""
    echo "Usage:"
    echo "  ./scripts/setup-firebase-service-account.sh /path/to/desitv-81d8d-*.json"
    echo ""
    echo "Steps:"
    echo "1. Download service account from Firebase Console:"
    echo "   https://console.firebase.google.com/project/desitv-81d8d/settings/serviceaccounts/adminsdk"
    echo ""
    echo "2. Click 'Generate New Private Key'"
    echo ""
    echo "3. Run this script with the downloaded file:"
    echo "   bash ./scripts/setup-firebase-service-account.sh ~/Downloads/desitv-81d8d-*.json"
    echo ""
    exit 1
fi

# Check if file exists
if [ ! -f "$1" ]; then
    echo "❌ Error: File not found: $1"
    exit 1
fi

echo "📄 Processing: $1"
echo ""

# Validate JSON
if ! jq . "$1" > /dev/null 2>&1; then
    echo "❌ Error: Invalid JSON file"
    exit 1
fi

echo "✅ Valid JSON detected"
echo ""

# Extract values
PROJECT_ID=$(jq -r '.project_id' "$1")
CLIENT_EMAIL=$(jq -r '.client_email' "$1")
PRIVATE_KEY_ID=$(jq -r '.private_key_id' "$1")

echo "📋 Service Account Details:"
echo "   Project: $PROJECT_ID"
echo "   Email: $CLIENT_EMAIL"
echo "   Key ID: $PRIVATE_KEY_ID"
echo ""

# Create minified version
MINIFIED=$(cat "$1" | tr -d '\n' | tr -s ' ')

echo "📦 Minified JSON (for environment variables):"
echo ""
echo "FIREBASE_SERVICE_ACCOUNT=$MINIFIED"
echo ""

# Offer to save to .env
read -p "📝 Add to .env file? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Check if .env exists
    if [ ! -f ".env" ]; then
        echo "⚠️  .env file not found. Creating..."
        touch .env
    fi
    
    # Remove old FIREBASE_SERVICE_ACCOUNT if exists
    if grep -q "^FIREBASE_SERVICE_ACCOUNT=" .env; then
        echo "🔄 Updating existing FIREBASE_SERVICE_ACCOUNT..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|^FIREBASE_SERVICE_ACCOUNT=.*|FIREBASE_SERVICE_ACCOUNT=$MINIFIED|" .env
        else
            sed -i "s|^FIREBASE_SERVICE_ACCOUNT=.*|FIREBASE_SERVICE_ACCOUNT=$MINIFIED|" .env
        fi
    else
        echo "FIREBASE_SERVICE_ACCOUNT=$MINIFIED" >> .env
    fi
    
    echo "✅ Added to .env"
    echo ""
    echo "🔍 Verification:"
    echo "   Run: npm start"
    echo "   Look for: [Auth] Firebase Admin SDK ready (service account)"
else
    echo "⏭️  Skipped. You can manually copy the minified JSON above."
fi

echo ""
echo "📚 For more info, see: docs/FIREBASE_SERVICE_ACCOUNT_SETUP.md"
echo ""
