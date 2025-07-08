import * as vscode from 'vscode';
import { LocoDexApiClient } from '../api/locodexClient';
import { CodeReviewResult, CodeContext, OptimizationSuggestion } from '../types';
import { getCodeContext, getSelectedTextOrCurrentLine } from '../utils/codeUtils';

export class LocoDexCodeReviewProvider implements vscode.CodeActionProvider {
  private client: LocoDexApiClient;
  private diagnosticCollection: vscode.DiagnosticCollection;
  private reviewResults: Map<string, CodeReviewResult> = new Map();

  constructor(client: LocoDexApiClient) {
    this.client = client;
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('locodex-review');
  }

  async provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeAction[]> {
    const actions: vscode.CodeAction[] = [];

    // Code review action
    const reviewAction = new vscode.CodeAction(
      '🔍 LocoDex Kod İncelemesi',
      vscode.CodeActionKind.Source
    );
    
    reviewAction.command = {
      command: 'locodex.codeReview',
      title: 'Code Review',
      arguments: [document, range]
    };

    actions.push(reviewAction);

    // Code optimization action
    const optimizeAction = new vscode.CodeAction(
      '⚡ Kod Optimizasyonu',
      vscode.CodeActionKind.Refactor
    );
    
    optimizeAction.command = {
      command: 'locodex.optimizeCode',
      title: 'Optimize Code',
      arguments: [document, range]
    };

    actions.push(optimizeAction);

    // If there are review diagnostics, add fix actions
    const reviewDiagnostics = context.diagnostics.filter(
      diag => diag.source === 'locodex-review'
    );

    if (reviewDiagnostics.length > 0) {
      const fixAction = new vscode.CodeAction(
        '🔧 İnceleme Sorunlarını Düzelt',
        vscode.CodeActionKind.QuickFix
      );
      
      fixAction.command = {
        command: 'locodex.fixReviewIssues',
        title: 'Fix Review Issues',
        arguments: [document, reviewDiagnostics]
      };

      actions.push(fixAction);
    }

    return actions;
  }

  async reviewCode(document: vscode.TextDocument, range?: vscode.Range): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document !== document) {
      return;
    }

    try {
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: '🔍 Kod incelemesi yapılıyor...',
          cancellable: true
        },
        async (progress, token) => {
          progress.report({ increment: 0 });

          const codeContext = getCodeContext(document, range?.start || editor.selection.start);
          const codeToReview = range ? document.getText(range) : document.getText();

          progress.report({ increment: 30, message: 'Kod analiz ediliyor...' });

          const result = await this.client.reviewCode(codeToReview, codeContext);
          
          progress.report({ increment: 70, message: 'Sonuçlar işleniyor...' });

          this.reviewResults.set(document.uri.toString(), result);
          this.updateDiagnostics(document, result);

          progress.report({ increment: 100, message: 'Tamamlandı!' });

          await this.showCodeReviewReport(result, document);
        }
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Kod incelemesi hatası: ${(error as any).message}`);
    }
  }

  private updateDiagnostics(document: vscode.TextDocument, result: CodeReviewResult): void {
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

      diagnostic.source = 'locodex-review';
      diagnostic.code = issue.type;
      
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

  private async showCodeReviewReport(result: CodeReviewResult, document: vscode.TextDocument): Promise<void> {
    const scoreIcon = this.getScoreIcon(result.score);
    const overallText = this.getOverallText(result.overall);
    
    const message = `${scoreIcon} Kod incelemesi tamamlandı: ${result.score}/100 (${overallText})`;
    
    const actions = ['Detayları Göster', 'Sorunları Düzelt'];
    const selection = await vscode.window.showInformationMessage(message, ...actions);

    if (selection === 'Detayları Göster') {
      await this.showDetailedReport(result, document);
    } else if (selection === 'Sorunları Düzelt') {
      await this.fixReviewIssues(document, result.issues);
    }
  }

  private getScoreIcon(score: number): string {
    if (score >= 90) return '🟢';
    if (score >= 70) return '🟡';
    if (score >= 50) return '🟠';
    return '🔴';
  }

  private getOverallText(overall: string): string {
    const textMap = {
      'excellent': 'Mükemmel',
      'good': 'İyi',
      'fair': 'Orta',
      'needs-improvement': 'Geliştirilmeli'
    };
    return textMap[overall as keyof typeof textMap] || overall;
  }

  private async showDetailedReport(result: CodeReviewResult, document: vscode.TextDocument): Promise<void> {
    const content = this.generateCodeReviewReport(result, document);
    
    const reportDocument = await vscode.workspace.openTextDocument({
      content,
      language: 'markdown'
    });

    await vscode.window.showTextDocument(reportDocument, vscode.ViewColumn.Beside);
  }

  private generateCodeReviewReport(result: CodeReviewResult, document: vscode.TextDocument): string {
    const scoreIcon = this.getScoreIcon(result.score);
    const overallText = this.getOverallText(result.overall);

    let report = `# 🔍 Kod İnceleme Raporu

