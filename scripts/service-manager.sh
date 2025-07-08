#!/bin/bash

# LocoDex Gelişmiş Servis Yönetimi ve Autostart Sistemi
# Tüm servisleri otomatik başlatır, izler ve yönetir

set -e

# Renkler
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Global değişkenler
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"
PID_DIR="$PROJECT_DIR/pids"
CONFIG_DIR="$PROJECT_DIR/config"
SERVICE_CONFIG="$CONFIG_DIR/services.json"

# Platform tespiti
detect_platform() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        PLATFORM="linux"
        INIT_SYSTEM="systemd"
        SERVICE_DIR="/etc/systemd/system"
        if [ ! -d "$SERVICE_DIR" ]; then
            INIT_SYSTEM="sysv"
            SERVICE_DIR="/etc/init.d"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        PLATFORM="macos"
        INIT_SYSTEM="launchd"
        SERVICE_DIR="$HOME/Library/LaunchAgents"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        PLATFORM="windows"
        INIT_SYSTEM="winsvc"
        SERVICE_DIR="$HOME/AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup"
    fi
    
    echo -e "${GREEN}🔍 Platform: $PLATFORM ($INIT_SYSTEM)${NC}"
}

# Log fonksiyonu
log() {
    local service_name="${2:-system}"
    echo -e "$(date '+%Y-%m-%d %H:%M:%S') [$service_name] - $1" | tee -a "$LOG_DIR/service-manager.log"
}

