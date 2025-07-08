import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { packageJson } from './utils/packageInfo.js';

// UTF-8 encoding setup for Turkish characters
process.stdout.setDefaultEncoding('utf8');
process.stderr.setDefaultEncoding('utf8');
if (process.env.NODE_ENV !== 'test') {
  process.env.LANG = 'tr_TR.UTF-8';
  process.env.LC_ALL = 'tr_TR.UTF-8';
}

const execAsync = promisify(exec);

// Context tracking
let conversationContext: Array<{role: string, content: string, tokens?: number}> = [];
let totalTokens = 0;
const MAX_CONTEXT_LENGTH = 128000; // Gemma model limit

// ESC key handling
let isGenerating = false;
let escapePressed = false;
let escapePressCount = 0;
let currentGeneration: any = null;

const program = new Command();

program
  .name('locodex')
  .description('🚀 LocoDex - AI Destekli Yazılım Mühendisliği Platformu')
  .version(packageJson.version);

// Renkli LocoDex Logo ve Karşılama Ekranı
function displayWelcomeScreen(): void {
  console.clear();
  console.log(chalk.cyan('╔══════════════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan('║') + chalk.bold.magenta('                              ██╗      ██████╗  ██████╗ ██████╗ ███████╗██╗  ██╗') + chalk.cyan('║'));
  console.log(chalk.cyan('║') + chalk.bold.magenta('                              ██║     ██╔═══██╗██╔════╝██╔═══██╗██╔════╝╚██╗██╔╝') + chalk.cyan('║'));
  console.log(chalk.cyan('║') + chalk.bold.magenta('                              ██║     ██║   ██║██║     ██║   ██║███████╗ ╚███╔╝ ') + chalk.cyan('║'));
  console.log(chalk.cyan('║') + chalk.bold.magenta('                              ██║     ██║   ██║██║     ██║   ██║╚════██║ ██╔██╗ ') + chalk.cyan('║'));
  console.log(chalk.cyan('║') + chalk.bold.magenta('                              ███████╗╚██████╔╝╚██████╗╚██████╔╝███████║██╔╝ ██╗') + chalk.cyan('║'));
  console.log(chalk.cyan('║') + chalk.bold.magenta('                              ╚══════╝ ╚═════╝  ╚═════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝') + chalk.cyan('║'));
  console.log(chalk.cyan('║') + chalk.bold.yellow('                                    AI Destekli Yazılım Mühendisliği Platformu') + chalk.cyan('║'));
  console.log(chalk.cyan('╚══════════════════════════════════════════════════════════════════════════════╝'));
  console.log('');
  console.log(chalk.green('🌟 LocoDex CLI Hoş Geldiniz!'));
  console.log(chalk.gray('   Yapay zeka destekli yazılım geliştirme deneyiminiz başlıyor...'));
  console.log('');
  console.log(chalk.cyan('🛠️  Mevcut Özellikler:'));
  console.log(chalk.green('   💬 ') + chalk.white('Chat        - AI ile etkileşimli sohbet'));
  console.log(chalk.green('   🔍 ') + chalk.white('Deep Search - Derinlemesine araştırma'));
  console.log(chalk.green('   🤖 ') + chalk.white('Agent       - Akıllı yardımcı'));
  console.log(chalk.green('   📁 ') + chalk.white('Files       - Dosya işlemleri'));
  console.log(chalk.green('   ⚡ ') + chalk.white('Exec        - Komut çalıştırma'));
  console.log('');
  console.log(chalk.yellow('💡 İpucu: ') + chalk.gray('Çıkmak için ESC tuşuna basın'));
  console.log('');
}

// Kullanıcı girişi için güzel kutu
function createInputBox(prompt: string): void {
  console.log(chalk.cyan('┌─────────────────────────────────────────────────────────────────────────────┐'));
  console.log(chalk.cyan('│') + chalk.bold.white(' ' + prompt.padEnd(75)) + chalk.cyan('│'));
  console.log(chalk.cyan('└─────────────────────────────────────────────────────────────────────────────┘'));
}

// AI cevabı için güzel kutu
function createResponseBox(title: string): void {
  console.log('');
  console.log(chalk.green('┌─────────────────────────────────────────────────────────────────────────────┐'));
  console.log(chalk.green('│') + chalk.bold.white(' 🤖 ' + title.padEnd(72)) + chalk.green('│'));
  console.log(chalk.green('└─────────────────────────────────────────────────────────────────────────────┘'));
}

// Evet/Hayır onay kutusu
function createConfirmationBox(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    console.log('');
    console.log(chalk.yellow('┌─────────────────────────────────────────────────────────────────────────────┐'));
    console.log(chalk.yellow('│') + chalk.bold.white(' ❓ ' + question.padEnd(72)) + chalk.yellow('│'));
    console.log(chalk.yellow('│') + chalk.green(' [E]vet').padEnd(38) + chalk.red(' [H]ayır').padEnd(38) + chalk.yellow('│'));
    console.log(chalk.yellow('└─────────────────────────────────────────────────────────────────────────────┘'));
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question(chalk.cyan('Seçiminiz (E/H): '), (answer) => {
      rl.close();
      const choice = answer.toLowerCase();
      resolve(choice === 'e' || choice === 'evet' || choice === 'y' || choice === 'yes');
    });
  });
}

