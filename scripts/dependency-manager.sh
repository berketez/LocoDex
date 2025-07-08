#!/bin/bash

# LocoDex Gelişmiş Dependency Yönetimi Sistemi
# Her platformda otomatik dependency kurulumu ve yönetimi

set -e

# Renkler
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Global değişkenler
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="$(dirname "$SCRIPT_DIR")"
CACHE_DIR="$INSTALL_DIR/.cache"
TEMP_DIR="$INSTALL_DIR/.temp"

# Log fonksiyonu
log() {
    echo -e "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$INSTALL_DIR/logs/dependency.log"
}

# Platform tespiti
detect_platform() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if command -v apt-get &> /dev/null; then
            PLATFORM="debian"
            PKG_MANAGER="apt-get"
        elif command -v yum &> /dev/null; then
            PLATFORM="redhat"
            PKG_MANAGER="yum"
        elif command -v pacman &> /dev/null; then
            PLATFORM="arch"
            PKG_MANAGER="pacman"
        else
            PLATFORM="linux"
            PKG_MANAGER="unknown"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        PLATFORM="macos"
        PKG_MANAGER="brew"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        PLATFORM="windows"
        PKG_MANAGER="choco"
    fi
    
    log "${GREEN}✅ Platform tespit edildi: $PLATFORM ($PKG_MANAGER)${NC}"
}

# Cache dizini oluştur
setup_cache() {
    mkdir -p "$CACHE_DIR"
    mkdir -p "$TEMP_DIR"
    mkdir -p "$INSTALL_DIR/logs"
}

# Package manager'ları kur
install_package_managers() {
    log "${BLUE}📦 Package manager'lar kontrol ediliyor...${NC}"
    
    case $PLATFORM in
        "macos")
            if ! command -v brew &> /dev/null; then
                log "${YELLOW}🍺 Homebrew yükleniyor...${NC}"
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
                echo 'export PATH="/opt/homebrew/bin:$PATH"' >> ~/.zshrc
                export PATH="/opt/homebrew/bin:$PATH"
            fi
            ;;
        "windows")
            if ! command -v choco &> /dev/null; then
                log "${YELLOW}🍫 Chocolatey yükleniyor...${NC}"
                powershell -Command "Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
            fi
            ;;
        "debian")
            sudo apt-get update
            ;;
        "redhat")
            sudo yum update -y
            ;;
    esac
    
    log "${GREEN}✅ Package manager'lar hazır${NC}"
}

# Python yükle ve yapılandır
install_python() {
    log "${BLUE}🐍 Python yükleniyor...${NC}"
    
    case $PLATFORM in
        "debian")
            sudo apt-get install -y python3 python3-pip python3-venv python3-dev
            ;;
        "redhat")
            sudo yum install -y python3 python3-pip python3-devel
            ;;
        "arch")
            sudo pacman -S --noconfirm python python-pip
            ;;
        "macos")
            brew install python@3.11
            # Python symlink'lerini oluştur
            ln -sf /opt/homebrew/bin/python3 /usr/local/bin/python
            ln -sf /opt/homebrew/bin/pip3 /usr/local/bin/pip
            ;;
        "windows")
            choco install -y python3
            ;;
    esac
    
    # Pip'i güncelle
    python3 -m pip install --upgrade pip setuptools wheel
    
    # Virtual environment oluştur
    python3 -m venv "$INSTALL_DIR/venv"
    
    # Activation script'i oluştur
    cat > "$INSTALL_DIR/activate-venv.sh" << 'EOF'
#!/bin/bash
source "$INSTALL_DIR/venv/bin/activate"
export PATH="$INSTALL_DIR/venv/bin:$PATH"
EOF
    
    chmod +x "$INSTALL_DIR/activate-venv.sh"
    
    log "${GREEN}✅ Python kuruldu ve yapılandırıldı${NC}"
}

