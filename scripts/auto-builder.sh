#!/bin/bash

# LocoDex Akıllı Otomatik Derleme Sistemi
# Kaynak kodu değişikliklerini izler ve otomatik derler

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
BUILD_DIR="$PROJECT_DIR/dist"
CACHE_DIR="$PROJECT_DIR/.cache/build"
LOG_FILE="$PROJECT_DIR/logs/build.log"
PID_FILE="$PROJECT_DIR/pids/builder.pid"

# Yapı yapılandırması
BUILD_CONFIG="$PROJECT_DIR/build.config.json"

# Log fonksiyonu
log() {
    echo -e "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Platform tespiti
detect_platform() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        PLATFORM="linux"
        ARCH=$(uname -m)
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        PLATFORM="macos"
        ARCH=$(uname -m)
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        PLATFORM="windows"
        ARCH="x64"
    fi
    
    log "${GREEN}🔍 Platform: $PLATFORM-$ARCH${NC}"
}

# Build konfigürasyonu oluştur
create_build_config() {
    if [ ! -f "$BUILD_CONFIG" ]; then
        log "${BLUE}⚙️  Build konfigürasyonu oluşturuluyor...${NC}"
        
        cat > "$BUILD_CONFIG" << EOF
{
  "version": "1.0.0",
  "platform": "$PLATFORM",
  "architecture": "$ARCH",
  "build": {
    "mode": "production",
    "optimization": true,
    "minification": true,
    "sourceMaps": false,
    "compression": true
  },
  "targets": {
    "frontend": {
      "enabled": true,
      "framework": "react",
      "buildTool": "vite",
      "outputDir": "dist",
      "watch": ["src/**/*.{js,jsx,ts,tsx}", "public/**/*"]
    },
    "backend": {
      "enabled": true,
      "runtime": "node",
      "outputDir": "dist-server",
      "watch": ["src/services/**/*.js", "src/api/**/*.js"]
    },
    "electron": {
      "enabled": true,
      "outputDir": "dist-electron",
      "platforms": ["$PLATFORM"],
      "watch": ["electron/**/*.js", "src/**/*"]
    },
    "vscode-extension": {
      "enabled": true,
      "outputDir": "vscode-locodex/out",
      "watch": ["vscode-locodex/src/**/*.ts"]
    },
    "python-services": {
      "enabled": true,
      "runtime": "python3",
      "outputDir": "dist-python",
      "watch": ["src/services/**/*.py"]
    },
    "docker": {
      "enabled": false,
      "outputDir": "dist-docker",
      "watch": ["docker/**/*", "Dockerfile*"]
    }
  },
  "hooks": {
    "preBuild": ["npm run lint", "npm run test:quick"],
    "postBuild": ["npm run test:build"],
    "prePackage": ["npm run security-scan"],
    "postPackage": ["npm run verify-package"]
  },
  "cache": {
    "enabled": true,
    "directory": ".cache/build",
    "strategy": "content-hash"
  },
  "parallel": {
    "enabled": true,
    "maxWorkers": 4
  },
  "notifications": {
    "success": true,
    "error": true,
    "desktop": true
  }
}
EOF
        
        log "${GREEN}✅ Build konfigürasyonu oluşturuldu${NC}"
    fi
}

# Build ortamını hazırla
setup_build_environment() {
    log "${BLUE}🏗️  Build ortamı hazırlanıyor...${NC}"
    
    # Dizinleri oluştur
    mkdir -p "$BUILD_DIR"
    mkdir -p "$CACHE_DIR"
    mkdir -p "$PROJECT_DIR/logs"
    mkdir -p "$PROJECT_DIR/pids"
    
    # Node.js ortamını kontrol et
    if ! command -v node &> /dev/null; then
        log "${RED}❌ Node.js bulunamadı${NC}"
        exit 1
    fi
    
    # Python ortamını kontrol et
    if ! command -v python3 &> /dev/null; then
        log "${RED}❌ Python3 bulunamadı${NC}"
        exit 1
    fi
    
    # Build araçlarını kontrol et
    local missing_tools=()
    
    if ! npm list -g @vscode/vsce &> /dev/null; then
        missing_tools+=("@vscode/vsce")
    fi
    
    if ! npm list -g electron-builder &> /dev/null; then
        missing_tools+=("electron-builder")
    fi
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        log "${YELLOW}📦 Eksik araçlar yükleniyor: ${missing_tools[*]}${NC}"
        npm install -g "${missing_tools[@]}"
    fi
    
    log "${GREEN}✅ Build ortamı hazır${NC}"
}

