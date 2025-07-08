#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Bu script TypeScript error tiplerini düzeltir

function fixErrorTypes(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // error.message tiplerini düzelt
  content = content.replace(/error\.message/g, '(error as any).message');
  
  // Duplicate property hatalarını düzelt
  if (filePath.includes('configurationProvider.ts')) {
    // statusCode ve type dublicate hatalarını düzelt
    content = content.replace(/statusCode: error\.response\.status,\s*statusCode:/g, 'statusCode: error.response.status,');
    content = content.replace(/type,\s*type:/g, 'type,');
  }
  
  // vscode.context hatasını düzelt (olmayan bir global)
  content = content.replace(/vscode\.context/g, 'this.context');
  
  // utils/codeUtils.ts'teki promise hatasını düzelt
  if (filePath.includes('codeUtils.ts')) {
    content = content.replace(/\.catch\(\(\) => {[\s\S]*?}\);/g, '.catch((err: any) => {\n      // Ignore if package.json doesn\'t exist\n    });');
  }
  
  fs.writeFileSync(filePath, content);
  console.log(`Fixed: ${filePath}`);
}

// Tüm .ts dosyalarını bul ve düzelt
function walkDir(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && file !== 'node_modules') {
      walkDir(filePath);
    } else if (file.endsWith('.ts')) {
      fixErrorTypes(filePath);
    }
  }
}

// Sadece src klasörünü işle
walkDir('./src');

console.log('Error types fixed!');