#!/bin/bash

echo "Gaza Boycott Helper - APK Build Script"
echo "======================================"

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo "Installing EAS CLI..."
    npm install -g eas-cli
fi

# Try different build approaches
echo "Attempting to build APK..."

echo "Method 1: EAS Build (Preview)"
if eas build --platform android --profile preview --non-interactive; then
    echo "✅ APK built successfully with EAS!"
    exit 0
fi

echo "Method 2: EAS Build (Development)"
if eas build --platform android --profile development --non-interactive; then
    echo "✅ APK built successfully with EAS Development!"
    exit 0
fi

echo "Method 3: Local Build (requires Android SDK)"
if npx expo run:android --variant release --no-install; then
    echo "✅ APK built locally!"
    echo "APK location: android/app/build/outputs/apk/release/"
    exit 0
fi

echo "❌ All build methods failed."
echo "Solutions:"
echo "1. Check internet connection and try again"
echo "2. Install Android SDK and set ANDROID_HOME"
echo "3. Use the web version in dist/ folder"