# Frontend build
build_frontend() {
    log "${BLUE}🎨 Frontend derleniyor...${NC}"
    
    cd "$PROJECT_DIR"
    
    # Dependencies kontrol
    if [ ! -d "node_modules" ]; then
        log "${YELLOW}📦 Dependencies yükleniyor...${NC}"
        npm install
    fi
    
    # Vite build
    npm run build
    
    # Build sonuçlarını kontrol et
    if [ -d "$BUILD_DIR" ] && [ "$(ls -A $BUILD_DIR)" ]; then
        local build_size=$(du -sh "$BUILD_DIR" | cut -f1)
        log "${GREEN}✅ Frontend build başarılı (Boyut: $build_size)${NC}"
        return 0
    else
        log "${RED}❌ Frontend build başarısız${NC}"
        return 1
    fi
}

# Backend build
build_backend() {
    log "${BLUE}🔧 Backend derleniyor...${NC}"
    
    cd "$PROJECT_DIR"
    
    # TypeScript varsa derle
    if [ -f "tsconfig.json" ]; then
        npx tsc
    fi
    
    # Node.js servislerini hazırla
    mkdir -p "$PROJECT_DIR/dist-server"
    
    # API servislerini kopyala
    cp -r src/api/* "$PROJECT_DIR/dist-server/" 2>/dev/null || true
    cp -r src/services/* "$PROJECT_DIR/dist-server/" 2>/dev/null || true
    
    # package.json'ı kopyala ve production dependencies'i yükle
    cp package.json "$PROJECT_DIR/dist-server/"
    cd "$PROJECT_DIR/dist-server"
    npm install --only=production
    
    cd "$PROJECT_DIR"
    log "${GREEN}✅ Backend build başarılı${NC}"
}

# Python servislerini hazırla
build_python_services() {
    log "${BLUE}🐍 Python servisleri hazırlanıyor...${NC}"
    
    cd "$PROJECT_DIR"
    
    mkdir -p "$PROJECT_DIR/dist-python"
    
    # Python servislerini kopyala
    for service_dir in src/services/*/; do
        if [ -f "$service_dir/requirements.txt" ]; then
            service_name=$(basename "$service_dir")
            log "${YELLOW}📦 $service_name servisi hazırlanıyor...${NC}"
            
            mkdir -p "$PROJECT_DIR/dist-python/$service_name"
            cp -r "$service_dir"* "$PROJECT_DIR/dist-python/$service_name/"
            
            # Virtual environment oluştur
            python3 -m venv "$PROJECT_DIR/dist-python/$service_name/venv"
            source "$PROJECT_DIR/dist-python/$service_name/venv/bin/activate"
            pip install -r "$PROJECT_DIR/dist-python/$service_name/requirements.txt"
            deactivate
        fi
    done
    
    log "${GREEN}✅ Python servisleri hazırlandı${NC}"
}

# Electron app build
build_electron() {
    log "${BLUE}🖥️  Electron uygulaması derleniyor...${NC}"
    
    cd "$PROJECT_DIR"
    
    # Electron dependencies
    cd electron
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    cd ..
    
    # Frontend build'i electron için hazırla
    if [ ! -d "dist" ]; then
        build_frontend
    fi
    
    # Electron build
    case $PLATFORM in
        "macos")
            npm run build:electron:mac
            ;;
        "linux")
            npm run build:electron:linux
            ;;
        "windows")
            npm run build:electron:win
            ;;
    esac
    
    if [ -d "dist-electron" ]; then
        log "${GREEN}✅ Electron build başarılı${NC}"
        return 0
    else
        log "${RED}❌ Electron build başarısız${NC}"
        return 1
    fi
}

# VS Code extension build
build_vscode_extension() {
    log "${BLUE}🔧 VS Code extension derleniyor...${NC}"
    
    cd "$PROJECT_DIR/vscode-locodex"
    
    # Dependencies kontrol
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    
    # TypeScript compile
    npm run compile
    
    # Extension package
    vsce package --no-git-tag-version --no-update-package-json
    
    # Output dosyasını ana dizine taşı
    mv *.vsix "$PROJECT_DIR/dist/" 2>/dev/null || true
    
    cd "$PROJECT_DIR"
    log "${GREEN}✅ VS Code extension build başarılı${NC}"
}

