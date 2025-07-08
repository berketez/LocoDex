import * as vscode from 'vscode';
import { LocoDexApiClient } from '../api/locodexClient';
import { CompletionRequest, CodeContext, CompletionResponse } from '../types';
import { getCodeContext, getLanguageFromDocument } from '../utils/codeUtils';

export class LocoDexCompletionProvider implements vscode.InlineCompletionItemProvider {
  private client: LocoDexApiClient;
  private isEnabled: boolean = true;
  private cancellationTokens: Set<vscode.CancellationToken> = new Set();
  private lastNetworkError: number = 0;

  constructor(client: LocoDexApiClient) {
    this.client = client;
  }

  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[] | vscode.InlineCompletionList | null> {
    
    if (!this.isEnabled) {
      return null;
    }

    // Check if user is actively typing
    if (context.triggerKind === vscode.InlineCompletionTriggerKind.Automatic) {
      // Add small delay for automatic triggers to avoid too many requests
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    if (token.isCancellationRequested) {
      return null;
    }

    try {
      this.cancellationTokens.add(token);

      // Get current line and cursor position
      const currentLine = document.lineAt(position.line);
      const textBeforeCursor = currentLine.text.substring(0, position.character);
      const textAfterCursor = currentLine.text.substring(position.character);

      // Skip completion for certain cases
      if (this.shouldSkipCompletion(textBeforeCursor, document, position)) {
        return null;
      }

      // Get broader context
      const codeContext = getCodeContext(document, position);
      
      // Create completion request
      const prompt = this.buildCompletionPrompt(document, position, codeContext);
      
      const completionRequest: CompletionRequest = {
        prompt,
        context: codeContext,
        maxTokens: 150, // Smaller for inline completions
        temperature: 0.1, // Low temperature for more predictable completions
        stop: ['\n\n', '```', '\n}', '\n)', '\n]']
      };

      // Get completion from API
      const completion = await this.client.getCodeCompletion(completionRequest);
      
      if (token.isCancellationRequested) {
        return null;
      }

      // Process and clean the completion
      const cleanedCompletion = this.cleanCompletion(completion.completion, textAfterCursor);
      
      if (!cleanedCompletion || cleanedCompletion.trim().length === 0) {
        return null;
      }

      // Create inline completion item
      const item = new vscode.InlineCompletionItem(
        cleanedCompletion,
        new vscode.Range(position, position)
      );

      // Add command to accept completion
      item.command = {
        command: 'locodex.acceptCompletion',
        title: 'Accept LocoDex Completion',
        arguments: [completion]
      };

      return [item];

    } catch (error) {
      console.error('[LocoDex] Completion error:', error);
      
      // Show user-friendly error for different error types
      if ((error as any).message?.includes('Network error') || (error as any).code === 'ECONNREFUSED') {
        // Only show this error once per 30 seconds to avoid spam
        const now = Date.now();
        if (now - this.lastNetworkError > 30000) {
          this.lastNetworkError = now;
          vscode.window.showWarningMessage(
            'LocoDex AI servisine bağlanılamıyor. Servislerin çalıştığından emin olun.',
            'Ayarları Kontrol Et',
            'Health Check'
          ).then(selection => {
            if (selection === 'Ayarları Kontrol Et') {
              vscode.commands.executeCommand('locodex.configure');
            } else if (selection === 'Health Check') {
              vscode.commands.executeCommand('locodex.healthCheck');
            }
          });
        }
      } else if ((error as any).message?.includes('timeout')) {
        vscode.window.showWarningMessage(
          'LocoDex AI yanıt vermiyor. Timeout süresi doldu.',
          'Tekrar Dene'
        );
      } else if ((error as any).message?.includes('Model not found')) {
        vscode.window.showErrorMessage(
          'Seçili AI modeli bulunamadı. Lütfen başka bir model seçin.',
          'Model Seç'
        ).then(selection => {
          if (selection === 'Model Seç') {
            vscode.commands.executeCommand('locodex.selectModel');
          }
        });
      }
      
      return null;
    } finally {
      this.cancellationTokens.delete(token);
    }
  }

  private shouldSkipCompletion(textBeforeCursor: string, document: vscode.TextDocument, position: vscode.Position): boolean {
    // Skip if in comment
    if (this.isInComment(textBeforeCursor, document.languageId)) {
      return true;
    }

    // Skip if in string literal
    if (this.isInStringLiteral(textBeforeCursor)) {
      return true;
    }

    // Skip if line is very short (less than 2 characters)
    if (textBeforeCursor.trim().length < 2) {
      return true;
    }

    // Skip if cursor is at beginning of line and line is empty
    if (position.character === 0 && textBeforeCursor.trim() === '') {
      return true;
    }

    return false;
  }

  private isInComment(textBeforeCursor: string, languageId: string): boolean {
    const commentPrefixes = {
      'javascript': ['//', '/*'],
      'typescript': ['//', '/*'],
      'python': ['#'],
      'java': ['//', '/*'],
      'csharp': ['//', '/*'],
      'cpp': ['//', '/*'],
      'c': ['//', '/*'],
      'go': ['//', '/*'],
      'rust': ['//', '/*'],
      'php': ['//', '/*', '#'],
      'ruby': ['#'],
      'bash': ['#'],
      'yaml': ['#'],
      'dockerfile': ['#']
    };

    const prefixes = commentPrefixes[languageId as keyof typeof commentPrefixes] || [];
    const trimmedLine = textBeforeCursor.trim();
    
    return prefixes.some(prefix => trimmedLine.startsWith(prefix));
  }

  private isInStringLiteral(textBeforeCursor: string): boolean {
    // Simple check for string literals
    const singleQuotes = (textBeforeCursor.match(/'/g) || []).length;
    const doubleQuotes = (textBeforeCursor.match(/"/g) || []).length;
    const backticks = (textBeforeCursor.match(/`/g) || []).length;

    return (singleQuotes % 2 === 1) || (doubleQuotes % 2 === 1) || (backticks % 2 === 1);
  }

  private buildCompletionPrompt(
    document: vscode.TextDocument,
    position: vscode.Position,
    codeContext: CodeContext
  ): string {
    const language = codeContext.language;
    const currentLine = document.lineAt(position.line);
    const textBeforeCursor = currentLine.text.substring(0, position.character);
    
    // Get surrounding context (lines before and after)
    const contextLines = 5;
    const startLine = Math.max(0, position.line - contextLines);
    const endLine = Math.min(document.lineCount - 1, position.line + contextLines);
    
    let contextBefore = '';
    let contextAfter = '';
    
    // Lines before current line
    for (let i = startLine; i < position.line; i++) {
      contextBefore += document.lineAt(i).text + '\n';
    }
    
    // Lines after current line
    for (let i = position.line + 1; i <= endLine; i++) {
      contextAfter += document.lineAt(i).text + '\n';
    }

    // Build the prompt
    const prompt = `// Language: ${language}
// File: ${codeContext.filePath}
// Context: Code completion

${contextBefore}${textBeforeCursor}`;

    return prompt;
  }

  private cleanCompletion(completion: string, textAfterCursor: string): string {
    if (!completion) return '';

    // Remove common prefixes that might be duplicated
    let cleaned = completion;

    // Remove leading/trailing whitespace
    cleaned = cleaned.trim();

    // If completion starts with the same text that's already after cursor, remove it
    if (textAfterCursor && cleaned.startsWith(textAfterCursor.trim())) {
      cleaned = cleaned.substring(textAfterCursor.trim().length);
    }

    // Remove code block markers if present
    cleaned = cleaned.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');

    // Remove duplicate line breaks
    cleaned = cleaned.replace(/\n\n+/g, '\n');

    // If completion ends with incomplete line, try to complete it properly
    if (cleaned.endsWith('(') || cleaned.endsWith('[') || cleaned.endsWith('{')) {
      // For now, just return as is - could be enhanced to auto-close
    }

    // Limit completion length for inline suggestions
    const lines = cleaned.split('\n');
    if (lines.length > 3) {
      cleaned = lines.slice(0, 3).join('\n');
    }

    return cleaned;
  }

  // Cancel all pending requests
  public cancelAllRequests() {
    this.cancellationTokens.forEach(token => {
      if (!token.isCancellationRequested) {
        // Note: We can't actually cancel the token, but we track them
        // to avoid processing responses for cancelled requests
      }
    });
    this.cancellationTokens.clear();
  }

  public dispose() {
    this.cancelAllRequests();
  }
}

// Multi-line completion provider for more complex scenarios
export class LocoDexMultiLineCompletionProvider implements vscode.CodeActionProvider {
  private client: LocoDexApiClient;

  constructor(client: LocoDexApiClient) {
    this.client = client;
  }

  async provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeAction[]> {
    
    const actions: vscode.CodeAction[] = [];

    // Only provide actions when there's a selection
    if (range.isEmpty) {
      return actions;
    }

    const selectedText = document.getText(range);
    
    // Complete function/method action
    const completeAction = new vscode.CodeAction(
      '🤖 LocoDex ile Tamamla',
      vscode.CodeActionKind.Refactor
    );
    
    completeAction.command = {
      command: 'locodex.completeCode',
      title: 'Complete Code',
      arguments: [document, range]
    };

    actions.push(completeAction);

    return actions;
  }
}