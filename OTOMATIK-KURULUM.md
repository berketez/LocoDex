# 🤖 LocoDex Tamamen Otomatik Kurulum

> **Tek tıkla her şey hazır!** Kullanıcı hiçbir şey yapmaz, sistem her şeyi otomatik kurar.

## 🎯 Özellikler

✅ **Tamamen Otonom** - Hiçbir manuel işlem gerektirmez  
✅ **Çoklu Platform** - Linux, macOS, Windows desteği  
✅ **Akıllı Dependency Yönetimi** - Eksik paketleri otomatik kurar  
✅ **Otomatik Derleme** - Paralel build ile hızlı derleme  
✅ **VS Code Extension** - Otomatik kurulum ve yapılandırma  
✅ **Servis Yönetimi** - Autostart ve monitoring  
✅ **Güvenlik Kontrolü** - Sistem güvenliği analizi  
✅ **Performans Optimizasyonu** - En iyi ayarlarla kurulum  

## 🚀 Tek Komutla Kurulum

### Adım 1: İndir ve Çalıştır

```bash
# GitHub'dan indir
curl -fsSL https://raw.githubusercontent.com/company/locodex/main/install.sh -o install.sh

# Çalıştır
chmod +x install.sh && ./install.sh
```

**O KADAR!** 🎉

### Alternatif Kurulum

```bash
# Wget ile
wget https://raw.githubusercontent.com/company/locodex/main/install.sh && chmod +x install.sh && ./install.sh

# Git ile
git clone https://github.com/company/locodex.git && cd locodex && ./install.sh
```

## 📋 Sistem Gereksinimleri

### Minimum
- **RAM**: 4GB
- **Disk**: 5GB boş alan
- **CPU**: 2 çekirdek
- **OS**: Linux/macOS/Windows

### Önerilen
- **RAM**: 8GB+
- **Disk**: 20GB+ boş alan  
- **CPU**: 4+ çekirdek
- **İnternet**: Hızlı bağlantı

## 🔄 Kurulum Süreci

Kurulum otomatik olarak şu adımları gerçekleştirir:

### 1. **Sistem Analizi** (30 saniye)
- Platform tespiti
- Donanım kontrolü
- Gereksinim analizi
- Uyumluluk kontrolü

### 2. **Dependency Kurulumu** (2-5 dakika)
- Package manager kurulumu
- Python, Node.js, Git kurulumu
- Build araçları kurulumu
- Sistem kütüphaneleri

### 3. **Kaynak İndirme** (1-2 dakika)
- GitHub'dan son versiyon
- Bağımlılık indirme
- Cache optimizasyonu

### 4. **Otomatik Derleme** (3-7 dakika)
- Paralel build sistemi
- Frontend + Backend derleme
- Electron app oluşturma
- VS Code extension paketi

### 5. **Yapılandırma** (1 dakika)
- Otomatik ayar oluşturma
- Servis konfigürasyonu
- Güvenlik ayarları
- Autostart kurulumu

### 6. **Doğrulama** (30 saniye)
- Sağlık kontrolü
- Test çalıştırma
- Performans kontrolü

**Toplam Süre**: 8-15 dakika

## 🎮 Kullanım

Kurulum tamamlandıktan sonra:

### Desktop'tan Başlatma
- Desktop'taki **LocoDex** simgesine tıklayın

### Terminal'den Başlatma
```bash
# Ana uygulama
cd ~/LocoDex && ./locodex-start.sh

# Servis yönetimi
~/LocoDex/scripts/service-manager.sh status
```

### VS Code'da Kullanım
- VS Code'u açın
- `Ctrl+Shift+P` → "LocoDex" yazın
- ✅ Extension otomatik yüklü!

## 🌐 Erişim Adresleri

Kurulum sonrası şu adresler aktif olur:

- **🖥️ Desktop App**: Otomatik açılır
- **🌐 Web Interface**: http://localhost:3000
- **🔌 API Server**: http://localhost:8000
- **🔥 VLLM Service**: http://localhost:8080

## 🛠️ Gelişmiş Özellikler

### Akıllı Scriptler

```bash
# Dependency yönetimi
~/LocoDx/scripts/dependency-manager.sh

# Otomatik build
~/LocoDex/scripts/auto-builder.sh watch

# VS Code extension yönetimi
~/LocoDex/scripts/vscode-auto-installer.sh update

# Servis yönetimi
~/LocoDex/scripts/service-manager.sh restart-all

# Sistem kontrolü
~/LocoDex/scripts/system-requirements-checker.sh
```

### Otomatik Güncelleme

```bash
# Sistem güncellemesi
~/LocoDex/install.sh --update

# Sadece extension güncelle
~/LocoDex/scripts/vscode-auto-installer.sh update

# Sadece servisleri güncelle
~/LocoDex/scripts/service-manager.sh restart-all
```

## 🔧 Sorun Giderme

### Kurulum Başarısız

```bash
# Logları kontrol et
cat ~/LocoDex/logs/install.log

# Sistem gereksinimlerini kontrol et
~/LocoDex/scripts/system-requirements-checker.sh

# Temiz kurulum
rm -rf ~/LocoDex && ./install.sh
```

### Servis Sorunları

```bash
# Servis durumunu kontrol et
~/LocoDex/scripts/service-manager.sh status

# Servisleri yeniden başlat
~/LocoDex/scripts/service-manager.sh restart-all

# Logları izle
~/LocoDex/scripts/service-manager.sh logs
```

### VS Code Extension Sorunları

```bash
# Extension'ı yeniden kur
~/LocoDex/scripts/vscode-auto-installer.sh uninstall
~/LocoDex/scripts/vscode-auto-installer.sh install

# Geliştirici modu
~/LocoDex/scripts/vscode-auto-installer.sh dev
```

## 📊 Sistem Monitoring

### Servis İzleme
```bash
# Real-time monitoring
~/LocoDex/scripts/service-manager.sh monitor

# Durumu kontrol et
~/LocoDex/scripts/service-manager.sh status
```

### Log İzleme
```bash
# Tüm loglar
tail -f ~/LocoDex/logs/*.log

# Belirli servis
~/LocoDex/scripts/service-manager.sh logs api
```

### Backup
```bash
# Otomatik backup
~/LocoDex/scripts/service-manager.sh backup

# Backup'ları listele
ls ~/LocoDx/backups/
```

## 🎉 Kurulum Başarılı!

Eğer bu dosyayı okuyorsanız, muhtemelen kurulum başarıyla tamamlanmıştır! 

### Sonraki Adımlar:

1. **🖥️ Desktop uygulamasını açın**
2. **🌐 Web arayüzüne gidin** (http://localhost:3000)
3. **💻 VS Code'da LocoDex extension'ını kullanın**
4. **🤖 AI assistanının tadını çıkarın!**

### Destek

- **📚 Dokümantasyon**: [Wiki](https://github.com/company/locodex/wiki)
- **🐛 Bug Report**: [Issues](https://github.com/company/locodx/issues)
- **💬 Community**: [Discussions](https://github.com/company/locodex/discussions)

---

**🤖 LocoDex AI - Yapay Zeka Destekli Kod Geliştirme Platformu**

*Kurulum ile ilgili herhangi bir sorun yaşarsanız, yukarıdaki sorun giderme bölümünü kontrol edin.*