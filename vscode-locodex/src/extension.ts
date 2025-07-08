import * as vscode from 'vscode';
import { LocoDexApiClient } from './api/locodexClient';
import { LocoDexCompletionProvider, LocoDexMultiLineCompletionProvider } from './providers/completionProvider';
import { LocoDexChatProvider } from './providers/chatProvider';
import { LocoDexSecurityProvider } from './providers/securityProvider';
import { LocoDexCodeReviewProvider } from './providers/codeReviewProvider';
import { ConfigurationProvider } from './config/configurationProvider';
import { getCodeContext, getSelectedTextOrCurrentLine } from './utils/codeUtils';
import { LocoDexConfig, ExtensionState } from './types';

// Global state
let extensionState: ExtensionState;
let apiClient: LocoDexApiClient;
let completionProvider: LocoDexCompletionProvider;
let chatProvider: LocoDexChatProvider;
let securityProvider: LocoDexSecurityProvider;
let codeReviewProvider: LocoDexCodeReviewProvider;
let configurationProvider: ConfigurationProvider;

export function activate(context: vscode.ExtensionContext) {
  console.log('🚀 LocoDex AI Code Assistant is now active!');

  // Initialize extension state
  extensionState = {
    isActivated: true,
    currentModel: null,
    chatSessions: [],
    config: getConfiguration(),
    providerStatus: {}
  };

  // Initialize API client
  apiClient = new LocoDexApiClient(extensionState.config);

  // Initialize providers
  completionProvider = new LocoDexCompletionProvider(apiClient);
  chatProvider = new LocoDexChatProvider(apiClient);
  securityProvider = new LocoDexSecurityProvider(apiClient);
  codeReviewProvider = new LocoDexCodeReviewProvider(apiClient);
  configurationProvider = new ConfigurationProvider(apiClient);

  // Register providers
  registerProviders(context);

  // Register commands
  registerCommands(context);

  // Register event listeners
  registerEventListeners(context);

  // Show welcome message
  showWelcomeMessage();

  // Check service health
  checkServiceHealth();
}

function getConfiguration(): LocoDexConfig {
  const config = vscode.workspace.getConfiguration('locodex');
  
  return {
    apiEndpoint: config.get('apiEndpoint', 'http://localhost:8000'),
    vllmEndpoint: config.get('vllmEndpoint', 'http://localhost:8080'),
    preferredProvider: config.get('preferredProvider', 'auto'),
    model: config.get('model', 'llama3-8b-instruct'),
    maxTokens: config.get('maxTokens', 1500),
    temperature: config.get('temperature', 0.3),
    enableInlineCompletion: config.get('enableInlineCompletion', true),
    enableSecurityScan: config.get('enableSecurityScan', true),
    enableCodeReview: config.get('enableCodeReview', true),
    autoSaveChat: config.get('autoSaveChat', true),
    securityLevel: config.get('securityLevel', 'high'),
    enableTelemetry: config.get('enableTelemetry', false),
    codeLanguages: config.get('codeLanguages', [
      'javascript', 'typescript', 'python', 'java', 'go', 'rust', 'cpp', 'c', 'csharp'
    ])
  };
}

function registerProviders(context: vscode.ExtensionContext) {
  // Inline completion provider
  if (extensionState.config.enableInlineCompletion) {
    const completionDisposable = vscode.languages.registerInlineCompletionItemProvider(
      { pattern: '**' },
      completionProvider
    );
    context.subscriptions.push(completionDisposable);
  }

  // Multi-line completion provider
  const multiLineCompletionProvider = new LocoDexMultiLineCompletionProvider(apiClient);
  const multiLineDisposable = vscode.languages.registerCodeActionsProvider(
    { pattern: '**' },
    multiLineCompletionProvider
  );
  context.subscriptions.push(multiLineDisposable);

  // Security provider
  if (extensionState.config.enableSecurityScan) {
    const securityDisposable = vscode.languages.registerCodeActionsProvider(
      { pattern: '**' },
      securityProvider
    );
    context.subscriptions.push(securityDisposable);
  }

  // Code review provider
  if (extensionState.config.enableCodeReview) {
    const reviewDisposable = vscode.languages.registerCodeActionsProvider(
      { pattern: '**' },
      codeReviewProvider
    );
    context.subscriptions.push(reviewDisposable);
  }
}

