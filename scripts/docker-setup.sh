#!/bin/bash

# LocoDex Docker Setup Script
# This script sets up the Docker environment for LocoDex

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if Docker is installed
check_docker() {
    log "Checking Docker installation..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker Desktop for Mac first."
        echo "Visit: https://docs.docker.com/desktop/mac/install/"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Desktop for Mac first."
        echo "Visit: https://docs.docker.com/desktop/mac/install/"
        exit 1
    fi
    
    success "Docker is installed"
}

# Check if Docker daemon is running
check_docker_daemon() {
    log "Checking Docker daemon..."
    
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running. Please start Docker first."
        exit 1
    fi
    
    success "Docker daemon is running"
}

# Create necessary directories
create_directories() {
    log "Creating necessary directories..."
    
    mkdir -p data logs
    mkdir -p docker/nginx/ssl
    mkdir -p docker/prometheus
    mkdir -p docker/grafana/provisioning
    
    success "Directories created"
}

# Generate SSL certificates for development
generate_ssl_certs() {
    log "Generating SSL certificates for development..."
    
    if [ ! -f "docker/nginx/ssl/cert.pem" ]; then
        openssl req -x509 -newkey rsa:4096 -keyout docker/nginx/ssl/key.pem -out docker/nginx/ssl/cert.pem -days 365 -nodes -subj "/C=TR/ST=Istanbul/L=Istanbul/O=LocoDex/CN=localhost"
        success "SSL certificates generated"
    else
        warning "SSL certificates already exist"
    fi
}

# Create Prometheus configuration
create_prometheus_config() {
    log "Creating Prometheus configuration..."
    
    cat > docker/prometheus/prometheus.yml << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  # - "first_rules.yml"
  # - "second_rules.yml"

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'ai-agent'
    static_configs:
      - targets: ['ai-agent:3001']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'sandbox'
    static_configs:
      - targets: ['sandbox:3002']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'nginx'
    static_configs:
      - targets: ['api-gateway:80']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']
    scrape_interval: 30s
EOF
    
    success "Prometheus configuration created"
}

# Create requirements.txt for Python dependencies
create_requirements() {
    log "Creating Python requirements file..."
    
    cat > requirements.txt << EOF
# Core dependencies
flask==2.3.3
flask-cors==4.0.0
requests==2.31.0
psutil==5.9.5

# AI and ML libraries
numpy==1.24.3
pandas==2.0.3
matplotlib==3.7.2
seaborn==0.12.2

# Async support
asyncio-mqtt==0.13.0

# Security
cryptography==41.0.3

# Utilities
python-dotenv==1.0.0
pyyaml==6.0.1
EOF
    
    success "Requirements file created"
}