# Servis yapılandırmasını oluştur
create_service_config() {
    if [ ! -f "$SERVICE_CONFIG" ]; then
        log "${BLUE}⚙️  Servis yapılandırması oluşturuluyor...${NC}"
        
        mkdir -p "$CONFIG_DIR"
        
        cat > "$SERVICE_CONFIG" << EOF
{
  "version": "1.0.0",
  "platform": "$PLATFORM",
  "autostart": true,
  "services": {
    "locodex-api": {
      "name": "LocoDex API Server",
      "description": "LocoDex ana API servisi",
      "enabled": true,
      "autostart": true,
      "type": "node",
      "workingDir": "$PROJECT_DIR",
      "command": "npm run start:api",
      "env": {
        "NODE_ENV": "production",
        "PORT": "8000"
      },
      "ports": [8000],
      "dependencies": [],
      "healthCheck": {
        "url": "http://localhost:8000/health",
        "interval": 30,
        "timeout": 10,
        "retries": 3
      },
      "restart": {
        "policy": "always",
        "delay": 5,
        "maxRetries": 5
      },
      "logging": {
        "file": "$LOG_DIR/api.log",
        "level": "info",
        "maxSize": "10MB",
        "maxFiles": 5
      }
    },
    "locodex-vllm": {
      "name": "LocoDex VLLM Service",
      "description": "LocoDex VLLM inference servisi",
      "enabled": true,
      "autostart": true,
      "type": "python",
      "workingDir": "$PROJECT_DIR/src/services/vllm_service",
      "command": "python3 server.py",
      "env": {
        "PYTHONPATH": "$PROJECT_DIR/src/services/vllm_service",
        "HOST": "0.0.0.0",
        "PORT": "8080"
      },
      "ports": [8080],
      "dependencies": [],
      "healthCheck": {
        "url": "http://localhost:8080/health",
        "interval": 60,
        "timeout": 15,
        "retries": 3
      },
      "restart": {
        "policy": "on-failure",
        "delay": 10,
        "maxRetries": 3
      },
      "logging": {
        "file": "$LOG_DIR/vllm.log",
        "level": "info",
        "maxSize": "50MB",
        "maxFiles": 3
      }
    },
    "locodex-web": {
      "name": "LocoDex Web Frontend",
      "description": "LocoDex web arayüzü",
      "enabled": true,
      "autostart": true,
      "type": "node",
      "workingDir": "$PROJECT_DIR",
      "command": "npm run preview",
      "env": {
        "NODE_ENV": "production",
        "PORT": "3000"
      },
      "ports": [3000],
      "dependencies": ["locodex-api"],
      "healthCheck": {
        "url": "http://localhost:3000",
        "interval": 30,
        "timeout": 10,
        "retries": 3
      },
      "restart": {
        "policy": "always",
        "delay": 5,
        "maxRetries": 5
      },
      "logging": {
        "file": "$LOG_DIR/web.log",
        "level": "info",
        "maxSize": "10MB",
        "maxFiles": 3
      }
    },
    "locodex-training": {
      "name": "LocoDex Training Service",
      "description": "LocoDex model eğitimi servisi",
      "enabled": false,
      "autostart": false,
      "type": "python",
      "workingDir": "$PROJECT_DIR/src/services/training_service",
      "command": "python3 main.py",
      "env": {
        "PYTHONPATH": "$PROJECT_DIR/src/services/training_service"
      },
      "ports": [8081],
      "dependencies": [],
      "healthCheck": {
        "url": "http://localhost:8081/health",
        "interval": 120,
        "timeout": 30,
        "retries": 2
      },
      "restart": {
        "policy": "no",
        "delay": 0,
        "maxRetries": 0
      },
      "logging": {
        "file": "$LOG_DIR/training.log",
        "level": "debug",
        "maxSize": "100MB",
        "maxFiles": 2
      }
    },
    "locodex-deep-research": {
      "name": "LocoDex Deep Research",
      "description": "LocoDex derin araştırma servisi",
      "enabled": false,
      "autostart": false,
      "type": "python",
      "workingDir": "$PROJECT_DIR/src/services/deep_research_service",
      "command": "python3 server.py",
      "env": {
        "PYTHONPATH": "$PROJECT_DIR/src/services/deep_research_service"
      },
      "ports": [8082],
      "dependencies": [],
      "healthCheck": {
        "url": "http://localhost:8082/health",
        "interval": 60,
        "timeout": 15,
        "retries": 2
      },
      "restart": {
        "policy": "on-failure",
        "delay": 15,
        "maxRetries": 2
      },
      "logging": {
        "file": "$LOG_DIR/deep-research.log",
        "level": "info",
        "maxSize": "25MB",
        "maxFiles": 3
      }
    }
  },
  "monitoring": {
    "enabled": true,
    "interval": 30,
    "alerts": {
      "email": false,
      "desktop": true,
      "webhook": false
    }
  },
  "backup": {
    "enabled": true,
    "interval": "daily",
    "retention": 7,
    "path": "$PROJECT_DIR/backups"
  }
}
EOF
        
        log "${GREEN}✅ Servis yapılandırması oluşturuldu${NC}"
    fi
}

# Ortamı hazırla
setup_environment() {
    log "${BLUE}🏗️  Servis ortamı hazırlanıyor...${NC}"
    
    mkdir -p "$LOG_DIR"
    mkdir -p "$PID_DIR" 
    mkdir -p "$CONFIG_DIR"
    mkdir -p "$PROJECT_DIR/backups"
    
    # Log dosyalarını oluştur
    touch "$LOG_DIR/service-manager.log"
    touch "$LOG_DIR/api.log"
    touch "$LOG_DIR/vllm.log"
    touch "$LOG_DIR/web.log"
    touch "$LOG_DIR/training.log"
    touch "$LOG_DIR/deep-research.log"
    
    # Log rotasyonu için logrotate yapılandırması
    create_logrotate_config
    
    log "${GREEN}✅ Servis ortamı hazır${NC}"
}

# Log rotasyon yapılandırması
create_logrotate_config() {
    if [ "$PLATFORM" = "linux" ]; then
        cat > "$CONFIG_DIR/locodex-logrotate" << EOF
$LOG_DIR/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 $USER $USER
    postrotate
        # Servisleri restart etmek yerine sadece log dosyalarını yeniden aç
        systemctl reload locodex-* 2>/dev/null || true
    endscript
}
EOF
    fi
}

