# LocoDex Multi-Tenant Service

Comprehensive multi-tenancy solution for the LocoDex platform providing complete tenant isolation, authentication, and management.

## 🏗️ Architecture Overview

```
├── core/                    # Core business logic
│   ├── tenant_manager.py    # Tenant CRUD operations
│   └── tenant_isolation.py  # Data & resource isolation
├── database/                # Database layer
│   ├── models.py           # SQLAlchemy models
│   └── config.py           # Database configuration
├── security/               # Authentication & security
│   └── tenant_auth.py      # JWT & API key auth
├── api/                    # REST API layer
│   ├── endpoints.py        # FastAPI endpoints
│   └── tenant_router.py    # Request routing
├── utils/                  # Utilities
│   ├── validation.py       # Input validation
│   └── encryption.py       # Encryption helpers
└── docker/                 # Docker configuration
    ├── Dockerfile
    ├── docker-compose.tenant.yml
    └── .env.example
```

## 🚀 Features

### 🔒 **Complete Tenant Isolation**
- **Database**: Separate database per tenant
- **Storage**: Isolated file storage with encryption
- **Cache**: Redis namespacing per tenant
- **Resources**: Quota enforcement and monitoring

### 🔐 **Multi-Layer Authentication**
- **JWT Tokens**: Access & refresh tokens
- **API Keys**: Service-to-service authentication
- **Role-Based Access**: Admin, User, Viewer roles
- **Password Security**: PBKDF2 with salt

### 📊 **Resource Management**
- **Quota Enforcement**: API calls, storage, users
- **Usage Tracking**: Real-time monitoring
- **Subscription Plans**: Free, Pro, Enterprise
- **Audit Logging**: Complete activity tracking

### 🌐 **Flexible Tenant Resolution**
- **Subdomain**: `tenant.locodex.com`
- **Custom Domain**: `company.com`
- **Path Prefix**: `/tenant/company/api/`
- **Headers**: `X-Tenant-Slug`
- **API Keys**: Automatic tenant detection

## 📦 Installation & Setup

### Prerequisites
- Python 3.11+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose

### Quick Start

1. **Clone & Navigate**
   ```bash
   cd src/services/multi_tenant_service
   ```

2. **Environment Setup**
   ```bash
   cp docker/.env.example docker/.env
   # Edit docker/.env with your configuration
   ```

3. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run with Docker**
   ```bash
   cd docker
   docker-compose -f docker-compose.tenant.yml up -d
   ```

5. **Initialize Database**
   ```bash
   docker-compose -f docker-compose.tenant.yml --profile migration up
   ```

## 📡 API Endpoints

### Admin Endpoints
```
POST   /admin/tenants              # Create tenant
GET    /admin/tenants              # List tenants
GET    /admin/tenants/{id}         # Get tenant
PUT    /admin/tenants/{id}         # Update tenant
DELETE /admin/tenants/{id}         # Delete tenant
GET    /admin/tenants/{id}/stats   # Get tenant stats
```

### Tenant API
```
POST   /api/v1/auth/login          # User login
POST   /api/v1/auth/refresh        # Refresh token
GET    /api/v1/profile             # User profile
GET    /api/v1/tenant/info         # Tenant info
GET    /api/v1/tenant/stats        # Tenant statistics
GET    /api/v1/tenant/usage        # Resource usage
POST   /api/v1/users               # Create user (admin only)
```

### System Endpoints
```
GET    /health                     # Health check
GET    /health/detailed           # Detailed health
GET    /metrics                   # Basic metrics
GET    /docs                      # API documentation
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MASTER_DATABASE_URL` | Main tenant management DB | Required |
| `TENANT_DATABASE_TEMPLATE` | Template for tenant DBs | Required |
| `JWT_SECRET_KEY` | JWT signing key | Required |
| `REDIS_HOST` | Redis server host | localhost |
| `HOST` | Service bind host | 0.0.0.0 |
| `PORT` | Service port | 8002 |

### Corporate Resource Limits

| Resource | Default Limit |
|----------|---------------|
| Users | 100 |
| Storage | 50GB |
| API Calls/Day | 50,000 |
| AI Requests/Day | 5,000 |

## 🏢 Usage Examples

### Create a Tenant
```python
import httpx

response = httpx.post("http://localhost:8002/admin/tenants", json={
    "name": "Acme Corporation",
    "admin_email": "admin@acme.com",
    "slug": "acme"
})
```

### Authenticate User
```python
response = httpx.post("http://localhost:8002/api/v1/auth/login", 
    headers={"X-Tenant-Slug": "acme"},
    json={
        "email": "user@acme.com",
        "password": "secure_password"
    }
)
```

### Use API with Token
```python
headers = {
    "Authorization": f"Bearer {access_token}",
    "X-Tenant-Slug": "acme"
}
response = httpx.get("http://localhost:8002/api/v1/profile", headers=headers)
```

## 🛡️ Security Features

- **Database Isolation**: Each tenant has separate database
- **Encryption**: Tenant-specific encryption keys
- **Rate Limiting**: Per-tenant API rate limits
- **Audit Logging**: Complete activity tracking
- **Input Validation**: Comprehensive input sanitization
- **Password Security**: PBKDF2 hashing with salt

## 📊 Monitoring

- **Health Checks**: `/health` and `/health/detailed`
- **Metrics**: Basic tenant metrics at `/metrics`
- **Audit Logs**: Stored in `tenant_audit_logs` table
- **Usage Tracking**: Real-time resource usage monitoring

## 🚀 Deployment

### Production Checklist
- [ ] Change default passwords and secrets
- [ ] Configure proper CORS origins
- [ ] Set up SSL/TLS certificates
- [ ] Configure backup strategy
- [ ] Set up monitoring and alerting
- [ ] Review security settings

### Docker Production
```bash
# Production deployment
docker-compose -f docker-compose.tenant.yml up -d

# With monitoring
docker-compose -f docker-compose.tenant.yml --profile admin up -d
```

## 🤝 Integration

This service is designed to be integrated with existing LocoDex services:

1. **Deep Research Service**: Add tenant context to research requests
2. **CLI Tools**: Update to include tenant authentication
3. **Web Interface**: Add tenant selection and management
4. **AI Services**: Implement tenant-aware AI processing

## 📝 License

Part of the LocoDex platform - Internal use only.

---

**Built with ❤️ for LocoDex Platform**