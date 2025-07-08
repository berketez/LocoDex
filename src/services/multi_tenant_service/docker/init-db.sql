-- Initialize Multi-Tenant Database
-- This script runs when PostgreSQL container starts for the first time

-- Create additional databases that might be needed
-- The main locodex_tenants database is created automatically

-- Set up extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create a user for the application (optional)
-- CREATE USER locodex_app WITH PASSWORD 'secure_password';
-- GRANT ALL PRIVILEGES ON DATABASE locodex_tenants TO locodex_app;

-- Set up some initial configuration
-- You can add any initialization SQL here

-- Create a sample tenant database for testing (optional)
-- CREATE DATABASE tenant_demo;

COMMENT ON DATABASE locodex_tenants IS 'Multi-tenant management database for LocoDex platform';