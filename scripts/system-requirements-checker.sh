#!/bin/bash

# LocoDex Kapsamlı Sistem Gereksinimleri Kontrol Sistemi
# Sistem uyumluluğu, performans ve güvenlik kontrolü

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
LOG_FILE="$PROJECT_DIR/logs/system-check.log"
REPORT_FILE="$PROJECT_DIR/logs/system-report-$(date +%Y%m%d_%H%M%S).json"

# Gereksinimler
MIN_RAM_GB=4
RECOMMENDED_RAM_GB=8
MIN_DISK_GB=5
RECOMMENDED_DISK_GB=20
MIN_CPU_CORES=2
RECOMMENDED_CPU_CORES=4

# Test sonuçları
PASSED_TESTS=0
FAILED_TESTS=0
WARNING_TESTS=0
TOTAL_TESTS=0

# Log fonksiyonu
log() {
    echo -e "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Test sonucu kaydet
record_test_result() {
    local test_name="$1"
    local status="$2"
    local message="$3"
    local details="$4"
    
    ((TOTAL_TESTS++))
    
    case $status in
        "PASS")
            ((PASSED_TESTS++))
            log "${GREEN}✅ $test_name: $message${NC}"
            ;;
        "FAIL")
            ((FAILED_TESTS++))
            log "${RED}❌ $test_name: $message${NC}"
            ;;
        "WARN")
            ((WARNING_TESTS++))
            log "${YELLOW}⚠️  $test_name: $message${NC}"
            ;;
    esac
    
    # JSON formatında rapor dosyasına ekle
    echo "  \"$test_name\": {" >> "$REPORT_FILE.tmp"
    echo "    \"status\": \"$status\"," >> "$REPORT_FILE.tmp"
    echo "    \"message\": \"$message\"," >> "$REPORT_FILE.tmp"
    echo "    \"details\": \"$details\"," >> "$REPORT_FILE.tmp"
    echo "    \"timestamp\": \"$(date -Iseconds)\"" >> "$REPORT_FILE.tmp"
    echo "  }," >> "$REPORT_FILE.tmp"
}

# Platform tespiti
detect_platform() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        PLATFORM="linux"
        if [ -f /etc/os-release ]; then
            DISTRO=$(grep '^ID=' /etc/os-release | cut -d'=' -f2 | tr -d '"')
            DISTRO_VERSION=$(grep '^VERSION_ID=' /etc/os-release | cut -d'=' -f2 | tr -d '"')
        fi
        ARCH=$(uname -m)
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        PLATFORM="macos"
        DISTRO="macos"
        DISTRO_VERSION=$(sw_vers -productVersion)
        ARCH=$(uname -m)
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        PLATFORM="windows"
        DISTRO="windows"
        DISTRO_VERSION=$(cmd.exe /c ver 2>/dev/null | grep -o '[0-9]*\.[0-9]*\.[0-9]*' | head -1)
        ARCH="x64"
    fi
    
    record_test_result "Platform Detection" "PASS" "Platform: $PLATFORM ($DISTRO $DISTRO_VERSION, $ARCH)" "$PLATFORM-$DISTRO-$DISTRO_VERSION-$ARCH"
}

