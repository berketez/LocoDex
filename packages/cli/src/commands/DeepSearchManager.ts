import WebSocket from 'ws';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import * as readline from 'readline';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export class DeepSearchManager {
  private rl: readline.Interface;
  private ws: WebSocket | null = null;
  private spinner: Ora;
  private selectedModel: string | null = null;
  private researchTimeout: NodeJS.Timeout | null = null;
  private progressInterval: NodeJS.Timeout | null = null;
  private startTime: number = 0;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    this.spinner = ora();
  }

  private connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.spinner.start('Derin araştırma servisine bağlanılıyor...');
      try {
        const ws = new WebSocket('ws://localhost:8001/research_ws');
        this.ws = ws;

        ws.on('open', () => {
          this.spinner.succeed('Derin araştırma servisine başarıyla bağlanıldı!');
          
          // Delay before showing prompt
          setTimeout(() => {
            this.promptForTopic();
          }, 1000);
          resolve();
        });

        ws.on('message', (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString());
            
            // Don't interfere with readline for initial connection message
            if (message.type === 'progress' && message.message && message.message.includes('Bağlantı kuruldu')) {
              console.log(chalk.green('✓ Servis hazır ve araştırma isteklerini bekliyor'));
              return;
            }
            
            // Keep connection alive by responding to keepalive
            if (message.type === 'keepalive') {
              // Just acknowledge keepalive, don't show to user
              return;
            }
            
            // Clear timeouts for actual research messages
            if (this.researchTimeout) {
              clearTimeout(this.researchTimeout);
              this.researchTimeout = null;
            }
            
            if (this.progressInterval) {
              clearInterval(this.progressInterval);
              this.progressInterval = null;
            }
            
            if (this.spinner.isSpinning) {
              this.spinner.stop();
            }

          if (message.type === 'progress') {
            
            // Research progress mesajlarını güzelleştir ve göster
            let progressText = message.message;
            
            // Sadece çok gereksiz detayları filtrele, araştırma adımlarını göster
            if (progressText.includes('hakkında ne var bakalım')) {
              progressText = '💭 Kaynak içeriği inceleniyor...';
            }
            
            // Alt konu isimlerini sadece çok uzunsa kısalt (100+ karakter)
            if (progressText.length > 120) {
              if (progressText.includes('konusunu araştırıyorum')) {
                const match = progressText.match(/🔎 '(.+?)' konusunu araştırıyorum/);
                if (match && match[1].length > 80) {
                  progressText = `🔎 '${match[1].substring(0, 80)}...' konusunu araştırıyorum`;
                }
              }
            }
            
            // Step bilgisini daha sık göster
            if (message.step !== undefined && message.step > 0) {
              const percentage = Math.round(message.step * 100);
              progressText = `[%${percentage}] ${progressText}`;
            }
            
            // Progress mesajını direkt göster, spinner kullanma
            console.log(chalk.cyan(`📋 ${progressText}`));
            return;
          } else if (message.type === 'result') {
            console.log(chalk.green('\n--- Araştırma Sonucu ---'));
            console.log(message.data);
            console.log(chalk.green('--- Sonuç Sonu ---'));
            this.promptForTopic();
          } else if (message.type === 'error') {
            this.spinner.stop();
            
            // Ignore "Topic is required" error during initial connection
            if (message.data && message.data.includes('Topic is required')) {
              console.log(chalk.gray('DEBUG: Initial connection error ignored (Topic is required)'));
              return;
            }
            
            console.log(chalk.red(`\n❌ Hata: ${message.data}`));
            
            // API key hatası için özel mesaj
            if (message.data.includes('API anahtarları')) {
              console.log(chalk.yellow('\n💡 Çözüm:'));
              console.log(chalk.gray('   1. Proje kök dizininde .env dosyası oluşturun'));
              console.log(chalk.gray('   2. Aşağıdaki anahtarları ekleyin:'));
              console.log(chalk.gray('      # API anahtarları gerekli değil (lokal modeller kullanılıyor)'));
              console.log(chalk.gray('      TAVILY_API_KEY=your_key_here'));
              console.log(chalk.gray('   3. API anahtarlarını ilgili sitelerden alın:'));
              console.log(chalk.gray('      # Lokal model servisleri: Ollama, LM Studio'));
              console.log(chalk.gray('      - Tavily: https://tavily.com\n'));
            }
            
            this.promptForTopic();
          }
          } catch (error) {
            console.log(chalk.red(`WebSocket mesaj hatası: ${error}`));
          }
        });

        ws.on('close', (code, reason) => {
          this.spinner.fail('Derin araştırma servisiyle bağlantı kesildi.');
          console.log(chalk.gray(`Bağlantı kesilme nedeni: ${code} - ${reason}`));
          this.rl.close();
        });

        ws.on('error', (error) => {
          ws.terminate();
          this.ws = null;
          reject(error);
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  public async start(): Promise<void> {
    console.log(chalk.cyan('🤖 LocoDex Deep Research CLI Başlatılıyor...\n'));

    try {
      await this.selectModel();
    } catch (error) {
      // Model bulunamadı, çıkış yap
      process.exit(1);
    }

    // Docker servislerini otomatik başlat
    await this.ensureDockerServices();
    
    // Model yükleme kontrolü
    if (this.selectedModel) {
      this.spinner.start(chalk.yellow(`🔄 ${this.selectedModel} modeli kontrol ediliyor...`));
      
      // Model kontrolü uzun sürebilir, kullanıcıyı bilgilendir
      let checkInterval = setInterval(() => {
        if (this.spinner.isSpinning) {
          this.spinner.text = chalk.yellow(`🔄 ${this.selectedModel} modeli kontrol ediliyor... (Model yükleniyorsa bu biraz zaman alabilir)`);
        }
      }, 3000);
      
      const isModelReady = await this.checkModelAvailability(this.selectedModel);
      clearInterval(checkInterval);
      
      if (isModelReady) {
        this.spinner.succeed(chalk.green(`✓ ${this.selectedModel} modeli hazır ve kullanıma uygun!`));
      } else {
        this.spinner.fail(chalk.red(`✗ ${this.selectedModel} modeli yanıt vermiyor!`));
        console.log(chalk.yellow('\n💡 Olası çözümler:'));
        console.log(chalk.gray('   1. LM Studio veya Ollama\'nın çalıştığından emin olun'));
        console.log(chalk.gray('   2. Modelin tam olarak yüklendiğinden emin olun'));
        console.log(chalk.gray('   3. Model adının doğru olduğundan emin olun'));
        console.log(chalk.gray('   4. Başka bir model deneyin veya varsayılan modelleri kullanın\n'));
        this.rl.close();
        return;
      }
    }

    try {
      await this.connect();
    } catch (error) {
      this.spinner.fail(chalk.red('Deep research servisi bulunamadı.'));
      console.log(chalk.yellow('\n💡 Servis çalışmıyor. Çözüm:'));
      console.log(chalk.gray('   1. Docker servislerini başlatın: docker-compose up -d'));
      console.log(chalk.gray('   2. Veya manuel olarak servisi başlatın'));
      console.log(chalk.gray('   3. Port 8001\'in açık olduğundan emin olun\n'));
      if (error instanceof Error) {
        console.log(chalk.gray(`   Hata detayı: ${error.message}`));
      }
      this.rl.close();
    }
  }

  private promptForTopic(): void {
    if (this.spinner.isSpinning) {
      this.spinner.stop();
    }

    // Ensure clean console state
    console.log(''); // Add a newline for better formatting
    console.log(chalk.cyan('💡 Sistem hazır! Araştırma yapmak için bir konu girin.'));
    
    // Synchronous input with fallback
    let topic = '';
    try {
      const prompt = require('prompt-sync')({ sigint: true });
      topic = prompt(chalk.yellow('🔍 Araştırma konusunu girin (çıkmak için "exit" yazın): '));
      console.log(chalk.red(`🚨 TOPIC RECEIVED: "${topic}"`));
    } catch (error) {
      console.log(chalk.red('❌ Input sistemi hatası. readline kullanılıyor...'));
      this.rl.question(chalk.yellow('🔍 Araştırma konusunu girin (çıkmak için "exit" yazın): '), (inputTopic) => {
        topic = inputTopic;
        console.log(chalk.red(`🚨 TOPIC RECEIVED (FALLBACK): "${topic}"`));
        this.processTopicInput(topic);
        return;
      });
      return;
    }
    
    this.processTopicInput(topic);
  }

  private processTopicInput(topic: string): void {
    if (topic.toLowerCase() === 'exit') {
      this.ws?.close();
      this.rl.close();
      return;
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
        // Araştırma başlangıç bildirimi
        console.log(chalk.cyan(`\n🔎 "${topic}" konusu araştırılıyor...`));
        console.log(chalk.gray('📝 Derin araştırma başlatıldı, bu işlem biraz zaman alabilir...\n'));
        
        const message = { topic, model: this.selectedModel };
        
        try {
          this.ws.send(JSON.stringify(message));
          console.log(chalk.green('✓ İstek gönderildi, yanıt bekleniyor...'));
          
          // Start progress tracking
          this.startTime = Date.now();
          this.spinner.start('Araştırma servisi işliyor... (0s)');
          
          // Update progress every 2 seconds
          this.progressInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            if (this.spinner.isSpinning) {
              this.spinner.text = `Araştırma servisi işliyor... (${elapsed}s)`;
            }
          }, 2000);
          
          // Add timeout for research request (5 minutes for deep research)
          this.researchTimeout = setTimeout(() => {
            if (this.spinner.isSpinning) {
              // Clear progress interval
              if (this.progressInterval) {
                clearInterval(this.progressInterval);
                this.progressInterval = null;
              }
              
              this.spinner.fail(chalk.red('⏰ Araştırma isteği zaman aşımına uğradı (5 dakika)'));
              console.log(chalk.yellow('💡 Backend servisi yanıt vermiyor. Olası nedenler:'));
              console.log(chalk.gray('   1. API anahtarları eksik veya hatalı (.env dosyası)'));
              console.log(chalk.gray('   2. Lokal model servisleri (Ollama/LM Studio) gerekli'));
              console.log(chalk.gray('   3. Docker servisleri düzgün çalışmıyor'));
              console.log(chalk.gray('   4. Network bağlantı problemi\n'));
              this.promptForTopic();
            }
          }, 300000);  // 5 dakika = 300000ms
          
        } catch (error) {
          console.log(chalk.red(`❌ Mesaj gönderme hatası: ${error}`));
          this.promptForTopic();
        }
    } else {
      console.log(chalk.red('WebSocket bağlantısı kapalı. Lütfen tekrar başlatın.'));
      this.rl.close();
    }
  }

  private async discoverModels(): Promise<Array<{ name: string; provider: string }>> {
    const models: Array<{ name: string; provider: string }> = [];

    try {
      const res = await fetch('http://localhost:11434/api/tags');
      if (res.ok) {
        const data = await res.json();
        data.models?.forEach((m: any) => models.push({ name: m.name, provider: 'Ollama' }));
      }
    } catch (_) {
      // ignore
    }

    try {
      const res = await fetch('http://localhost:1234/v1/models');
      if (res.ok) {
        const data = await res.json();
        data.data?.forEach((m: any) => models.push({ name: m.id, provider: 'LM Studio' }));
      }
    } catch (_) {
      // ignore
    }

    return models;
  }

  private async checkModelAvailability(modelName: string): Promise<boolean> {
    try {
      // Önce hangi provider'da olduğunu bulalım
      const models = await this.discoverModels();
      const model = models.find(m => m.name === modelName);
      
      if (!model) {
        return false;
      }

      // LM Studio için test
      if (model.provider === 'LM Studio') {
        const testPayload = {
          model: modelName,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1,
          temperature: 0
        };

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30 saniye timeout

        try {
          const response = await fetch('http://localhost:1234/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testPayload),
            signal: controller.signal
          });

          clearTimeout(timeout);

          if (response.ok) {
            const data = await response.json();
            return data.choices && data.choices.length > 0;
          }
        } catch (e) {
          clearTimeout(timeout);
          if (e instanceof Error && e.name === 'AbortError') {
            console.log(chalk.yellow('\n⏱️  Model yanıt vermiyor (timeout).'));
          }
          return false;
        }
      }
      
      // Ollama için test
      if (model.provider === 'Ollama') {
        const testPayload = {
          model: modelName,
          prompt: 'test',
          stream: false,
          options: { num_predict: 1 }
        };

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30 saniye timeout

        try {
          const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testPayload),
            signal: controller.signal
          });

          clearTimeout(timeout);

          if (response.ok) {
            const data = await response.json();
            return data.response !== undefined;
          }
        } catch (e) {
          clearTimeout(timeout);
          if (e instanceof Error && e.name === 'AbortError') {
            console.log(chalk.yellow('\n⏱️  Model yanıt vermiyor (timeout).'));
          }
          return false;
        }
      }

      return false;
    } catch (error) {
      console.log(chalk.gray(`Model kontrolü sırasında hata: ${error}`));
      return false;
    }
  }

  private async ensureDockerServices(): Promise<void> {
    console.log(chalk.cyan('🐳 Docker servislerini kontrol ediliyor...'));
    
    try {
      // Docker'ın çalışıp çalışmadığını kontrol et
      const { stdout: dockerStatus } = await execAsync('docker info > /dev/null 2>&1 && echo "running" || echo "stopped"');
      
      if (dockerStatus.trim() === 'stopped') {
        console.log(chalk.yellow('⚠️  Docker çalışmıyor. Docker başlatmaya çalışıyorum...'));
        
        // macOS için Docker Desktop başlat
        try {
          await execAsync('open -a Docker');
          console.log(chalk.blue('📱 Docker Desktop açılıyor...'));
          
          // Docker başlamasını bekle
          let attempts = 0;
          const maxAttempts = 30;
          
          while (attempts < maxAttempts) {
            try {
              await execAsync('docker info > /dev/null 2>&1');
              break;
            } catch {
              attempts++;
              console.log(chalk.gray(`   Docker başlatılıyor... (${attempts}/${maxAttempts})`));
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
          
          if (attempts >= maxAttempts) {
            console.log(chalk.red('❌ Docker başlatılamadı. Lütfen manuel olarak başlatın.'));
            return;
          }
          
          console.log(chalk.green('✅ Docker başarıyla başlatıldı!'));
        } catch (error) {
          console.log(chalk.red('❌ Docker başlatılırken hata oluştu. Lütfen manuel olarak başlatın.'));
          return;
        }
      }

      // Docker Compose servislerini kontrol et
      console.log(chalk.cyan('🔄 Docker Compose servislerini kontrol ediliyor...'));
      
      // Proje ana dizinini bul
      const projectRoot = await this.findProjectRoot();
      
      try {
        const { stdout: composeStatus } = await execAsync(`cd "${projectRoot}" && docker-compose ps --services --filter "status=running"`);
        const runningServices = composeStatus.trim().split('\n').filter(s => s.trim());
        
        // Deep research servisinin çalışıp çalışmadığını kontrol et
        const isDeepResearchRunning = runningServices.includes('deep-research-service');
        
        if (!isDeepResearchRunning) {
          console.log(chalk.yellow('🚀 Deep research servisi başlatılıyor...'));
          
          // Sadece gerekli servisleri başlat
          const servicesToStart = ['deep-research-service', 'redis'];
          
          for (const service of servicesToStart) {
            try {
              console.log(chalk.gray(`   ${service} başlatılıyor...`));
              await execAsync(`cd "${projectRoot}" && docker-compose up -d ${service}`);
            } catch (error) {
              console.log(chalk.red(`❌ ${service} başlatılırken hata: ${error}`));
            }
          }
          
          // Servislerin sağlıklı olmasını bekle
          await this.waitForServiceHealth();
          
        } else {
          console.log(chalk.green('✅ Deep research servisi zaten çalışıyor!'));
        }
        
      } catch (error) {
        console.log(chalk.red(`❌ Docker Compose kontrol hatası: ${error}`));
        console.log(chalk.yellow('🔧 Servisleri manuel başlatmaya çalışıyorum...'));
        
        try {
          await execAsync(`cd "${projectRoot}" && docker-compose up -d deep-research-service redis`);
          await this.waitForServiceHealth();
        } catch (startError) {
          console.log(chalk.red(`❌ Servis başlatma hatası: ${startError}`));
        }
      }
      
    } catch (error) {
      console.log(chalk.red(`❌ Docker kontrol hatası: ${error}`));
      console.log(chalk.yellow('💡 Lütfen Docker kurulu ve çalışır durumda olduğundan emin olun.'));
    }
  }

  private async waitForServiceHealth(): Promise<void> {
    console.log(chalk.cyan('🏥 Servislerin sağlıklı olmasını bekleniyor...'));
    
    const maxAttempts = 15; // Daha az deneme
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        // WebSocket bağlantısı test et (health endpoint yerine)
        const testWs = new WebSocket('ws://localhost:8001/research_ws');
        
        const isHealthy = await new Promise<boolean>((resolve) => {
          const timeout = setTimeout(() => {
            testWs.terminate();
            resolve(false);
          }, 3000);
          
          testWs.on('open', () => {
            clearTimeout(timeout);
            testWs.close();
            resolve(true);
          });
          
          testWs.on('error', () => {
            clearTimeout(timeout);
            resolve(false);
          });
        });
        
        if (isHealthy) {
          console.log(chalk.green('✅ Deep research servisi sağlıklı!'));
          return;
        }
      } catch (error) {
        // Servis henüz hazır değil
      }
      
      attempts++;
      console.log(chalk.gray(`   Sağlık kontrolü... (${attempts}/${maxAttempts})`));
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    console.log(chalk.yellow('⚠️  Servis sağlık kontrolü tamamlanamadı, ancak devam ediliyor...'));
  }

  private async selectModel(): Promise<void> {
    const models = await this.discoverModels();

    if (models.length === 0) {
      console.log(chalk.yellow('⚠️  Hiç lokal model bulunamadı. Lütfen Ollama veya LM Studio kurarak model yükleyin.'));
      console.log(chalk.cyan('\n💡 Kurulum önerileri:'));
      console.log(chalk.gray('   Ollama: brew install ollama && ollama pull llama3.2'));
      console.log(chalk.gray('   LM Studio: https://lmstudio.ai - Model indirip local server başlatın\n'));
      this.rl.close();
      throw new Error('No models available');
    }

    console.log(chalk.cyan('\n🤖 Mevcut AI Modelleri:'));
    models.forEach((m, idx) => {
      const icon = m.provider === 'Ollama' ? '🦙' : '🎬';
      console.log(chalk.green(`  ${idx + 1}. ${icon} ${m.name} (${m.provider})`));
    });

    const answer: string = await new Promise((resolve) => {
      this.rl.question(chalk.cyan('\nKullanmak istediğiniz modelin numarasını seçin (enter = 1. model): '), resolve);
    });

    const idx = parseInt(answer) - 1;
    if (!answer.trim()) {
      this.selectedModel = models[0].name; // İlk modeli varsayılan yap
      console.log(chalk.green(`✓ ${this.selectedModel} modeli (varsayılan) seçildi!`));
    } else if (idx >= 0 && idx < models.length) {
      this.selectedModel = models[idx].name;
      console.log(chalk.green(`✓ ${this.selectedModel} modeli seçildi!`));
    } else {
      console.log(chalk.yellow('Geçersiz seçim, ilk model kullanılacak.'));
      this.selectedModel = models[0].name;
    }
  }

  private async findProjectRoot(): Promise<string> {
    // CLI'nin kurulu olduğu dizini bul
    let currentDir = process.cwd();
    
    // Önce mevcut dizinde docker-compose.yml var mı kontrol et
    if (fs.existsSync(path.join(currentDir, 'docker-compose.yml'))) {
      return currentDir;
    }
    
    // Üst dizinlerde ara
    while (currentDir !== path.dirname(currentDir)) {
      if (fs.existsSync(path.join(currentDir, 'docker-compose.yml'))) {
        return currentDir;
      }
      currentDir = path.dirname(currentDir);
    }
    
    // Bulunamadıysa, muhtemelen LocoDex dizini
    const possiblePaths = [
      '/Users/apple/Desktop/LocoDex',
      path.join(process.env.HOME || '', 'Desktop', 'LocoDex'),
      path.join(process.env.HOME || '', 'LocoDex'),
      path.join(process.cwd(), '..', '..'), // packages/cli'dan üst dizine
    ];
    
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(path.join(possiblePath, 'docker-compose.yml'))) {
        return possiblePath;
      }
    }
    
    // Varsayılan olarak mevcut dizini döndür
    return process.cwd();
  }
}