#!/bin/bash

# LocoDex Kubernetes Deployment Script
# This script deploys the entire LocoDex platform to Kubernetes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Check if kubectl is installed
check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        error "kubectl is not installed. Please install kubectl first."
    fi
    log "kubectl is installed"
}

# Check if cluster is accessible
check_cluster() {
    if ! kubectl cluster-info &> /dev/null; then
        error "Cannot connect to Kubernetes cluster. Please check your kubeconfig."
    fi
    log "Connected to Kubernetes cluster"
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
    
    # Build Deep Research image
    log "Building Deep Research image..."
    docker build -f src/services/deep_research_service/Dockerfile -t locodex/deep-research:latest src/services/deep_research_service/
    
    # Build DeepSearch image
    log "Building DeepSearch image..."
    docker build -f src/services/deepsearch/Dockerfile -t locodex/deepsearch:latest src/services/deepsearch/
    
    log "All Docker images built successfully"
}

# Create persistent volume directories
create_pv_dirs() {
    log "Creating persistent volume directories..."
    
    sudo mkdir -p /data/locodex
    sudo mkdir -p /data/redis
    sudo mkdir -p /data/mongodb
    sudo mkdir -p /data/elasticsearch
    sudo mkdir -p /data/prometheus
    sudo mkdir -p /data/grafana
    sudo mkdir -p /data/minio
    
    sudo chown -R $USER:$USER /data/
    
    log "Persistent volume directories created"
}

# Deploy Kubernetes resources
deploy_k8s() {
    log "Deploying Kubernetes resources..."
    
    # Create namespace and basic resources
    log "Creating namespace and basic resources..."
    kubectl apply -f k8s/namespace.yaml
    
    # Create secrets and configmaps
    log "Creating secrets and configmaps..."
    kubectl apply -f k8s/secrets.yaml
    kubectl apply -f k8s/configmaps.yaml
    kubectl apply -f k8s/prometheus-config.yaml
    
    # Create persistent volumes
    log "Creating persistent volumes..."
    kubectl apply -f k8s/persistent-volumes.yaml
    
    # Deploy database services first
    log "Deploying database services..."
    kubectl apply -f k8s/deployments.yaml
    
    # Wait for databases to be ready
    log "Waiting for databases to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment/locodex-redis -n locodex
    kubectl wait --for=condition=available --timeout=300s deployment/locodex-mongodb -n locodex
    kubectl wait --for=condition=available --timeout=300s deployment/locodex-elasticsearch -n locodex
    
    # Deploy application services
    log "Deploying application services..."
    kubectl apply -f k8s/services.yaml
    
    # Deploy monitoring services
    log "Deploying monitoring services..."
    kubectl apply -f k8s/monitoring-deployments.yaml
    
    # Deploy ingress
    log "Deploying ingress..."
    kubectl apply -f k8s/ingress.yaml
    
    log "All Kubernetes resources deployed"
}

# Wait for deployments to be ready
wait_for_deployments() {
    log "Waiting for all deployments to be ready..."
    
    deployments=(
        "locodex-ai-agent"
        "locodex-deep-research"
        "locodex-deepsearch"
        "locodex-redis"
        "locodex-mongodb"
        "locodex-elasticsearch"
        "locodex-celery-worker"
        "locodex-celery-beat"
        "locodex-nginx"
        "locodex-prometheus"
        "locodex-grafana"
        "locodex-jaeger"
        "locodex-flower"
        "locodex-minio"
    )
    
    for deployment in "${deployments[@]}"; do
        log "Waiting for $deployment to be ready..."
        kubectl wait --for=condition=available --timeout=300s deployment/$deployment -n locodex || warn "$deployment did not become ready in time"
    done
    
    log "All deployments are ready"
}

# Display status
show_status() {
    log "Deployment Status:"
    echo ""
    kubectl get pods -n locodex -o wide
    echo ""
    kubectl get services -n locodex
    echo ""
    kubectl get ingress -n locodex
    echo ""
    
    log "Access URLs:"
    echo -e "${BLUE}Main Application:${NC} http://locodex.local"
    echo -e "${BLUE}API Endpoint:${NC} http://api.locodex.local"
    echo -e "${BLUE}Monitoring:${NC} http://monitoring.locodex.local"
    echo -e "${BLUE}Grafana:${NC} http://monitoring.locodex.local/grafana (admin/admin123)"
    echo -e "${BLUE}Prometheus:${NC} http://monitoring.locodex.local/prometheus"
    echo -e "${BLUE}Jaeger:${NC} http://monitoring.locodex.local/jaeger"
    echo -e "${BLUE}Flower:${NC} http://monitoring.locodex.local/flower"
    echo -e "${BLUE}MinIO Console:${NC} http://monitoring.locodex.local/minio (minioadmin/minioadmin123)"
    echo ""
    
    log "Add these entries to your /etc/hosts file:"
    echo "127.0.0.1 locodex.local"
    echo "127.0.0.1 api.locodex.local"
    echo "127.0.0.1 monitoring.locodex.local"
}

# Main deployment function
main() {
    log "Starting LocoDex Kubernetes deployment..."
    
    # Pre-flight checks
    check_kubectl
    check_cluster
    
    # Build and deploy
    build_images
    create_pv_dirs
    deploy_k8s
    wait_for_deployments
    show_status
    
    log "LocoDex deployment completed successfully!"
}

# Parse command line arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "build")
        build_images
        ;;
    "status")
        show_status
        ;;
    "clean")
        log "Cleaning up LocoDex deployment..."
        kubectl delete namespace locodex --ignore-not-found=true
        sudo rm -rf /data/
        log "Cleanup completed"
        ;;
    "restart")
        log "Restarting LocoDex deployment..."
        kubectl rollout restart deployment -n locodex
        log "Restart initiated"
        ;;
    *)
        echo "Usage: $0 {deploy|build|status|clean|restart}"
        echo "  deploy  - Full deployment (default)"
        echo "  build   - Build Docker images only"
        echo "  status  - Show deployment status"
        echo "  clean   - Remove all resources"
        echo "  restart - Restart all deployments"
        exit 1
        ;;
esac