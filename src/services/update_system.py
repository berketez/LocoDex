"""
LocoDex Auto-Update System
Advanced automatic update management with rollback capabilities
"""

import os
import sys
import json
import time
import shutil
import hashlib
import zipfile
import tempfile
import subprocess
import threading
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, asdict
from pathlib import Path
import semver
import logging
from concurrent.futures import ThreadPoolExecutor
import sqlite3
import yaml
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('update_system.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class UpdateInfo:
    """Information about an available update"""
    version: str
    release_date: datetime
    download_url: str
    checksum: str
    size: int
    changelog: str
    critical: bool = False
    pre_release: bool = False
    min_version: str = "0.0.0"
    max_version: str = "999.999.999"
    platform: str = "all"
    architecture: str = "all"
    dependencies: List[str] = None
    
    def __post_init__(self):
        if self.dependencies is None:
            self.dependencies = []

@dataclass
class UpdateResult:
    """Result of an update operation"""
    success: bool
    version: str
    message: str
    error_code: Optional[str] = None
    rollback_available: bool = False
    restart_required: bool = True
    backup_path: Optional[str] = None

@dataclass
class BackupInfo:
    """Information about a backup"""
    version: str
    backup_path: str
    created_at: datetime
    size: int
    checksum: str
    description: str = ""

class UpdateManager:
    """Advanced update management system"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.app_path = Path(config.get('app_path', os.getcwd()))
        self.update_server = config.get('update_server', 'https://updates.locodex.ai')
        self.current_version = config.get('current_version', '1.0.0')
        self.auto_update = config.get('auto_update', True)
        self.check_interval = config.get('check_interval', 3600)  # 1 hour
        self.backup_retention = config.get('backup_retention', 5)
        self.encryption_key = self._get_encryption_key()
        
        # Paths
        self.update_dir = self.app_path / 'updates'
        self.backup_dir = self.app_path / 'backups'
        self.temp_dir = self.app_path / 'temp'
        self.db_path = self.app_path / 'update_system.db'
        
        # Create directories
        for directory in [self.update_dir, self.backup_dir, self.temp_dir]:
            directory.mkdir(exist_ok=True)
        
        # Initialize database
        self._init_database()
        
        # Update checking thread
        self._update_thread = None
        self._stop_checking = threading.Event()
        
        # Rollback information
        self._rollback_info = None
        
        logger.info(f"UpdateManager initialized for version {self.current_version}")
    
    def _get_encryption_key(self) -> bytes:
        """Generate or retrieve encryption key for secure updates"""
        key_file = self.app_path / '.update_key'
        
        if key_file.exists():
            with open(key_file, 'rb') as f:
                return f.read()
        else:
            # Generate new key
            password = b"locodex_update_system_2024"
            salt = os.urandom(16)
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=salt,
                iterations=100000,
            )
            key = base64.urlsafe_b64encode(kdf.derive(password))
            
            with open(key_file, 'wb') as f:
                f.write(key)
            
            return key
    
    def _init_database(self):
        """Initialize update tracking database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Update history table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS update_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                version TEXT NOT NULL,
                previous_version TEXT,
                update_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                success BOOLEAN NOT NULL,
                error_message TEXT,
                rollback_available BOOLEAN DEFAULT FALSE,
                backup_path TEXT,
                checksum TEXT,
                size INTEGER,
                duration REAL,
                metadata TEXT
            )
        ''')
        
        # Backup registry table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS backup_registry (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                version TEXT NOT NULL,
                backup_path TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                size INTEGER,
                checksum TEXT,
                description TEXT,
                encrypted BOOLEAN DEFAULT FALSE
            )
        ''')
        
        # Update checks table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS update_checks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                check_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                current_version TEXT,
                latest_version TEXT,
                update_available BOOLEAN,
                check_duration REAL,
                error_message TEXT
            )
        ''')
        
        # Configuration table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS update_config (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        conn.commit()
        conn.close()
        
        logger.info("Update database initialized")
    
    def start_auto_update_checking(self):
        """Start automatic update checking in background"""
        if self.auto_update and not self._update_thread:
            self._update_thread = threading.Thread(
                target=self._update_check_loop,
                daemon=True
            )
            self._update_thread.start()
            logger.info("Auto-update checking started")
    
    def stop_auto_update_checking(self):
        """Stop automatic update checking"""
        if self._update_thread:
            self._stop_checking.set()
            self._update_thread.join(timeout=10)
            self._update_thread = None
            logger.info("Auto-update checking stopped")
    
    def _update_check_loop(self):
        """Background loop for checking updates"""
        while not self._stop_checking.wait(self.check_interval):
            try:
                update_info = self.check_for_updates()
                if update_info and self._should_auto_update(update_info):
                    logger.info(f"Auto-updating to version {update_info.version}")
                    result = self.perform_update(update_info)
                    if result.success:
                        logger.info(f"Auto-update successful: {result.message}")
                        if result.restart_required:
                            self._schedule_restart()
                    else:
                        logger.error(f"Auto-update failed: {result.message}")
            except Exception as e:
                logger.error(f"Error in update check loop: {e}")
    
    def check_for_updates(self) -> Optional[UpdateInfo]:
        """Check for available updates"""
        start_time = time.time()
        
        try:
            # Prepare request
            headers = {
                'User-Agent': f'LocoDex-UpdateClient/{self.current_version}',
                'X-Current-Version': self.current_version,
                'X-Platform': sys.platform,
                'X-Architecture': os.uname().machine if hasattr(os, 'uname') else 'unknown'
            }
            
            # Make request to update server
            response = requests.get(
                f"{self.update_server}/api/v1/check-update",
                headers=headers,
                timeout=30
            )
            response.raise_for_status()
            
            data = response.json()
            
            # Log check
            self._log_update_check(
                latest_version=data.get('latest_version', self.current_version),
                update_available=data.get('update_available', False),
                duration=time.time() - start_time
            )
            
            if data.get('update_available', False):
                update_data = data['update_info']
                return UpdateInfo(
                    version=update_data['version'],
                    release_date=datetime.fromisoformat(update_data['release_date']),
                    download_url=update_data['download_url'],
                    checksum=update_data['checksum'],
                    size=update_data['size'],
                    changelog=update_data['changelog'],
                    critical=update_data.get('critical', False),
                    pre_release=update_data.get('pre_release', False),
                    min_version=update_data.get('min_version', '0.0.0'),
                    max_version=update_data.get('max_version', '999.999.999'),
                    platform=update_data.get('platform', 'all'),
                    architecture=update_data.get('architecture', 'all'),
                    dependencies=update_data.get('dependencies', [])
                )
            
            return None
        
        except Exception as e:
            logger.error(f"Failed to check for updates: {e}")
            self._log_update_check(
                latest_version=self.current_version,
                update_available=False,
                duration=time.time() - start_time,
                error=str(e)
            )
            return None
    
    def perform_update(self, update_info: UpdateInfo) -> UpdateResult:
        """Perform the actual update"""
        logger.info(f"Starting update to version {update_info.version}")
        start_time = time.time()
        
        try:
            # Validate update compatibility
            if not self._validate_update_compatibility(update_info):
                return UpdateResult(
                    success=False,
                    version=update_info.version,
                    message="Update not compatible with current system",
                    error_code="COMPATIBILITY_ERROR"
                )
            
            # Create backup
            backup_info = self.create_backup(f"pre-update-{update_info.version}")
            if not backup_info:
                return UpdateResult(
                    success=False,
                    version=update_info.version,
                    message="Failed to create backup",
                    error_code="BACKUP_ERROR"
                )
            
            # Download update
            update_file = self._download_update(update_info)
            if not update_file:
                return UpdateResult(
                    success=False,
                    version=update_info.version,
                    message="Failed to download update",
                    error_code="DOWNLOAD_ERROR",
                    rollback_available=True,
                    backup_path=backup_info.backup_path
                )
            
            # Verify checksum
            if not self._verify_checksum(update_file, update_info.checksum):
                return UpdateResult(
                    success=False,
                    version=update_info.version,
                    message="Update file checksum verification failed",
                    error_code="CHECKSUM_ERROR",
                    rollback_available=True,
                    backup_path=backup_info.backup_path
                )
            
            # Apply update
            if not self._apply_update(update_file, update_info):
                return UpdateResult(
                    success=False,
                    version=update_info.version,
                    message="Failed to apply update",
                    error_code="APPLY_ERROR",
                    rollback_available=True,
                    backup_path=backup_info.backup_path
                )
            
            # Update version info
            self._update_version_info(update_info.version)
            
            # Log successful update
            duration = time.time() - start_time
            self._log_update_result(
                version=update_info.version,
                previous_version=self.current_version,
                success=True,
                backup_path=backup_info.backup_path,
                checksum=update_info.checksum,
                size=update_info.size,
                duration=duration
            )
            
            # Clean up old backups
            self._cleanup_old_backups()
            
            # Store rollback info
            self._rollback_info = backup_info
            
            logger.info(f"Update to version {update_info.version} completed successfully")
            
            return UpdateResult(
                success=True,
                version=update_info.version,
                message=f"Successfully updated to version {update_info.version}",
                rollback_available=True,
                restart_required=True,
                backup_path=backup_info.backup_path
            )
        
        except Exception as e:
            logger.error(f"Update failed: {e}")
            duration = time.time() - start_time
            self._log_update_result(
                version=update_info.version,
                previous_version=self.current_version,
                success=False,
                error_message=str(e),
                duration=duration
            )
            
            return UpdateResult(
                success=False,
                version=update_info.version,
                message=f"Update failed: {str(e)}",
                error_code="GENERAL_ERROR",
                rollback_available=True
            )
    
    def create_backup(self, description: str = "") -> Optional[BackupInfo]:
        """Create a backup of the current application"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_name = f"backup_{self.current_version}_{timestamp}.zip"
            backup_path = self.backup_dir / backup_name
            
            logger.info(f"Creating backup: {backup_name}")
            
            # Create backup archive
            with zipfile.ZipFile(backup_path, 'w', zipfile.ZIP_DEFLATED) as backup_zip:
                for root, dirs, files in os.walk(self.app_path):
                    # Skip backup and temp directories
                    root_path = Path(root)
                    if (self.backup_dir in root_path.parents or 
                        self.temp_dir in root_path.parents or
                        root_path == self.backup_dir or 
                        root_path == self.temp_dir):
                        continue
                    
                    for file in files:
                        file_path = Path(root) / file
                        arcname = file_path.relative_to(self.app_path)
                        backup_zip.write(file_path, arcname)
            
            # Calculate checksum
            checksum = self._calculate_file_checksum(backup_path)
            size = backup_path.stat().st_size
            
            # Create backup info
            backup_info = BackupInfo(
                version=self.current_version,
                backup_path=str(backup_path),
                created_at=datetime.now(),
                size=size,
                checksum=checksum,
                description=description
            )
            
            # Register backup in database
            self._register_backup(backup_info)
            
            logger.info(f"Backup created successfully: {backup_name} ({size} bytes)")
            return backup_info
        
        except Exception as e:
            logger.error(f"Failed to create backup: {e}")
            return None
    
    def rollback_update(self, backup_path: Optional[str] = None) -> UpdateResult:
        """Rollback to previous version using backup"""
        try:
            if backup_path is None and self._rollback_info:
                backup_path = self._rollback_info.backup_path
            
            if not backup_path or not Path(backup_path).exists():
                return UpdateResult(
                    success=False,
                    version=self.current_version,
                    message="No valid backup found for rollback",
                    error_code="NO_BACKUP"
                )
            
            logger.info(f"Starting rollback using backup: {backup_path}")
            
            # Extract backup
            with zipfile.ZipFile(backup_path, 'r') as backup_zip:
                # Create temporary extraction directory
                with tempfile.TemporaryDirectory() as temp_extract:
                    backup_zip.extractall(temp_extract)
                    
                    # Replace current files with backup
                    for root, dirs, files in os.walk(temp_extract):
                        for file in files:
                            src_file = Path(root) / file
                            rel_path = src_file.relative_to(temp_extract)
                            dst_file = self.app_path / rel_path
                            
                            # Create directory if needed
                            dst_file.parent.mkdir(parents=True, exist_ok=True)
                            
                            # Copy file
                            shutil.copy2(src_file, dst_file)
            
            # Get backup version info
            backup_info = self._get_backup_info(backup_path)
            if backup_info:
                self._update_version_info(backup_info.version)
                rollback_version = backup_info.version
            else:
                rollback_version = "unknown"
            
            logger.info(f"Rollback completed successfully to version {rollback_version}")
            
            return UpdateResult(
                success=True,
                version=rollback_version,
                message=f"Successfully rolled back to version {rollback_version}",
                restart_required=True
            )
        
        except Exception as e:
            logger.error(f"Rollback failed: {e}")
            return UpdateResult(
                success=False,
                version=self.current_version,
                message=f"Rollback failed: {str(e)}",
                error_code="ROLLBACK_ERROR"
            )
    
    def get_update_history(self) -> List[Dict[str, Any]]:
        """Get update history"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT version, previous_version, update_date, success, 
                       error_message, rollback_available, backup_path,
                       checksum, size, duration
                FROM update_history 
                ORDER BY update_date DESC
            ''')
            
            history = []
            for row in cursor.fetchall():
                history.append({
                    'version': row[0],
                    'previous_version': row[1],
                    'update_date': row[2],
                    'success': bool(row[3]),
                    'error_message': row[4],
                    'rollback_available': bool(row[5]),
                    'backup_path': row[6],
                    'checksum': row[7],
                    'size': row[8],
                    'duration': row[9]
                })
            
            conn.close()
            return history
        
        except Exception as e:
            logger.error(f"Failed to get update history: {e}")
            return []
    
    def get_available_backups(self) -> List[BackupInfo]:
        """Get list of available backups"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT version, backup_path, created_at, size, 
                       checksum, description
                FROM backup_registry 
                WHERE backup_path IS NOT NULL
                ORDER BY created_at DESC
            ''')
            
            backups = []
            for row in cursor.fetchall():
                backup_path = row[1]
                if Path(backup_path).exists():
                    backups.append(BackupInfo(
                        version=row[0],
                        backup_path=backup_path,
                        created_at=datetime.fromisoformat(row[2]),
                        size=row[3],
                        checksum=row[4],
                        description=row[5] or ""
                    ))
            
            conn.close()
            return backups
        
        except Exception as e:
            logger.error(f"Failed to get available backups: {e}")
            return []
    
    def _should_auto_update(self, update_info: UpdateInfo) -> bool:
        """Determine if auto-update should be performed"""
        # Always auto-update critical updates
        if update_info.critical:
            return True
        
        # Don't auto-update pre-releases unless configured
        if update_info.pre_release and not self.config.get('auto_update_prerelease', False):
            return False
        
        # Check if it's a major version change
        current_major = semver.VersionInfo.parse(self.current_version).major
        update_major = semver.VersionInfo.parse(update_info.version).major
        
        if update_major > current_major and not self.config.get('auto_update_major', False):
            return False
        
        return True
    
    def _validate_update_compatibility(self, update_info: UpdateInfo) -> bool:
        """Validate if update is compatible with current system"""
        try:
            # Check version compatibility
            current_ver = semver.VersionInfo.parse(self.current_version)
            min_ver = semver.VersionInfo.parse(update_info.min_version)
            max_ver = semver.VersionInfo.parse(update_info.max_version)
            
            if not (min_ver <= current_ver <= max_ver):
                logger.warning(f"Version compatibility check failed: {self.current_version} not in range {update_info.min_version}-{update_info.max_version}")
                return False
            
            # Check platform compatibility
            if update_info.platform != "all" and update_info.platform != sys.platform:
                logger.warning(f"Platform compatibility check failed: {sys.platform} != {update_info.platform}")
                return False
            
            # Check architecture compatibility
            current_arch = os.uname().machine if hasattr(os, 'uname') else 'unknown'
            if update_info.architecture != "all" and update_info.architecture != current_arch:
                logger.warning(f"Architecture compatibility check failed: {current_arch} != {update_info.architecture}")
                return False
            
            # Check dependencies
            for dependency in update_info.dependencies:
                if not self._check_dependency(dependency):
                    logger.warning(f"Dependency check failed: {dependency}")
                    return False
            
            return True
        
        except Exception as e:
            logger.error(f"Compatibility validation failed: {e}")
            return False
    
    def _check_dependency(self, dependency: str) -> bool:
        """Check if a dependency is satisfied"""
        try:
            # Parse dependency string (e.g., "python>=3.8", "node>=14.0")
            if ">=" in dependency:
                name, version = dependency.split(">=")
                return self._check_version_requirement(name.strip(), version.strip(), ">=")
            elif "==" in dependency:
                name, version = dependency.split("==")
                return self._check_version_requirement(name.strip(), version.strip(), "==")
            else:
                # Just check if the dependency exists
                return self._check_program_exists(dependency.strip())
        
        except Exception as e:
            logger.error(f"Dependency check failed for {dependency}: {e}")
            return False
    
    def _check_version_requirement(self, program: str, required_version: str, operator: str) -> bool:
        """Check if program version meets requirement"""
        try:
            if program == "python":
                current_version = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
            else:
                # Try to get version from command line
                result = subprocess.run([program, "--version"], capture_output=True, text=True, timeout=10)
                if result.returncode != 0:
                    return False
                
                # Extract version from output (basic parsing)
                import re
                version_match = re.search(r'(\d+\.\d+\.\d+)', result.stdout)
                if not version_match:
                    return False
                current_version = version_match.group(1)
            
            # Compare versions
            current_ver = semver.VersionInfo.parse(current_version)
            required_ver = semver.VersionInfo.parse(required_version)
            
            if operator == ">=":
                return current_ver >= required_ver
            elif operator == "==":
                return current_ver == required_ver
            else:
                return False
        
        except Exception as e:
            logger.error(f"Version check failed for {program}: {e}")
            return False
    
    def _check_program_exists(self, program: str) -> bool:
        """Check if a program exists in PATH"""
        return shutil.which(program) is not None
    
    def _download_update(self, update_info: UpdateInfo) -> Optional[Path]:
        """Download update file"""
        try:
            logger.info(f"Downloading update from {update_info.download_url}")
            
            # Create temporary file
            temp_file = self.temp_dir / f"update_{update_info.version}.zip"
            
            # Download with progress
            response = requests.get(update_info.download_url, stream=True, timeout=300)
            response.raise_for_status()
            
            total_size = int(response.headers.get('content-length', 0))
            downloaded = 0
            
            with open(temp_file, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        
                        # Log progress every 10MB
                        if downloaded % (10 * 1024 * 1024) == 0:
                            progress = (downloaded / total_size * 100) if total_size > 0 else 0
                            logger.info(f"Download progress: {progress:.1f}%")
            
            logger.info(f"Download completed: {temp_file} ({downloaded} bytes)")
            return temp_file
        
        except Exception as e:
            logger.error(f"Download failed: {e}")
            return None
    
    def _verify_checksum(self, file_path: Path, expected_checksum: str) -> bool:
        """Verify file checksum"""
        try:
            actual_checksum = self._calculate_file_checksum(file_path)
            return actual_checksum.lower() == expected_checksum.lower()
        except Exception as e:
            logger.error(f"Checksum verification failed: {e}")
            return False
    
    def _calculate_file_checksum(self, file_path: Path) -> str:
        """Calculate SHA256 checksum of file"""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256_hash.update(chunk)
        return sha256_hash.hexdigest()
    
    def _apply_update(self, update_file: Path, update_info: UpdateInfo) -> bool:
        """Apply the update"""
        try:
            logger.info(f"Applying update from {update_file}")
            
            # Extract update to temporary directory
            with tempfile.TemporaryDirectory() as temp_extract:
                with zipfile.ZipFile(update_file, 'r') as update_zip:
                    update_zip.extractall(temp_extract)
                
                # Run pre-update script if exists
                pre_update_script = Path(temp_extract) / "pre_update.py"
                if pre_update_script.exists():
                    logger.info("Running pre-update script")
                    result = subprocess.run([sys.executable, str(pre_update_script)], 
                                          capture_output=True, text=True, timeout=300)
                    if result.returncode != 0:
                        logger.error(f"Pre-update script failed: {result.stderr}")
                        return False
                
                # Copy files
                for root, dirs, files in os.walk(temp_extract):
                    for file in files:
                        if file in ['pre_update.py', 'post_update.py']:
                            continue
                        
                        src_file = Path(root) / file
                        rel_path = src_file.relative_to(temp_extract)
                        dst_file = self.app_path / rel_path
                        
                        # Create directory if needed
                        dst_file.parent.mkdir(parents=True, exist_ok=True)
                        
                        # Copy file
                        shutil.copy2(src_file, dst_file)
                
                # Run post-update script if exists
                post_update_script = Path(temp_extract) / "post_update.py"
                if post_update_script.exists():
                    logger.info("Running post-update script")
                    result = subprocess.run([sys.executable, str(post_update_script)], 
                                          capture_output=True, text=True, timeout=300)
                    if result.returncode != 0:
                        logger.error(f"Post-update script failed: {result.stderr}")
                        return False
            
            # Clean up update file
            update_file.unlink()
            
            logger.info("Update applied successfully")
            return True
        
        except Exception as e:
            logger.error(f"Failed to apply update: {e}")
            return False
    
    def _update_version_info(self, new_version: str):
        """Update version information"""
        try:
            # Update version in config file
            version_file = self.app_path / "version.json"
            version_info = {
                "version": new_version,
                "updated_at": datetime.now().isoformat(),
                "previous_version": self.current_version
            }
            
            with open(version_file, 'w') as f:
                json.dump(version_info, f, indent=2)
            
            # Update current version
            self.current_version = new_version
            
            logger.info(f"Version updated to {new_version}")
        
        except Exception as e:
            logger.error(f"Failed to update version info: {e}")
    
    def _schedule_restart(self):
        """Schedule application restart"""
        try:
            # Create restart script
            restart_script = self.app_path / "restart.py"
            script_content = f'''
import os
import sys
import time
import subprocess

# Wait for current process to exit
time.sleep(5)

# Restart application
if sys.platform == "win32":
    subprocess.Popen([sys.executable, "{self.app_path / 'main.py'}"])
else:
    os.execv(sys.executable, [sys.executable, "{self.app_path / 'main.py'}"])
'''
            
            with open(restart_script, 'w') as f:
                f.write(script_content)
            
            # Schedule restart
            subprocess.Popen([sys.executable, str(restart_script)])
            
            logger.info("Restart scheduled")
        
        except Exception as e:
            logger.error(f"Failed to schedule restart: {e}")
    
    def _log_update_check(self, latest_version: str, update_available: bool, 
                         duration: float, error: str = None):
        """Log update check result"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO update_checks 
                (current_version, latest_version, update_available, check_duration, error_message)
                VALUES (?, ?, ?, ?, ?)
            ''', (self.current_version, latest_version, update_available, duration, error))
            
            conn.commit()
            conn.close()
        
        except Exception as e:
            logger.error(f"Failed to log update check: {e}")
    
    def _log_update_result(self, version: str, previous_version: str, success: bool,
                          error_message: str = None, backup_path: str = None,
                          checksum: str = None, size: int = None, duration: float = None):
        """Log update result"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO update_history 
                (version, previous_version, success, error_message, rollback_available,
                 backup_path, checksum, size, duration)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (version, previous_version, success, error_message, 
                  backup_path is not None, backup_path, checksum, size, duration))
            
            conn.commit()
            conn.close()
        
        except Exception as e:
            logger.error(f"Failed to log update result: {e}")
    
    def _register_backup(self, backup_info: BackupInfo):
        """Register backup in database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO backup_registry 
                (version, backup_path, size, checksum, description)
                VALUES (?, ?, ?, ?, ?)
            ''', (backup_info.version, backup_info.backup_path, 
                  backup_info.size, backup_info.checksum, backup_info.description))
            
            conn.commit()
            conn.close()
        
        except Exception as e:
            logger.error(f"Failed to register backup: {e}")
    
    def _get_backup_info(self, backup_path: str) -> Optional[BackupInfo]:
        """Get backup information from database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT version, created_at, size, checksum, description
                FROM backup_registry 
                WHERE backup_path = ?
            ''', (backup_path,))
            
            row = cursor.fetchone()
            conn.close()
            
            if row:
                return BackupInfo(
                    version=row[0],
                    backup_path=backup_path,
                    created_at=datetime.fromisoformat(row[1]),
                    size=row[2],
                    checksum=row[3],
                    description=row[4] or ""
                )
            
            return None
        
        except Exception as e:
            logger.error(f"Failed to get backup info: {e}")
            return None
    
    def _cleanup_old_backups(self):
        """Clean up old backups based on retention policy"""
        try:
            backups = self.get_available_backups()
            if len(backups) <= self.backup_retention:
                return
            
            # Sort by creation date and remove oldest
            backups.sort(key=lambda x: x.created_at, reverse=True)
            backups_to_remove = backups[self.backup_retention:]
            
            for backup in backups_to_remove:
                try:
                    Path(backup.backup_path).unlink()
                    
                    # Remove from database
                    conn = sqlite3.connect(self.db_path)
                    cursor = conn.cursor()
                    cursor.execute('DELETE FROM backup_registry WHERE backup_path = ?', 
                                 (backup.backup_path,))
                    conn.commit()
                    conn.close()
                    
                    logger.info(f"Removed old backup: {backup.backup_path}")
                
                except Exception as e:
                    logger.error(f"Failed to remove backup {backup.backup_path}: {e}")
        
        except Exception as e:
            logger.error(f"Failed to cleanup old backups: {e}")

# Update Server API (for testing)
class UpdateServer:
    """Simple update server for testing"""
    
    def __init__(self, port: int = 8080):
        self.port = port
        self.updates = {}
    
    def add_update(self, update_info: UpdateInfo):
        """Add an update to the server"""
        self.updates[update_info.version] = update_info
    
    def start(self):
        """Start the update server"""
        from flask import Flask, jsonify, request
        
        app = Flask(__name__)
        
        @app.route('/api/v1/check-update')
        def check_update():
            current_version = request.headers.get('X-Current-Version', '0.0.0')
            
            # Find latest compatible update
            latest_update = None
            for version, update_info in self.updates.items():
                if semver.compare(version, current_version) > 0:
                    if latest_update is None or semver.compare(version, latest_update.version) > 0:
                        latest_update = update_info
            
            if latest_update:
                return jsonify({
                    'update_available': True,
                    'latest_version': latest_update.version,
                    'update_info': asdict(latest_update)
                })
            else:
                return jsonify({
                    'update_available': False,
                    'latest_version': current_version
                })
        
        app.run(host='0.0.0.0', port=self.port)

# CLI Interface
def main():
    """Main CLI interface for update system"""
    import argparse
    
    parser = argparse.ArgumentParser(description='LocoDex Update System')
    parser.add_argument('--config', default='update_config.yaml', help='Configuration file')
    parser.add_argument('--check', action='store_true', help='Check for updates')
    parser.add_argument('--update', action='store_true', help='Perform update if available')
    parser.add_argument('--backup', action='store_true', help='Create backup')
    parser.add_argument('--rollback', help='Rollback to backup')
    parser.add_argument('--history', action='store_true', help='Show update history')
    parser.add_argument('--start-server', action='store_true', help='Start test update server')
    
    args = parser.parse_args()
    
    # Load configuration
    config = {}
    if Path(args.config).exists():
        with open(args.config, 'r') as f:
            config = yaml.safe_load(f)
    
    # Initialize update manager
    update_manager = UpdateManager(config)
    
    if args.check:
        print("Checking for updates...")
        update_info = update_manager.check_for_updates()
        if update_info:
            print(f"Update available: {update_info.version}")
            print(f"Release date: {update_info.release_date}")
            print(f"Size: {update_info.size} bytes")
            print(f"Critical: {update_info.critical}")
            print(f"Changelog: {update_info.changelog}")
        else:
            print("No updates available")
    
    elif args.update:
        print("Checking for updates...")
        update_info = update_manager.check_for_updates()
        if update_info:
            print(f"Updating to version {update_info.version}...")
            result = update_manager.perform_update(update_info)
            if result.success:
                print(f"Update successful: {result.message}")
            else:
                print(f"Update failed: {result.message}")
        else:
            print("No updates available")
    
    elif args.backup:
        print("Creating backup...")
        backup_info = update_manager.create_backup("Manual backup")
        if backup_info:
            print(f"Backup created: {backup_info.backup_path}")
        else:
            print("Backup failed")
    
    elif args.rollback:
        print(f"Rolling back to {args.rollback}...")
        result = update_manager.rollback_update(args.rollback)
        if result.success:
            print(f"Rollback successful: {result.message}")
        else:
            print(f"Rollback failed: {result.message}")
    
    elif args.history:
        print("Update history:")
        history = update_manager.get_update_history()
        for entry in history:
            status = "SUCCESS" if entry['success'] else "FAILED"
            print(f"{entry['update_date']}: {entry['previous_version']} -> {entry['version']} [{status}]")
    
    elif args.start_server:
        print("Starting test update server...")
        server = UpdateServer()
        
        # Add sample update
        sample_update = UpdateInfo(
            version="2.0.0",
            release_date=datetime.now(),
            download_url="http://localhost:8080/updates/locodex-2.0.0.zip",
            checksum="abc123",
            size=1024000,
            changelog="Sample update for testing"
        )
        server.add_update(sample_update)
        
        server.start()
    
    else:
        parser.print_help()

if __name__ == '__main__':
    main()