# CPU kontrolü
check_cpu() {
    local cpu_model=""
    local cpu_cores=0
    local cpu_threads=0
    local cpu_freq=""
    
    case $PLATFORM in
        "linux")
            cpu_model=$(grep "model name" /proc/cpuinfo | head -1 | cut -d':' -f2 | xargs)
            cpu_cores=$(grep "cpu cores" /proc/cpuinfo | head -1 | cut -d':' -f2 | xargs)
            cpu_threads=$(nproc)
            cpu_freq=$(grep "cpu MHz" /proc/cpuinfo | head -1 | cut -d':' -f2 | xargs)
            ;;
        "macos")
            cpu_model=$(sysctl -n machdep.cpu.brand_string)
            cpu_cores=$(sysctl -n hw.physicalcpu)
            cpu_threads=$(sysctl -n hw.logicalcpu)
            cpu_freq=$(sysctl -n hw.cpufrequency_max 2>/dev/null | awk '{print $1/1000000}')
            ;;
        "windows")
            cpu_model=$(wmic cpu get name /value | grep "Name" | cut -d'=' -f2)
            cpu_cores=$(wmic cpu get NumberOfCores /value | grep "NumberOfCores" | cut -d'=' -f2)
            cpu_threads=$(wmic cpu get NumberOfLogicalProcessors /value | grep "NumberOfLogicalProcessors" | cut -d'=' -f2)
            ;;
    esac
    
    # Core sayısı kontrolü
    if [ $cpu_cores -ge $RECOMMENDED_CPU_CORES ]; then
        record_test_result "CPU Cores" "PASS" "$cpu_cores cores (Önerilen: $RECOMMENDED_CPU_CORES+)" "$cpu_model"
    elif [ $cpu_cores -ge $MIN_CPU_CORES ]; then
        record_test_result "CPU Cores" "WARN" "$cpu_cores cores (Minimum: $MIN_CPU_CORES, Önerilen: $RECOMMENDED_CPU_CORES)" "$cpu_model"
    else
        record_test_result "CPU Cores" "FAIL" "$cpu_cores cores yetersiz (Minimum: $MIN_CPU_CORES gerekli)" "$cpu_model"
    fi
    
    # CPU modelini kaydet
    record_test_result "CPU Model" "PASS" "$cpu_model" "Cores: $cpu_cores, Threads: $cpu_threads"
}

# RAM kontrolü
check_memory() {
    local total_ram_gb=0
    local available_ram_gb=0
    local used_ram_gb=0
    
    case $PLATFORM in
        "linux")
            local total_kb=$(grep MemTotal /proc/meminfo | awk '{print $2}')
            local available_kb=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
            local used_kb=$((total_kb - available_kb))
            
            total_ram_gb=$((total_kb / 1024 / 1024))
            available_ram_gb=$((available_kb / 1024 / 1024))
            used_ram_gb=$((used_kb / 1024 / 1024))
            ;;
        "macos")
            local total_bytes=$(sysctl -n hw.memsize)
            total_ram_gb=$((total_bytes / 1024 / 1024 / 1024))
            
            # macOS'ta available memory hesaplama
            local vm_stat=$(vm_stat)
            local free_pages=$(echo "$vm_stat" | grep "Pages free" | awk '{print $3}' | tr -d '.')
            local inactive_pages=$(echo "$vm_stat" | grep "Pages inactive" | awk '{print $3}' | tr -d '.')
            local page_size=$(vm_stat | grep "page size" | awk '{print $8}')
            
            available_ram_gb=$(((free_pages + inactive_pages) * page_size / 1024 / 1024 / 1024))
            used_ram_gb=$((total_ram_gb - available_ram_gb))
            ;;
        "windows")
            local total_mb=$(wmic computersystem get TotalPhysicalMemory /value | grep "TotalPhysicalMemory" | cut -d'=' -f2)
            total_ram_gb=$((total_mb / 1024 / 1024 / 1024))
            
            # Windows'ta available memory
            local available_mb=$(wmic OS get FreePhysicalMemory /value | grep "FreePhysicalMemory" | cut -d'=' -f2)
            available_ram_gb=$((available_mb / 1024 / 1024))
            used_ram_gb=$((total_ram_gb - available_ram_gb))
            ;;
    esac
    
    # RAM kontrolü
    if [ $total_ram_gb -ge $RECOMMENDED_RAM_GB ]; then
        record_test_result "Total RAM" "PASS" "${total_ram_gb}GB (Önerilen: ${RECOMMENDED_RAM_GB}GB+)" "Available: ${available_ram_gb}GB, Used: ${used_ram_gb}GB"
    elif [ $total_ram_gb -ge $MIN_RAM_GB ]; then
        record_test_result "Total RAM" "WARN" "${total_ram_gb}GB (Minimum: ${MIN_RAM_GB}GB, Önerilen: ${RECOMMENDED_RAM_GB}GB)" "Available: ${available_ram_gb}GB, Used: ${used_ram_gb}GB"
    else
        record_test_result "Total RAM" "FAIL" "${total_ram_gb}GB yetersiz (Minimum: ${MIN_RAM_GB}GB gerekli)" "Available: ${available_ram_gb}GB, Used: ${used_ram_gb}GB"
    fi
    
    # Kullanılabilir RAM kontrolü
    if [ $available_ram_gb -ge 2 ]; then
        record_test_result "Available RAM" "PASS" "${available_ram_gb}GB kullanılabilir" "Total: ${total_ram_gb}GB"
    elif [ $available_ram_gb -ge 1 ]; then
        record_test_result "Available RAM" "WARN" "${available_ram_gb}GB kullanılabilir (Az)" "Total: ${total_ram_gb}GB"
    else
        record_test_result "Available RAM" "FAIL" "${available_ram_gb}GB kullanılabilir (Yetersiz)" "Total: ${total_ram_gb}GB"
    fi
}

