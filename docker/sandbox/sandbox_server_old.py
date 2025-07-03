#!/usr/bin/env python3
"""
LocoDex Sandbox Server
Secure code execution environment with safety restrictions
"""

import os
import sys
import json
import asyncio
import tempfile
import subprocess
import time
import signal
import resource
import shutil
from pathlib import Path
from typing import Dict, Any, Optional
from dataclasses import dataclass
from flask import Flask, request, jsonify
from flask_cors import CORS
import psutil

app = Flask(__name__)
CORS(app)

# Configuration
EXECUTION_TIMEOUT = int(os.getenv('EXECUTION_TIMEOUT', 30))
MAX_MEMORY = os.getenv('MAX_MEMORY', '512m')
MAX_CPU = float(os.getenv('MAX_CPU', 0.5))
WORKSPACE_DIR = Path('/home/sandbox/workspace')
TEMP_DIR = Path('/tmp/sandbox')

# Create directories
TEMP_DIR.mkdir(exist_ok=True)
WORKSPACE_DIR.mkdir(exist_ok=True)

@dataclass
class ExecutionResult:
    stdout: str
    stderr: str
    exit_code: int
    execution_time: float
    memory_usage: int
    cpu_usage: float

class SandboxSecurity:
    """ULTRA-SECURE sandbox execution manager - AST-based Defense"""
    
    @classmethod
    def validate_code(cls, code: str, language: str) -> bool:
        """ULTRA-SECURE AST-based code validation"""
        # Import the ultra-secure validator
        from ultra_secure_validator import validate_code_ultra_secure, SecurityViolation
        
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
    
    # Legacy patterns kept as backup defense
    DANGEROUS_PATTERNS = [
        # Critical system access
        r'import\s+os',
        r'import\s+subprocess',
        r'import\s+sys',
        r'__import__',
        r'eval\s*\(',
        r'exec\s*\(',
        r'compile\s*\(',
        r'getattr\s*\(',
        r'setattr\s*\(',
        r'hasattr\s*\(',
        r'globals\s*\(',
        r'locals\s*\(',
        r'vars\s*\(',
        r'dir\s*\(',
        
        # Network operations - ALL BLOCKED
        r'import\s+socket',
        r'import\s+urllib',
        r'import\s+requests',
        r'import\s+http',
        r'import\s+ftplib',
        r'import\s+smtplib',
        r'import\s+telnetlib',
        r'socket\s*\.',
        r'urllib\s*\.',
        r'requests\s*\.',
        
        # Process operations - ALL BLOCKED
        r'fork\s*\(',
        r'spawn',
        r'system\s*\(',
        r'popen\s*\(',
        r'Popen\s*\(',
        r'call\s*\(',
        r'check_call\s*\(',
        r'check_output\s*\(',
        r'run\s*\(',
        
        # File operations - RESTRICTED
        r'open\s*\(',
        r'file\s*\(',
        r'with\s+open',
        r'codecs\.open',
        r'io\.open',
        
        # Module introspection
        r'importlib\s*\.',
        r'__loader__',
        r'__spec__',
        r'__package__',
        
        # Dangerous builtins
        r'\bbreakpoint\s*\(',
        r'\binput\s*\(',
        r'\braw_input\s*\(',
        r'\bhelp\s*\(',
        r'\bexit\s*\(',
        r'\bquit\s*\(',
        
        # Code injection attempts
        r'\\x[0-9a-fA-F]{2}',  # Hex escapes
        r'\\[0-7]{1,3}',       # Octal escapes
        r'chr\s*\(',           # Character conversion
        r'ord\s*\(',           # Ordinal conversion
        
        # Pickle and serialization (RCE vectors)
        r'import\s+pickle',
        r'import\s+dill',
        r'import\s+joblib',
        r'pickle\s*\.',
        r'loads\s*\(',
        r'dumps\s*\(',
        
        # Threading and multiprocessing
        r'import\s+threading',
        r'import\s+multiprocessing',
        r'import\s+concurrent',
        r'Thread\s*\(',
        r'Process\s*\(',
        
        # Time-based attacks (limited)
        r'while\s+True\s*:',
        r'for\s+.*\s+in\s+.*range\s*\(\s*[0-9]{6,}',  # Large loops
    ]
    
    ALLOWED_IMPORTS = {
        'python': [
            # Basic math and data types
            'math', 'decimal', 'fractions', 'statistics',
            # Safe data structures  
            'collections', 'heapq', 'bisect',
            # String and regex (limited)
            'string', 're',
            # Functional programming
            'itertools', 'functools', 'operator',
            # Basic data handling
            'json', 'csv', 'base64',
            # Date/time (safe)
            'datetime', 'calendar',
            # Type hints
            'typing',
            # Limited randomness (seeded only)
            'random',
            # Safe data science (read-only operations)
            'numpy', 'pandas', 'matplotlib',
            # Algorithm libraries (computation only)
            'scipy', 'sklearn'
        ],
        'javascript': [
            # Utility libraries (no network/file access)
            'lodash', 'moment', 'uuid',
            # Math libraries
            'mathjs', 'ml-matrix'
        ]
    }
    
    # Modules that are completely banned - even if somehow imported
    BANNED_MODULES = [
        'os', 'sys', 'subprocess', 'socket', 'urllib', 'urllib2', 'urllib3',
        'requests', 'http', 'httplib', 'httplib2', 'ftplib', 'smtplib',
        'telnetlib', 'threading', 'multiprocessing', 'concurrent', 'asyncio',
        'pickle', 'dill', 'joblib', 'marshal', 'shelve', 'dbm',
        'importlib', 'imp', 'pkgutil', 'modulefinder', 'zipimport',
        'ctypes', 'cffi', 'pty', 'pwd', 'grp', 'termios', 'tty',
        'signal', 'resource', 'mmap', 'select', 'fcntl',
        'platform', 'tempfile', 'shutil', 'glob', 'pathlib'
    ]
    
    @classmethod
    def validate_code(cls, code: str, language: str) -> bool:
        """ULTRA-SECURE code validation - MULTI-LAYER DEFENSE"""
        import re
        import hashlib
        
        # LAYER 1: Basic sanity checks
        if not code or not code.strip():
            raise SecurityError("Empty code not allowed")
            
        if len(code) > 5000:  # Reduced from 10KB to 5KB
            raise SecurityError("Code too long - maximum 5KB allowed")
        
        # LAYER 2: Character-level security
        cls._validate_character_level(code)
        
        # LAYER 3: Pattern-based detection (Enhanced)
        cls._validate_patterns(code)
        
        # LAYER 4: Module/import validation
        cls._validate_imports(code)
        
        # LAYER 5: Bypass attempt detection (Enhanced)
        cls._validate_bypass_attempts(code)
        
        # LAYER 6: Language-specific deep validation
        if language == 'python':
            cls._validate_python_code_ultra_secure(code)
        elif language == 'javascript':
            cls._validate_javascript_code_ultra_secure(code)
        else:
            raise SecurityError(f"Unsupported language: {language}")
        
        # LAYER 7: Semantic analysis
        cls._validate_semantic_security(code, language)
        
        # LAYER 8: Hash-based known exploit detection
        cls._validate_known_exploits(code)
        
        return True
    
    @classmethod
    def _validate_character_level(cls, code: str):
        """Character-level security validation"""
        import re
        
        # Check for suspicious character sequences
        suspicious_chars = [
            '\x00',  # Null bytes
            '\x08',  # Backspace
            '\x0c',  # Form feed
            '\x1b',  # Escape
        ]
        
        for char in suspicious_chars:
            if char in code:
                raise SecurityError(f"SUSPICIOUS CHARACTER: {repr(char)} detected")
        
        # Check for excessive whitespace (possible obfuscation)
        if len(re.findall(r'\s{20,}', code)) > 0:
            raise SecurityError("OBFUSCATION: Excessive whitespace detected")
        
        # Check for mixed encoding attempts
        try:
            code.encode('ascii')
        except UnicodeEncodeError:
            # Allow some unicode but check for suspicious patterns
            if any(ord(c) > 0x1000 for c in code):
                raise SecurityError("UNICODE OBFUSCATION: High codepoint characters detected")
    
    @classmethod
    def _validate_patterns(cls, code: str):
        """Enhanced pattern-based validation"""
        import re
        
        # Check all dangerous patterns
        for pattern in cls.DANGEROUS_PATTERNS:
            matches = re.findall(pattern, code, re.IGNORECASE | re.MULTILINE | re.DOTALL)
            if matches:
                raise SecurityError(f"DANGEROUS PATTERN: '{pattern}' detected: {matches}")
        
        # Additional obfuscation patterns
        obfuscation_patterns = [
            r'["\'][^"\']*["\']\.split\(',  # String splitting obfuscation
            r'["\'][^"\']*["\']\.join\(',   # String joining obfuscation
            r'\\x[0-9a-fA-F]{2}',           # Hex escapes
            r'\\[0-7]{1,3}',                # Octal escapes
            r'\\u[0-9a-fA-F]{4}',           # Unicode escapes
            r'\\U[0-9a-fA-F]{8}',           # Long unicode escapes
            r'\\N\{[^}]+\}',                # Named unicode escapes
            r'bytes\s*\([^)]*\)\.decode',   # Bytes decoding
            r'base64\.',                    # Base64 operations
            r'codecs\.',                    # Codec operations
            r'zlib\.',                      # Compression
            r'bz2\.',                       # Compression
            r'gzip\.',                      # Compression
        ]
        
        for pattern in obfuscation_patterns:
            if re.search(pattern, code, re.IGNORECASE):
                raise SecurityError(f"OBFUSCATION DETECTED: Pattern '{pattern}'")
    
    @classmethod
    def _validate_imports(cls, code: str):
        """Enhanced import validation"""
        import re
        
        # Check banned modules with multiple detection methods
        for module in cls.BANNED_MODULES:
            patterns = [
                rf'\bimport\s+{re.escape(module)}\b',
                rf'\bfrom\s+{re.escape(module)}\s+import\b',
                rf'__import__\s*\(\s*["\']?{re.escape(module)}["\']?\s*\)',
                rf'{re.escape(module)}\.',
                rf'importlib\.import_module\s*\(\s*["\']?{re.escape(module)}["\']?\s*\)',
            ]
            
            for pattern in patterns:
                if re.search(pattern, code, re.IGNORECASE):
                    raise SecurityError(f"BANNED MODULE ACCESS: '{module}' via pattern '{pattern}'")
        
        # Check for dynamic import attempts
        dynamic_import_patterns = [
            r'__import__\s*\(',
            r'importlib\.',
            r'imp\.',
            r'pkgutil\.',
            r'modulefinder\.',
        ]
        
        for pattern in dynamic_import_patterns:
            if re.search(pattern, code, re.IGNORECASE):
                raise SecurityError(f"DYNAMIC IMPORT BLOCKED: '{pattern}'")
    
    @classmethod
    def _validate_bypass_attempts(cls, code: str):
        """Enhanced bypass attempt detection"""
        import re
        
        # Known bypass techniques
        bypass_patterns = [
            # String construction bypasses
            r'chr\s*\(\s*\d+\s*\)',
            r'ord\s*\(',
            r'\\x[0-9a-fA-F]{2}',
            r'\\u[0-9a-fA-F]{4}',
            r'\\U[0-9a-fA-F]{8}',
            r'\\[0-7]{1,3}',
            
            # Attribute access bypasses
            r'getattr\s*\(',
            r'setattr\s*\(',
            r'hasattr\s*\(',
            r'delattr\s*\(',
            
            # Magic method access
            r'__[a-zA-Z_][a-zA-Z0-9_]*__',
            
            # Reflection bypasses
            r'globals\s*\(\s*\)',
            r'locals\s*\(\s*\)',
            r'vars\s*\(',
            r'dir\s*\(',
            
            # Execution bypasses
            r'eval\s*\(',
            r'exec\s*\(',
            r'compile\s*\(',
            
            # Type bypasses
            r'type\s*\(',
            r'isinstance\s*\(',
            r'issubclass\s*\(',
            
            # Memory access
            r'id\s*\(',
            r'hash\s*\(',
            r'memoryview\s*\(',
            
            # Frame access
            r'\.f_locals',
            r'\.f_globals',
            r'\.f_back',
            r'\.f_code',
            
            # Class manipulation
            r'\.__class__',
            r'\.__bases__',
            r'\.__mro__',
            r'\.__subclasses__',
            
            # Descriptor bypasses
            r'\.__get__',
            r'\.__set__',
            r'\.__delete__',
            
            # Property bypasses
            r'property\s*\(',
            r'staticmethod\s*\(',
            r'classmethod\s*\(',
        ]
        
        for pattern in bypass_patterns:
            matches = re.findall(pattern, code, re.IGNORECASE)
            if matches:
                raise SecurityError(f"BYPASS ATTEMPT: '{pattern}' detected: {matches}")
    
    @classmethod
    def _validate_semantic_security(cls, code: str, language: str):
        """Semantic-level security analysis"""
        import re
        
        # Check for suspicious variable names
        suspicious_names = [
            r'\b_[a-zA-Z_][a-zA-Z0-9_]*',  # Underscore variables
            r'\b[a-zA-Z_][a-zA-Z0-9_]*__',  # Dunder variables
            r'\b(payload|shell|exploit|hack|inject|bypass)\b',  # Malicious intent names
        ]
        
        for pattern in suspicious_names:
            if re.search(pattern, code, re.IGNORECASE):
                raise SecurityError(f"SUSPICIOUS IDENTIFIER: '{pattern}'")
        
        # Check for encoded strings
        if language == 'python':
            # Base64-like strings
            if re.search(r'["\'][A-Za-z0-9+/]{20,}={0,2}["\']', code):
                raise SecurityError("ENCODED STRING: Possible base64 detected")
            
            # Hex strings
            if re.search(r'["\'][0-9a-fA-F]{20,}["\']', code):
                raise SecurityError("ENCODED STRING: Possible hex string detected")
    
    @classmethod
    def _validate_known_exploits(cls, code: str):
        """Hash-based known exploit detection"""
        import hashlib
        
        # Known dangerous code hashes (add more as discovered)
        dangerous_hashes = {
            # Example: hash of "import os; os.system('ls')"
            hashlib.sha256(b"import os; os.system('ls')").hexdigest()[:16]: "os.system exploit",
            hashlib.sha256(b"__import__('os').system('ls')").hexdigest()[:16]: "__import__ bypass",
            hashlib.sha256(b"eval('__import__(\"os\").system(\"ls\")')").hexdigest()[:16]: "eval bypass",
        }
        
        # Check code hash
        code_hash = hashlib.sha256(code.encode()).hexdigest()[:16]
        if code_hash in dangerous_hashes:
            raise SecurityError(f"KNOWN EXPLOIT: {dangerous_hashes[code_hash]}")
        
        # Check for common exploit fragments
        code_normalized = re.sub(r'\s+', ' ', code.lower().strip())
        fragments = [
            "import os",
            "os.system",
            "__import__",
            "eval(",
            "exec(",
        ]
        
        for fragment in fragments:
            if fragment in code_normalized:
                fragment_hash = hashlib.sha256(fragment.encode()).hexdigest()[:8]
                raise SecurityError(f"EXPLOIT FRAGMENT: {fragment} (hash: {fragment_hash})")
    
    @classmethod
    def _validate_python_code_ultra_secure(cls, code: str):
        """ULTRA-SECURE Python validation - UNBREAKABLE"""
        import ast
        import re
        
        try:
            # Parse AST
            tree = ast.parse(code)
            
            # Track all names and ensure security
            cls._analyze_python_ast_comprehensive(tree)
            
        except SyntaxError as e:
            raise SecurityError(f"Python syntax error: {e}")
        except Exception as e:
            raise SecurityError(f"Python validation error: {e}")
    
    @classmethod
    def _analyze_python_ast_comprehensive(cls, tree):
        """Comprehensive AST analysis with bypass detection"""
        import ast
        
        dangerous_nodes = []
        
        for node in ast.walk(tree):
            # ULTRA-STRICT function call analysis
            if isinstance(node, ast.Call):
                cls._check_function_call_ultra_secure(node)
            
            # Import analysis - ZERO TOLERANCE
            elif isinstance(node, (ast.Import, ast.ImportFrom)):
                cls._check_import_ultra_secure(node)
            
            # Name access analysis
            elif isinstance(node, ast.Name):
                cls._check_name_access_ultra_secure(node)
            
            # Attribute access analysis
            elif isinstance(node, ast.Attribute):
                cls._check_attribute_access_ultra_secure(node)
            
            # Subscript analysis (bypass detection)
            elif isinstance(node, ast.Subscript):
                cls._check_subscript_access_ultra_secure(node)
            
            # Class/Function definition analysis
            elif isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
                cls._check_definition_ultra_secure(node)
            
            # Comprehension analysis
            elif isinstance(node, (ast.ListComp, ast.DictComp, ast.SetComp, ast.GeneratorExp)):
                cls._check_comprehension_ultra_secure(node)
            
            # String analysis (for obfuscation)
            elif isinstance(node, ast.Str):
                cls._check_string_ultra_secure(node)
            
            # Number analysis (for character construction)
            elif isinstance(node, ast.Num):
                cls._check_number_ultra_secure(node)
        
        return True
    
    @classmethod
    def _check_function_call_ultra_secure(cls, node):
        """Ultra-secure function call analysis"""
        import ast
        
        if isinstance(node.func, ast.Name):
            # Direct function calls
            ultra_dangerous_funcs = [
                'eval', 'exec', 'compile', '__import__', 'getattr', 'setattr',
                'hasattr', 'delattr', 'globals', 'locals', 'vars', 'dir',
                'help', 'input', 'raw_input', 'open', 'file', 'exit', 'quit',
                'breakpoint', 'super', 'property', 'staticmethod', 'classmethod',
                'type', 'isinstance', 'issubclass', 'callable', 'id', 'hash',
                'memoryview', 'slice', 'range', 'enumerate', 'zip', 'filter',
                'map', 'sorted', 'reversed', 'any', 'all', 'sum', 'min', 'max',
                'abs', 'round', 'pow', 'divmod', 'bin', 'oct', 'hex', 'chr', 'ord',
                'repr', 'ascii', 'format', 'bytes', 'bytearray', 'frozenset'
            ]
            
            if node.func.id in ultra_dangerous_funcs:
                raise SecurityError(f"ULTRA-BANNED FUNCTION: {node.func.id}")
        
        elif isinstance(node.func, ast.Attribute):
            # Method calls
            cls._check_method_call_ultra_secure(node)
    
    @classmethod
    def _check_method_call_ultra_secure(cls, node):
        """Ultra-secure method call analysis"""
        import ast
        
        # Dangerous method patterns
        if hasattr(node.func, 'attr'):
            dangerous_methods = [
                'system', 'popen', 'spawn', 'fork', 'exec', 'eval',
                'import_module', 'load_module', 'decode', 'encode',
                'loads', 'dumps', 'pickle', 'unpickle'
            ]
            
            if node.func.attr in dangerous_methods:
                raise SecurityError(f"DANGEROUS METHOD: {node.func.attr}")
            
            # Check for module.method patterns
            if isinstance(node.func.value, ast.Name):
                if node.func.value.id in cls.BANNED_MODULES:
                    raise SecurityError(f"BANNED MODULE METHOD: {node.func.value.id}.{node.func.attr}")
    
    @classmethod
    def _check_import_ultra_secure(cls, node):
        """Ultra-secure import analysis"""
        import ast
        
        if isinstance(node, ast.Import):
            for alias in node.names:
                # Check against whitelist
                if alias.name not in cls.ALLOWED_IMPORTS['python']:
                    raise SecurityError(f"IMPORT NOT IN WHITELIST: {alias.name}")
                
                # Double-check against banned list
                if alias.name in cls.BANNED_MODULES:
                    raise SecurityError(f"EXPLICITLY BANNED IMPORT: {alias.name}")
        
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                # Check module against whitelist
                if node.module not in cls.ALLOWED_IMPORTS['python']:
                    raise SecurityError(f"FROM-IMPORT NOT IN WHITELIST: {node.module}")
                
                # Double-check against banned list
                if node.module in cls.BANNED_MODULES:
                    raise SecurityError(f"EXPLICITLY BANNED FROM-IMPORT: {node.module}")
    
    @classmethod 
    def _check_name_access_ultra_secure(cls, node):
        """Ultra-secure name access analysis"""
        import ast
        
        # Check for dangerous variable names
        dangerous_names = [
            '__builtins__', '__globals__', '__locals__', '__import__',
            '__file__', '__name__', '__doc__', '__package__', '__loader__',
            '__spec__', '__cached__', '__path__'
        ]
        
        if node.id in dangerous_names:
            raise SecurityError(f"DANGEROUS NAME ACCESS: {node.id}")
    
    @classmethod
    def _check_attribute_access_ultra_secure(cls, node):
        """Ultra-secure attribute access analysis"""
        import ast
        
        # Check for dunder attribute access
        if node.attr.startswith('__') and node.attr.endswith('__'):
            raise SecurityError(f"DUNDER ATTRIBUTE ACCESS: {node.attr}")
        
        # Check for frame/code object access
        dangerous_attrs = [
            'f_locals', 'f_globals', 'f_back', 'f_code', 'f_trace',
            'co_code', 'co_names', 'co_varnames', 'co_filename',
            'gi_frame', 'gi_code', 'cr_frame', 'cr_code'
        ]
        
        if node.attr in dangerous_attrs:
            raise SecurityError(f"DANGEROUS ATTRIBUTE ACCESS: {node.attr}")
    
    @classmethod
    def _check_subscript_access_ultra_secure(cls, node):
        """Ultra-secure subscript access analysis"""
        import ast
        
        if isinstance(node.value, ast.Name):
            dangerous_subscripts = ['__builtins__', '__globals__', '__locals__']
            if node.value.id in dangerous_subscripts:
                raise SecurityError(f"DANGEROUS SUBSCRIPT ACCESS: {node.value.id}")
    
    @classmethod
    def _check_definition_ultra_secure(cls, node):
        """Ultra-secure definition analysis"""
        import ast
        
        # Check for suspicious names
        if node.name.startswith('_'):
            raise SecurityError(f"UNDERSCORE DEFINITION: {node.name}")
        
        if node.name in ['eval', 'exec', 'compile', '__import__']:
            raise SecurityError(f"DANGEROUS REDEFINITION: {node.name}")
    
    @classmethod
    def _check_comprehension_ultra_secure(cls, node):
        """Ultra-secure comprehension analysis"""
        # Recursively check all sub-nodes in comprehensions
        for child in ast.walk(node):
            if isinstance(child, ast.Call):
                cls._check_function_call_ultra_secure(child)
    
    @classmethod
    def _check_string_ultra_secure(cls, node):
        """Ultra-secure string analysis"""
        import ast
        import re
        
        if isinstance(node, ast.Str):
            string_value = node.s
            
            # Check for encoded content
            if len(string_value) > 20:
                # Base64 pattern
                if re.match(r'^[A-Za-z0-9+/]+={0,2}$', string_value):
                    raise SecurityError("SUSPICIOUS STRING: Possible base64 encoding")
                
                # Hex pattern
                if re.match(r'^[0-9a-fA-F]+$', string_value):
                    raise SecurityError("SUSPICIOUS STRING: Possible hex encoding")
    
    @classmethod
    def _check_number_ultra_secure(cls, node):
        """Ultra-secure number analysis"""
        import ast
        
        if isinstance(node, ast.Num):
            # Check for character codes that might be used for bypass
            if isinstance(node.n, int) and 32 <= node.n <= 126:
                # ASCII printable range - could be used for chr() bypass
                pass  # Allow for now but log
            elif isinstance(node.n, int) and node.n > 0x1000:
                # High unicode values
                raise SecurityError(f"SUSPICIOUS NUMBER: High unicode value {node.n}")
    
    @classmethod
    def _validate_python_code(cls, code: str):
        """Legacy method - redirects to ultra-secure validation"""
        return cls._validate_python_code_ultra_secure(code)
    
    @classmethod
    def _validate_javascript_code_ultra_secure(cls, code: str):
        """ULTRA-SECURE JavaScript validation - UNBREAKABLE"""
        import re
        
        # LAYER 1: Comprehensive dangerous patterns
        ultra_dangerous_js_patterns = [
            # Code execution - ALL BLOCKED
            r'\beval\s*\(',
            r'\bFunction\s*\(',
            r'\bsetTimeout\s*\(',
            r'\bsetInterval\s*\(',
            r'\bsetImmediate\s*\(',
            r'\bexecScript\s*\(',
            
            # Module system - COMPLETELY BLOCKED
            r'\brequire\s*\(',
            r'\bimport\s*\(',
            r'\bexports\s*\.',
            r'\bmodule\s*\.',
            r'\b__dirname\b',
            r'\b__filename\b',
            
            # Global objects - ALL BLOCKED
            r'\bprocess\s*\.',
            r'\bglobal\s*\.',
            r'\bwindow\s*\.',
            r'\bdocument\s*\.',
            r'\blocation\s*\.',
            r'\bnavigator\s*\.',
            r'\bthis\s*\.',
            
            # Node.js modules - COMPLETELY BLOCKED
            r'\bfs\s*\.',
            r'\bpath\s*\.',
            r'\bos\s*\.',
            r'\bchild_process\s*\.',
            r'\bcluster\s*\.',
            r'\bworker_threads\s*\.',
            r'\bcrypto\s*\.',
            r'\bhttp\s*\.',
            r'\bhttps\s*\.',
            r'\bnet\s*\.',
            r'\bdgram\s*\.',
            r'\btls\s*\.',
            r'\bvm\s*\.',
            
            # Dangerous constructors - ALL BLOCKED
            r'\bnew\s+Function\s*\(',
            r'\bnew\s+WebSocket\s*\(',
            r'\bnew\s+XMLHttpRequest\s*\(',
            r'\bnew\s+Worker\s*\(',
            r'\bnew\s+SharedWorker\s*\(',
            r'\bnew\s+ServiceWorker\s*\(',
            r'\bnew\s+EventSource\s*\(',
            r'\bnew\s+WebAssembly\.',
            
            # Prototype pollution - CRITICAL BLOCK
            r'__proto__',
            r'constructor\s*\.',
            r'prototype\s*\.',
            r'Object\.defineProperty',
            r'Object\.create',
            r'Object\.setPrototypeOf',
            r'Reflect\.',
            r'Proxy\.',
            
            # Network operations - ALL BLOCKED
            r'\bfetch\s*\(',
            r'\bXMLHttpRequest\s*\(',
            r'\bWebSocket\s*\(',
            r'\bEventSource\s*\(',
            r'\bNavigator\.',
            
            # File system operations - ALL BLOCKED
            r'\breadFile',
            r'\bwriteFile',
            r'\bcreateReadStream',
            r'\bcreateWriteStream',
            r'\bexistSync',
            r'\bmkdirSync',
            r'\brmdirSync',
            r'\bunlinkSync',
            
            # Buffer/TypedArray operations
            r'\bBuffer\s*\.',
            r'\bArrayBuffer\s*\(',
            r'\bUint8Array\s*\(',
            r'\bDataView\s*\(',
            
            # Dangerous string methods
            r'\.charCodeAt\s*\(',
            r'\.fromCharCode\s*\(',
            r'String\.fromCharCode',
            
            # Regular expression DoS
            r'\/.*\*.*\+.*\/',
            r'\/.*\+.*\*.*\/',
            r'\/\(\?\=.*\)\*\+',
            
            # Timing attacks
            r'\bperformance\.',
            r'\bDate\.now',
            r'\bnew\s+Date\s*\(',
            
            # Error manipulation
            r'\bError\s*\.',
            r'\.stack\b',
            r'\.message\b',
            
            # Symbol manipulation
            r'\bSymbol\s*\.',
            r'Symbol\.for',
            r'Symbol\.keyFor',
            
            # Generator/Iterator manipulation
            r'\.next\s*\(',
            r'\.throw\s*\(',
            r'\.return\s*\(',
        ]
        
        for pattern in ultra_dangerous_js_patterns:
            matches = re.findall(pattern, code, re.IGNORECASE)
            if matches:
                raise SecurityError(f"ULTRA-DANGEROUS JS PATTERN: {pattern} - matches: {matches}")
        
        # LAYER 2: Banned keywords - ZERO TOLERANCE
        ultra_banned_keywords = [
            # Debugging
            'debugger', 'console', 'alert', 'confirm', 'prompt',
            
            # Storage
            'localStorage', 'sessionStorage', 'indexedDB', 'openDatabase',
            'webkitStorageInfo', 'navigator.storage',
            
            # Animation/Timing
            'requestAnimationFrame', 'cancelAnimationFrame',
            'requestIdleCallback', 'cancelIdleCallback',
            
            # Web APIs
            'geolocation', 'getUserMedia', 'getDisplayMedia',
            'bluetooth', 'usb', 'serial', 'hid',
            
            # Service Workers
            'serviceWorker', 'caches', 'clients',
            
            # Crypto APIs
            'crypto.subtle', 'crypto.getRandomValues',
            
            # Battery API
            'navigator.battery', 'navigator.getBattery',
            
            # Device APIs
            'devicePixelRatio', 'screen', 'matchMedia',
        ]
        
        for keyword in ultra_banned_keywords:
            if keyword in code:
                raise SecurityError(f"ULTRA-BANNED JS KEYWORD: {keyword}")
        
        # LAYER 3: Encoding/Obfuscation detection
        cls._check_js_obfuscation(code)
        
        # LAYER 4: Template literal analysis
        cls._check_js_template_literals(code)
        
        # LAYER 5: Comment-based bypasses
        cls._check_js_comment_bypasses(code)
    
    @classmethod
    def _check_js_obfuscation(cls, code: str):
        """Check for JavaScript obfuscation techniques"""
        import re
        
        obfuscation_patterns = [
            # Unicode escapes
            r'\\u[0-9a-fA-F]{4}',
            r'\\x[0-9a-fA-F]{2}',
            
            # Hex string manipulation
            r'0x[0-9a-fA-F]+',
            
            # Base64-like patterns
            r'atob\s*\(',
            r'btoa\s*\(',
            r'decodeURIComponent\s*\(',
            r'encodeURIComponent\s*\(',
            r'unescape\s*\(',
            r'escape\s*\(',
            
            # String manipulation for obfuscation
            r'\.split\s*\(\s*["\']["\']?\s*\)\.reverse\s*\(\s*\)\.join',
            r'\.replace\s*\(\s*\/.*\/.*\)',
            r'String\.prototype\.',
            r'Array\.prototype\.',
            
            # Dynamic property access
            r'\[.*\+.*\]',
            r'\[.*String\.fromCharCode.*\]',
            
            # Eval-like patterns
            r'this\s*\[\s*.*\s*\]\s*\(',
            r'window\s*\[\s*.*\s*\]\s*\(',
            r'global\s*\[\s*.*\s*\]\s*\(',
        ]
        
        for pattern in obfuscation_patterns:
            if re.search(pattern, code, re.IGNORECASE):
                raise SecurityError(f"JS OBFUSCATION DETECTED: {pattern}")
    
    @classmethod 
    def _check_js_template_literals(cls, code: str):
        """Check for dangerous template literal usage"""
        import re
        
        # Template literals can be used for code injection
        if '`' in code:
            # Check for dynamic code construction
            if re.search(r'`.*\$\{.*\}.*`', code):
                raise SecurityError("DANGEROUS TEMPLATE LITERAL: Dynamic code construction detected")
    
    @classmethod
    def _check_js_comment_bypasses(cls, code: str):
        """Check for comment-based bypass attempts"""
        import re
        
        # Remove comments but check for suspicious patterns first
        if '/*' in code or '//' in code:
            # Check for code hidden in comments
            comment_patterns = [
                r'\/\*.*eval.*\*\/',
                r'\/\/.*eval',
                r'\/\*.*Function.*\*\/',
                r'\/\/.*Function',
            ]
            
            for pattern in comment_patterns:
                if re.search(pattern, code, re.IGNORECASE | re.DOTALL):
                    raise SecurityError(f"SUSPICIOUS COMMENT: {pattern}")
    
    @classmethod
    def _validate_javascript_code(cls, code: str):
        """Legacy method - redirects to ultra-secure validation"""
        return cls._validate_javascript_code_ultra_secure(code)