# Node.js yükle ve yapılandır  
install_nodejs() {
    log "${BLUE}📦 Node.js yükleniyor...${NC}"
    
    # Node Version Manager (nvm) yükle
    if ! command -v nvm &> /dev/null; then
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    fi
    
    case $PLATFORM in
        "debian")
            # NodeSource repository ekle
            curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
            sudo apt-get install -y nodejs
            ;;
        "redhat")
            curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
            sudo yum install -y nodejs npm
            ;;
        "arch")
            sudo pacman -S --noconfirm nodejs npm
            ;;
        "macos")
            brew install node@18
            ;;
        "windows")
            choco install -y nodejs
            ;;
    esac
    
    # Global paketleri yükle
    npm install -g @vscode/vsce electron-builder typescript ts-node
    
    log "${GREEN}✅ Node.js kuruldu${NC}"
}

# Git yükle ve yapılandır
install_git() {
    log "${BLUE}📝 Git yükleniyor...${NC}"
    
    case $PLATFORM in
        "debian")
            sudo apt-get install -y git git-lfs
            ;;
        "redhat")
            sudo yum install -y git git-lfs
            ;;
        "arch")
            sudo pacman -S --noconfirm git git-lfs
            ;;
        "macos")
            brew install git git-lfs
            ;;
        "windows")
            choco install -y git git-lfs
            ;;
    esac
    
    # Git LFS'i başlat
    git lfs install
    
    log "${GREEN}✅ Git kuruldu${NC}"
}

# Build araçları yükle
install_build_tools() {
    log "${BLUE}🔨 Build araçları yükleniyor...${NC}"
    
    case $PLATFORM in
        "debian")
            sudo apt-get install -y build-essential cmake pkg-config libssl-dev
            ;;
        "redhat") 
            sudo yum groupinstall -y "Development Tools"
            sudo yum install -y cmake openssl-devel pkg-config
            ;;
        "arch")
            sudo pacman -S --noconfirm base-devel cmake openssl pkg-config
            ;;
        "macos")
            # Xcode command line tools
            xcode-select --install 2>/dev/null || true
            brew install cmake pkg-config openssl
            ;;
        "windows")
            choco install -y visualstudio2022buildtools cmake
            ;;
    esac
    
    log "${GREEN}✅ Build araçları kuruldu${NC}"
}

# Sistem kütüphaneleri yükle
install_system_libraries() {
    log "${BLUE}📚 Sistem kütüphaneleri yükleniyor...${NC}"
    
    case $PLATFORM in
        "debian")
            sudo apt-get install -y \
                libffi-dev libssl-dev libbz2-dev libreadline-dev \
                libsqlite3-dev libncurses5-dev libncursesw5-dev \
                xz-utils tk-dev libxml2-dev libxmlsec1-dev \
                liblzma-dev libcurl4-openssl-dev
            ;;
        "redhat")
            sudo yum install -y \
                libffi-devel openssl-devel bzip2-devel readline-devel \
                sqlite-devel ncurses-devel xz-devel tk-devel \
                libxml2-devel xmlsec1-devel libcurl-devel
            ;;
        "arch")
            sudo pacman -S --noconfirm \
                libffi openssl bzip2 readline sqlite ncurses \
                xz tk libxml2 xmlsec curl
            ;;
        "macos")
            brew install \
                libffi openssl readline sqlite3 xz tk \
                libxml2 xmlsec1 curl
            ;;
        "windows")
            # Windows için gerekli kütüphaneler Chocolatey ile
            choco install -y vcredist2019 dotnetfx
            ;;
    esac
    
    log "${GREEN}✅ Sistem kütüphaneleri kuruldu${NC}"
}

# Docker yükle (opsiyonel)
install_docker() {
    log "${BLUE}🐳 Docker yükleniyor...${NC}"
    
    case $PLATFORM in
        "debian")
            # Docker'ın resmi GPG anahtarını ekle
            curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
            
            # Repository ekle
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
            
            # Docker'ı yükle
            sudo apt-get update
            sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
            
            # Kullanıcıyı docker grubuna ekle
            sudo usermod -aG docker $USER
            ;;
        "redhat")
            sudo yum install -y yum-utils
            sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
            sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
            sudo systemctl enable docker
            sudo systemctl start docker
            sudo usermod -aG docker $USER
            ;;
        "arch")
            sudo pacman -S --noconfirm docker docker-compose
            sudo systemctl enable docker
            sudo systemctl start docker
            sudo usermod -aG docker $USER
            ;;
        "macos")
            brew install --cask docker
            ;;
        "windows")
            choco install -y docker-desktop
            ;;
    esac
    
    log "${GREEN}✅ Docker kuruldu${NC}"
}

