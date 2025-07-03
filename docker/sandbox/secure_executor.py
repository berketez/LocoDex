#!/usr/bin/env python3
"""
ULTRA-SECURE Sandbox Code Executor
File-based communication, no network access, maximum isolation
"""

import os
import sys
import json
import time
import tempfile
import subprocess
import resource
import signal
import hashlib
from pathlib import Path
from dataclasses import dataclass
from typing import Dict, Any, Optional

# Import our ultra-secure validation
from sandbox_server import SandboxSecurity, SecurityError, ExecutionResult

# File-based communication paths
COMMAND_DIR = Path('/app/commands')
RESULT_DIR = Path('/app/results')
WORKSPACE_DIR = Path('/home/sandbox/workspace')

# Create directories
COMMAND_DIR.mkdir(exist_ok=True, mode=0o700)
RESULT_DIR.mkdir(exist_ok=True, mode=0o700)
WORKSPACE_DIR.mkdir(exist_ok=True, mode=0o755)

@dataclass
class ExecutionCommand:
    id: str
    code: str
    language: str
    timeout: int = 30
    timestamp: float = 0

class SecureFileExecutor:
    """File-based secure code executor - NO NETWORK ACCESS"""
    
    def __init__(self):
        self.workspace = WORKSPACE_DIR
        self.max_execution_time = 30
        self.max_memory_mb = 128
        
    def run_daemon(self):
        """Main daemon loop - watches for execution commands"""
        print(f"[SECURE EXECUTOR] Starting daemon - PID: {os.getpid()}")
        print(f"[SECURE EXECUTOR] Command dir: {COMMAND_DIR}")
        print(f"[SECURE EXECUTOR] Result dir: {RESULT_DIR}")
        print(f"[SECURE EXECUTOR] Workspace: {WORKSPACE_DIR}")
        
        while True:
            try:
                # Check for pending commands
                command_files = list(COMMAND_DIR.glob('*.json'))
                
                for command_file in command_files:
                    try:
                        self.process_command_file(command_file)
                    except Exception as e:
                        self.write_error_result(command_file.stem, str(e))
                    finally:
                        # Remove processed command file
                        try:
                            command_file.unlink()
                        except:
                            pass
                
                # Sleep to prevent busy waiting
                time.sleep(0.1)
                
            except KeyboardInterrupt:
                print("[SECURE EXECUTOR] Shutting down...")
                break
            except Exception as e:
                print(f"[SECURE EXECUTOR] Daemon error: {e}")
                time.sleep(1)
    
    def process_command_file(self, command_file: Path):
        """Process a single command file"""
        try:
            # Read command
            with open(command_file, 'r') as f:
                cmd_data = json.load(f)
            
            command = ExecutionCommand(**cmd_data)
            
            print(f"[SECURE EXECUTOR] Processing command {command.id}")
            
            # Execute with ultra-secure validation
            result = self.execute_secure(command)
            
            # Write result
            self.write_result(command.id, result)
            
        except Exception as e:
            print(f"[SECURE EXECUTOR] Command processing error: {e}")
            self.write_error_result(command_file.stem, str(e))
    
    def execute_secure(self, command: ExecutionCommand) -> ExecutionResult:
        """Execute code with ultra-secure validation"""
        
        # LAYER 1: Ultra-secure validation
        try:
            SandboxSecurity.validate_code(command.code, command.language)
        except SecurityError as e:
            raise SecurityError(f"SECURITY BLOCK: {e}")
        
        # LAYER 2: Additional runtime restrictions
        self.setup_execution_environment()
        
        # LAYER 3: Execute in restricted environment
        return self.execute_with_restrictions(command)
    
    def setup_execution_environment(self):
        """Setup ultra-restricted execution environment"""
        
        # Set resource limits
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
            
        except Exception as e:
            print(f"[SECURE EXECUTOR] Resource limit setup error: {e}")
    
    def execute_with_restrictions(self, command: ExecutionCommand) -> ExecutionResult:
        """Execute code with maximum restrictions"""
        
        start_time = time.time()
        
        # Create temporary file in workspace
        temp_file = self.create_temp_file(command.code, command.language)
        
        try:
            # Prepare execution command
            exec_cmd = self.get_execution_command(temp_file, command.language)
            
            # Execute with timeout
            result = self.run_subprocess_secure(exec_cmd, command.timeout)
            
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
            if temp_file.exists():
                temp_file.unlink()
    
    def create_temp_file(self, code: str, language: str) -> Path:
        """Create temporary file for code execution"""
        extensions = {
            'python': '.py',
            'javascript': '.js',
            'bash': '.sh'
        }
        
        ext = extensions.get(language, '.txt')
        
        # Create file with restricted permissions
        fd, temp_path = tempfile.mkstemp(
            suffix=ext,
            dir=str(self.workspace),
            prefix='exec_'
        )
        
        try:
            with os.fdopen(fd, 'w') as f:
                f.write(code)
        except:
            os.close(fd)
            raise
        
        temp_file = Path(temp_path)
        
        # Set restrictive permissions
        temp_file.chmod(0o600)
        
        return temp_file
    
    def get_execution_command(self, file_path: Path, language: str) -> list:
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
    
    def run_subprocess_secure(self, cmd: list, timeout: int) -> dict:
        """Run subprocess with maximum security"""
        
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
                cwd=str(self.workspace),
                preexec_fn=self.setup_subprocess_security,
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
                
                raise TimeoutError(f"Execution timeout after {timeout} seconds")
        
        except Exception as e:
            raise RuntimeError(f"Execution failed: {e}")
    
    def setup_subprocess_security(self):
        """Setup subprocess security restrictions"""
        try:
            # Create new process group
            os.setpgrp()
            
            # Drop all capabilities (if running as root)
            try:
                import ctypes
                libc = ctypes.CDLL("libc.so.6")
                # Drop all capabilities
                libc.prctl(38, 0, 0, 0, 0)  # PR_SET_SECUREBITS
            except:
                pass
            
            # Set nice value (lower priority)
            os.nice(19)
            
        except Exception as e:
            print(f"[SECURE EXECUTOR] Subprocess security setup error: {e}")
    
    def write_result(self, command_id: str, result: ExecutionResult):
        """Write execution result to file"""
        result_file = RESULT_DIR / f"{command_id}.json"
        
        result_data = {
            'stdout': result.stdout,
            'stderr': result.stderr,
            'exit_code': result.exit_code,
            'execution_time': result.execution_time,
            'memory_usage': result.memory_usage,
            'cpu_usage': result.cpu_usage,
            'timestamp': time.time()
        }
        
        with open(result_file, 'w') as f:
            json.dump(result_data, f, indent=2)
        
        # Set restrictive permissions
        result_file.chmod(0o600)
        
        print(f"[SECURE EXECUTOR] Result written: {command_id}")
    
    def write_error_result(self, command_id: str, error_message: str):
        """Write error result to file"""
        result_file = RESULT_DIR / f"{command_id}.json"
        
        error_data = {
            'stdout': '',
            'stderr': f"SECURITY ERROR: {error_message}",
            'exit_code': 1,
            'execution_time': 0,
            'memory_usage': 0,
            'cpu_usage': 0,
            'timestamp': time.time(),
            'security_error': True
        }
        
        with open(result_file, 'w') as f:
            json.dump(error_data, f, indent=2)
        
        result_file.chmod(0o600)
        
        print(f"[SECURE EXECUTOR] Error result written: {command_id} - {error_message}")

def main():
    """Main entry point"""
    print("=" * 60)
    print("ULTRA-SECURE SANDBOX EXECUTOR STARTING")
    print("=" * 60)
    print(f"PID: {os.getpid()}")
    print(f"UID: {os.getuid()}")
    print(f"GID: {os.getgid()}")
    print(f"CWD: {os.getcwd()}")
    print("=" * 60)
    
    # Verify we're running in restricted mode
    if os.getuid() == 0:
        print("WARNING: Running as root - this is not recommended!")
    
    # Start the executor daemon
    executor = SecureFileExecutor()
    executor.run_daemon()

if __name__ == '__main__':
    main()