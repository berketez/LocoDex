#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Building LocoDex VS Code Extension...\n');

// Check if we're in the right directory
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error('❌ Error: package.json not found. Run this script from the extension root directory.');
  process.exit(1);
}

// Read package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
console.log(`📦 Building ${packageJson.name} v${packageJson.version}`);

try {
  // Clean previous builds
  console.log('\n🧹 Cleaning previous builds...');
  if (fs.existsSync('./out')) {
    fs.rmSync('./out', { recursive: true, force: true });
  }
  if (fs.existsSync('./dist')) {
    fs.rmSync('./dist', { recursive: true, force: true });
  }

  // Install dependencies
  console.log('\n📥 Installing dependencies...');
  execSync('npm install', { stdio: 'inherit' });

  // Compile TypeScript
  console.log('\n⚡ Compiling TypeScript...');
  execSync('npm run compile', { stdio: 'inherit' });

  // Run tests (if available)
  if (packageJson.scripts && packageJson.scripts.test) {
    console.log('\n🧪 Running tests...');
    try {
      execSync('npm test', { stdio: 'inherit' });
    } catch (error) {
      console.warn('⚠️  Tests failed, but continuing build...');
    }
  }

  // Create dist directory
  if (!fs.existsSync('./dist')) {
    fs.mkdirSync('./dist');
  }

  console.log('\n✅ Build completed successfully!');
  console.log('\n📋 Build Summary:');
  console.log(`   📁 Output directory: ./out`);
  console.log(`   📦 Package: ${packageJson.name}`);
  console.log(`   🏷️  Version: ${packageJson.version}`);
  console.log(`   🎯 Target: VS Code ${packageJson.engines.vscode}`);

} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  process.exit(1);
}