// File system tools (inspired by Gemini CLI)
async function readFile(filePath: string): Promise<string> {
  try {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Dosya bulunamadı: ${filePath}`);
    }
    
    const stats = fs.statSync(fullPath);
    if (stats.size > 1024 * 1024) { // 1MB limit
      throw new Error(`Dosya çok büyük: ${(stats.size / 1024 / 1024).toFixed(1)}MB (Maksimum: 1MB)`);
    }
    
    const content = fs.readFileSync(fullPath, 'utf-8');
    console.log(chalk.gray(`📁 Dosya okundu: ${filePath} (${stats.size} bytes)`));
    return content;
  } catch (error) {
    throw new Error(`Dosya okuma hatası: ${error instanceof Error ? error.message : error}`);
  }
}

async function writeFile(filePath: string, content: string): Promise<void> {
  try {
    // Eğer sadece dosya adı verilmişse masaüstüne kaydet
    let fullPath: string;
    if (path.dirname(filePath) === '.') {
      const desktopPath = path.join(os.homedir(), 'Desktop');
      fullPath = path.join(desktopPath, filePath);
    } else {
      fullPath = path.resolve(filePath);
    }
    
    const dir = path.dirname(fullPath);
    
    // Create directory if it doesn't exist
    fs.mkdirSync(dir, { recursive: true });
    
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(chalk.green(`✅ Dosya yazıldı: ${fullPath} (${content.length} karakter)`));
  } catch (error) {
    throw new Error(`Dosya yazma hatası: ${error instanceof Error ? error.message : error}`);
  }
}

async function listDirectory(dirPath: string = '.'): Promise<string[]> {
  try {
    const fullPath = path.resolve(dirPath);
    const items = fs.readdirSync(fullPath);
    
    const formatted = items.map(item => {
      const itemPath = path.join(fullPath, item);
      const stats = fs.statSync(itemPath);
      const icon = stats.isDirectory() ? '📁' : '📄';
      const size = stats.isFile() ? ` (${stats.size} bytes)` : '';
      return `${icon} ${item}${size}`;
    });
    
    console.log(chalk.cyan(`📂 Dizin içeriği: ${dirPath}`));
    formatted.forEach(item => console.log(`  ${item}`));
    
    return items;
  } catch (error) {
    throw new Error(`Dizin listeleme hatası: ${error instanceof Error ? error.message : error}`);
  }
}

async function executeCommand(command: string, cwd?: string): Promise<{stdout: string, stderr: string}> {
  try {
    console.log(chalk.yellow(`⚡ Komut çalıştırılıyor: ${command}`));
    const { stdout, stderr } = await execAsync(command, { 
      cwd: cwd || process.cwd(),
      timeout: 30000 // 30 second timeout
    });
    
    if (stdout) console.log(chalk.green(`📤 Çıktı:\n${stdout}`));
    if (stderr) console.log(chalk.red(`⚠️ Hata:\n${stderr}`));
    
    return { stdout, stderr };
  } catch (error) {
    throw new Error(`Komut çalıştırma hatası: ${error instanceof Error ? error.message : error}`);
  }
}

// Token counting (simplified estimation)
function estimateTokens(text: string): number {
  // Rough estimation: 1 token ≈ 4 characters for Turkish
  return Math.ceil(text.length / 4);
}

// ESC key handler
function setupEscapeHandler(): void {
  // Only set raw mode if available and not already set
  if (process.stdin.setRawMode && !process.stdin.isRaw) {
    try {
      process.stdin.setRawMode(true);
    } catch (error) {
      console.log(chalk.gray('Raw mode not available, using normal input mode'));
    }
  }
  process.stdin.resume();
  
  const keyHandler = (key: any) => {
    // ESC key is \u001b
    if (key.toString() === '\u001b') {
      escapePressCount++;
      
      if (isGenerating) {
        // First ESC: Cancel generation
        if (escapePressCount === 1) {
          console.log(chalk.yellow('\n⏹️  Yanıt iptal edildi! (Çıkmak için tekrar ESC\'ye basın)'));
          escapePressed = true;
          if (currentGeneration) {
            currentGeneration.abort();
          }
        } else {
          // Second ESC: Exit CLI
          console.log(chalk.red('\n👋 LocoDex CLI kapatılıyor...'));
          cleanupEscapeHandler();
          process.exit(0);
        }
      } else {
        // Direct exit when not generating
        console.log(chalk.red('\n👋 LocoDex CLI kapatılıyor...'));
        cleanupEscapeHandler();
        process.exit(0);
      }
    } else {
      // Reset escape count on any other key
      escapePressCount = 0;
    }
  };

  process.stdin.on('data', keyHandler);
  
  // Store the handler for cleanup
  (process.stdin as any)._escKeyHandler = keyHandler;
}

function cleanupEscapeHandler(): void {
  if ((process.stdin as any)._escKeyHandler) {
    process.stdin.removeListener('data', (process.stdin as any)._escKeyHandler);
    delete (process.stdin as any)._escKeyHandler;
  }
  
  if (process.stdin.setRawMode && process.stdin.isRaw) {
    try {
      process.stdin.setRawMode(false);
    } catch (error) {
      // Ignore cleanup errors
    }
  }
  process.stdin.pause();
}

function updateContext(role: string, content: string): void {
  const tokens = estimateTokens(content);
  conversationContext.push({ role, content, tokens });
  totalTokens += tokens;
  
  // Trim context if it exceeds limit
  while (totalTokens > MAX_CONTEXT_LENGTH && conversationContext.length > 1) {
    const removed = conversationContext.shift();
    if (removed?.tokens) {
      totalTokens -= removed.tokens;
    }
  }
}

function displayContextInfo(): void {
  const percentage = ((totalTokens / MAX_CONTEXT_LENGTH) * 100).toFixed(1);
  const color = totalTokens > MAX_CONTEXT_LENGTH * 0.8 ? 'red' : 
                totalTokens > MAX_CONTEXT_LENGTH * 0.6 ? 'yellow' : 'green';
  
  console.log(chalk[color](`🧠 Context: ${totalTokens.toLocaleString()}/${MAX_CONTEXT_LENGTH.toLocaleString()} tokens (${percentage}%)`));
  console.log(chalk.gray(`💬 Mesaj sayısı: ${conversationContext.length}`));
}

// Enhanced AI function with system capabilities
async function processWithTools(input: string, model: string): Promise<string> {
  const thinking = ora('AI Ajan düşünüyor...').start();
  isGenerating = true;
  escapePressed = false;
  escapePressCount = 0;
  
  try {
    // Check for tool usage patterns
    let systemResponse = '';
    
    // File operations
    if (input.includes('dosya oku') || input.includes('read file')) {
      const fileMatch = input.match(/["']([^"']+)["']|(\S+\.\w+)/);
      if (fileMatch) {
        const fileName = fileMatch[1] || fileMatch[2];
        try {
          const content = await readFile(fileName);
          systemResponse += `\n📁 Dosya İçeriği (${fileName}):\n\`\`\`\n${content.substring(0, 1000)}${content.length > 1000 ? '...' : ''}\n\`\`\`\n`;
        } catch (error) {
          systemResponse += `\n❌ Dosya okuma hatası: ${error instanceof Error ? error.message : error}\n`;
        }
      }
    }
    
    // Directory listing
    if (input.includes('dosya listele') || input.includes('ls') || input.includes('list files')) {
      try {
        await listDirectory();
        systemResponse += '\n📂 Dizin içeriği yukarıda gösterildi.\n';
      } catch (error) {
        systemResponse += `\n❌ Dizin listeleme hatası: ${error instanceof Error ? error.message : error}\n`;
      }
    }
    
    // Command execution
    if (input.includes('komut çalıştır') || input.includes('run command') || input.includes('execute')) {
      const cmdMatch = input.match(/["']([^"']+)["']|`([^`]+)`/);
      if (cmdMatch) {
        const command = cmdMatch[1] || cmdMatch[2];
        try {
          const result = await executeCommand(command);
          systemResponse += `\n⚡ Komut Sonucu:\n${result.stdout}\n`;
        } catch (error) {
          systemResponse += `\n❌ Komut hatası: ${error instanceof Error ? error.message : error}\n`;
        }
      }
    }
    
    // Update context
    updateContext('user', input + systemResponse);
    
    // Check if cancelled
    if (escapePressed) {
      thinking.stop();
      isGenerating = false;
      return '⏹️ Yanıt iptal edildi.';
    }

    // LM Studio API çağrısı
    const controller = new AbortController();
    currentGeneration = controller;
    
    const response = await fetch('http://localhost:1234/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: `Sen LocoDex AI Ajanısın. Kullanıcının kod taleplerini DOĞRUDAN YAP. Kod yazdığında markdown kod blokları kullan. Kısa ve pratik yanıtlar ver. Otomatik dosya oluşturma ve çalıştırma yapılır. Context: ${totalTokens}/${MAX_CONTEXT_LENGTH} tokens.`
          },
          ...conversationContext.slice(-10) // Son 10 mesaj
        ],
        temperature: 0.3,
        max_tokens: 1500,
        stream: false
      })
    });

    thinking.stop();
    isGenerating = false;
    currentGeneration = null;

    // Check if cancelled after fetch
    if (escapePressed) {
      return '⏹️ Yanıt iptal edildi.';
    }

    if (response.ok) {
      const data = await response.json();
      const aiResponse = data.choices[0]?.message?.content || 'Yanıt alınamadı.';
      
      // Update context with AI response
      updateContext('assistant', aiResponse);
      
      // Otomatik dosya oluşturma ve çalıştırma
      await handleAutoFileCreation(aiResponse, input);
      
      return systemResponse + aiResponse;
    } else {
      console.log(chalk.red('❌ API Hatası: ') + response.statusText);
      console.log(chalk.yellow('🔄 Simülasyon moduna geçiliyor...'));
      return systemResponse + `Bu bir simüle edilmiş yanıt. LM Studio API'sine bağlanılamadı. "${input}" sorusu için gerçek yanıt verilemedi.`;
    }
    
  } catch (error) {
    thinking.stop();
    isGenerating = false;
    currentGeneration = null;
    
    // Check if it was cancelled
    if (escapePressed || (error instanceof Error && error.name === 'AbortError')) {
      return '⏹️ Yanıt iptal edildi.';
    }
    
    console.log(chalk.red('❌ Bağlantı Hatası: ') + (error instanceof Error ? error.message : 'Bilinmeyen hata'));
    console.log(chalk.yellow('🔄 Simülasyon moduna geçiliyor...'));
    return `Bu bir simüle edilmiş yanıt. LM Studio'ya bağlanılamadı. "${input}" sorusu için gerçek yanıt verilemedi.`;
  }
}

