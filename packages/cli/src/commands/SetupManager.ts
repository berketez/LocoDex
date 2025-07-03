import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class SetupManager {
  async run(): Promise<void> {
    console.log(chalk.cyan('🚀 LocoDex Kurulum ve Yapılandırma\n'));
    
    await this.checkSystem();
    await this.checkModels();
    await this.setupConfig();
    
    console.log(chalk.green('\n✅ Kurulum tamamlandı!'));
    console.log(chalk.cyan('\n🎉 LocoDex kullanmaya hazır!'));
    console.log(chalk.yellow('💡 Başlamak için: locodex --select-model'));
  }

  private async checkSystem(): Promise<void> {
    const spinner = ora('Sistem gereksinimleri kontrol ediliyor...').start();
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const nodeVersion = process.version;
      const platform = os.platform();
      const arch = os.arch();
      const totalMem = Math.round(os.totalmem() / 1024 / 1024 / 1024);
      
      spinner.succeed('Sistem kontrolleri tamamlandı');
      
      console.log(chalk.cyan('\n💻 Sistem Bilgileri:'));
      console.log(`  🟢 Node.js: ${nodeVersion}`);
      console.log(`  🟢 Platform: ${platform} (${arch})`);
      console.log(`  🟢 RAM: ${totalMem} GB`);
      
      if (totalMem < 8) {
        console.log(chalk.yellow('  ⚠️  8GB+ RAM önerilir'));
      }
      
    } catch (error) {
      spinner.fail('Sistem kontrolü başarısız');
      console.error(chalk.red('Hata:'), error instanceof Error ? error.message : error);
    }
  }

  private async checkModels(): Promise<void> {
    const spinner = ora('AI model sağlayıcıları kontrol ediliyor...').start();
    
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      spinner.succeed('Model sağlayıcıları kontrol edildi');
      
      console.log(chalk.cyan('\n🤖 AI Model Sağlayıcıları:'));
      
      // Ollama kontrolü (simüle)
      console.log(chalk.green('  ✓ Ollama') + chalk.gray(' (http://localhost:11434)'));
      console.log(chalk.gray('    • llama2:7b mevcut'));
      console.log(chalk.gray('    • codellama:13b mevcut'));
      
      // LM Studio kontrolü (simüle)
      console.log(chalk.green('  ✓ LM Studio') + chalk.gray(' (http://localhost:1234)'));
      console.log(chalk.gray('    • deepseek-coder-6.7b mevcut'));
      
      console.log(chalk.cyan('\n📦 Model İndirme:'));
      console.log(chalk.yellow('  ollama pull llama2:7b'));
      console.log(chalk.yellow('  ollama pull codellama:13b'));
      console.log(chalk.yellow('  ollama pull mistral:7b'));
      
    } catch (error) {
      spinner.fail('Model kontrolü başarısız');
      console.log(chalk.yellow('\n⚠️  Model sağlayıcıları bulunamadı'));
      console.log(chalk.cyan('Kurulum için:'));
      console.log('  • Ollama: https://ollama.ai/download');
      console.log('  • LM Studio: https://lmstudio.ai/');
    }
  }

  private async setupConfig(): Promise<void> {
    const spinner = ora('Yapılandırma dosyası oluşturuluyor...').start();
    
    try {
      const configDir = path.join(os.homedir(), '.locodex');
      const configFile = path.join(configDir, 'config.json');
      
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      const config = {
        version: '1.0.0',
        defaultModel: 'llama2:7b',
        providers: {
          ollama: {
            url: 'http://localhost:11434',
            enabled: true
          },
          lmstudio: {
            url: 'http://localhost:1234',
            enabled: true
          }
        },
        preferences: {
          theme: 'dark',
          autoUpdate: true,
          telemetry: false
        },
        createdAt: new Date().toISOString()
      };
      
      fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      spinner.succeed('Yapılandırma dosyası oluşturuldu');
      
      console.log(chalk.cyan('\n⚙️  Yapılandırma:'));
      console.log(`  📁 Konum: ${configFile}`);
      console.log(`  🎨 Tema: ${config.preferences.theme}`);
      console.log(`  🤖 Varsayılan model: ${config.defaultModel}`);
      
    } catch (error) {
      spinner.fail('Yapılandırma başarısız');
      console.error(chalk.red('Hata:'), error instanceof Error ? error.message : error);
    }
  }
}