# Disk alanı kontrolü
check_disk_space() {
    local total_disk_gb=0
    local available_disk_gb=0
    local used_disk_gb=0
    local disk_usage_percent=0
    
    case $PLATFORM in
        "linux"|"macos")
            local df_output=$(df -h "$HOME" | tail -1)
            total_disk_gb=$(echo "$df_output" | awk '{print $2}' | sed 's/G//')
            available_disk_gb=$(echo "$df_output" | awk '{print $4}' | sed 's/G//')
            used_disk_gb=$(echo "$df_output" | awk '{print $3}' | sed 's/G//')
            disk_usage_percent=$(echo "$df_output" | awk '{print $5}' | sed 's/%//')
            ;;
        "windows")
            local drive_info=$(wmic logicaldisk where "DeviceID='C:'" get Size,FreeSpace /value)
            local total_bytes=$(echo "$drive_info" | grep "Size" | cut -d'=' -f2 | tr -d '\r')
            local free_bytes=$(echo "$drive_info" | grep "FreeSpace" | cut -d'=' -f2 | tr -d '\r')
            
            total_disk_gb=$((total_bytes / 1024 / 1024 / 1024))
            available_disk_gb=$((free_bytes / 1024 / 1024 / 1024))
            used_disk_gb=$((total_disk_gb - available_disk_gb))
            disk_usage_percent=$(((used_disk_gb * 100) / total_disk_gb))
            ;;
    esac
    
    # Disk alanı kontrolü
    if [ $available_disk_gb -ge $RECOMMENDED_DISK_GB ]; then
        record_test_result "Disk Space" "PASS" "${available_disk_gb}GB kullanılabilir (Önerilen: ${RECOMMENDED_DISK_GB}GB+)" "Total: ${total_disk_gb}GB, Used: ${disk_usage_percent}%"
    elif [ $available_disk_gb -ge $MIN_DISK_GB ]; then
        record_test_result "Disk Space" "WARN" "${available_disk_gb}GB kullanılabilir (Minimum: ${MIN_DISK_GB}GB, Önerilen: ${RECOMMENDED_DISK_GB}GB)" "Total: ${total_disk_gb}GB, Used: ${disk_usage_percent}%"
    else
        record_test_result "Disk Space" "FAIL" "${available_disk_gb}GB kullanılabilir yetersiz (Minimum: ${MIN_DISK_GB}GB gerekli)" "Total: ${total_disk_gb}GB, Used: ${disk_usage_percent}%"
    fi
    
    # Disk kullanım yüzdesi kontrolü
    if [ $disk_usage_percent -le 80 ]; then
        record_test_result "Disk Usage" "PASS" "%${disk_usage_percent} kullanımda" "Available: ${available_disk_gb}GB"
    elif [ $disk_usage_percent -le 90 ]; then
        record_test_result "Disk Usage" "WARN" "%${disk_usage_percent} kullanımda (Yüksek)" "Available: ${available_disk_gb}GB"
    else
        record_test_result "Disk Usage" "FAIL" "%${disk_usage_percent} kullanımda (Kritik)" "Available: ${available_disk_gb}GB"
    fi
}

