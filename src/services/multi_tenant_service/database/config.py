"""
Database configuration and connection management for multi-tenant system
"""

import os
from typing import Optional, Dict, Any
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool
import asyncpg
import asyncio
from contextlib import asynccontextmanager
import structlog

logger = structlog.get_logger()

class DatabaseConfig:
    """Database configuration manager"""
    
    def __init__(self):
        # Main tenant management database
        self.master_db_url = os.getenv(
            "MASTER_DATABASE_URL",
            "postgresql://postgres:password@localhost:5432/locodex_tenants"
        )
        
        # Template for tenant-specific databases  
        self.tenant_db_template = os.getenv(
            "TENANT_DATABASE_TEMPLATE", 
            "postgresql://postgres:password@localhost:5432/tenant_{tenant_slug}"
        )
        
        # Database connection settings
        self.pool_size = int(os.getenv("DB_POOL_SIZE", "10"))
        self.max_overflow = int(os.getenv("DB_MAX_OVERFLOW", "20"))
        self.pool_timeout = int(os.getenv("DB_POOL_TIMEOUT", "30"))
        self.pool_recycle = int(os.getenv("DB_POOL_RECYCLE", "3600"))
        
        # Connection retry settings
        self.max_retries = int(os.getenv("DB_MAX_RETRIES", "3"))
        self.retry_delay = int(os.getenv("DB_RETRY_DELAY", "1"))

class TenantDatabaseManager:
    """Manages tenant database creation, deletion, and connections"""
    
    def __init__(self, config: DatabaseConfig):
        self.config = config
        self._engines: Dict[str, Any] = {}
        self._sessions: Dict[str, sessionmaker] = {}
        
        # Master database engine (for tenant management)
        self.master_engine = create_engine(
            self.config.master_db_url,
            poolclass=QueuePool,
            pool_size=self.config.pool_size,
            max_overflow=self.config.max_overflow,
            pool_timeout=self.config.pool_timeout,
            pool_recycle=self.config.pool_recycle,
            echo=os.getenv("SQL_DEBUG", "false").lower() == "true"
        )
        
        self.master_session = sessionmaker(
            bind=self.master_engine,
            autocommit=False,
            autoflush=False
        )
    
    def get_master_session(self) -> Session:
        """Get a session for the master tenant management database"""
        return self.master_session()
    
    def get_tenant_db_url(self, tenant_slug: str) -> str:
        """Generate database URL for a specific tenant"""
        return self.config.tenant_db_template.format(tenant_slug=tenant_slug)
    
    def get_tenant_engine(self, tenant_slug: str):
        """Get or create database engine for a tenant"""
        if tenant_slug not in self._engines:
            db_url = self.get_tenant_db_url(tenant_slug)
            
            self._engines[tenant_slug] = create_engine(
                db_url,
                poolclass=QueuePool,
                pool_size=5,  # Smaller pool per tenant
                max_overflow=10,
                pool_timeout=self.config.pool_timeout,
                pool_recycle=self.config.pool_recycle,
                echo=os.getenv("SQL_DEBUG", "false").lower() == "true"
            )
            
            self._sessions[tenant_slug] = sessionmaker(
                bind=self._engines[tenant_slug],
                autocommit=False,
                autoflush=False
            )
        
        return self._engines[tenant_slug]
    
    def get_tenant_session(self, tenant_slug: str) -> Session:
        """Get a database session for a specific tenant"""
        if tenant_slug not in self._sessions:
            self.get_tenant_engine(tenant_slug)  # This creates the session too
        
        return self._sessions[tenant_slug]()
    
    @asynccontextmanager
    async def get_tenant_session_async(self, tenant_slug: str):
        """Async context manager for tenant database sessions"""
        session = self.get_tenant_session(tenant_slug)
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()
    
    async def create_tenant_database(self, tenant_slug: str) -> bool:
        """Create a new database for a tenant"""
        db_name = f"tenant_{tenant_slug}"
        
        try:
            # Connect to PostgreSQL default database to create new one
            conn_parts = self.config.master_db_url.split('/')
            admin_db_url = '/'.join(conn_parts[:-1]) + '/postgres'
            
            conn = await asyncpg.connect(admin_db_url)
            
            try:
                # Check if database already exists
                result = await conn.fetchval(
                    "SELECT 1 FROM pg_database WHERE datname = $1", db_name
                )
                
                if result:
                    logger.warning("Tenant database already exists", tenant_slug=tenant_slug)
                    return True
                
                # Create the database
                await conn.execute(f'CREATE DATABASE "{db_name}"')
                logger.info("Created tenant database", tenant_slug=tenant_slug, db_name=db_name)
                
                # Initialize schema in the new database
                await self._initialize_tenant_schema(tenant_slug)
                
                return True
                
            finally:
                await conn.close()
                
        except Exception as e:
            logger.error("Failed to create tenant database", 
                        tenant_slug=tenant_slug, error=str(e))
            return False
    
    async def delete_tenant_database(self, tenant_slug: str) -> bool:
        """Delete a tenant's database (DANGEROUS!)"""
        db_name = f"tenant_{tenant_slug}"
        
        try:
            # Close any existing connections to the tenant database
            if tenant_slug in self._engines:
                self._engines[tenant_slug].dispose()
                del self._engines[tenant_slug]
                del self._sessions[tenant_slug]
            
            # Connect to PostgreSQL admin database
            conn_parts = self.config.master_db_url.split('/')
            admin_db_url = '/'.join(conn_parts[:-1]) + '/postgres'
            
            conn = await asyncpg.connect(admin_db_url)
            
            try:
                # Terminate all connections to the database
                await conn.execute("""
                    SELECT pg_terminate_backend(pid)
                    FROM pg_stat_activity
                    WHERE datname = $1 AND pid <> pg_backend_pid()
                """, db_name)
                
                # Drop the database
                await conn.execute(f'DROP DATABASE IF EXISTS "{db_name}"')
                logger.info("Deleted tenant database", tenant_slug=tenant_slug, db_name=db_name)
                
                return True
                
            finally:
                await conn.close()
                
        except Exception as e:
            logger.error("Failed to delete tenant database", 
                        tenant_slug=tenant_slug, error=str(e))
            return False
    
    async def _initialize_tenant_schema(self, tenant_slug: str):
        """Initialize database schema for a new tenant"""
        try:
            engine = self.get_tenant_engine(tenant_slug)
            
            # Import models and create tables
            from .models import Base
            Base.metadata.create_all(engine)
            
            logger.info("Initialized tenant database schema", tenant_slug=tenant_slug)
            
        except Exception as e:
            logger.error("Failed to initialize tenant schema", 
                        tenant_slug=tenant_slug, error=str(e))
            raise
    
    async def test_tenant_connection(self, tenant_slug: str) -> bool:
        """Test if we can connect to a tenant's database"""
        try:
            session = self.get_tenant_session(tenant_slug)
            session.execute(text("SELECT 1"))
            session.close()
            return True
        except Exception as e:
            logger.error("Tenant database connection failed", 
                        tenant_slug=tenant_slug, error=str(e))
            return False
    
    def close_all_connections(self):
        """Close all database connections"""
        try:
            # Close master engine
            self.master_engine.dispose()
            
            # Close all tenant engines
            for engine in self._engines.values():
                engine.dispose()
            
            self._engines.clear()
            self._sessions.clear()
            
            logger.info("Closed all database connections")
            
        except Exception as e:
            logger.error("Error closing database connections", error=str(e))

# Global instance
db_config = DatabaseConfig()
db_manager = TenantDatabaseManager(db_config)