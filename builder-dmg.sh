#!/bin/bash

# --- LocoDex Automated Build and Packaging for macOS ---
# This script automates the entire build and packaging process for the LocoDex application.
# It ensures all dependencies are installed, builds the CLI and the main application,
# and finally packages it into a distributable DMG file.

# Exit immediately if a command exits with a non-zero status.
set -e

# Function for logging steps
log_step() {
    echo "
--- $1 ---"
}

log_step "Step 1/4: Cleaning up previous builds"
echo "Removing 'dist' and 'dist-electron' directories to ensure a clean build..."
rm -rf dist dist-electron
echo "Cleanup complete."

log_step "Step 2/4: Installing all required dependencies"
echo "Installing dependencies for the main application..."
npm install

echo "Installing dependencies for the CLI package..."
(cd packages/cli && npm install)
echo "✅ All dependencies installed successfully."

log_step "Step 3/4: Building the required assets"
echo "Building the command-line interface (CLI)..."
npm run cli:build

echo "Building the Vite frontend application..."
npm run build
echo "✅ All assets built successfully."

log_step "Step 4/4: Packaging the Electron application for macOS"
echo "Starting the electron-builder process to create the DMG file..."
# We use --mac --arm64 to create an ARM64 binary for Apple Silicon only
npx electron-builder --mac --arm64
echo "✅ Application packaged successfully."

log_step "🎉 Build Complete! 🎉"
echo "You can find the final DMG file in the 'dist-electron' directory."