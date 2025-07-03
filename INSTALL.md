# LocoDex Kurulum Kılavuzu

Bu kılavuz, LocoDex platformunun adım adım kurulumunu açıklar.

## 📋 Ön Gereksinimler

### Sistem Gereksinimleri
- **RAM**: Minimum 8GB, Önerilen 16GB+
- **Disk**: Minimum 10GB boş alan
- **CPU**: 4 çekirdek önerilen (Apple Silicon M1/M2 desteklenir)
- **İşletim Sistemi**: macOS 10.15+ (Catalina ve üzeri)

### Gerekli Yazılımlar

#### 1. Docker Desktop Kurulumu

**macOS için:**
1. [Docker Desktop for Mac](https://desktop.docker.com/mac/main/amd64/Docker.dmg) indirin
   - Apple Silicon (M1/M2) için: ARM64 versiyonunu seçin
   - Intel Mac için: AMD64 versiyonunu seçin
2. DMG dosyasını açın ve Docker'ı Applications klasörüne sürükleyin
3. Docker Desktop'ı başlatın
4. İlk açılışta gerekli izinleri verin

**Docker kurulumunu doğrulayın:**
```bash
docker --version
docker-compose --version
```

#### 2. Git Kurulumu

**macOS için:**
```bash
# Homebrew ile (önerilen)
brew install git

# Veya Xcode Command Line Tools ile
xcode-select --install
```

#### 3. Node.js Kurulumu (Geliştirme için opsiyonel)

**macOS için:**
```bash
# Homebrew ile
brew install node

# Veya resmi installer ile
# https://nodejs.org/ adresinden LTS versiyonunu indirin
```

**Kurulumu doğrulayın:**
```bash
node --version
npm --version
```

## 🚀 LocoDex Kurulumu

### Adım 1: Projeyi İndirin

```bash
# GitHub'dan klonlayın
git clone https://github.com/your-username/LocoDex.git
cd LocoDex

# Veya ZIP olarak indirin
# https://github.com/your-username/LocoDex/archive/main.zip
```

### Adım 2: Ortam Yapılandırması

```bash
# Ortam değişkenlerini kopyalayın
cp .env.example .env

# Gerekirse düzenleyin
nano .env  # Linux/macOS
notepad .env  # Windows
```

**Önemli ortam değişkenleri:**
```env
# Model sağlayıcı adresleri
OLLAMA_HOST=host.docker.internal:11434
LMSTUDIO_HOST=host.docker.internal:1234

# Güvenlik ayarları
EXECUTION_TIMEOUT=30
MAX_MEMORY=512m
MAX_CPU=0.5

# Port yapılandırması
API_PORT=3001
SANDBOX_PORT=3002
GATEWAY_PORT=8080
```

### Adım 3: Docker Kurulumunu Çalıştırın

```bash
# Kurulum scriptini çalıştırın
chmod +x scripts/docker-setup.sh
./scripts/docker-setup.sh setup
```

Bu komut:
- Gerekli dizinleri oluşturur
- SSL sertifikaları üretir
- Docker imajlarını build eder
- Yapılandırma dosyalarını hazırlar

### Adım 4: Servisleri Başlatın

```bash
# Temel servisleri başlat
./scripts/docker-setup.sh start

# Veya monitoring ile birlikte
./scripts/docker-setup.sh start-monitoring
```

### Adım 5: Kurulumu Doğrulayın

```bash
# Servis durumunu kontrol edin
./scripts/docker-setup.sh status

# Sağlık kontrolü
./scripts/docker-setup.sh health

# Hızlı entegrasyon testi
./scripts/test-integration.sh quick
```

## 🤖 Model Sağlayıcıları Kurulumu

### LM Studio Kurulumu

#### 1. LM Studio İndirin
- [LM Studio](https://lmstudio.ai/) resmi sitesinden indirin
- İşletim sisteminize uygun versiyonu seçin

#### 2. LM Studio'yu Yapılandırın
1. LM Studio'yu başlatın
2. **Settings** > **Server** sekmesine gidin
3. **Port**: 1234 (varsayılan)
4. **CORS**: Enable
5. **Server**'ı başlatın

#### 3. Model İndirin
1. **Discover** sekmesinden model seçin
2. Model'i indirin (örn: Llama 2, Code Llama)
3. **Chat** sekmesinde modeli yükleyin

### Ollama Kurulumu

#### 1. Ollama İndirin
```bash
# Linux/macOS
curl -fsSL https://ollama.ai/install.sh | sh

# Windows
# https://ollama.ai/download/windows adresinden indirin
```

#### 2. Model İndirin
```bash
# Popüler modeller
ollama pull llama2
ollama pull codellama
ollama pull mistral

# Model listesi
ollama list
```

#### 3. Ollama Servisini Başlatın
```bash
# Servis olarak başlat
ollama serve

# Veya daemon olarak
systemctl start ollama  # Linux
brew services start ollama  # macOS
```

## 🔧 Gelişmiş Yapılandırma

### Monitoring Kurulumu

```bash
# Prometheus ve Grafana ile başlat
./scripts/docker-setup.sh start-monitoring

# Erişim adresleri:
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3000 (admin/admin)
```

### SSL/HTTPS Yapılandırması

```bash
# Kendi sertifikalarınızı kullanın
cp your-cert.pem docker/nginx/ssl/cert.pem
cp your-key.pem docker/nginx/ssl/key.pem

# Nginx'i yeniden başlatın
docker-compose restart api-gateway
```

### Özel Domain Yapılandırması

1. DNS kayıtlarını güncelleyin
2. Nginx yapılandırmasını düzenleyin:
```nginx
server_name your-domain.com;
```
3. SSL sertifikalarını güncelleyin
4. Servisleri yeniden başlatın

### Resource Limits Ayarlama

```yaml
# docker-compose.yml içinde
services:
  ai-agent:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '0.5'
          memory: 1G
```

## 🔍 Sorun Giderme

### Docker Sorunları

#### Docker Daemon Çalışmıyor
```bash
# Docker durumunu kontrol et
docker info

# Docker'ı başlat
sudo systemctl start docker  # Linux
# Docker Desktop'ı başlat  # Windows/macOS
```

#### Port Çakışması
```bash
# Kullanılan portları kontrol et
netstat -tulpn | grep :8080

# Farklı port kullan
export GATEWAY_PORT=8081
./scripts/docker-setup.sh restart
```

#### Disk Alanı Yetersiz
```bash
# Docker temizliği
docker system prune -a

# Kullanılmayan volume'ları temizle
docker volume prune

# Kullanılmayan imajları sil
docker image prune -a
```

### Model Sağlayıcı Sorunları

#### LM Studio Bağlantı Hatası
1. LM Studio'nun çalıştığını kontrol edin
2. Server'ın başlatıldığını doğrulayın
3. CORS'un aktif olduğunu kontrol edin
4. Port 1234'ün açık olduğunu doğrulayın

```bash
# Bağlantı testi
curl http://localhost:1234/v1/models
```

#### Ollama Bağlantı Hatası
```bash
# Ollama servis durumu
ollama list

# Servis yeniden başlat
ollama serve

# Port kontrolü
netstat -tulpn | grep :11434
```

### Performance Sorunları

#### Yavaş Yanıt Süreleri
1. Resource limitlerini artırın
2. Model boyutunu küçültün
3. Timeout değerlerini ayarlayın

```env
# .env dosyasında
EXECUTION_TIMEOUT=60
MAX_MEMORY=1g
MAX_CPU=1.0
```

#### Memory Kullanımı Yüksek
```bash
# Container resource kullanımı
docker stats

# Memory limitlerini ayarla
docker-compose down
# docker-compose.yml'de memory limitlerini düzenle
docker-compose up -d
```

### Network Sorunları

#### Container Arası İletişim
```bash
# Network kontrolü
docker network ls
docker network inspect locodex-network

# Container IP'lerini kontrol et
docker inspect locodex-ai-agent | grep IPAddress
```

#### External API Erişimi
```bash
# DNS çözümleme
docker exec locodex-ai-agent nslookup google.com

# Internet bağlantısı
docker exec locodex-ai-agent curl -I https://google.com
```

## 📊 Performans Optimizasyonu

### Docker Optimizasyonu

```bash
# Docker daemon ayarları
sudo nano /etc/docker/daemon.json
```

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 64000,
      "Soft": 64000
    }
  }
}
```

### Resource Monitoring

```bash
# Sistem kaynaklarını izle
htop
docker stats