// Otomatik dosya oluşturma ve çalıştırma fonksiyonu
async function handleAutoFileCreation(aiResponse: string, userInput: string): Promise<void> {
  console.log(chalk.blue('🔍 Kod blokları aranıyor...'));
  
  // Kod blokları ara
  const codeBlocks = aiResponse.match(/```(\w+)?\n([\s\S]*?)\n```/g);
  if (!codeBlocks) {
    console.log(chalk.yellow('📝 Kod bloğu bulunamadı'));
    return;
  }

  console.log(chalk.green(`✅ ${codeBlocks.length} kod bloğu bulundu!`));

  for (let i = 0; i < codeBlocks.length; i++) {
    const block = codeBlocks[i];
    const match = block.match(/```(\w+)?\n([\s\S]*?)\n```/);
    if (!match) continue;

    const language = match[1] || 'txt';
    const code = match[2].trim();

    if (!code) continue;

    // Akıllı dosya adı belirleme
    let filename = generateSmartFilename(userInput, language);
    
    // Masaüstü yolu
    const desktopPath = path.join(os.homedir(), 'Desktop');
    const fullPath = path.join(desktopPath, filename);

    try {
      // Dosyayı oluştur
      await writeFile(filename, code);
      console.log(chalk.green(`📁 Dosya oluşturuldu: ${filename}`));
      console.log(chalk.gray(`   Konum: ${fullPath}`));

      // Otomatik çalıştırma kararı
      const shouldExecute = shouldAutoExecute(userInput, language);
      
      if (shouldExecute) {
        console.log(chalk.blue(`🚀 Kod otomatik çalıştırılıyor...`));
        
        if (language === 'python') {
          await executePythonFile(fullPath);
        } else if (language === 'javascript') {
          await executeJavaScriptFile(fullPath);
        } else if (language === 'shell' || language === 'bash') {
          await executeShellFile(fullPath);
        }
      } else {
        console.log(chalk.cyan(`💡 Çalıştırmak için: ${getRunCommand(language, filename)}`));
      }

    } catch (error) {
      console.error(chalk.red(`❌ Dosya oluşturma hatası: ${error}`));
    }
  }
}

