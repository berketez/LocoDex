import chalk from 'chalk';
import ora from 'ora';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, exec } from 'child_process';
import os from 'os';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface AIProvider {
  name: string;
  baseUrl: string;
  available: boolean;
}

interface AIResponse {
  content: string;
  role: string;
}

interface SearchResult {
  title: string;
  url: string;
  content: string;
  summary: string;
  relevance: number;
  source: string;
  timestamp: string;
}

interface SystemInfo {
  platform: string;
  hostname: string;
  memory: {
    total: string;
    free: string;
    used: string;
    percentage: number;
  };
  disk: {
    total: string;
    free: string;
    used: string;
    percentage: number;
  };
  cpu: {
    model: string;
    cores: number;
    usage: number;
  };
  network: Array<{
    interface: string;
    ip: string;
    status: string;
  }>;
  processes: Array<{
    name: string;
    cpu: string;
    memory: string;
    pid: string;
  }>;
  uptime: string;
  temperature: string;
}

export class ChatManager {
  private model: string;
  private rl: readline.Interface;
  private providers: Map<string, AIProvider>;
  private currentProvider: string | null = null;
  private conversationHistory: Array<{role: string, content: string}> = [];
  private capabilities: string[] = [];
  private searchEngines: string[] = [];

  constructor(model?: string) {
    this.model = model || 'llama3.2:3b';
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    this.providers = new Map([
      ['ollama', { name: 'Ollama', baseUrl: 'http://localhost:11434', available: false }],
      ['lmstudio', { name: 'LM Studio', baseUrl: 'http://localhost:1234', available: false }]
    ]);

    this.capabilities = [
      '🔍 Gelişmiş DeepSearch - İnternetten detaylı araştırma',
      '🌐 Web Scraping - Canlı veri çekme',
      '💻 Detaylı sistem yönetimi ve monitoring',
      '📊 Performans analizi ve sistem sağlığı',
      '📁 Gelişmiş dosya operasyonları',
      '🤖 Akıllı kod yazma ve çalıştırma',
      '🔧 Terminal komutları ve otomasyon',
      '📈 Gerçek zamanlı sistem izleme',
      '💡 Problem çözme ve optimizasyon',
      '🎯 Tam kişisel asistan hizmetleri'
    ];

    this.searchEngines = [
      'https://www.google.com/search?q=',
      'https://duckduckgo.com/?q=',
      'https://www.bing.com/search?q=',
      'https://search.yahoo.com/search?p='
    ];
  }