# Port kontrolü
check_port() {
    local port="$1"
    if command -v lsof &> /dev/null; then
        lsof -i:$port > /dev/null 2>&1
    elif command -v netstat &> /dev/null; then
        netstat -ln | grep ":$port " > /dev/null 2>&1
    else
        false
    fi
}

# Portu temizle
kill_port() {
    local port="$1"
    log "${YELLOW}🔄 Port $port temizleniyor...${NC}"
    
    if command -v lsof &> /dev/null; then
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
    elif command -v fuser &> /dev/null; then
        fuser -k $port/tcp 2>/dev/null || true
    fi
    
    sleep 2
}

# Servis sağlık kontrolü
health_check() {
    local service_name="$1"
    local service_config=$(jq -r ".services.\"$service_name\"" "$SERVICE_CONFIG")
    
    if [ "$service_config" = "null" ]; then
        return 1
    fi
    
    local health_url=$(echo "$service_config" | jq -r '.healthCheck.url')
    local timeout=$(echo "$service_config" | jq -r '.healthCheck.timeout')
    
    if [ "$health_url" != "null" ]; then
        if curl -f -s --max-time "$timeout" "$health_url" > /dev/null 2>&1; then
            return 0
        fi
    fi
    
    return 1
}

# Bağımlılıkları kontrol et
check_dependencies() {
    local service_name="$1"
    local dependencies=$(jq -r ".services.\"$service_name\".dependencies[]?" "$SERVICE_CONFIG" 2>/dev/null)
    
    for dep in $dependencies; do
        if ! is_service_running "$dep"; then
            log "${YELLOW}⚠️  Bağımlılık çalışmıyor: $dep${NC}" "$service_name"
            return 1
        fi
    done
    
    return 0
}

# Servis çalışıyor mu kontrol et
is_service_running() {
    local service_name="$1"
    local pid_file="$PID_DIR/$service_name.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            return 0
        else
            rm -f "$pid_file"
        fi
    fi
    
    return 1
}

# Servis başlat
start_service() {
    local service_name="$1"
    local service_config=$(jq -r ".services.\"$service_name\"" "$SERVICE_CONFIG")
    
    if [ "$service_config" = "null" ]; then
        log "${RED}❌ Servis bulunamadı: $service_name${NC}"
        return 1
    fi
    
    # Servis zaten çalışıyor mu?
    if is_service_running "$service_name"; then
        log "${YELLOW}⚠️  Servis zaten çalışıyor: $service_name${NC}"
        return 0
    fi
    
    # Servis aktif mi?
    local enabled=$(echo "$service_config" | jq -r '.enabled')
    if [ "$enabled" != "true" ]; then
        log "${YELLOW}⚠️  Servis devre dışı: $service_name${NC}"
        return 0
    fi
    
    # Bağımlılıkları kontrol et
    if ! check_dependencies "$service_name"; then
        log "${RED}❌ Bağımlılıklar hazır değil: $service_name${NC}"
        return 1
    fi
    
    # Servis bilgilerini al
    local working_dir=$(echo "$service_config" | jq -r '.workingDir')
    local command=$(echo "$service_config" | jq -r '.command')
    local log_file=$(echo "$service_config" | jq -r '.logging.file')
    local ports=$(echo "$service_config" | jq -r '.ports[]?' 2>/dev/null)
    
    # Portları kontrol et ve gerekirse temizle
    for port in $ports; do
        if check_port "$port"; then
            kill_port "$port"
        fi
    done
    
    log "${BLUE}🚀 Servis başlatılıyor: $service_name${NC}" "$service_name"
    
    # Çalışma dizinine geç
    cd "$working_dir"
    
    # Environment variables'ı ayarla
    local env_vars=$(echo "$service_config" | jq -r '.env | to_entries[] | "\(.key)=\(.value)"' 2>/dev/null)
    while IFS= read -r env_var; do
        if [ ! -z "$env_var" ]; then
            export "$env_var"
        fi
    done <<< "$env_vars"
    
    # Servisi başlat (arka planda)
    nohup $command > "$log_file" 2>&1 &
    local pid=$!
    
    # PID'i kaydet
    echo "$pid" > "$PID_DIR/$service_name.pid"
    
    # Başlatma kontrolü
    sleep 3
    if kill -0 "$pid" 2>/dev/null; then
        log "${GREEN}✅ Servis başlatıldı: $service_name (PID: $pid)${NC}" "$service_name"
        
        # Sağlık kontrolü (opsiyonel)
        local retries=5
        while [ $retries -gt 0 ]; do
            if health_check "$service_name"; then
                log "${GREEN}✅ Sağlık kontrolü başarılı: $service_name${NC}" "$service_name"
                break
            fi
            ((retries--))
            if [ $retries -gt 0 ]; then
                log "${YELLOW}⏳ Sağlık kontrolü bekleniyor... ($retries kalan)${NC}" "$service_name"
                sleep 5
            fi
        done
        
        return 0
    else
        log "${RED}❌ Servis başlatılamadı: $service_name${NC}" "$service_name"
        rm -f "$PID_DIR/$service_name.pid"
        return 1
    fi
}