# Ağ bağlantısı kontrolü
check_network() {
    local internet_connection=false
    local dns_resolution=false
    local download_speed=""
    
    # İnternet bağlantısı kontrolü
    if ping -c 1 8.8.8.8 &> /dev/null; then
        internet_connection=true
        record_test_result "Internet Connection" "PASS" "İnternet bağlantısı aktif" "Google DNS erişilebilir"
    else
        record_test_result "Internet Connection" "FAIL" "İnternet bağlantısı yok" "Google DNS erişilemiyor"
    fi
    
    # DNS çözümleme kontrolü
    if nslookup google.com &> /dev/null; then
        dns_resolution=true
        record_test_result "DNS Resolution" "PASS" "DNS çözümleme çalışıyor" "google.com çözümlenebilir"
    else
        record_test_result "DNS Resolution" "FAIL" "DNS çözümleme başarısız" "google.com çözümlenemiyor"
    fi
    
    # Hız testi (basit)
    if $internet_connection; then
        local speed_test_start=$(date +%s%3N)
        curl -s -o /dev/null "http://speedtest.tele2.net/1MB.zip" --max-time 10
        local speed_test_end=$(date +%s%3N)
        local duration=$((speed_test_end - speed_test_start))
        
        if [ $duration -gt 0 ]; then
            local speed_mbps=$((8000 / duration))  # 1MB = 8Mb, duration in ms
            if [ $speed_mbps -gt 10 ]; then
                record_test_result "Download Speed" "PASS" "~${speed_mbps}Mbps (İyi)" "1MB test dosyası ${duration}ms'de indirildi"
            elif [ $speed_mbps -gt 1 ]; then
                record_test_result "Download Speed" "WARN" "~${speed_mbps}Mbps (Yavaş)" "1MB test dosyası ${duration}ms'de indirildi"
            else
                record_test_result "Download Speed" "FAIL" "~${speed_mbps}Mbps (Çok yavaş)" "1MB test dosyası ${duration}ms'de indirildi"
            fi
        fi
    fi
}

# Yazılım bağımlılıkları kontrolü
check_software_dependencies() {
    local required_software=("curl" "git" "python3" "node" "npm")
    local optional_software=("docker" "code" "pip" "pip3")
    
    # Gerekli yazılımlar
    for software in "${required_software[@]}"; do
        if command -v "$software" &> /dev/null; then
            local version=""
            case $software in
                "python3") version=$(python3 --version 2>&1 | cut -d' ' -f2) ;;
                "node") version=$(node --version | cut -d'v' -f2) ;;
                "npm") version=$(npm --version) ;;
                "git") version=$(git --version | cut -d' ' -f3) ;;
                "curl") version=$(curl --version | head -1 | cut -d' ' -f2) ;;
            esac
            record_test_result "Required: $software" "PASS" "Kurulu (v$version)" "$(which $software)"
        else
            record_test_result "Required: $software" "FAIL" "Kurulu değil (Gerekli)" "Kurulum gerekli"
        fi
    done
    
    # Opsiyonel yazılımlar
    for software in "${optional_software[@]}"; do
        if command -v "$software" &> /dev/null; then
            local version=""
            case $software in
                "docker") version=$(docker --version | cut -d' ' -f3 | tr -d ',') ;;
                "code") version=$(code --version | head -1) ;;
                "pip"|"pip3") version=$($software --version | cut -d' ' -f2) ;;
            esac
            record_test_result "Optional: $software" "PASS" "Kurulu (v$version)" "$(which $software)"
        else
            record_test_result "Optional: $software" "WARN" "Kurulu değil (Opsiyonel)" "Kurulması önerilen"
        fi
    done
}

# Port kullanılabilirlik kontrolü
check_port_availability() {
    local required_ports=(8000 8080 3000)
    local optional_ports=(8081 8082 5432 6379)
    
    # Gerekli portlar
    for port in "${required_ports[@]}"; do
        if command -v lsof &> /dev/null; then
            if lsof -i:$port &> /dev/null; then
                local process=$(lsof -i:$port | tail -1 | awk '{print $1}')
                record_test_result "Required Port: $port" "WARN" "Kullanımda ($process tarafından)" "Port çakışması olabilir"
            else
                record_test_result "Required Port: $port" "PASS" "Kullanılabilir" "Port boş"
            fi
        elif command -v netstat &> /dev/null; then
            if netstat -ln | grep ":$port " &> /dev/null; then
                record_test_result "Required Port: $port" "WARN" "Kullanımda" "Port çakışması olabilir"
            else
                record_test_result "Required Port: $port" "PASS" "Kullanılabilir" "Port boş"
            fi
        else
            record_test_result "Required Port: $port" "WARN" "Kontrol edilemedi" "lsof veya netstat bulunamadı"
        fi
    done
}

