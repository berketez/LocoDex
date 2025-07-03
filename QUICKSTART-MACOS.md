# LocoDex macOS Hızlı Başlangıç Kılavuzu

Bu kılavuz, macOS kullanıcıları için LocoDex'i hızlıca kurmanızı sağlar.

## 🍎 macOS Gereksinimleri

- **macOS**: 10.15+ (Catalina ve üzeri)
- **RAM**: Minimum 8GB
- **Disk**: 10GB boş alan
- **CPU**: Apple Silicon (M1/M2) veya Intel desteklenir

## ⚡ 5 Dakikada Kurulum

### 1. Homebrew Kurulumu (yoksa)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. Gerekli Araçları Kurun
```bash
# Docker Desktop
brew install --cask docker

# Git (genelde zaten yüklü)
brew install git

# Node.js (opsiyonel, geliştirme için)
brew install node
```

### 3. Docker Desktop'ı Başlatın
1. Applications klasöründen Docker'ı açın
2. İlk açılışta gerekli izinleri verin
3. Docker'ın başladığını bekleyin (üst menü çubuğunda Docker ikonu)

### 4. LocoDex'i İndirin ve Kurun
```bash
# Projeyi klonlayın
git clone https://github.com/your-username/LocoDex.git
cd LocoDex

# Kurulum scriptini çalıştırın
chmod +x scripts/docker-setup.sh
./scripts/docker-setup.sh setup

# Servisleri başlatın
./scripts/docker-setup.sh start
```

### 5. Tarayıcıda Açın
http://localhost:8080 adresine gidin

## 🤖 AI Model Kurulumu

### LM Studio (Önerilen)
1. [LM Studio](https://lmstudio.ai/) indirin
2. Uygulamayı açın
3. Bir model indirin (örn: Llama 2)
4. **Local Server** sekmesinde serveri başlatın

### Ollama (Alternatif)
```bash
# Ollama'yı kurun
brew install ollama

# Model indirin
ollama pull llama2

# Servisi başlatın
ollama serve
```

## 🔧 macOS Özel Ayarlar

### Apple Silicon (M1/M2) Optimizasyonu
```bash
# Docker'da ARM64 imajlarını kullan
export DOCKER_DEFAULT_PLATFORM=linux/arm64

# Rosetta 2 gerekirse
softwareupdate --install-rosetta
```

### Güvenlik İzinleri
macOS Gatekeeper nedeniyle bazı izinler gerekebilir:

1. **System Preferences** > **Security & Privacy**
2. **Privacy** sekmesi > **Full Disk Access**
3. Docker Desktop'a izin verin

### Port Yapılandırması
macOS'ta bazı portlar sistem tarafından kullanılabilir:

```bash
# Kullanılan portları kontrol edin
sudo lsof -i :8080
sudo lsof -i :3001
sudo lsof -i :3002

# Gerekirse farklı portlar kullanın
export GATEWAY_PORT=8081
```

## 🚨 Yaygın macOS Sorunları

### Docker Desktop Başlamıyor
```bash
# Docker'ı yeniden başlatın
killall Docker && open /Applications/Docker.app

# Veya terminal'den
sudo launchctl stop com.docker.docker
sudo launchctl start com.docker.docker
```

### Disk Alanı Yetersiz
```bash
# Docker temizliği
docker system prune -a

# Homebrew cache temizliği
brew cleanup

# macOS cache temizliği
sudo rm -rf ~/Library/Caches/*
```

### Permission Denied Hataları
```bash
# Docker grubuna kullanıcı ekle (genelde gerekli değil)
sudo dscl . -append /Groups/docker GroupMembership $(whoami)

# Script izinlerini düzelt
chmod +x scripts/*.sh
```

### M1/M2 Uyumluluk Sorunları
```bash
# x86 emülasyonu ile çalıştır
arch -x86_64 docker-compose up

# Veya Rosetta ile
arch -x86_64 zsh
./scripts/docker-setup.sh start
```

## 📊 Performans İpuçları

### Docker Kaynak Ayarları
1. Docker Desktop > **Preferences** > **Resources**
2. **Memory**: 8GB+ ayarlayın
3. **CPU**: 4+ çekirdek ayarlayın
4. **Disk**: 60GB+ ayarlayın

### macOS Optimizasyonu
```bash
# Spotlight indexing'i devre dışı bırak (geçici)
sudo mdutil -a -i off

# Geri açmak için
sudo mdutil -a -i on
```

## 🔄 Güncelleme

```bash
# LocoDex güncellemesi
cd LocoDex
git pull origin main
./scripts/docker-setup.sh restart

# Homebrew güncellemesi
brew update && brew upgrade
```

## 🆘 Yardım

Sorun yaşarsanız:

1. **Logları kontrol edin**:
   ```bash
   ./scripts/docker-setup.sh logs
   ```

2. **Sistem durumunu kontrol edin**:
   ```bash
   ./scripts/docker-setup.sh status
   ```

3. **Test çalıştırın**:
   ```bash
   ./scripts/test-integration.sh quick
   ```

4. **GitHub Issues**: [Sorun bildirin](https://github.com/your-username/LocoDex/issues)

## 🎯 Sonraki Adımlar

1. **Model Seçimi**: LocoDex arayüzünden bir AI modeli seçin
2. **Ortam Ayarları**: Docker/Sandbox ortamını yapılandırın
3. **İlk Sohbet**: AI ile sohbet etmeye başlayın
4. **Kod Çalıştırma**: Sandbox'ta kod çalıştırmayı deneyin

---

**Tebrikler!** LocoDex artık macOS'unuzda çalışıyor 🎉