function generateSmartFilename(userInput: string, language: string): string {
  const lowerInput = userInput.toLowerCase();
  
  let baseName = 'generated_code';
  
  if (lowerInput.includes('monte carlo')) {
    baseName = 'monte_carlo';
  } else if (lowerInput.includes('web scraper') || lowerInput.includes('scraper')) {
    baseName = 'web_scraper';
  } else if (lowerInput.includes('calculator') || lowerInput.includes('hesap')) {
    baseName = 'calculator';
  } else if (lowerInput.includes('game') || lowerInput.includes('oyun')) {
    baseName = 'game';
  } else if (lowerInput.includes('api')) {
    baseName = 'api_client';
  } else if (lowerInput.includes('bot')) {
    baseName = 'bot';
  } else if (lowerInput.includes('server')) {
    baseName = 'server';
  } else if (lowerInput.includes('chat')) {
    baseName = 'chat_app';
  }
  
  const extension = getFileExtension(language);
  const timestamp = Date.now().toString().slice(-6);
  
  return `${baseName}_${timestamp}.${extension}`;
}

function shouldAutoExecute(userInput: string, language: string): boolean {
  const lowerInput = userInput.toLowerCase();
  
  const executeKeywords = [
    'çalıştır', 'run', 'execute', 'test', 'dene', 'başlat', 'start'
  ];
  
  const hasExecuteKeyword = executeKeywords.some(keyword => 
    lowerInput.includes(keyword)
  );
  
  const autoExecuteLanguages = ['python', 'javascript'];
  
  return hasExecuteKeyword && autoExecuteLanguages.includes(language);
}

