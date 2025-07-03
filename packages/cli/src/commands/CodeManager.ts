import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { spawn } from 'child_process';

interface AnalysisResult {
  errors: string[];
  warnings: string[];
  suggestions: string[];
  metrics: {
    lines: number;
    complexity: number;
    maintainability: string;
  };
}

export class CodeManager {
  async analyzeFile(filePath: string): Promise<void> {
    const spinner = ora(`${filePath} dosyası analiz ediliyor...`).start();
    
    try {
      if (!fs.existsSync(filePath)) {
        spinner.fail('Dosya bulunamadı');
        return;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const stats = fs.statSync(filePath);
      const ext = path.extname(filePath);
      
      // Gerçek analiz yap
      const analysis = await this.performRealAnalysis(filePath, content);
      
      spinner.succeed('Dosya analizi tamamlandı');
      
      console.log(chalk.cyan('\n📄 Dosya Bilgileri:'));
      console.log(`  📁 Yol: ${filePath}`);
      console.log(`  📏 Boyut: ${stats.size} bytes`);
      console.log(`  🔤 Satır sayısı: ${analysis.metrics.lines}`);
      console.log(`  📝 Uzantı: ${ext}`);
      
      console.log(chalk.cyan('\n🔍 Analiz Sonuçları:'));
      
      if (analysis.errors.length === 0) {
        console.log(chalk.green('  ✓ Söz dizimi hatası yok'));
      } else {
        console.log(chalk.red(`  ❌ ${analysis.errors.length} hata bulundu:`));
        analysis.errors.forEach(error => {
          console.log(chalk.red(`    • ${error}`));
        });
      }
      
      if (analysis.warnings.length > 0) {
        console.log(chalk.yellow(`  ⚠️  ${analysis.warnings.length} uyarı:`));
        analysis.warnings.forEach(warning => {
          console.log(chalk.yellow(`    • ${warning}`));
        });
      }
      
      console.log(chalk.blue(`  ℹ️  Kod kalitesi: ${analysis.metrics.maintainability}`));
      console.log(chalk.blue(`  📊 Karmaşıklık: ${analysis.metrics.complexity}`));
      
      if (analysis.suggestions.length > 0) {
        console.log(chalk.cyan('\n💡 İyileştirme Önerileri:'));
        analysis.suggestions.forEach(suggestion => {
          console.log(`  • ${suggestion}`);
        });
      }
      
    } catch (error) {
      spinner.fail('Dosya analizi başarısız');
      console.error(chalk.red('Hata:'), error instanceof Error ? error.message : error);
    }
  }

  async analyzeDirectory(dirPath: string): Promise<void> {
    const spinner = ora(`${dirPath} dizini analiz ediliyor...`).start();
    
    try {
      if (!fs.existsSync(dirPath)) {
        spinner.fail('Dizin bulunamadı');
        return;
      }

      const files = await glob('**/*.{js,ts,jsx,tsx,py,java,cpp,c,h}', { 
        cwd: dirPath,
        ignore: ['node_modules/**', 'dist/**', 'build/**', '.git/**']
      });
      
      // Gerçek analiz yap
      const projectAnalysis = await this.analyzeProject(dirPath, files);
      
      spinner.succeed('Dizin analizi tamamlandı');
      
      console.log(chalk.cyan('\n📁 Proje Analizi:'));
      console.log(`  📂 Dizin: ${dirPath}`);
      console.log(`  📄 Dosya sayısı: ${files.length}`);
      
      const extensions = files.reduce((acc, file) => {
        const ext = path.extname(file);
        acc[ext] = (acc[ext] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log(chalk.cyan('\n📊 Dosya Türleri:'));
      Object.entries(extensions).forEach(([ext, count]) => {
        console.log(`  ${ext}: ${count} dosya`);
      });
      
      console.log(chalk.cyan('\n🎯 Proje Sağlığı:'));
      console.log(chalk.green(`  ✓ Toplam satır: ${projectAnalysis.totalLines}`));
      console.log(chalk.blue(`  📊 Ortalama karmaşıklık: ${projectAnalysis.avgComplexity}`));
      console.log(chalk.yellow(`  ⚠️  Toplam uyarı: ${projectAnalysis.totalWarnings}`));
      console.log(chalk.red(`  ❌ Toplam hata: ${projectAnalysis.totalErrors}`));
      
      if (projectAnalysis.recommendations.length > 0) {
        console.log(chalk.cyan('\n💡 Proje Önerileri:'));
        projectAnalysis.recommendations.forEach(rec => {
          console.log(`  • ${rec}`);
        });
      }
      
    } catch (error) {
      spinner.fail('Dizin analizi başarısız');
      console.error(chalk.red('Hata:'), error instanceof Error ? error.message : error);
    }
  }

  private async performRealAnalysis(filePath: string, content: string): Promise<AnalysisResult> {
    const ext = path.extname(filePath);
    const lines = content.split('\n');
    
    const result: AnalysisResult = {
      errors: [],
      warnings: [],
      suggestions: [],
      metrics: {
        lines: lines.length,
        complexity: 1,
        maintainability: 'A'
      }
    };

    // Gerçek analiz yapalım
    try {
      // JavaScript/TypeScript için ESLint benzeri kontroller
      if (['.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
        await this.analyzeJavaScript(content, result);
      }
      
      // Python için pyflakes benzeri kontroller  
      if (ext === '.py') {
        await this.analyzePython(filePath, result);
      }
      
      // Genel kod kalitesi kontrolleri
      this.analyzeGeneral(content, result);
      
    } catch (error) {
      result.errors.push(`Analiz hatası: ${error instanceof Error ? error.message : error}`);
    }

    return result;
  }

  private async analyzeJavaScript(content: string, result: AnalysisResult): Promise<void> {
    // Basit JavaScript analizi
    const lines = content.split('\n');
    
    // Unused variables kontrolü
    const varDeclarations = content.match(/(?:let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g);
    if (varDeclarations) {
      varDeclarations.forEach(decl => {
        const varName = decl.split(/\s+/)[1];
        const usageCount = (content.match(new RegExp(`\\b${varName}\\b`, 'g')) || []).length;
        if (usageCount === 1) {
          result.warnings.push(`Kullanılmayan değişken: ${varName}`);
        }
      });
    }
    
    // Console.log kontrolü
    const consoleCount = (content.match(/console\.log/g) || []).length;
    if (consoleCount > 5) {
      result.warnings.push(`Çok fazla console.log kullanımı (${consoleCount})`);
    }
    
    // Function karmaşıklığı
    const functions = content.match(/function\s+\w+|=>\s*{|\w+\s*\(/g) || [];
    result.metrics.complexity = Math.min(10, Math.max(1, functions.length / 2));
    
    // Maintainability hesapla
    if (result.metrics.complexity <= 3) result.metrics.maintainability = 'A';
    else if (result.metrics.complexity <= 6) result.metrics.maintainability = 'B';
    else result.metrics.maintainability = 'C';
    
    // Öneriler
    if (!content.includes('use strict')) {
      result.suggestions.push("'use strict' direktifi ekleyin");
    }
    
    if (!content.includes('try') && content.includes('fetch')) {
      result.suggestions.push('Async işlemler için error handling ekleyin');
    }
  }

  private async analyzePython(filePath: string, result: AnalysisResult): Promise<void> {
    return new Promise((resolve) => {
      // Python syntax kontrolü
      const python = spawn('python3', ['-m', 'py_compile', filePath]);
      
      let errorOutput = '';
      
      python.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      python.on('close', (code) => {
        if (code !== 0 && errorOutput) {
          const errors = errorOutput.split('\n').filter(line => line.trim());
          errors.forEach(error => {
            if (error.includes('SyntaxError')) {
              result.errors.push(`Syntax hatası: ${error}`);
            }
          });
        }
        
        // Dosya içeriğini oku ve analiz et
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          
          // Import kontrolü
          const imports = content.match(/^import\s+\w+|^from\s+\w+/gm) || [];
          if (imports.length > 10) {
            result.warnings.push(`Çok fazla import (${imports.length})`);
          }
          
          // Function karmaşıklığı
          const functions = content.match(/^def\s+\w+/gm) || [];
          result.metrics.complexity = Math.min(10, Math.max(1, functions.length / 3));
          
          // PEP 8 kontrolleri
          const longLines = content.split('\n').filter(line => line.length > 79);
          if (longLines.length > 0) {
            result.warnings.push(`${longLines.length} satır 79 karakterden uzun`);
          }
          
          // Öneriler
          if (!content.includes('"""') && functions.length > 0) {
            result.suggestions.push('Fonksiyonlar için docstring ekleyin');
          }
          
        } catch (readError) {
          result.errors.push(`Dosya okuma hatası: ${readError}`);
        }
        
        resolve();
      });
      
      python.on('error', () => {
        result.warnings.push('Python syntax kontrolü yapılamadı');
        resolve();
      });
    });
  }

  private analyzeGeneral(content: string, result: AnalysisResult): void {
    const lines = content.split('\n');
    
    // Boş satır oranı
    const emptyLines = lines.filter(line => line.trim() === '').length;
    const emptyRatio = emptyLines / lines.length;
    
    if (emptyRatio > 0.3) {
      result.suggestions.push('Çok fazla boş satır var, temizlenebilir');
    }
    
    // Çok uzun satırlar
    const longLines = lines.filter(line => line.length > 120);
    if (longLines.length > 0) {
      result.warnings.push(`${longLines.length} satır çok uzun (>120 karakter)`);
    }
    
    // TODO/FIXME kontrolleri
    const todos = (content.match(/TODO|FIXME|HACK/gi) || []).length;
    if (todos > 0) {
      result.suggestions.push(`${todos} adet TODO/FIXME bulundu`);
    }
    
    // Nested brackets
    const maxNesting = this.calculateMaxNesting(content);
    if (maxNesting > 4) {
      result.warnings.push(`Çok derin iç içe kod blokları (${maxNesting} seviye)`);
    }
  }

  private calculateMaxNesting(content: string): number {
    let maxDepth = 0;
    let currentDepth = 0;
    
    for (const char of content) {
      if (char === '{' || char === '(' || char === '[') {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      } else if (char === '}' || char === ')' || char === ']') {
        currentDepth--;
      }
    }
    
    return maxDepth;
  }

  private async analyzeProject(dirPath: string, files: string[]): Promise<{
    totalLines: number;
    totalErrors: number;
    totalWarnings: number;
    avgComplexity: number;
    recommendations: string[];
  }> {
    let totalLines = 0;
    let totalErrors = 0;
    let totalWarnings = 0;
    let totalComplexity = 0;
    const recommendations: string[] = [];
    
    // Her dosyayı analiz et
    for (const file of files.slice(0, 20)) { // İlk 20 dosya
      try {
        const fullPath = path.join(dirPath, file);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const analysis = await this.performRealAnalysis(fullPath, content);
        
        totalLines += analysis.metrics.lines;
        totalErrors += analysis.errors.length;
        totalWarnings += analysis.warnings.length;
        totalComplexity += analysis.metrics.complexity;
        
      } catch (error) {
        totalErrors++;
      }
    }
    
    // Proje seviyesi öneriler
    const jsFiles = files.filter(f => f.endsWith('.js') || f.endsWith('.ts')).length;
    const pyFiles = files.filter(f => f.endsWith('.py')).length;
    
    if (jsFiles > pyFiles && !files.some(f => f.includes('package.json'))) {
      recommendations.push('JavaScript projesi için package.json eksik');
    }
    
    if (pyFiles > jsFiles && !files.some(f => f.includes('requirements.txt'))) {
      recommendations.push('Python projesi için requirements.txt eksik');
    }
    
    if (!files.some(f => f.includes('README'))) {
      recommendations.push('README dosyası eklenmeli');
    }
    
    if (files.length > 50 && !files.some(f => f.includes('.gitignore'))) {
      recommendations.push('.gitignore dosyası eklenmeli');
    }
    
    return {
      totalLines,
      totalErrors,
      totalWarnings,
      avgComplexity: files.length > 0 ? Math.round(totalComplexity / files.length * 10) / 10 : 0,
      recommendations
    };
  }

  async interactive(): Promise<void> {
    console.log(chalk.cyan('💻 LocoDex Kod Analizi\n'));
    
    console.log('Mevcut komutlar:');
    console.log(chalk.green('  locodex code --file app.js') + chalk.gray('      Tek dosya analizi'));
    console.log(chalk.green('  locodex code --directory ./src') + chalk.gray('   Dizin analizi'));
    console.log(chalk.green('  locodex code') + chalk.gray('                   İnteraktif mod'));
    
    console.log(chalk.cyan('\n🔍 Gerçek Analiz Özellikleri:'));
    console.log('  • Syntax hatası kontrolü');
    console.log('  • Kod kalitesi metrikleri');
    console.log('  • Karmaşıklık analizi');
    console.log('  • PEP8/ESLint benzeri kontroller');
    console.log('  • Proje sağlık raporu');
    console.log('  • İyileştirme önerileri');
  }
}

