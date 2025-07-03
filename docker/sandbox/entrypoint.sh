#!/bin/bash
set -e

echo "Starting LocoDex Sandbox Environment..."

# Initialize Python environment
echo "Setting up Python environment..."
cd /home/sandbox/workspace
mkdir -p python nodejs data output

# Initialize Python environment in python directory
cd python
if [ ! -d "venv" ]; then
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install numpy pandas matplotlib seaborn jupyter ipython flask flask_cors fastapi uvicorn psutil
else
    source venv/bin/activate
    # Ensure critical packages are present even if venv already exists
    pip install --upgrade --quiet flask flask_cors fastapi uvicorn psutil || true
fi

# Initialize Node.js environment
echo "Setting up Node.js environment..."
cd ../nodejs

# Initialize npm if package.json doesn't exist
if [ ! -f "package.json" ]; then
    npm init -y
    npm install express lodash axios moment uuid
fi

# Set environment variables
export PYTHONPATH="/home/sandbox/workspace/python:$PYTHONPATH"
export NODE_PATH="/home/sandbox/workspace/nodejs/node_modules:$NODE_PATH"

# Health check function
health_check() {
    echo "Performing health check..."
    python3 -c "import sys; print(f'Python {sys.version}')"
    node --version
    echo "Sandbox environment is ready!"
}

# Signal handlers for graceful shutdown
cleanup() {
    echo "Shutting down sandbox..."
    # Kill any running processes
    pkill -f python3 || true
    pkill -f node || true
    exit 0
}

trap cleanup SIGTERM SIGINT

# Perform initial health check
health_check

# Create secure communication directories
echo "Setting up secure communication..."
mkdir -p /app/commands /app/results
chmod 755 /app/commands /app/results
chown sandbox:sandbox /app/commands /app/results

# Start the isolated secure executor in background
echo "Starting ULTRA-SECURE isolated executor..."
cd /opt/sandbox
su sandbox -c "python3 /opt/sandbox/secure_executor.py" &

# Wait a moment for executor to start
sleep 2

# Start the file-based sandbox server (no network access)
echo "Starting file-based sandbox server..."
exec python3 /opt/sandbox/sandbox_server.py