function getFileExtension(language: string): string {
  const extensions: Record<string, string> = {
    python: 'py',
    javascript: 'js',
    typescript: 'ts',
    html: 'html',
    css: 'css',
    json: 'json',
    yaml: 'yml',
    markdown: 'md',
    shell: 'sh',
    bash: 'sh'
  };

  return extensions[language] || 'txt';
}

function getRunCommand(language: string, filename: string): string {
  const commands: Record<string, string> = {
    python: `python3 ${filename}`,
    javascript: `node ${filename}`,
    typescript: `ts-node ${filename}`,
    shell: `bash ${filename}`,
    bash: `bash ${filename}`
  };
  
  return commands[language] || `open ${filename}`;
}

async function executePythonFile(filePath: string): Promise<void> {
  return new Promise((resolve) => {
    console.log(chalk.blue(`🐍 Python kodu çalıştırılıyor: ${path.basename(filePath)}`));
    
    const python = spawn('python3', [filePath]);
    
    python.stdout.on('data', (data) => {
      console.log(chalk.green(`📄 Çıktı: ${data.toString().trim()}`));
    });
    
    python.stderr.on('data', (data) => {
      console.error(chalk.red(`❌ Hata: ${data.toString().trim()}`));
    });
    
    python.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green(`✅ Python kodu başarıyla çalıştırıldı`));
      } else {
        console.log(chalk.red(`❌ Kod hata ile sonlandı (kod: ${code})`));
      }
      resolve();
    });
    
    python.on('error', (error) => {
      console.error(chalk.red(`❌ Python çalıştırma hatası: ${error.message}`));
      resolve();
    });
  });
}