# Docker images build
build_docker() {
    log "${BLUE}🐳 Docker images derleniyor...${NC}"
    
    cd "$PROJECT_DIR"
    
    if ! command -v docker &> /dev/null; then
        log "${YELLOW}⚠️  Docker bulunamadı, atlanayor...${NC}"
        return 0
    fi
    
    # Docker Compose ile build
    docker-compose build --parallel
    
    # Images'ı export et
    mkdir -p "$PROJECT_DIR/dist-docker"
    docker save $(docker-compose config --services) | gzip > "$PROJECT_DIR/dist-docker/locodex-images.tar.gz"
    
    log "${GREEN}✅ Docker build başarılı${NC}"
}

# Build hooks çalıştır
run_build_hooks() {
    local hook_type="$1"
    
    if [ -f "$BUILD_CONFIG" ]; then
        local hooks=$(jq -r ".hooks.$hook_type[]?" "$BUILD_CONFIG" 2>/dev/null || echo "")
        
        if [ ! -z "$hooks" ]; then
            log "${BLUE}🪝 $hook_type hooks çalıştırılıyor...${NC}"
            
            while IFS= read -r hook; do
                if [ ! -z "$hook" ]; then
                    log "${YELLOW}🔧 Hook: $hook${NC}"
                    eval "$hook" || log "${RED}❌ Hook başarısız: $hook${NC}"
                fi
            done <<< "$hooks"
        fi
    fi
}

# Cache yönetimi
manage_cache() {
    local action="$1"
    
    case $action in
        "clear")
            log "${BLUE}🧹 Build cache temizleniyor...${NC}"
            rm -rf "$CACHE_DIR"
            mkdir -p "$CACHE_DIR"
            ;;
        "info")
            if [ -d "$CACHE_DIR" ]; then
                local cache_size=$(du -sh "$CACHE_DIR" | cut -f1)
                log "${BLUE}💾 Cache boyutu: $cache_size${NC}"
            else
                log "${BLUE}💾 Cache boş${NC}"
            fi
            ;;
    esac
}

