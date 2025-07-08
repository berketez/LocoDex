"""
Tenant Manager - Core tenant CRUD operations and management
"""

import uuid
import re
import secrets
import string
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from cryptography.fernet import Fernet
import structlog

from ..database.models import Tenant, TenantUser, TenantUsage, TenantApiKey, TenantAuditLog
from ..database.config import db_manager
from ..utils.validation import TenantValidator
from ..utils.encryption import EncryptionManager

logger = structlog.get_logger()

class TenantManager:
    """Core tenant management operations"""
    
    def __init__(self):
        self.validator = TenantValidator()
        self.encryption = EncryptionManager()
    
    async def create_tenant(
        self,
        name: str,
        admin_email: str,
        slug: Optional[str] = None,
        domain: Optional[str] = None,
        settings: Optional[Dict[str, Any]] = None
    ) -> Optional[Tenant]:
        """Create a new tenant with isolated database"""
        
        try:
            # Validate inputs
            validation_result = self.validator.validate_tenant_creation(
                name=name,
                admin_email=admin_email,
                slug=slug,
                domain=domain
            )
            
            if not validation_result.is_valid:
                logger.error("Tenant validation failed", errors=validation_result.errors)
                return None
            
            # Generate slug if not provided
            if not slug:
                slug = self._generate_slug(name)
            
            # Ensure slug is unique
            slug = await self._ensure_unique_slug(slug)
            
            # Generate secure credentials
            api_key = self._generate_api_key()
            encryption_key = Fernet.generate_key().decode()
            database_name = f"tenant_{slug}"
            
            # Create tenant record
            session = db_manager.get_master_session()
            
            try:
                tenant = Tenant(
                    id=str(uuid.uuid4()),
                    slug=slug,
                    name=name,
                    domain=domain,
                    admin_email=admin_email,
                    database_name=database_name,
                    encryption_key=encryption_key,
                    api_key=api_key,
                    settings=settings or {},
                    features=self._get_default_features()
                )
                
                session.add(tenant)
                session.commit()
                
                logger.info("Created tenant record", tenant_id=tenant.id, slug=slug)
                
                # Create isolated database
                db_created = await db_manager.create_tenant_database(slug)
                
                if not db_created:
                    # Rollback tenant creation if database creation fails
                    session.delete(tenant)
                    session.commit()
                    logger.error("Failed to create tenant database, rolling back", slug=slug)
                    return None
                
                # Log audit event
                await self._log_audit_event(
                    tenant_id=tenant.id,
                    event_type="tenant_created",
                    event_category="system",
                    action=f"Tenant '{name}' created with slug '{slug}'",
                    actor_type="system",
                    metadata={"tenant_type": "corporate"}
                )
                
                logger.info("Successfully created tenant", 
                           tenant_id=tenant.id, slug=slug, name=name)
                
                return tenant
                
            except Exception as e:
                session.rollback()
                logger.error("Failed to create tenant", error=str(e), slug=slug)
                return None
            finally:
                session.close()
                
        except Exception as e:
            logger.error("Tenant creation failed", error=str(e), name=name)
            return None
    
    async def get_tenant(
        self, 
        tenant_id: Optional[str] = None,
        slug: Optional[str] = None,
        domain: Optional[str] = None,
        api_key: Optional[str] = None
    ) -> Optional[Tenant]:
        """Get tenant by various identifiers"""
        
        if not any([tenant_id, slug, domain, api_key]):
            return None
        
        session = db_manager.get_master_session()
        
        try:
            query = session.query(Tenant).filter(Tenant.deleted_at.is_(None))
            
            if tenant_id:
                query = query.filter(Tenant.id == tenant_id)
            elif slug:
                query = query.filter(Tenant.slug == slug)
            elif domain:
                query = query.filter(Tenant.domain == domain)
            elif api_key:
                query = query.filter(Tenant.api_key == api_key)
            
            tenant = query.first()
            
            if tenant:
                logger.debug("Retrieved tenant", tenant_id=tenant.id, slug=tenant.slug)
            
            return tenant
            
        except Exception as e:
            logger.error("Failed to retrieve tenant", error=str(e))
            return None
        finally:
            session.close()
    
    async def update_tenant(
        self,
        tenant_id: str,
        updates: Dict[str, Any],
        actor_id: Optional[str] = None
    ) -> Optional[Tenant]:
        """Update tenant information"""
        
        session = db_manager.get_master_session()
        
        try:
            tenant = session.query(Tenant).filter(
                and_(Tenant.id == tenant_id, Tenant.deleted_at.is_(None))
            ).first()
            
            if not tenant:
                logger.warning("Tenant not found for update", tenant_id=tenant_id)
                return None
            
            # Validate updates
            validation_result = self.validator.validate_tenant_update(updates)
            if not validation_result.is_valid:
                logger.error("Tenant update validation failed", 
                           tenant_id=tenant_id, errors=validation_result.errors)
                return None
            
            # Apply updates
            old_values = {}
            for key, value in updates.items():
                if hasattr(tenant, key):
                    old_values[key] = getattr(tenant, key)
                    setattr(tenant, key, value)
            
            tenant.updated_at = datetime.utcnow()
            session.commit()
            
            # Log audit event
            await self._log_audit_event(
                tenant_id=tenant_id,
                event_type="tenant_updated",
                event_category="data",
                action=f"Tenant updated: {list(updates.keys())}",
                actor_type="user" if actor_id else "system",
                actor_id=actor_id,
                metadata={"updates": updates, "old_values": old_values}
            )
            
            logger.info("Updated tenant", tenant_id=tenant_id, updates=list(updates.keys()))
            return tenant
            
        except Exception as e:
            session.rollback()
            logger.error("Failed to update tenant", tenant_id=tenant_id, error=str(e))
            return None
        finally:
            session.close()
    
    async def delete_tenant(
        self,
        tenant_id: str,
        actor_id: Optional[str] = None,
        hard_delete: bool = False
    ) -> bool:
        """Delete tenant (soft delete by default)"""
        
        session = db_manager.get_master_session()
        
        try:
            tenant = session.query(Tenant).filter(Tenant.id == tenant_id).first()
            
            if not tenant:
                logger.warning("Tenant not found for deletion", tenant_id=tenant_id)
                return False
            
            if hard_delete:
                # Hard delete: remove database and all records
                db_deleted = await db_manager.delete_tenant_database(tenant.slug)
                
                if db_deleted:
                    session.delete(tenant)
                    action = "Tenant permanently deleted"
                else:
                    logger.error("Failed to delete tenant database", tenant_id=tenant_id)
                    return False
            else:
                # Soft delete: mark as deleted
                tenant.deleted_at = datetime.utcnow()
                tenant.status = "deleted"
                action = "Tenant soft deleted"
            
            session.commit()
            
            # Log audit event
            await self._log_audit_event(
                tenant_id=tenant_id,
                event_type="tenant_deleted",
                event_category="security",
                severity="warning",
                action=action,
                actor_type="user" if actor_id else "system",
                actor_id=actor_id,
                metadata={"hard_delete": hard_delete, "tenant_slug": tenant.slug}
            )
            
            logger.info("Deleted tenant", tenant_id=tenant_id, hard_delete=hard_delete)
            return True
            
        except Exception as e:
            session.rollback()
            logger.error("Failed to delete tenant", tenant_id=tenant_id, error=str(e))
            return False
        finally:
            session.close()
    
    async def list_tenants(
        self,
        offset: int = 0,
        limit: int = 50,
        status_filter: Optional[str] = None,
        search: Optional[str] = None,
        include_deleted: bool = False
    ) -> List[Tenant]:
        """List tenants with filtering and pagination"""
        
        session = db_manager.get_master_session()
        
        try:
            query = session.query(Tenant)
            
            # Filter deleted
            if not include_deleted:
                query = query.filter(Tenant.deleted_at.is_(None))
            
            # Status filter
            if status_filter:
                query = query.filter(Tenant.status == status_filter)
            
            # Search filter
            if search:
                search_term = f"%{search}%"
                query = query.filter(
                    or_(
                        Tenant.name.ilike(search_term),
                        Tenant.slug.ilike(search_term),
                        Tenant.admin_email.ilike(search_term),
                        Tenant.domain.ilike(search_term)
                    )
                )
            
            # Pagination
            tenants = query.order_by(Tenant.created_at.desc()).offset(offset).limit(limit).all()
            
            logger.debug("Listed tenants", count=len(tenants), offset=offset, limit=limit)
            return tenants
            
        except Exception as e:
            logger.error("Failed to list tenants", error=str(e))
            return []
        finally:
            session.close()
    
    async def get_tenant_stats(self, tenant_id: str) -> Dict[str, Any]:
        """Get tenant usage statistics and metrics"""
        
        session = db_manager.get_master_session()
        
        try:
            tenant = session.query(Tenant).filter(Tenant.id == tenant_id).first()
            if not tenant:
                return {}
            
            # Get latest usage stats
            latest_usage = session.query(TenantUsage).filter(
                TenantUsage.tenant_id == tenant_id
            ).order_by(TenantUsage.date.desc()).first()
            
            # Count users
            user_count = session.query(TenantUser).filter(
                and_(
                    TenantUser.tenant_id == tenant_id,
                    TenantUser.is_active == True
                )
            ).count()
            
            # Get API key count
            api_key_count = session.query(TenantApiKey).filter(
                and_(
                    TenantApiKey.tenant_id == tenant_id,
                    TenantApiKey.is_active == True
                )
            ).count()
            
            stats = {
                "tenant_id": tenant_id,
                "slug": tenant.slug,
                "status": tenant.status,
                "created_at": tenant.created_at.isoformat(),
                "user_count": user_count,
                "api_key_count": api_key_count,
                "usage": {
                    "api_calls": latest_usage.api_calls if latest_usage else 0,
                    "ai_requests": latest_usage.ai_requests if latest_usage else 0,
                    "storage_used_mb": latest_usage.storage_used_mb if latest_usage else 0,
                    "active_users": latest_usage.active_users if latest_usage else 0
                } if latest_usage else {},
                "limits": {
                    "max_users": tenant.max_users,
                    "max_storage_gb": tenant.max_storage_gb,
                    "max_api_calls_per_day": tenant.max_api_calls_per_day,
                    "max_ai_requests_per_day": tenant.max_ai_requests_per_day
                }
            }
            
            return stats
            
        except Exception as e:
            logger.error("Failed to get tenant stats", tenant_id=tenant_id, error=str(e))
            return {}
        finally:
            session.close()
    
    def _generate_slug(self, name: str) -> str:
        """Generate URL-friendly slug from tenant name"""
        # Convert to lowercase and replace spaces/special chars with hyphens
        slug = re.sub(r'[^a-zA-Z0-9]+', '-', name.lower().strip())
        slug = re.sub(r'-+', '-', slug)  # Remove multiple consecutive hyphens
        slug = slug.strip('-')  # Remove leading/trailing hyphens
        
        # Ensure minimum length
        if len(slug) < 3:
            slug = slug + str(uuid.uuid4())[:8]
        
        # Ensure maximum length
        if len(slug) > 50:
            slug = slug[:50]
        
        return slug
    
    async def _ensure_unique_slug(self, slug: str) -> str:
        """Ensure slug is unique by appending number if needed"""
        original_slug = slug
        counter = 1
        
        session = db_manager.get_master_session()
        
        try:
            while True:
                existing = session.query(Tenant).filter(Tenant.slug == slug).first()
                if not existing:
                    break
                
                slug = f"{original_slug}-{counter}"
                counter += 1
                
                # Prevent infinite loop
                if counter > 1000:
                    slug = f"{original_slug}-{uuid.uuid4().hex[:8]}"
                    break
            
            return slug
            
        finally:
            session.close()
    
    def _generate_api_key(self) -> str:
        """Generate secure API key"""
        alphabet = string.ascii_letters + string.digits
        return 'loco_' + ''.join(secrets.choice(alphabet) for _ in range(32))
    
    def _get_default_features(self) -> Dict[str, bool]:
        """Get default features for corporate tenants"""
        return {
            "api_access": True,
            "web_interface": True,
            "advanced_analytics": True,
            "custom_branding": True,
            "sso_integration": True,
            "audit_logs": True,
            "custom_domains": True,
            "full_support": True,
        }
    
    async def _log_audit_event(
        self,
        tenant_id: str,
        event_type: str,
        event_category: str,
        action: str,
        actor_type: str = "system",
        actor_id: Optional[str] = None,
        severity: str = "info",
        metadata: Optional[Dict[str, Any]] = None,
        success: bool = True
    ):
        """Log audit event"""
        session = db_manager.get_master_session()
        
        try:
            audit_log = TenantAuditLog(
                tenant_id=tenant_id,
                event_type=event_type,
                event_category=event_category,
                severity=severity,
                actor_type=actor_type,
                actor_id=actor_id,
                action=action,
                metadata=metadata or {},
                success=success
            )
            
            session.add(audit_log)
            session.commit()
            
        except Exception as e:
            session.rollback()
            logger.error("Failed to log audit event", error=str(e))
        finally:
            session.close()