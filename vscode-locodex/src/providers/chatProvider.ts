import * as vscode from 'vscode';
import { LocoDexApiClient } from '../api/locodexClient';
import { ChatMessage, ChatSession } from '../types';
import { getCodeContext, getSelectedTextOrCurrentLine } from '../utils/codeUtils';

export class LocoDexChatProvider {
  private client: LocoDexApiClient;
  private currentSession: ChatSession | null = null;
  private sessions: ChatSession[] = [];
  private webviewPanel: vscode.WebviewPanel | null = null;
  private context: vscode.ExtensionContext | null = null;

  constructor(client: LocoDexApiClient) {
    this.client = client;
  }

  async showChatPanel(context: vscode.ExtensionContext) {
    this.context = context;
    
    if (this.webviewPanel) {
      this.webviewPanel.reveal();
      return;
    }
    
    // Load saved sessions first
    this.loadSessions();

    this.webviewPanel = vscode.window.createWebviewPanel(
      'locodexChat',
      '💬 LocoDex AI Chat',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'resources'),
          vscode.Uri.joinPath(context.extensionUri, 'out')
        ]
      }
    );

    this.webviewPanel.webview.html = this.getWebviewContent(context);

    // Handle messages from webview
    this.webviewPanel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case 'sendMessage':
            await this.handleSendMessage(message.text, message.includeCode);
            break;
          case 'newSession':
            this.createNewSession();
            break;
          case 'loadSession':
            this.loadSession(message.sessionId);
            break;
          case 'deleteSession':
            this.deleteSession(message.sessionId);
            break;
          case 'exportChat':
            this.exportChat();
            break;
        }
      },
      undefined,
      context.subscriptions
    );

    this.webviewPanel.onDidDispose(() => {
      this.webviewPanel = null;
    });

    // Create initial session if none exists
    if (!this.currentSession) {
      this.createNewSession();
    }

    this.updateWebview();
  }

  private async handleSendMessage(text: string, includeCode: boolean = false) {
    if (!this.currentSession || !text.trim()) {
      return;
    }

    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date()
    };

    // Include code context if requested
    if (includeCode) {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const { text: selectedText } = getSelectedTextOrCurrentLine(editor);
        const context = getCodeContext(editor.document, editor.selection.active);
        
        userMessage.content += `\n\n**Kod Kontext:**\n\`\`\`${context.language}\n${selectedText}\n\`\`\``;
      }
    }

    this.currentSession.messages.push(userMessage);
    this.updateWebview();

    try {
      // Send to AI
      const assistantMessage = await this.client.sendChatMessage(
        this.currentSession.messages,
        undefined,
        { temperature: 0.3, maxTokens: 1500 }
      );

      this.currentSession.messages.push(assistantMessage);
      this.currentSession.updated = new Date();
      
      this.updateWebview();
      this.saveSessions();

    } catch (error) {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `❌ Hata: ${(error as any).message}`,
        timestamp: new Date()
      };
      
      this.currentSession.messages.push(errorMessage);
      this.updateWebview();
    }
  }

  private createNewSession() {
    const session: ChatSession = {
      id: Date.now().toString(),
      title: `Chat ${new Date().toLocaleTimeString('tr-TR')}`,
      messages: [
        {
          role: 'assistant',
          content: '👋 Merhaba! Ben LocoDex AI asistanınızım. Size nasıl yardımcı olabilirim?\n\n💡 **İpucu:** Kod seçip "Kodu Dahil Et" butonuna basarak kodunuz hakkında soru sorabilirsiniz.',
          timestamp: new Date()
        }
      ],
      model: this.client['config'].model || 'default',
      created: new Date(),
      updated: new Date()
    };

    this.sessions.unshift(session);
    this.currentSession = session;
    this.updateWebview();
  }

  private loadSession(sessionId: string) {
    const session = this.sessions.find(s => s.id === sessionId);
    if (session) {
      this.currentSession = session;
      this.updateWebview();
    }
  }

  private deleteSession(sessionId: string) {
    this.sessions = this.sessions.filter(s => s.id !== sessionId);
    
    if (this.currentSession?.id === sessionId) {
      this.currentSession = this.sessions[0] || null;
      if (!this.currentSession) {
        this.createNewSession();
      }
    }
    
    this.updateWebview();
    this.saveSessions();
  }

  private async exportChat() {
    if (!this.currentSession) return;

    const content = this.currentSession.messages
      .map(msg => `**${msg.role.toUpperCase()}** (${msg.timestamp.toLocaleString('tr-TR')}):\n${msg.content}\n`)
      .join('\n---\n\n');

    const document = await vscode.workspace.openTextDocument({
      content: `# LocoDex Chat Export\n\n**Session:** ${this.currentSession.title}\n**Created:** ${this.currentSession.created.toLocaleString('tr-TR')}\n**Model:** ${this.currentSession.model}\n\n---\n\n${content}`,
      language: 'markdown'
    });

    await vscode.window.showTextDocument(document);
  }

  private updateWebview() {
    if (!this.webviewPanel) return;

    this.webviewPanel.webview.postMessage({
      type: 'updateChat',
      currentSession: this.currentSession,
      sessions: this.sessions.map(s => ({
        id: s.id,
        title: s.title,
        created: s.created,
        messageCount: s.messages.length
      }))
    });
  }

  private saveSessions() {
    try {
      // Save to VS Code global state if available
      if (this.context && this.context.globalState) {
        this.context.globalState.update('locodex.chatSessions', this.sessions);
      }
    } catch (error) {
      console.error('[LocoDex] Failed to save sessions:', error);
    }
  }

  private loadSessions() {
    try {
      // Load from VS Code global state if available
      if (this.context && this.context.globalState) {
        const saved = this.context.globalState.get<ChatSession[]>('locodex.chatSessions');
        if (saved && Array.isArray(saved)) {
          this.sessions = saved.map(session => ({
            ...session,
            created: new Date(session.created),
            updated: new Date(session.updated),
            messages: session.messages.map(msg => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            }))
          }));
        }
      }
    } catch (error) {
      console.error('[LocoDex] Failed to load sessions:', error);
    }
  }

  private getWebviewContent(context: vscode.ExtensionContext): string {
    const resourcePath = vscode.Uri.joinPath(context.extensionUri, 'resources');
    const resourceUri = this.webviewPanel!.webview.asWebviewUri(resourcePath);

    return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LocoDex AI Chat</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .header {
      background: var(--vscode-titleBar-activeBackground);
      color: var(--vscode-titleBar-activeForeground);
      padding: 12px 16px;
      border-bottom: 1px solid var(--vscode-panel-border);
      display: flex;
      justify-content: between;
      align-items: center;
    }

    .header h1 {
      font-size: 16px;
      font-weight: 600;
    }

    .header-buttons {
      display: flex;
      gap: 8px;
    }

    .btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }

    .btn:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .btn-secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    .btn-secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .chat-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      scroll-behavior: smooth;
    }

    .message {
      margin-bottom: 16px;
      max-width: 100%;
    }

    .message-user {
      margin-left: 20%;
    }

    .message-assistant {
      margin-right: 20%;
    }

    .message-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }

    .message-content {
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 8px;
      padding: 12px;
      line-height: 1.5;
    }

    .message-user .message-content {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    .input-container {
      border-top: 1px solid var(--vscode-panel-border);
      padding: 16px;
      background: var(--vscode-editor-background);
    }

    .input-row {
      display: flex;
      gap: 8px;
      align-items: flex-end;
    }

    .input-field {
      flex: 1;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      padding: 8px 12px;
      font-size: 14px;
      resize: vertical;
      min-height: 36px;
      max-height: 120px;
    }

    .input-options {
      display: flex;
      gap: 12px;
      margin-bottom: 8px;
      align-items: center;
      font-size: 12px;
    }

    .checkbox {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .sessions-sidebar {
      width: 200px;
      background: var(--vscode-sideBar-background);
      border-right: 1px solid var(--vscode-panel-border);
      padding: 8px;
      overflow-y: auto;
    }

    .session-item {
      padding: 8px;
      border-radius: 4px;
      cursor: pointer;
      margin-bottom: 4px;
      font-size: 12px;
    }

    .session-item:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .session-item.active {
      background: var(--vscode-list-activeSelectionBackground);
      color: var(--vscode-list-activeSelectionForeground);
    }

    .session-title {
      font-weight: 500;
      margin-bottom: 2px;
    }

    .session-meta {
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
    }

    pre {
      background: var(--vscode-textCodeBlock-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 12px;
      overflow-x: auto;
      margin: 8px 0;
    }

    code {
      background: var(--vscode-textCodeBlock-background);
      padding: 2px 4px;
      border-radius: 3px;
      font-family: 'SF Mono', Monaco, 'Roboto Mono', monospace;
    }

    .loading {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }

    .spinner {
      width: 12px;
      height: 12px;
      border: 2px solid var(--vscode-progressBar-background);
      border-top: 2px solid var(--vscode-button-background);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .main-content {
      display: flex;
      flex: 1;
      overflow: hidden;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>💬 LocoDex AI Chat</h1>
    <div class="header-buttons">
      <button class="btn btn-secondary" onclick="newSession()">+ Yeni Chat</button>
      <button class="btn btn-secondary" onclick="exportChat()">📤 Dışa Aktar</button>
    </div>
  </div>

  <div class="main-content">
    <div class="sessions-sidebar">
      <div id="sessions-list"></div>
    </div>

    <div class="chat-container">
      <div class="messages" id="messages"></div>
      
      <div class="input-container">
        <div class="input-options">
          <label class="checkbox">
            <input type="checkbox" id="includeCode"> Kodu Dahil Et
          </label>
        </div>
        <div class="input-row">
          <textarea class="input-field" id="messageInput" 
                   placeholder="Mesajınızı yazın... (Ctrl+Enter ile gönder)"
                   onkeydown="handleKeyDown(event)"></textarea>
          <button class="btn" onclick="sendMessage()">Gönder</button>
        </div>
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentSession = null;
    let sessions = [];

    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.type) {
        case 'updateChat':
          currentSession = message.currentSession;
          sessions = message.sessions;
          renderMessages();
          renderSessions();
          break;
      }
    });

    function renderMessages() {
      const messagesDiv = document.getElementById('messages');
      if (!currentSession) {
        messagesDiv.innerHTML = '<div class="loading">Chat yükleniyor...</div>';
        return;
      }

      messagesDiv.innerHTML = currentSession.messages.map(msg => \`
        <div class="message message-\${msg.role}">
          <div class="message-header">
            <strong>\${msg.role === 'user' ? '👤 Siz' : '🤖 LocoDex'}</strong>
            <span>\${new Date(msg.timestamp).toLocaleTimeString('tr-TR')}</span>
          </div>
          <div class="message-content">\${formatMessage(msg.content)}</div>
        </div>
      \`).join('');

      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    function renderSessions() {
      const sessionsList = document.getElementById('sessions-list');
      sessionsList.innerHTML = sessions.map(session => \`
        <div class="session-item \${currentSession && session.id === currentSession.id ? 'active' : ''}"
             onclick="loadSession('\${session.id}')">
          <div class="session-title">\${session.title}</div>
          <div class="session-meta">\${session.messageCount} mesaj</div>
        </div>
      \`).join('');
    }

    function formatMessage(content) {
      // Basic markdown formatting
      return content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\`\`\`(\w+)?\n([\s\S]*?)\`\`\`/g, '<pre><code>$2</code></pre>')
        .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
    }

    function sendMessage() {
      const input = document.getElementById('messageInput');
      const includeCode = document.getElementById('includeCode').checked;
      const text = input.value.trim();
      
      if (!text) return;

      vscode.postMessage({
        type: 'sendMessage',
        text: text,
        includeCode: includeCode
      });

      input.value = '';
      input.style.height = 'auto';
    }

    function newSession() {
      vscode.postMessage({ type: 'newSession' });
    }

    function loadSession(sessionId) {
      vscode.postMessage({ type: 'loadSession', sessionId });
    }

    function exportChat() {
      vscode.postMessage({ type: 'exportChat' });
    }

    function handleKeyDown(event) {
      if (event.key === 'Enter' && event.ctrlKey) {
        sendMessage();
        event.preventDefault();
      }
    }

    // Auto-resize textarea
    document.getElementById('messageInput').addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = this.scrollHeight + 'px';
    });
  </script>
</body>
</html>`;
  }

  async explainCode(editor: vscode.TextEditor) {
    const { text, range } = getSelectedTextOrCurrentLine(editor);
    const context = getCodeContext(editor.document, range.start);

    try {
      const explanation = await this.client.explainCode(text, context);
      
      // Show in chat if panel is open, otherwise show in new document
      if (this.webviewPanel && this.currentSession) {
        const message: ChatMessage = {
          role: 'assistant',
          content: `## Kod Açıklaması\n\n**Kod:**\n\`\`\`${context.language}\n${text}\n\`\`\`\n\n**Açıklama:**\n${explanation}`,
          timestamp: new Date()
        };
        
        this.currentSession.messages.push(message);
        this.updateWebview();
      } else {
        const document = await vscode.workspace.openTextDocument({
          content: `# Kod Açıklaması\n\n## Orijinal Kod\n\`\`\`${context.language}\n${text}\n\`\`\`\n\n## Açıklama\n\n${explanation}`,
          language: 'markdown'
        });
        
        await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Kod açıklama hatası: ${(error as any).message}`);
    }
  }

  dispose() {
    if (this.webviewPanel) {
      this.webviewPanel.dispose();
    }
  }
}