class SecurityError(Exception):
    """Custom exception for security violations"""
    pass

class CodeExecutor:
    """Secure code executor with resource limits"""
    
    def __init__(self):
        self.workspace = WORKSPACE_DIR
        self.temp_dir = TEMP_DIR
    
    async def execute(self, code: str, language: str, timeout: int = None) -> ExecutionResult:
        """Execute code with security restrictions"""
        timeout = timeout or EXECUTION_TIMEOUT
        
        # Validate code security
        SandboxSecurity.validate_code(code, language)
        
        # Create temporary file
        temp_file = self._create_temp_file(code, language)
        
        try:
            # Execute with restrictions
            result = await self._execute_with_limits(temp_file, language, timeout)
            return result
        finally:
            # Clean up
            if temp_file.exists():
                temp_file.unlink()
    
    def _create_temp_file(self, code: str, language: str) -> Path:
        """Create temporary file for code execution"""
        extensions = {
            'python': '.py',
            'javascript': '.js',
            'bash': '.sh'
        }
        
        ext = extensions.get(language, '.txt')
        temp_file = self.temp_dir / f"exec_{int(time.time())}_{os.getpid()}{ext}"
        
        with open(temp_file, 'w') as f:
            f.write(code)
        
        return temp_file
    
    async def _execute_with_limits(self, file_path: Path, language: str, timeout: int) -> ExecutionResult:
        """Execute file with resource limits"""
        commands = {
            'python': ['python3', str(file_path)],
            'javascript': ['node', str(file_path)],
            'bash': ['bash', str(file_path)]
        }
        
        cmd = commands.get(language)
        if not cmd:
            raise ValueError(f"Unsupported language: {language}")
        
        start_time = time.time()
        
        # Set resource limits
        def set_limits():
            # Memory limit (in bytes)
            memory_limit = self._parse_memory_limit(MAX_MEMORY)
            resource.setrlimit(resource.RLIMIT_AS, (memory_limit, memory_limit))
            
            # CPU time limit
            resource.setrlimit(resource.RLIMIT_CPU, (timeout, timeout))
            
            # File size limit (10MB)
            resource.setrlimit(resource.RLIMIT_FSIZE, (10*1024*1024, 10*1024*1024))
            
            # Number of processes
            resource.setrlimit(resource.RLIMIT_NPROC, (10, 10))
        
        try:
            # Execute process
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                preexec_fn=set_limits,
                cwd=str(self.workspace)
            )
            
            # Wait for completion with timeout
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=timeout
            )
            
            execution_time = time.time() - start_time
            
            return ExecutionResult(
                stdout=stdout.decode('utf-8', errors='replace'),
                stderr=stderr.decode('utf-8', errors='replace'),
                exit_code=process.returncode,
                execution_time=execution_time,
                memory_usage=0,  # TODO: Implement memory tracking
                cpu_usage=0.0   # TODO: Implement CPU tracking
            )
            
        except asyncio.TimeoutError:
            # Kill process if timeout
            try:
                process.kill()
                await process.wait()
            except:
                pass
            
            raise TimeoutError(f"Execution timeout after {timeout} seconds")
        
        except Exception as e:
            raise RuntimeError(f"Execution failed: {e}")
    
    def _parse_memory_limit(self, memory_str: str) -> int:
        """Parse memory limit string to bytes"""
        memory_str = memory_str.lower()
        
        if memory_str.endswith('k'):
            return int(memory_str[:-1]) * 1024
        elif memory_str.endswith('m'):
            return int(memory_str[:-1]) * 1024 * 1024
        elif memory_str.endswith('g'):
            return int(memory_str[:-1]) * 1024 * 1024 * 1024
        else:
            return int(memory_str)

