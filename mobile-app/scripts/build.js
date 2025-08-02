#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🚀 Gaza Boycott Helper - Production Build\n');

// Check EAS CLI
try {
  execSync('eas --version', { stdio: 'pipe' });
} catch (error) {
  console.log('📦 Installing EAS CLI...');
  execSync('npm install -g @expo/eas-cli', { stdio: 'inherit' });
}

// Build options
const args = process.argv.slice(2);
const platform = args.includes('--ios') ? 'ios' : args.includes('--android') ? 'android' : 'all';
const profile = args.includes('--preview') ? 'preview' : 'production';

console.log(`🔨 Building for ${platform} with ${profile} profile...\n`);

try {
  const buildCommand = `eas build --platform ${platform} --profile ${profile}`;
  execSync(buildCommand, { stdio: 'inherit' });
  
  console.log('\n✅ Build completed!');
  
} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  process.exit(1);
}