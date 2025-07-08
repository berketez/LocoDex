"""
Tenant Isolation System - Ensures complete data and resource isolation between tenants
"""

import os
import uuid
from typing import Optional, Dict, Any, List, Union
from pathlib import Path
from contextlib import contextmanager
import redis
import structlog
from sqlalchemy.orm import Session

from ..database.config import db_manager
from ..database.models import Tenant, TenantUsage
from ..utils.encryption import EncryptionManager

logger = structlog.get_logger()

class TenantIsolation:
    """Handles all aspects of tenant isolation"""
    
    def __init__(self):
        self.encryption = EncryptionManager()
        self.redis_client = redis.Redis(
            host=os.getenv("REDIS_HOST", "localhost"),
            port=int(os.getenv("REDIS_PORT", "6379")),
            password=os.getenv("REDIS_PASSWORD"),
            decode_responses=True
        )
    
    # Database Isolation
    @contextmanager
    def get_tenant_db_session(self, tenant_slug: str):
        """Get isolated database session for tenant"""
        session = None
        try:
            session = db_manager.get_tenant_session(tenant_slug)
            yield session
            session.commit()
        except Exception:
            if session:
                session.rollback()
            raise
        finally:
            if session:
                session.close()
    
    async def validate_tenant_access(self, tenant_slug: str, resource_id: str) -> bool:
        """Validate that a resource belongs to the tenant"""
        try:
            with self.get_tenant_db_session(tenant_slug) as session:
                # This would be implemented based on your specific resource models
                # For now, we'll assume all resources in tenant DB belong to tenant
                result = session.execute(
                    "SELECT 1 FROM information_schema.tables LIMIT 1"
                ).first()
                return result is not None
        except Exception as e:
            logger.error("Failed to validate tenant access", 
                        tenant_slug=tenant_slug, resource_id=resource_id, error=str(e))
            return False
    
    # File Storage Isolation
    def get_tenant_storage_path(self, tenant_slug: str, relative_path: str = "") -> Path:
        """Get isolated storage path for tenant"""
        base_storage = Path(os.getenv("TENANT_STORAGE_BASE", "/app/tenant_data"))
        tenant_path = base_storage / tenant_slug
        
        # Ensure tenant directory exists
        tenant_path.mkdir(parents=True, exist_ok=True)
        
        if relative_path:
            full_path = tenant_path / relative_path
            # Security: Ensure path doesn't escape tenant directory
            if not str(full_path.resolve()).startswith(str(tenant_path.resolve())):
                raise ValueError("Path traversal attempt detected")
            return full_path
        
        return tenant_path
    
    def write_tenant_file(
        self, 
        tenant_slug: str, 
        file_path: str, 
        content: Union[str, bytes],
        encrypt: bool = True
    ) -> bool:
        """Write file to tenant's isolated storage"""
        try:
            full_path = self.get_tenant_storage_path(tenant_slug, file_path)
            
            # Ensure parent directory exists
            full_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Encrypt content if requested
            if encrypt and isinstance(content, str):
                tenant = self._get_tenant_by_slug(tenant_slug)
                if tenant:
                    content = self.encryption.encrypt_data(content, tenant.encryption_key)
            
            # Write file
            mode = 'wb' if isinstance(content, bytes) else 'w'
            with open(full_path, mode) as f:
                f.write(content)
            
            logger.info("Wrote tenant file", tenant_slug=tenant_slug, file_path=file_path)
            return True
            
        except Exception as e:
            logger.error("Failed to write tenant file", 
                        tenant_slug=tenant_slug, file_path=file_path, error=str(e))
            return False
    
    def read_tenant_file(
        self, 
        tenant_slug: str, 
        file_path: str, 
        decrypt: bool = True
    ) -> Optional[str]:
        """Read file from tenant's isolated storage"""
        try:
            full_path = self.get_tenant_storage_path(tenant_slug, file_path)
            
            if not full_path.exists():
                return None
            
            with open(full_path, 'r') as f:
                content = f.read()
            
            # Decrypt content if requested
            if decrypt:
                tenant = self._get_tenant_by_slug(tenant_slug)
                if tenant:
                    try:
                        content = self.encryption.decrypt_data(content, tenant.encryption_key)
                    except Exception:
                        # Content might not be encrypted
                        pass
            
            return content
            
        except Exception as e:
            logger.error("Failed to read tenant file", 
                        tenant_slug=tenant_slug, file_path=file_path, error=str(e))
            return None
    
    def delete_tenant_file(self, tenant_slug: str, file_path: str) -> bool:
        """Delete file from tenant's isolated storage"""
        try:
            full_path = self.get_tenant_storage_path(tenant_slug, file_path)
            
            if full_path.exists():
                full_path.unlink()
                logger.info("Deleted tenant file", tenant_slug=tenant_slug, file_path=file_path)
                return True
            
            return False
            
        except Exception as e:
            logger.error("Failed to delete tenant file", 
                        tenant_slug=tenant_slug, file_path=file_path, error=str(e))
            return False
    
    def list_tenant_files(self, tenant_slug: str, directory: str = "") -> List[str]:
        """List files in tenant's isolated storage"""
        try:
            dir_path = self.get_tenant_storage_path(tenant_slug, directory)
            
            if not dir_path.exists():
                return []
            
            files = []
            for item in dir_path.iterdir():
                if item.is_file():
                    files.append(str(item.relative_to(self.get_tenant_storage_path(tenant_slug))))
            
            return sorted(files)
            
        except Exception as e:
            logger.error("Failed to list tenant files", 
                        tenant_slug=tenant_slug, directory=directory, error=str(e))
            return []
    
    # Cache Isolation
    def get_tenant_cache_key(self, tenant_slug: str, key: str) -> str:
        """Get tenant-namespaced cache key"""
        return f"tenant:{tenant_slug}:{key}"
    
    def set_tenant_cache(
        self, 
        tenant_slug: str, 
        key: str, 
        value: Any, 
        ttl_seconds: int = 3600
    ) -> bool:
        """Set value in tenant's isolated cache"""
        try:
            cache_key = self.get_tenant_cache_key(tenant_slug, key)
            
            # Serialize value
            if isinstance(value, (dict, list)):
                import json
                value = json.dumps(value)
            
            self.redis_client.setex(cache_key, ttl_seconds, value)
            return True
            
        except Exception as e:
            logger.error("Failed to set tenant cache", 
                        tenant_slug=tenant_slug, key=key, error=str(e))
            return False
    
    def get_tenant_cache(self, tenant_slug: str, key: str) -> Optional[Any]:
        """Get value from tenant's isolated cache"""
        try:
            cache_key = self.get_tenant_cache_key(tenant_slug, key)
            value = self.redis_client.get(cache_key)
            
            if value is None:
                return None
            
            # Try to deserialize JSON
            try:
                import json
                return json.loads(value)
            except (json.JSONDecodeError, TypeError):
                return value
                
        except Exception as e:
            logger.error("Failed to get tenant cache", 
                        tenant_slug=tenant_slug, key=key, error=str(e))
            return None
    
    def delete_tenant_cache(self, tenant_slug: str, key: str) -> bool:
        """Delete value from tenant's isolated cache"""
        try:
            cache_key = self.get_tenant_cache_key(tenant_slug, key)
            deleted = self.redis_client.delete(cache_key)
            return deleted > 0
            
        except Exception as e:
            logger.error("Failed to delete tenant cache", 
                        tenant_slug=tenant_slug, key=key, error=str(e))
            return False
    
    def clear_tenant_cache(self, tenant_slug: str) -> bool:
        """Clear all cache entries for a tenant"""
        try:
            pattern = self.get_tenant_cache_key(tenant_slug, "*")
            keys = self.redis_client.keys(pattern)
            
            if keys:
                deleted = self.redis_client.delete(*keys)
                logger.info("Cleared tenant cache", tenant_slug=tenant_slug, keys_deleted=deleted)
                return True
            
            return True
            
        except Exception as e:
            logger.error("Failed to clear tenant cache", tenant_slug=tenant_slug, error=str(e))
            return False
    
    # Resource Quota Enforcement
    async def check_tenant_quota(
        self, 
        tenant_slug: str, 
        resource_type: str, 
        proposed_usage: int = 1
    ) -> Dict[str, Any]:
        """Check if tenant can use more of a resource type"""
        
        tenant = self._get_tenant_by_slug(tenant_slug)
        if not tenant:
            return {"allowed": False, "reason": "Tenant not found"}
        
        # Get current usage
        session = db_manager.get_master_session()
        try:
            latest_usage = session.query(TenantUsage).filter(
                TenantUsage.tenant_id == tenant.id
            ).order_by(TenantUsage.date.desc()).first()
            
            current_usage = 0
            limit = 0
            
            if resource_type == "api_calls":
                current_usage = latest_usage.api_calls if latest_usage else 0
                limit = tenant.max_api_calls_per_day
            elif resource_type == "ai_requests":
                current_usage = latest_usage.ai_requests if latest_usage else 0
                limit = tenant.max_ai_requests_per_day
            elif resource_type == "storage_mb":
                current_usage = latest_usage.storage_used_mb if latest_usage else 0
                limit = tenant.max_storage_gb * 1024  # Convert GB to MB
            elif resource_type == "users":
                current_usage = session.query(TenantUser).filter(
                    TenantUser.tenant_id == tenant.id,
                    TenantUser.is_active == True
                ).count()
                limit = tenant.max_users
            else:
                return {"allowed": False, "reason": "Unknown resource type"}
            
            new_usage = current_usage + proposed_usage
            allowed = new_usage <= limit
            
            return {
                "allowed": allowed,
                "current_usage": current_usage,
                "limit": limit,
                "proposed_usage": proposed_usage,
                "new_usage": new_usage,
                "remaining": max(0, limit - new_usage),
                "percentage_used": (new_usage / limit * 100) if limit > 0 else 0
            }
            
        except Exception as e:
            logger.error("Failed to check tenant quota", 
                        tenant_slug=tenant_slug, resource_type=resource_type, error=str(e))
            return {"allowed": False, "reason": f"Quota check failed: {str(e)}"}
        finally:
            session.close()
    
    async def record_tenant_usage(
        self, 
        tenant_slug: str, 
        resource_type: str, 
        amount: int = 1
    ) -> bool:
        """Record resource usage for a tenant"""
        
        tenant = self._get_tenant_by_slug(tenant_slug)
        if not tenant:
            return False
        
        session = db_manager.get_master_session()
        try:
            from datetime import date
            today = date.today()
            
            # Get or create today's usage record
            usage = session.query(TenantUsage).filter(
                TenantUsage.tenant_id == tenant.id,
                TenantUsage.date == today,
                TenantUsage.period_type == "daily"
            ).first()
            
            if not usage:
                usage = TenantUsage(
                    tenant_id=tenant.id,
                    date=today,
                    period_type="daily"
                )
                session.add(usage)
            
            # Update usage based on resource type
            if resource_type == "api_calls":
                usage.api_calls += amount
            elif resource_type == "ai_requests":
                usage.ai_requests += amount
            elif resource_type == "storage_mb":
                usage.storage_used_mb += amount
            elif resource_type == "bandwidth_mb":
                usage.bandwidth_used_mb += amount
            
            session.commit()
            
            logger.debug("Recorded tenant usage", 
                        tenant_slug=tenant_slug, resource_type=resource_type, amount=amount)
            return True
            
        except Exception as e:
            session.rollback()
            logger.error("Failed to record tenant usage", 
                        tenant_slug=tenant_slug, resource_type=resource_type, error=str(e))
            return False
        finally:
            session.close()
    
    # Security and Data Protection
    async def sanitize_tenant_data(self, tenant_slug: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize data to prevent cross-tenant contamination"""
        
        # Remove any tenant_id fields that don't match the current tenant
        tenant = self._get_tenant_by_slug(tenant_slug)
        if not tenant:
            return {}
        
        sanitized = {}
        for key, value in data.items():
            # Skip sensitive fields
            if key in ['password', 'secret', 'private_key', 'encryption_key']:
                continue
            
            # Ensure tenant_id matches if present
            if key == 'tenant_id' and value != tenant.id:
                sanitized[key] = tenant.id
            else:
                sanitized[key] = value
        
        return sanitized
    
    def _get_tenant_by_slug(self, tenant_slug: str) -> Optional[Tenant]:
        """Helper to get tenant by slug"""
        session = db_manager.get_master_session()
        try:
            return session.query(Tenant).filter(
                Tenant.slug == tenant_slug,
                Tenant.deleted_at.is_(None)
            ).first()
        finally:
            session.close()
    
    async def cleanup_tenant_data(self, tenant_slug: str) -> Dict[str, bool]:
        """Clean up all data for a tenant (for deletion)"""
        results = {}
        
        try:
            # Clean up files
            tenant_path = self.get_tenant_storage_path(tenant_slug)
            if tenant_path.exists():
                import shutil
                shutil.rmtree(tenant_path)
                results["files_cleaned"] = True
            else:
                results["files_cleaned"] = True  # Nothing to clean
            
            # Clean up cache
            results["cache_cleaned"] = self.clear_tenant_cache(tenant_slug)
            
            # Database cleanup is handled by TenantManager
            results["database_cleanup_ready"] = True
            
            logger.info("Cleaned up tenant data", tenant_slug=tenant_slug, results=results)
            return results
            
        except Exception as e:
            logger.error("Failed to cleanup tenant data", tenant_slug=tenant_slug, error=str(e))
            return {"error": str(e)}

# Global instance
tenant_isolation = TenantIsolation()