# VS Code yükle (opsiyonel)
install_vscode() {
    log "${BLUE}💻 VS Code yükleniyor...${NC}"
    
    case $PLATFORM in
        "debian")
            # Microsoft GPG anahtarı
            wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg
            sudo install -o root -g root -m 644 packages.microsoft.gpg /etc/apt/trusted.gpg.d/
            
            # Repository ekle
            sudo sh -c 'echo "deb [arch=amd64,arm64,armhf signed-by=/etc/apt/trusted.gpg.d/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main" > /etc/apt/sources.list.d/vscode.list'
            
            sudo apt-get update
            sudo apt-get install -y code
            ;;
        "redhat")
            sudo rpm --import https://packages.microsoft.com/keys/microsoft.asc
            sudo sh -c 'echo -e "[code]\nname=Visual Studio Code\nbaseurl=https://packages.microsoft.com/yumrepos/vscode\nenabled=1\ngpgcheck=1\ngpgkey=https://packages.microsoft.com/keys/microsoft.asc" > /etc/yum.repos.d/vscode.repo'
            sudo yum install -y code
            ;;
        "arch")
            # AUR helper ile
            if command -v yay &> /dev/null; then
                yay -S --noconfirm visual-studio-code-bin
            else
                sudo pacman -S --noconfirm code
            fi
            ;;
        "macos")
            brew install --cask visual-studio-code
            ;;
        "windows")
            choco install -y vscode
            ;;
    esac
    
    log "${GREEN}✅ VS Code kuruldu${NC}"
}

# Python paketlerini yükle
install_python_packages() {
    log "${BLUE}🐍 Python paketleri yükleniyor...${NC}"
    
    # Virtual environment'i aktive et
    source "$INSTALL_DIR/venv/bin/activate" 2>/dev/null || true
    
    # Temel paketler
    pip install --upgrade pip setuptools wheel
    
    # LocoDex için gerekli paketler
    pip install \
        fastapi uvicorn redis psutil transformers \
        aiofiles python-multipart structlog \
        prometheus-client httpx pydantic \
        torch torchvision torchaudio \
        numpy pandas scikit-learn \
        jupyter notebook ipykernel \
        requests beautifulsoup4 lxml \
        selenium webdriver-manager \
        docker docker-compose \
        pytest pytest-asyncio \
        black flake8 mypy \
        pre-commit
    
    # Platforme özel paketler
    case $PLATFORM in
        "linux"|"debian"|"redhat"|"arch")
            pip install pygtk3 tkinter
            ;;
        "macos")
            pip install py2app
            ;;
        "windows") 
            pip install pywin32 cx_Freeze
            ;;
    esac
    
    log "${GREEN}✅ Python paketleri kuruldu${NC}"
}

# Node.js paketlerini yükle
install_node_packages() {
    log "${BLUE}📦 Node.js paketleri yükleniyor...${NC}"
    
    # Global geliştirme araçları
    npm install -g \
        @vscode/vsce \
        electron-builder \
        typescript \
        ts-node \
        eslint \
        prettier \
        webpack \
        webpack-cli \
        nodemon \
        pm2 \
        serve \
        http-server \
        concurrently
    
    log "${GREEN}✅ Node.js paketleri kuruldu${NC}"
}

# Dependency önbellek sistemi
setup_dependency_cache() {
    log "${BLUE}💾 Dependency önbellek sistemi kuruluyor...${NC}"
    
    # Npm cache yapılandırması
    npm config set cache "$CACHE_DIR/npm"
    
    # Pip cache yapılandırması  
    mkdir -p "$CACHE_DIR/pip"
    pip config set global.cache-dir "$CACHE_DIR/pip"
    
    # Git cache
    git config --global credential.helper cache
    
    log "${GREEN}✅ Önbellek sistemi kuruldu${NC}"
}