async function executeJavaScriptFile(filePath: string): Promise<void> {
  return new Promise((resolve) => {
    console.log(chalk.blue(`🟨 JavaScript kodu çalıştırılıyor: ${path.basename(filePath)}`));
    
    const node = spawn('node', [filePath]);
    
    node.stdout.on('data', (data) => {
      console.log(chalk.green(`📄 Çıktı: ${data.toString().trim()}`));
    });
    
    node.stderr.on('data', (data) => {
      console.error(chalk.red(`❌ Hata: ${data.toString().trim()}`));
    });
    
    node.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green(`✅ JavaScript kodu başarıyla çalıştırıldı`));
      } else {
        console.log(chalk.red(`❌ Kod hata ile sonlandı (kod: ${code})`));
      }
      resolve();
    });
    
    node.on('error', (error) => {
      console.error(chalk.red(`❌ Node.js çalıştırma hatası: ${error.message}`));
      resolve();
    });
  });
}

async function executeShellFile(filePath: string): Promise<void> {
  return new Promise((resolve) => {
    console.log(chalk.blue(`🐚 Shell scripti çalıştırılıyor: ${path.basename(filePath)}`));
    
    const shell = spawn('bash', [filePath]);
    
    shell.stdout.on('data', (data) => {
      console.log(chalk.green(`📄 Çıktı: ${data.toString().trim()}`));
    });
    
    shell.stderr.on('data', (data) => {
      console.error(chalk.red(`❌ Hata: ${data.toString().trim()}`));
    });
    
    shell.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green(`✅ Shell scripti başarıyla çalıştırıldı`));
      } else {
        console.log(chalk.red(`❌ Script hata ile sonlandı (kod: ${code})`));
      }
      resolve();
    });
    
    shell.on('error', (error) => {
      console.error(chalk.red(`❌ Shell çalıştırma hatası: ${error.message}`));
      resolve();
    });
  });
}

// Model discovery function
async function discoverModels() {
  const spinner = ora('Mevcut modeller keşfediliyor...').start();
  const models: Array<{name: string, provider: string, description?: string}> = [];
  
  try {
    // Check Ollama
    try {
      const ollamaResponse = await fetch('http://localhost:11434/api/tags');
      if (ollamaResponse.ok) {
        const ollamaData = await ollamaResponse.json();
        ollamaData.models?.forEach((model: any) => {
          models.push({
            name: model.name,
            provider: 'Ollama',
            description: `Boyut: ${(model.size / (1024 * 1024 * 1024)).toFixed(1)}GB`
          });
        });
      }
    } catch (err) {
      console.log(chalk.yellow('Ollama bulunamadı'));
    }

    // Check LM Studio
    try {
      const lmstudioResponse = await fetch('http://localhost:1234/v1/models');
      if (lmstudioResponse.ok) {
        const lmstudioData = await lmstudioResponse.json();
        lmstudioData.data?.forEach((model: any) => {
          models.push({
            name: model.id,
            provider: 'LM Studio',
            description: 'LM Studio lokal model'
          });
        });
      }
    } catch (err) {
      console.log(chalk.yellow('LM Studio bulunamadı'));
    }

    spinner.succeed(`${models.length} model bulundu`);
    return models;
  } catch (error) {
    spinner.fail('Model keşfi başarısız');
    throw error;
  }
}

// Model selection function
async function selectModel(): Promise<string> {
  const models = await discoverModels();
  
  if (models.length === 0) {
    console.log(chalk.red('❌ Hiç model bulunamadı!'));
    console.log(chalk.yellow('⚠️  Lütfen Ollama veya LM Studio\'yu başlatın ve model indirin.'));
    console.log(chalk.cyan('\n💡 Örnek kurulum:'));
    console.log(chalk.green('  ollama pull llama3.2'));
    console.log(chalk.green('  ollama pull codellama'));
    process.exit(1);
  }

  console.log(chalk.cyan('\n🤖 Mevcut AI Modelleri:'));
  models.forEach((model, index) => {
    const icon = model.provider === 'Ollama' ? '🦙' : '🎬';
    console.log(chalk.green(`  ${index + 1}. ${icon} ${model.name} (${model.provider})`));
    if (model.description) {
      console.log(chalk.gray(`     ${model.description}`));
    }
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });
  
  // Set UTF-8 encoding for Turkish characters
  if (process.stdin.setEncoding) {
    process.stdin.setEncoding('utf8');
  }

  return new Promise((resolve) => {
    rl.question(chalk.cyan('\nKullanmak istediğiniz modelin numarasını seçin: '), (answer) => {
      const index = parseInt(answer) - 1;
      if (index >= 0 && index < models.length) {
        console.log(chalk.green(`✓ ${models[index].name} modeli seçildi!`));
        rl.close();
        resolve(models[index].name);
      } else {
        console.log(chalk.red('❌ Geçersiz seçim!'));
        rl.close();
        process.exit(1);
      }
    });
  });
}

