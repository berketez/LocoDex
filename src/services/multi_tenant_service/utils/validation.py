"""
Validation utilities for multi-tenant system
"""

import re
import email_validator
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

@dataclass
class ValidationResult:
    is_valid: bool
    errors: List[str]
    warnings: List[str] = None
    
    def __post_init__(self):
        if self.warnings is None:
            self.warnings = []

class TenantValidator:
    """Validates tenant-related data"""
    
    # Regex patterns
    SLUG_PATTERN = re.compile(r'^[a-z0-9][a-z0-9-]*[a-z0-9]$')
    DOMAIN_PATTERN = re.compile(r'^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$')
    
    # Reserved slugs that cannot be used
    RESERVED_SLUGS = {
        'admin', 'api', 'www', 'app', 'dashboard', 'system', 'root', 'tenant',
        'health', 'status', 'docs', 'help', 'support', 'billing', 'settings',
        'login', 'logout', 'register', 'signup', 'auth', 'oauth', 'callback'
    }
    
    def validate_tenant_creation(
        self,
        name: str,
        admin_email: str,
        slug: Optional[str] = None,
        domain: Optional[str] = None
    ) -> ValidationResult:
        """Validate tenant creation data"""
        errors = []
        warnings = []
        
        # Validate name
        if not name or not name.strip():
            errors.append("Tenant name is required")
        elif len(name.strip()) < 2:
            errors.append("Tenant name must be at least 2 characters")
        elif len(name.strip()) > 255:
            errors.append("Tenant name must be less than 255 characters")
        
        # Validate admin email
        try:
            email_validator.validate_email(admin_email)
        except email_validator.EmailNotValidError as e:
            errors.append(f"Invalid admin email: {str(e)}")
        
        # Validate slug if provided
        if slug:
            slug_validation = self.validate_slug(slug)
            if not slug_validation.is_valid:
                errors.extend(slug_validation.errors)
        
        # Validate domain if provided
        if domain:
            domain_validation = self.validate_domain(domain)
            if not domain_validation.is_valid:
                errors.extend(domain_validation.errors)
        
        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings
        )
    
    def validate_slug(self, slug: str) -> ValidationResult:
        """Validate tenant slug"""
        errors = []
        warnings = []
        
        if not slug:
            errors.append("Slug is required")
            return ValidationResult(False, errors, warnings)
        
        # Length check
        if len(slug) < 3:
            errors.append("Slug must be at least 3 characters")
        elif len(slug) > 63:
            errors.append("Slug must be less than 63 characters")
        
        # Pattern check
        if not self.SLUG_PATTERN.match(slug):
            errors.append("Slug must contain only lowercase letters, numbers, and hyphens. Must start and end with alphanumeric characters")
        
        # Reserved words check
        if slug.lower() in self.RESERVED_SLUGS:
            errors.append(f"'{slug}' is a reserved slug and cannot be used")
        
        # Additional checks
        if '--' in slug:
            errors.append("Slug cannot contain consecutive hyphens")
        
        if slug.startswith('-') or slug.endswith('-'):
            errors.append("Slug cannot start or end with hyphens")
        
        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings
        )
    
    def validate_domain(self, domain: str) -> ValidationResult:
        """Validate custom domain"""
        errors = []
        warnings = []
        
        if not domain:
            return ValidationResult(True, [], [])  # Domain is optional
        
        # Length check
        if len(domain) > 253:
            errors.append("Domain name too long (max 253 characters)")
        
        # Pattern check
        if not self.DOMAIN_PATTERN.match(domain):
            errors.append("Invalid domain format")
        
        # Additional checks
        if domain.startswith('.') or domain.endswith('.'):
            errors.append("Domain cannot start or end with dots")
        
        if '..' in domain:
            errors.append("Domain cannot contain consecutive dots")
        
        # Check for localhost or IP addresses
        if domain.lower() in ['localhost', '127.0.0.1', '0.0.0.0']:
            warnings.append("Using localhost or IP addresses is not recommended for production")
        
        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings
        )
    
    def validate_tenant_update(self, updates: Dict[str, Any]) -> ValidationResult:
        """Validate tenant update data"""
        errors = []
        warnings = []
        
        # Validate each field that can be updated
        if 'name' in updates:
            name = updates['name']
            if not name or not name.strip():
                errors.append("Tenant name cannot be empty")
            elif len(name.strip()) < 2:
                errors.append("Tenant name must be at least 2 characters")
            elif len(name.strip()) > 255:
                errors.append("Tenant name must be less than 255 characters")
        
        if 'admin_email' in updates:
            try:
                email_validator.validate_email(updates['admin_email'])
            except email_validator.EmailNotValidError as e:
                errors.append(f"Invalid admin email: {str(e)}")
        
        if 'domain' in updates:
            domain_validation = self.validate_domain(updates['domain'])
            if not domain_validation.is_valid:
                errors.extend(domain_validation.errors)
            warnings.extend(domain_validation.warnings)
        
        # Remove subscription plan validation since it's not used
        
        if 'status' in updates:
            valid_statuses = ['active', 'suspended', 'deleted']
            if updates['status'] not in valid_statuses:
                errors.append(f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
        
        # Validate resource limits
        resource_fields = [
            'max_users', 'max_storage_gb', 'max_api_calls_per_day', 'max_ai_requests_per_day'
        ]
        
        for field in resource_fields:
            if field in updates:
                value = updates[field]
                if not isinstance(value, int) or value < 0:
                    errors.append(f"{field} must be a non-negative integer")
                elif value > 1000000:  # Reasonable upper limit
                    warnings.append(f"{field} value is very high: {value}")
        
        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings
        )
    
    def validate_user_data(self, user_data: Dict[str, Any]) -> ValidationResult:
        """Validate tenant user data"""
        errors = []
        warnings = []
        
        # Validate email
        if 'email' not in user_data:
            errors.append("Email is required")
        else:
            try:
                email_validator.validate_email(user_data['email'])
            except email_validator.EmailNotValidError as e:
                errors.append(f"Invalid email: {str(e)}")
        
        # Validate password if provided
        if 'password' in user_data:
            password_validation = self.validate_password(user_data['password'])
            if not password_validation.is_valid:
                errors.extend(password_validation.errors)
            warnings.extend(password_validation.warnings)
        
        # Validate role
        if 'role' in user_data:
            valid_roles = ['admin', 'user', 'viewer']
            if user_data['role'] not in valid_roles:
                errors.append(f"Invalid role. Must be one of: {', '.join(valid_roles)}")
        
        # Validate names
        for field in ['first_name', 'last_name']:
            if field in user_data:
                name = user_data[field]
                if name and len(name) > 100:
                    errors.append(f"{field} must be less than 100 characters")
        
        # Validate username if provided
        if 'username' in user_data:
            username = user_data['username']
            if username:
                if len(username) < 3:
                    errors.append("Username must be at least 3 characters")
                elif len(username) > 50:
                    errors.append("Username must be less than 50 characters")
                elif not re.match(r'^[a-zA-Z0-9_-]+$', username):
                    errors.append("Username can only contain letters, numbers, underscores, and hyphens")
        
        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings
        )
    
    def validate_password(self, password: str) -> ValidationResult:
        """Validate password strength"""
        errors = []
        warnings = []
        
        if not password:
            errors.append("Password is required")
            return ValidationResult(False, errors, warnings)
        
        # Length check
        if len(password) < 8:
            errors.append("Password must be at least 8 characters")
        elif len(password) < 12:
            warnings.append("Consider using a longer password for better security")
        
        if len(password) > 128:
            errors.append("Password is too long (max 128 characters)")
        
        # Character requirements
        has_lower = any(c.islower() for c in password)
        has_upper = any(c.isupper() for c in password)
        has_digit = any(c.isdigit() for c in password)
        has_special = any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password)
        
        requirements_met = sum([has_lower, has_upper, has_digit, has_special])
        
        if requirements_met < 3:
            errors.append("Password must contain at least 3 of: lowercase, uppercase, numbers, special characters")
        elif requirements_met == 3:
            warnings.append("Consider adding more character types for stronger security")
        
        # Common password patterns
        if password.lower() in ['password', '12345678', 'qwerty123', 'admin123']:
            errors.append("Password is too common")
        
        if re.match(r'^(.)\1{7,}$', password):  # Repeated characters
            errors.append("Password cannot be the same character repeated")
        
        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings
        )