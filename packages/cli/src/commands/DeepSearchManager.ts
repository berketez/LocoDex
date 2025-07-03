import WebSocket from 'ws';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import * as readline from 'readline';
import { exec } from 'child_process';
import { promisify } from 'util';

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
        const ws = new WebSocket('ws://localhost:8001/research_ws', { timeout: 4000 });
        this.ws = ws;

        ws.on('open', () => {
          this.spinner.succeed('Derin araştırma servisine başarıyla bağlanıldı!');
          
          // Small delay to ensure proper console state
          setTimeout(() => {
            this.promptForTopic();
          }, 100);
          resolve();
        });

        ws.on('message', (data: WebSocket.Data) => {
          // Clear research timeout when any message is received
          if (this.researchTimeout) {
            clearTimeout(this.researchTimeout);
            this.researchTimeout = null;
          }
          
          // Clear progress interval
          if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
          }
          
          this.spinner.stop();
          const message = JSON.parse(data.toString());
          console.log(chalk.gray(`DEBUG: Mesaj alındı: ${JSON.stringify(message)}`));

          if (message.type === 'progress') {
            // Bağlantı kuruldu mesajını özel olarak işle
            if (message.message && message.message.includes('Bağlantı kuruldu, araştırma isteği bekleniyor')) {
              console.log(chalk.green('✓ Servis hazır ve araştırma isteklerini bekliyor'));
              return;
            }
            
            // Progress mesajlarını daha açıklayıcı yapalım
            let progressText = message.message;
            
            // İngilizce mesajları Türkçeleştir
            if (progressText.includes('Starting research')) {
              progressText = '🚀 Araştırma başlatılıyor...';
            } else if (progressText.includes('Generating research queries')) {
              progressText = '📝 Araştırma sorguları oluşturuluyor...';
            } else if (progressText.includes('Research queries generated')) {
              progressText = '✓ Araştırma sorguları hazır!';
            } else if (progressText.includes('Performing initial search')) {
              progressText = '🔍 İlk arama yapılıyor...';
            } else if (progressText.includes('Initial search complete')) {
              progressText = '✓ İlk arama tamamlandı!';
            } else if (progressText.includes('Conducting research iteration')) {
              progressText = progressText.replace('Conducting research iteration', '🔄 Araştırma derinleştiriliyor');
            } else if (progressText.includes('Searching')) {
              progressText = progressText.replace('Searching', '🔎 Aranıyor:');
            } else if (progressText.includes('Filtering and processing results')) {
              progressText = '🔧 Sonuçlar filtreleniyor ve işleniyor...';
            } else if (progressText.includes('Results filtered')) {
              progressText = progressText.replace('Results filtered: kept', '✓ Sonuçlar filtrelendi:');
              progressText = progressText.replace('sources', 'kaynak korundu');
            } else if (progressText.includes('Generating final research report')) {
              progressText = '📄 Final araştırma raporu hazırlanıyor...';
            } else if (progressText.includes('Research complete')) {
              progressText = '✅ Araştırma tamamlandı!';
            } else if (progressText.includes('Google araması:')) {
              progressText = progressText.replace('Google araması:', '🔎 Google\'da aranıyor:');
            } else if (progressText.includes('Site ziyaret ediliyor:')) {
              // URL'yi kısalt
              const urlMatch = progressText.match(/Site ziyaret ediliyor: (.+)/);
              if (urlMatch && urlMatch[1]) {
                try {
                  const url = new URL(urlMatch[1]);
                  progressText = `🌐 Ziyaret ediliyor: ${url.hostname}`;
                } catch {
                  progressText = `🌐 Site ziyaret ediliyor...`;
                }
              }
            }
            
            // Step bilgisini göster
            if (message.step !== undefined && message.step > 0) {
              const percentage = Math.round(message.step * 100);
              progressText = `[%${percentage}] ${progressText}`;
            }
            
            this.spinner.text = chalk.blue(progressText);
            this.spinner.start();
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
              console.log(chalk.gray('      TOGETHER_API_KEY=your_key_here'));
              console.log(chalk.gray('      TAVILY_API_KEY=your_key_here'));
              console.log(chalk.gray('   3. API anahtarlarını ilgili sitelerden alın:'));
              console.log(chalk.gray('      - Together AI: https://together.ai'));
              console.log(chalk.gray('      - Tavily: https://tavily.com\n'));
            }
            
            this.promptForTopic();
          }
        });

        ws.on('close', () => {
          this.spinner.fail('Derin araştırma servisiyle bağlantı kesildi.');
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

    await this.selectModel();
    
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
    } else {
      console.log(chalk.blue('📝 Varsayılan TogetherAI modelleri kullanılacak.'));
    }

    try {
      await this.connect();
    } catch (error) {
      this.spinner.warn(chalk.yellow('Servis bulunamadı. Otomatik olarak başlatılıyor...'));
      this.spinner.start('`docker-compose up -d` komutu çalıştırılıyor...');

      try {
        await execAsync('docker-compose up -d');
        this.spinner.succeed('Docker servisleri başlatıldı.');
        this.spinner.start('Servislerin hazır olması için 5 saniye bekleniyor...');
        await new Promise(res => setTimeout(res, 5000));

        await this.connect(); // Second attempt
      } catch (finalError) {
        this.spinner.fail(chalk.red('Servisler başlatılamadı veya bağlantı yine başarısız oldu.'));
        console.log(chalk.yellow('\n💡 Lütfen Docker\'ın çalıştığından emin olun ve tekrar deneyin.'));
        if (finalError instanceof Error) {
          console.log(chalk.gray(`   Hata detayı: ${finalError.message}`));
        }
        this.rl.close();
      }
    }
  }

  private promptForTopic(): void {
    if (this.spinner.isSpinning) {
      this.spinner.stop();
    }

    // Ensure clean console state
    console.log(''); // Add a newline for better formatting
    console.log(chalk.cyan('💡 Sistem hazır! Araştırma yapmak için bir konu girin.'));
    
    this.rl.question(chalk.yellow('🔍 Araştırma konusunu girin (çıkmak için "exit" yazın): '), (topic) => {
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
        console.log(chalk.gray(`DEBUG: Mesaj gönderiliyor: ${JSON.stringify(message)}`));
        
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
          
          console.log(chalk.gray('DEBUG: Mesaj gönderildi, spinner başlatıldı'));
          
          // Add timeout for research request (30 seconds - reduced from 60)
          this.researchTimeout = setTimeout(() => {
            if (this.spinner.isSpinning) {
              // Clear progress interval
              if (this.progressInterval) {
                clearInterval(this.progressInterval);
                this.progressInterval = null;
              }
              
              this.spinner.fail(chalk.red('⏰ Araştırma isteği zaman aşımına uğradı (30 saniye)'));
              console.log(chalk.yellow('💡 Backend servisi yanıt vermiyor. Olası nedenler:'));
              console.log(chalk.gray('   1. API anahtarları eksik veya hatalı (.env dosyası)'));
              console.log(chalk.gray('   2. TOGETHER_API_KEY ve TAVILY_API_KEY gerekli'));
              console.log(chalk.gray('   3. Docker servisleri düzgün çalışmıyor'));
              console.log(chalk.gray('   4. Network bağlantı problemi\n'));
              this.promptForTopic();
            }
          }, 30000);
          
        } catch (error) {
          console.log(chalk.red(`❌ Mesaj gönderme hatası: ${error}`));
          this.promptForTopic();
        }
      } else {
        console.log(chalk.red('WebSocket bağlantısı kapalı. Lütfen tekrar başlatın.'));
        this.rl.close();
      }
    });
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

  private async selectModel(): Promise<void> {
    const models = await this.discoverModels();

    if (models.length === 0) {
      console.log(chalk.yellow('⚠️  Hiç lokal model bulunamadı. Varsayılan TogetherAI modelleri kullanılacak.'));
      this.selectedModel = null;
      return;
    }

    console.log(chalk.cyan('\n🤖 Mevcut AI Modelleri:'));
    models.forEach((m, idx) => {
      const icon = m.provider === 'Ollama' ? '🦙' : '🎬';
      console.log(chalk.green(`  ${idx + 1}. ${icon} ${m.name} (${m.provider})`));
    });

    const answer: string = await new Promise((resolve) => {
      this.rl.question(chalk.cyan('\nKullanmak istediğiniz modelin numarasını seçin (enter = varsayılan): '), resolve);
    });

    const idx = parseInt(answer) - 1;
    if (!answer.trim()) {
      this.selectedModel = null; // varsayılan
    } else if (idx >= 0 && idx < models.length) {
      this.selectedModel = models[idx].name;
      console.log(chalk.green(`✓ ${this.selectedModel} modeli seçildi!`));
    } else {
      console.log(chalk.yellow('Geçersiz seçim, varsayılan modeller kullanılacak.'));
      this.selectedModel = null;
    }
  }
}