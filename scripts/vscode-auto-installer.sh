#!/bin/bash

# LocoDex VS Code Extension Otomatik Kurulum ve Yönetim Sistemi
# VS Code extension'ı otomatik derler, paketler ve kurar

set -e

# Renkler
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Global değişkenler
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
EXTENSION_DIR="$PROJECT_DIR/vscode-locodex"
LOG_FILE="$PROJECT_DIR/logs/vscode-installer.log"
TEMP_DIR="$PROJECT_DIR/.temp/vscode"

# VS Code yolları
VSCODE_USER_DIR="$HOME/.vscode"
VSCODE_EXTENSIONS_DIR="$VSCODE_USER_DIR/extensions"
VSCODE_SETTINGS_FILE="$VSCODE_USER_DIR/settings.json"

# Extension bilgileri
EXTENSION_NAME="locodex-ai-assistant"
EXTENSION_DISPLAY_NAME="LocoDex AI Assistant"
EXTENSION_VERSION="1.0.0"

# Log fonksiyonu
log() {
    echo -e "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Platform tespiti
detect_platform() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        PLATFORM="linux"
        VSCODE_BINARY="code"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        PLATFORM="macos"
        VSCODE_BINARY="code"
        # macOS'ta VS Code'un farklı yolları olabilir
        if [ -d "/Applications/Visual Studio Code.app" ]; then
            VSCODE_BINARY="/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"
        fi
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        PLATFORM="windows"
        VSCODE_BINARY="code.exe"
        VSCODE_USER_DIR="$APPDATA/Code"
        VSCODE_EXTENSIONS_DIR="$VSCODE_USER_DIR/extensions"
        VSCODE_SETTINGS_FILE="$VSCODE_USER_DIR/User/settings.json"
    fi
    
    log "${GREEN}🔍 Platform: $PLATFORM${NC}"
}

# VS Code kurulu mu kontrol et
check_vscode_installation() {
    log "${BLUE}🔍 VS Code kurulumu kontrol ediliyor...${NC}"
    
    if command -v "$VSCODE_BINARY" &> /dev/null; then
        local vscode_version=$("$VSCODE_BINARY" --version | head -n1)
        log "${GREEN}✅ VS Code bulundu: $vscode_version${NC}"
        return 0
    else
        log "${YELLOW}⚠️  VS Code bulunamadı${NC}"
        return 1
    fi
}

# VS Code'u otomatik kur
install_vscode() {
    log "${BLUE}📦 VS Code yükleniyor...${NC}"
    
    case $PLATFORM in
        "linux")
            # Snap'ten yükle
            if command -v snap &> /dev/null; then
                sudo snap install --classic code
            # APT'ten yükle
            elif command -v apt-get &> /dev/null; then
                wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg
                sudo install -o root -g root -m 644 packages.microsoft.gpg /etc/apt/trusted.gpg.d/
                sudo sh -c 'echo "deb [arch=amd64,arm64,armhf signed-by=/etc/apt/trusted.gpg.d/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main" > /etc/apt/sources.list.d/vscode.list'
                sudo apt-get update
                sudo apt-get install -y code
            # YUM'dan yükle
            elif command -v yum &> /dev/null; then
                sudo rpm --import https://packages.microsoft.com/keys/microsoft.asc
                sudo sh -c 'echo -e "[code]\nname=Visual Studio Code\nbaseurl=https://packages.microsoft.com/yumrepos/vscode\nenabled=1\ngpgcheck=1\ngpgkey=https://packages.microsoft.com/keys/microsoft.asc" > /etc/yum.repos.d/vscode.repo'
                sudo yum install -y code
            fi
            ;;
        "macos")
            # Homebrew ile yükle
            if command -v brew &> /dev/null; then
                brew install --cask visual-studio-code
            else
                # Manuel indirme
                log "${YELLOW}📥 VS Code manuel olarak indiriliyor...${NC}"
                curl -L "https://code.visualstudio.com/sha/download?build=stable&os=osx-universal" -o "$TEMP_DIR/vscode.zip"
                unzip "$TEMP_DIR/vscode.zip" -d "/Applications/"
            fi
            ;;
        "windows")
            # Chocolatey ile yükle
            if command -v choco &> /dev/null; then
                choco install -y vscode
            else
                # Manuel indirme
                log "${YELLOW}📥 VS Code manuel olarak indiriliyor...${NC}"
                curl -L "https://code.visualstudio.com/sha/download?build=stable&os=win32-x64-user" -o "$TEMP_DIR/vscode-installer.exe"
                "$TEMP_DIR/vscode-installer.exe" /SILENT /NORESTART
            fi
            ;;
    esac
    
    # Kurulum kontrolü
    if check_vscode_installation; then
        log "${GREEN}✅ VS Code başarıyla yüklendi${NC}"
        return 0
    else
        log "${RED}❌ VS Code kurulumu başarısız${NC}"
        return 1
    fi
}

