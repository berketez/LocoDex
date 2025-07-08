"""
Tenant Management API Endpoints
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Query, Request, Response
from pydantic import BaseModel, EmailStr, Field
import structlog

from ..core.tenant_manager import TenantManager
from ..core.tenant_isolation import tenant_isolation
from ..security.tenant_auth import (
    get_current_tenant_from_api_key, 
    get_current_user_from_token,
    tenant_auth
)
from ..api.tenant_router import get_tenant_context, TenantContext
from ..database.models import Tenant, TenantUser

logger = structlog.get_logger()

# Pydantic Models for API
class TenantCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    admin_email: EmailStr
    slug: Optional[str] = Field(None, regex=r'^[a-z0-9][a-z0-9-]*[a-z0-9]$')
    domain: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None

class TenantUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    admin_email: Optional[EmailStr] = None
    domain: Optional[str] = None
    status: Optional[str] = Field(None, regex=r'^(active|suspended|deleted)$')
    settings: Optional[Dict[str, Any]] = None

class TenantResponse(BaseModel):
    id: str
    slug: str
    name: str
    domain: Optional[str]
    status: str
    admin_email: str
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True

class UserCreateRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str = Field("user", regex=r'^(admin|user|viewer)$')
    username: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    email: str
    username: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    role: str
    is_active: bool
    is_verified: bool
    created_at: datetime
    last_login: Optional[datetime]
    
    class Config:
        from_attributes = True

class AuthRequest(BaseModel):
    email: EmailStr
    password: str

class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int
    user: UserResponse

class TenantStatsResponse(BaseModel):
    tenant_id: str
    slug: str
    status: str
    user_count: int
    api_key_count: int
    usage: Dict[str, Any]
    limits: Dict[str, Any]

# Initialize managers
tenant_manager = TenantManager()

# API Router
router = APIRouter()

# System Admin Endpoints (for managing tenants)
admin_router = APIRouter(prefix="/admin", tags=["Admin"])

@admin_router.post("/tenants", response_model=TenantResponse)
async def create_tenant(
    tenant_data: TenantCreateRequest,
    # Add admin authentication here
):
    """Create a new tenant (Admin only)"""
    try:
        tenant = await tenant_manager.create_tenant(
            name=tenant_data.name,
            admin_email=tenant_data.admin_email,
            slug=tenant_data.slug,
            domain=tenant_data.domain,
            settings=tenant_data.settings
        )
        
        if not tenant:
            raise HTTPException(status_code=400, detail="Failed to create tenant")
        
        return TenantResponse.from_orm(tenant)
        
    except Exception as e:
        logger.error("Failed to create tenant", error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")

@admin_router.get("/tenants", response_model=List[TenantResponse])
async def list_tenants(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status_filter: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    include_deleted: bool = Query(False)
):
    """List all tenants (Admin only)"""
    try:
        tenants = await tenant_manager.list_tenants(
            offset=offset,
            limit=limit,
            status_filter=status_filter,
            search=search,
            include_deleted=include_deleted
        )
        
        return [TenantResponse.from_orm(tenant) for tenant in tenants]
        
    except Exception as e:
        logger.error("Failed to list tenants", error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")

@admin_router.get("/tenants/{tenant_id}", response_model=TenantResponse)
async def get_tenant(tenant_id: str):
    """Get tenant by ID (Admin only)"""
    try:
        tenant = await tenant_manager.get_tenant(tenant_id=tenant_id)
        
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        
        return TenantResponse.from_orm(tenant)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get tenant", tenant_id=tenant_id, error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")

@admin_router.put("/tenants/{tenant_id}", response_model=TenantResponse)
async def update_tenant(
    tenant_id: str,
    updates: TenantUpdateRequest
):
    """Update tenant (Admin only)"""
    try:
        # Filter out None values
        update_data = {k: v for k, v in updates.dict().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No updates provided")
        
        tenant = await tenant_manager.update_tenant(
            tenant_id=tenant_id,
            updates=update_data
        )
        
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        
        return TenantResponse.from_orm(tenant)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to update tenant", tenant_id=tenant_id, error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")

@admin_router.delete("/tenants/{tenant_id}")
async def delete_tenant(
    tenant_id: str,
    hard_delete: bool = Query(False, description="Permanently delete tenant and all data")
):
    """Delete tenant (Admin only)"""
    try:
        success = await tenant_manager.delete_tenant(
            tenant_id=tenant_id,
            hard_delete=hard_delete
        )
        
        if not success:
            raise HTTPException(status_code=404, detail="Tenant not found")
        
        return {"message": "Tenant deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to delete tenant", tenant_id=tenant_id, error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")

@admin_router.get("/tenants/{tenant_id}/stats", response_model=TenantStatsResponse)
async def get_tenant_stats(tenant_id: str):
    """Get tenant statistics (Admin only)"""
    try:
        stats = await tenant_manager.get_tenant_stats(tenant_id)
        
        if not stats:
            raise HTTPException(status_code=404, detail="Tenant not found")
        
        return TenantStatsResponse(**stats)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get tenant stats", tenant_id=tenant_id, error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")

# Tenant API Endpoints (for tenant users)
tenant_router = APIRouter(prefix="/api/v1", tags=["Tenant"])

@tenant_router.post("/auth/login", response_model=AuthResponse)
async def login(
    auth_data: AuthRequest,
    context: TenantContext = Depends(get_tenant_context)
):
    """Authenticate user within tenant"""
    try:
        user = await tenant_auth.authenticate_user(
            tenant_slug=context.tenant_slug,
            email=auth_data.email,
            password=auth_data.password
        )
        
        if not user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        tokens = await tenant_auth.create_user_tokens(context.tenant_id, user)
        
        return AuthResponse(
            **tokens,
            user=UserResponse.from_orm(user)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Authentication failed", 
                    tenant_slug=context.tenant_slug, 
                    email=auth_data.email, 
                    error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")

@tenant_router.post("/auth/refresh", response_model=Dict[str, Any])
async def refresh_token(
    request: Request,
    context: TenantContext = Depends(get_tenant_context)
):
    """Refresh access token"""
    try:
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization header")
        
        refresh_token = auth_header[7:]
        tokens = await tenant_auth.refresh_access_token(refresh_token)
        
        if not tokens:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        
        return tokens
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Token refresh failed", error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")

@tenant_router.get("/profile", response_model=UserResponse)
async def get_profile(
    current_user: tuple = Depends(get_current_user_from_token)
):
    """Get current user profile"""
    tenant, user = current_user
    return UserResponse.from_orm(user)

@tenant_router.get("/tenant/info", response_model=TenantResponse)
async def get_tenant_info(
    current_tenant: Tenant = Depends(get_current_tenant_from_api_key)
):
    """Get current tenant information"""
    return TenantResponse.from_orm(current_tenant)

@tenant_router.get("/tenant/stats", response_model=TenantStatsResponse)
async def get_current_tenant_stats(
    current_tenant: Tenant = Depends(get_current_tenant_from_api_key)
):
    """Get current tenant statistics"""
    try:
        stats = await tenant_manager.get_tenant_stats(current_tenant.id)
        return TenantStatsResponse(**stats)
        
    except Exception as e:
        logger.error("Failed to get tenant stats", error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")

@tenant_router.get("/tenant/usage")
async def get_tenant_usage(
    resource_type: str = Query(..., description="Resource type to check"),
    context: TenantContext = Depends(get_tenant_context)
):
    """Check tenant resource usage"""
    try:
        usage_info = await tenant_isolation.check_tenant_quota(
            context.tenant_slug, resource_type
        )
        
        return usage_info
        
    except Exception as e:
        logger.error("Failed to get tenant usage", error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")

# User Management Endpoints
@tenant_router.post("/users", response_model=UserResponse)
async def create_user(
    user_data: UserCreateRequest,
    current_user: tuple = Depends(get_current_user_from_token)
):
    """Create new user in tenant (Admin only)"""
    tenant, current_user_obj = current_user
    
    # Check if current user is admin
    if current_user_obj.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # This would implement user creation in tenant database
        # For now, return a placeholder response
        return UserResponse(
            id="placeholder",
            email=user_data.email,
            username=user_data.username,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            role=user_data.role,
            is_active=True,
            is_verified=False,
            created_at=datetime.utcnow()
        )
        
    except Exception as e:
        logger.error("Failed to create user", error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")

# Health Check
@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "multi-tenant-service",
        "version": "1.0.0"
    }

# Include routers
router.include_router(admin_router)
router.include_router(tenant_router)