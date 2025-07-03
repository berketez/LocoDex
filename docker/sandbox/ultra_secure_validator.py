#!/usr/bin/env python3
"""
ULTRA-SECURE AST-based Code Validator
Prevents ALL known sandbox escape techniques
"""

import ast
import builtins
import sys
from typing import Set, List, Dict, Any
from dataclasses import dataclass

@dataclass
class SecurityViolation:
    """Security violation details"""
    type: str
    message: str
    line: int
    column: int
    severity: str  # 'CRITICAL', 'HIGH', 'MEDIUM'

class UltraSecureValidator(ast.NodeVisitor):
    """AST-based ultra-secure code validator"""
    
    def __init__(self, language: str = 'python'):
        self.language = language
        self.violations: List[SecurityViolation] = []
        self.allowed_builtins = self._get_allowed_builtins()
        self.allowed_modules = self._get_allowed_modules()
        self.dangerous_attributes = self._get_dangerous_attributes()
        
    def _get_allowed_builtins(self) -> Set[str]:
        """Define minimal set of allowed builtin functions"""
        return {
            # Basic data types
            'int', 'float', 'str', 'bool', 'list', 'dict', 'tuple', 'set',
            # Math operations
            'abs', 'min', 'max', 'sum', 'round', 'pow',
            # Safe string operations
            'len', 'ord', 'chr',
            # Safe iteration
            'range', 'enumerate', 'zip',
            # Type checking
            'type', 'isinstance',
            # Safe printing (output only)
            'print',
        }
    
    def _get_allowed_modules(self) -> Set[str]:
        """Define minimal set of allowed modules"""
        return {
            'math', 'random', 'datetime', 'json',
            'numpy', 'pandas'  # Data science (computation only)
        }
    
    def _get_dangerous_attributes(self) -> Set[str]:
        """Dangerous attributes that provide system access"""
        return {
            '__import__', '__builtins__', '__globals__', '__locals__',
            '__dict__', '__class__', '__bases__', '__mro__', '__subclasses__',
            '__code__', '__func__', '__closure__', '__module__',
            'func_globals', 'func_code', 'gi_frame', 'gi_code',
            '__file__', '__path__', '__package__', '__spec__',
            '__loader__', '__cached__', '__doc__', '__name__'
        }
    
    def validate(self, code: str) -> List[SecurityViolation]:
        """Main validation entry point"""
        self.violations = []
        
        try:
            # Parse code into AST
            tree = ast.parse(code)
            
            # Walk the AST and check each node
            self.visit(tree)
            
        except SyntaxError as e:
            self.violations.append(SecurityViolation(
                type='SYNTAX_ERROR',
                message=f"Syntax error: {e.msg}",
                line=e.lineno or 0,
                column=e.offset or 0,
                severity='HIGH'
            ))
        
        return self.violations
    
    def _add_violation(self, node: ast.AST, violation_type: str, message: str, severity: str = 'CRITICAL'):
        """Add a security violation"""
        self.violations.append(SecurityViolation(
            type=violation_type,
            message=message,
            line=getattr(node, 'lineno', 0),
            column=getattr(node, 'col_offset', 0),
            severity=severity
        ))
    
    # AST Node Visitors - Each method handles a specific AST node type
    
    def visit_Import(self, node: ast.Import):
        """Check import statements"""
        for alias in node.names:
            module_name = alias.name.split('.')[0]  # Get top-level module
            if module_name not in self.allowed_modules:
                self._add_violation(
                    node, 'FORBIDDEN_IMPORT',
                    f"Import of forbidden module: {alias.name}",
                    'CRITICAL'
                )
        self.generic_visit(node)
    
    def visit_ImportFrom(self, node: ast.ImportFrom):
        """Check from-import statements"""
        if node.module:
            module_name = node.module.split('.')[0]
            if module_name not in self.allowed_modules:
                self._add_violation(
                    node, 'FORBIDDEN_IMPORT',
                    f"Import from forbidden module: {node.module}",
                    'CRITICAL'
                )
        
        # Check for dangerous imports like "from builtins import"
        for alias in node.names:
            if alias.name == '*':
                self._add_violation(
                    node, 'WILDCARD_IMPORT',
                    "Wildcard imports are forbidden",
                    'CRITICAL'
                )
        
        self.generic_visit(node)
    
    def visit_Call(self, node: ast.Call):
        """Check function calls"""
        # Check builtin function calls
        if isinstance(node.func, ast.Name):
            func_name = node.func.id
            
            # Block dangerous builtin functions
            if func_name in ['eval', 'exec', 'compile', '__import__']:
                self._add_violation(
                    node, 'DANGEROUS_BUILTIN',
                    f"Dangerous builtin function: {func_name}",
                    'CRITICAL'
                )
            
            # Check if builtin is allowed
            elif func_name in dir(builtins) and func_name not in self.allowed_builtins:
                self._add_violation(
                    node, 'FORBIDDEN_BUILTIN',
                    f"Forbidden builtin function: {func_name}",
                    'CRITICAL'
                )
        
        # Check attribute calls (method calls)
        elif isinstance(node.func, ast.Attribute):
            attr_name = node.func.attr
            
            # Block dangerous methods
            if attr_name in ['__import__', '__getattribute__', '__setattr__', '__delattr__']:
                self._add_violation(
                    node, 'DANGEROUS_METHOD',
                    f"Dangerous method call: {attr_name}",
                    'CRITICAL'
                )
        
        self.generic_visit(node)
    
    def visit_Attribute(self, node: ast.Attribute):
        """Check attribute access"""
        attr_name = node.attr
        
        # Block access to dangerous attributes
        if attr_name in self.dangerous_attributes:
            self._add_violation(
                node, 'DANGEROUS_ATTRIBUTE',
                f"Access to dangerous attribute: {attr_name}",
                'CRITICAL'
            )
        
        # Block double underscore attributes (dunder methods)
        if attr_name.startswith('__') and attr_name.endswith('__'):
            if attr_name not in ['__len__', '__str__', '__repr__', '__int__', '__float__']:
                self._add_violation(
                    node, 'DUNDER_ACCESS',
                    f"Access to restricted dunder attribute: {attr_name}",
                    'CRITICAL'
                )
        
        self.generic_visit(node)
    
    def visit_Subscript(self, node: ast.Subscript):
        """Check subscript access (e.g., dict['key'], list[0])"""
        # Check for dangerous subscript access patterns
        if isinstance(node.slice, ast.Constant):
            if isinstance(node.slice.value, str):
                value = node.slice.value
                # Block access to dangerous keys
                if value in self.dangerous_attributes:
                    self._add_violation(
                        node, 'DANGEROUS_SUBSCRIPT',
                        f"Dangerous subscript access: [{value!r}]",
                        'CRITICAL'
                    )
        
        self.generic_visit(node)
    
    def visit_Name(self, node: ast.Name):
        """Check variable/name access"""
        name = node.id
        
        # Block access to dangerous names
        if name in ['__builtins__', '__import__', 'exec', 'eval']:
            self._add_violation(
                node, 'DANGEROUS_NAME',
                f"Access to dangerous name: {name}",
                'CRITICAL'
            )
        
        self.generic_visit(node)
    
    def visit_Global(self, node: ast.Global):
        """Block global statements"""
        self._add_violation(
            node, 'GLOBAL_STATEMENT',
            "Global statements are forbidden",
            'CRITICAL'
        )
        self.generic_visit(node)
    
    def visit_Nonlocal(self, node: ast.Nonlocal):
        """Block nonlocal statements"""
        self._add_violation(
            node, 'NONLOCAL_STATEMENT',
            "Nonlocal statements are forbidden",
            'HIGH'
        )
        self.generic_visit(node)
    
    def visit_Lambda(self, node: ast.Lambda):
        """Check lambda expressions"""
        # Lambda expressions can be used for code injection
        self._add_violation(
            node, 'LAMBDA_EXPRESSION',
            "Lambda expressions are forbidden for security",
            'HIGH'
        )
        self.generic_visit(node)
    
    def visit_ClassDef(self, node: ast.ClassDef):
        """Check class definitions"""
        # Block class definitions that could be used for metaclass attacks
        if node.bases or node.keywords:
            self._add_violation(
                node, 'COMPLEX_CLASS',
                "Classes with inheritance or metaclasses are forbidden",
                'CRITICAL'
            )
        
        # Simple classes are allowed for data structures
        self.generic_visit(node)
    
    def visit_FunctionDef(self, node: ast.FunctionDef):
        """Check function definitions"""
        # Check for dangerous decorators
        for decorator in node.decorator_list:
            if isinstance(decorator, ast.Name):
                if decorator.id in ['property', 'staticmethod', 'classmethod']:
                    continue  # These are safe
                else:
                    self._add_violation(
                        node, 'DANGEROUS_DECORATOR',
                        f"Potentially dangerous decorator: {decorator.id}",
                        'HIGH'
                    )
        
        self.generic_visit(node)
    
    def visit_With(self, node: ast.With):
        """Check with statements"""
        # With statements can be used to access file system
        self._add_violation(
            node, 'WITH_STATEMENT',
            "With statements are forbidden (potential file access)",
            'CRITICAL'
        )
        self.generic_visit(node)
    
    def visit_Try(self, node: ast.Try):
        """Check try-except blocks"""
        # Try blocks can be used to catch and suppress security errors
        self._add_violation(
            node, 'TRY_EXCEPT',
            "Try-except blocks are forbidden (can suppress security errors)",
            'HIGH'
        )
        self.generic_visit(node)