# Servis durdur
stop_service() {
    local service_name="$1"
    local force="${2:-false}"
    
    if ! is_service_running "$service_name"; then
        log "${YELLOW}⚠️  Servis zaten durmuş: $service_name${NC}"
        return 0
    fi
    
    local pid_file="$PID_DIR/$service_name.pid"
    local pid=$(cat "$pid_file")
    
    log "${BLUE}🛑 Servis durduruluyor: $service_name (PID: $pid)${NC}" "$service_name"
    
    # Graceful shutdown
    if [ "$force" = "false" ]; then
        kill -TERM "$pid" 2>/dev/null || true
        
        # 10 saniye bekle
        local wait_time=10
        while [ $wait_time -gt 0 ] && kill -0 "$pid" 2>/dev/null; do
            sleep 1
            ((wait_time--))
        done
    fi
    
    # Hala çalışıyorsa zorla durdur
    if kill -0 "$pid" 2>/dev/null; then
        log "${YELLOW}🔨 Zorla durduruluyor: $service_name${NC}" "$service_name"
        kill -KILL "$pid" 2>/dev/null || true
    fi
    
    # PID dosyasını temizle
    rm -f "$pid_file"
    
    # Port temizliği
    local service_config=$(jq -r ".services.\"$service_name\"" "$SERVICE_CONFIG")
    local ports=$(echo "$service_config" | jq -r '.ports[]?' 2>/dev/null)
    for port in $ports; do
        if check_port "$port"; then
            kill_port "$port"
        fi
    done
    
    log "${GREEN}✅ Servis durduruldu: $service_name${NC}" "$service_name"
}

# Servis yeniden başlat
restart_service() {
    local service_name="$1"
    
    log "${BLUE}🔄 Servis yeniden başlatılıyor: $service_name${NC}" "$service_name"
    
    stop_service "$service_name"
    sleep 2
    start_service "$service_name"
}

