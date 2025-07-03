#!/usr/bin/env python3
"""
ULTRA-SECURE Sandbox Server with AST-based Validation
Completely rewritten for maximum security
"""

import json
import time
import asyncio
import hashlib
from dataclasses import dataclass, asdict
from typing import Dict, Any, Optional, List
from pathlib import Path

@dataclass
class ExecutionResult:
    """Result of code execution"""
    stdout: str
    stderr: str
    exit_code: int
    execution_time: float
    memory_usage: int
    cpu_usage: float

class SecurityError(Exception):
    """Custom exception for security violations"""
    pass

class SandboxSecurity:
    """ULTRA-SECURE sandbox execution manager - AST-based Defense"""
    
    @classmethod
    def validate_code(cls, code: str, language: str) -> bool:
        """ULTRA-SECURE AST-based code validation"""
        # Import the ultra-secure validator
        from ultra_secure_validator import validate_code_ultra_secure, SecurityViolation
        
        # Basic sanity checks first
        if not code or not code.strip():
            raise SecurityError("Empty code not allowed")
            
        if len(code) > 5000:
            raise SecurityError("Code too long - maximum 5KB allowed")
        
        # Run AST-based validation
        violations = validate_code_ultra_secure(code, language)
        
        # Check for any critical violations
        critical_violations = [v for v in violations if v.severity == 'CRITICAL']
        if critical_violations:
            violation_messages = []
            for v in critical_violations:
                violation_messages.append(f"Line {v.line}: {v.message}")
            
            raise SecurityError(
                f"CRITICAL SECURITY VIOLATIONS DETECTED:\n" + 
                "\n".join(violation_messages)
            )
        
        # Check for high-severity violations
        high_violations = [v for v in violations if v.severity == 'HIGH']
        if high_violations:
            violation_messages = []
            for v in high_violations:
                violation_messages.append(f"Line {v.line}: {v.message}")
            
            raise SecurityError(
                f"HIGH SECURITY VIOLATIONS DETECTED:\n" + 
                "\n".join(violation_messages)
            )
        
        # Log medium violations but allow execution
        medium_violations = [v for v in violations if v.severity == 'MEDIUM']
        if medium_violations:
            print(f"[SECURITY WARNING] Medium security violations detected:")
            for v in medium_violations:
                print(f"  Line {v.line}: {v.message}")
        
        return True