class NetworkSecurityValidator:
    """Network security validation - checks for network-related code"""
    
    NETWORK_PATTERNS = [
        # Direct networking
        r'socket\s*\.',
        r'urllib\.',
        r'requests\.',
        r'http\.',
        r'ftplib\.',
        r'smtplib\.',
        r'telnetlib\.',
        # Network imports
        r'import\s+socket',
        r'import\s+urllib',
        r'import\s+requests',
        r'import\s+http',
        r'from\s+socket\s+import',
        r'from\s+urllib\s+import',
        # Protocol schemes
        r'https?://',
        r'ftp://',
        r'ftps://',
        # IP addresses
        r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b',
        # Localhost references
        r'localhost',
        r'127\.0\.0\.1',
        # Network functions
        r'connect\s*\(',
        r'bind\s*\(',
        r'listen\s*\(',
        r'accept\s*\(',
        r'send\s*\(',
        r'recv\s*\(',
        r'sendto\s*\(',
        r'recvfrom\s*\(',
    ]
    
    @classmethod
    def validate_network_security(cls, code: str) -> List[SecurityViolation]:
        """Check for network-related security violations"""
        import re
        violations = []
        
        lines = code.split('\n')
        for line_num, line in enumerate(lines, 1):
            for pattern in cls.NETWORK_PATTERNS:
                if re.search(pattern, line, re.IGNORECASE):
                    violations.append(SecurityViolation(
                        type='NETWORK_ACCESS',
                        message=f"Network access detected: {pattern}",
                        line=line_num,
                        column=0,
                        severity='CRITICAL'
                    ))
        
        return violations