# Create package.json for Node.js dependencies
create_package_json() {
    log "Creating package.json for AI Agent..."
    
    cat > docker/ai-agent/package.json << EOF
{
  "name": "locodex-ai-agent",
  "version": "1.0.0",
  "description": "LocoDex AI Agent Service",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "express-rate-limit": "^6.8.1",
    "http-proxy-middleware": "^2.0.6",
    "ws": "^8.13.0",
    "node-fetch": "^3.3.1",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1",
    "jest": "^29.6.1"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF
    
    success "Package.json created"
}

# Build Docker images
build_images() {
    log "Building Docker images..."
    
    # Build AI Agent image
    log "Building AI Agent image..."
    docker build -f docker/Dockerfile.ai-agent -t locodex/ai-agent:latest .
    
    # Build Sandbox image
    log "Building Sandbox image..."
    docker build -f docker/Dockerfile.sandbox -t locodex/sandbox:latest .
    
    success "Docker images built successfully"
}

# Start services
start_services() {
    log "Starting LocoDex services..."
    
    # Start core services
    docker-compose up -d ai-agent sandbox api-gateway redis
    
    # Wait for services to be healthy
    log "Waiting for services to be healthy..."
    sleep 30
    
    # Check service health
    check_service_health
    
    success "LocoDex services started successfully"
}

# Start services with monitoring
start_with_monitoring() {
    log "Starting LocoDex services with monitoring..."
    
    docker-compose --profile monitoring up -d
    
    # Wait for services to be healthy
    log "Waiting for services to be healthy..."
    sleep 45
    
    # Check service health
    check_service_health
    
    success "LocoDex services with monitoring started successfully"
}

# Check service health
check_service_health() {
    log "Checking service health..."
    
    # Check AI Agent
    if curl -f http://localhost:3001/health &> /dev/null; then
        success "AI Agent is healthy"
    else
        warning "AI Agent health check failed"
    fi
    
    # Check Sandbox
    if curl -f http://localhost:3002/health &> /dev/null; then
        success "Sandbox is healthy"
    else
        warning "Sandbox health check failed"
    fi
    
    # Check API Gateway
    if curl -f http://localhost:8080/health &> /dev/null; then
        success "API Gateway is healthy"
    else
        warning "API Gateway health check failed"
    fi
    
    # Check Redis
    if docker exec locodex-redis redis-cli ping &> /dev/null; then
        success "Redis is healthy"
    else
        warning "Redis health check failed"
    fi
}

# Stop services
stop_services() {
    log "Stopping LocoDex services..."
    
    docker-compose down
    
    success "LocoDex services stopped"
}

# Clean up
cleanup() {
    log "Cleaning up Docker resources..."
    
    # Stop and remove containers
    docker-compose down -v
    
    # Remove images (optional)
    if [ "$1" = "--remove-images" ]; then
        docker rmi locodex/ai-agent:latest locodex/sandbox:latest 2>/dev/null || true
    fi
    
    # Remove volumes (optional)
    if [ "$1" = "--remove-volumes" ]; then
        docker volume prune -f
    fi
    
    success "Cleanup completed"
}

# Show status
show_status() {
    log "LocoDex Service Status:"
    echo
    
    docker-compose ps
    echo
    
    log "Service URLs:"
    echo "  AI Agent:    http://localhost:3001"
    echo "  Sandbox:     http://localhost:3002"
    echo "  API Gateway: http://localhost:8080"
    echo "  Redis:       localhost:6379"
    echo "  Prometheus:  http://localhost:9090 (if monitoring enabled)"
    echo "  Grafana:     http://localhost:3000 (if monitoring enabled)"
}

# Show logs
show_logs() {
    local service=${1:-""}
    
    if [ -n "$service" ]; then
        log "Showing logs for $service..."
        docker-compose logs -f "$service"
    else
        log "Showing logs for all services..."
        docker-compose logs -f
    fi
}

# Main function
main() {
    case "${1:-setup}" in
        "setup")
            log "Setting up LocoDex Docker environment..."
            check_docker
            check_docker_daemon
            create_directories
            generate_ssl_certs
            create_prometheus_config
            create_requirements
            create_package_json
            build_images
            success "Setup completed successfully!"
            echo
            log "Next steps:"
            echo "  1. Run './scripts/docker-setup.sh start' to start services"
            echo "  2. Run './scripts/docker-setup.sh status' to check status"
            ;;
        "build")
            build_images
            ;;
        "start")
            start_services
            show_status
            ;;
        "start-monitoring")
            start_with_monitoring
            show_status
            ;;
        "stop")
            stop_services
            ;;
        "restart")
            stop_services
            sleep 5
            start_services
            show_status
            ;;
        "status")
            show_status
            ;;
        "logs")
            show_logs "$2"
            ;;
        "health")
            check_service_health
            ;;
        "cleanup")
            cleanup "$2"
            ;;
        "help"|"-h"|"--help")
            echo "LocoDex Docker Setup Script"
            echo
            echo "Usage: $0 [command] [options]"
            echo
            echo "Commands:"
            echo "  setup              Set up Docker environment (default)"
            echo "  build              Build Docker images"
            echo "  start              Start services"
            echo "  start-monitoring   Start services with monitoring"
            echo "  stop               Stop services"
            echo "  restart            Restart services"
            echo "  status             Show service status"
            echo "  logs [service]     Show logs (optionally for specific service)"
            echo "  health             Check service health"
            echo "  cleanup [options]  Clean up Docker resources"
            echo "                     --remove-images: Also remove built images"
            echo "                     --remove-volumes: Also remove volumes"
            echo "  help               Show this help message"
            ;;
        *)
            error "Unknown command: $1"
            echo "Run '$0 help' for usage information"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"