# Sağlık kontrolü
health_check() {
    log "${BLUE}🔍 Sistem sağlığı kontrol ediliyor...${NC}"
    
    local issues=0
    
    # Python kontrolü
    if ! python3 --version &> /dev/null; then
        log "${RED}❌ Python bulunamadı${NC}"
        ((issues++))
    else
        log "${GREEN}✅ Python: $(python3 --version)${NC}"
    fi
    
    # Node.js kontrolü
    if ! node --version &> /dev/null; then
        log "${RED}❌ Node.js bulunamadı${NC}"
        ((issues++))
    else
        log "${GREEN}✅ Node.js: $(node --version)${NC}"
    fi
    
    # Git kontrolü
    if ! git --version &> /dev/null; then
        log "${RED}❌ Git bulunamadı${NC}"
        ((issues++))
    else
        log "${GREEN}✅ Git: $(git --version)${NC}"
    fi
    
    # NPM kontrolü
    if ! npm --version &> /dev/null; then
        log "${RED}❌ NPM bulunamadı${NC}"
        ((issues++))
    else
        log "${GREEN}✅ NPM: $(npm --version)${NC}"
    fi
    
    # Pip kontrolü
    if ! pip --version &> /dev/null; then
        log "${RED}❌ PIP bulunamadı${NC}"
        ((issues++))
    else
        log "${GREEN}✅ PIP: $(pip --version)${NC}"
    fi
    
    if [ $issues -eq 0 ]; then
        log "${GREEN}🎉 Tüm dependencies başarıyla kuruldu!${NC}"
        return 0
    else
        log "${RED}❌ $issues sorun tespit edildi${NC}"
        return 1
    fi
}

# Temizlik fonksiyonu
cleanup() {
    log "${BLUE}🧹 Geçici dosyalar temizleniyor...${NC}"
    
    rm -rf "$TEMP_DIR"
    
    # Package manager cache temizliği
    case $PLATFORM in
        "debian")
            sudo apt-get clean
            sudo apt-get autoremove -y
            ;;
        "redhat")
            sudo yum clean all
            ;;
        "arch")
            sudo pacman -Sc --noconfirm
            ;;
        "macos")
            brew cleanup
            ;;
        "windows")
            choco-cleaner
            ;;
    esac
    
    log "${GREEN}✅ Temizlik tamamlandı${NC}"
}

# Ana fonksiyon
main() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║              🔧 LocoDex Dependency Manager               ║"
    echo "║                 Otomatik Bağımlılık Yöneticisi          ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    detect_platform
    setup_cache
    
    log "${BLUE}🚀 Dependency kurulumu başlatılıyor...${NC}"
    
    install_package_managers
    install_git
    install_python
    install_nodejs
    install_build_tools
    install_system_libraries
    install_python_packages
    install_node_packages
    setup_dependency_cache
    
    # Opsiyonel kurulumlar
    read -p "🐳 Docker kurulsun mu? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        install_docker
    fi
    
    read -p "💻 VS Code kurulsun mu? (y/N): " -n 1 -r
    echo  
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        install_vscode
    fi
    
    # Sağlık kontrolü
    if health_check; then
        cleanup
        log "${GREEN}🎉 Tüm dependencies başarıyla kuruldu!${NC}"
        
        # Kurulum özeti
        echo -e "${GREEN}"
        echo "╔══════════════════════════════════════════════════════════╗"
        echo "║                   ✅ KURULUM BAŞARILI                   ║"
        echo "╠══════════════════════════════════════════════════════════╣"
        echo "║                                                          ║"
        echo "║  🐍 Python: $(python3 --version 2>/dev/null | cut -d' ' -f2)                                    ║"
        echo "║  📦 Node.js: $(node --version 2>/dev/null)                                   ║"
        echo "║  📝 Git: $(git --version 2>/dev/null | cut -d' ' -f3)                                       ║"
        echo "║  💾 Önbellek: $CACHE_DIR                       ║"
        echo "║                                                          ║"
        echo "║  🔄 Ana kuruluma devam edebilirsiniz!                   ║"
        echo "║                                                          ║"
        echo "╚══════════════════════════════════════════════════════════╝"
        echo -e "${NC}"
        
        exit 0
    else
        log "${RED}❌ Kurulumda sorunlar var, lütfen logları kontrol edin${NC}"
        exit 1
    fi
}

# Hata yakalama
trap 'log "${RED}❌ Beklenmeyen hata oluştu! Satır: $LINENO${NC}"; exit 1' ERR

# Script çalıştırıldığında ana fonksiyonu başlat
main "$@"