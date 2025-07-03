#!/bin/bash

# LocoDex DMG Otomatik Oluşturma Scripti
# Bu script uygulamayı build eder ve macOS için DMG dosyası oluşturur

set -e  # Hata durumunda script'i durdur

# Renkler
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonksiyonlar
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Başlık
echo "======================================"
echo "🚀 LocoDex DMG Builder"
echo "======================================"

# Ön koşulları kontrol et
log_info "Ön koşullar kontrol ediliyor..."

# Node.js kontrolü
if ! command -v node &> /dev/null; then
    log_error "Node.js bulunamadı! Lütfen Node.js yükleyin."
    exit 1
fi

# npm kontrolü
if ! command -v npm &> /dev/null; then
    log_error "npm bulunamadı! Lütfen npm yükleyin."
    exit 1
fi

# Xcode Command Line Tools kontrolü (macOS için gerekli)
if ! xcode-select -p &> /dev/null; then
    log_error "Xcode Command Line Tools bulunamadı! Lütfen 'xcode-select --install' çalıştırın."
    exit 1
fi

log_success "Tüm ön koşullar karşılanıyor!"

# Çalışma dizinini kontrol et
if [ ! -f "package.json" ]; then
    log_error "package.json bulunamadı! Bu scripti proje kök dizininde çalıştırın."
    exit 1
fi

# Eski build dosyalarını temizle
log_info "Eski build dosyaları temizleniyor..."
rm -rf dist/
rm -rf dist-electron/
rm -rf node_modules/.cache/

# Bağımlılıkları yükle
log_info "Bağımlılıklar yükleniyor..."
npm install

# CLI paketini build et
log_info "CLI paketi build ediliyor..."
if [ -d "packages/cli" ]; then
    cd packages/cli
    npm install
    npm run build
    cd ../..
    log_success "CLI paketi başarıyla build edildi!"
else
    log_warning "CLI paketi bulunamadı, atlanıyor..."
fi

# React uygulamasını build et
log_info "React uygulaması build ediliyor..."
npm run build
log_success "React uygulaması başarıyla build edildi!"

# Electron uygulamasını build et ve DMG oluştur
log_info "Electron uygulaması build ediliyor ve DMG oluşturuluyor..."
npm run dist

# Build sonucunu kontrol et
if [ -d "dist-electron" ] && [ -n "$(find dist-electron -name '*.dmg' 2>/dev/null)" ]; then
    DMG_FILE=$(find dist-electron -name '*.dmg' | head -1)
    DMG_SIZE=$(du -h "$DMG_FILE" | cut -f1)
    
    log_success "DMG dosyası başarıyla oluşturuldu!"
    echo ""
    echo "📦 DMG Dosyası: $DMG_FILE"
    echo "📏 Dosya Boyutu: $DMG_SIZE"
    echo ""
    
    # DMG dosyasını masaüstüne kopyala (opsiyonel)
    DESKTOP_PATH="$HOME/Desktop/"
    if [ -d "$DESKTOP_PATH" ]; then
        DMG_NAME=$(basename "$DMG_FILE")
        cp "$DMG_FILE" "$DESKTOP_PATH"
        log_success "DMG dosyası masaüstüne kopyalandı: $DESKTOP_PATH$DMG_NAME"
    fi
    
    # DMG dosyasını Finder'da göster
    if command -v open &> /dev/null; then
        open -R "$DMG_FILE"
        log_info "DMG dosyası Finder'da açılıyor..."
    fi
    
else
    log_error "DMG dosyası oluşturulamadı! Build loglarını kontrol edin."
    exit 1
fi

# Temizlik (opsiyonel)
read -p "Build dosyalarını temizlemek istiyor musunuz? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log_info "Build dosyaları temizleniyor..."
    rm -rf dist/
    rm -rf node_modules/.cache/
    log_success "Temizlik tamamlandı!"
fi

echo ""
echo "======================================"
echo "✅ DMG Build Işlemi Tamamlandı!"
echo "======================================"
echo ""
echo "🎉 Artık LocoDex.dmg dosyanızı dağıtabilirsiniz!"
echo ""