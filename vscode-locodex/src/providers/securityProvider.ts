import * as vscode from 'vscode';
import { LocoDexApiClient } from '../api/locodexClient';
import { SecurityScanResult, SecurityIssue, CodeContext } from '../types';
import { getCodeContext, getSelectedTextOrCurrentLine } from '../utils/codeUtils';

export class LocoDexSecurityProvider implements vscode.CodeActionProvider {
  private client: LocoDexApiClient;
  private diagnosticCollection: vscode.DiagnosticCollection;
  private scanResults: Map<string, SecurityScanResult> = new Map();

  constructor(client: LocoDexApiClient) {
    this.client = client;
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('locodex-security');
  }

  async provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeAction[]> {
    const actions: vscode.CodeAction[] = [];

    // Security scan action
    const scanAction = new vscode.CodeAction(
      '🛡️ LocoDex Güvenlik Taraması',
      vscode.CodeActionKind.Source
    );
    
    scanAction.command = {
      command: 'locodex.securityScan',
      title: 'Security Scan',
      arguments: [document, range]
    };

    actions.push(scanAction);

    // If there are security diagnostics, add fix actions
    const securityDiagnostics = context.diagnostics.filter(
      diag => diag.source === 'locodex-security'
    );

    if (securityDiagnostics.length > 0) {
      const fixAction = new vscode.CodeAction(
        '🔧 Güvenlik Sorunlarını Düzelt',
        vscode.CodeActionKind.QuickFix
      );
      
      fixAction.command = {
        command: 'locodex.fixSecurityIssues',
        title: 'Fix Security Issues',
        arguments: [document, securityDiagnostics]
      };

      actions.push(fixAction);
    }

    return actions;
  }

  async scanDocument(document: vscode.TextDocument, range?: vscode.Range): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document !== document) {
      return;
    }

    try {
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: '🛡️ Güvenlik taraması yapılıyor...',
          cancellable: true
        },
        async (progress, token) => {
          progress.report({ increment: 0 });

          const codeContext = getCodeContext(document, range?.start || editor.selection.start);
          const codeToScan = range ? document.getText(range) : document.getText();

          progress.report({ increment: 30, message: 'Kod analiz ediliyor...' });

          const result = await this.client.scanSecurity(codeToScan, codeContext);
          
          progress.report({ increment: 70, message: 'Sonuçlar işleniyor...' });

          this.scanResults.set(document.uri.toString(), result);
          this.updateDiagnostics(document, result);

          progress.report({ increment: 100, message: 'Tamamlandı!' });

          await this.showSecurityReport(result, document);
        }
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Güvenlik taraması hatası: ${(error as any).message}`);
    }
  }

  private updateDiagnostics(document: vscode.TextDocument, result: SecurityScanResult): void {
    const diagnostics: vscode.Diagnostic[] = result.issues.map(issue => {
      const line = Math.max(0, (issue.line || 1) - 1);
      const character = Math.max(0, (issue.column || 1) - 1);
      const position = new vscode.Position(line, character);
      const range = new vscode.Range(position, position);

      const diagnostic = new vscode.Diagnostic(
        range,
        `${issue.title}: ${issue.description}`,
        this.getSeverityLevel(issue.severity)
      );

      diagnostic.source = 'locodex-security';
      diagnostic.code = issue.cwe || issue.type;
      
      if (issue.suggestion) {
        diagnostic.relatedInformation = [
          new vscode.DiagnosticRelatedInformation(
            new vscode.Location(document.uri, range),
            `Öneri: ${issue.suggestion}`
          )
        ];
      }

      return diagnostic;
    });

    this.diagnosticCollection.set(document.uri, diagnostics);
  }

  private getSeverityLevel(severity: string): vscode.DiagnosticSeverity {
    switch (severity) {
      case 'critical':
      case 'high':
        return vscode.DiagnosticSeverity.Error;
      case 'medium':
        return vscode.DiagnosticSeverity.Warning;
      case 'low':
        return vscode.DiagnosticSeverity.Information;
      default:
        return vscode.DiagnosticSeverity.Information;
    }
  }

  private async showSecurityReport(result: SecurityScanResult, document: vscode.TextDocument): Promise<void> {
    const { critical, high, medium, low } = result.summary;
    const totalIssues = critical + high + medium + low;

    if (totalIssues === 0) {
      vscode.window.showInformationMessage('✅ Güvenlik taraması tamamlandı. Sorun bulunamadı!');
      return;
    }

    const message = `🛡️ Güvenlik taraması tamamlandı: ${totalIssues} sorun bulundu (${critical} kritik, ${high} yüksek, ${medium} orta, ${low} düşük)`;
    
    const actions = ['Detayları Göster', 'Sorunları Düzelt'];
    const selection = await vscode.window.showWarningMessage(message, ...actions);

    if (selection === 'Detayları Göster') {
      await this.showDetailedReport(result, document);
    } else if (selection === 'Sorunları Düzelt') {
      await this.fixSecurityIssues(document, result.issues);
    }
  }

  private async showDetailedReport(result: SecurityScanResult, document: vscode.TextDocument): Promise<void> {
    const content = this.generateSecurityReport(result, document);
    
    const reportDocument = await vscode.workspace.openTextDocument({
      content,
      language: 'markdown'
    });

    await vscode.window.showTextDocument(reportDocument, vscode.ViewColumn.Beside);
  }

  private generateSecurityReport(result: SecurityScanResult, document: vscode.TextDocument): string {
    const { critical, high, medium, low } = result.summary;
    const totalIssues = critical + high + medium + low;

    let report = `# 🛡️ Güvenlik Tarama Raporu

