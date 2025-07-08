"""
Tenant Request Router - Routes requests to appropriate tenant contexts
"""

import re
import time
from typing import Optional, Dict, Any, Callable
from urllib.parse import urlparse
from fastapi import Request, HTTPException, Response
from fastapi.routing import APIRoute
import structlog

from ..database.models import Tenant
from ..database.config import db_manager
from ..core.tenant_isolation import tenant_isolation
from ..security.tenant_auth import tenant_auth

logger = structlog.get_logger()

class TenantContext:
    """Container for tenant context information"""
    
    def __init__(
        self,
        tenant: Tenant,
        user_id: Optional[str] = None,
        api_key_id: Optional[str] = None,
        request_id: Optional[str] = None
    ):
        self.tenant = tenant
        self.user_id = user_id
        self.api_key_id = api_key_id
        self.request_id = request_id
        self.start_time = time.time()
    
    @property
    def tenant_id(self) -> str:
        return self.tenant.id
    
    @property
    def tenant_slug(self) -> str:
        return self.tenant.slug
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "tenant_id": self.tenant_id,
            "tenant_slug": self.tenant_slug,
            "user_id": self.user_id,
            "api_key_id": self.api_key_id,
            "request_id": self.request_id
        }

class TenantRouter:
    """Routes and manages tenant-specific requests"""
    
    def __init__(self):
        self.tenant_cache = {}  # Simple in-memory cache
        self.cache_ttl = 300  # 5 minutes
    
    async def resolve_tenant_from_request(self, request: Request) -> Optional[Tenant]:
        """Resolve tenant from various request sources"""
        
        # Method 1: From subdomain (e.g., tenant1.locodex.com)
        tenant = await self._resolve_from_subdomain(request)
        if tenant:
            return tenant
        
        # Method 2: From custom domain (e.g., company.com -> tenant)  
        tenant = await self._resolve_from_domain(request)
        if tenant:
            return tenant
        
        # Method 3: From path prefix (e.g., /tenant/tenant1/api/...)
        tenant = await self._resolve_from_path(request)
        if tenant:
            return tenant
        
        # Method 4: From header (X-Tenant-Slug)
        tenant = await self._resolve_from_header(request)
        if tenant:
            return tenant
        
        # Method 5: From API key
        tenant = await self._resolve_from_api_key(request)
        if tenant:
            return tenant
        
        return None
    
    async def _resolve_from_subdomain(self, request: Request) -> Optional[Tenant]:
        """Resolve tenant from subdomain"""
        host = request.headers.get("host", "")
        
        # Extract subdomain
        # Format: tenant-slug.locodex.com -> tenant-slug
        if "." in host:
            subdomain = host.split(".")[0]
            
            # Skip common subdomains
            if subdomain.lower() in ["www", "api", "app", "admin"]:
                return None
            
            return await self._get_tenant_by_slug(subdomain)
        
        return None
    
    async def _resolve_from_domain(self, request: Request) -> Optional[Tenant]:
        """Resolve tenant from custom domain"""
        host = request.headers.get("host", "")
        
        if host:
            return await self._get_tenant_by_domain(host)
        
        return None
    
    async def _resolve_from_path(self, request: Request) -> Optional[Tenant]:
        """Resolve tenant from URL path"""
        path = request.url.path
        
        # Pattern: /tenant/{slug}/... or /t/{slug}/...
        patterns = [
            r"^/tenant/([a-z0-9-]+)",
            r"^/t/([a-z0-9-]+)"
        ]
        
        for pattern in patterns:
            match = re.match(pattern, path)
            if match:
                tenant_slug = match.group(1)
                return await self._get_tenant_by_slug(tenant_slug)
        
        return None
    
    async def _resolve_from_header(self, request: Request) -> Optional[Tenant]:
        """Resolve tenant from HTTP header"""
        tenant_slug = request.headers.get("X-Tenant-Slug")
        
        if tenant_slug:
            return await self._get_tenant_by_slug(tenant_slug)
        
        return None
    
    async def _resolve_from_api_key(self, request: Request) -> Optional[Tenant]:
        """Resolve tenant from API key in Authorization header"""
        auth_header = request.headers.get("Authorization", "")
        
        if auth_header.startswith("Bearer "):
            api_key = auth_header[7:]  # Remove "Bearer " prefix
            
            result = await tenant_auth.verify_api_key(api_key)
            if result:
                tenant, api_key_record = result
                return tenant
        
        return None
    
    async def _get_tenant_by_slug(self, slug: str) -> Optional[Tenant]:
        """Get tenant by slug with caching"""
        cache_key = f"slug:{slug}"
        
        # Check cache first
        if cache_key in self.tenant_cache:
            cached_data = self.tenant_cache[cache_key]
            if time.time() - cached_data["timestamp"] < self.cache_ttl:
                return cached_data["tenant"]
        
        # Query database
        session = db_manager.get_master_session()
        
        try:
            tenant = session.query(Tenant).filter(
                Tenant.slug == slug,
                Tenant.status == "active",
                Tenant.deleted_at.is_(None)
            ).first()
            
            # Cache result
            self.tenant_cache[cache_key] = {
                "tenant": tenant,
                "timestamp": time.time()
            }
            
            return tenant
            
        except Exception as e:
            logger.error("Failed to get tenant by slug", slug=slug, error=str(e))
            return None
        finally:
            session.close()
    
    async def _get_tenant_by_domain(self, domain: str) -> Optional[Tenant]:
        """Get tenant by custom domain with caching"""
        cache_key = f"domain:{domain}"
        
        # Check cache first
        if cache_key in self.tenant_cache:
            cached_data = self.tenant_cache[cache_key]
            if time.time() - cached_data["timestamp"] < self.cache_ttl:
                return cached_data["tenant"]
        
        # Query database
        session = db_manager.get_master_session()
        
        try:
            tenant = session.query(Tenant).filter(
                Tenant.domain == domain,
                Tenant.status == "active",
                Tenant.deleted_at.is_(None)
            ).first()
            
            # Cache result
            self.tenant_cache[cache_key] = {
                "tenant": tenant,
                "timestamp": time.time()
            }
            
            return tenant
            
        except Exception as e:
            logger.error("Failed to get tenant by domain", domain=domain, error=str(e))
            return None
        finally:
            session.close()
    
    async def create_tenant_context(
        self, 
        request: Request,
        tenant: Optional[Tenant] = None
    ) -> TenantContext:
        """Create tenant context from request"""
        
        if not tenant:
            tenant = await self.resolve_tenant_from_request(request)
        
        if not tenant:
            raise HTTPException(
                status_code=400,
                detail="Tenant not found. Please check your domain, subdomain, or API key."
            )
        
        # Generate request ID
        import uuid
        request_id = str(uuid.uuid4())
        
        # Try to extract user/API key info
        user_id = None
        api_key_id = None
        
        # Check for JWT token
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            
            # Try as JWT token first
            payload = tenant_auth.verify_token(token)
            if payload and payload.get("type") == "access":
                user_id = payload.get("sub")
            else:
                # Try as API key
                result = await tenant_auth.verify_api_key(token)
                if result:
                    _, api_key_record = result
                    api_key_id = api_key_record.id
        
        context = TenantContext(
            tenant=tenant,
            user_id=user_id,
            api_key_id=api_key_id,
            request_id=request_id
        )
        
        # Add context to request state
        request.state.tenant_context = context
        
        logger.info("Created tenant context", **context.to_dict())
        return context
    
    def get_tenant_context(self, request: Request) -> Optional[TenantContext]:
        """Get tenant context from request state"""
        return getattr(request.state, "tenant_context", None)
    
    async def validate_tenant_access(
        self, 
        context: TenantContext,
        resource_id: Optional[str] = None,
        permission: Optional[str] = None
    ) -> bool:
        """Validate that tenant can access a resource"""
        
        # Basic tenant status check
        if context.tenant.status != "active":
            return False
        
        # Resource isolation check
        if resource_id:
            has_access = await tenant_isolation.validate_tenant_access(
                context.tenant_slug, resource_id
            )
            if not has_access:
                return False
        
        # Permission check (if user context available)
        if permission and context.user_id:
            # This would check user permissions
            # Implementation depends on your permission system
            pass
        
        return True
    
    async def record_request_metrics(
        self, 
        context: TenantContext, 
        request: Request,
        response: Response
    ):
        """Record request metrics for tenant"""
        
        try:
            # Calculate request duration
            duration_ms = (time.time() - context.start_time) * 1000
            
            # Record API call usage
            await tenant_isolation.record_tenant_usage(
                context.tenant_slug, "api_calls", 1
            )
            
            # Record bandwidth usage (approximate)
            content_length = response.headers.get("content-length")
            if content_length:
                bandwidth_kb = int(content_length) // 1024
                if bandwidth_kb > 0:
                    await tenant_isolation.record_tenant_usage(
                        context.tenant_slug, "bandwidth_mb", bandwidth_kb // 1024
                    )
            
            # Log request details
            logger.info("Request completed",
                       tenant_slug=context.tenant_slug,
                       request_id=context.request_id,
                       method=request.method,
                       path=request.url.path,
                       status_code=response.status_code,
                       duration_ms=round(duration_ms, 2),
                       user_id=context.user_id,
                       api_key_id=context.api_key_id)
            
        except Exception as e:
            logger.error("Failed to record request metrics", 
                        tenant_slug=context.tenant_slug, error=str(e))
    
    def clear_tenant_cache(self, tenant_slug: Optional[str] = None):
        """Clear tenant cache"""
        if tenant_slug:
            # Clear specific tenant
            keys_to_remove = [
                key for key in self.tenant_cache.keys() 
                if f":{tenant_slug}" in key or key.endswith(f":{tenant_slug}")
            ]
            for key in keys_to_remove:
                del self.tenant_cache[key]
        else:
            # Clear all cache
            self.tenant_cache.clear()
        
        logger.info("Cleared tenant cache", tenant_slug=tenant_slug)

