"""
Multi-Tenant Service Main Application
"""

import os
import sys
import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
import structlog

# Add current directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from api.endpoints import router
from api.tenant_router import TenantMiddleware
from database.config import db_manager
from database.models import Base

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="ISO"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting Multi-Tenant Service")
    
    try:
        # Initialize master database
        logger.info("Initializing master database...")
        Base.metadata.create_all(db_manager.master_engine)
        logger.info("Master database initialized")
        
        # Test database connection
        session = db_manager.get_master_session()
        session.execute("SELECT 1")
        session.close()
        logger.info("Database connection verified")
        
    except Exception as e:
        logger.error("Failed to initialize database", error=str(e))
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down Multi-Tenant Service")
    try:
        db_manager.close_all_connections()
        logger.info("Database connections closed")
    except Exception as e:
        logger.error("Error during shutdown", error=str(e))

# Create FastAPI application
app = FastAPI(
    title="LocoDex Multi-Tenant Service",
    description="A comprehensive multi-tenancy solution for LocoDex platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Trusted Host Middleware (for production)
if os.getenv("ENVIRONMENT", "development") == "production":
    trusted_hosts = os.getenv("TRUSTED_HOSTS", "localhost").split(",")
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=trusted_hosts
    )

# Tenant Resolution Middleware
app.add_middleware(TenantMiddleware)

# Exception Handlers
@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(
        status_code=404,
        content={
            "detail": "Not found",
            "path": str(request.url.path),
            "method": request.method
        }
    )

@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    logger.error("Internal server error", 
                path=request.url.path, 
                method=request.method, 
                error=str(exc))
    
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "error_id": "Please check logs for details"
        }
    )

# Include API routes
app.include_router(router)

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with service information"""
    return {
        "service": "LocoDex Multi-Tenant Service",
        "version": "1.0.0",
        "status": "operational",
        "documentation": "/docs",
        "endpoints": {
            "admin": "/admin/*",
            "tenant_api": "/api/v1/*",
            "health": "/health"
        }
    }

# Additional health endpoints
@app.get("/health/detailed")
async def detailed_health():
    """Detailed health check"""
    health_info = {
        "status": "healthy",
        "checks": {}
    }
    
    # Database health
    try:
        session = db_manager.get_master_session()
        session.execute("SELECT 1")
        session.close()
        health_info["checks"]["database"] = "healthy"
    except Exception as e:
        health_info["checks"]["database"] = f"unhealthy: {str(e)}"
        health_info["status"] = "unhealthy"
    
    # Redis health (if available)
    try:
        from core.tenant_isolation import tenant_isolation
        tenant_isolation.redis_client.ping()
        health_info["checks"]["redis"] = "healthy"
    except Exception as e:
        health_info["checks"]["redis"] = f"unhealthy: {str(e)}"
        # Redis is optional, don't mark overall status as unhealthy
    
    return health_info

@app.get("/metrics")
async def metrics():
    """Basic metrics endpoint"""
    # This could be expanded to provide Prometheus metrics
    try:
        session = db_manager.get_master_session()
        from database.models import Tenant
        
        total_tenants = session.query(Tenant).count()
        active_tenants = session.query(Tenant).filter(
            Tenant.status == "active",
            Tenant.deleted_at.is_(None)
        ).count()
        
        session.close()
        
        return {
            "tenants": {
                "total": total_tenants,
                "active": active_tenants
            },
            "timestamp": "2025-01-01T00:00:00Z"  # Would use actual timestamp
        }
    except Exception as e:
        logger.error("Failed to get metrics", error=str(e))
        return {"error": "Unable to retrieve metrics"}

if __name__ == "__main__":
    # Configuration
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8002"))
    workers = int(os.getenv("WORKERS", "1"))
    reload = os.getenv("RELOAD", "false").lower() == "true"
    log_level = os.getenv("LOG_LEVEL", "info")
    
    # Run application
    logger.info("Starting Multi-Tenant Service", 
               host=host, port=port, workers=workers)
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        workers=workers if not reload else 1,
        reload=reload,
        log_level=log_level,
        access_log=True
    )