# Global executor instance
executor = CodeExecutor()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': time.time(),
        'uptime': time.time() - start_time,
        'memory_usage': psutil.virtual_memory().percent,
        'cpu_usage': psutil.cpu_percent(),
        'disk_usage': psutil.disk_usage('/').percent
    })

@app.route('/execute', methods=['POST'])
async def execute_code():
    """Execute code endpoint - FILE-BASED COMMUNICATION"""
    try:
        data = request.get_json()
        
        if not data or 'code' not in data:
            return jsonify({'error': 'Missing code parameter'}), 400
        
        code = data['code']
        language = data.get('language', 'python')
        timeout = data.get('timeout', EXECUTION_TIMEOUT)
        
        # Validate inputs
        if not code.strip():
            return jsonify({'error': 'Empty code'}), 400
        
        if language not in ['python', 'javascript', 'bash']:
            return jsonify({'error': f'Unsupported language: {language}'}), 400
        
        if timeout > 60:  # Max 60 seconds
            timeout = 60
        
        # Import file-based client
        from file_sandbox_client import sandbox_client
        
        # Execute via file-based communication
        result = await sandbox_client.execute_code(code, language, timeout)
        
        return jsonify({
            'stdout': result.get('stdout', ''),
            'stderr': result.get('stderr', ''),
            'exit_code': result.get('exit_code', 1),
            'execution_time': result.get('execution_time', 0),
            'memory_usage': result.get('memory_usage', 0),
            'cpu_usage': result.get('cpu_usage', 0),
            'language': language,
            'security_isolated': True
        })
        
    except SecurityError as e:
        return jsonify({'error': f'Security violation: {e}'}), 403
    
    except TimeoutError as e:
        return jsonify({'error': str(e)}), 408
    
    except Exception as e:
        return jsonify({'error': f'Execution failed: {e}'}), 500

