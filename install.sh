#!/bin/bash

# LocoDex Tamamen Otomatik Kurulum ve Çalıştırma Scripti
# Kullanıcı sadece bu dosyayı çalıştırır, hiçbir şey yapmasına gerek yok!
# Tüm dependencies, derleme, VS Code extension, servisler otomatik kurulur

set -e

# Renkli çıktı için
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logo
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                    🤖 LocoDx AI                         ║"
echo "║              Otomatik Kurulum ve Başlatma               ║"
echo "║                     v1.0.0                              ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Global değişkenler
INSTALL_DIR="$HOME/LocoDex"
LOG_FILE="$INSTALL_DIR/install.log"
VSCODE_EXTENSIONS_DIR="$HOME/.vscode/extensions"
AUTOSTART_DIR="$HOME/.config/autostart"

# İşletim sistemi tespit et
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
        if [ -f /etc/debian_version ]; then
            DISTRO="debian"
        elif [ -f /etc/redhat-release ]; then
            DISTRO="redhat"
        else
            DISTRO="unknown"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        DISTRO="macos"
        AUTOSTART_DIR="$HOME/Library/LaunchAgents"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        OS="windows"
        DISTRO="windows"
        AUTOSTART_DIR="$HOME/AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup"
    else
        echo -e "${RED}❌ Desteklenmeyen işletim sistemi: $OSTYPE${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ İşletim sistemi tespit edildi: $OS ($DISTRO)${NC}"
}

# Log fonksiyonu
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
    echo -e "$1"
}

# Hata yönetimi
error_exit() {
    log "${RED}❌ HATA: $1${NC}"
    echo -e "${RED}❌ Kurulum başarısız! Log dosyası: $LOG_FILE${NC}"
    exit 1
}

# Kurulum dizini oluştur
create_install_dir() {
    log "${BLUE}📁 Kurulum dizini oluşturuluyor...${NC}"
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$INSTALL_DIR/logs"
    mkdir -p "$INSTALL_DIR/data"
    mkdir -p "$INSTALL_DIR/backups"
    mkdir -p "$AUTOSTART_DIR"
}

# Sistem gereksinimlerini kontrol et
check_system_requirements() {
    log "${BLUE}🔍 Sistem gereksinimleri kontrol ediliyor...${NC}"
    
    # RAM kontrolü
    if [[ "$OS" == "linux" ]]; then
        TOTAL_RAM=$(free -g | awk '/^Mem:/{print $2}')
    elif [[ "$OS" == "macos" ]]; then
        TOTAL_RAM=$(system_profiler SPHardwareDataType | grep "Memory:" | awk '{print $2}' | sed 's/GB//')
    fi
    
    if [[ $TOTAL_RAM -lt 8 ]]; then
        log "${YELLOW}⚠️  Uyarı: 8GB+ RAM önerilir (Mevcut: ${TOTAL_RAM}GB)${NC}"
    else
        log "${GREEN}✅ RAM yeterli: ${TOTAL_RAM}GB${NC}"
    fi
    
    # Disk alanı kontrolü
    AVAILABLE_SPACE=$(df -h "$HOME" | awk 'NR==2{print $4}' | sed 's/G//')
    if [[ $AVAILABLE_SPACE -lt 5 ]]; then
        error_exit "Yetersiz disk alanı! En az 5GB gerekli (Mevcut: ${AVAILABLE_SPACE}GB)"
    fi
    
    log "${GREEN}✅ Disk alanı yeterli: ${AVAILABLE_SPACE}GB${NC}"
}

# Gerekli araçları yükle
install_dependencies() {
    log "${BLUE}📦 Sistem bağımlılıkları yükleniyor...${NC}"
    
    if [[ "$OS" == "linux" ]]; then
        if [[ "$DISTRO" == "debian" ]]; then
            sudo apt update
            sudo apt install -y curl git python3 python3-pip nodejs npm build-essential
        elif [[ "$DISTRO" == "redhat" ]]; then
            sudo yum update -y
            sudo yum install -y curl git python3 python3-pip nodejs npm gcc gcc-c++ make
        fi
    elif [[ "$OS" == "macos" ]]; then
        # Homebrew yoksa yükle
        if ! command -v brew &> /dev/null; then
            log "${YELLOW}🍺 Homebrew yükleniyor...${NC}"
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        fi
        
        brew install python3 node git
    elif [[ "$OS" == "windows" ]]; then
        # Chocolatey yoksa yükle
        if ! command -v choco &> /dev/null; then
            log "${YELLOW}🍫 Chocolatey yükleniyor...${NC}"
            powershell -Command "Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
        fi
        
        choco install -y python3 nodejs git
    fi
    
    # Python paketleri
    pip3 install --upgrade pip
    
    log "${GREEN}✅ Sistem bağımlılıkları yüklendi${NC}"
}