# Tüm servisleri başlat
start_all_services() {
    log "${BLUE}🚀 Tüm servisler başlatılıyor...${NC}"
    
    # Servis listesini al (autostart=true olanlar)
    local services=$(jq -r '.services | to_entries[] | select(.value.autostart == true) | .key' "$SERVICE_CONFIG")
    
    # Bağımlılık sırasına göre başlat
    local started_services=()
    local remaining_services=($services)
    
    while [ ${#remaining_services[@]} -gt 0 ]; do
        local progress_made=false
        local new_remaining=()
        
        for service in "${remaining_services[@]}"; do
            if check_dependencies "$service"; then
                start_service "$service"
                started_services+=("$service")
                progress_made=true
            else
                new_remaining+=("$service")
            fi
        done
        
        remaining_services=("${new_remaining[@]}")
        
        if [ "$progress_made" = "false" ] && [ ${#remaining_services[@]} -gt 0 ]; then
            log "${RED}❌ Dairesel bağımlılık veya eksik bağımlılık: ${remaining_services[*]}${NC}"
            break
        fi
    done
    
    log "${GREEN}✅ Autostart servisleri başlatıldı${NC}"
}

# Tüm servisleri durdur
stop_all_services() {
    log "${BLUE}🛑 Tüm servisler durduruluyor...${NC}"
    
    # Çalışan servisleri bul
    local running_services=()
    for pid_file in "$PID_DIR"/*.pid; do
        if [ -f "$pid_file" ]; then
            local service_name=$(basename "$pid_file" .pid)
            if is_service_running "$service_name"; then
                running_services+=("$service_name")
            fi
        fi
    done
    
    # Ters sırada durdur (bağımlılıkları önce)
    for ((i=${#running_services[@]}-1; i>=0; i--)); do
        stop_service "${running_services[i]}"
    done
    
    log "${GREEN}✅ Tüm servisler durduruldu${NC}"
}

# Servis durumunu göster
show_service_status() {
    local service_name="$1"
    
    if [ -z "$service_name" ]; then
        # Tüm servislerin durumunu göster
        echo -e "${BLUE}📊 Servis Durumu:${NC}"
        echo -e "${BLUE}==================${NC}"
        
        local services=$(jq -r '.services | keys[]' "$SERVICE_CONFIG")
        
        printf "%-20s %-10s %-8s %-15s %-10s\n" "SERVİS" "DURUM" "PID" "SAĞLIK" "PORT"
        printf "%-20s %-10s %-8s %-15s %-10s\n" "--------------------" "----------" "--------" "---------------" "----------"
        
        for service in $services; do
            local status="❌ Durmuş"
            local pid="N/A"
            local health="❌ Kötü"
            local ports=$(jq -r ".services.\"$service\".ports[]?" "$SERVICE_CONFIG" 2>/dev/null | tr '\n' ',' | sed 's/,$//')
            
            if is_service_running "$service"; then
                status="✅ Çalışıyor"
                pid=$(cat "$PID_DIR/$service.pid")
                
                if health_check "$service"; then
                    health="✅ İyi"
                fi
            fi
            
            printf "%-20s %-10s %-8s %-15s %-10s\n" "$service" "$status" "$pid" "$health" "$ports"
        done
    else
        # Belirli bir servisin detaylı durumu
        echo -e "${BLUE}📊 Servis Detayı: $service_name${NC}"
        echo -e "${BLUE}==============================${NC}"
        
        local service_config=$(jq -r ".services.\"$service_name\"" "$SERVICE_CONFIG")
        if [ "$service_config" = "null" ]; then
            echo -e "${RED}❌ Servis bulunamadı: $service_name${NC}"
            return 1
        fi
        
        echo "Adı: $(echo "$service_config" | jq -r '.name')"
        echo "Açıklama: $(echo "$service_config" | jq -r '.description')"
        echo "Tip: $(echo "$service_config" | jq -r '.type')"
        echo "Aktif: $(echo "$service_config" | jq -r '.enabled')"
        echo "Otomatik Başlat: $(echo "$service_config" | jq -r '.autostart')"
        echo "Komut: $(echo "$service_config" | jq -r '.command')"
        echo "Çalışma Dizini: $(echo "$service_config" | jq -r '.workingDir')"
        echo "Portlar: $(echo "$service_config" | jq -r '.ports[]?' 2>/dev/null | tr '\n' ', ' | sed 's/, $//')"
        
        if is_service_running "$service_name"; then
            local pid=$(cat "$PID_DIR/$service_name.pid")
            echo "Durum: ✅ Çalışıyor (PID: $pid)"
            
            if health_check "$service_name"; then
                echo "Sağlık: ✅ İyi"
            else
                echo "Sağlık: ❌ Kötü"
            fi
        else
            echo "Durum: ❌ Durmuş"
        fi
    fi
}

# Servis izleme (monitoring)
monitor_services() {
    log "${BLUE}👀 Servis izleme başlatılıyor...${NC}"
    
    local monitor_pid_file="$PID_DIR/monitor.pid"
    echo $$ > "$monitor_pid_file"
    
    # İzleme döngüsü
    while true; do
        local services=$(jq -r '.services | to_entries[] | select(.value.autostart == true) | .key' "$SERVICE_CONFIG")
        
        for service in $services; do
            if ! is_service_running "$service"; then
                log "${RED}💀 Servis çökmüş: $service${NC}" "monitor"
                
                # Restart policy kontrol et
                local restart_policy=$(jq -r ".services.\"$service\".restart.policy" "$SERVICE_CONFIG")
                
                if [ "$restart_policy" = "always" ] || [ "$restart_policy" = "on-failure" ]; then
                    log "${YELLOW}🔄 Servis yeniden başlatılıyor: $service${NC}" "monitor"
                    start_service "$service"
                fi
            elif ! health_check "$service"; then
                log "${YELLOW}⚠️  Sağlık kontrolü başarısız: $service${NC}" "monitor"
                
                # 3 kez başarısız sağlık kontrolünden sonra restart
                local fail_count_file="$PID_DIR/$service.fails"
                local fail_count=0
                
                if [ -f "$fail_count_file" ]; then
                    fail_count=$(cat "$fail_count_file")
                fi
                
                ((fail_count++))
                echo "$fail_count" > "$fail_count_file"
                
                if [ $fail_count -ge 3 ]; then
                    log "${RED}🔄 Çoklu sağlık kontrolü başarısız, restart: $service${NC}" "monitor"
                    restart_service "$service"
                    rm -f "$fail_count_file"
                fi
            else
                # Sağlık iyi, fail count'u sıfırla
                rm -f "$PID_DIR/$service.fails"
            fi
        done
        
        sleep 30  # 30 saniyede bir kontrol et
    done
}

# Sistem autostart kurulumu
setup_system_autostart() {
    log "${BLUE}🔄 Sistem autostart kuruluyor...${NC}"
    
    case $INIT_SYSTEM in
        "systemd")
            # Systemd service dosyası oluştur
            cat > "$CONFIG_DIR/locodex.service" << EOF
[Unit]
Description=LocoDex AI Services
After=network.target

[Service]
Type=forking
User=$USER
WorkingDirectory=$PROJECT_DIR
ExecStart=$SCRIPT_DIR/service-manager.sh start-all
ExecStop=$SCRIPT_DIR/service-manager.sh stop-all
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
            
            # Service'i kur
            sudo cp "$CONFIG_DIR/locodex.service" "$SERVICE_DIR/"
            sudo systemctl daemon-reload
            sudo systemctl enable locodex.service
            
            log "${GREEN}✅ Systemd autostart kuruldu${NC}"
            ;;
            
        "launchd")
            # LaunchAgent plist dosyası oluştur
            cat > "$SERVICE_DIR/com.locodex.services.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.locodex.services</string>
    <key>ProgramArguments</key>
    <array>
        <string>$SCRIPT_DIR/service-manager.sh</string>
        <string>start-all</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>WorkingDirectory</key>
    <string>$PROJECT_DIR</string>
    <key>StandardOutPath</key>
    <string>$LOG_DIR/autostart.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/autostart.log</string>
</dict>
</plist>
EOF
            
            # LaunchAgent'ı yükle
            launchctl load "$SERVICE_DIR/com.locodex.services.plist"
            
            log "${GREEN}✅ LaunchAgent autostart kuruldu${NC}"
            ;;
            
        "winsvc")
            # Windows için startup script
            cat > "$SERVICE_DIR/LocoDex.bat" << EOF
@echo off
cd /d "$PROJECT_DIR"
"$SCRIPT_DIR/service-manager.sh" start-all
EOF
            
            log "${GREEN}✅ Windows autostart kuruldu${NC}"
            ;;
    esac
}

# Backup alma
backup_services() {
    log "${BLUE}💾 Servis backup'ı alınıyor...${NC}"
    
    local backup_dir="$PROJECT_DIR/backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Konfigürasyon dosyalarını backup'la
    cp -r "$CONFIG_DIR" "$backup_dir/"
    
    # Log dosyalarını backup'la (son 24 saat)
    find "$LOG_DIR" -name "*.log" -mtime -1 -exec cp {} "$backup_dir/" \;
    
    # PID dosyalarını backup'la
    cp -r "$PID_DIR" "$backup_dir/" 2>/dev/null || true
    
    # Backup'ı sıkıştır
    tar -czf "$backup_dir.tar.gz" -C "$PROJECT_DIR/backups" "$(basename "$backup_dir")"
    rm -rf "$backup_dir"
    
    log "${GREEN}✅ Backup alındı: $backup_dir.tar.gz${NC}"
    
    # Eski backup'ları temizle (7 günden eski)
    find "$PROJECT_DIR/backups" -name "*.tar.gz" -mtime +7 -delete
}

# Ana fonksiyon
main() {
    detect_platform
    setup_environment
    create_service_config
    
    case "${1:-help}" in
        "start")
            if [ -n "$2" ]; then
                start_service "$2"
            else
                echo "Kullanım: $0 start <servis_adı>"
                exit 1
            fi
            ;;
        "stop")
            if [ -n "$2" ]; then
                stop_service "$2"
            else
                echo "Kullanım: $0 stop <servis_adı>"
                exit 1
            fi
            ;;
        "restart")
            if [ -n "$2" ]; then
                restart_service "$2"
            else
                echo "Kullanım: $0 restart <servis_adı>"
                exit 1
            fi
            ;;
        "start-all")
            start_all_services
            ;;
        "stop-all")
            stop_all_services
            ;;
        "restart-all")
            stop_all_services
            sleep 3
            start_all_services
            ;;
        "status")
            show_service_status "$2"
            ;;
        "monitor")
            monitor_services
            ;;
        "setup-autostart")
            setup_system_autostart
            ;;
        "backup")
            backup_services
            ;;
        "logs")
            if [ -n "$2" ]; then
                tail -f "$LOG_DIR/$2.log"
            else
                tail -f "$LOG_DIR"/*.log
            fi
            ;;
        "clean")
            log "${BLUE}🧹 PID dosyaları temizleniyor...${NC}"
            rm -f "$PID_DIR"/*.pid
            rm -f "$PID_DIR"/*.fails
            log "${GREEN}✅ Temizlik tamamlandı${NC}"
            ;;
        "help"|"-h"|"--help")
            echo -e "${BLUE}LocoDex Servis Yöneticisi Kullanımı:${NC}"
            echo
            echo -e "${YELLOW}Komutlar:${NC}"
            echo "  start <servis>        - Servisi başlat"
            echo "  stop <servis>         - Servisi durdur"
            echo "  restart <servis>      - Servisi yeniden başlat"
            echo "  start-all             - Tüm servisleri başlat"
            echo "  stop-all              - Tüm servisleri durdur"
            echo "  restart-all           - Tüm servisleri yeniden başlat"
            echo "  status [servis]       - Servis durumunu göster"
            echo "  monitor               - Servisleri izle"
            echo "  setup-autostart       - Sistem autostart kur"
            echo "  backup                - Servis backup'ı al"
            echo "  logs [servis]         - Logları izle"
            echo "  clean                 - PID dosyalarını temizle"
            echo "  help                  - Bu yardım mesajı"
            echo
            echo -e "${YELLOW}Servisler:${NC}"
            if [ -f "$SERVICE_CONFIG" ]; then
                jq -r '.services | keys[]' "$SERVICE_CONFIG" | sed 's/^/  /'
            fi
            ;;
        *)
            echo "Bilinmeyen komut: $1"
            echo "Yardım için: $0 help"
            exit 1
            ;;
    esac
}

# Script çalıştırıldığında ana fonksiyonu başlat
main "$@"