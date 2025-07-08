import chalk from 'chalk';
import ora, { Ora } from 'ora';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class DocumentManager {
  private rl: readline.Interface;
  private spinner: Ora;
  private pythonService: string;

  constructor() {
    // Clean up any existing listeners
    process.stdin.removeAllListeners();
    process.removeAllListeners('SIGINT');
    
    // Reset stdin
    if (process.stdin.setRawMode) {
      try {
        process.stdin.setRawMode(false);
      } catch (e) {
        // ignore
      }
    }
    
    process.stdin.pause();
    process.stdin.resume();
    
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });
    
    if (process.stdin.setEncoding) {
      process.stdin.setEncoding('utf8');
    }
    
    // SIGINT handler
    this.rl.on('SIGINT', () => {
      console.log(chalk.yellow('\n👋 Belge Yöneticisi kapatılıyor...'));
      this.cleanup();
      process.exit(0);
    });
    
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n👋 Belge Yöneticisi kapatılıyor...'));
      this.cleanup();
      process.exit(0);
    });
    
    this.spinner = ora();
    this.pythonService = this.findPythonService();
  }

  private findPythonService(): string {
    // Python servisinin yolunu bul
    const possiblePaths = [
      path.join(process.cwd(), '../../src/services/enterprise_rag_service/document_processor.py'),
      path.join(process.cwd(), '../src/services/enterprise_rag_service/document_processor.py'),
      path.join(process.cwd(), 'src/services/enterprise_rag_service/document_processor.py')
    ];
    
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
    
    return 'document_processor.py'; // Fallback
  }

  public async start(): Promise<void> {
    this.displayWelcomeScreen();
    await this.showMainMenu();
  }

  private displayWelcomeScreen(): void {
    console.clear();
    console.log(chalk.blue('╔══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.blue('║') + chalk.bold.green('     ██████╗  ██████╗  ██████╗██╗   ██╗███╗   ███╗███████╗███╗   ██╗████████╗    ███╗   ███╗ █████╗ ███╗   ██╗ █████╗  ██████╗ ███████╗██████╗                                                                 ') + chalk.blue('║'));
    console.log(chalk.blue('║') + chalk.bold.green('     ██╔══██╗██╔═══██╗██╔════╝██║   ██║████╗ ████║██╔════╝████╗  ██║╚══██╔══╝    ████╗ ████║██╔══██╗████╗  ██║██╔══██╗██╔════╝ ██╔════╝██╔══██╗                                                                ') + chalk.blue('║'));
    console.log(chalk.blue('║') + chalk.bold.green('     ██║  ██║██║   ██║██║     ██║   ██║██╔████╔██║█████╗  ██╔██╗ ██║   ██║       ██╔████╔██║███████║██╔██╗ ██║███████║██║  ███╗█████╗  ██████╔╝                                                                ') + chalk.blue('║'));
    console.log(chalk.blue('║') + chalk.bold.green('     ██║  ██║██║   ██║██║     ██║   ██║██║╚██╔╝██║██╔══╝  ██║╚██╗██║   ██║       ██║╚██╔╝██║██╔══██║██║╚██╗██║██╔══██║██║   ██║██╔══╝  ██╔══██╗                                                                ') + chalk.blue('║'));
    console.log(chalk.blue('║') + chalk.bold.green('     ██████╔╝╚██████╔╝╚██████╗╚██████╔╝██║ ╚═╝ ██║███████╗██║ ╚████║   ██║       ██║ ╚═╝ ██║██║  ██║██║ ╚████║██║  ██║╚██████╔╝███████╗██║  ██║                                                                ') + chalk.blue('║'));
    console.log(chalk.blue('║') + chalk.bold.green('     ╚═════╝  ╚═════╝  ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚══════╝╚═╝  ╚═══╝   ╚═╝       ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝                                                                ') + chalk.blue('║'));
    console.log(chalk.blue('║') + chalk.bold.yellow('                                                            🏢 Kurumsal Belge Yönetimi ve RAG Sistemi                                                                                                               ') + chalk.blue('║'));
    console.log(chalk.blue('╚══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝'));
    console.log('');
    console.log(chalk.green('🌟 Kurumsal Belge Sistemi Hoş Geldiniz!'));
    console.log(chalk.gray('   AI destekli belge analizi ve akıllı sorgulama sistemi'));
    console.log('');
    console.log(chalk.cyan('🔧 Özellikler:'));
    console.log(chalk.green('   📊 ') + chalk.white('Otomatik kategorizasyon (Finans, İK, Teknik, Politika)'));
    console.log(chalk.green('   🔍 ') + chalk.white('Semantik arama ve anahtar kelime analizi'));
    console.log(chalk.green('   📈 ') + chalk.white('Departman bazlı organizasyon'));
    console.log(chalk.green('   🤖 ') + chalk.white('AI destekli özet ve anahtar kelime çıkarımı'));
    console.log(chalk.green('   📋 ') + chalk.white('Kapsamlı raporlama ve istatistikler'));
    console.log('');
    console.log(chalk.yellow('💡 Desteklenen Format: ') + chalk.gray('PDF, Word, Excel, PowerPoint, TXT'));
    console.log('');
  }

  private async showMainMenu(): Promise<void> {
    while (true) {
      console.log(chalk.cyan('┌─────────────────────────────────────────────────────────────────────────────┐'));
      console.log(chalk.cyan('│') + chalk.bold.white(' 📋 Ana Menü - Belge Yönetimi                                                  ') + chalk.cyan('│'));
      console.log(chalk.cyan('└─────────────────────────────────────────────────────────────────────────────┘'));
      console.log('');
      console.log(chalk.green('  1. ') + chalk.white('📁 Belge/Dizin Yükle ve İşle'));
      console.log(chalk.green('  2. ') + chalk.white('🔍 Belge Arama'));
      console.log(chalk.green('  3. ') + chalk.white('📊 İstatistikler ve Raporlar'));
      console.log(chalk.green('  4. ') + chalk.white('📋 Belge Listesi'));
      console.log(chalk.green('  5. ') + chalk.white('🧹 Veritabanını Temizle'));
      console.log(chalk.green('  0. ') + chalk.white('❌ Çıkış'));
      console.log('');

      const choice = await this.promptUser('Seçiminizi yapın (0-5): ');
      
      switch (choice) {
        case '1':
          await this.handleDocumentUpload();
          break;
        case '2':
          await this.handleDocumentSearch();
          break;
        case '3':
          await this.handleStatistics();
          break;
        case '4':
          await this.handleDocumentList();
          break;
        case '5':
          await this.handleDatabaseCleanup();
          break;
        case '0':
          console.log(chalk.yellow('\n👋 Belge Yöneticisi kapatılıyor...'));
          this.cleanup();
          return;
        default:
          console.log(chalk.red('❌ Geçersiz seçim! Lütfen 0-5 arası bir sayı girin.'));
      }
      
      console.log('\n' + chalk.gray('─'.repeat(80)) + '\n');
    }
  }

  private async handleDocumentUpload(): Promise<void> {
    console.log(chalk.cyan('\n📁 Belge Yükleme ve İşleme'));
    console.log(chalk.gray('Tek dosya veya tüm dizin işleyebilirsiniz.\n'));
    
    const type = await this.promptUser('Dosya (f) yoksa Dizin (d) işlemek istiyorsunuz? (f/d): ');
    
    if (type.toLowerCase() === 'f') {
      const filePath = await this.promptUser('Dosya yolunu girin: ');
      await this.processDocument(filePath);
    } else if (type.toLowerCase() === 'd') {
      const dirPath = await this.promptUser('Dizin yolunu girin: ');
      await this.processDirectory(dirPath);
    } else {
      console.log(chalk.red('❌ Geçersiz seçim!'));
    }
  }

  private async processDocument(filePath: string): Promise<void> {
    if (!fs.existsSync(filePath)) {
      console.log(chalk.red(`❌ Dosya bulunamadı: ${filePath}`));
      return;
    }

    this.spinner.start(chalk.yellow('📄 Belge işleniyor...'));
    
    try {
      const result = await execAsync(`python3 -c "
import sys
sys.path.append('${path.dirname(this.pythonService)}')
from document_processor import EnterpriseDocumentProcessor
processor = EnterpriseDocumentProcessor()
result = processor.process_document('${filePath}')
print('RESULT_START')
import json
print(json.dumps(result))
print('RESULT_END')
"`);

      const output = result.stdout;
      const resultMatch = output.match(/RESULT_START\n(.*)\nRESULT_END/s);
      
      if (resultMatch) {
        const processResult = JSON.parse(resultMatch[1]);
        
        if (processResult.status === 'success') {
          this.spinner.succeed(chalk.green('✅ Belge başarıyla işlendi!'));
          console.log(chalk.cyan('📊 Sonuçlar:'));
          console.log(chalk.green(`   📁 Dosya: ${processResult.filename}`));
          console.log(chalk.blue(`   🏷️  Kategori: ${processResult.category}`));
          console.log(chalk.purple(`   🏢 Departman: ${processResult.department}`));
          console.log(chalk.yellow(`   🔑 Anahtar Kelimeler: ${processResult.keywords.join(', ')}`));
          console.log(chalk.gray(`   📝 Özet: ${processResult.summary.substring(0, 100)}...`));
        } else if (processResult.status === 'already_processed') {
          this.spinner.warn(chalk.yellow('⏭️ Belge zaten işlenmiş'));
        } else {
          this.spinner.fail(chalk.red(`❌ Hata: ${processResult.error}`));
        }
      } else {
        this.spinner.fail(chalk.red('❌ Python servisinden yanıt alınamadı'));
        console.log(chalk.gray('Debug - Output:'), output);
      }
    } catch (error) {
      this.spinner.fail(chalk.red('❌ Belge işleme hatası'));
      console.log(chalk.red(`Hata: ${error}`));
    }
  }

  private async processDirectory(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      console.log(chalk.red(`❌ Dizin bulunamadı: ${dirPath}`));
      return;
    }

    this.spinner.start(chalk.yellow('📁 Dizin taranıyor...'));
    
    try {
      const result = await execAsync(`python3 -c "
import sys
sys.path.append('${path.dirname(this.pythonService)}')
from document_processor import EnterpriseDocumentProcessor, process_directory
processor = EnterpriseDocumentProcessor()
process_directory('${dirPath}', processor)
stats = processor.get_document_stats()
print('STATS_START')
import json
print(json.dumps(stats))
print('STATS_END')
"`);

      const output = result.stdout;
      const statsMatch = output.match(/STATS_START\n(.*)\nSTATS_END/s);
      
      this.spinner.succeed(chalk.green('✅ Dizin işleme tamamlandı!'));
      
      if (statsMatch) {
        const stats = JSON.parse(statsMatch[1]);
        this.displayStats(stats);
      }
      
      // İşlem çıktısını göster
      const lines = output.split('\n');
      console.log(chalk.cyan('\n📋 İşlem Detayları:'));
      lines.forEach(line => {
        if (line.includes('✅')) {
          console.log(chalk.green(line));
        } else if (line.includes('⏭️')) {
          console.log(chalk.yellow(line));
        } else if (line.includes('❌')) {
          console.log(chalk.red(line));
        } else if (line.includes('📊')) {
          console.log(chalk.blue(line));
        }
      });
      
    } catch (error) {
      this.spinner.fail(chalk.red('❌ Dizin işleme hatası'));
      console.log(chalk.red(`Hata: ${error}`));
    }
  }

  private async handleDocumentSearch(): Promise<void> {
    console.log(chalk.cyan('\n🔍 Belge Arama'));
    console.log(chalk.gray('Belgelerinizde semantik ve anahtar kelime tabanlı arama yapın.\n'));
    
    const query = await this.promptUser('Arama sorgunuzu girin: ');
    if (!query.trim()) {
      console.log(chalk.red('❌ Boş sorgu!'));
      return;
    }

    const categoryFilter = await this.promptUser('Kategori filtresi (boş bırakabilirsiniz): ');
    
    this.spinner.start(chalk.yellow('🔍 Arama yapılıyor...'));
    
    try {
      const result = await execAsync(`python3 -c "
import sys
sys.path.append('${path.dirname(this.pythonService)}')
from document_processor import EnterpriseDocumentProcessor
processor = EnterpriseDocumentProcessor()
results = processor.search_documents('${query}', top_k=10, category_filter='${categoryFilter || 'all'}')
print('SEARCH_START')
import json
print(json.dumps(results))
print('SEARCH_END')
"`);

      const output = result.stdout;
      const searchMatch = output.match(/SEARCH_START\n(.*)\nSEARCH_END/s);
      
      if (searchMatch) {
        const searchResults = JSON.parse(searchMatch[1]);
        
        this.spinner.succeed(chalk.green(`✅ ${searchResults.length} sonuç bulundu!`));
        
        if (searchResults.length > 0) {
          console.log(chalk.cyan('\n📋 Arama Sonuçları:'));
          console.log(chalk.gray('─'.repeat(80)));
          
          searchResults.forEach((result: any, index: number) => {
            console.log(chalk.green(`\n${index + 1}. ${result.filename}`));
            console.log(chalk.blue(`   🏷️  Kategori: ${result.category} | 🏢 Departman: ${result.department}`));
            console.log(chalk.yellow(`   📊 Skor: ${result.final_score.toFixed(2)}`));
            console.log(chalk.gray(`   📝 Eşleşen Metin: ${result.matched_text}`));
            if (result.summary) {
              console.log(chalk.cyan(`   📖 Özet: ${result.summary.substring(0, 150)}...`));
            }
          });
        } else {
          console.log(chalk.yellow('\n⚠️ Hiç sonuç bulunamadı.'));
          console.log(chalk.gray('💡 İpucu: Farklı anahtar kelimeler deneyin veya kategori filtresini kaldırın.'));
        }
      } else {
        this.spinner.fail(chalk.red('❌ Arama sonuçları alınamadı'));
      }
    } catch (error) {
      this.spinner.fail(chalk.red('❌ Arama hatası'));
      console.log(chalk.red(`Hata: ${error}`));
    }
  }

  private async handleStatistics(): Promise<void> {
    console.log(chalk.cyan('\n📊 İstatistikler ve Raporlar'));
    
    this.spinner.start(chalk.yellow('📈 İstatistikler yükleniyor...'));
    
    try {
      const result = await execAsync(`python3 -c "
import sys
sys.path.append('${path.dirname(this.pythonService)}')
from document_processor import EnterpriseDocumentProcessor
processor = EnterpriseDocumentProcessor()
stats = processor.get_document_stats()
print('STATS_START')
import json
print(json.dumps(stats))
print('STATS_END')
"`);

      const output = result.stdout;
      const statsMatch = output.match(/STATS_START\n(.*)\nSTATS_END/s);
      
      if (statsMatch) {
        const stats = JSON.parse(statsMatch[1]);
        this.spinner.succeed(chalk.green('✅ İstatistikler yüklendi!'));
        this.displayStats(stats);
      } else {
        this.spinner.fail(chalk.red('❌ İstatistikler alınamadı'));
      }
    } catch (error) {
      this.spinner.fail(chalk.red('❌ İstatistik hatası'));
      console.log(chalk.red(`Hata: ${error}`));
    }
  }

  private displayStats(stats: any): void {
    console.log(chalk.cyan('\n📊 Belge Sistemi İstatistikleri'));
    console.log(chalk.gray('═'.repeat(50)));
    
    console.log(chalk.green(`\n📚 Toplam Belge Sayısı: ${stats.total_documents}`));
    
    if (Object.keys(stats.categories).length > 0) {
      console.log(chalk.blue('\n🏷️ Kategorilere Göre Dağılım:'));
      Object.entries(stats.categories).forEach(([category, count]) => {
        const percentage = ((count as number) / stats.total_documents * 100).toFixed(1);
        console.log(chalk.white(`   • ${category}: ${count} belge (${percentage}%)`));
      });
    }
    
    if (Object.keys(stats.departments).length > 0) {
      console.log(chalk.purple('\n🏢 Departmanlara Göre Dağılım:'));
      Object.entries(stats.departments).forEach(([dept, count]) => {
        const percentage = ((count as number) / stats.total_documents * 100).toFixed(1);
        console.log(chalk.white(`   • ${dept}: ${count} belge (${percentage}%)`));
      });
    }
    
    console.log(chalk.yellow(`\n🔍 Son 7 Günün Arama Sayısı: ${stats.recent_searches}`));
    if (stats.avg_response_time_ms > 0) {
      console.log(chalk.yellow(`⚡ Ortalama Yanıt Süresi: ${stats.avg_response_time_ms.toFixed(0)}ms`));
    }
  }

  private async handleDocumentList(): Promise<void> {
    console.log(chalk.cyan('\n📋 Belge Listesi'));
    
    this.spinner.start(chalk.yellow('📁 Belgeler yükleniyor...'));
    
    try {
      const result = await execAsync(`python3 -c "
import sys
sys.path.append('${path.dirname(this.pythonService)}')
from document_processor import EnterpriseDocumentProcessor
import sqlite3
processor = EnterpriseDocumentProcessor()
conn = sqlite3.connect(processor.db_path)
cursor = conn.cursor()
cursor.execute('SELECT filename, category, department, upload_date FROM documents ORDER BY upload_date DESC LIMIT 20')
docs = cursor.fetchall()
conn.close()
print('DOCS_START')
import json
print(json.dumps(docs))
print('DOCS_END')
"`);

      const output = result.stdout;
      const docsMatch = output.match(/DOCS_START\n(.*)\nDOCS_END/s);
      
      if (docsMatch) {
        const docs = JSON.parse(docsMatch[1]);
        this.spinner.succeed(chalk.green(`✅ ${docs.length} belge listelendi!`));
        
        if (docs.length > 0) {
          console.log(chalk.cyan('\n📋 Son Yüklenen Belgeler:'));
          console.log(chalk.gray('─'.repeat(80)));
          
          docs.forEach((doc: any, index: number) => {
            const [filename, category, department, uploadDate] = doc;
            const date = new Date(uploadDate).toLocaleDateString('tr-TR');
            console.log(chalk.green(`\n${index + 1}. ${filename}`));
            console.log(chalk.blue(`   🏷️ ${category} | 🏢 ${department} | 📅 ${date}`));
          });
        } else {
          console.log(chalk.yellow('\n⚠️ Henüz belge yüklenmemiş.'));
        }
      } else {
        this.spinner.fail(chalk.red('❌ Belge listesi alınamadı'));
      }
    } catch (error) {
      this.spinner.fail(chalk.red('❌ Liste hatası'));
      console.log(chalk.red(`Hata: ${error}`));
    }
  }

  private async handleDatabaseCleanup(): Promise<void> {
    console.log(chalk.red('\n🧹 Veritabanını Temizle'));
    console.log(chalk.yellow('⚠️  Bu işlem TÜM belgeleri ve indeksleri silecek!'));
    
    const confirm = await this.promptUser('Emin misiniz? (evet/hayır): ');
    
    if (confirm.toLowerCase() === 'evet') {
      this.spinner.start(chalk.yellow('🧹 Veritabanı temizleniyor...'));
      
      try {
        const result = await execAsync(`python3 -c "
import sys
sys.path.append('${path.dirname(this.pythonService)}')
from document_processor import EnterpriseDocumentProcessor
import sqlite3
import os
processor = EnterpriseDocumentProcessor()
if os.path.exists(processor.db_path):
    os.remove(processor.db_path)
    print('Database deleted')
processor.setup_database()
print('Database recreated')
"`);

        this.spinner.succeed(chalk.green('✅ Veritabanı başarıyla temizlendi!'));
      } catch (error) {
        this.spinner.fail(chalk.red('❌ Temizleme hatası'));
        console.log(chalk.red(`Hata: ${error}`));
      }
    } else {
      console.log(chalk.green('✅ İşlem iptal edildi.'));
    }
  }

  private promptUser(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(chalk.cyan(question), (answer) => {
        resolve(answer.trim());
      });
    });
  }

  private cleanup(): void {
    if (this.spinner.isSpinning) {
      this.spinner.stop();
    }
    this.rl.close();
  }
}