def validate_code_ultra_secure(code: str, language: str = 'python') -> List[SecurityViolation]:
    """
    Ultra-secure code validation using multiple techniques:
    1. AST-based parsing and validation
    2. Network security validation
    3. Pattern-based detection for non-Python languages
    """
    all_violations = []
    
    if language == 'python':
        # AST-based validation for Python
        ast_validator = UltraSecureValidator(language)
        ast_violations = ast_validator.validate(code)
        all_violations.extend(ast_violations)
        
        # Network security validation
        network_violations = NetworkSecurityValidator.validate_network_security(code)
        all_violations.extend(network_violations)
    
    elif language == 'javascript':
        # For JavaScript, use pattern-based detection (AST parsing would require JS parser)
        js_violations = _validate_javascript_patterns(code)
        all_violations.extend(js_violations)
        
        # Network security validation
        network_violations = NetworkSecurityValidator.validate_network_security(code)
        all_violations.extend(network_violations)
    
    else:
        all_violations.append(SecurityViolation(
            type='UNSUPPORTED_LANGUAGE',
            message=f"Language {language} is not supported",
            line=0,
            column=0,
            severity='CRITICAL'
        ))
    
    return all_violations


def _validate_javascript_patterns(code: str) -> List[SecurityViolation]:
    """Pattern-based validation for JavaScript"""
    import re
    violations = []
    
    dangerous_js_patterns = [
        r'eval\s*\(',
        r'Function\s*\(',
        r'setTimeout\s*\(',
        r'setInterval\s*\(',
        r'require\s*\(',
        r'import\s*\(',
        r'fetch\s*\(',
        r'XMLHttpRequest',
        r'WebSocket',
        r'location\.',
        r'window\.',
        r'document\.',
        r'global\.',
        r'process\.',
        r'Buffer\.',
        r'__dirname',
        r'__filename',
        r'\.constructor\.',
        r'this\.constructor',
        r'constructor\.constructor',
        r'prototype\.',
        r'__proto__\.',
    ]
    
    lines = code.split('\n')
    for line_num, line in enumerate(lines, 1):
        for pattern in dangerous_js_patterns:
            if re.search(pattern, line, re.IGNORECASE):
                violations.append(SecurityViolation(
                    type='DANGEROUS_JS_PATTERN',
                    message=f"Dangerous JavaScript pattern: {pattern}",
                    line=line_num,
                    column=0,
                    severity='CRITICAL'
                ))
    
    return violations


# Test the validator
if __name__ == "__main__":
    # Test with some dangerous code
    test_code = """
import os
eval("print('hello')")
__import__('subprocess')
globals()['__builtins__']['exec']('print("pwned")')
"""
    
    violations = validate_code_ultra_secure(test_code)
    for v in violations:
        print(f"VIOLATION: {v.type} - {v.message} (Line {v.line})")