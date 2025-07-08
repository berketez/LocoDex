import * as vscode from 'vscode';
import * as path from 'path';
import { CodeContext } from '../types';

/**
 * Get code context for the current position
 */
export function getCodeContext(document: vscode.TextDocument, position: vscode.Position): CodeContext {
  const language = getLanguageFromDocument(document);
  const filePath = getRelativeFilePath(document.uri);
  
  // Get surrounding code
  const contextLines = 10;
  const startLine = Math.max(0, position.line - contextLines);
  const endLine = Math.min(document.lineCount - 1, position.line + contextLines);
  
  let surroundingCode = '';
  for (let i = startLine; i <= endLine; i++) {
    const line = document.lineAt(i);
    surroundingCode += line.text + '\n';
  }

  // Get project context
  const projectContext = getProjectContext(document.uri);

  return {
    filePath,
    language,
    surroundingCode: surroundingCode.trim(),
    lineNumber: position.line + 1, // 1-based line numbers
    columnNumber: position.character + 1, // 1-based column numbers
    projectContext
  };
}

/**
 * Get programming language from document
 */
export function getLanguageFromDocument(document: vscode.TextDocument): string {
  const languageId = document.languageId;
  
  // Map VS Code language IDs to common names
  const languageMap: Record<string, string> = {
    'javascript': 'javascript',
    'typescript': 'typescript',
    'typescriptreact': 'typescript',
    'javascriptreact': 'javascript',
    'python': 'python',
    'java': 'java',
    'csharp': 'csharp',
    'cpp': 'cpp',
    'c': 'c',
    'go': 'go',
    'rust': 'rust',
    'php': 'php',
    'ruby': 'ruby',
    'swift': 'swift',
    'kotlin': 'kotlin',
    'scala': 'scala',
    'dart': 'dart',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',
    'json': 'json',
    'yaml': 'yaml',
    'xml': 'xml',
    'markdown': 'markdown',
    'bash': 'bash',
    'shell': 'bash',
    'powershell': 'powershell',
    'dockerfile': 'dockerfile',
    'sql': 'sql',
    'vue': 'vue',
    'svelte': 'svelte'
  };

  return languageMap[languageId] || languageId;
}

/**
 * Get relative file path from workspace
 */
export function getRelativeFilePath(uri: vscode.Uri): string {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
  if (workspaceFolder) {
    return path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
  }
  return path.basename(uri.fsPath);
}

/**
 * Get project context information
 */
export function getProjectContext(uri: vscode.Uri): any {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
  if (!workspaceFolder) {
    return {};
  }

  const context: any = {};

  // Try to read package.json for JavaScript/TypeScript projects
  try {
    const packageJsonUri = vscode.Uri.joinPath(workspaceFolder.uri, 'package.json');
    const readPromise = vscode.workspace.fs.readFile(packageJsonUri);
    readPromise.then(data => {
      const packageJson = JSON.parse(data.toString());
      context.packageJson = {
        name: packageJson.name,
        version: packageJson.version,
        dependencies: Object.keys(packageJson.dependencies || {}),
        devDependencies: Object.keys(packageJson.devDependencies || {})
      };
    }, (err: any) => {
      // Ignore if package.json doesn't exist
    });
  } catch (error) {
    // Ignore package.json errors
  }

  // Get git branch if available
  try {
    const gitExtension = vscode.extensions.getExtension('vscode.git');
    if (gitExtension?.isActive) {
      const git = gitExtension.exports.getAPI(1);
      const repo = git.getRepository(uri);
      if (repo?.state.HEAD?.name) {
        context.gitBranch = repo.state.HEAD.name;
      }
    }
  } catch (error) {
    // Ignore git errors
  }

  return context;
}

/**
 * Get selected text or current line
 */
export function getSelectedTextOrCurrentLine(editor: vscode.TextEditor): { text: string; range: vscode.Range } {
  const selection = editor.selection;
  
  if (!selection.isEmpty) {
    return {
      text: editor.document.getText(selection),
      range: selection
    };
  }

  // Get current line if nothing is selected
  const currentLine = editor.document.lineAt(selection.active.line);
  return {
    text: currentLine.text,
    range: currentLine.range
  };
}