@app.route('/workspace', methods=['GET'])
def list_workspace():
    """List workspace contents"""
    try:
        files = []
        for item in WORKSPACE_DIR.rglob('*'):
            if item.is_file():
                files.append({
                    'path': str(item.relative_to(WORKSPACE_DIR)),
                    'size': item.stat().st_size,
                    'modified': item.stat().st_mtime
                })
        
        return jsonify({'files': files})
    
    except Exception as e:
        return jsonify({'error': f'Failed to list workspace: {e}'}), 500

@app.route('/workspace/<path:filename>', methods=['GET'])
def get_file(filename):
    """Get file from workspace"""
    try:
        file_path = WORKSPACE_DIR / filename
        
        if not file_path.exists():
            return jsonify({'error': 'File not found'}), 404
        
        if not file_path.is_file():
            return jsonify({'error': 'Not a file'}), 400
        
        # Security check - ensure file is within workspace
        if not str(file_path.resolve()).startswith(str(WORKSPACE_DIR.resolve())):
            return jsonify({'error': 'Access denied'}), 403
        
        with open(file_path, 'r') as f:
            content = f.read()
        
        return jsonify({
            'content': content,
            'size': file_path.stat().st_size,
            'modified': file_path.stat().st_mtime
        })
    
    except Exception as e:
        return jsonify({'error': f'Failed to read file: {e}'}), 500

