"""
Database models for multi-tenant system
"""

from sqlalchemy import Column, String, DateTime, Boolean, Integer, Text, JSON, ForeignKey, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import uuid

Base = declarative_base()

class Tenant(Base):
    """
    Main tenant model - represents an organization/company using the system
    """
    __tablename__ = "tenants"
    
    # Primary identification
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    slug = Column(String(63), unique=True, nullable=False, index=True)  # URL-friendly identifier
    name = Column(String(255), nullable=False)  # Display name
    domain = Column(String(255), unique=True, nullable=True)  # Custom domain (optional)
    
    # Status and settings
    status = Column(String(20), nullable=False, default="active")  # active, suspended, deleted
    
    # Resource limits (for corporate use)
    max_users = Column(Integer, default=100)
    max_storage_gb = Column(Integer, default=50)
    max_api_calls_per_day = Column(Integer, default=50000)
    max_ai_requests_per_day = Column(Integer, default=5000)
    
    # Database isolation
    database_name = Column(String(63), unique=True, nullable=False)  # Isolated DB name
    database_schema = Column(String(63), default="public")  # Schema within DB
    
    # Security
    encryption_key = Column(String(255), nullable=False)  # Tenant-specific encryption
    api_key = Column(String(255), unique=True, nullable=False)  # Tenant API key
    webhook_secret = Column(String(255), nullable=True)  # For webhooks
    
    # Contact and billing
    admin_email = Column(String(255), nullable=False)
    billing_email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    
    # Address
    address_line1 = Column(String(255), nullable=True)
    address_line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    country = Column(String(100), nullable=True)
    
    # Configuration
    settings = Column(JSON, default=dict)  # Custom tenant settings
    features = Column(JSON, default=dict)  # Enabled features
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    users = relationship("TenantUser", back_populates="tenant", cascade="all, delete-orphan")
    usage_stats = relationship("TenantUsage", back_populates="tenant", cascade="all, delete-orphan")
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_tenant_slug', 'slug'),
        Index('idx_tenant_domain', 'domain'),
        Index('idx_tenant_status', 'status'),
        Index('idx_tenant_created', 'created_at'),
    )

class TenantUser(Base):
    """
    Users within a tenant - tenant-specific user management
    """
    __tablename__ = "tenant_users"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    
    # User identification
    email = Column(String(255), nullable=False)
    username = Column(String(100), nullable=True)
    password_hash = Column(String(255), nullable=False)
    
    # Profile
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    
    # Role and permissions
    role = Column(String(50), default="user")  # admin, user, viewer
    permissions = Column(JSON, default=list)  # Specific permissions
    
    # Status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    last_login = Column(DateTime(timezone=True), nullable=True)
    
    # Settings
    preferences = Column(JSON, default=dict)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    tenant = relationship("Tenant", back_populates="users")
    
    # Unique constraint: email per tenant
    __table_args__ = (
        Index('idx_tenant_user_email', 'tenant_id', 'email', unique=True),
        Index('idx_tenant_user_username', 'tenant_id', 'username', unique=True),
        Index('idx_tenant_user_role', 'tenant_id', 'role'),
    )

class TenantUsage(Base):
    """
    Track tenant resource usage for billing and limits
    """
    __tablename__ = "tenant_usage"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    
    # Time period
    date = Column(DateTime(timezone=True), nullable=False)
    period_type = Column(String(20), default="daily")  # daily, monthly, yearly
    
    # Usage metrics
    api_calls = Column(Integer, default=0)
    ai_requests = Column(Integer, default=0)
    storage_used_mb = Column(Integer, default=0)
    bandwidth_used_mb = Column(Integer, default=0)
    active_users = Column(Integer, default=0)
    
    # Detailed breakdown
    usage_details = Column(JSON, default=dict)
    
    # Costs (if applicable)
    cost_usd = Column(String(20), default="0.00")  # Decimal as string for precision
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    tenant = relationship("Tenant", back_populates="usage_stats")
    
    # Indexes
    __table_args__ = (
        Index('idx_tenant_usage_date', 'tenant_id', 'date'),
        Index('idx_tenant_usage_period', 'tenant_id', 'period_type', 'date'),
    )

class TenantApiKey(Base):
    """
    Multiple API keys per tenant for different services/environments
    """
    __tablename__ = "tenant_api_keys"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    
    # Key details
    key_name = Column(String(100), nullable=False)  # Friendly name
    api_key = Column(String(255), unique=True, nullable=False)
    key_hash = Column(String(255), nullable=False)  # Hashed version for security
    
    # Permissions and scope
    scopes = Column(JSON, default=list)  # What this key can access
    environment = Column(String(50), default="production")  # dev, staging, production
    
    # Rate limiting
    rate_limit_per_minute = Column(Integer, default=60)
    rate_limit_per_day = Column(Integer, default=1000)
    
    # Status
    is_active = Column(Boolean, default=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    last_used = Column(DateTime(timezone=True), nullable=True)
    
    # Usage tracking
    total_requests = Column(Integer, default=0)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Indexes
    __table_args__ = (
        Index('idx_tenant_api_key', 'api_key'),
        Index('idx_tenant_keys', 'tenant_id', 'is_active'),
    )

class TenantAuditLog(Base):
    """
    Audit log for tenant activities - security and compliance
    """
    __tablename__ = "tenant_audit_logs"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    
    # Event details
    event_type = Column(String(100), nullable=False)  # user_login, api_call, data_access, etc.
    event_category = Column(String(50), nullable=False)  # security, data, user, system
    severity = Column(String(20), default="info")  # info, warning, error, critical
    
    # Actor (who performed the action)
    actor_type = Column(String(50), nullable=False)  # user, system, api_key
    actor_id = Column(String(255), nullable=True)  # User ID, API key ID, etc.
    actor_email = Column(String(255), nullable=True)
    
    # Action details
    action = Column(String(255), nullable=False)  # Description of what happened
    resource_type = Column(String(100), nullable=True)  # What was affected
    resource_id = Column(String(255), nullable=True)  # ID of affected resource
    
    # Context
    ip_address = Column(String(45), nullable=True)  # IPv4 or IPv6
    user_agent = Column(Text, nullable=True)
    request_id = Column(String(100), nullable=True)  # For request tracing
    
    # Additional data
    metadata = Column(JSON, default=dict)
    
    # Status
    success = Column(Boolean, default=True)
    error_message = Column(Text, nullable=True)
    
    # Timestamp
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Indexes for fast querying
    __table_args__ = (
        Index('idx_audit_tenant_time', 'tenant_id', 'created_at'),
        Index('idx_audit_event_type', 'tenant_id', 'event_type'),
        Index('idx_audit_actor', 'tenant_id', 'actor_id'),
        Index('idx_audit_severity', 'tenant_id', 'severity'),
    )