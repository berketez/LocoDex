"""
Encryption utilities for tenant data protection
"""

import os
import base64
import hashlib
from typing import Optional, Union
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import structlog

logger = structlog.get_logger()

class EncryptionManager:
    """Handles encryption/decryption for tenant data"""
    
    def __init__(self):
        # Master encryption key for system-level encryption
        self.master_key = os.getenv("MASTER_ENCRYPTION_KEY")
        if not self.master_key:
            logger.warning("No master encryption key found, generating temporary one")
            self.master_key = Fernet.generate_key().decode()
    
    def generate_tenant_key(self) -> str:
        """Generate a new encryption key for a tenant"""
        return Fernet.generate_key().decode()
    
    def encrypt_data(self, data: str, encryption_key: str) -> str:
        """Encrypt data using tenant-specific key"""
        try:
            key_bytes = encryption_key.encode() if isinstance(encryption_key, str) else encryption_key
            fernet = Fernet(key_bytes)
            
            data_bytes = data.encode('utf-8')
            encrypted_data = fernet.encrypt(data_bytes)
            
            # Return base64 encoded string for storage
            return base64.b64encode(encrypted_data).decode('utf-8')
            
        except Exception as e:
            logger.error("Failed to encrypt data", error=str(e))
            raise
    
    def decrypt_data(self, encrypted_data: str, encryption_key: str) -> str:
        """Decrypt data using tenant-specific key"""
        try:
            key_bytes = encryption_key.encode() if isinstance(encryption_key, str) else encryption_key
            fernet = Fernet(key_bytes)
            
            # Decode from base64
            encrypted_bytes = base64.b64decode(encrypted_data.encode('utf-8'))
            
            decrypted_data = fernet.decrypt(encrypted_bytes)
            return decrypted_data.decode('utf-8')
            
        except Exception as e:
            logger.error("Failed to decrypt data", error=str(e))
            raise
    
    def hash_password(self, password: str, salt: Optional[bytes] = None) -> tuple[str, str]:
        """Hash password with salt"""
        if salt is None:
            salt = os.urandom(32)
        
        # Use PBKDF2 with SHA256
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        
        password_bytes = password.encode('utf-8')
        key = kdf.derive(password_bytes)
        
        # Return base64 encoded hash and salt
        hash_b64 = base64.b64encode(key).decode('utf-8')
        salt_b64 = base64.b64encode(salt).decode('utf-8')
        
        return hash_b64, salt_b64
    
    def verify_password(self, password: str, stored_hash: str, stored_salt: str) -> bool:
        """Verify password against stored hash"""
        try:
            salt = base64.b64decode(stored_salt.encode('utf-8'))
            
            # Hash the provided password with the stored salt
            computed_hash, _ = self.hash_password(password, salt)
            
            return computed_hash == stored_hash
            
        except Exception as e:
            logger.error("Failed to verify password", error=str(e))
            return False
    
    def generate_api_key_hash(self, api_key: str) -> str:
        """Generate hash of API key for secure storage"""
        return hashlib.sha256(api_key.encode('utf-8')).hexdigest()
    
    def encrypt_sensitive_field(self, value: str, tenant_encryption_key: str) -> str:
        """Encrypt a sensitive field for database storage"""
        if not value:
            return ""
        
        try:
            return self.encrypt_data(value, tenant_encryption_key)
        except Exception as e:
            logger.error("Failed to encrypt sensitive field", error=str(e))
            return value  # Return original if encryption fails
    
    def decrypt_sensitive_field(self, encrypted_value: str, tenant_encryption_key: str) -> str:
        """Decrypt a sensitive field from database"""
        if not encrypted_value:
            return ""
        
        try:
            return self.decrypt_data(encrypted_value, tenant_encryption_key)
        except Exception as e:
            logger.error("Failed to decrypt sensitive field", error=str(e))
            return encrypted_value  # Return original if decryption fails