# LocoDex kaynak kodunu indir
download_locodex() {
    log "${BLUE}⬇️  LocoDex kaynak kodu indiriliyor...${NC}"
    
    cd "$INSTALL_DIR"
    
    # Eğer git repo varsa güncelle, yoksa klonla
    if [ -d ".git" ]; then
        log "${YELLOW}🔄 Mevcut kurulum güncelleniyor...${NC}"
        git pull origin main
    else
        log "${YELLOW}📥 Yeni kurulum indiriliyor...${NC}"
        # Mevcut proje dosyaları varsa yedekle
        if [ "$(ls -A)" ]; then
            cp -r . "../LocoDex_backup_$(date +%Y%m%d_%H%M%S)/"
        fi
        
        # GitHub'dan indir (gerçek repo URL'si ile değiştirin)
        git clone https://github.com/company/locodex.git . || {
            log "${YELLOW}⚠️  Git klonlama başarısız, wget ile deneniyor...${NC}"
            wget -O locodex.zip https://github.com/company/locodex/archive/main.zip
            unzip locodex.zip
            mv locodex-main/* .
            rm -rf locodex-main locodex.zip
        }
    fi
    
    log "${GREEN}✅ LocoDex kaynak kodu hazır${NC}"
}

# Node.js bağımlılıklarını yükle
install_node_dependencies() {
    log "${BLUE}📦 Node.js bağımlılıkları yükleniyor...${NC}"
    
    cd "$INSTALL_DIR"
    
    # Ana proje
    npm install --production
    
    # Electron app
    cd electron
    npm install --production
    cd ..
    
    # VS Code extension
    cd vscode-locodex
    npm install --production
    npm run compile
    cd ..
    
    log "${GREEN}✅ Node.js bağımlılıkları yüklendi${NC}"
}

# Python bağımlılıklarını yükle
install_python_dependencies() {
    log "${BLUE}🐍 Python bağımlılıkları yükleniyor...${NC}"
    
    cd "$INSTALL_DIR"
    
    # Ana proje gereksinimleri
    if [ -f "requirements.txt" ]; then
        pip3 install -r requirements.txt
    fi
    
    # Her servis için ayrı ayrı
    for service_dir in src/services/*/; do
        if [ -f "$service_dir/requirements.txt" ]; then
            log "${YELLOW}📦 $(basename $service_dir) servisi yükleniyor...${NC}"
            pip3 install -r "$service_dir/requirements.txt"
        fi
    done
    
    log "${GREEN}✅ Python bağımlılıkları yüklendi${NC}"
}

# VS Code extension'ını otomatik kur
install_vscode_extension() {
    log "${BLUE}🔧 VS Code extension kuruluyor...${NC}"
    
    cd "$INSTALL_DIR/vscode-locodex"
    
    # Extension'ı derle ve paketle
    npm run compile
    
    # vsce yüklü değilse yükle
    if ! command -v vsce &> /dev/null; then
        npm install -g @vscode/vsce
    fi
    
    # Extension'ı paketle
    vsce package --no-git-tag-version --no-update-package-json
    
    # VS Code'a yükle
    if command -v code &> /dev/null; then
        code --install-extension *.vsix --force
        log "${GREEN}✅ VS Code extension yüklendi${NC}"
    else
        log "${YELLOW}⚠️  VS Code bulunamadı, extension manuel yüklenecek${NC}"
        log "${YELLOW}📁 Extension dosyası: $PWD/*.vsix${NC}"
    fi
}

# Yapılandırma dosyalarını oluştur
create_configuration() {
    log "${BLUE}⚙️  Yapılandırma dosyaları oluşturuluyor...${NC}"
    
    cd "$INSTALL_DIR"
    
    # Ana yapılandırma
    cat > config/app.json << EOF
{
  "version": "1.0.0",
  "environment": "production",
  "autostart": true,
  "api": {
    "host": "localhost",
    "port": 8000
  },
  "vllm": {
    "host": "localhost", 
    "port": 8080,
    "autostart": true
  },
  "security": {
    "level": "high",
    "sandbox": true
  },
  "logging": {
    "level": "info",
    "file": "$INSTALL_DIR/logs/app.log"
  }
}
EOF

    # VS Code ayarları
    mkdir -p "$HOME/.vscode"
    cat > "$HOME/.vscode/settings.json" << EOF
{
  "locodex.apiEndpoint": "http://localhost:8000",
  "locodex.vllmEndpoint": "http://localhost:8080", 
  "locodex.autoStart": true,
  "locodx.enableInlineCompletion": true,
  "locodex.enableSecurityScan": true
}
EOF

    log "${GREEN}✅ Yapılandırma dosyaları oluşturuldu${NC}"
}