/**
 * Get function or class context around position
 */
export function getFunctionContext(document: vscode.TextDocument, position: vscode.Position): string {
  const language = getLanguageFromDocument(document);
  const text = document.getText();
  const offset = document.offsetAt(position);

  // Language-specific function detection patterns
  const patterns: Record<string, RegExp[]> = {
    javascript: [
      /function\s+(\w+)\s*\([^)]*\)\s*{/g,
      /(\w+)\s*:\s*function\s*\([^)]*\)\s*{/g,
      /(\w+)\s*=>\s*{/g,
      /class\s+(\w+)/g
    ],
    typescript: [
      /function\s+(\w+)\s*\([^)]*\)\s*:\s*[^{]*{/g,
      /(\w+)\s*\([^)]*\)\s*:\s*[^{]*{/g,
      /class\s+(\w+)/g
    ],
    python: [
      /def\s+(\w+)\s*\([^)]*\)\s*:/g,
      /class\s+(\w+)/g
    ],
    java: [
      /(public|private|protected)?\s*(static)?\s*\w+\s+(\w+)\s*\([^)]*\)\s*{/g,
      /class\s+(\w+)/g
    ],
    csharp: [
      /(public|private|protected)?\s*(static)?\s*\w+\s+(\w+)\s*\([^)]*\)\s*{/g,
      /class\s+(\w+)/g
    ]
  };

  const languagePatterns = patterns[language] || patterns.javascript;
  
  let bestMatch = '';
  let bestDistance = Infinity;

  for (const pattern of languagePatterns) {
    let match;
    pattern.lastIndex = 0; // Reset regex
    
    while ((match = pattern.exec(text)) !== null) {
      const matchOffset = match.index;
      const matchEnd = matchOffset + match[0].length;
      
      // Check if position is within or after this function
      if (offset >= matchOffset && offset <= matchEnd + 1000) { // 1000 char buffer
        const distance = Math.abs(offset - matchOffset);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestMatch = match[0];
        }
      }
    }
  }

  return bestMatch;
}

/**
 * Check if position is inside a string literal
 */
export function isInStringLiteral(document: vscode.TextDocument, position: vscode.Position): boolean {
  const line = document.lineAt(position.line);
  const textBeforeCursor = line.text.substring(0, position.character);
  
  // Count quotes before cursor
  const singleQuotes = (textBeforeCursor.match(/(?<!\\)'/g) || []).length;
  const doubleQuotes = (textBeforeCursor.match(/(?<!\\)"/g) || []).length;
  const backticks = (textBeforeCursor.match(/(?<!\\)`/g) || []).length;

  return (singleQuotes % 2 === 1) || (doubleQuotes % 2 === 1) || (backticks % 2 === 1);
}

/**
 * Check if position is inside a comment
 */
export function isInComment(document: vscode.TextDocument, position: vscode.Position): boolean {
  const language = getLanguageFromDocument(document);
  const line = document.lineAt(position.line);
  const textBeforeCursor = line.text.substring(0, position.character);
  
  const commentPrefixes: Record<string, string[]> = {
    javascript: ['//', '/*'],
    typescript: ['//', '/*'],
    python: ['#'],
    java: ['//', '/*'],
    csharp: ['//', '/*'],
    cpp: ['//', '/*'],
    c: ['//', '/*'],
    go: ['//', '/*'],
    rust: ['//', '/*'],
    php: ['//', '/*', '#'],
    ruby: ['#'],
    bash: ['#'],
    yaml: ['#'],
    dockerfile: ['#']
  };

  const prefixes = commentPrefixes[language] || [];
  const trimmedLine = textBeforeCursor.trim();
  
  return prefixes.some(prefix => trimmedLine.startsWith(prefix));
}

/**
 * Extract imports/includes from document
 */
export function extractImports(document: vscode.TextDocument): string[] {
  const language = getLanguageFromDocument(document);
  const text = document.getText();
  const imports: string[] = [];

  const importPatterns: Record<string, RegExp[]> = {
    javascript: [
      /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g,
      /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g
    ],
    typescript: [
      /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g,
      /import\s+['"`]([^'"`]+)['"`]/g
    ],
    python: [
      /import\s+(\w+)/g,
      /from\s+(\w+)\s+import/g
    ],
    java: [
      /import\s+([\w.]+);/g
    ],
    csharp: [
      /using\s+([\w.]+);/g
    ],
    go: [
      /import\s+['"`]([^'"`]+)['"`]/g
    ]
  };

  const patterns = importPatterns[language] || [];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      imports.push(match[1]);
    }
  }

  return imports;
}

/**
 * Get code complexity metrics
 */
export function getCodeComplexity(code: string, language: string): {
  cyclomaticComplexity: number;
  linesOfCode: number;
  functions: number;
  classes: number;
} {
  const lines = code.split('\n').filter(line => line.trim().length > 0);
  
  // Simple complexity calculation
  const complexityKeywords = ['if', 'else', 'for', 'while', 'switch', 'case', 'catch', 'try'];
  let complexity = 1; // Base complexity
  
  for (const line of lines) {
    for (const keyword of complexityKeywords) {
      if (line.includes(keyword)) {
        complexity++;
      }
    }
  }

  // Count functions and classes (basic regex)
  const functionCount = (code.match(/function\s+\w+|def\s+\w+|public\s+\w+\s+\w+\s*\(/g) || []).length;
  const classCount = (code.match(/class\s+\w+/g) || []).length;

  return {
    cyclomaticComplexity: complexity,
    linesOfCode: lines.length,
    functions: functionCount,
    classes: classCount
  };
}

/**
 * Format code using language-specific rules
 */
export function formatCodeSuggestion(code: string, language: string): string {
  // Basic formatting improvements
  let formatted = code;

  // Remove excessive blank lines
  formatted = formatted.replace(/\n\s*\n\s*\n/g, '\n\n');

  // Ensure proper indentation (basic)
  const lines = formatted.split('\n');
  let indentLevel = 0;
  const indentSize = language === 'python' ? 4 : 2;
  
  const formattedLines = lines.map(line => {
    const trimmed = line.trim();
    
    if (trimmed.endsWith('{') || trimmed.endsWith(':')) {
      const result = ' '.repeat(indentLevel * indentSize) + trimmed;
      indentLevel++;
      return result;
    } else if (trimmed.startsWith('}') || (language === 'python' && line.match(/^\s*(except|finally|else|elif):/))) {
      indentLevel = Math.max(0, indentLevel - 1);
      return ' '.repeat(indentLevel * indentSize) + trimmed;
    } else if (trimmed) {
      return ' '.repeat(indentLevel * indentSize) + trimmed;
    } else {
      return '';
    }
  });

  return formattedLines.join('\n');
}

/**
 * Detect if code snippet is complete
 */
export function isCodeComplete(code: string, language: string): boolean {
  // Basic checks for code completeness
  const openBraces = (code.match(/{/g) || []).length;
  const closeBraces = (code.match(/}/g) || []).length;
  const openParens = (code.match(/\(/g) || []).length;
  const closeParens = (code.match(/\)/g) || []).length;
  const openBrackets = (code.match(/\[/g) || []).length;
  const closeBrackets = (code.match(/\]/g) || []).length;

  // Check if brackets are balanced
  if (openBraces !== closeBraces || openParens !== closeParens || openBrackets !== closeBrackets) {
    return false;
  }

  // Language-specific checks
  if (language === 'python') {
    // Check for unfinished control structures
    const lines = code.split('\n');
    const lastLine = lines[lines.length - 1]?.trim();
    if (lastLine?.endsWith(':')) {
      return false; // Incomplete Python block
    }
  }

  return true;
}