# Build durumunu kontrol et
check_build_status() {
    local target="$1"
    local success=0
    
    case $target in
        "frontend")
            [ -d "$BUILD_DIR" ] && [ "$(ls -A $BUILD_DIR)" ] && success=1
            ;;
        "electron")
            [ -d "dist-electron" ] && success=1
            ;;
        "vscode-extension")
            [ -f "$BUILD_DIR"/*.vsix ] && success=1
            ;;
        "backend")
            [ -d "dist-server" ] && success=1
            ;;
        "python")
            [ -d "dist-python" ] && success=1
            ;;
    esac
    
    return $((1 - success))
}

# Paralel build
parallel_build() {
    log "${BLUE}⚡ Paralel build başlatılıyor...${NC}"
    
    # Background process'ler için PID array
    local pids=()
    
    # Frontend build (arka planda)
    (build_frontend) &
    pids+=($!)
    
    # Backend build (arka planda)
    (build_backend) &
    pids+=($!)
    
    # Python services (arka planda)
    (build_python_services) &
    pids+=($!)
    
    # VS Code extension (arka planda)
    (build_vscode_extension) &
    pids+=($!)
    
    # Tüm process'lerin bitmesini bekle
    local failed=0
    for pid in "${pids[@]}"; do
        if ! wait "$pid"; then
            ((failed++))
        fi
    done
    
    if [ $failed -eq 0 ]; then
        log "${GREEN}✅ Paralel build başarılı${NC}"
        
        # Electron build (diğerleri bittikten sonra)
        build_electron
        
        return 0
    else
        log "${RED}❌ $failed build başarısız${NC}"
        return 1
    fi
}

# Watch mode - Dosya değişikliklerini izle
watch_mode() {
    log "${BLUE}👀 Watch mode başlatılıyor...${NC}"
    
    if ! command -v fswatch &> /dev/null && ! command -v inotify-tools &> /dev/null; then
        log "${RED}❌ File watcher bulunamadı (fswatch veya inotify-tools gerekli)${NC}"
        return 1
    fi
    
    # Watch fonksiyonu
    watch_and_build() {
        local watch_path="$1"
        local build_target="$2"
        
        if command -v fswatch &> /dev/null; then
            fswatch -o "$watch_path" | while read num; do
                log "${YELLOW}🔄 Değişiklik tespit edildi: $watch_path${NC}"
                case $build_target in
                    "frontend") build_frontend ;;
                    "backend") build_backend ;;
                    "electron") build_electron ;;
                    "vscode") build_vscode_extension ;;
                    "python") build_python_services ;;
                esac
            done
        elif command -v inotifywait &> /dev/null; then
            while inotifywait -r -e modify,create,delete "$watch_path"; do
                log "${YELLOW}🔄 Değişiklik tespit edildi: $watch_path${NC}"
                case $build_target in
                    "frontend") build_frontend ;;
                    "backend") build_backend ;;
                    "electron") build_electron ;;
                    "vscode") build_vscode_extension ;;
                    "python") build_python_services ;;
                esac
            done
        fi
    }
    
    # Background watch processes
    watch_and_build "src" "frontend" &
    watch_and_build "electron" "electron" &
    watch_and_build "vscode-locodex/src" "vscode" &
    watch_and_build "src/services" "python" &
    
    # PID kaydet
    echo $$ > "$PID_FILE"
    
    log "${GREEN}✅ Watch mode aktif${NC}"
    log "${BLUE}Çıkmak için Ctrl+C${NC}"
    
    # Signal yakalama
    trap 'log "${BLUE}👋 Watch mode durduruluyor...${NC}"; kill $(jobs -p) 2>/dev/null; rm -f "$PID_FILE"; exit 0' INT TERM
    
    # Sonsuz döngü
    wait
}

# Desktop bildirim gönder
send_notification() {
    local title="$1"
    local message="$2"
    local type="$3" # success, error, info
    
    case $PLATFORM in
        "macos")
            osascript -e "display notification \"$message\" with title \"$title\""
            ;;
        "linux")
            if command -v notify-send &> /dev/null; then
                notify-send "$title" "$message"
            fi
            ;;
        "windows")
            powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('$message', '$title')"
            ;;
    esac
}

# Build raporunu oluştur
generate_build_report() {
    log "${BLUE}📊 Build raporu oluşturuluyor...${NC}"
    
    local report_file="$PROJECT_DIR/logs/build-report-$(date +%Y%m%d_%H%M%S).json"
    
    cat > "$report_file" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "platform": "$PLATFORM",
  "architecture": "$ARCH",
  "duration": "$build_duration",
  "targets": {
    "frontend": {
      "status": "$(check_build_status frontend && echo "success" || echo "failed")",
      "size": "$([ -d "$BUILD_DIR" ] && du -sh "$BUILD_DIR" | cut -f1 || echo "0")"
    },
    "backend": {
      "status": "$(check_build_status backend && echo "success" || echo "failed")",
      "size": "$([ -d "dist-server" ] && du -sh "dist-server" | cut -f1 || echo "0")"
    },
    "electron": {
      "status": "$(check_build_status electron && echo "success" || echo "failed")",
      "size": "$([ -d "dist-electron" ] && du -sh "dist-electron" | cut -f1 || echo "0")"
    },
    "vscode": {
      "status": "$(check_build_status vscode-extension && echo "success" || echo "failed")",
      "size": "$([ -f "$BUILD_DIR"/*.vsix ] && du -sh "$BUILD_DIR"/*.vsix | cut -f1 || echo "0")"
    },
    "python": {
      "status": "$(check_build_status python && echo "success" || echo "failed")",
      "size": "$([ -d "dist-python" ] && du -sh "dist-python" | cut -f1 || echo "0")"
    }
  },
  "total_size": "$(du -sh dist* 2>/dev/null | awk '{sum+=$1} END {print sum}' || echo "0")"
}
EOF
    
    log "${GREEN}📊 Build raporu: $report_file${NC}"
}

# Ana build fonksiyonu
main_build() {
    local build_start=$(date +%s)
    
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║              🔨 LocoDex Auto Builder                    ║"
    echo "║                Akıllı Otomatik Derleme                  ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    detect_platform
    create_build_config
    setup_build_environment
    
    log "${BLUE}🚀 Build işlemi başlatılıyor...${NC}"
    
    # Pre-build hooks
    run_build_hooks "preBuild"
    
    # Paralel build
    if parallel_build; then
        # Post-build hooks
        run_build_hooks "postBuild"
        
        local build_end=$(date +%s)
        build_duration=$((build_end - build_start))
        
        log "${GREEN}🎉 Build başarıyla tamamlandı! ($build_duration saniye)${NC}"
        
        # Bildirim gönder
        send_notification "LocoDex Build" "Build başarıyla tamamlandı!" "success"
        
        # Rapor oluştur
        generate_build_report
        
        # Build özeti
        echo -e "${GREEN}"
        echo "╔══════════════════════════════════════════════════════════╗"
        echo "║                    ✅ BUILD BAŞARILI                    ║"
        echo "╠══════════════════════════════════════════════════════════╣"
        echo "║                                                          ║"
        echo "║  ⏱️  Süre: $build_duration saniye                              ║"
        echo "║  📦 Frontend: $([ -d "$BUILD_DIR" ] && echo "✅" || echo "❌")                                       ║"
        echo "║  🔧 Backend: $([ -d "dist-server" ] && echo "✅" || echo "❌")                                        ║"
        echo "║  🖥️  Electron: $([ -d "dist-electron" ] && echo "✅" || echo "❌")                                     ║"
        echo "║  🔧 VS Code Ext: $([ -f "$BUILD_DIR"/*.vsix ] && echo "✅" || echo "❌")                                  ║"
        echo "║  🐍 Python: $([ -d "dist-python" ] && echo "✅" || echo "❌")                                        ║"
        echo "║                                                          ║"
        echo "║  📁 Çıktı dizini: $BUILD_DIR                       ║"
        echo "║                                                          ║"
        echo "╚══════════════════════════════════════════════════════════╝"
        echo -e "${NC}"
        
        return 0
    else
        log "${RED}❌ Build başarısız!${NC}"
        send_notification "LocoDex Build" "Build başarısız!" "error"
        return 1
    fi
}

# Kullanım bilgisi
show_usage() {
    echo -e "${BLUE}LocoDex Auto Builder Kullanımı:${NC}"
    echo
    echo -e "${YELLOW}Komutlar:${NC}"
    echo "  build                 - Tam build işlemi"
    echo "  build frontend        - Sadece frontend build"
    echo "  build backend         - Sadece backend build"
    echo "  build electron        - Sadece electron build"
    echo "  build vscode          - Sadece VS Code extension build"
    echo "  build python          - Sadece Python servisleri build"
    echo "  build docker          - Docker images build"
    echo "  watch                 - Watch mode (otomatik rebuild)"
    echo "  clean                 - Build dosyalarını temizle"
    echo "  cache clear           - Build cache'i temizle"
    echo "  cache info            - Cache bilgisi"
    echo "  status                - Build durumunu kontrol et"
    echo "  help                  - Bu yardım mesajı"
    echo
    echo -e "${YELLOW}Örnekler:${NC}"
    echo "  ./auto-builder.sh build"
    echo "  ./auto-builder.sh watch"
    echo "  ./auto-builder.sh build frontend"
    echo "  ./auto-builder.sh clean"
}

# Ana switch
case "${1:-build}" in
    "build")
        case "${2:-all}" in
            "all"|"") main_build ;;
            "frontend") build_frontend ;;
            "backend") build_backend ;;
            "electron") build_electron ;;
            "vscode") build_vscode_extension ;;
            "python") build_python_services ;;
            "docker") build_docker ;;
            *) show_usage ;;
        esac
        ;;
    "watch")
        watch_mode
        ;;
    "clean")
        log "${BLUE}🧹 Build dosyaları temizleniyor...${NC}"
        rm -rf "$BUILD_DIR" "dist-server" "dist-electron" "dist-python" "dist-docker"
        log "${GREEN}✅ Temizlik tamamlandı${NC}"
        ;;
    "cache")
        manage_cache "$2"
        ;;
    "status")
        echo -e "${BLUE}📊 Build Durumu:${NC}"
        echo "Frontend: $(check_build_status frontend && echo "✅" || echo "❌")"
        echo "Backend: $(check_build_status backend && echo "✅" || echo "❌")"
        echo "Electron: $(check_build_status electron && echo "✅" || echo "❌")"
        echo "VS Code: $(check_build_status vscode-extension && echo "✅" || echo "❌")"
        echo "Python: $(check_build_status python && echo "✅" || echo "❌")"
        ;;
    "help"|"-h"|"--help")
        show_usage
        ;;
    *)
        show_usage
        exit 1
        ;;
esac