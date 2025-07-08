import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import ora from 'ora';

const execAsync = promisify(exec);

export class TerminalManager {
  private spinner = ora();

  async executeCommand(command: string): Promise<void> {
    console.log(chalk.cyan(`🖥️  Terminal komutu çalıştırılıyor: ${command}`));
    this.spinner.start('Komut çalıştırılıyor...');

    try {
      // Güvenlik kontrolü - sadece güvenli komutlara izin ver
      if (this.isUnsafeCommand(command)) {
        this.spinner.fail('❌ Güvenlik nedeniyle bu komut çalıştırılamaz');
        console.log(chalk.red('🚫 Güvenli olmayan komutlar: rm, sudo, chmod +x, curl | sh, wget | sh'));
        return;
      }

      const { stdout, stderr } = await execAsync(command, { 
        timeout: 30000, // 30 saniye timeout
        maxBuffer: 1024 * 1024 // 1MB buffer
      });

      this.spinner.succeed('✅ Komut başarıyla tamamlandı');

      if (stdout) {
        console.log(chalk.green('\n📤 Çıktı:'));
        console.log(stdout);
      }

      if (stderr) {
        console.log(chalk.yellow('\n⚠️  Uyarılar:'));
        console.log(stderr);
      }

    } catch (error: any) {
      this.spinner.fail('❌ Komut çalıştırma hatası');
      
      if (error.code === 'ENOENT') {
        console.log(chalk.red('🚫 Komut bulunamadı. Komutun yüklü olduğundan emin olun.'));
      } else if (error.signal === 'SIGTERM') {
        console.log(chalk.red('⏰ Komut zaman aşımına uğradı (30 saniye)'));
      } else {
        console.log(chalk.red(`💥 Hata: ${error.message}`));
        
        if (error.stdout) {
          console.log(chalk.gray('\n📤 Stdout:'));
          console.log(error.stdout);
        }
        
        if (error.stderr) {
          console.log(chalk.gray('\n📥 Stderr:'));
          console.log(error.stderr);
        }
      }
    }
  }

  async runInteractiveShell(): Promise<void> {
    console.log(chalk.cyan('🖥️  LocoDex Terminal Başlatılıyor...'));
    console.log(chalk.gray('Çıkış için "exit" yazın. Güvenli komutlar: ls, pwd, cat, grep, find, git, npm, node'));
    
    const prompt = require('prompt-sync')({ sigint: true });

    while (true) {
      try {
        const command = prompt(chalk.yellow('LocoDex Terminal $ '));
        
        if (!command || command.trim() === '') {
          continue;
        }
        
        if (command.toLowerCase().trim() === 'exit') {
          console.log(chalk.green('👋 Terminal kapatılıyor...'));
          break;
        }

        if (command.toLowerCase().trim() === 'help') {
          this.showHelp();
          continue;
        }

        await this.executeCommand(command.trim());
        console.log(''); // Boş satır ekle

      } catch (error) {
        if (error instanceof Error && error.message === 'canceled') {
          console.log(chalk.green('\n👋 Terminal kapatılıyor...'));
          break;
        }
        console.log(chalk.red(`❌ Terminal hatası: ${error}`));
      }
    }
  }

  private isUnsafeCommand(command: string): boolean {
    const unsafePatterns = [
      /\brm\s+-rf/,           // rm -rf
      /\brm\s+[^-]/,          // rm files
      /\bsudo\b/,             // sudo commands
      /\bchmod\s+\+x/,        // chmod +x
      /curl.*\|\s*sh/,        // curl | sh
      /wget.*\|\s*sh/,        // wget | sh
      /\>\s*\/dev\/sd/,       // disk operations
      /\bdd\s+if=/,           // dd command
      /\bmkfs\b/,             // filesystem operations
      /\bformat\b/,           // format command
      /\bfdisk\b/,            // fdisk
      /\breboot\b/,           // reboot
      /\bshutdown\b/,         // shutdown
      /\bkill\s+-9/,          // kill -9
      /\bpkill\b/,            // pkill
      /\>\s*\/etc\//,         // write to /etc/
      /\>\s*\/usr\//,         // write to /usr/
      /\>\s*\/bin\//,         // write to /bin/
    ];

    return unsafePatterns.some(pattern => pattern.test(command));
  }

  private showHelp(): void {
    console.log(chalk.cyan('\n📚 LocoDex Terminal Yardım'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.green('✅ Güvenli Komutlar:'));
    console.log('  • ls, pwd, cd         - Dosya navigasyonu');
    console.log('  • cat, head, tail     - Dosya okuma');
    console.log('  • grep, find          - Arama');
    console.log('  • git status, git log - Git işlemleri');
    console.log('  • npm install, npm run - Node.js');
    console.log('  • node, python        - Kod çalıştırma');
    console.log('  • echo, date          - Sistem bilgisi');
    
    console.log(chalk.red('\n🚫 Yasak Komutlar:'));
    console.log('  • rm, sudo, chmod +x  - Sistem değişiklikleri');
    console.log('  • curl|sh, wget|sh    - Güvenli olmayan indirmeler');
    console.log('  • reboot, shutdown    - Sistem kontrolü');
    
    console.log(chalk.yellow('\n💡 Özel Komutlar:'));
    console.log('  • help  - Bu yardımı göster');
    console.log('  • exit  - Terminal\'den çık\n');
  }
}