// Enhanced chat function
async function startChat(model: string) {
  // Karşılama ekranını göster
  displayWelcomeScreen();
  
  console.log(chalk.cyan(`💬 ${model} modeli ile sohbet başlatılıyor...`));
  console.log(chalk.gray(`📊 Context Limit: ${MAX_CONTEXT_LENGTH.toLocaleString()} tokens`));
  
  const spinner = ora('Model yükleniyor...').start();
  await new Promise(resolve => setTimeout(resolve, 2000));
  spinner.succeed('Model hazır!');
  
  // Reset context for new conversation
  conversationContext = [];
  totalTokens = 0;
  
  createResponseBox('LocoDex AI Hazır!');
  console.log(chalk.green('🤖 Merhaba! Size nasıl yardımcı olabilirim?'));
  console.log(chalk.cyan('🛠️  Yeteneklerim:'));
  console.log('  • 📁 Dosya okuma/yazma');
  console.log('  • ⚡ Komut çalıştırma');
  console.log('  • 📂 Dizin listeleme');
  console.log('  • 💻 Kod oluşturma');
  console.log(chalk.gray('💡 İpucu: Çıkmak için "exit" yazın veya ESC\'ye basın'));
  console.log(chalk.gray('⚡ Yanıt sırasında ESC: İptal, tekrar ESC: Çık\n'));

  // Setup ESC key handling
  setupEscapeHandler();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });
  
  // Set UTF-8 encoding for Turkish characters
  if (process.stdin.setEncoding) {
    process.stdin.setEncoding('utf8');
  }

  const chatLoop = (): Promise<void> => {
    return new Promise((resolve) => {
      let isRunning = true;
      
      const handleExit = () => {
        if (!isRunning) return;
        isRunning = false;
        console.log(chalk.yellow('\n👋 Görüşmek üzere!'));
        cleanupEscapeHandler();
        rl.close();
        resolve();
      };

      // Handle Ctrl+C gracefully
      const sigintHandler = () => {
        handleExit();
      };
      process.on('SIGINT', sigintHandler);

      const askQuestion = () => {
        if (!isRunning) return;
        
        // Display context info before each question
        if (conversationContext.length > 0) {
          displayContextInfo();
        }
        
        createInputBox('👤 Mesajınızı yazın:');
        rl.question(chalk.cyan('> '), async (input) => {
          if (!isRunning) return;
          
          if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'çık') {
            handleExit();
            return;
          }

          if (!input.trim()) {
            setImmediate(askQuestion);
            return;
          }

          try {
            const response = await processWithTools(input, model);
            if (isRunning) {
              createResponseBox('LocoDex AI Cevabı');
              console.log(response + '\n');
              setImmediate(askQuestion);
            }
          } catch (error) {
            if (isRunning) {
              console.log(chalk.red('❌ Hata: ') + (error instanceof Error ? error.message : error));
              setImmediate(askQuestion);
            }
          }
        });
      };

      // Start the conversation loop
      askQuestion();

      // Cleanup function to be called when the promise resolves
      rl.on('close', () => {
        if (isRunning) {
          isRunning = false;
          cleanupEscapeHandler();
          process.removeListener('SIGINT', sigintHandler);
          resolve();
        }
      });
    });
  };

  await chatLoop();
}