**Dosya:** ${document.fileName}
**Tarih:** ${new Date().toLocaleString('tr-TR')}
**Model:** ${result.model}
**İnceleme Süresi:** ${result.reviewTime}ms

## 📊 Genel Değerlendirme

${scoreIcon} **Puan:** ${result.score}/100
**Durum:** ${overallText}

## 🎯 Öneriler

${result.suggestions.map(suggestion => `- ${suggestion}`).join('\n')}

## 🔍 Detaylı Bulgular

`;

    if (result.issues.length === 0) {
      report += '✅ Kritik sorun bulunamadı.\n';
    } else {
      // Group issues by type
      const issuesByType = result.issues.reduce((acc, issue) => {
        if (!acc[issue.type]) acc[issue.type] = [];
        acc[issue.type].push(issue);
        return acc;
      }, {} as Record<string, typeof result.issues>);

      Object.entries(issuesByType).forEach(([type, issues]) => {
        const typeIcon = this.getTypeIcon(type);
        report += `### ${typeIcon} ${this.getTypeText(type)} (${issues.length})\n\n`;
        
        issues.forEach((issue, index) => {
          const severity = this.getSeverityIcon(issue.severity);
          report += `#### ${index + 1}. ${severity} ${issue.title}

**Açıklama:** ${issue.description}
**Önerilen Çözüm:** ${issue.suggestion}

`;
          if (issue.line) {
            report += `**Konum:** Satır ${issue.line}${issue.column ? `, Sütun ${issue.column}` : ''}

`;
          }
          report += '---\n\n';
        });
      });
    }

    report += `## 📈 Kod Kalitesi Metrikleri

| Kategori | Değerlendirme |
|----------|---------------|
| Performans | ${this.getMetricIcon(result.score)} |
| Okunabilirlik | ${this.getMetricIcon(result.score)} |
| Maintainability | ${this.getMetricIcon(result.score)} |
| Güvenlik | ${this.getMetricIcon(result.score)} |
| Best Practices | ${this.getMetricIcon(result.score)} |

## 🔧 Sonraki Adımlar

1. Yüksek öncelikli sorunları çözün
2. Önerilen refactoring'leri uygulayın
3. Unit testler ekleyin
4. Dokümantasyon güncelleyin
5. Düzenli kod incelemeleri yapın

---
*Bu rapor LocoDex AI tarafından oluşturulmuştur.*`;

    return report;
  }

  private getTypeIcon(type: string): string {
    const iconMap = {
      'bug': '🐛',
      'performance': '⚡',
      'maintainability': '🔧',
      'security': '🛡️',
      'style': '🎨'
    };
    return iconMap[type as keyof typeof iconMap] || '📋';
  }

  private getTypeText(type: string): string {
    const textMap = {
      'bug': 'Hatalar',
      'performance': 'Performans',
      'maintainability': 'Sürdürülebilirlik',
      'security': 'Güvenlik',
      'style': 'Stil'
    };
    return textMap[type as keyof typeof textMap] || type;
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

  private getMetricIcon(score: number): string {
    if (score >= 90) return '🟢 Mükemmel';
    if (score >= 70) return '🟡 İyi';
    if (score >= 50) return '🟠 Orta';
    return '🔴 Geliştirilmeli';
  }

  async optimizeCode(document: vscode.TextDocument, range?: vscode.Range): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document !== document) {
      return;
    }

    try {
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: '⚡ Kod optimizasyonu yapılıyor...',
          cancellable: true
        },
        async (progress, token) => {
          progress.report({ increment: 0 });

          const codeContext = getCodeContext(document, range?.start || editor.selection.start);
          const codeToOptimize = range ? document.getText(range) : document.getText();

          progress.report({ increment: 30, message: 'Optimizasyon önerileri hazırlanıyor...' });

          const suggestions = await this.client.optimizeCode(codeToOptimize, codeContext);
          
          progress.report({ increment: 70, message: 'Sonuçlar işleniyor...' });

          await this.showOptimizationSuggestions(suggestions, document, range);

          progress.report({ increment: 100, message: 'Tamamlandı!' });
        }
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Kod optimizasyonu hatası: ${(error as any).message}`);
    }
  }

  private async showOptimizationSuggestions(
    suggestions: OptimizationSuggestion[],
    document: vscode.TextDocument,
    range?: vscode.Range
  ): Promise<void> {
    if (suggestions.length === 0) {
      vscode.window.showInformationMessage('✅ Kod zaten optimize görünüyor!');
      return;
    }

    const items = suggestions.map(suggestion => ({
      label: `${this.getOptimizationIcon(suggestion.type)} ${suggestion.title}`,
      description: suggestion.description,
      detail: `Etki: ${suggestion.impact}, Zorluk: ${suggestion.effort}`,
      suggestion
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Uygulanacak optimizasyonu seçin',
      canPickMany: true
    });

    if (!selected || selected.length === 0) return;

    // Apply selected optimizations
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document === document) {
      for (const item of selected) {
        await this.applyOptimization(editor, item.suggestion, range);
      }
    }

    // Show detailed report
    await this.showOptimizationReport(suggestions, document);
  }

  private getOptimizationIcon(type: string): string {
    const iconMap = {
      'performance': '⚡',
      'memory': '🧠',
      'readability': '👁️',
      'best-practices': '✨'
    };
    return iconMap[type as keyof typeof iconMap] || '🔧';
  }

  private async applyOptimization(
    editor: vscode.TextEditor,
    suggestion: OptimizationSuggestion,
    range?: vscode.Range
  ): Promise<void> {
    const targetRange = range || new vscode.Range(
      new vscode.Position(0, 0),
      new vscode.Position(editor.document.lineCount, 0)
    );

    await editor.edit(editBuilder => {
      // Simple replacement - in a real implementation, you'd need more sophisticated
      // code transformation logic
      const currentText = editor.document.getText(targetRange);
      const newText = currentText.replace(suggestion.before, suggestion.after);
      editBuilder.replace(targetRange, newText);
    });
  }

  private async showOptimizationReport(
    suggestions: OptimizationSuggestion[],
    document: vscode.TextDocument
  ): Promise<void> {
    const content = this.generateOptimizationReport(suggestions, document);
    
    const reportDocument = await vscode.workspace.openTextDocument({
      content,
      language: 'markdown'
    });

    await vscode.window.showTextDocument(reportDocument, vscode.ViewColumn.Beside);
  }

  private generateOptimizationReport(
    suggestions: OptimizationSuggestion[],
    document: vscode.TextDocument
  ): string {
    let report = `# ⚡ Kod Optimizasyon Raporu

