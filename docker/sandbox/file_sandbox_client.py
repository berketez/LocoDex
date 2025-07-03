#!/usr/bin/env python3
"""
File-based Sandbox Client
Communicates with isolated sandbox via file system
"""

import os
import json
import time
import uuid
from pathlib import Path
from typing import Dict, Any, Optional
import asyncio

class FileSandboxClient:
    """Client for communicating with isolated sandbox via files"""
    
    def __init__(self, command_dir: str = '/app/commands', result_dir: str = '/app/results'):
        self.command_dir = Path(command_dir)
        self.result_dir = Path(result_dir)
        self.timeout_default = 30
        
        # Create directories if they don't exist
        self.command_dir.mkdir(exist_ok=True, mode=0o755)
        self.result_dir.mkdir(exist_ok=True, mode=0o755)
    
    async def execute_code(self, code: str, language: str = 'python', timeout: int = None) -> Dict[str, Any]:
        """Execute code in isolated sandbox"""
        
        if timeout is None:
            timeout = self.timeout_default
        
        # Generate unique command ID
        command_id = str(uuid.uuid4())
        
        # Create command
        command = {
            'id': command_id,
            'code': code,
            'language': language,
            'timeout': min(timeout, 60),  # Max 60 seconds
            'timestamp': time.time()
        }
        
        # Write command file
        command_file = self.command_dir / f"{command_id}.json"
        
        try:
            with open(command_file, 'w') as f:
                json.dump(command, f, indent=2)
            
            # Set permissions
            command_file.chmod(0o644)
            
            print(f"[SANDBOX CLIENT] Command sent: {command_id}")
            
            # Wait for result
            result = await self.wait_for_result(command_id, timeout + 5)  # +5 for processing overhead
            
            return result
            
        except Exception as e:
            # Clean up command file
            try:
                command_file.unlink()
            except:
                pass
            
            raise RuntimeError(f"Sandbox execution failed: {e}")
    
    async def wait_for_result(self, command_id: str, max_wait: int) -> Dict[str, Any]:
        """Wait for execution result"""
        result_file = self.result_dir / f"{command_id}.json"
        
        start_time = time.time()
        
        while time.time() - start_time < max_wait:
            if result_file.exists():
                try:
                    with open(result_file, 'r') as f:
                        result = json.load(f)
                    
                    # Clean up result file
                    try:
                        result_file.unlink()
                    except:
                        pass
                    
                    print(f"[SANDBOX CLIENT] Result received: {command_id}")
                    return result
                    
                except Exception as e:
                    print(f"[SANDBOX CLIENT] Result read error: {e}")
                    break
            
            # Sleep briefly
            await asyncio.sleep(0.1)
        
        # Timeout
        raise TimeoutError(f"Sandbox execution timeout after {max_wait} seconds")
    
    def check_sandbox_health(self) -> bool:
        """Check if sandbox is responsive"""
        try:
            # Try to execute simple code
            test_command_id = str(uuid.uuid4())
            command = {
                'id': test_command_id,
                'code': 'print("health_check")',
                'language': 'python',
                'timeout': 5,
                'timestamp': time.time()
            }
            
            command_file = self.command_dir / f"{test_command_id}.json"
            
            with open(command_file, 'w') as f:
                json.dump(command, f)
            
            # Wait briefly for result
            result_file = self.result_dir / f"{test_command_id}.json"
            
            for _ in range(50):  # 5 seconds total
                if result_file.exists():
                    try:
                        with open(result_file, 'r') as f:
                            result = json.load(f)
                        
                        # Clean up
                        try:
                            result_file.unlink()
                        except:
                            pass
                        
                        return result.get('stdout', '').strip() == 'health_check'
                        
                    except:
                        break
                
                time.sleep(0.1)
            
            # Clean up command file
            try:
                command_file.unlink()
            except:
                pass
            
            return False
            
        except Exception as e:
            print(f"[SANDBOX CLIENT] Health check error: {e}")
            return False

# Global client instance
sandbox_client = FileSandboxClient()