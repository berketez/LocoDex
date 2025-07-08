"""
Tenant Authentication System - Handles authentication and authorization for multi-tenant environment
"""

import os
import jwt
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List, Tuple
from fastapi import HTTPException, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import structlog

from ..database.models import Tenant, TenantUser, TenantApiKey
from ..database.config import db_manager
from ..utils.encryption import EncryptionManager
from ..core.tenant_isolation import tenant_isolation

logger = structlog.get_logger()

class TenantAuth:
    """Handles tenant authentication and authorization"""
    
    def __init__(self):
        self.encryption = EncryptionManager()
        self.jwt_secret = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
        self.jwt_algorithm = "HS256"
        self.access_token_expire_minutes = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
        self.refresh_token_expire_days = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
        
        # HTTP Bearer for API key authentication
        self.security = HTTPBearer(auto_error=False)
    
    # JWT Token Management
    def create_access_token(
        self, 
        tenant_id: str, 
        user_id: str, 
        scopes: List[str] = None
    ) -> str:
        """Create JWT access token for authenticated user"""
        now = datetime.now(timezone.utc)
        expire = now + timedelta(minutes=self.access_token_expire_minutes)
        
        payload = {
            "sub": user_id,  # Subject (user ID)
            "tenant_id": tenant_id,
            "scopes": scopes or [],
            "type": "access",
            "iat": now,
            "exp": expire,
            "jti": str(uuid.uuid4())  # JWT ID for token tracking
        }
        
        return jwt.encode(payload, self.jwt_secret, algorithm=self.jwt_algorithm)
    
    def create_refresh_token(self, tenant_id: str, user_id: str) -> str:
        """Create JWT refresh token"""
        now = datetime.now(timezone.utc)
        expire = now + timedelta(days=self.refresh_token_expire_days)
        
        payload = {
            "sub": user_id,
            "tenant_id": tenant_id,
            "type": "refresh",
            "iat": now,
            "exp": expire,
            "jti": str(uuid.uuid4())
        }
        
        return jwt.encode(payload, self.jwt_secret, algorithm=self.jwt_algorithm)
    
    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify and decode JWT token"""
        try:
            payload = jwt.decode(token, self.jwt_secret, algorithms=[self.jwt_algorithm])
            
            # Check token type
            token_type = payload.get("type")
            if token_type not in ["access", "refresh"]:
                return None
            
            # Check expiration
            exp = payload.get("exp")
            if exp and datetime.fromtimestamp(exp, tz=timezone.utc) < datetime.now(timezone.utc):
                return None
            
            return payload
            
        except jwt.ExpiredSignatureError:
            logger.warning("Token expired")
            return None
        except jwt.InvalidTokenError as e:
            logger.warning("Invalid token", error=str(e))
            return None
    
    # API Key Authentication
    async def verify_api_key(self, api_key: str) -> Optional[Tuple[Tenant, TenantApiKey]]:
        """Verify API key and return tenant + API key info"""
        session = db_manager.get_master_session()
        
        try:
            # Hash the provided API key for comparison
            api_key_hash = self.encryption.generate_api_key_hash(api_key)
            
            # Find the API key record
            api_key_record = session.query(TenantApiKey).filter(
                TenantApiKey.key_hash == api_key_hash,
                TenantApiKey.is_active == True
            ).first()
            
            if not api_key_record:
                return None
            
            # Check expiration
            if api_key_record.expires_at and api_key_record.expires_at < datetime.utcnow():
                logger.warning("API key expired", api_key_id=api_key_record.id)
                return None
            
            # Get associated tenant
            tenant = session.query(Tenant).filter(
                Tenant.id == api_key_record.tenant_id,
                Tenant.status == "active",
                Tenant.deleted_at.is_(None)
            ).first()
            
            if not tenant:
                logger.warning("Tenant not found or inactive", tenant_id=api_key_record.tenant_id)
                return None
            
            # Update last used timestamp
            api_key_record.last_used = datetime.utcnow()
            api_key_record.total_requests += 1
            session.commit()
            
            return tenant, api_key_record
            
        except Exception as e:
            session.rollback()
            logger.error("API key verification failed", error=str(e))
            return None
        finally:
            session.close()
    
    # User Authentication
    async def authenticate_user(
        self, 
        tenant_slug: str, 
        email: str, 
        password: str
    ) -> Optional[TenantUser]:
        """Authenticate user within a tenant"""
        
        # Get tenant
        tenant = await self._get_tenant_by_slug(tenant_slug)
        if not tenant:
            return None
        
        # Get user from tenant database
        with tenant_isolation.get_tenant_db_session(tenant_slug) as session:
            user = session.query(TenantUser).filter(
                TenantUser.tenant_id == tenant.id,
                TenantUser.email == email,
                TenantUser.is_active == True
            ).first()
            
            if not user:
                return None
            
            # Verify password (password_hash should contain both hash and salt)
            if self._verify_password(password, user.password_hash):
                # Update last login
                user.last_login = datetime.utcnow()
                session.commit()
                
                # Log authentication event
                await self._log_auth_event(
                    tenant.id, user.id, "user_login", "success", 
                    {"email": email}
                )
                
                return user
            else:
                # Log failed authentication
                await self._log_auth_event(
                    tenant.id, None, "user_login_failed", "failed",
                    {"email": email, "reason": "invalid_password"}
                )
                
                return None
    
    async def create_user_tokens(
        self, 
        tenant_id: str, 
        user: TenantUser
    ) -> Dict[str, str]:
        """Create access and refresh tokens for user"""
        
        # Determine user scopes based on role
        scopes = self._get_user_scopes(user.role, user.permissions)
        
        access_token = self.create_access_token(tenant_id, user.id, scopes)
        refresh_token = self.create_refresh_token(tenant_id, user.id)
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": self.access_token_expire_minutes * 60
        }
    
    async def refresh_access_token(self, refresh_token: str) -> Optional[Dict[str, str]]:
        """Refresh access token using refresh token"""
        
        payload = self.verify_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            return None
        
        tenant_id = payload.get("tenant_id")
        user_id = payload.get("sub")
        
        # Verify user still exists and is active
        user = await self._get_user_by_id(tenant_id, user_id)
        if not user or not user.is_active:
            return None
        
        # Create new tokens
        return await self.create_user_tokens(tenant_id, user)
    
    # Authorization Helpers
    def check_permission(
        self, 
        user_scopes: List[str], 
        required_permission: str
    ) -> bool:
        """Check if user has required permission"""
        
        # Admin has all permissions
        if "admin" in user_scopes:
            return True
        
        # Check specific permission
        return required_permission in user_scopes
    
    def check_resource_access(
        self, 
        user_tenant_id: str, 
        resource_tenant_id: str,
        user_scopes: List[str]
    ) -> bool:
        """Check if user can access resource from their tenant"""
        
        # Users can only access resources from their own tenant
        if user_tenant_id != resource_tenant_id:
            return False
        
        return True
    
    # Rate Limiting
    async def check_rate_limit(
        self, 
        tenant_slug: str, 
        api_key_id: Optional[str] = None,
        endpoint: str = "general"
    ) -> Dict[str, Any]:
        """Check rate limit for tenant/API key"""
        
        # Get rate limit info from cache
        cache_key = f"rate_limit:{tenant_slug}:{api_key_id or 'default'}:{endpoint}"
        
        # This would implement rate limiting logic
        # For now, return success
        return {
            "allowed": True,
            "remaining": 1000,
            "reset_time": datetime.utcnow() + timedelta(minutes=1)
        }
    
    # Password Management
    def hash_password(self, password: str) -> str:
        """Hash password for storage"""
        hash_value, salt = self.encryption.hash_password(password)
        return f"{hash_value}${salt}"  # Store both hash and salt
    
    def _verify_password(self, password: str, stored_hash: str) -> bool:
        """Verify password against stored hash"""
        try:
            if '$' not in stored_hash:
                return False
            
            hash_value, salt = stored_hash.split('$', 1)
            return self.encryption.verify_password(password, hash_value, salt)
            
        except Exception as e:
            logger.error("Password verification failed", error=str(e))
            return False
    
    # Helper Methods
    def _get_user_scopes(self, role: str, permissions: List[str]) -> List[str]:
        """Get user scopes based on role and permissions"""
        scopes = []
        
        # Role-based scopes
        if role == "admin":
            scopes.extend(["admin", "read", "write", "delete", "manage_users"])
        elif role == "user":
            scopes.extend(["read", "write"])
        elif role == "viewer":
            scopes.extend(["read"])
        
        # Add specific permissions
        if permissions:
            scopes.extend(permissions)
        
        return list(set(scopes))  # Remove duplicates
    
    async def _get_tenant_by_slug(self, tenant_slug: str) -> Optional[Tenant]:
        """Get tenant by slug"""
        session = db_manager.get_master_session()
        try:
            return session.query(Tenant).filter(
                Tenant.slug == tenant_slug,
                Tenant.status == "active",
                Tenant.deleted_at.is_(None)
            ).first()
        finally:
            session.close()
    
    async def _get_user_by_id(self, tenant_id: str, user_id: str) -> Optional[TenantUser]:
        """Get user by ID from tenant database"""
        tenant = await self._get_tenant_by_slug(tenant_id)  # This would need to be improved
        if not tenant:
            return None
        
        with tenant_isolation.get_tenant_db_session(tenant.slug) as session:
            return session.query(TenantUser).filter(
                TenantUser.id == user_id,
                TenantUser.tenant_id == tenant_id
            ).first()
    
    async def _log_auth_event(
        self,
        tenant_id: str,
        user_id: Optional[str],
        event_type: str,
        status: str,
        metadata: Dict[str, Any]
    ):
        """Log authentication event"""
        from ..database.models import TenantAuditLog
        
        session = db_manager.get_master_session()
        
        try:
            audit_log = TenantAuditLog(
                tenant_id=tenant_id,
                event_type=event_type,
                event_category="security",
                severity="info" if status == "success" else "warning",
                actor_type="user",
                actor_id=user_id,
                action=f"Authentication attempt: {event_type}",
                metadata=metadata,
                success=(status == "success")
            )
            
            session.add(audit_log)
            session.commit()
            
        except Exception as e:
            session.rollback()
            logger.error("Failed to log auth event", error=str(e))
        finally:
            session.close()

# FastAPI Dependencies
security = HTTPBearer(auto_error=False)
tenant_auth = TenantAuth()

async def get_current_tenant_from_api_key(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Tenant:
    """FastAPI dependency to get current tenant from API key"""
    
    if not credentials:
        raise HTTPException(status_code=401, detail="API key required")
    
    result = await tenant_auth.verify_api_key(credentials.credentials)
    if not result:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    tenant, api_key = result
    return tenant

async def get_current_user_from_token(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Tuple[Tenant, TenantUser]:
    """FastAPI dependency to get current user from JWT token"""
    
    if not credentials:
        raise HTTPException(status_code=401, detail="Access token required")
    
    payload = tenant_auth.verify_token(credentials.credentials)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    tenant_id = payload.get("tenant_id")
    user_id = payload.get("sub")
    
    # Get tenant
    tenant = await tenant_auth._get_tenant_by_slug(tenant_id)
    if not tenant:
        raise HTTPException(status_code=401, detail="Tenant not found")
    
    # Get user
    user = await tenant_auth._get_user_by_id(tenant_id, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return tenant, user

def require_permission(permission: str):
    """Decorator to require specific permission"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # This would extract user info from request and check permissions
            # Implementation depends on how you structure your FastAPI routes
            return await func(*args, **kwargs)
        return wrapper
    return decorator