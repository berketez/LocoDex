import chalk from 'chalk';
import ora from 'ora';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

export class AgentManager {
  private conversationContext: Array<{role: string, content: string, tokens?: number}> = [];
  private totalTokens = 0;
  private readonly MAX_CONTEXT_LENGTH = 128000;
  private selectedModel: string = '';

  constructor() {}

  async start(model?: string): Promise<void> {
    console.log(chalk.cyan('🤖 LocoDex AI Agent Başlatılıyor...\n'));

    // Model seçimi
    if (!model) {
      this.selectedModel = await this.selectModel();
    } else {
      this.selectedModel = model;
    }

    console.log(chalk.green(`✓ AI Agent hazır: ${this.selectedModel}`));
    console.log(chalk.cyan('\n🤖 Merhaba! Ben LocoDex AI Agent\'ınızım.'));
    console.log(chalk.gray('💬 Benimle sohbet edebilir, terminal komutları çalıştırabiliriz.'));
    console.log(chalk.gray('💡 Örnekler:'));
    console.log(chalk.gray('   • "ls komutu çalıştır"'));
    console.log(chalk.gray('   • "package.json dosyasını oku"'));
    console.log(chalk.gray('   • "Python calculator kod yaz"'));
    console.log(chalk.gray('   • "git status kontrol et"'));
    console.log(chalk.gray('📝 Çıkış: "exit" yazın\n'));

    // Agent chat loop
    await this.startAgentChat();
  }

  private async startAgentChat(): Promise<void> {
    const prompt = require('prompt-sync')({ sigint: true });

    while (true) {
      try {
        // Context bilgisi göster
        if (this.conversationContext.length > 0) {
          this.displayContextInfo();
        }

        const input = prompt(chalk.cyan('👤 Sen: '));
        
        if (!input || input.toLowerCase().trim() === 'exit') {
          console.log(chalk.green('👋 Agent kapatılıyor...'));
          break;
        }

        if (!input.trim()) {
          continue;
        }

        // Agent'a gönder ve yanıt al
        const response = await this.processAgentRequest(input);
        console.log(chalk.green('🤖 Agent: ') + response + '\n');

      } catch (error) {
        if (error instanceof Error && error.message === 'canceled') {
          console.log(chalk.green('\n👋 Agent kapatılıyor...'));
          break;
        }
        console.log(chalk.red(`❌ Agent hatası: ${error}`));
      }
    }
  }

  private async processAgentRequest(input: string): Promise<string> {
    const thinking = ora('AI Agent düşünüyor...').start();
    
    try {
      let systemResponse = '';
      
      // Terminal komut tespit etme
      if (this.isTerminalRequest(input)) {
        const command = this.extractCommand(input);
        if (command) {
          systemResponse += await this.executeTerminalCommand(command);
        }
      }

      // Dosya operasyonları
      if (this.isFileRequest(input)) {
        const fileOp = await this.handleFileOperation(input);
        systemResponse += fileOp;
      }

      // Context güncelle
      this.updateContext('user', input + systemResponse);

      thinking.stop();

      // AI'ya gönder
      const aiResponse = await this.getAIResponse(input, systemResponse);
      this.updateContext('assistant', aiResponse);

      // Kod oluşturma kontrolü
      await this.handleCodeGeneration(aiResponse, input);

      return systemResponse + aiResponse;

    } catch (error) {
      thinking.stop();
      throw error;
    }
  }

  private isTerminalRequest(input: string): boolean {
    const terminalKeywords = [
      'komut çalıştır', 'run command', 'execute',
      'ls', 'pwd', 'git', 'npm', 'node', 'python',
      'terminal', 'bash', 'shell', 'çalıştır'
    ];
    
    const lowerInput = input.toLowerCase();
    return terminalKeywords.some(keyword => lowerInput.includes(keyword));
  }