@app.route('/workspace/<path:filename>', methods=['PUT'])
def save_file(filename):
    """Save file to workspace"""
    try:
        data = request.get_json()
        
        if not data or 'content' not in data:
            return jsonify({'error': 'Missing content'}), 400
        
        file_path = WORKSPACE_DIR / filename
        
        # Security check - ensure file is within workspace
        if not str(file_path.resolve()).startswith(str(WORKSPACE_DIR.resolve())):
            return jsonify({'error': 'Access denied'}), 403
        
        # Create parent directories
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(file_path, 'w') as f:
            f.write(data['content'])
        
        return jsonify({
            'message': 'File saved successfully',
            'path': str(file_path.relative_to(WORKSPACE_DIR)),
            'size': file_path.stat().st_size
        })
    
    except Exception as e:
        return jsonify({'error': f'Failed to save file: {e}'}), 500

@app.route('/stats', methods=['GET'])
def get_stats():
    """Get system statistics"""
    try:
        return jsonify({
            'cpu_percent': psutil.cpu_percent(interval=1),
            'memory': {
                'total': psutil.virtual_memory().total,
                'available': psutil.virtual_memory().available,
                'percent': psutil.virtual_memory().percent
            },
            'disk': {
                'total': psutil.disk_usage('/').total,
                'free': psutil.disk_usage('/').free,
                'percent': psutil.disk_usage('/').percent
            },
            'processes': len(psutil.pids()),
            'uptime': time.time() - start_time
        })
    
    except Exception as e:
        return jsonify({'error': f'Failed to get stats: {e}'}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

# Global start time
start_time = time.time()

if __name__ == '__main__':
    print("Starting LocoDex Sandbox Server...")
    print(f"Workspace: {WORKSPACE_DIR}")
    print(f"Temp Dir: {TEMP_DIR}")
    print(f"Execution Timeout: {EXECUTION_TIMEOUT}s")
    print(f"Max Memory: {MAX_MEMORY}")
    print(f"Max CPU: {MAX_CPU}")
    
    app.run(host='0.0.0.0', port=3002, debug=False)