class TenantRouteHandler(APIRoute):
    """Custom route handler that automatically resolves tenant context"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.router = TenantRouter()
    
    def get_route_handler(self) -> Callable:
        original_route_handler = super().get_route_handler()
        
        async def custom_route_handler(request: Request) -> Response:
            # Create tenant context
            try:
                context = await self.router.create_tenant_context(request)
            except HTTPException:
                raise
            except Exception as e:
                logger.error("Failed to create tenant context", error=str(e))
                raise HTTPException(status_code=500, detail="Internal server error")
            
            # Execute original route handler
            response = await original_route_handler(request)
            
            # Record metrics
            await self.router.record_request_metrics(context, request, response)
            
            return response
        
        return custom_route_handler

# Global router instance
tenant_router = TenantRouter()

# FastAPI dependency to get tenant context
async def get_tenant_context(request: Request) -> TenantContext:
    """FastAPI dependency to get current tenant context"""
    context = tenant_router.get_tenant_context(request)
    
    if not context:
        # Try to create context if not exists
        context = await tenant_router.create_tenant_context(request)
    
    return context

# Middleware for automatic tenant resolution
class TenantMiddleware:
    """Middleware to automatically resolve tenant for all requests"""
    
    def __init__(self, app):
        self.app = app
        self.router = TenantRouter()
    
    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            request = Request(scope, receive)
            
            # Skip tenant resolution for certain paths
            skip_paths = ["/health", "/docs", "/openapi.json", "/metrics"]
            if any(request.url.path.startswith(path) for path in skip_paths):
                await self.app(scope, receive, send)
                return
            
            try:
                # Create tenant context
                await self.router.create_tenant_context(request)
            except HTTPException as e:
                # Return error response
                response = Response(
                    content=f'{{"detail": "{e.detail}"}}',
                    status_code=e.status_code,
                    media_type="application/json"
                )
                await response(scope, receive, send)
                return
            except Exception as e:
                logger.error("Tenant middleware error", error=str(e))
                response = Response(
                    content='{"detail": "Internal server error"}',
                    status_code=500,
                    media_type="application/json"
                )
                await response(scope, receive, send)
                return
        
        await self.app(scope, receive, send)