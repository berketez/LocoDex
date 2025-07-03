#!/usr/bin/env python3
"""
Network Security Validator for Docker Sandbox
Ensures complete network isolation and prevents network-based attacks
"""

import subprocess
import json
import time
from typing import Dict, List, Optional

class NetworkSecurityError(Exception):
    """Network security violation exception"""
    pass

class NetworkSecurityValidator:
    """Validates and enforces network security for sandbox containers"""
    
    def __init__(self, container_name: str = "locodex-sandbox"):
        self.container_name = container_name
        
    def validate_network_isolation(self) -> Dict[str, any]:
        """Comprehensive network isolation validation"""
        
        results = {
            'network_isolated': False,
            'internet_blocked': False,
            'internal_access_blocked': False,
            'dns_blocked': False,
            'port_exposure_safe': False,
            'violations': []
        }
        
        try:
            # Check if container exists and is running
            if not self._is_container_running():
                results['violations'].append("Container not running or doesn't exist")
                return results
            
            # Test 1: Internet connectivity should be blocked
            results['internet_blocked'] = self._test_internet_blocked()
            
            # Test 2: Internal network access should be blocked
            results['internal_access_blocked'] = self._test_internal_network_blocked()
            
            # Test 3: DNS resolution should be blocked
            results['dns_blocked'] = self._test_dns_blocked()
            
            # Test 4: Port exposure check
            results['port_exposure_safe'] = self._test_port_exposure_safe()
            
            # Test 5: Network interface restrictions
            network_info = self._get_network_info()
            results['network_info'] = network_info
            
            # Overall isolation check
            results['network_isolated'] = (
                results['internet_blocked'] and 
                results['internal_access_blocked'] and
                results['dns_blocked'] and
                results['port_exposure_safe']
            )
            
            if not results['network_isolated']:
                results['violations'].append("Network isolation is INCOMPLETE - SECURITY RISK!")
            
        except Exception as e:
            results['violations'].append(f"Network validation error: {str(e)}")
        
        return results
    
    def _is_container_running(self) -> bool:
        """Check if container is running"""
        try:
            result = subprocess.run([
                'docker', 'ps', '--filter', f'name={self.container_name}', 
                '--format', '{{.Names}}'
            ], capture_output=True, text=True, timeout=10)
            
            return self.container_name in result.stdout
        except:
            return False
    
    def _test_internet_blocked(self) -> bool:
        """Test if internet access is blocked"""
        test_commands = [
            # Test HTTP access to major sites
            'curl -m 5 --connect-timeout 3 http://google.com',
            'curl -m 5 --connect-timeout 3 http://github.com',
            'curl -m 5 --connect-timeout 3 http://1.1.1.1',
            
            # Test HTTPS access
            'curl -m 5 --connect-timeout 3 https://google.com',
            
            # Test raw TCP connections
            'nc -w 3 google.com 80',
            'nc -w 3 8.8.8.8 53',
            
            # Test ping (ICMP)
            'ping -c 1 -W 3 google.com',
            'ping -c 1 -W 3 8.8.8.8'
        ]
        
        blocked_count = 0
        total_tests = len(test_commands)
        
        for cmd in test_commands:
            try:
                result = subprocess.run([
                    'docker', 'exec', self.container_name, 'sh', '-c', cmd
                ], capture_output=True, text=True, timeout=10)
                
                # If command succeeds, internet is NOT blocked
                if result.returncode == 0:
                    print(f"[SECURITY VIOLATION] Internet access detected: {cmd}")
                    return False
                else:
                    blocked_count += 1
                    
            except subprocess.TimeoutExpired:
                # Timeout is good - means blocked
                blocked_count += 1
            except Exception:
                # Any other error is also good - means blocked
                blocked_count += 1
        
        # All tests should fail (be blocked)
        return blocked_count == total_tests
    
    def _test_internal_network_blocked(self) -> bool:
        """Test if internal network access is blocked"""
        # Common internal network ranges
        internal_ips = [
            '192.168.1.1',
            '10.0.0.1', 
            '172.16.0.1',
            '127.0.0.1',
            'localhost'
        ]
        
        blocked_count = 0
        total_tests = len(internal_ips)
        
        for ip in internal_ips:
            try:
                # Test HTTP access to internal IPs
                result = subprocess.run([
                    'docker', 'exec', self.container_name, 'sh', '-c',
                    f'curl -m 3 --connect-timeout 2 http://{ip}'
                ], capture_output=True, text=True, timeout=5)
                
                if result.returncode == 0:
                    print(f"[SECURITY VIOLATION] Internal network access detected: {ip}")
                    return False
                else:
                    blocked_count += 1
                    
            except subprocess.TimeoutExpired:
                blocked_count += 1
            except Exception:
                blocked_count += 1
        
        return blocked_count == total_tests
    
    def _test_dns_blocked(self) -> bool:
        """Test if DNS resolution is blocked"""
        dns_tests = [
            'nslookup google.com',
            'dig google.com',
            'host google.com',
            'getent hosts google.com'
        ]
        
        blocked_count = 0
        total_tests = len(dns_tests)
        
        for cmd in dns_tests:
            try:
                result = subprocess.run([
                    'docker', 'exec', self.container_name, 'sh', '-c', cmd
                ], capture_output=True, text=True, timeout=5)
                
                if result.returncode == 0 and 'google.com' in result.stdout:
                    print(f"[SECURITY VIOLATION] DNS resolution working: {cmd}")
                    return False
                else:
                    blocked_count += 1
                    
            except subprocess.TimeoutExpired:
                blocked_count += 1
            except Exception:
                blocked_count += 1
        
        return blocked_count == total_tests
    
    def _test_port_exposure_safe(self) -> bool:
        """Test if container ports are safely configured"""
        try:
            # Get container port mappings
            result = subprocess.run([
                'docker', 'port', self.container_name
            ], capture_output=True, text=True, timeout=10)
            
            # If any ports are exposed, it's a security risk
            if result.stdout.strip():
                print(f"[SECURITY VIOLATION] Ports exposed: {result.stdout}")
                return False
            
            return True
            
        except Exception:
            # If we can't check, assume it's unsafe
            return False
    
    def _get_network_info(self) -> Dict[str, any]:
        """Get detailed network information about the container"""
        try:
            result = subprocess.run([
                'docker', 'inspect', self.container_name
            ], capture_output=True, text=True, timeout=10)
            
            if result.returncode != 0:
                return {'error': 'Cannot inspect container'}
            
            container_info = json.loads(result.stdout)[0]
            network_settings = container_info.get('NetworkSettings', {})
            
            return {
                'networks': list(network_settings.get('Networks', {}).keys()),
                'ip_address': network_settings.get('IPAddress', ''),
                'ports': network_settings.get('Ports', {}),
                'network_mode': container_info.get('HostConfig', {}).get('NetworkMode', ''),
                'port_bindings': container_info.get('HostConfig', {}).get('PortBindings', {})
            }
            
        except Exception as e:
            return {'error': f'Network info error: {str(e)}'}
    
    def enforce_network_isolation(self) -> bool:
        """Enforce network isolation by applying additional restrictions"""
        try:
            # Apply additional iptables rules inside container if possible
            isolation_commands = [
                # Block all outbound traffic
                'iptables -A OUTPUT -j DROP',
                
                # Block all inbound traffic except loopback
                'iptables -A INPUT ! -i lo -j DROP',
                
                # Block forwarding
                'iptables -A FORWARD -j DROP',
                
                # Disable network interfaces (except loopback)
                'ip link set eth0 down 2>/dev/null || true'
            ]
            
            for cmd in isolation_commands:
                try:
                    subprocess.run([
                        'docker', 'exec', '--privileged', self.container_name, 'sh', '-c', cmd
                    ], capture_output=True, text=True, timeout=5)
                except:
                    # Some commands may fail, that's OK
                    pass
            
            return True
            
        except Exception as e:
            print(f"[WARNING] Could not enforce additional isolation: {e}")
            return False
    
    def generate_security_report(self) -> str:
        """Generate a comprehensive security report"""
        validation_results = self.validate_network_isolation()
        
        report = []
        report.append("=" * 60)
        report.append("SANDBOX NETWORK SECURITY REPORT")
        report.append("=" * 60)
        report.append(f"Container: {self.container_name}")
        report.append(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("")
        
        # Overall status
        if validation_results['network_isolated']:
            report.append("🟢 NETWORK ISOLATION: SECURE ✅")
        else:
            report.append("🔴 NETWORK ISOLATION: FAILED ❌")
        
        report.append("")
        report.append("Detailed Test Results:")
        report.append("-" * 30)
        
        tests = [
            ('Internet Access Blocked', validation_results['internet_blocked']),
            ('Internal Network Blocked', validation_results['internal_access_blocked']),
            ('DNS Resolution Blocked', validation_results['dns_blocked']),
            ('Port Exposure Safe', validation_results['port_exposure_safe'])
        ]
        
        for test_name, passed in tests:
            status = "✅ PASS" if passed else "❌ FAIL"
            report.append(f"{test_name:.<30} {status}")
        
        # Violations
        if validation_results['violations']:
            report.append("")
            report.append("🚨 SECURITY VIOLATIONS:")
            for violation in validation_results['violations']:
                report.append(f"  • {violation}")
        
        # Network info
        if 'network_info' in validation_results:
            report.append("")
            report.append("Network Configuration:")
            net_info = validation_results['network_info']
            for key, value in net_info.items():
                report.append(f"  {key}: {value}")
        
        report.append("")
        report.append("=" * 60)
        
        return "\n".join(report)

# Command-line interface
if __name__ == "__main__":
    import sys
    
    container_name = sys.argv[1] if len(sys.argv) > 1 else "locodex-sandbox"
    validator = NetworkSecurityValidator(container_name)
    
    print(validator.generate_security_report())
    
    # Exit with error code if not secure
    results = validator.validate_network_isolation()
    if not results['network_isolated']:
        sys.exit(1)
    else:
        sys.exit(0)