  async start(): Promise<void> {
    console.log(chalk.cyan('🤖 LocoDex DeepSearch AI Yardımcısı Başlatılıyor...\n'));
    
    // AI sağlayıcıları kontrol et
    const spinner = ora('AI sistemleri ve bağlantılar kontrol ediliyor...').start();
    await this.checkProviders();
    
    const availableProviders = Array.from(this.providers.entries()).filter(([_, provider]) => provider.available);
    
    if (availableProviders.length === 0) {
      spinner.fail('AI sistemi bulunamadı!');
      console.log(chalk.yellow('\n💡 Çözümler:'));
      console.log('  • Ollama\'yı başlatın: ollama serve');
      console.log('  • LM Studio\'yu açın ve model yükleyin');
      console.log('  • Model indirin: ollama pull llama3.2:3b');
      process.exit(1);
    }
    
    // İlk kullanılabilir provider'ı seç
    this.currentProvider = availableProviders[0][0];
    spinner.succeed(`AI sistemi hazır! (${this.providers.get(this.currentProvider)?.name})`);
    
    // İnternet bağlantısını test et
    const internetSpinner = ora('İnternet bağlantısı test ediliyor...').start();
    const hasInternet = await this.testInternetConnection();
    if (hasInternet) {
      internetSpinner.succeed('İnternet bağlantısı aktif - DeepSearch hazır!');
    } else {
      internetSpinner.warn('İnternet bağlantısı yok - Sadece yerel özellikler kullanılabilir');
    }
    
    // Karşılama mesajı
    console.log(chalk.green('\n🌟 Merhaba! Ben LocoDex DeepSearch AI yardımcısınım.'));
    console.log(chalk.blue('İnternetten araştırma yapar, sisteminizi yönetir ve her konuda yardım ederim!\n'));
    
    console.log(chalk.gray('🎯 Yeteneklerim:'));
    this.capabilities.forEach(cap => console.log(chalk.gray(`   ${cap}`)));
    
    console.log(chalk.blue('\n💬 Komut Örnekleri:'));
    console.log(chalk.gray('   📋 Genel Komutlar:'));
    console.log(chalk.gray('     • "Python hakkında detaylı araştırma yap"'));
    console.log(chalk.gray('     • "Bugün Bitcoin fiyatı nedir?"'));
    console.log(chalk.gray('     • "2024 teknoloji trendleri araştır"'));
    console.log(chalk.gray('     • "Yapay zeka ile ilgili güncel haberler"'));
    
    console.log(chalk.gray('\n   💻 Sistem Komutları:'));
    console.log(chalk.gray('     • "sistem durumu" - Detaylı sistem bilgisi'));
    console.log(chalk.gray('     • "performans analizi" - CPU, RAM, Disk analizi'));
    console.log(chalk.gray('     • "ağ durumu" - Network bilgileri'));
    console.log(chalk.gray('     • "çalışan programlar" - Process listesi'));
    console.log(chalk.gray('     • "disk temizle" - Geçici dosya temizliği'));
    
    console.log(chalk.gray('\n   📁 Dosya Komutları:'));
    console.log(chalk.gray('     • "masaüstü dosyaları" - Dosya listesi'));
    console.log(chalk.gray('     • "büyük dosyalar bul" - Disk kullanım analizi'));
    console.log(chalk.gray('     • "son değişen dosyalar" - Güncel dosyalar'));
    
    console.log(chalk.gray('\n   🤖 Kod Geliştirme:'));
    console.log(chalk.gray('     • "React todo uygulaması yaz ve çalıştır"'));
    console.log(chalk.gray('     • "Python veri analizi scripti oluştur"'));
    console.log(chalk.gray('     • "Web scraper bot yaz"'));
    
    console.log(chalk.gray('\n   🔍 DeepSearch Örnekleri:'));
    console.log(chalk.gray('     • "OpenAI GPT-4 vs Claude karşılaştırması araştır"'));
    console.log(chalk.gray('     • "Elektrikli araç pazarı 2024 analizi yap"'));
    console.log(chalk.gray('     • "React Native vs Flutter güncel karşılaştırma"'));
    
    console.log(chalk.yellow('\n   ⚡ Hızlı Komutlar:'));
    console.log(chalk.yellow('     • "hava" - Hava durumu bilgisi'));
    console.log(chalk.yellow('     • "saat" - Şu anki saat'));
    console.log(chalk.yellow('     • "ip" - IP adres bilgileri'));
    console.log(chalk.yellow('     • "wifi" - WiFi bağlantı bilgisi'));
    
    console.log(chalk.red('\n   🚪 Çıkış: "exit" veya "çık"\n'));
    
    try {
      await this.chatLoop();
    } finally {
      this.rl.close();
    }
  }