  private extractCommand(input: string): string | null {
    // Çeşitli command extraction patterns
    const patterns = [
      /"([^"]+)"/,           // "command"
      /'([^']+)'/,           // 'command'
      /`([^`]+)`/,           // `command`
      /çalıştır\s+(.+)/i,    // çalıştır command
      /run\s+(.+)/i,         // run command
      /execute\s+(.+)/i      // execute command
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    // Basit komutları direkt tespit et
    const simpleCommands = ['ls', 'pwd', 'git status', 'npm --version', 'node --version', 'python --version'];
    const lowerInput = input.toLowerCase();
    
    for (const cmd of simpleCommands) {
      if (lowerInput.includes(cmd)) {
        return cmd;
      }
    }

    return null;
  }

  private async executeTerminalCommand(command: string): Promise<string> {
    console.log(chalk.yellow(`🖥️  Terminal: ${command}`));

    // Güvenlik kontrolü
    if (this.isUnsafeCommand(command)) {
      return '\n🚫 Güvenlik nedeniyle bu komut çalıştırılamaz.\n';
    }

    try {
      const { stdout, stderr } = await execAsync(command, { 
        timeout: 30000,
        maxBuffer: 1024 * 1024 
      });

      let result = '\n📤 Terminal Çıktısı:\n';
      if (stdout) result += `${stdout}`;
      if (stderr) result += `⚠️ Uyarı: ${stderr}`;
      result += '\n';

      return result;

    } catch (error: any) {
      return `\n❌ Terminal Hatası: ${error.message}\n`;
    }
  }

  private isUnsafeCommand(command: string): boolean {
    const unsafePatterns = [
      /\brm\s+-rf/, /\brm\s+[^-]/, /\bsudo\b/, /\bchmod\s+\+x/,
      /curl.*\|\s*sh/, /wget.*\|\s*sh/, /\>\s*\/dev\/sd/,
      /\bdd\s+if=/, /\bmkfs\b/, /\bformat\b/, /\bfdisk\b/,
      /\breboot\b/, /\bshutdown\b/, /\bkill\s+-9/, /\bpkill\b/
    ];

    return unsafePatterns.some(pattern => pattern.test(command));
  }

  private isFileRequest(input: string): boolean {
    const fileKeywords = [
      'dosya oku', 'read file', 'dosya yaz', 'write file',
      'dosya listele', 'list files', 'dizin', 'directory'
    ];
    
    const lowerInput = input.toLowerCase();
    return fileKeywords.some(keyword => lowerInput.includes(keyword));
  }

  private async handleFileOperation(input: string): Promise<string> {
    const lowerInput = input.toLowerCase();

    try {
      // Dosya okuma
      if (lowerInput.includes('oku') || lowerInput.includes('read')) {
        const fileMatch = input.match(/["']([^"']+)["']|(\S+\.\w+)/);
        if (fileMatch) {
          const fileName = fileMatch[1] || fileMatch[2];
          const content = await this.readFile(fileName);
          return `\n📁 Dosya İçeriği (${fileName}):\n\`\`\`\n${content.substring(0, 1000)}${content.length > 1000 ? '...' : ''}\n\`\`\`\n`;
        }
      }

      // Dizin listeleme
      if (lowerInput.includes('listele') || lowerInput.includes('list')) {
        const files = await this.listDirectory();
        return `\n📂 Dizin İçeriği:\n${files.join('\n')}\n`;
      }

    } catch (error) {
      return `\n❌ Dosya işlemi hatası: ${error instanceof Error ? error.message : error}\n`;
    }

    return '';
  }

  private async readFile(filePath: string): Promise<string> {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Dosya bulunamadı: ${filePath}`);
    }
    
    const stats = fs.statSync(fullPath);
    if (stats.size > 1024 * 1024) {
      throw new Error(`Dosya çok büyük: ${(stats.size / 1024 / 1024).toFixed(1)}MB`);
    }
    
    return fs.readFileSync(fullPath, 'utf-8');
  }

  private async listDirectory(dirPath: string = '.'): Promise<string[]> {
    const fullPath = path.resolve(dirPath);
    const items = fs.readdirSync(fullPath);
    
    return items.map(item => {
      const itemPath = path.join(fullPath, item);
      const stats = fs.statSync(itemPath);
      const icon = stats.isDirectory() ? '📁' : '📄';
      const size = stats.isFile() ? ` (${stats.size} bytes)` : '';
      return `${icon} ${item}${size}`;
    });
  }

  private async getAIResponse(input: string, systemResponse: string): Promise<string> {
    try {
      // Önce LocoDex AI Agent servisini dene (Docker)
      const agentResponse = await fetch('http://localhost:3001/api/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.selectedModel,
          messages: [
            {
              role: 'system',
              content: `Sen LocoDex AI Agent'ısın. Terminal komutları çalıştırabilir, dosya okuyabilir, kod yazabilirsin. Kısa ve pratik yanıtlar ver. Markdown kod blokları kullan. Sistem çıktısı: ${systemResponse}`
            },
            ...this.conversationContext.slice(-10)
          ],
          temperature: 0.3,
          max_tokens: 1500,
          stream: false
        })
      });

      if (agentResponse.ok) {
        const data = await agentResponse.json();
        return data.choices[0]?.message?.content || 'Yanıt alınamadı.';
      }

      // Fallback: Direkt LM Studio
      console.log(chalk.yellow('🔄 AI Agent servisine ulaşılamadı, direkt LM Studio kullanılıyor...'));
      
      const directResponse = await fetch('http://localhost:1234/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.selectedModel,
          messages: [
            {
              role: 'system',
              content: `Sen LocoDex AI Agent'ısın. Terminal komutları çalıştırabilir, dosya okuyabilir, kod yazabilirsin. Kısa ve pratik yanıtlar ver. Markdown kod blokları kullan.`
            },
            ...this.conversationContext.slice(-10)
          ],
          temperature: 0.3,
          max_tokens: 1500,
          stream: false
        })
      });

      if (directResponse.ok) {
        const data = await directResponse.json();
        return data.choices[0]?.message?.content || 'Yanıt alınamadı.';
      } else {
        return 'AI servislerine bağlanılamadı. Docker ve LM Studio kontrol edin.';
      }

    } catch (error) {
      return `Bağlantı hatası: ${error instanceof Error ? error.message : error}`;
    }
  }

  private async handleCodeGeneration(aiResponse: string, userInput: string): Promise<void> {
    const codeBlocks = aiResponse.match(/```(\w+)?\n([\s\S]*?)\n```/g);
    if (!codeBlocks) return;

    console.log(chalk.blue(`🔍 ${codeBlocks.length} kod bloğu bulundu!`));

    for (let i = 0; i < codeBlocks.length; i++) {
      const block = codeBlocks[i];
      const match = block.match(/```(\w+)?\n([\s\S]*?)\n```/);
      if (!match) continue;

      const language = match[1] || 'txt';
      const code = match[2].trim();
      if (!code) continue;

      // Dosya adı oluştur
      const filename = this.generateFilename(userInput, language);
      const desktopPath = path.join(os.homedir(), 'Desktop');
      const fullPath = path.join(desktopPath, filename);

      try {
        fs.writeFileSync(fullPath, code, 'utf-8');
        console.log(chalk.green(`📁 Kod dosyası oluşturuldu: ${filename}`));
        
        // Çalıştırma önerisi
        if (this.shouldAutoExecute(userInput, language)) {
          console.log(chalk.yellow(`💡 Çalıştırmak için: "${this.getRunCommand(language, filename)}"`));
        }

      } catch (error) {
        console.log(chalk.red(`❌ Dosya oluşturma hatası: ${error}`));
      }
    }
  }

  private generateFilename(userInput: string, language: string): string {
    const lowerInput = userInput.toLowerCase();
    let baseName = 'agent_code';
    
    if (lowerInput.includes('calculator')) baseName = 'calculator';
    else if (lowerInput.includes('game')) baseName = 'game';
    else if (lowerInput.includes('server')) baseName = 'server';
    else if (lowerInput.includes('bot')) baseName = 'bot';
    else if (lowerInput.includes('api')) baseName = 'api';
    
    const extension = this.getFileExtension(language);
    const timestamp = Date.now().toString().slice(-6);
    
    return `${baseName}_${timestamp}.${extension}`;
  }

  private shouldAutoExecute(userInput: string, language: string): boolean {
    const executeKeywords = ['çalıştır', 'run', 'execute', 'test', 'dene'];
    const hasExecuteKeyword = executeKeywords.some(keyword => 
      userInput.toLowerCase().includes(keyword)
    );
    
    return hasExecuteKeyword && ['python', 'javascript'].includes(language);
  }

  private getFileExtension(language: string): string {
    const extensions: Record<string, string> = {
      python: 'py', javascript: 'js', typescript: 'ts',
      html: 'html', css: 'css', json: 'json', shell: 'sh', bash: 'sh'
    };
    return extensions[language] || 'txt';
  }

  private getRunCommand(language: string, filename: string): string {
    const commands: Record<string, string> = {
      python: `python3 ${filename}`,
      javascript: `node ${filename}`,
      shell: `bash ${filename}`,
      bash: `bash ${filename}`
    };
    return commands[language] || `open ${filename}`;
  }

  private async selectModel(): Promise<string> {
    const models = await this.discoverModels();
    
    if (models.length === 0) {
      console.log(chalk.red('❌ Hiç model bulunamadı!'));
      console.log(chalk.yellow('⚠️  Lütfen LM Studio\'yu başlatın ve model indirin.'));
      process.exit(1);
    }

    console.log(chalk.cyan('\n🤖 Mevcut AI Modelleri:'));
    models.forEach((model, index) => {
      const icon = model.provider === 'Ollama' ? '🦙' : '🎬';
      console.log(chalk.green(`  ${index + 1}. ${icon} ${model.name} (${model.provider})`));
    });

    const prompt = require('prompt-sync')({ sigint: true });
    const answer = prompt(chalk.cyan('\nKullanmak istediğiniz modelin numarasını seçin (enter = 1): '));
    
    const index = answer.trim() === '' ? 0 : parseInt(answer) - 1;
    if (index >= 0 && index < models.length) {
      console.log(chalk.green(`✓ ${models[index].name} modeli seçildi!`));
      return models[index].name;
    } else {
      console.log(chalk.yellow('Geçersiz seçim, ilk model kullanılıyor.'));
      return models[0].name;
    }
  }

  private async discoverModels(): Promise<Array<{name: string, provider: string}>> {
    const models: Array<{name: string, provider: string}> = [];
    
    try {
      // LM Studio check
      const lmResponse = await fetch('http://localhost:1234/v1/models');
      if (lmResponse.ok) {
        const data = await lmResponse.json();
        data.data?.forEach((model: any) => {
          models.push({ name: model.id, provider: 'LM Studio' });
        });
      }
    } catch (e) {
      // LM Studio not available
    }

    try {
      // Ollama check
      const ollamaResponse = await fetch('http://localhost:11434/api/tags');
      if (ollamaResponse.ok) {
        const data = await ollamaResponse.json();
        data.models?.forEach((model: any) => {
          models.push({ name: model.name, provider: 'Ollama' });
        });
      }
    } catch (e) {
      // Ollama not available
    }

    return models;
  }

  private updateContext(role: string, content: string): void {
    const tokens = Math.ceil(content.length / 4);
    this.conversationContext.push({ role, content, tokens });
    this.totalTokens += tokens;
    
    // Context limit kontrolü
    while (this.totalTokens > this.MAX_CONTEXT_LENGTH && this.conversationContext.length > 1) {
      const removed = this.conversationContext.shift();
      if (removed?.tokens) {
        this.totalTokens -= removed.tokens;
      }
    }
  }

  private displayContextInfo(): void {
    const percentage = ((this.totalTokens / this.MAX_CONTEXT_LENGTH) * 100).toFixed(1);
    const color = this.totalTokens > this.MAX_CONTEXT_LENGTH * 0.8 ? 'red' : 
                  this.totalTokens > this.MAX_CONTEXT_LENGTH * 0.6 ? 'yellow' : 'green';
    
    console.log(chalk[color](`🧠 Context: ${this.totalTokens.toLocaleString()}/${this.MAX_CONTEXT_LENGTH.toLocaleString()} tokens (${percentage}%)`));
  }
}