function registerCommands(context: vscode.ExtensionContext) {
  // Chat commands
  const chatCommand = vscode.commands.registerCommand('locodex.openChat', () => {
    chatProvider.showChatPanel(context);
  });

  const explainCommand = vscode.commands.registerCommand('locodex.explain', () => {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      chatProvider.explainCode(editor);
    }
  });

  // Eksik komutları ekle
  const optimizeCommand = vscode.commands.registerCommand('locodex.optimize', 
    (document?: vscode.TextDocument, range?: vscode.Range) => {
      vscode.commands.executeCommand('locodex.optimizeCode', document, range);
    }
  );

  const reviewCommand = vscode.commands.registerCommand('locodex.review', 
    (document?: vscode.TextDocument, range?: vscode.Range) => {
      vscode.commands.executeCommand('locodex.codeReview', document, range);
    }
  );

  const generateTestsCommand = vscode.commands.registerCommand('locodex.generateTests', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Lütfen bir kod dosyası açın.');
      return;
    }

    try {
      const { text, range } = getSelectedTextOrCurrentLine(editor);
      const context = getCodeContext(editor.document, range.start);
      
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: '🧪 Test oluşturuluyor...',
          cancellable: true
        },
        async (progress) => {
          progress.report({ increment: 50 });
          const result = await apiClient.generateTests(text, context);
          progress.report({ increment: 100 });
          
          // Create new document with tests
          const testCode = result.tests.map(test => test.code).join('\n\n');
          const document = await vscode.workspace.openTextDocument({
            content: `// Generated Tests\n\n${testCode}`,
            language: context.language
          });
          
          await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);
        }
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Test oluşturma hatası: ${(error as any).message}`);
    }
  });

  const generateDocumentationCommand = vscode.commands.registerCommand('locodex.generateDocumentation', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Lütfen bir kod dosyası açın.');
      return;
    }

    try {
      const { text, range } = getSelectedTextOrCurrentLine(editor);
      const context = getCodeContext(editor.document, range.start);
      
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: '📝 Dokümantasyon oluşturuluyor...',
          cancellable: true
        },
        async (progress) => {
          progress.report({ increment: 50 });
          const result = await apiClient.generateDocumentation(text, context);
          progress.report({ increment: 100 });
          
          // Create markdown documentation
          let docContent = `# Kod Dokümantasyonu\n\n${result.overview}\n\n`;
          
          if (result.functions.length > 0) {
            docContent += '## Fonksiyonlar\n\n';
            result.functions.forEach(func => {
              docContent += `### ${func.name}\n\n${func.description}\n\n`;
              if (func.parameters.length > 0) {
                docContent += '**Parametreler:**\n';
                func.parameters.forEach(param => {
                  docContent += `- \`${param.name}\` (${param.type}): ${param.description}\n`;
                });
                docContent += '\n';
              }
              docContent += `**Dönüş:** ${func.returns.type} - ${func.returns.description}\n\n`;
            });
          }
          
          const document = await vscode.workspace.openTextDocument({
            content: docContent,
            language: 'markdown'
          });
          
          await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);
        }
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Dokümantasyon oluşturma hatası: ${(error as any).message}`);
    }
  });

  const fixIssuesCommand = vscode.commands.registerCommand('locodex.fixIssues', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Lütfen bir kod dosyası açın.');
      return;
    }

    const issues = await vscode.window.showInputBox({
      prompt: 'Düzeltilecek sorunları açıklayın',
      placeHolder: 'Örn: performans sorunları, syntax hataları, best practices'
    });

    if (!issues) return;

    try {
      const code = editor.document.getText();
      const context = getCodeContext(editor.document, editor.selection.start);
      
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: '🔧 Sorunlar düzeltiliyor...',
          cancellable: false
        },
        async (progress) => {
          progress.report({ increment: 50 });
          const fixedCode = await apiClient.fixIssues(code, issues, context);
          progress.report({ increment: 100 });
          
          // Replace current content
          const fullRange = new vscode.Range(
            new vscode.Position(0, 0),
            new vscode.Position(editor.document.lineCount, 0)
          );
          
          await editor.edit(editBuilder => {
            editBuilder.replace(fullRange, fixedCode);
          });
          
          vscode.window.showInformationMessage('✅ Sorunlar düzeltildi!');
        }
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Sorun düzeltme hatası: ${(error as any).message}`);
    }
  });

  const selectProviderCommand = vscode.commands.registerCommand('locodex.selectProvider', async () => {
    const providers = [
      { label: '🤖 Otomatik', detail: 'En uygun provider\'ı otomatik seç', value: 'auto' },
      { label: '🦙 Ollama', detail: 'Yerel Ollama servisi', value: 'ollama' },
      { label: '🏠 LM Studio', detail: 'LM Studio local server', value: 'lmstudio' },
      { label: '⚡ vLLM', detail: 'Yüksek performans vLLM servisi', value: 'vllm' }
    ];

    const selected = await vscode.window.showQuickPick(providers, {
      placeHolder: 'AI model provider seçin'
    });

    if (selected) {
      const config = vscode.workspace.getConfiguration('locodex');
      await config.update('preferredProvider', selected.value, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`Provider değiştirildi: ${selected.label}`);
    }
  });

  const toggleInlineCompletionCommand = vscode.commands.registerCommand('locodex.toggleInlineCompletion', () => {
    vscode.commands.executeCommand('locodex.toggleCompletion');
  });

  // Completion commands
  const toggleCompletionCommand = vscode.commands.registerCommand('locodex.toggleCompletion', () => {
    const newState = !completionProvider['isEnabled'];
    completionProvider.setEnabled(newState);
    vscode.window.showInformationMessage(
      `LocoDex kod tamamlama ${newState ? 'etkinleştirildi' : 'devre dışı bırakıldı'}`
    );
  });

  const completeCodeCommand = vscode.commands.registerCommand('locodex.completeCode', 
    (document: vscode.TextDocument, range: vscode.Range) => {
      // Handle multi-line completion
      vscode.window.showInformationMessage('Kod tamamlama özelliği geliştiriliyor...');
    }
  );

  const acceptCompletionCommand = vscode.commands.registerCommand('locodex.acceptCompletion', 
    (completion: any) => {
      // Handle completion acceptance
      console.log('Completion accepted:', completion);
    }
  );

  // Security commands
  const securityScanCommand = vscode.commands.registerCommand('locodex.securityScan', 
    (document?: vscode.TextDocument, range?: vscode.Range) => {
      const targetDocument = document || vscode.window.activeTextEditor?.document;
      if (targetDocument) {
        securityProvider.scanDocument(targetDocument, range);
      }
    }
  );

  const scanWorkspaceCommand = vscode.commands.registerCommand('locodex.scanWorkspace', () => {
    securityProvider.scanWorkspace();
  });

  const fixSecurityCommand = vscode.commands.registerCommand('locodex.fixSecurityIssues', 
    (document: vscode.TextDocument, issues: any[]) => {
      securityProvider.fixSecurityIssues(document, issues);
    }
  );

  // Code review commands
  const codeReviewCommand = vscode.commands.registerCommand('locodex.codeReview', 
    (document?: vscode.TextDocument, range?: vscode.Range) => {
      const targetDocument = document || vscode.window.activeTextEditor?.document;
      if (targetDocument) {
        codeReviewProvider.reviewCode(targetDocument, range);
      }
    }
  );

  const optimizeCodeCommand = vscode.commands.registerCommand('locodex.optimizeCode', 
    (document?: vscode.TextDocument, range?: vscode.Range) => {
      const targetDocument = document || vscode.window.activeTextEditor?.document;
      if (targetDocument) {
        codeReviewProvider.optimizeCode(targetDocument, range);
      }
    }
  );

  const fixReviewCommand = vscode.commands.registerCommand('locodex.fixReviewIssues', 
    (document: vscode.TextDocument, issues: any[]) => {
      codeReviewProvider.fixReviewIssues(document, issues);
    }
  );

  // Configuration commands
  const configureCommand = vscode.commands.registerCommand('locodex.configure', () => {
    configurationProvider.showConfigurationUI(context);
  });

  const openSettingsCommand = vscode.commands.registerCommand('locodex.openSettings', () => {
    vscode.commands.executeCommand('workbench.action.openSettings', 'locodex');
  });

  const selectModelCommand = vscode.commands.registerCommand('locodex.selectModel', async () => {
    try {
      const models = await apiClient.getAvailableModels();
      
      if (models.length === 0) {
        vscode.window.showWarningMessage('Kullanılabilir model bulunamadı. Servislerin çalıştığından emin olun.');
        return;
      }

      const items = models.map(model => ({
        label: model.name,
        description: model.provider,
        detail: `Status: ${model.status}`,
        model
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Kullanılacak modeli seçin'
      });

      if (selected) {
        const config = vscode.workspace.getConfiguration('locodex');
        await config.update('model', selected.model.id, vscode.ConfigurationTarget.Global);
        extensionState.currentModel = selected.model;
        vscode.window.showInformationMessage(`Model değiştirildi: ${selected.model.name}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Model seçimi hatası: ${(error as any).message}`);
    }
  });

  const healthCheckCommand = vscode.commands.registerCommand('locodex.healthCheck', () => {
    checkServiceHealth();
  });

  // Add all commands to subscriptions
  context.subscriptions.push(
    chatCommand,
    explainCommand,
    optimizeCommand,
    reviewCommand,
    generateTestsCommand,
    generateDocumentationCommand,
    fixIssuesCommand,
    selectProviderCommand,
    toggleInlineCompletionCommand,
    toggleCompletionCommand,
    completeCodeCommand,
    acceptCompletionCommand,
    securityScanCommand,
    scanWorkspaceCommand,
    fixSecurityCommand,
    codeReviewCommand,
    optimizeCodeCommand,
    fixReviewCommand,
    configureCommand,
    openSettingsCommand,
    selectModelCommand,
    healthCheckCommand
  );
}

function registerEventListeners(context: vscode.ExtensionContext) {
  // Configuration change listener
  const configChangeListener = vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('locodex')) {
      extensionState.config = getConfiguration();
      apiClient.updateConfig(extensionState.config);
      
      // Update provider states
      if (completionProvider) {
        completionProvider.setEnabled(extensionState.config.enableInlineCompletion);
      }
      
      vscode.window.showInformationMessage('LocoDex yapılandırması güncellendi');
    }
  });

  // Document save listener for auto-review
  const documentSaveListener = vscode.workspace.onDidSaveTextDocument(document => {
    if (extensionState.config.enableCodeReview) {
      const config = vscode.workspace.getConfiguration('locodex');
      const autoReview = config.get('autoReviewOnSave', false);
      
      if (autoReview && isCodeFile(document)) {
        codeReviewProvider.reviewCode(document);
      }
    }
  });

  // Document close listener for cleanup
  const documentCloseListener = vscode.workspace.onDidCloseTextDocument(document => {
    // Clean up any cached results for this document
    const uri = document.uri.toString();
    securityProvider.getSecurityScanResult(uri);
    codeReviewProvider.getCodeReviewResult(uri);
  });

  context.subscriptions.push(
    configChangeListener,
    documentSaveListener,
    documentCloseListener
  );
}