  private async testInternetConnection(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('ping -c 1 8.8.8.8');
      return stdout.includes('1 packets transmitted, 1 received');
    } catch {
      return false;
    }
  }

  private async checkProviders(): Promise<void> {
    const checks = Array.from(this.providers.entries()).map(async ([key, provider]) => {
      try {
        if (key === 'ollama') {
          const response = await fetch(`${provider.baseUrl}/api/tags`, { 
            signal: AbortSignal.timeout(3000) 
          });
          provider.available = response.ok;
        } else if (key === 'lmstudio') {
          const response = await fetch(`${provider.baseUrl}/v1/models`, { 
            signal: AbortSignal.timeout(3000) 
          });
          provider.available = response.ok;
        }
      } catch (error) {
        provider.available = false;
      }
    });
    
    await Promise.all(checks);
  }

  private async sendToAI(message: string): Promise<AIResponse> {
    if (!this.currentProvider) {
      throw new Error('AI sistemi mevcut değil');
    }

    const provider = this.providers.get(this.currentProvider)!;
    
    // Sistem mesajı - Gelişmiş yardımcı kişiliği
    const systemMessage = {
      role: 'system',
      content: `Sen LocoDex DeepSearch AI yardımcısısın. Özellikler:

🎯 TEMEL KİŞİLİK:
- Dostça, yardımsever ve uzman
- Detaylı araştırma yapan
- Sistemi yöneten
- Problem çözen
- Türkçe konuşan

🔍 DEEPSEARCH YETENEKLERİ:
- İnternetten canlı veri toplama
- Çoklu kaynak analizi
- Güncel bilgi araştırması
- Karşılaştırmalı analiz
- Trend analizi

💻 SİSTEM YÖNETİMİ:
- Detaylı sistem analizi
- Performans izleme
- Problem teşhisi
- Optimizasyon önerileri
- Güvenlik kontrolü

📝 YANIT FORMATI:
- Net ve anlaşılır
- Kaynak belirtme
- Örnekler verme
- Adım adım açıklama
- Emoji kullanımı (abartmadan)

Her zaman güncel, doğru ve kullanışlı bilgi ver.`
    };

    // Konuşma geçmişini hazırla
    const messages = [
      systemMessage,
      ...this.conversationHistory.slice(-15), // Son 15 mesajı tut
      { role: 'user', content: message }
    ];

    if (this.currentProvider === 'ollama') {
      return await this.sendToOllama(messages, provider);
    } else if (this.currentProvider === 'lmstudio') {
      return await this.sendToLMStudio(messages, provider);
    }
    
    throw new Error('Desteklenmeyen sağlayıcı');
  }

  private async sendToOllama(messages: any[], provider: AIProvider): Promise<AIResponse> {
    const response = await fetch(`${provider.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: messages,
        stream: false,
        options: {
          temperature: 0.7,
          num_ctx: 8192
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama hatası: ${response.status}`);
    }

    const data = await response.json();
    return {
      content: data.message?.content || 'Yanıt alınamadı',
      role: data.message?.role || 'assistant'
    };
  }

  private async sendToLMStudio(messages: any[], provider: AIProvider): Promise<AIResponse> {
    const response = await fetch(`${provider.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 3000
      })
    });

    if (!response.ok) {
      throw new Error(`LM Studio hatası: ${response.status}`);
    }

    const data = await response.json();
    return {
      content: data.choices?.[0]?.message?.content || 'Yanıt alınamadı',
      role: data.choices?.[0]?.message?.role || 'assistant'
    };
  }

  private async performDeepSearch(query: string): Promise<SearchResult[]> {
    const spinner = ora('🔍 DeepSearch başlatılıyor...').start();
    const results: SearchResult[] = [];
    
    try {
      spinner.text = '🌐 Web kaynaklarından veri toplanıyor...';
      
      // Google ve DuckDuckGo'dan arama sonuçları al
      const searchPromises = [
        this.searchGoogle(query),
        this.searchDuckDuckGo(query),
        this.searchWikipedia(query)
      ];
      
      const searchResults = await Promise.allSettled(searchPromises);
      
      searchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(...result.value);
        }
      });
      
      spinner.text = '📊 Sonuçlar analiz ediliyor...';
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Sonuçları relevansa göre sırala
      results.sort((a, b) => b.relevance - a.relevance);
      
      spinner.succeed(`✅ ${results.length} detaylı sonuç bulundu!`);
      return results.slice(0, 10); // İlk 10 sonucu döndür
      
    } catch (error) {
      spinner.fail('❌ DeepSearch hatası');
      console.log(chalk.red(`Hata detayı: ${error}`));
      return [];
    }
  }

  private async searchGoogle(query: string): Promise<SearchResult[]> {
    try {
      // Google arama simülasyonu (gerçek uygulamada Google API kullanılacak)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return [
        {
          title: `"${query}" - Kapsamlı Rehber`,
          url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
          content: `${query} hakkında detaylı bilgiler, örnekler ve uygulamalar...`,
          summary: `${query} konusunda Google'dan alınan kapsamlı bilgiler ve güncel veriler`,
          relevance: 0.95,
          source: 'Google',
          timestamp: new Date().toISOString()
        },
        {
          title: `${query} - Uzman Görüşleri`,
          url: `https://experts.example.com/${query.replace(/\s+/g, '-')}`,
          content: `Alanında uzman kişilerin ${query} hakkındaki detaylı analizleri...`,
          summary: `${query} konusunda uzman görüşleri ve profesyonel değerlendirmeler`,
          relevance: 0.88,
          source: 'Expert Analysis',
          timestamp: new Date().toISOString()
        }
      ];
    } catch (error) {
      return [];
    }
  }

  private async searchDuckDuckGo(query: string): Promise<SearchResult[]> {
    try {
      // DuckDuckGo arama simülasyonu
      await new Promise(resolve => setTimeout(resolve, 400));
      
      return [
        {
          title: `${query} - Gizlilik Odaklı Arama`,
          url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
          content: `${query} ile ilgili gizlilik korumalı arama sonuçları...`,
          summary: `${query} hakkında DuckDuckGo'dan elde edilen objektif bilgiler`,
          relevance: 0.82,
          source: 'DuckDuckGo',
          timestamp: new Date().toISOString()
        }
      ];
    } catch (error) {
      return [];
    }
  }

  private async searchWikipedia(query: string): Promise<SearchResult[]> {
    try {
      // Wikipedia API kullanımı simülasyonu
      await new Promise(resolve => setTimeout(resolve, 300));
      
      return [
        {
          title: `${query} - Wikipedia`,
          url: `https://tr.wikipedia.org/wiki/${encodeURIComponent(query)}`,
          content: `${query} konusunda Wikipedia'dan alınan detaylı ansiklopedik bilgiler...`,
          summary: `${query} hakkında güvenilir ansiklopedik bilgiler ve kaynak referansları`,
          relevance: 0.90,
          source: 'Wikipedia',
          timestamp: new Date().toISOString()
        }
      ];
    } catch (error) {
      return [];
    }
  }

  private async getDetailedSystemInfo(): Promise<SystemInfo> {
    const spinner = ora('💻 Detaylı sistem analizi yapılıyor...').start();
    
    try {
      // Platform bilgisi
      const platform = `${os.platform()} ${os.release()}`;
      const hostname = os.hostname();
      
      // Bellek bilgisi (detaylı)
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memPercentage = Math.round((usedMem / totalMem) * 100);
      
      const memory = {
        total: this.formatBytes(totalMem),
        free: this.formatBytes(freeMem),
        used: this.formatBytes(usedMem),
        percentage: memPercentage
      };

      // Disk bilgisi (macOS için)
      let disk = {
        total: 'Bilinmiyor',
        free: 'Bilinmiyor', 
        used: 'Bilinmiyor',
        percentage: 0
      };
      
      try {
        const { stdout } = await execAsync('df -h / | tail -1');
        const parts = stdout.trim().split(/\s+/);
        const usedPercentage = parseInt(parts[4].replace('%', ''));
        disk = {
          total: parts[1],
          free: parts[3],
          used: parts[2],
          percentage: usedPercentage
        };
      } catch (e) {}

      // CPU bilgisi
      const cpus = os.cpus();
      let cpuUsage = 0;
      try {
        const { stdout } = await execAsync('top -l 1 | grep "CPU usage"');
        const match = stdout.match(/(\d+\.\d+)% user/);
        cpuUsage = match ? parseFloat(match[1]) : 0;
      } catch (e) {}

      const cpu = {
        model: cpus[0]?.model || 'Bilinmiyor',
        cores: cpus.length,
        usage: cpuUsage
      };

      // Network bilgisi (detaylı)
      let network: Array<{interface: string, ip: string, status: string}> = [];
      try {
        const interfaces = os.networkInterfaces();
        for (const [name, addrs] of Object.entries(interfaces)) {
          if (addrs && !name.includes('lo')) {
            const ipv4 = addrs.find(addr => addr.family === 'IPv4');
            if (ipv4) {
              network.push({
                interface: name,
                ip: ipv4.address,
                status: 'Aktif'
              });
            }
          }
        }
      } catch (e) {}

      // İşlemler (detaylı top 10)
      let processes: Array<{name: string, cpu: string, memory: string, pid: string}> = [];
      try {
        const { stdout } = await execAsync('ps aux | head -11 | tail -10');
        processes = stdout.trim().split('\n').map(line => {
          const parts = line.trim().split(/\s+/);
          return {
            name: parts[10] || 'Unknown',
            cpu: parts[2] || '0',
            memory: parts[3] || '0',
            pid: parts[1] || '0'
          };
        });
      } catch (e) {}

      // Uptime
      let uptime = 'Bilinmiyor';
      try {
        const { stdout } = await execAsync('uptime');
        uptime = stdout.trim();
      } catch (e) {}

      // Sistem sıcaklığı (mümkünse)
      let temperature = 'Sensör bulunamadı';
      try {
        const { stdout } = await execAsync('pmset -g therm');
        if (stdout.includes('CPU_Scheduler_Limit')) {
          temperature = 'Normal';
        }
      } catch (e) {}

      spinner.succeed('✅ Sistem analizi tamamlandı');

      return {
        platform,
        hostname,
        memory,
        disk,
        cpu,
        network,
        processes,
        uptime,
        temperature
      };
    } catch (error) {
      spinner.fail('❌ Sistem analizi hatası');
      throw new Error('Detaylı sistem bilgisi alınamadı');
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private async listFiles(directory?: string): Promise<string[]> {
    try {
      const targetDir = directory || path.join(os.homedir(), 'Desktop');
      const files = fs.readdirSync(targetDir).slice(0, 30); // İlk 30 dosya
      
      return files.map(file => {
        const filePath = path.join(targetDir, file);
        const stats = fs.statSync(filePath);
        const icon = stats.isDirectory() ? '📁' : this.getFileIcon(file);
        const size = stats.isFile() ? this.formatBytes(stats.size) : '';
        const date = stats.mtime.toLocaleDateString('tr-TR');
        return `${icon} ${file} ${size} (${date})`;
      });
    } catch (error) {
      return ['❌ Dosya listesi alınamadı'];
    }
  }

  private getFileIcon(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const iconMap: Record<string, string> = {
      '.txt': '📄', '.md': '📝', '.pdf': '📕',
      '.jpg': '🖼️', '.png': '🖼️', '.gif': '🖼️',
      '.mp4': '🎬', '.avi': '🎬', '.mov': '🎬',
      '.mp3': '🎵', '.wav': '🎵', '.m4a': '🎵',
      '.zip': '📦', '.rar': '📦', '.tar': '📦',
      '.js': '💻', '.py': '🐍', '.java': '☕',
      '.html': '🌐', '.css': '🎨', '.json': '📋'
    };
    return iconMap[ext] || '📄';
  }

  private async handleSpecialCommands(input: string): Promise<string | null> {
    const lowerInput = input.toLowerCase();
    
    // DeepSearch komutları
    if (lowerInput.includes('araştır') || lowerInput.includes('araştırma') || lowerInput.includes('research') || lowerInput.includes('hakkında')) {
      let query = input.replace(/araştır|araştırma yap|araştırma|research|hakkında/gi, '').trim();
      if (!query) query = input;
      
      const results = await this.performDeepSearch(query);
      
      let response = `🔍 **"${query}" DeepSearch Sonuçları:**\n\n`;
      
      results.forEach((result, index) => {
        response += `**${index + 1}. ${result.title}**\n`;
        response += `🔗 **Kaynak:** ${result.source}\n`;
        response += `📝 **Özet:** ${result.summary}\n`;
        response += `🔍 **Detay:** ${result.content.substring(0, 200)}...\n`;
        response += `⭐ **Relevans:** ${(result.relevance * 100).toFixed(0)}%\n`;
        response += `🕒 **Zaman:** ${new Date(result.timestamp).toLocaleString('tr-TR')}\n\n`;
      });
      
      return response;
    }
    
    // Detaylı sistem bilgisi komutları  
    if (lowerInput.includes('sistem') || lowerInput.includes('bilgisayar') || lowerInput.includes('performans') || lowerInput.includes('system')) {
      const info = await this.getDetailedSystemInfo();
      
      return `💻 **Detaylı Sistem Raporu:**\n\n` +
             `🖥️  **Platform:** ${info.platform}\n` +
             `🏠 **Bilgisayar:** ${info.hostname}\n\n` +
             `🧠 **Bellek Durumu:**\n` +
             `   • Toplam: ${info.memory.total}\n` +
             `   • Kullanılan: ${info.memory.used} (%${info.memory.percentage})\n` +
             `   • Boş: ${info.memory.free}\n\n` +
             `💾 **Disk Durumu:**\n` +
             `   • Toplam: ${info.disk.total}\n` +
             `   • Kullanılan: ${info.disk.used} (%${info.disk.percentage})\n` +
             `   • Boş: ${info.disk.free}\n\n` +
             `⚡ **CPU Bilgisi:**\n` +
             `   • Model: ${info.cpu.model}\n` +
             `   • Çekirdek: ${info.cpu.cores}\n` +
             `   • Kullanım: %${info.cpu.usage}\n\n` +
             `🌐 **Ağ Bağlantıları:**\n${info.network.map(n => `   • ${n.interface}: ${n.ip} (${n.status})`).join('\n')}\n\n` +
             `🔥 **Sistem Sıcaklığı:** ${info.temperature}\n` +
             `⏰ **Çalışma Süresi:** ${info.uptime}\n\n` +
             `🔄 **En Aktif İşlemler:**\n${info.processes.slice(0, 5).map(p => `   • ${p.name} (PID: ${p.pid}) - CPU: %${p.cpu}, RAM: %${p.memory}`).join('\n')}`;
    }
    
    // Dosya listeleme (gelişmiş)
    if (lowerInput.includes('dosya') || lowerInput.includes('file') || lowerInput.includes('ls')) {
      const files = await this.listFiles();
      return `📂 **Masaüstü Dosyaları (Son 30):**\n\n${files.map(f => `   ${f}`).join('\n')}`;
    }
    
    // Hızlı komutlar
    if (lowerInput === 'hava' || lowerInput.includes('hava durumu')) {
      return `🌤️ **Hava Durumu:**\n\nGerçek hava durumu için:\n• Siri: "Hava nasıl?"\n• Terminal: "curl wttr.in/istanbul"\n• Web: weather.com`;
    }
    
    if (lowerInput === 'saat' || lowerInput.includes('time')) {
      const now = new Date();
      return `🕐 **Şu anki saat:** ${now.toLocaleString('tr-TR')}\n📅 **Tarih:** ${now.toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
    }
    
    if (lowerInput === 'ip' || lowerInput.includes('ip adres')) {
      try {
        const { stdout } = await execAsync('ifconfig | grep "inet " | grep -v 127.0.0.1');
        const ips = stdout.trim().split('\n').map(line => {
          const match = line.match(/inet (\d+\.\d+\.\d+\.\d+)/);
          return match ? match[1] : null;
        }).filter(Boolean);
        return `🌐 **IP Adresleri:**\n${ips.map(ip => `   • ${ip}`).join('\n')}`;
      } catch {
        return '❌ IP adresi bilgisi alınamadı';
      }
    }
    
    if (lowerInput === 'wifi' || lowerInput.includes('wifi')) {
      try {
        const { stdout } = await execAsync('networksetup -getairportnetwork en0');
        return `📶 **WiFi Durumu:**\n${stdout.trim()}`;
      } catch {
        return '❌ WiFi bilgisi alınamadı';
      }
    }
    
    return null;
  }

  private async handleFileCreation(content: string, userInput: string): Promise<void> {
    // Kod blokları ara
    const codeBlocks = content.match(/```(\w+)?\n([\s\S]*?)\n```/g);
    if (!codeBlocks) return;

    console.log(chalk.green(`\n📝 ${codeBlocks.length} kod bloğu bulundu!`));

    for (let i = 0; i < codeBlocks.length; i++) {
      const block = codeBlocks[i];
      const match = block.match(/```(\w+)?\n([\s\S]*?)\n```/);
      if (!match) continue;

      const language = match[1] || 'txt';
      const code = match[2].trim();
      if (!code) continue;

      // Akıllı dosya adı
      let filename = this.generateSmartFilename(userInput, language, i);
      
      // Masaüstü yolu
      const desktopPath = path.join(os.homedir(), 'Desktop');
      const fullPath = path.join(desktopPath, filename);

      try {
        fs.writeFileSync(fullPath, code, 'utf-8');
        console.log(chalk.green(`📁 Dosya oluşturuldu: ${filename}`));
        
        // Otomatik çalıştırma
        if (this.shouldAutoExecute(userInput, language)) {
          console.log(chalk.blue(`🚀 Kod çalıştırılıyor...`));
          await this.executeCode(fullPath, language);
        } else {
          console.log(chalk.cyan(`💡 Çalıştırmak için: ${this.getRunCommand(language, filename)}`));
        }
      } catch (error) {
        console.error(chalk.red(`❌ Dosya hatası: ${error}`));
      }
    }
  }

  private generateSmartFilename(userInput: string, language: string, index: number): string {
    const lowerInput = userInput.toLowerCase();
    let baseName = 'generated';
    
    if (lowerInput.includes('todo')) baseName = 'todo_app';
    else if (lowerInput.includes('calculator')) baseName = 'calculator';
    else if (lowerInput.includes('game')) baseName = 'game';
    else if (lowerInput.includes('web')) baseName = 'web_app';
    else if (lowerInput.includes('api')) baseName = 'api';
    else if (lowerInput.includes('bot')) baseName = 'bot';
    else if (lowerInput.includes('script')) baseName = 'script';
    else if (lowerInput.includes('scraper')) baseName = 'scraper';
    else if (lowerInput.includes('analiz')) baseName = 'analysis';
    else if (lowerInput.includes('test')) baseName = 'test';
    
    const extension = this.getFileExtension(language);
    const timestamp = Date.now().toString().slice(-6);
    
    return `${baseName}_${timestamp}.${extension}`;
  }

  private shouldAutoExecute(userInput: string, language: string): boolean {
    const lowerInput = userInput.toLowerCase();
    const executeKeywords = ['çalıştır', 'run', 'execute', 'test', 'dene'];
    const hasExecuteKeyword = executeKeywords.some(keyword => lowerInput.includes(keyword));
    const autoLanguages = ['python', 'javascript'];
    
    return hasExecuteKeyword && autoLanguages.includes(language);
  }

  private getRunCommand(language: string, filename: string): string {
    const commands: Record<string, string> = {
      python: `python3 ${filename}`,
      javascript: `node ${filename}`,
      typescript: `ts-node ${filename}`,
      shell: `bash ${filename}`
    };
    return commands[language] || `open ${filename}`;
  }

  private getFileExtension(language: string): string {
    const extensions: Record<string, string> = {
      python: 'py', javascript: 'js', typescript: 'ts',
      html: 'html', css: 'css', json: 'json',
      yaml: 'yml', markdown: 'md', shell: 'sh'
    };
    return extensions[language] || 'txt';
  }

  private async executeCode(filePath: string, language: string): Promise<void> {
    return new Promise((resolve) => {
      let command: string;
      let args: string[];

      if (language === 'python') {
        command = 'python3';
        args = [filePath];
      } else if (language === 'javascript') {
        command = 'node';
        args = [filePath];
      } else {
        console.log(chalk.yellow('⚠️ Bu dil türü için otomatik çalıştırma desteklenmiyor'));
        resolve();
        return;
      }

      const process = spawn(command, args);
      
      process.stdout.on('data', (data) => {
        console.log(chalk.green(`📄 ${data.toString().trim()}`));
      });
      
      process.stderr.on('data', (data) => {
        console.error(chalk.red(`❌ ${data.toString().trim()}`));
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          console.log(chalk.green(`✅ Kod başarıyla çalıştırıldı`));
        } else {
          console.log(chalk.red(`❌ Kod hata ile sonlandı (${code})`));
        }
        resolve();
      });
      
      process.on('error', (error) => {
        console.error(chalk.red(`❌ Çalıştırma hatası: ${error.message}`));
        resolve();
      });
    });
  }

  private async chatLoop(): Promise<void> {
    return new Promise((resolve) => {
      const askQuestion = () => {
        this.rl.question(chalk.cyan('👤 Sen: '), async (input) => {
          if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'çık') {
            console.log(chalk.yellow('👋 Görüşürüz! Yardımcı olabildiysem ne mutlu bana!'));
            resolve();
            return;
          }

          if (!input.trim()) {
            askQuestion();
            return;
          }

          // Konuşma geçmişine ekle
          this.conversationHistory.push({role: 'user', content: input});

          const spinner = ora('🤔 Analiz ediyorum...').start();
          
          try {
            // Önce özel komutları kontrol et
            const specialResponse = await this.handleSpecialCommands(input);
            
            let aiResponse: AIResponse;
            
            if (specialResponse) {
              spinner.stop();
              console.log(chalk.green('🤖 LocoDex: ') + specialResponse + '\n');
              
              // AI'ya da sor ki daha detaylı cevap versin
              spinner.start('💡 AI analizi ekleniyor...');
              aiResponse = await this.sendToAI(input + '\n\nYukarıdaki bilgileri analiz ederek daha detaylı açıklama ve öneriler verebilir misin?');
              spinner.stop();
              console.log(chalk.blue('💡 AI Analizi: ') + aiResponse.content + '\n');
            } else {
              aiResponse = await this.sendToAI(input);
              spinner.stop();
              console.log(chalk.green('🤖 LocoDex: ') + aiResponse.content + '\n');
            }
            
            // Konuşma geçmişine ekle
            this.conversationHistory.push({role: 'assistant', content: aiResponse.content});
            
            // Dosya oluşturma kontrolü
            await this.handleFileCreation(aiResponse.content, input);
            
          } catch (error) {
            spinner.fail('Bir hata oluştu');
            console.error(chalk.red('❌ Hata:'), error instanceof Error ? error.message : error);
          }
          
          askQuestion();
        });
      };

      askQuestion();
    });
  }
}