# Başlatıcı scriptleri oluştur
create_launcher_scripts() {
    log "${BLUE}🚀 Başlatıcı scriptler oluşturuluyor...${NC}"
    
    cd "$INSTALL_DIR"
    
    # Ana başlatıcı script
    cat > locodex-start.sh << 'EOF'
#!/bin/bash

# LocoDex Başlatıcı Script

INSTALL_DIR="$HOME/LocoDex"
LOG_FILE="$INSTALL_DIR/logs/runtime.log"

# Log fonksiyonu
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Hata yakalama
trap 'log "❌ Beklenmeyen hata oluştu!"' ERR

log "🚀 LocoDex başlatılıyor..."

cd "$INSTALL_DIR"

# Port kontrolü
check_port() {
    if lsof -i:$1 > /dev/null 2>&1; then
        log "⚠️  Port $1 kullanımda, temizleniyor..."
        lsof -ti:$1 | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
}

# Portları temizle
check_port 8000
check_port 8080
check_port 3000

# VLLM servisini başlat (arka planda)
log "🔥 VLLM servisi başlatılıyor..."
cd src/services/vllm_service
python3 server.py > "$INSTALL_DIR/logs/vllm.log" 2>&1 &
VLLM_PID=$!
echo $VLLM_PID > "$INSTALL_DIR/pids/vllm.pid"
cd "$INSTALL_DIR"

# Ana API servisini başlat (arka planda)
log "🌐 Ana API servisi başlatılıyor..."
npm run start:api > "$INSTALL_DIR/logs/api.log" 2>&1 &
API_PID=$!
echo $API_PID > "$INSTALL_DIR/pids/api.pid"

# Servislerin başlamasını bekle
sleep 10

# Sağlık kontrolü
health_check() {
    if curl -s http://localhost:8000/health > /dev/null; then
        log "✅ API servisi hazır"
        return 0
    else
        log "❌ API servisi başlatılamadı"
        return 1
    fi
}

# 30 saniye boyunca dene
for i in {1..30}; do
    if health_check; then
        break
    fi
    if [ $i -eq 30 ]; then
        log "❌ Servisler başlatılamadı!"
        exit 1
    fi
    sleep 1
done

# Desktop uygulamasını başlat
log "🖥️  Desktop uygulaması başlatılıyor..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    open dist-electron/mac-universal/LocoDex.app
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    npm run electron > "$INSTALL_DIR/logs/electron.log" 2>&1 &
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    start dist-electron/win-unpacked/LocoDex.exe
fi

log "🎉 LocoDex başlatıldı!"
log "🌐 Web arayüzü: http://localhost:3000"
log "🔌 API: http://localhost:8000" 
log "🔥 VLLM: http://localhost:8080"
log "📝 Loglar: $INSTALL_DIR/logs/"

# PID dosyalarını oluştur
mkdir -p "$INSTALL_DIR/pids"
echo $$ > "$INSTALL_DIR/pids/main.pid"

# Çıkış yakalama
cleanup() {
    log "🛑 LocoDex kapatılıyor..."
    
    # Tüm alt süreçleri sonlandır
    if [ -f "$INSTALL_DIR/pids/vllm.pid" ]; then
        kill $(cat "$INSTALL_DIR/pids/vllm.pid") 2>/dev/null || true
    fi
    
    if [ -f "$INSTALL_DIR/pids/api.pid" ]; then
        kill $(cat "$INSTALL_DIR/pids/api.pid") 2>/dev/null || true
    fi
    
    # Port temizliği
    lsof -ti:8000,8080,3000 | xargs kill -9 2>/dev/null || true
    
    rm -f "$INSTALL_DIR/pids/"*.pid
    log "✅ LocoDex kapatıldı"
}

trap cleanup EXIT INT TERM

# Arka planda çalışmaya devam et
wait
EOF

    chmod +x locodex-start.sh
    
    # Durdurma scripti
    cat > locodex-stop.sh << 'EOF'
#!/bin/bash

INSTALL_DIR="$HOME/LocoDex"
LOG_FILE="$INSTALL_DIR/logs/runtime.log"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log "🛑 LocoDex durduruluyor..."

# PID dosyalarından süreçleri sonlandır
for pid_file in "$INSTALL_DIR/pids/"*.pid; do
    if [ -f "$pid_file" ]; then
        PID=$(cat "$pid_file")
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID"
            log "✅ Süreç sonlandırıldı: $PID"
        fi
        rm -f "$pid_file"
    fi
done

# Port temizliği
lsof -ti:8000,8080,3000 | xargs kill -9 2>/dev/null || true

log "✅ LocoDex durduruldu"
EOF

    chmod +x locodex-stop.sh
    
    log "${GREEN}✅ Başlatıcı scriptler oluşturuldu${NC}"
}

