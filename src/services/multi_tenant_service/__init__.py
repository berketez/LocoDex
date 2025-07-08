"""
LocoDex Multi-Tenant Service

A comprehensive multi-tenancy solution providing:
- Tenant isolation and management
- Resource quota enforcement  
- Secure tenant authentication
- Request routing and filtering
- Database and storage isolation

Architecture:
- Core: Tenant management and isolation logic
- API: REST endpoints for tenant operations
- Database: Tenant data isolation and schemas
- Security: Authentication and authorization
- Utils: Common utilities and helpers
"""

__version__ = "1.0.0"
__author__ = "LocoDex Team"

from .core.tenant_manager import TenantManager
from .core.tenant_isolation import TenantIsolation
from .security.tenant_auth import TenantAuth
from .api.tenant_router import TenantRouter

__all__ = [
    "TenantManager",
    "TenantIsolation", 
    "TenantAuth",
    "TenantRouter"
]