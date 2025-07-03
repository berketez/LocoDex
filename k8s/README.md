# LocoDex Kubernetes Deployment

This directory contains Kubernetes manifests and deployment scripts for the LocoDex platform, migrated from Docker Compose.

## Architecture Overview

The LocoDex platform consists of the following components:

### Core Services
- **AI Agent Service** (Port 3001) - Main AI processing service
- **Sandbox Service** (Internal) - Secure code execution environment
- **Deep Research Service** (Port 8001) - Research and analysis service
- **DeepSearch Service** (Ports 5000, 5001, 8000) - Search and indexing service

### Data Services
- **Redis** - Caching and session management
- **MongoDB** - Document storage
- **Elasticsearch** - Full-text search and indexing
- **MinIO** - Object storage for files

### Background Processing
- **Celery Workers** - Async task processing
- **Celery Beat** - Task scheduling
- **Flower** - Celery monitoring

### Monitoring & Observability
- **Prometheus** - Metrics collection
- **Grafana** - Visualization dashboards
- **Jaeger** - Distributed tracing
- **Nginx** - API Gateway and load balancing

## Quick Start

### Prerequisites

1. **Kubernetes Cluster**: Ensure you have a running Kubernetes cluster
   ```bash
   kubectl cluster-info
   ```

2. **Docker**: For building images
   ```bash
   docker --version
   ```

3. **kubectl**: Kubernetes CLI tool
   ```bash
   kubectl version --client
   ```

### Deployment

1. **Clone and navigate to k8s directory**:
   ```bash
   cd /path/to/LocoDex-Final/k8s
   ```

2. **Deploy everything with the script**:
   ```bash
   ./deploy.sh deploy
   ```

3. **Or deploy manually step by step**:
   ```bash
   # Create namespace and basic resources
   kubectl apply -f namespace.yaml
   
   # Create secrets and config
   kubectl apply -f secrets.yaml
   kubectl apply -f configmaps.yaml
   kubectl apply -f prometheus-config.yaml
   
   # Create storage
   kubectl apply -f persistent-volumes.yaml
   
   # Deploy services
   kubectl apply -f deployments.yaml
   kubectl apply -f services.yaml
   kubectl apply -f monitoring-deployments.yaml
   
   # Deploy ingress
   kubectl apply -f ingress.yaml
   ```

### Access the Application

Add these entries to your `/etc/hosts` file:
```
127.0.0.1 locodex.local
127.0.0.1 api.locodex.local
127.0.0.1 monitoring.locodex.local
```

**Access URLs:**
- Main Application: http://locodex.local
- API Endpoint: http://api.locodex.local
- Monitoring Dashboard: http://monitoring.locodex.local

**Monitoring Tools:**
- Grafana: http://monitoring.locodex.local/grafana (admin/admin123)
- Prometheus: http://monitoring.locodex.local/prometheus
- Jaeger: http://monitoring.locodex.local/jaeger
- Flower (Celery): http://monitoring.locodex.local/flower
- MinIO Console: http://monitoring.locodex.local/minio (minioadmin/minioadmin123)

## File Structure

```
k8s/
├── namespace.yaml              # Namespace, quotas, and limits
├── secrets.yaml               # Sensitive configuration data
├── configmaps.yaml            # Application configuration
├── persistent-volumes.yaml    # Storage definitions
├── deployments.yaml           # Main application deployments
├── services.yaml              # Service definitions
├── monitoring-deployments.yaml # Monitoring stack deployments
├── ingress.yaml               # External access and routing
├── prometheus-config.yaml     # Prometheus configuration
├── deploy.sh                  # Automated deployment script
└── README.md                  # This file
```

## Security Features

### Network Security
- **Network Policies**: Restrict inter-pod communication
- **Sandbox Isolation**: Completely isolated network for sandbox service
- **TLS/SSL**: HTTPS termination at ingress
- **Rate Limiting**: Protection against abuse

### Container Security
- **Non-root users**: All containers run as non-root
- **Read-only filesystems**: Where applicable
- **Security contexts**: Dropped capabilities, no privilege escalation
- **Resource limits**: CPU and memory constraints

### Data Security
- **Secrets management**: Encrypted secrets for sensitive data
- **ConfigMaps**: Non-sensitive configuration separation
- **Persistent volumes**: Data persistence with proper permissions

## Scaling and High Availability