# Otomatik başlatma ayarla
setup_autostart() {
    log "${BLUE}🔄 Otomatik başlatma ayarlanıyor...${NC}"
    
    if [[ "$OS" == "linux" ]]; then
        # Linux - .desktop dosyası
        cat > "$AUTOSTART_DIR/locodex.desktop" << EOF
[Desktop Entry]
Type=Application
Name=LocoDex AI
Comment=LocoDex AI Kod Asistanı
Exec=$INSTALL_DIR/locodex-start.sh
Icon=$INSTALL_DIR/assets/icon.png
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF
    elif [[ "$OS" == "macos" ]]; then
        # macOS - LaunchAgent
        cat > "$AUTOSTART_DIR/com.locodex.ai.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.locodex.ai</string>
    <key>ProgramArguments</key>
    <array>
        <string>$INSTALL_DIR/locodex-start.sh</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
EOF
        launchctl load "$AUTOSTART_DIR/com.locodex.ai.plist"
    elif [[ "$OS" == "windows" ]]; then
        # Windows - Startup klasörüne kısayol
        powershell -Command "
        \$WshShell = New-Object -comObject WScript.Shell
        \$Shortcut = \$WshShell.CreateShortcut('$AUTOSTART_DIR\LocoDex.lnk')
        \$Shortcut.TargetPath = '$INSTALL_DIR\locodex-start.sh'
        \$Shortcut.Save()
        "
    fi
    
    log "${GREEN}✅ Otomatik başlatma ayarlandı${NC}"
}

# Desktop kısayolu oluştur
create_desktop_shortcut() {
    log "${BLUE}🖥️  Desktop kısayolu oluşturuluyor...${NC}"
    
    if [[ "$OS" == "linux" ]]; then
        cat > "$HOME/Desktop/LocoDex.desktop" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=LocoDex AI
Comment=LocoDex AI Kod Asistanı  
Exec=$INSTALL_DIR/locodex-start.sh
Icon=$INSTALL_DIR/assets/icon.png
Terminal=false
Categories=Development;
EOF
        chmod +x "$HOME/Desktop/LocoDex.desktop"
    elif [[ "$OS" == "macos" ]]; then
        ln -sf "$INSTALL_DIR/locodex-start.sh" "$HOME/Desktop/LocoDex"
    elif [[ "$OS" == "windows" ]]; then
        powershell -Command "
        \$WshShell = New-Object -comObject WScript.Shell
        \$Shortcut = \$WshShell.CreateShortcut('$HOME\Desktop\LocoDex.lnk')
        \$Shortcut.TargetPath = '$INSTALL_DIR\locodex-start.sh'
        \$Shortcut.Save()
        "
    fi
    
    log "${GREEN}✅ Desktop kısayolu oluşturuldu${NC}"
}

# Derleme işlemi
build_application() {
    log "${BLUE}🔨 Uygulama derleniyor...${NC}"
    
    cd "$INSTALL_DIR"
    
    # Frontend build
    npm run build
    
    # Electron build (sadece gerekiyorsa)
    if [ ! -d "dist-electron" ]; then
        npm run build:electron
    fi
    
    log "${GREEN}✅ Uygulama derlendi${NC}"
}

