#!/usr/bin/env python3
"""
Comprehensive Security Test Suite for LocoDex Sandbox
Tests all known sandbox escape techniques
"""

import sys
import os
import json
import time
from pathlib import Path

# Add sandbox directory to path
sys.path.append(str(Path(__file__).parent.parent / 'docker' / 'sandbox'))

from ultra_secure_validator import validate_code_ultra_secure, SecurityViolation
from network_security_validator import NetworkSecurityValidator

class SandboxSecurityTester:
    """Comprehensive security tester for the sandbox"""
    
    def __init__(self):
        self.test_results = []
        self.failed_tests = 0
        self.passed_tests = 0
    
    def run_all_tests(self):
        """Run all security tests"""
        print("🔐 LocoDex Sandbox Security Test Suite")
        print("=" * 50)
        
        # Test 1: AST-based validation tests
        print("\n1. Testing AST-based Code Validation...")
        self.test_ast_validation()
        
        # Test 2: Network isolation tests  
        print("\n2. Testing Network Security...")
        self.test_network_security()
        
        # Test 3: Known sandbox escape tests
        print("\n3. Testing Known Sandbox Escapes...")
        self.test_sandbox_escapes()
        
        # Test 4: Obfuscation detection tests
        print("\n4. Testing Obfuscation Detection...")
        self.test_obfuscation_detection()
        
        # Generate final report
        self.generate_final_report()
    
    def test_ast_validation(self):
        """Test AST-based validation"""
        dangerous_code_samples = [
            # Basic dangerous imports
            ("import os", "CRITICAL", "Should block os import"),
            ("import subprocess", "CRITICAL", "Should block subprocess import"),
            ("import sys", "CRITICAL", "Should block sys import"),
            
            # Dangerous builtin functions
            ("eval('print(1)')", "CRITICAL", "Should block eval calls"),
            ("exec('print(1)')", "CRITICAL", "Should block exec calls"),
            ("__import__('os')", "CRITICAL", "Should block __import__ calls"),
            
            # Attribute access bypasses
            ("getattr(__builtins__, 'eval')", "CRITICAL", "Should block dangerous getattr"),
            ("globals()['__builtins__']", "CRITICAL", "Should block globals access"),
            
            # Network-related code
            ("import socket", "CRITICAL", "Should block socket import"),
            ("import urllib", "CRITICAL", "Should block urllib import"),
            ("import requests", "CRITICAL", "Should block requests import"),
            
            # File system access
            ("open('/etc/passwd')", "CRITICAL", "Should block file access"),
            
            # Process control
            ("import multiprocessing", "CRITICAL", "Should block multiprocessing"),
            
            # Dunder method access
            ("x.__class__.__bases__", "CRITICAL", "Should block class hierarchy access"),
            ("[].__class__.__subclasses__()", "CRITICAL", "Should block subclass enumeration"),
            
            # Safe code that should pass
            ("x = 1 + 2", "SAFE", "Should allow basic math"),
            ("print('hello')", "SAFE", "Should allow safe printing"),
            ("import math", "SAFE", "Should allow math import"),
        ]
        
        for code, expected_level, description in dangerous_code_samples:
            try:
                violations = validate_code_ultra_secure(code, 'python')
                critical_violations = [v for v in violations if v.severity == 'CRITICAL']
                
                if expected_level == "CRITICAL" and len(critical_violations) > 0:
                    self.record_test_result(True, f"✅ {description}")
                elif expected_level == "SAFE" and len(critical_violations) == 0:
                    self.record_test_result(True, f"✅ {description}")
                else:
                    self.record_test_result(False, f"❌ {description} - Expected {expected_level}")
                    
            except Exception as e:
                if expected_level == "CRITICAL":
                    self.record_test_result(True, f"✅ {description} (Exception caught)")
                else:
                    self.record_test_result(False, f"❌ {description} - Unexpected exception: {e}")
    
    def test_network_security(self):
        """Test network security isolation"""
        try:
            validator = NetworkSecurityValidator("locodex-sandbox")
            results = validator.validate_network_isolation()
            
            if results['network_isolated']:
                self.record_test_result(True, "✅ Network isolation properly configured")
            else:
                self.record_test_result(False, "❌ Network isolation FAILED")
                for violation in results.get('violations', []):
                    print(f"   ⚠️  {violation}")
                    
        except Exception as e:
            self.record_test_result(False, f"❌ Network security test error: {e}")
    
    def test_sandbox_escapes(self):
        """Test known sandbox escape techniques"""
        escape_techniques = [
            # Python sandbox escapes
            ("().__class__.__bases__[0].__subclasses__()[104].__init__.__globals__['sys'].exit()", 
             "Classic Python sandbox escape via object introspection"),
            
            ("''.__class__.__mro__[-1].__subclasses__()[40]('/etc/passwd').read()", 
             "File access via class hierarchy"),
            
            ("[x for x in (1).__class__.__base__.__subclasses__() if x.__name__ == 'catch_warnings'][0]()._module.__builtins__['__import__']('os').system('ls')", 
             "Complex import bypass via warnings module"),
            
            ("__import__('sys').exit()", 
             "Direct import bypass"),
            
            ("getattr(__builtins__, 'eval')('__import__(\"os\").system(\"ls\")')", 
             "getattr bypass"),
            
            ("vars()['__builtins__']['eval']('print(1)')", 
             "vars() bypass"),
            
            ("dir()[0].__class__.__bases__[0].__subclasses__()", 
             "dir() introspection bypass"),
            
            # JavaScript sandbox escapes
            ("this.constructor.constructor('return process')()('ls')", 
             "JavaScript constructor bypass"),
            
            ("Function('return this')().process.exit()", 
             "JavaScript Function constructor bypass"),
            
            ("eval('this.process = require(\"child_process\")')", 
             "JavaScript eval bypass"),
        ]
        
        for code, description in escape_techniques:
            try:
                # Determine language
                language = 'javascript' if any(js_keyword in code for js_keyword in ['this.', 'Function(', 'require(']) else 'python'
                
                violations = validate_code_ultra_secure(code, language)
                critical_violations = [v for v in violations if v.severity == 'CRITICAL']
                
                if len(critical_violations) > 0:
                    self.record_test_result(True, f"✅ Blocked: {description}")
                else:
                    self.record_test_result(False, f"❌ ESCAPED: {description}")
                    
            except Exception as e:
                # Exception is good - means it was blocked
                self.record_test_result(True, f"✅ Blocked with exception: {description}")
    
    def test_obfuscation_detection(self):
        """Test obfuscation detection capabilities"""
        obfuscated_samples = [
            # String obfuscation
            ("exec(''.join(chr(x) for x in [105, 109, 112, 111, 114, 116, 32, 111, 115]))", 
             "String construction obfuscation"),
            
            ("eval('\\x69\\x6d\\x70\\x6f\\x72\\x74\\x20\\x6f\\x73')", 
             "Hex escape obfuscation"),
            
            ("exec(bytes([105, 109, 112, 111, 114, 116, 32, 111, 115]).decode())", 
             "Bytes decode obfuscation"),
            
            ("__import__(''.join(['o', 's']))", 
             "String join obfuscation"),
            
            # Base64 obfuscation
            ("import base64; exec(base64.b64decode('aW1wb3J0IG9z').decode())", 
             "Base64 obfuscation"),
            
            # Unicode obfuscation
            ("exec('\\u0069\\u006d\\u0070\\u006f\\u0072\\u0074\\u0020\\u006f\\u0073')", 
             "Unicode escape obfuscation"),
        ]
        
        for code, description in obfuscated_samples:
            try:
                violations = validate_code_ultra_secure(code, 'python')
                critical_violations = [v for v in violations if v.severity == 'CRITICAL']
                
                if len(critical_violations) > 0:
                    self.record_test_result(True, f"✅ Detected obfuscation: {description}")
                else:
                    self.record_test_result(False, f"❌ MISSED obfuscation: {description}")
                    
            except Exception as e:
                self.record_test_result(True, f"✅ Caught obfuscation: {description}")
    
    def record_test_result(self, passed: bool, message: str):
        """Record a test result"""
        self.test_results.append((passed, message))
        if passed:
            self.passed_tests += 1
        else:
            self.failed_tests += 1
        print(f"  {message}")
    
    def generate_final_report(self):
        """Generate final security test report"""
        total_tests = self.passed_tests + self.failed_tests
        pass_rate = (self.passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        print("\n" + "=" * 50)
        print("🔐 FINAL SECURITY TEST REPORT")
        print("=" * 50)
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {self.passed_tests}")
        print(f"Failed: {self.failed_tests}")
        print(f"Pass Rate: {pass_rate:.1f}%")
        
        if self.failed_tests == 0:
            print("\n🟢 SECURITY STATUS: SECURE ✅")
            print("All security tests passed! Sandbox is properly secured.")
        elif self.failed_tests <= 2:
            print("\n🟡 SECURITY STATUS: MOSTLY SECURE ⚠️")
            print("Minor security issues detected. Review and address.")
        else:
            print("\n🔴 SECURITY STATUS: VULNERABLE ❌")
            print("CRITICAL: Multiple security failures detected!")
            print("DO NOT DEPLOY until all issues are resolved!")
        
        # Show failed tests
        if self.failed_tests > 0:
            print("\n🚨 FAILED TESTS:")
            for passed, message in self.test_results:
                if not passed:
                    print(f"  {message}")
        
        print("\n" + "=" * 50)
        
        # Exit with appropriate code
        return 0 if self.failed_tests == 0 else 1

if __name__ == "__main__":
    tester = SandboxSecurityTester()
    exit_code = tester.run_all_tests()
    sys.exit(exit_code)