function isCodeFile(document: vscode.TextDocument): boolean {
  return extensionState.config.codeLanguages.includes(document.languageId);
}

async function checkServiceHealth() {
  try {
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: '🔍 Servislerin durumu kontrol ediliyor...',
        cancellable: false
      },
      async (progress) => {
        progress.report({ increment: 0 });

        const mainHealthy = await apiClient.checkHealth();
        progress.report({ increment: 50, message: 'Ana servis kontrol ediliyor...' });

        const vllmHealthy = await apiClient.checkVllmHealth();
        progress.report({ increment: 100, message: 'Tamamlandı!' });

        const mainStatus = mainHealthy ? '✅' : '❌';
        const vllmStatus = vllmHealthy ? '✅' : '❌';

        const message = `Servis Durumu:\n${mainStatus} LocoDex API (${extensionState.config.apiEndpoint})\n${vllmStatus} vLLM Service (${extensionState.config.vllmEndpoint})`;
        
        if (mainHealthy || vllmHealthy) {
          vscode.window.showInformationMessage(message);
        } else {
          vscode.window.showWarningMessage(message + '\n\nHiçbir servis aktif değil. Lütfen servisleri başlatın.', 'Ayarları Aç', 'Tekrar Dene').then(selection => {
            if (selection === 'Ayarları Aç') {
              vscode.commands.executeCommand('locodex.configure');
            } else if (selection === 'Tekrar Dene') {
              checkServiceHealth();
            }
          });
        }
      }
    );
  } catch (error) {
    vscode.window.showErrorMessage(`Servis durumu kontrol edilemedi: ${(error as any).message}`, 'Ayarları Kontrol Et').then(selection => {
      if (selection === 'Ayarları Kontrol Et') {
        vscode.commands.executeCommand('locodex.configure');
      }
    });
  }
}