# Güvenlik ayarları
setup_security() {
    log "${BLUE}🔒 Güvenlik ayarları yapılandırılıyor...${NC}"
    
    cd "$INSTALL_DIR"
    
    # Dosya izinleri
    chmod 700 "$INSTALL_DIR"
    chmod 600 config/*.json
    chmod 755 *.sh
    
    # Firewall kuralları (opsiyonel)
    if command -v ufw &> /dev/null; then
        sudo ufw allow 8000/tcp comment "LocoDex API"
        sudo ufw allow 8080/tcp comment "LocoDex VLLM"
    fi
    
    log "${GREEN}✅ Güvenlik ayarları tamamlandı${NC}"
}

# Ana kurulum fonksiyonu
main() {
    echo -e "${BLUE}🚀 LocoDex otomatik kurulumu başlatılıyor...${NC}"
    
    detect_os
    create_install_dir
    
    # Log dosyasını başlat
    log "📝 Kurulum başladı - $(date)"
    log "💻 Sistem: $OS ($DISTRO)"
    log "📂 Kurulum dizini: $INSTALL_DIR"
    
    # Gelişmiş scriptlerle kurulum
    log "${BLUE}🔧 Gelişmiş kurulum scriptleri çalıştırılıyor...${NC}"
    
    # Sistem gereksinimleri kontrolü
    if [ -f "$INSTALL_DIR/scripts/system-requirements-checker.sh" ]; then
        log "${BLUE}🔍 Sistem gereksinimleri kontrol ediliyor...${NC}"
        "$INSTALL_DIR/scripts/system-requirements-checker.sh" || {
            log "${RED}❌ Sistem gereksinimleri karşılanmıyor!${NC}"
            exit 1
        }
    fi
    
    # Dependency yönetimi
    if [ -f "$INSTALL_DIR/scripts/dependency-manager.sh" ]; then
        log "${BLUE}📦 Dependencies otomatik yükleniyor...${NC}"
        "$INSTALL_DIR/scripts/dependency-manager.sh"
    else
        install_dependencies
    fi
    
    download_locodex
    
    # Otomatik derleme
    if [ -f "$INSTALL_DIR/scripts/auto-builder.sh" ]; then
        log "${BLUE}🔨 Otomatik derleme başlatılıyor...${NC}"
        "$INSTALL_DIR/scripts/auto-builder.sh" build
    else
        build_application
    fi
    
    # VS Code extension otomatik kurulum
    if [ -f "$INSTALL_DIR/scripts/vscode-auto-installer.sh" ]; then
        log "${BLUE}🔧 VS Code extension otomatik kuruluyor...${NC}"
        "$INSTALL_DIR/scripts/vscode-auto-installer.sh" install
    fi
    
    create_configuration
    create_launcher_scripts
    
    # Servis yönetimi kurulumu
    if [ -f "$INSTALL_DIR/scripts/service-manager.sh" ]; then
        log "${BLUE}⚙️  Servis yönetimi kuruluyor...${NC}"
        "$INSTALL_DIR/scripts/service-manager.sh" setup-autostart
    else
        setup_autostart
    fi
    
    create_desktop_shortcut
    setup_security
    
    log "${GREEN}🎉 Kurulum tamamlandı!${NC}"
    
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║                  🎉 KURULUM TAMAMLANDI! 🎉              ║"
    echo "╠══════════════════════════════════════════════════════════╣"
    echo "║                                                          ║"
    echo "║  LocoDex AI başarıyla kuruldu ve yapılandırıldı!        ║"
    echo "║                                                          ║"
    echo "║  🚀 Başlatmak için:                                     ║"
    echo "║     • Desktop'taki LocoDex simgesine tıklayın           ║"
    echo "║     • veya: $INSTALL_DIR/locodex-start.sh      ║"
    echo "║                                                          ║"
    echo "║  🌐 Erişim adresleri:                                   ║"
    echo "║     • Web: http://localhost:3000                        ║"
    echo "║     • API: http://localhost:8000                        ║"
    echo "║     • VLLM: http://localhost:8080                       ║"
    echo "║                                                          ║"
    echo "║  📝 Loglar: $INSTALL_DIR/logs/                    ║"
    echo "║  ⚙️  Yapılandırma: $INSTALL_DIR/config/           ║"
    echo "║                                                          ║"
    echo "║  💡 VS Code'da LocoDex extension'ı otomatik yüklendi    ║"
    echo "║     Ctrl+Shift+P → 'LocoDex' komutlarını kullanın      ║"
    echo "║                                                          ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    # Hemen başlatmak isteyip istemediğini sor
    read -p "🚀 LocoDex'i şimdi başlatmak ister misiniz? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log "🚀 LocoDex başlatılıyor..."
        exec "$INSTALL_DIR/locodex-start.sh"
    else
        log "ℹ️  LocoDex daha sonra başlatılabilir"
        echo -e "${YELLOW}💡 Başlatmak için Desktop simgesine tıklayın veya şu komutu çalıştırın:${NC}"
        echo -e "${BLUE}   $INSTALL_DIR/locodex-start.sh${NC}"
    fi
}

# Script çalıştırıldığında ana fonksiyonu başlat
main "$@"