# Güvenlik kontrolü
check_security() {
    local firewall_status="unknown"
    local antivirus_status="unknown"
    local selinux_status="disabled"
    
    case $PLATFORM in
        "linux")
            # Firewall kontrolü
            if command -v ufw &> /dev/null; then
                if ufw status | grep -q "Status: active"; then
                    firewall_status="active"
                else
                    firewall_status="inactive"
                fi
            elif command -v firewalld &> /dev/null; then
                if systemctl is-active --quiet firewalld; then
                    firewall_status="active"
                else
                    firewall_status="inactive"
                fi
            fi
            
            # SELinux kontrolü
            if command -v getenforce &> /dev/null; then
                selinux_status=$(getenforce | tr '[:upper:]' '[:lower:]')
            fi
            ;;
        "macos")
            # macOS Firewall
            if sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate | grep -q "enabled"; then
                firewall_status="active"
            else
                firewall_status="inactive"
            fi
            ;;
        "windows")
            # Windows Firewall
            local fw_status=$(netsh advfirewall show allprofiles state | grep "State" | head -1)
            if echo "$fw_status" | grep -q "ON"; then
                firewall_status="active"
            else
                firewall_status="inactive"
            fi
            ;;
    esac
    
    # Firewall durumu
    case $firewall_status in
        "active")
            record_test_result "Firewall" "PASS" "Aktif" "Güvenlik duvarı çalışıyor"
            ;;
        "inactive")
            record_test_result "Firewall" "WARN" "İnaktif" "Güvenlik duvarı kapalı"
            ;;
        *)
            record_test_result "Firewall" "WARN" "Bilinmiyor" "Durum tespit edilemedi"
            ;;
    esac
    
    # SELinux durumu (Linux için)
    if [ "$PLATFORM" = "linux" ]; then
        case $selinux_status in
            "enforcing")
                record_test_result "SELinux" "PASS" "Enforcing" "SELinux aktif ve zorlayıcı"
                ;;
            "permissive")
                record_test_result "SELinux" "WARN" "Permissive" "SELinux aktif ama uyarı modu"
                ;;
            "disabled")
                record_test_result "SELinux" "WARN" "Disabled" "SELinux devre dışı"
                ;;
        esac
    fi
}

# Performans testi
check_performance() {
    log "${BLUE}🚀 Performans testi yapılıyor...${NC}"
    
    # CPU performans testi (basit)
    local cpu_test_start=$(date +%s%3N)
    echo "scale=5000; 4*a(1)" | bc -l &> /dev/null || true
    local cpu_test_end=$(date +%s%3N)
    local cpu_duration=$((cpu_test_end - cpu_test_start))
    
    if [ $cpu_duration -lt 1000 ]; then
        record_test_result "CPU Performance" "PASS" "Hızlı (${cpu_duration}ms)" "π hesaplama testi"
    elif [ $cpu_duration -lt 5000 ]; then
        record_test_result "CPU Performance" "WARN" "Orta (${cpu_duration}ms)" "π hesaplama testi"
    else
        record_test_result "CPU Performance" "FAIL" "Yavaş (${cpu_duration}ms)" "π hesaplama testi"
    fi
    
    # Disk I/O testi
    local io_test_start=$(date +%s%3N)
    dd if=/dev/zero of="$PROJECT_DIR/.temp_io_test" bs=1M count=10 2>/dev/null || true
    local io_test_end=$(date +%s%3N)
    rm -f "$PROJECT_DIR/.temp_io_test"
    local io_duration=$((io_test_end - io_test_start))
    
    if [ $io_duration -lt 1000 ]; then
        record_test_result "Disk I/O Performance" "PASS" "Hızlı (${io_duration}ms)" "10MB yazma testi"
    elif [ $io_duration -lt 5000 ]; then
        record_test_result "Disk I/O Performance" "WARN" "Orta (${io_duration}ms)" "10MB yazma testi"
    else
        record_test_result "Disk I/O Performance" "FAIL" "Yavaş (${io_duration}ms)" "10MB yazma testi"
    fi
}