**Dosya:** ${document.fileName}
**Tarih:** ${new Date().toLocaleString('tr-TR')}
**Toplam Öneri:** ${suggestions.length}

## 📊 Optimizasyon Önerileri

`;

    suggestions.forEach((suggestion, index) => {
      const icon = this.getOptimizationIcon(suggestion.type);
      const impactIcon = this.getImpactIcon(suggestion.impact);
      const effortIcon = this.getEffortIcon(suggestion.effort);

      report += `### ${index + 1}. ${icon} ${suggestion.title}

**Tip:** ${suggestion.type}
**Açıklama:** ${suggestion.description}
**Etki:** ${impactIcon} ${suggestion.impact}
**Zorluk:** ${effortIcon} ${suggestion.effort}

#### Önceki Kod
\`\`\`
${suggestion.before}
\`\`\`

#### Optimizasyonlu Kod
\`\`\`
${suggestion.after}
\`\`\`

---

`;
    });

    report += `## 📈 Öncelik Sıralaması

${suggestions
  .sort((a, b) => {
    const impactScore = { high: 3, medium: 2, low: 1 };
    const effortScore = { low: 3, medium: 2, high: 1 };
    
    const aScore = impactScore[a.impact as keyof typeof impactScore] + effortScore[a.effort as keyof typeof effortScore];
    const bScore = impactScore[b.impact as keyof typeof impactScore] + effortScore[b.effort as keyof typeof effortScore];
    
    return bScore - aScore;
  })
  .map((suggestion, index) => `${index + 1}. ${suggestion.title} (${suggestion.impact} etki, ${suggestion.effort} zorluk)`)
  .join('\n')}

---
*Bu rapor LocoDex AI tarafından oluşturulmuştur.*`;

    return report;
  }

  private getImpactIcon(impact: string): string {
    switch (impact) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }

  private getEffortIcon(effort: string): string {
    switch (effort) {
      case 'low': return '🟢';
      case 'medium': return '🟡';
      case 'high': return '🔴';
      default: return '⚪';
    }
  }

  async fixReviewIssues(document: vscode.TextDocument, issues: any[]): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document !== document) {
      return;
    }

    try {
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: '🔧 İnceleme sorunları düzeltiliyor...',
          cancellable: false
        },
        async (progress) => {
          progress.report({ increment: 0 });

          const codeContext = getCodeContext(document, editor.selection.start);
          const originalCode = document.getText();
          
          const issuesDescription = issues.map(issue => 
            `${issue.title}: ${issue.description} (Öneri: ${issue.suggestion})`
          ).join('\n');

          progress.report({ increment: 50, message: 'Düzeltmeler uygulanıyor...' });

          const fixedCode = await this.client.fixIssues(originalCode, issuesDescription, codeContext);
          
          progress.report({ increment: 80, message: 'Kod güncelleniyor...' });

          const fullRange = new vscode.Range(
            new vscode.Position(0, 0),
            new vscode.Position(document.lineCount, 0)
          );

          await editor.edit(editBuilder => {
            editBuilder.replace(fullRange, fixedCode);
          });

          progress.report({ increment: 100, message: 'Tamamlandı!' });

          vscode.window.showInformationMessage('✅ İnceleme sorunları düzeltildi!');
        }
      );
    } catch (error) {
      vscode.window.showErrorMessage(`İnceleme sorunları düzeltilemedi: ${(error as any).message}`);
    }
  }

  getCodeReviewResult(documentUri: string): CodeReviewResult | undefined {
    return this.reviewResults.get(documentUri);
  }

  dispose(): void {
    this.diagnosticCollection.dispose();
    this.reviewResults.clear();
  }
}