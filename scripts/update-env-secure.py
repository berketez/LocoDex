#!/usr/bin/env python3

"""
Secure .env file updater for LocoDex
Handles special characters in passwords safely
"""

import os
import re
import secrets
import string
import base64
from pathlib import Path

def generate_secure_password(length=32):
    """Generate a secure base64 password"""
    # Generate random bytes and encode as base64
    random_bytes = secrets.token_bytes(length)
    return base64.b64encode(random_bytes).decode('ascii')

def generate_readable_password(length=24):
    """Generate a more readable password for manual entry"""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def update_env_file(env_path):
    """Update .env file with secure passwords"""
    
    # Generate secure passwords
    redis_password = generate_secure_password()
    grafana_password = generate_readable_password()
    grafana_secret = generate_secure_password()
    
    print(f"Generated passwords:")
    print(f"  - Redis password: {redis_password[:8]}...")
    print(f"  - Grafana password: {grafana_password[:8]}...")
    print(f"  - Grafana secret: {grafana_secret[:8]}...")
    
    # Read current .env file
    with open(env_path, 'r') as f:
        content = f.read()
    
    # Replace passwords using regex
    replacements = {
        r'REDIS_PASSWORD=.*': f'REDIS_PASSWORD={redis_password}',
        r'GF_SECURITY_ADMIN_PASSWORD=.*': f'GF_SECURITY_ADMIN_PASSWORD={grafana_password}',
        r'GF_SECURITY_SECRET_KEY=.*': f'GF_SECURITY_SECRET_KEY={grafana_secret}'
    }
    
    for pattern, replacement in replacements.items():
        content = re.sub(pattern, replacement, content)
    
    # Write updated content
    with open(env_path, 'w') as f:
        f.write(content)
    
    # Set restrictive permissions
    os.chmod(env_path, 0o600)
    
    return {
        'redis_password': redis_password,
        'grafana_password': grafana_password,
        'grafana_secret': grafana_secret
    }

def main():
    script_dir = Path(__file__).parent
    project_dir = script_dir.parent
    env_file = project_dir / '.env'
    
    print("🔐 Updating LocoDex Configuration with Secure Passwords")
    print("======================================================")
    
    if not env_file.exists():
        print("❌ .env file not found!")
        return 1
    
    # Create backup
    import shutil
    from datetime import datetime
    backup_name = f".env.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    backup_path = project_dir / backup_name
    shutil.copy2(env_file, backup_path)
    print(f"✅ Backup created: {backup_name}")
    
    # Update passwords
    print("\n🔑 Generating and updating passwords...")
    passwords = update_env_file(env_file)
    
    print("\n✅ .env file updated with secure passwords")
    print(f"✅ File permissions set to 600")
    
    print("\n🔒 IMPORTANT: Save these credentials securely!")
    print("=" * 50)
    print(f"Redis Password: {passwords['redis_password']}")
    print(f"Grafana Admin User: admin")
    print(f"Grafana Admin Password: {passwords['grafana_password']}")
    print("=" * 50)
    print("⚠️  Store these in a secure password manager")
    print("⚠️  Change Grafana password after first login")
    
    return 0

if __name__ == "__main__":
    exit(main())