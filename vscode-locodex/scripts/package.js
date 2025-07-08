#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('📦 Packaging LocoDex VS Code Extension...\n');

// Check if we're in the right directory
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error('❌ Error: package.json not found. Run this script from the extension root directory.');
  process.exit(1);
}

// Read package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
console.log(`📦 Packaging ${packageJson.name} v${packageJson.version}`);

try {
  // Check if vsce is installed
  try {
    execSync('vsce --version', { stdio: 'pipe' });
  } catch (error) {
    console.log('\n📥 Installing vsce (VS Code Extension CLI)...');
    execSync('npm install -g vsce', { stdio: 'inherit' });
  }

  // Build the extension first
  console.log('\n🚀 Building extension...');
  execSync('node scripts/build.js', { stdio: 'inherit' });

  // Create dist directory if it doesn't exist
  if (!fs.existsSync('./dist')) {
    fs.mkdirSync('./dist');
  }

  // Package the extension
  console.log('\n📦 Creating VSIX package...');
  const vsixName = `${packageJson.name}-${packageJson.version}.vsix`;
  const outputPath = path.join('./dist', vsixName);
  
  execSync(`vsce package --out "${outputPath}"`, { stdio: 'inherit' });

  // Verify the package was created
  if (fs.existsSync(outputPath)) {
    const stats = fs.statSync(outputPath);
    const fileSizeInBytes = stats.size;
    const fileSizeInMB = (fileSizeInBytes / (1024 * 1024)).toFixed(2);

    console.log('\n✅ Package created successfully!');
    console.log('\n📋 Package Summary:');
    console.log(`   📁 File: ${outputPath}`);
    console.log(`   📏 Size: ${fileSizeInMB} MB`);
    console.log(`   🏷️  Version: ${packageJson.version}`);
    console.log(`   📝 Description: ${packageJson.description}`);

    console.log('\n🎯 Next Steps:');
    console.log('   1. Install: code --install-extension ' + outputPath);
    console.log('   2. Or: VS Code → Extensions → Install from VSIX → Select file');
    console.log('   3. Restart VS Code to activate the extension');

    // Generate installation script
    const installScript = `#!/bin/bash
# LocoDex VS Code Extension Installation Script

echo "🚀 Installing LocoDex AI Code Assistant..."

# Check if VS Code is installed
if ! command -v code &> /dev/null; then
    echo "❌ VS Code CLI not found. Please install VS Code first."
    echo "   Or add 'code' command to your PATH:"
    echo "   - Open VS Code"
    echo "   - Open Command Palette (Ctrl+Shift+P)"
    echo "   - Run 'Shell Command: Install code command in PATH'"
    exit 1
fi

# Install the extension
echo "📦 Installing extension..."
code --install-extension "${outputPath}"

if [ $? -eq 0 ]; then
    echo "✅ LocoDex extension installed successfully!"
    echo ""
    echo "🎯 Next steps:"
    echo "   1. Restart VS Code"
    echo "   2. Open Command Palette (Ctrl+Shift+P)"
    echo "   3. Run 'LocoDex: Configure' to set up your AI services"
    echo ""
    echo "📚 Documentation: See README.md for setup instructions"
else
    echo "❌ Installation failed. Please try installing manually:"
    echo "   1. Open VS Code"
    echo "   2. Go to Extensions (Ctrl+Shift+X)"
    echo "   3. Click '...' → Install from VSIX"
    echo "   4. Select: ${outputPath}"
fi
`;

    const installScriptPath = path.join('./dist', 'install.sh');
    fs.writeFileSync(installScriptPath, installScript);
    
    // Make install script executable
    try {
      execSync(`chmod +x "${installScriptPath}"`);
      console.log(`   📜 Installation script: ${installScriptPath}`);
    } catch (error) {
      console.log(`   📜 Installation script: ${installScriptPath} (run with bash)`);
    }

  } else {
    throw new Error('Package file was not created');
  }

} catch (error) {
  console.error('\n❌ Packaging failed:', error.message);
  
  if (error.message.includes('vsce')) {
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Install vsce globally: npm install -g vsce');
    console.log('   2. Ensure you have the latest Node.js version');
    console.log('   3. Check package.json for missing required fields');
  }
  
  process.exit(1);
}