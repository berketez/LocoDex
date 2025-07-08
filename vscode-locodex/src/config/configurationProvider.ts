import * as vscode from 'vscode';
import { LocoDexConfig, Model } from '../types';
import { LocoDexApiClient } from '../api/locodexClient';

export class ConfigurationProvider {
  private client: LocoDexApiClient;
  private webviewPanel: vscode.WebviewPanel | null = null;

  constructor(client: LocoDexApiClient) {
    this.client = client;
  }

  async showConfigurationUI(context: vscode.ExtensionContext) {
    if (this.webviewPanel) {
      this.webviewPanel.reveal();
      return;
    }

    this.webviewPanel = vscode.window.createWebviewPanel(
      'locodexConfig',
      '⚙️ LocoDex Ayarları',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'resources'),
          vscode.Uri.joinPath(context.extensionUri, 'out')
        ]
      }
    );

    this.webviewPanel.webview.html = await this.getConfigurationWebviewContent();

    // Handle messages from webview
    this.webviewPanel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case 'loadConfig':
            await this.loadCurrentConfiguration();
            break;
          case 'saveConfig':
            await this.saveConfiguration(message.config);
            break;
          case 'testConnection':
            await this.testConnection(message.endpoint, message.type);
            break;
          case 'discoverModels':
            await this.discoverModels();
            break;
          case 'resetToDefaults':
            await this.resetToDefaults();
            break;
        }
      },
      undefined,
      context.subscriptions
    );

    this.webviewPanel.onDidDispose(() => {
      this.webviewPanel = null;
    });

    // Load current configuration
    await this.loadCurrentConfiguration();
  }

  private async loadCurrentConfiguration() {
    if (!this.webviewPanel) return;

    const config = this.getCurrentConfig();
    const models = await this.getAvailableModels();

    this.webviewPanel.webview.postMessage({
      type: 'configLoaded',
      config,
      models
    });
  }

  private getCurrentConfig(): LocoDexConfig {
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

  private async getAvailableModels(): Promise<Model[]> {
    try {
      return await this.client.getAvailableModels();
    } catch (error) {
      console.error('[LocoDex] Failed to load models:', error);
      return [];
    }
  }

  private async saveConfiguration(newConfig: LocoDexConfig) {
    try {
      const config = vscode.workspace.getConfiguration('locodex');
      
      await Promise.all([
        config.update('apiEndpoint', newConfig.apiEndpoint, vscode.ConfigurationTarget.Global),
        config.update('vllmEndpoint', newConfig.vllmEndpoint, vscode.ConfigurationTarget.Global),
        config.update('preferredProvider', newConfig.preferredProvider, vscode.ConfigurationTarget.Global),
        config.update('model', newConfig.model, vscode.ConfigurationTarget.Global),
        config.update('maxTokens', newConfig.maxTokens, vscode.ConfigurationTarget.Global),
        config.update('temperature', newConfig.temperature, vscode.ConfigurationTarget.Global),
        config.update('enableInlineCompletion', newConfig.enableInlineCompletion, vscode.ConfigurationTarget.Global),
        config.update('enableSecurityScan', newConfig.enableSecurityScan, vscode.ConfigurationTarget.Global),
        config.update('enableCodeReview', newConfig.enableCodeReview, vscode.ConfigurationTarget.Global),
        config.update('autoSaveChat', newConfig.autoSaveChat, vscode.ConfigurationTarget.Global),
        config.update('securityLevel', newConfig.securityLevel, vscode.ConfigurationTarget.Global),
        config.update('enableTelemetry', newConfig.enableTelemetry, vscode.ConfigurationTarget.Global),
        config.update('codeLanguages', newConfig.codeLanguages, vscode.ConfigurationTarget.Global)
      ]);

      this.webviewPanel?.webview.postMessage({
        type: 'configSaved',
        success: true,
        message: 'Ayarlar başarıyla kaydedildi!'
      });

      vscode.window.showInformationMessage('✅ LocoDex ayarları güncellendi!');
    } catch (error) {
      this.webviewPanel?.webview.postMessage({
        type: 'configSaved',
        success: false,
        message: `Ayarlar kaydedilemedi: ${(error as any).message}`
      });

      vscode.window.showErrorMessage(`Ayarlar kaydedilemedi: ${(error as any).message}`);
    }
  }

  private async testConnection(endpoint: string, type: 'main' | 'vllm') {
    try {
      let isHealthy = false;
      
      if (type === 'main') {
        const tempClient = new LocoDexApiClient({
          ...this.getCurrentConfig(),
          apiEndpoint: endpoint
        });
        isHealthy = await tempClient.checkHealth();
      } else {
        const tempClient = new LocoDexApiClient({
          ...this.getCurrentConfig(),
          vllmEndpoint: endpoint
        });
        isHealthy = await tempClient.checkVllmHealth();
      }

      this.webviewPanel?.webview.postMessage({
        type: 'connectionTested',
        endpoint,
        providerType: type,
        success: isHealthy,
        message: isHealthy ? 'Bağlantı başarılı!' : 'Bağlantı başarısız!'
      });
    } catch (error) {
      this.webviewPanel?.webview.postMessage({
        type: 'connectionTested',
        endpoint,
        providerType: type,
        success: false,
        message: `Bağlantı hatası: ${(error as any).message}`
      });
    }
  }

  private async discoverModels() {
    try {
      const models = await this.client.getAvailableModels();
      
      this.webviewPanel?.webview.postMessage({
        type: 'modelsDiscovered',
        models,
        success: true,
        message: `${models.length} model bulundu`
      });
    } catch (error) {
      this.webviewPanel?.webview.postMessage({
        type: 'modelsDiscovered',
        models: [],
        success: false,
        message: `Model keşfi hatası: ${(error as any).message}`
      });
    }
  }

  private async resetToDefaults() {
    const defaultConfig: LocoDexConfig = {
      apiEndpoint: 'http://localhost:8000',
      vllmEndpoint: 'http://localhost:8080',
      preferredProvider: 'auto',
      model: 'llama3-8b-instruct',
      maxTokens: 1500,
      temperature: 0.3,
      enableInlineCompletion: true,
      enableSecurityScan: true,
      enableCodeReview: true,
      autoSaveChat: true,
      securityLevel: 'high',
      enableTelemetry: false,
      codeLanguages: [
        'javascript', 'typescript', 'python', 'java', 'go', 'rust', 'cpp', 'c', 'csharp'
      ]
    };

    await this.saveConfiguration(defaultConfig);
    await this.loadCurrentConfiguration();
  }

  private async getConfigurationWebviewContent(): Promise<string> {
    return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LocoDex Ayarları</title>
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
      padding: 20px;
      line-height: 1.6;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
    }

    h1 {
      margin-bottom: 30px;
      color: var(--vscode-titleBar-activeForeground);
      border-bottom: 2px solid var(--vscode-panel-border);
      padding-bottom: 10px;
    }

    .section {
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }

    .section h2 {
      margin-bottom: 15px;
      color: var(--vscode-titleBar-activeForeground);
    }

    .form-group {
      margin-bottom: 15px;
    }

    label {
      display: block;
      margin-bottom: 5px;
      font-weight: 500;
      color: var(--vscode-foreground);
    }

    input, select, textarea {
      width: 100%;
      padding: 8px 12px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      font-size: 14px;
    }

    input:focus, select:focus, textarea:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
      box-shadow: 0 0 0 1px var(--vscode-focusBorder);
    }

    .checkbox-group {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
    }

    .checkbox-group input[type="checkbox"] {
      width: auto;
      margin: 0;
    }

    .btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 10px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      margin-right: 10px;
      margin-bottom: 10px;
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

    .btn-test {
      background: var(--vscode-testing-iconPassed);
      color: white;
      padding: 5px 10px;
      font-size: 12px;
      margin-left: 10px;
    }

    .status {
      padding: 10px;
      border-radius: 4px;
      margin-top: 10px;
    }

    .status.success {
      background: var(--vscode-testing-iconPassed);
      color: white;
    }

    .status.error {
      background: var(--vscode-testing-iconFailed);
      color: white;
    }

    .endpoint-test {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .endpoint-test input {
      flex: 1;
    }

    .range-display {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      text-align: center;
      margin-top: 5px;
    }

    .language-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 10px;
      margin-top: 10px;
    }

    .actions {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid var(--vscode-panel-border);
    }

    .help-text {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-top: 5px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>⚙️ LocoDex AI Code Assistant Ayarları</h1>

    <div class="section">
      <h2>🔗 Bağlantı Ayarları</h2>
      
      <div class="form-group">
        <label for="apiEndpoint">LocoDex API Endpoint:</label>
        <div class="endpoint-test">
          <input type="text" id="apiEndpoint" placeholder="http://localhost:8000">
          <button class="btn btn-test" onclick="testConnection('main')">Test</button>
        </div>
        <div class="help-text">Ana LocoDex API servisinin adresi</div>
      </div>

      <div class="form-group">
        <label for="vllmEndpoint">vLLM Endpoint:</label>
        <div class="endpoint-test">
          <input type="text" id="vllmEndpoint" placeholder="http://localhost:8080">
          <button class="btn btn-test" onclick="testConnection('vllm')">Test</button>
        </div>
        <div class="help-text">vLLM inference servisinin adresi</div>
      </div>

      <div class="form-group">
        <label for="preferredProvider">Tercih Edilen Provider:</label>
        <select id="preferredProvider">
          <option value="auto">Otomatik</option>
          <option value="ollama">Ollama</option>
          <option value="lmstudio">LM Studio</option>
          <option value="vllm">vLLM</option>
        </select>
      </div>
    </div>

    <div class="section">
      <h2>🤖 Model Ayarları</h2>
      
      <div class="form-group">
        <label for="model">Aktif Model:</label>
        <select id="model">
          <option value="">Model yükleniyor...</option>
        </select>
        <button class="btn btn-secondary" onclick="discoverModels()">Modelleri Tara</button>
      </div>

      <div class="form-group">
        <label for="maxTokens">Max Token: <span id="maxTokensValue">1500</span></label>
        <input type="range" id="maxTokens" min="100" max="4000" step="100" value="1500" oninput="updateRange('maxTokens')">
        <div class="range-display">100 - 4000</div>
      </div>

      <div class="form-group">
        <label for="temperature">Temperature: <span id="temperatureValue">0.3</span></label>
        <input type="range" id="temperature" min="0" max="2" step="0.1" value="0.3" oninput="updateRange('temperature')">
        <div class="range-display">0.0 (Deterministik) - 2.0 (Yaratıcı)</div>
      </div>
    </div>

    <div class="section">
      <h2>🔧 Özellik Ayarları</h2>
      
      <div class="checkbox-group">
        <input type="checkbox" id="enableInlineCompletion">
        <label for="enableInlineCompletion">Satır İçi Kod Tamamlama</label>
      </div>

      <div class="checkbox-group">
        <input type="checkbox" id="enableSecurityScan">
        <label for="enableSecurityScan">Güvenlik Taraması</label>
      </div>

      <div class="checkbox-group">
        <input type="checkbox" id="enableCodeReview">
        <label for="enableCodeReview">Kod İncelemesi</label>
      </div>

      <div class="checkbox-group">
        <input type="checkbox" id="autoSaveChat">
        <label for="autoSaveChat">Chat Geçmişini Otomatik Kaydet</label>
      </div>

      <div class="form-group">
        <label for="securityLevel">Güvenlik Seviyesi:</label>
        <select id="securityLevel">
          <option value="low">Düşük</option>
          <option value="medium">Orta</option>
          <option value="high">Yüksek</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>
    </div>

    <div class="section">
      <h2>📝 Desteklenen Diller</h2>
      <div class="language-grid" id="languageGrid">
        <!-- Dil checkboxları dinamik olarak yüklenecek -->
      </div>
    </div>

    <div class="section">
      <h2>📊 Telemetri</h2>
      <div class="checkbox-group">
        <input type="checkbox" id="enableTelemetry">
        <label for="enableTelemetry">Kullanım istatistiklerini topla (sadece yerel)</label>
      </div>
      <div class="help-text">
        Telemetri verileri yalnızca yerel olarak saklanır ve hiçbir zaman dışarıya gönderilmez.
        Bu özellik performans iyileştirmeleri için kullanılır.
      </div>
    </div>

    <div class="actions">
      <button class="btn" onclick="saveConfiguration()">💾 Ayarları Kaydet</button>
      <button class="btn btn-secondary" onclick="resetToDefaults()">🔄 Varsayılanlara Dön</button>
    </div>

    <div id="status"></div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentConfig = {};
    let availableModels = [];

    const supportedLanguages = [
      'javascript', 'typescript', 'python', 'java', 'go', 'rust', 'cpp', 'c', 'csharp',
      'php', 'ruby', 'swift', 'kotlin', 'scala', 'dart', 'html', 'css', 'scss',
      'json', 'yaml', 'xml', 'markdown', 'bash', 'powershell', 'dockerfile', 'sql'
    ];

    // Initialize
    window.addEventListener('load', () => {
      createLanguageCheckboxes();
      vscode.postMessage({ type: 'loadConfig' });
    });

    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      
      switch (message.type) {
        case 'configLoaded':
          currentConfig = message.config;
          availableModels = message.models;
          populateForm();
          break;
        case 'configSaved':
          showStatus(message.success ? 'success' : 'error', message.message);
          break;
        case 'connectionTested':
          showConnectionStatus(message);
          break;
        case 'modelsDiscovered':
          availableModels = message.models;
          populateModelSelect();
          showStatus(message.success ? 'success' : 'error', message.message);
          break;
      }
    });

    function populateForm() {
      document.getElementById('apiEndpoint').value = currentConfig.apiEndpoint || '';
      document.getElementById('vllmEndpoint').value = currentConfig.vllmEndpoint || '';
      document.getElementById('preferredProvider').value = currentConfig.preferredProvider || 'auto';
      document.getElementById('maxTokens').value = currentConfig.maxTokens || 1500;
      document.getElementById('temperature').value = currentConfig.temperature || 0.3;
      document.getElementById('enableInlineCompletion').checked = currentConfig.enableInlineCompletion !== false;
      document.getElementById('enableSecurityScan').checked = currentConfig.enableSecurityScan !== false;
      document.getElementById('enableCodeReview').checked = currentConfig.enableCodeReview !== false;
      document.getElementById('autoSaveChat').checked = currentConfig.autoSaveChat !== false;
      document.getElementById('securityLevel').value = currentConfig.securityLevel || 'high';
      document.getElementById('enableTelemetry').checked = currentConfig.enableTelemetry === true;

      updateRange('maxTokens');
      updateRange('temperature');
      populateModelSelect();
      updateLanguageCheckboxes();
    }

    function populateModelSelect() {
      const select = document.getElementById('model');
      select.innerHTML = '';
      
      if (availableModels.length === 0) {
        select.innerHTML = '<option value="">Model bulunamadı</option>';
        return;
      }

      availableModels.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = \`\${model.name} (\${model.provider})\`;
        if (model.id === currentConfig.model) {
          option.selected = true;
        }
        select.appendChild(option);
      });
    }

    function createLanguageCheckboxes() {
      const grid = document.getElementById('languageGrid');
      grid.innerHTML = '';
      
      supportedLanguages.forEach(lang => {
        const div = document.createElement('div');
        div.className = 'checkbox-group';
        div.innerHTML = \`
          <input type="checkbox" id="lang_\${lang}" value="\${lang}">
          <label for="lang_\${lang}">\${lang}</label>
        \`;
        grid.appendChild(div);
      });
    }

    function updateLanguageCheckboxes() {
      const selectedLanguages = currentConfig.codeLanguages || [];
      supportedLanguages.forEach(lang => {
        const checkbox = document.getElementById(\`lang_\${lang}\`);
        if (checkbox) {
          checkbox.checked = selectedLanguages.includes(lang);
        }
      });
    }

    function updateRange(id) {
      const input = document.getElementById(id);
      const display = document.getElementById(id + 'Value');
      display.textContent = input.value;
    }

    function testConnection(type) {
      const endpoint = type === 'main' 
        ? document.getElementById('apiEndpoint').value
        : document.getElementById('vllmEndpoint').value;
      
      vscode.postMessage({
        type: 'testConnection',
        endpoint,
        type
      });
    }

    function showConnectionStatus(result) {
      const input = result.type === 'main' 
        ? document.getElementById('apiEndpoint')
        : document.getElementById('vllmEndpoint');
      
      const existingStatus = input.parentNode.querySelector('.status');
      if (existingStatus) {
        existingStatus.remove();
      }

      const status = document.createElement('div');
      status.className = \`status \${result.success ? 'success' : 'error'}\`;
      status.textContent = result.message;
      input.parentNode.appendChild(status);

      setTimeout(() => {
        if (status.parentNode) {
          status.parentNode.removeChild(status);
        }
      }, 3000);
    }

    function discoverModels() {
      vscode.postMessage({ type: 'discoverModels' });
    }

    function saveConfiguration() {
      const config = {
        apiEndpoint: document.getElementById('apiEndpoint').value,
        vllmEndpoint: document.getElementById('vllmEndpoint').value,
        preferredProvider: document.getElementById('preferredProvider').value,
        model: document.getElementById('model').value,
        maxTokens: parseInt(document.getElementById('maxTokens').value),
        temperature: parseFloat(document.getElementById('temperature').value),
        enableInlineCompletion: document.getElementById('enableInlineCompletion').checked,
        enableSecurityScan: document.getElementById('enableSecurityScan').checked,
        enableCodeReview: document.getElementById('enableCodeReview').checked,
        autoSaveChat: document.getElementById('autoSaveChat').checked,
        securityLevel: document.getElementById('securityLevel').value,
        enableTelemetry: document.getElementById('enableTelemetry').checked,
        codeLanguages: supportedLanguages.filter(lang => 
          document.getElementById(\`lang_\${lang}\`).checked
        )
      };

      vscode.postMessage({
        type: 'saveConfig',
        config
      });
    }

    function resetToDefaults() {
      if (confirm('Tüm ayarları varsayılan değerlere döndürmek istediğinizden emin misiniz?')) {
        vscode.postMessage({ type: 'resetToDefaults' });
      }
    }

    function showStatus(type, message) {
      const statusDiv = document.getElementById('status');
      statusDiv.className = \`status \${type}\`;
      statusDiv.textContent = message;
      statusDiv.style.display = 'block';

      setTimeout(() => {
        statusDiv.style.display = 'none';
      }, 3000);
    }
  </script>
</body>
</html>`;
  }

  dispose(): void {
    if (this.webviewPanel) {
      this.webviewPanel.dispose();
    }
  }
}