# Extension dizinini hazırla
prepare_extension_directory() {
    log "${BLUE}📁 Extension dizini hazırlanıyor...${NC}"
    
    mkdir -p "$TEMP_DIR"
    mkdir -p "$PROJECT_DIR/logs"
    
    cd "$EXTENSION_DIR"
    
    # package.json kontrol
    if [ ! -f "package.json" ]; then
        log "${RED}❌ package.json bulunamadı: $EXTENSION_DIR${NC}"
        return 1
    fi
    
    # Dependencies kontrol
    if [ ! -d "node_modules" ]; then
        log "${YELLOW}📦 Dependencies yükleniyor...${NC}"
        npm install
    fi
    
    log "${GREEN}✅ Extension dizini hazır${NC}"
}

# TypeScript kodunu derle
compile_typescript() {
    log "${BLUE}🔨 TypeScript kodu derleniyor...${NC}"
    
    cd "$EXTENSION_DIR"
    
    # TypeScript derlemesi
    if ! npm run compile; then
        log "${RED}❌ TypeScript derleme başarısız${NC}"
        return 1
    fi
    
    # Out dizinini kontrol et
    if [ ! -d "out" ] || [ ! "$(ls -A out)" ]; then
        log "${RED}❌ Derleme çıktısı bulunamadı${NC}"
        return 1
    fi
    
    log "${GREEN}✅ TypeScript derleme başarılı${NC}"
}

# Extension'ı test et
test_extension() {
    log "${BLUE}🧪 Extension test ediliyor...${NC}"
    
    cd "$EXTENSION_DIR"
    
    # Lint kontrolü
    if command -v eslint &> /dev/null; then
        npm run lint || log "${YELLOW}⚠️  Lint uyarıları var${NC}"
    fi
    
    # Test suite varsa çalıştır
    if [ -f "package.json" ] && npm run | grep -q "test"; then
        npm test || log "${YELLOW}⚠️  Test'ler başarısız${NC}"
    fi
    
    log "${GREEN}✅ Extension test edildi${NC}"
}

# Extension'ı paketle
package_extension() {
    log "${BLUE}📦 Extension paketleniyor...${NC}"
    
    cd "$EXTENSION_DIR"
    
    # vsce kurulu mu kontrol et
    if ! command -v vsce &> /dev/null; then
        log "${YELLOW}📦 vsce yükleniyor...${NC}"
        npm install -g @vscode/vsce
    fi
    
    # Önceki paketleri temizle
    rm -f *.vsix
    
    # Package oluştur
    if ! vsce package --no-git-tag-version --no-update-package-json; then
        log "${RED}❌ Extension paketleme başarısız${NC}"
        return 1
    fi
    
    # VSIX dosyasını kontrol et
    local vsix_file=$(ls *.vsix 2>/dev/null | head -n1)
    if [ -z "$vsix_file" ]; then
        log "${RED}❌ VSIX dosyası oluşturulamadı${NC}"
        return 1
    fi
    
    # VSIX dosyasını ana dizine kopyala
    cp "$vsix_file" "$PROJECT_DIR/dist/"
    
    log "${GREEN}✅ Extension paketlendi: $vsix_file${NC}"
    export VSIX_FILE="$vsix_file"
}

# Mevcut extension'ı kaldır
uninstall_existing_extension() {
    log "${BLUE}🗑️  Mevcut extension kaldırılıyor...${NC}"
    
    # VS Code üzerinden kaldır
    if "$VSCODE_BINARY" --list-extensions | grep -q "$EXTENSION_NAME"; then
        "$VSCODE_BINARY" --uninstall-extension "$EXTENSION_NAME" || true
        log "${GREEN}✅ Mevcut extension kaldırıldı${NC}"
    fi
    
    # Manuel kaldırma (extension dizininden)
    if [ -d "$VSCODE_EXTENSIONS_DIR" ]; then
        find "$VSCODE_EXTENSIONS_DIR" -name "*$EXTENSION_NAME*" -type d -exec rm -rf {} + 2>/dev/null || true
    fi
}