# GPU kontrolü (opsiyonel)
check_gpu() {
    local gpu_info=""
    local gpu_memory=""
    
    case $PLATFORM in
        "linux")
            if command -v nvidia-smi &> /dev/null; then
                gpu_info=$(nvidia-smi --query-gpu=name --format=csv,noheader,nounits | head -1)
                gpu_memory=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -1)
                record_test_result "NVIDIA GPU" "PASS" "$gpu_info (${gpu_memory}MB VRAM)" "nvidia-smi mevcut"
            elif lspci | grep -i vga &> /dev/null; then
                gpu_info=$(lspci | grep -i vga | head -1 | cut -d':' -f3)
                record_test_result "GPU" "WARN" "$gpu_info" "NVIDIA CUDA bulunamadı"
            else
                record_test_result "GPU" "WARN" "GPU bulunamadı" "lspci bilgisi yok"
            fi
            ;;
        "macos")
            if system_profiler SPDisplaysDataType | grep -q "Metal"; then
                gpu_info=$(system_profiler SPDisplaysDataType | grep "Chipset Model" | head -1 | cut -d':' -f2 | xargs)
                record_test_result "GPU" "PASS" "$gpu_info" "Metal desteği mevcut"
            else
                record_test_result "GPU" "WARN" "GPU bilgisi alınamadı" "System profiler hatası"
            fi
            ;;
        "windows")
            if command -v wmic &> /dev/null; then
                gpu_info=$(wmic path win32_VideoController get name /value | grep "Name" | cut -d'=' -f2 | head -1)
                record_test_result "GPU" "PASS" "$gpu_info" "Windows GPU tespit edildi"
            else
                record_test_result "GPU" "WARN" "GPU bilgisi alınamadı" "wmic bulunamadı"
            fi
            ;;
    esac
}

# Locales ve karakter kodlaması kontrolü
check_locale() {
    local current_locale=$(locale | grep "LANG=" | cut -d'=' -f2)
    local utf8_support=false
    
    if echo "$current_locale" | grep -qi "utf"; then
        utf8_support=true
        record_test_result "UTF-8 Support" "PASS" "UTF-8 destekleniyor ($current_locale)" "Unicode karakterler desteklenir"
    else
        record_test_result "UTF-8 Support" "WARN" "UTF-8 desteği belirsiz ($current_locale)" "Türkçe karakter sorunu olabilir"
    fi
    
    # Timezone kontrolü
    local timezone=""
    case $PLATFORM in
        "linux"|"macos")
            timezone=$(date +%Z)
            ;;
        "windows")
            timezone=$(date /t)
            ;;
    esac
    
    record_test_result "Timezone" "PASS" "$timezone" "Sistem saat dilimi"
}

# Rapor oluştur
generate_report() {
    log "${BLUE}📊 Sistem raporu oluşturuluyor...${NC}"
    
    # JSON rapor başlangıcı
    cat > "$REPORT_FILE" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "platform": "$PLATFORM",
  "distro": "$DISTRO",
  "version": "$DISTRO_VERSION",
  "architecture": "$ARCH",
  "summary": {
    "total_tests": $TOTAL_TESTS,
    "passed": $PASSED_TESTS,
    "failed": $FAILED_TESTS,
    "warnings": $WARNING_TESTS,
    "score": $((PASSED_TESTS * 100 / TOTAL_TESTS))
  },
  "tests": {
EOF
    
    # Test sonuçlarını ekle
    cat "$REPORT_FILE.tmp" >> "$REPORT_FILE" 2>/dev/null || true
    
    # JSON rapor bitişi (son virgülü kaldır ve kapat)
    sed -i '$ s/,$//' "$REPORT_FILE" 2>/dev/null || sed -i '' '$ s/,$//' "$REPORT_FILE" 2>/dev/null || true
    
    cat >> "$REPORT_FILE" << EOF
  },
  "recommendations": [
EOF
    
    # Öneriler ekle
    if [ $FAILED_TESTS -gt 0 ]; then
        echo "    \"Başarısız testler var, sistem gereksinimlerini kontrol edin\"," >> "$REPORT_FILE"
    fi
    
    if [ $WARNING_TESTS -gt 0 ]; then
        echo "    \"Uyarılar var, performans sorunları yaşayabilirsiniz\"," >> "$REPORT_FILE"
    fi
    
    echo "    \"Kurulum öncesi tüm gereksinimleri karşıladığınızdan emin olun\"" >> "$REPORT_FILE"
    
    cat >> "$REPORT_FILE" << EOF
  ]
}
EOF
    
    # Geçici dosyayı temizle
    rm -f "$REPORT_FILE.tmp"
    
    log "${GREEN}✅ Rapor oluşturuldu: $REPORT_FILE${NC}"
}