function showWelcomeMessage() {
  const config = vscode.workspace.getConfiguration('locodex');
  const showWelcome = config.get('showWelcomeMessage', true);
  
  if (showWelcome) {
    vscode.window.showInformationMessage(
      '🤖 LocoDex AI Code Assistant aktif! Enterprise güvenliği ile kod yazma deneyiminizi geliştirin.',
      'Ayarları Aç',
      'Chat\'i Aç',
      'Bu mesajı tekrar gösterme'
    ).then(selection => {
      switch (selection) {
        case 'Ayarları Aç':
          vscode.commands.executeCommand('locodex.configure');
          break;
        case 'Chat\'i Aç':
          vscode.commands.executeCommand('locodex.openChat');
          break;
        case 'Bu mesajı tekrar gösterme':
          config.update('showWelcomeMessage', false, vscode.ConfigurationTarget.Global);
          break;
      }
    });
  }
}

export function deactivate() {
  console.log('LocoDex AI Code Assistant deactivated');
  
  // Clean up providers
  if (completionProvider) {
    completionProvider.dispose();
  }
  if (chatProvider) {
    chatProvider.dispose();
  }
  if (securityProvider) {
    securityProvider.dispose();
  }
  if (codeReviewProvider) {
    codeReviewProvider.dispose();
  }
  if (configurationProvider) {
    configurationProvider.dispose();
  }
  
  // Reset state
  extensionState = {
    isActivated: false,
    currentModel: null,
    chatSessions: [],
    config: {} as LocoDexConfig,
    providerStatus: {}
  };
}