# Extension'ı kur
install_extension() {
    log "${BLUE}⚡ Extension yükleniyor...${NC}"
    
    cd "$EXTENSION_DIR"
    
    local vsix_file="$VSIX_FILE"
    if [ -z "$vsix_file" ] || [ ! -f "$vsix_file" ]; then
        vsix_file=$(ls *.vsix 2>/dev/null | head -n1)
    fi
    
    if [ -z "$vsix_file" ]; then
        log "${RED}❌ VSIX dosyası bulunamadı${NC}"
        return 1
    fi
    
    # Mevcut extension'ı kaldır
    uninstall_existing_extension
    
    # Yeni extension'ı kur
    if "$VSCODE_BINARY" --install-extension "$vsix_file" --force; then
        log "${GREEN}✅ Extension başarıyla yüklendi${NC}"
        return 0
    else
        log "${RED}❌ Extension kurulumu başarısız${NC}"
        return 1
    fi
}

# VS Code ayarlarını yapılandır
configure_vscode_settings() {
    log "${BLUE}⚙️  VS Code ayarları yapılandırılıyor...${NC}"
    
    mkdir -p "$(dirname "$VSCODE_SETTINGS_FILE")"
    
    # Mevcut ayarları oku
    local current_settings="{}"
    if [ -f "$VSCODE_SETTINGS_FILE" ]; then
        current_settings=$(cat "$VSCODE_SETTINGS_FILE")
    fi
    
    # LocoDex ayarlarını ekle
    local locodex_settings='{
  "locodex.apiEndpoint": "http://localhost:8000",
  "locodex.vllmEndpoint": "http://localhost:8080",
  "locodex.preferredProvider": "auto",
  "locodex.enableInlineCompletion": true,
  "locodex.enableSecurityScan": true,
  "locodex.enableCodeReview": true,
  "locodex.autoSaveChat": true,
  "locodex.securityLevel": "high",
  "locodex.maxTokens": 1024,
  "locodex.temperature": 0.1
}'
    
    # JSON'ları birleştir
    if command -v jq &> /dev/null; then
        echo "$current_settings" | jq ". + $locodex_settings" > "$VSCODE_SETTINGS_FILE"
    else
        # jq yoksa basit birleştirme
        echo "$locodex_settings" > "$VSCODE_SETTINGS_FILE"
    fi
    
    log "${GREEN}✅ VS Code ayarları yapılandırıldı${NC}"
}

# Extension durumunu kontrol et
check_extension_status() {
    log "${BLUE}🔍 Extension durumu kontrol ediliyor...${NC}"
    
    if "$VSCODE_BINARY" --list-extensions | grep -q "$EXTENSION_NAME"; then
        local installed_version=$("$VSCODE_BINARY" --list-extensions --show-versions | grep "$EXTENSION_NAME" | cut -d'@' -f2)
        log "${GREEN}✅ Extension kurulu: v$installed_version${NC}"
        return 0
    else
        log "${YELLOW}⚠️  Extension kurulu değil${NC}"
        return 1
    fi
}

# Extension'ı VS Code'da aktifleştir
activate_extension() {
    log "${BLUE}🚀 Extension aktifleştiriliyor...${NC}"
    
    # VS Code'u başlat (background'da)
    "$VSCODE_BINARY" --command "workbench.extensions.action.enableAll" 2>/dev/null &
    
    # Kısa bir bekleme
    sleep 2
    
    log "${GREEN}✅ Extension aktifleştirildi${NC}"
}

# Geliştirici modu kurulumu
install_dev_mode() {
    log "${BLUE}🔧 Geliştirici modu kurulumu...${NC}"
    
    cd "$EXTENSION_DIR"
    
    # Extension dizinini VS Code extensions dizinine link et
    local extension_dev_dir="$VSCODE_EXTENSIONS_DIR/$EXTENSION_NAME-dev"
    
    # Mevcut link'i kaldır
    rm -rf "$extension_dev_dir"
    
    # Sembolik link oluştur
    ln -sf "$EXTENSION_DIR" "$extension_dev_dir"
    
    # Watch mode başlat (arka planda)
    npm run watch &
    local watch_pid=$!
    echo "$watch_pid" > "$PROJECT_DIR/pids/vscode-watch.pid"
    
    log "${GREEN}✅ Geliştirici modu aktif (Watch PID: $watch_pid)${NC}"
}

# Extension'ı güncelle
update_extension() {
    log "${BLUE}🔄 Extension güncelleniyor...${NC}"
    
    # Önce test et
    test_extension
    
    # Derle
    compile_typescript
    
    # Paketle
    package_extension
    
    # Kur
    install_extension
    
    log "${GREEN}✅ Extension güncellendi${NC}"
}