# Disk kullanımı
df -h
docker system df
```

### Cache Optimizasyonu

```bash
# Redis cache ayarları
docker exec locodex-redis redis-cli CONFIG GET maxmemory
docker exec locodex-redis redis-cli CONFIG SET maxmemory 256mb
```

## 🔄 Güncelleme

### LocoDex Güncellemesi

```bash
# Yeni versiyonu çek
git pull origin main

# Servisleri durdur
./scripts/docker-setup.sh stop

# Yeniden build et
./scripts/docker-setup.sh build

# Başlat
./scripts/docker-setup.sh start
```

### Docker İmaj Güncellemesi

```bash
# Base imajları güncelle
docker-compose pull

# Yeniden build et
docker-compose build --no-cache

# Başlat
docker-compose up -d
```

## 🔒 Güvenlik Yapılandırması

### Firewall Ayarları

```bash
# Ubuntu UFW
sudo ufw allow 8080/tcp
sudo ufw allow 3001/tcp
sudo ufw allow 3002/tcp

# CentOS/RHEL firewalld
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --reload
```

### SSL Sertifika Yenileme

```bash
# Let's Encrypt ile
certbot certonly --standalone -d your-domain.com

# Sertifikaları kopyala
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem docker/nginx/ssl/cert.pem
cp /etc/letsencrypt/live/your-domain.com/privkey.pem docker/nginx/ssl/key.pem

# Nginx yeniden başlat
docker-compose restart api-gateway
```

### Backup Yapılandırması

```bash
# Otomatik backup scripti
cat > scripts/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/locodex_$DATE"

mkdir -p $BACKUP_DIR

# Data backup
docker run --rm -v locodex_redis-data:/data -v $BACKUP_DIR:/backup alpine tar czf /backup/redis-data.tar.gz -C /data .

# Config backup
cp -r docker/ $BACKUP_DIR/
cp .env $BACKUP_DIR/

echo "Backup completed: $BACKUP_DIR"
EOF

chmod +x scripts/backup.sh
```

## 📞 Destek

Kurulum sırasında sorun yaşarsanız:

1. **Logları kontrol edin**: `docker-compose logs`
2. **GitHub Issues**: [Sorun bildirin](https://github.com/your-username/LocoDex/issues)
3. **Dokümantasyon**: [README.md](README.md) dosyasını inceleyin
4. **Test çalıştırın**: `./scripts/test-integration.sh`

---

Bu kılavuz LocoDex'in başarılı kurulumu için gerekli tüm adımları içerir. Herhangi bir sorunla karşılaştığınızda lütfen GitHub Issues üzerinden bildirin.