### Horizontal Pod Autoscaling (HPA)
- **AI Agent**: 2-10 replicas based on CPU/memory usage
- **Deep Research**: 1-5 replicas based on load
- **Celery Workers**: 2-8 replicas based on queue length

### Database Clustering
- **Redis**: Single instance with persistence
- **MongoDB**: Single instance (can be scaled to replica set)
- **Elasticsearch**: Single node (can be scaled to cluster)

### Load Balancing
- **Nginx Ingress**: External load balancing
- **Kubernetes Services**: Internal load balancing
- **Round-robin**: Default load balancing algorithm

## Monitoring and Observability

### Metrics Collection
- **Prometheus**: Scrapes metrics from all services
- **Custom metrics**: Application-specific metrics
- **Resource monitoring**: CPU, memory, disk, network

### Visualization
- **Grafana**: Pre-configured dashboards
- **Real-time monitoring**: Live metrics and alerts
- **Historical data**: Long-term trend analysis

### Tracing
- **Jaeger**: Distributed request tracing
- **OpenTelemetry**: Standard observability protocol
- **Performance analysis**: Request flow visualization

### Logging
- **Centralized logging**: Fluentd for log aggregation
- **Structured logs**: JSON format for better parsing
- **Log retention**: Configurable retention policies

## Operations

### Deployment Commands

```bash
# Full deployment
./deploy.sh deploy

# Build images only
./deploy.sh build

# Check status
./deploy.sh status

# Restart all services
./deploy.sh restart

# Clean everything
./deploy.sh clean
```

### Manual Operations

```bash
# Check pod status
kubectl get pods -n locodex

# View logs
kubectl logs -f deployment/locodex-ai-agent -n locodex

# Scale deployment
kubectl scale deployment locodex-ai-agent --replicas=5 -n locodex

# Update configuration
kubectl edit configmap locodex-config -n locodex

# Port forwarding for debugging
kubectl port-forward svc/locodex-ai-agent 3001:3001 -n locodex
```

### Troubleshooting

1. **Pods not starting**: Check resource constraints and image availability
   ```bash
   kubectl describe pod <pod-name> -n locodex
   ```

2. **Services not accessible**: Verify service and ingress configuration
   ```bash
   kubectl get svc,ingress -n locodex
   ```

3. **Database connection issues**: Check database pod status and network policies
   ```bash
   kubectl exec -it deployment/locodex-redis -n locodex -- redis-cli ping
   ```

4. **Resource issues**: Monitor resource usage
   ```bash
   kubectl top pods -n locodex
   ```

## Configuration

### Environment Variables
Most configuration is handled through ConfigMaps and Secrets. Key variables include:

- **Database connections**: Redis, MongoDB, Elasticsearch URLs
- **External services**: Ollama, LMStudio hosts
- **Security settings**: Passwords, API keys, certificates
- **Resource limits**: Memory, CPU constraints

### Custom Configuration
To modify configuration:

1. Edit the ConfigMaps or Secrets files
2. Apply the changes: `kubectl apply -f configmaps.yaml`
3. Restart affected deployments: `kubectl rollout restart deployment/<name> -n locodex`

## Production Considerations

### Resource Planning
- **CPU**: Minimum 8 cores recommended
- **Memory**: Minimum 32GB RAM recommended
- **Storage**: At least 100GB persistent storage
- **Network**: High-bandwidth for AI model operations

### Backup Strategy
- **Database backups**: Regular MongoDB and Redis snapshots
- **Configuration backups**: Git repository for K8s manifests
- **Application data**: Persistent volume backups

### Security Hardening
- **Network policies**: Implement strict network segmentation
- **RBAC**: Role-based access control for cluster access
- **Image scanning**: Regular vulnerability scans
- **Secret rotation**: Regular password and key updates

### Monitoring and Alerting
- **Health checks**: Comprehensive liveness and readiness probes
- **Alert rules**: CPU, memory, disk, and application-specific alerts
- **On-call procedures**: Clear escalation paths for incidents

## Migration from Docker Compose

This Kubernetes setup maintains feature parity with the original Docker Compose configuration while adding:

- **High availability**: Multiple replicas for critical services
- **Auto-scaling**: Dynamic scaling based on load
- **Better networking**: Service mesh capabilities
- **Enhanced monitoring**: More comprehensive observability
- **Rolling updates**: Zero-downtime deployments
- **Resource management**: Better resource allocation and limits

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review Kubernetes and application logs
3. Consult the original Docker Compose documentation
4. Open an issue in the project repository