program
  .option('-m, --model <model>', 'AI model seçimi')
  .option('-s, --select-model', 'Model seçim menüsünü aç')
  .option('--list-models', 'Mevcut modelleri listele')
  .option('--context-info', 'Context bilgilerini göster')
  .action(async (options) => {
    try {
      console.log(chalk.cyan('🚀 LocoDex CLI - AI Destekli Yazılım Mühendisliği\n'));

      if (options.contextInfo) {
        displayContextInfo();
        return;
      }

      if (options.listModels) {
        await discoverModels();
        return;
      }

      let selectedModel = options.model;

      if (!selectedModel || options.selectModel) {
        selectedModel = await selectModel();
      }

      await startChat(selectedModel);
      
    } catch (error) {
      console.error(chalk.red('❌ Hata:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Alt komutlar
program
  .command('models')
  .description('Model yönetimi')
  .action(async () => {
    await discoverModels();
  });

program
  .command('chat')
  .description('AI ile sohbet başlat')
  .option('-m, --model <model>', 'Kullanılacak model')
  .action(async (options) => {
    // Subcommand için ana CLI handlers'ı temizle
    cleanupEscapeHandler();
    process.removeAllListeners('SIGINT');
    
    let model = options.model;
    if (!model) {
      model = await selectModel();
    }
    await startChat(model);
  });

program
  .command('files')
  .description('Dosya sistemi araçları')
  .option('-l, --list [dir]', 'Dizin listele')
  .option('-r, --read <file>', 'Dosya oku')
  .option('-w, --write <file>', 'Dosya yaz')
  .action(async (options) => {
    try {
      if (options.list !== undefined) {
        const dir = typeof options.list === 'string' ? options.list : '.';
        await listDirectory(dir);
      } else if (options.read) {
        const content = await readFile(options.read);
        console.log(chalk.cyan('\n📄 Dosya İçeriği:'));
        console.log(content);
      } else if (options.write) {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        rl.question('İçerik yazın (CTRL+D ile bitirin):\n', async (content) => {
          await writeFile(options.write, content);
          rl.close();
        });
      } else {
        console.log(chalk.yellow('Kullanım: locodex files --list [dir] | --read <file> | --write <file>'));
      }
    } catch (error) {
      console.error(chalk.red('❌ Hata:'), error instanceof Error ? error.message : error);
    }
  });

program
  .command('exec <command>')
  .description('Sistem komutu çalıştır')
  .action(async (command) => {
    try {
      await executeCommand(command);
    } catch (error) {
      console.error(chalk.red('❌ Hata:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('code')
  .description('Kod analizi ve geliştirme')
  .option('-f, --file <file>', 'Analiz edilecek dosya')
  .action(async (options) => {
    const { CodeManager } = await import('./commands/CodeManager.js');
    const codeManager = new CodeManager();
    
    if (options.file) {
      await codeManager.analyzeFile(options.file);
    } else {
      await codeManager.interactive();
    }
  });

program
  .command('setup')
  .description('LocoDex kurulum ve yapılandırma')
  .action(async () => {
    const { SetupManager } = await import('./commands/SetupManager.js');
    const setup = new SetupManager();
    await setup.run();
  });

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n👋 LocoDex CLI kapatılıyor...'));
  displayContextInfo();
  process.exit(0);
});


program
  .command('deep-search')
  .description('LocoDex Derin Araştırma Modülü')
  .action(async () => {
    // Subcommand için ana CLI handlers'ı temizle
    cleanupEscapeHandler();
    process.removeAllListeners('SIGINT');
    
    const { DeepSearchManager } = await import('./commands/DeepSearchManager.js');
    const deepSearchManager = new DeepSearchManager();
    await deepSearchManager.start();
  });

program
  .command('agent')
  .description('LocoDex AI Agent (Sohbet + Terminal)')
  .option('-m, --model <model>', 'Kullanılacak model')
  .action(async (options) => {
    // Subcommand için ana CLI handlers'ı temizle
    cleanupEscapeHandler();
    process.removeAllListeners('SIGINT');
    
    const { AgentManager } = await import('./commands/AgentManager.js');
    const agentManager = new AgentManager();
    await agentManager.start(options.model);
  });

program
  .command('documents')
  .description('Kurumsal Belge Yönetimi ve RAG Sistemi')
  .action(async () => {
    // Subcommand için ana CLI handlers'ı temizle
    cleanupEscapeHandler();
    process.removeAllListeners('SIGINT');
    
    const { DocumentManager } = await import('./commands/DocumentManager.js');
    const documentManager = new DocumentManager();
    await documentManager.start();
  });

program.parse();