**Dosya:** ${document.fileName}
**Tarih:** ${new Date().toLocaleString('tr-TR')}
**Model:** ${result.model}
**Tarama Süresi:** ${result.scanTime}ms

## 📊 Özet

- **Toplam Sorun:** ${totalIssues}
- **Kritik:** ${critical}
- **Yüksek:** ${high}
- **Orta:** ${medium}
- **Düşük:** ${low}

## 🔍 Detaylı Bulgular

`;

    if (result.issues.length === 0) {
      report += '✅ Güvenlik sorunu bulunamadı.\n';
    } else {
      result.issues.forEach((issue, index) => {
        const severity = this.getSeverityIcon(issue.severity);
        report += `### ${index + 1}. ${severity} ${issue.title}

**Tip:** ${issue.type}
**Önem:** ${issue.severity}
**Açıklama:** ${issue.description}

`;
        if (issue.suggestion) {
          report += `**Çözüm Önerisi:** ${issue.suggestion}

`;
        }
        if (issue.cwe) {
          report += `**CWE:** ${issue.cwe}

`;
        }
        if (issue.line) {
          report += `**Konum:** Satır ${issue.line}${issue.column ? `, Sütun ${issue.column}` : ''}

`;
        }
        report += '---\n\n';
      });
    }

    report += `## 🔧 Sonraki Adımlar

1. Kritik ve yüksek önem seviyeli sorunları öncelikle çözün
2. Önerilen çözümleri uygulayın
3. Kod review sürecine güvenlik kontrollerini dahil edin
4. Düzenli güvenlik taramaları yapın

---
*Bu rapor LocoDex AI tarafından oluşturulmuştur.*`;

    return report;
  }

  private getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🔵';
      default: return '⚪';
    }
  }

  async fixSecurityIssues(document: vscode.TextDocument, issues: SecurityIssue[]): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document !== document) {
      return;
    }

    try {
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: '🔧 Güvenlik sorunları düzeltiliyor...',
          cancellable: false
        },
        async (progress) => {
          progress.report({ increment: 0 });

          const codeContext = getCodeContext(document, editor.selection.start);
          const originalCode = document.getText();
          
          // Create issues description
          const issuesDescription = issues.map(issue => 
            `${issue.title}: ${issue.description}${issue.suggestion ? ` (Öneri: ${issue.suggestion})` : ''}`
          ).join('\n');

          progress.report({ increment: 50, message: 'Düzeltmeler uygulanıyor...' });

          const fixedCode = await this.client.fixIssues(originalCode, issuesDescription, codeContext);
          
          progress.report({ increment: 80, message: 'Kod güncelleniyor...' });

          // Apply the fixes
          const fullRange = new vscode.Range(
            new vscode.Position(0, 0),
            new vscode.Position(document.lineCount, 0)
          );

          await editor.edit(editBuilder => {
            editBuilder.replace(fullRange, fixedCode);
          });

          progress.report({ increment: 100, message: 'Tamamlandı!' });

          vscode.window.showInformationMessage('✅ Güvenlik sorunları düzeltildi!');
        }
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Güvenlik sorunları düzeltilemedi: ${(error as any).message}`);
    }
  }

  async scanWorkspace(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showWarningMessage('Workspace açık değil.');
      return;
    }

    const files = await vscode.workspace.findFiles(
      '**/*.{js,ts,jsx,tsx,py,java,php,go,rs,cs}',
      '**/node_modules/**'
    );

    if (files.length === 0) {
      vscode.window.showInformationMessage('Taranacak kod dosyası bulunamadı.');
      return;
    }

    const selection = await vscode.window.showQuickPick(
      ['Tüm Dosyaları Tara', 'Seçili Dosyaları Tara'],
      { placeHolder: 'Güvenlik tarama türünü seçin' }
    );

    if (!selection) return;

    if (selection === 'Seçili Dosyaları Tara') {
      const selectedFiles = await vscode.window.showQuickPick(
        files.map(file => ({
          label: vscode.workspace.asRelativePath(file),
          detail: file.fsPath,
          uri: file
        })),
        { 
          placeHolder: 'Taranacak dosyaları seçin',
          canPickMany: true
        }
      );

      if (!selectedFiles || selectedFiles.length === 0) return;

      for (const file of selectedFiles) {
        const document = await vscode.workspace.openTextDocument(file.uri);
        await this.scanDocument(document);
      }
    } else {
      // Scan all files with progress
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: '🛡️ Workspace güvenlik taraması...',
          cancellable: true
        },
        async (progress, token) => {
          let completed = 0;
          const total = files.length;

          for (const file of files) {
            if (token.isCancellationRequested) break;

            progress.report({
              increment: (100 / total),
              message: `Taranıyor: ${vscode.workspace.asRelativePath(file)} (${completed + 1}/${total})`
            });

            const document = await vscode.workspace.openTextDocument(file);
            await this.scanDocument(document);
            completed++;
          }

          if (!token.isCancellationRequested) {
            vscode.window.showInformationMessage(`✅ Workspace güvenlik taraması tamamlandı! ${completed} dosya tarandı.`);
          }
        }
      );
    }
  }

  getSecurityScanResult(documentUri: string): SecurityScanResult | undefined {
    return this.scanResults.get(documentUri);
  }

  dispose(): void {
    this.diagnosticCollection.dispose();
    this.scanResults.clear();
  }
}