# Özet göster
show_summary() {
    local score=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║                📊 SİSTEM UYUMLULUK RAPORU               ║"
    echo "╠══════════════════════════════════════════════════════════╣"
    echo "║                                                          ║"
    printf "║  🖥️  Platform: %-40s    ║\n" "$PLATFORM ($DISTRO $DISTRO_VERSION)"
    printf "║  🏗️  Mimari: %-43s    ║\n" "$ARCH"
    echo "║                                                          ║"
    printf "║  📊 Test Sonuçları:                                     ║\n"
    printf "║     ✅ Başarılı: %-35d    ║\n" "$PASSED_TESTS"
    printf "║     ❌ Başarısız: %-34d    ║\n" "$FAILED_TESTS"
    printf "║     ⚠️  Uyarı: %-37d    ║\n" "$WARNING_TESTS"
    printf "║     📈 Toplam Skor: %%%d%-28s    ║\n" "$score" ""
    echo "║                                                          ║"
    
    if [ $score -ge 90 ]; then
        echo "║  🎉 SİSTEMİNİZ LOCODEX İÇİN HAZIR!                     ║"
        echo "║     Tüm gereksinimler karşılanıyor                     ║"
    elif [ $score -ge 70 ]; then
        echo "║  ⚠️  SİSTEMİNİZ ÇOĞUNLUKLA UYUMLU                      ║"
        echo "║     Bazı uyarılar var, kurulum yapılabilir             ║"
    else
        echo "║  ❌ SİSTEMİNİZ GEREKSİNİMLERİ KARŞILAMIYOR             ║"
        echo "║     Kurulum öncesi sorunları çözün                     ║"
    fi
    
    echo "║                                                          ║"
    printf "║  📄 Detaylı rapor: %-29s    ║\n" "$(basename "$REPORT_FILE")"
    printf "║  📝 Log dosyası: %-31s    ║\n" "$(basename "$LOG_FILE")"
    echo "║                                                          ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Ana fonksiyon
main() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║            🔍 LocoDex Sistem Gereksinimleri             ║"
    echo "║              Kapsamlı Uyumluluk Kontrolü                ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    # Log dizini oluştur
    mkdir -p "$PROJECT_DIR/logs"
    
    # Rapor dosyasını başlat
    echo "" > "$REPORT_FILE.tmp"
    
    log "${BLUE}🔍 Sistem kontrolü başlatılıyor...${NC}"
    
    # Tüm kontrolleri çalıştır
    detect_platform
    check_cpu
    check_memory
    check_disk_space
    check_network
    check_software_dependencies
    check_port_availability
    check_security
    check_performance
    check_gpu
    check_locale
    
    # Rapor oluştur ve özet göster
    generate_report
    show_summary
    
    # Çıkış kodu belirle
    if [ $FAILED_TESTS -eq 0 ]; then
        log "${GREEN}🎉 Sistem kontrolü başarıyla tamamlandı!${NC}"
        exit 0
    else
        log "${RED}❌ Sistem kontrolünde sorunlar tespit edildi!${NC}"
        exit 1
    fi
}

# Script çalıştırıldığında ana fonksiyonu başlat
main "$@"