class CodeExecutor:
    """Secure code executor with resource limits"""
    
    def __init__(self):
        self.workspace_dir = Path('/home/sandbox/workspace')
        self.max_execution_time = 30
        self.max_memory_mb = 128
        
    def execute_secure(self, code: str, language: str) -> ExecutionResult:
        """Execute code with ultra-secure validation"""
        
        # SECURITY LAYER 1: Ultra-secure validation
        try:
            SandboxSecurity.validate_code(code, language)
        except SecurityError as e:
            raise SecurityError(f"SECURITY BLOCK: {e}")
        
        # SECURITY LAYER 2: Execute in restricted environment
        return self._execute_with_restrictions(code, language)
    
    def _execute_with_restrictions(self, code: str, language: str) -> ExecutionResult:
        """Execute code with maximum restrictions"""
        
        start_time = time.time()
        
        try:
            # Create temporary file in workspace
            temp_file = self._create_temp_file(code, language)
            
            # Prepare execution command
            exec_cmd = self._get_execution_command(temp_file, language)
            
            # Execute with timeout
            result = self._run_subprocess_secure(exec_cmd, self.max_execution_time)
            
            execution_time = time.time() - start_time
            
            return ExecutionResult(
                stdout=result['stdout'],
                stderr=result['stderr'],
                exit_code=result['returncode'],
                execution_time=execution_time,
                memory_usage=0,  # TODO: implement memory tracking
                cpu_usage=0.0   # TODO: implement CPU tracking
            )
            
        finally:
            # Clean up
            if 'temp_file' in locals() and temp_file.exists():
                temp_file.unlink()
    
    def _create_temp_file(self, code: str, language: str) -> Path:
        """Create temporary file for code execution"""
        import tempfile
        
        extensions = {
            'python': '.py',
            'javascript': '.js',
            'bash': '.sh'
        }
        
        ext = extensions.get(language, '.txt')
        
        # Create file with restricted permissions
        fd, temp_path = tempfile.mkstemp(
            suffix=ext,
            dir=str(self.workspace_dir),
            prefix='exec_'
        )
        
        # Write code to file
        with open(temp_path, 'w') as f:
            f.write(code)
        
        temp_file = Path(temp_path)
        
        # Set restrictive permissions
        temp_file.chmod(0o600)
        
        return temp_file
    
    def _get_execution_command(self, file_path: Path, language: str) -> list:
        """Get execution command for language"""
        commands = {
            'python': ['/usr/bin/python3', '-B', '-s', '-S', str(file_path)],
            'javascript': ['/usr/bin/node', '--no-deprecation', '--disable-proto=delete', str(file_path)],
            'bash': ['/bin/bash', '-r', str(file_path)]  # Restricted bash
        }
        
        cmd = commands.get(language)
        if not cmd:
            raise ValueError(f"Unsupported language: {language}")
        
        return cmd
    
    def _run_subprocess_secure(self, cmd: list, timeout: int) -> dict:
        """Run subprocess with maximum security"""
        import subprocess
        import signal
        import os
        
        # Ultra-restricted environment
        env = {
            'PATH': '/usr/bin:/bin',
            'PYTHONDONTWRITEBYTECODE': '1',
            'PYTHONPATH': '',
            'HOME': '/home/sandbox',
            'USER': 'sandbox',
            'SHELL': '/bin/false',  # No shell access
            'TERM': 'dumb',
        }
        
        try:
            # Execute with strict limits
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                stdin=subprocess.DEVNULL,  # No input
                env=env,
                cwd=str(self.workspace_dir),
                preexec_fn=self._setup_subprocess_security,
                start_new_session=True  # Process isolation
            )
            
            # Wait with timeout
            try:
                stdout, stderr = process.communicate(timeout=min(timeout, self.max_execution_time))
                
                return {
                    'stdout': stdout.decode('utf-8', errors='replace')[:10000],  # Limit output
                    'stderr': stderr.decode('utf-8', errors='replace')[:10000],  # Limit errors
                    'returncode': process.returncode
                }
                
            except subprocess.TimeoutExpired:
                # Kill process group
                try:
                    os.killpg(os.getpgid(process.pid), signal.SIGKILL)
                except:
                    pass
                
                process.kill()
                process.wait()
                
                return {
                    'stdout': '',
                    'stderr': 'EXECUTION TIMEOUT: Process killed after timeout',
                    'returncode': -9
                }
                
        except Exception as e:
            return {
                'stdout': '',
                'stderr': f'EXECUTION ERROR: {str(e)}',
                'returncode': -1
            }
    
    def _setup_subprocess_security(self):
        """Setup ultra-restricted subprocess environment"""
        import resource
        import os
        
        try:
            # Memory limit (128MB)
            memory_limit = self.max_memory_mb * 1024 * 1024
            resource.setrlimit(resource.RLIMIT_AS, (memory_limit, memory_limit))
            
            # CPU time limit
            resource.setrlimit(resource.RLIMIT_CPU, (self.max_execution_time, self.max_execution_time))
            
            # File size limit (1MB)
            resource.setrlimit(resource.RLIMIT_FSIZE, (1024*1024, 1024*1024))
            
            # Number of processes (1 only)
            resource.setrlimit(resource.RLIMIT_NPROC, (1, 1))
            
            # No core dumps
            resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
            
            # Set process group
            os.setpgrp()
            
        except Exception as e:
            print(f"[SECURITY] Resource limit setup error: {e}")

# Main server class for handling execution requests
class SandboxServer:
    """Main sandbox server"""
    
    def __init__(self):
        self.executor = CodeExecutor()
        
    async def handle_execution_request(self, request_data: dict) -> dict:
        """Handle code execution request"""
        
        try:
            code = request_data.get('code', '')
            language = request_data.get('language', 'python')
            
            if not code:
                raise ValueError("No code provided")
            
            if language not in ['python', 'javascript']:
                raise ValueError(f"Unsupported language: {language}")
            
            # Execute code securely
            result = self.executor.execute_secure(code, language)
            
            return {
                'success': True,
                'result': asdict(result)
            }
            
        except SecurityError as e:
            return {
                'success': False,
                'error': 'SECURITY_VIOLATION',
                'message': str(e)
            }
        except Exception as e:
            return {
                'success': False,
                'error': 'EXECUTION_ERROR',
                'message': str(e)
            }

# Entry point for testing
if __name__ == "__main__":
    # Test the ultra-secure validator
    test_code = """
import os
print("Hello World")
"""
    
    try:
        SandboxSecurity.validate_code(test_code, 'python')
        print("Code passed validation")
    except SecurityError as e:
        print(f"Security violation: {e}")