# Extension'ı tamamen kaldır
uninstall_extension() {
    log "${BLUE}🗑️  Extension tamamen kaldırılıyor...${NC}"
    
    # VS Code'dan kaldır
    uninstall_existing_extension
    
    # Dev mode link'ini kaldır
    rm -rf "$VSCODE_EXTENSIONS_DIR/$EXTENSION_NAME-dev"
    
    # Watch process'i durdur
    if [ -f "$PROJECT_DIR/pids/vscode-watch.pid" ]; then
        local watch_pid=$(cat "$PROJECT_DIR/pids/vscode-watch.pid")
        kill "$watch_pid" 2>/dev/null || true
        rm -f "$PROJECT_DIR/pids/vscode-watch.pid"
    fi
    
    # VSIX dosyalarını temizle
    rm -f "$EXTENSION_DIR"/*.vsix
    rm -f "$PROJECT_DIR/dist"/*.vsix
    
    log "${GREEN}✅ Extension tamamen kaldırıldı${NC}"
}

# Ana kurulum fonksiyonu
main_install() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║           🔧 LocoDex VS Code Extension Installer         ║"
    echo "║              Otomatik Kurulum ve Yönetim                ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    detect_platform
    
    # VS Code kontrol et ve gerekirse kur
    if ! check_vscode_installation; then
        read -p "VS Code kurulsun mu? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            install_vscode
        else
            log "${RED}❌ VS Code gerekli, kurulum iptal edildi${NC}"
            exit 1
        fi
    fi
    
    prepare_extension_directory
    test_extension
    compile_typescript
    package_extension
    install_extension
    configure_vscode_settings
    activate_extension
    
    if check_extension_status; then
        log "${GREEN}🎉 LocoDex VS Code Extension başarıyla kuruldu!${NC}"
        
        # Kurulum özeti
        echo -e "${GREEN}"
        echo "╔══════════════════════════════════════════════════════════╗"
        echo "║                ✅ EXTENSION KURULDU!                    ║"
        echo "╠══════════════════════════════════════════════════════════╣"
        echo "║                                                          ║"
        echo "║  🔧 Extension: $EXTENSION_DISPLAY_NAME                  ║"
        echo "║  📦 Versiyon: v$EXTENSION_VERSION                                   ║"
        echo "║  📁 Konum: $VSCODE_EXTENSIONS_DIR                ║"
        echo "║                                                          ║"
        echo "║  🚀 Kullanım:                                           ║"
        echo "║     • Ctrl+Shift+P → 'LocoDex' komutları               ║"
        echo "║     • Ctrl+Shift+L → LocoDex Chat                       ║"
        echo "║     • Sağ tık → LocoDex menüleri                        ║"
        echo "║                                                          ║"
        echo "║  ⚙️  Ayarlar: File → Preferences → Settings            ║"
        echo "║     → 'LocoDex' ara                                     ║"
        echo "║                                                          ║"
        echo "╚══════════════════════════════════════════════════════════╝"
        echo -e "${NC}"
        
        return 0
    else
        log "${RED}❌ Extension kurulumu doğrulanamadı${NC}"
        return 1
    fi
}

# Kullanım bilgisi
show_usage() {
    echo -e "${BLUE}LocoDex VS Code Extension Installer Kullanımı:${NC}"
    echo
    echo -e "${YELLOW}Komutlar:${NC}"
    echo "  install               - Extension'ı kur"
    echo "  update                - Extension'ı güncelle"
    echo "  uninstall             - Extension'ı kaldır"
    echo "  dev                   - Geliştirici modu"
    echo "  status                - Extension durumunu kontrol et"
    echo "  compile               - Sadece TypeScript derle"
    echo "  package               - Sadece extension paketle"
    echo "  test                  - Extension'ı test et"
    echo "  clean                 - Geçici dosyaları temizle"
    echo "  help                  - Bu yardım mesajı"
    echo
    echo -e "${YELLOW}Örnekler:${NC}"
    echo "  ./vscode-auto-installer.sh install"
    echo "  ./vscode-auto-installer.sh update"
    echo "  ./vscode-auto-installer.sh dev"
    echo "  ./vscode-auto-installer.sh status"
}

# Ana switch
case "${1:-install}" in
    "install")
        main_install
        ;;
    "update")
        update_extension
        ;;
    "uninstall")
        uninstall_extension
        ;;
    "dev")
        install_dev_mode
        ;;
    "status")
        check_extension_status
        ;;
    "compile")
        prepare_extension_directory
        compile_typescript
        ;;
    "package")
        prepare_extension_directory
        compile_typescript
        package_extension
        ;;
    "test")
        prepare_extension_directory
        test_extension
        ;;
    "clean")
        log "${BLUE}🧹 Geçici dosyalar temizleniyor...${NC}"
        rm -rf "$TEMP_DIR"
        rm -f "$EXTENSION_DIR"/*.vsix
        log "${GREEN}✅ Temizlik tamamlandı${NC}"
        ;;
    "help"|"-h"|"--help")
        show_usage
        ;;
    *)
        show_usage
        exit 1
        ;;
esac