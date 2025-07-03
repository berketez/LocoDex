# LocoDex - AI Destekli Yazılım Mühendisliği Platformu

![LocoDex Logo](assets/logo.png)

LocoDex, Docker ve sandbox entegrasyonu ile güçlendirilmiş, LM Studio ve Ollama model desteği sunan gelişmiş bir AI yazılım mühendisliği platformudur. Bu platform, güvenli kod çalıştırma, model yönetimi ve AI destekli geliştirme süreçleri için kapsamlı bir çözüm sunar.

## 🚀 Özellikler

### 🤖 AI Model Entegrasyonu
- **LM Studio Desteği**: Yerel LM Studio modellerine tam entegrasyon
- **Ollama Desteği**: Ollama model sağlayıcısı ile seamless çalışma
- **Model Keşfi**: Otomatik model algılama ve yönetimi
- **Çoklu Provider**: Birden fazla AI sağlayıcısını aynı anda kullanma

### 🐳 Docker & Containerization
- **Tam Docker Entegrasyonu**: Mikroservis mimarisi ile ölçeklenebilir yapı
- **Container Orchestration**: Docker Compose ile kolay yönetim
- **Service Discovery**: Otomatik servis keşfi ve load balancing
- **Health Monitoring**: Gerçek zamanlı sağlık kontrolü

### 🔒 Sandbox Güvenliği
- **İzole Kod Çalıştırma**: Güvenli sandbox ortamında kod execution
- **Resource Limiting**: CPU, memory ve disk kullanım sınırları
- **Security Validation**: Kötü amaçlı kod tespiti ve engelleme
- **Multi-Language Support**: Python, JavaScript, Bash desteği

### 🌐 API Gateway
- **Unified API**: Tüm servislere tek noktadan erişim
- **Rate Limiting**: Akıllı rate limiting ve throttling
- **CORS Support**: Cross-origin request desteği
- **SSL/TLS**: Güvenli HTTPS iletişimi

### 📊 Monitoring & Analytics
- **Prometheus Metrics**: Detaylı performans metrikleri
- **Grafana Dashboards**: Görsel monitoring panelleri
- **Real-time Logs**: Canlı log takibi
- **Health Checks**: Otomatik sağlık kontrolü

## 🏗️ Mimari

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │    │   AI Agent     │
│   (React)       │◄──►│   (Nginx)       │◄──►│   (Node.js)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Sandbox       │    │   Redis Cache   │    │   LM Studio     │
│   (Python)      │    │                 │    │   Ollama        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📋 Gereksinimler

### Sistem Gereksinimleri
- **İşletim Sistemi**: macOS 10.15+ (Catalina ve üzeri)
- **RAM**: Minimum 8GB, Önerilen 16GB+
- **Disk**: Minimum 10GB boş alan
- **CPU**: 4 çekirdek önerilen (Apple Silicon M1/M2 desteklenir)

### Yazılım Gereksinimleri
- **Docker Desktop**: 4.0+ (Docker Engine 20.10+)
- **Docker Compose**: 2.0+
- **Node.js**: 18.0+ (geliştirme için)
- **Git**: 2.30+

### AI Model Sağlayıcıları (Opsiyonel)
- **LM Studio**: Yerel model çalıştırma için
- **Ollama**: Alternatif yerel model sağlayıcısı

## 🚀 Hızlı Başlangıç

### 1. Kurulum
```bash
git clone <repo-url>
cd LocoDex-Final
npm run setup
```

### 2. Model Sağlayıcıları
LocoDex sadece yerel model sağlayıcıları kullanır:

#### Ollama (Önerilen)
```bash
# Ollama'yı indirin: https://ollama.ai
ollama pull llama3.2
ollama pull codellama
```

#### LM Studio
```bash
# LM Studio'yu indirin: https://lmstudio.ai
# Bir model indirin ve "Local Server"ı başlatın
```

### 3. Çalıştırma

#### Web Arayüzü
```bash
npm run dev
# http://localhost:5173 adresini açın
```

#### CLI
```bash
npm run cli
```

#### Docker Sandbox (Opsiyonel)
```bash
# Kod çalıştırma için güvenli sandbox
npm run docker:up
```

### 4. Kullanım
1. **Model Seçimi**: Mevcut Ollama/LM Studio modellerinden birini seçin
2. **Ortam Seçimi**: Local, Docker veya Sandbox ortamı seçin  
3. **Kod Çalıştırma**: Sandbox aktifse kod blokları otomatik çalışır

```markdown
Merhaba! Python kodunu çalıştır:

\`\`\`python
print("Hello LocoDex!")
import math
print(f"Pi = {math.pi}")
\`\`\`
```

## 📖 Detaylı Kurulum

### Docker ile Kurulum (Önerilen)

#### Adım 1: Depoyu Klonlayın
```bash
git clone https://github.com/your-username/LocoDex.git
cd LocoDex
```

#### Adım 2: Ortam Değişkenlerini Ayarlayın
```bash
# .env dosyasını oluşturun
cp .env.example .env

# Gerekli değişkenleri düzenleyin
nano .env
```

#### Adım 3: Docker Kurulumunu Yapın
```bash
# Tüm bileşenleri kurun
./scripts/docker-setup.sh setup

# Servisleri başlatın
./scripts/docker-setup.sh start

# Durumu kontrol edin
./scripts/docker-setup.sh status
```

#### Adım 4: Sağlık Kontrolü
```bash
# Entegrasyon testlerini çalıştırın
./scripts/test-integration.sh quick
```

### Manuel Kurulum

#### Frontend Kurulumu
```bash
# Bağımlılıkları yükleyin
npm install

# Geliştirme sunucusunu başlatın
npm run dev

# Production build
npm run build
```

#### Backend Servisleri
```bash
# AI Agent servisini başlatın
cd docker/ai-agent
npm install
npm start

# Sandbox servisini başlatın
cd docker/sandbox
python3 sandbox_server.py
```

## 🔧 Yapılandırma

### Ortam Değişkenleri

#### Temel Ayarlar
```env
NODE_ENV=production
LOG_LEVEL=info
API_PORT=3001
SANDBOX_PORT=3002
GATEWAY_PORT=8080
```

#### Model Sağlayıcıları
```env
OLLAMA_HOST=localhost:11434
LMSTUDIO_HOST=localhost:1234
OPENAI_API_KEY=your_api_key_here
```

#### Güvenlik Ayarları
```env
EXECUTION_TIMEOUT=30
MAX_MEMORY=512m
MAX_CPU=0.5
SANDBOX_MODE=true
```

### Docker Compose Profilleri

#### Temel Servisler
```bash
docker-compose up -d
```

#### Monitoring ile Birlikte
```bash
docker-compose --profile monitoring up -d
```

#### Sadece Geliştirme
```bash
docker-compose -f docker-compose.dev.yml up -d
```

## 🎯 Kullanım

### Model Seçimi
1. **Modeller** sekmesine gidin
2. Mevcut modelleri görüntüleyin
3. Bir model seçin
4. Test edin

### Ortam Yönetimi
1. **Ortam** sekmesine gidin
2. Çalışma ortamını seçin (Local/Docker/Sandbox)
3. Servisleri başlatın/durdurun
4. Durumu izleyin

### Kod Çalıştırma
1. **Sohbet** sekmesinde kod bloğu yazın:
   ```python
   print("Merhaba LocoDex!")
   ```
2. Mesajı gönderin
3. Sonuçları **Çalıştırma** sekmesinde görün

### AI Sohbeti
1. Bir model seçin
2. Sohbet sekmesinde mesaj yazın
3. AI yanıtını bekleyin
4. Konuşmaya devam edin

## 🔍 API Dokümantasyonu

### AI Agent API

#### Model Keşfi
```http
GET /api/models/discover
```

#### Chat Completion
```http
POST /api/chat/completions
Content-Type: application/json

{
  "model": "llama2",
  "messages": [
    {"role": "user", "content": "Merhaba!"}
  ],
  "temperature": 0.7
}
```

### Sandbox API

#### Kod Çalıştırma
```http
POST /execute
Content-Type: application/json

{
  "code": "print('Hello World')",
  "language": "python",
  "timeout": 30
}
```

#### Workspace Yönetimi
```http
GET /workspace
PUT /workspace/filename.py
```

### API Gateway

Tüm API'lere tek noktadan erişim:
- **AI Agent**: `/api/*`
- **Sandbox**: `/sandbox/*`
- **WebSocket**: `/ws`

## 🧪 Test

### Entegrasyon Testleri
```bash
# Tüm testleri çalıştır
./scripts/test-integration.sh

# Hızlı testler
./scripts/test-integration.sh quick

# Güvenlik testleri
./scripts/test-integration.sh security

# Performans testleri
./scripts/test-integration.sh performance
```

### Unit Testler
```bash
# Frontend testleri
npm test

# Backend testleri
cd docker/ai-agent && npm test
cd docker/sandbox && python -m pytest
```

### Manuel Test
```bash
# Sağlık kontrolü
curl http://localhost:8080/health

# Model listesi
curl http://localhost:8080/api/models/discover

# Kod çalıştırma
curl -X POST http://localhost:8080/sandbox/execute \
  -H "Content-Type: application/json" \
  -d '{"code":"print(\"test\")", "language":"python"}'
```

## 📊 Monitoring

### Prometheus Metrikleri
- **URL**: http://localhost:9090
- **Metrics**: `/metrics` endpoint'leri
- **Targets**: Tüm servisler otomatik keşfedilir

### Grafana Dashboards
- **URL**: http://localhost:3000
- **Login**: admin/admin
- **Dashboards**: Önceden yapılandırılmış paneller

### Log Takibi
```bash
# Tüm servis logları
docker-compose logs -f

# Belirli servis
docker-compose logs -f ai-agent

# Gerçek zamanlı
./scripts/docker-setup.sh logs ai-agent
```

## 🔒 Güvenlik

### Sandbox Güvenliği
- **Process Isolation**: Her kod çalıştırma izole process'te
- **Resource Limits**: CPU, memory, disk sınırları
- **Code Validation**: Kötü amaçlı kod tespiti
- **Network Restrictions**: Ağ erişimi kısıtlamaları

### API Güvenliği
- **Rate Limiting**: IP bazlı rate limiting
- **CORS**: Yapılandırılabilir CORS politikaları
- **Input Validation**: Tüm girişler doğrulanır
- **Error Handling**: Güvenli hata mesajları

### Container Güvenliği
- **Non-root Users**: Tüm containerlar non-root kullanıcı ile çalışır
- **Read-only Filesystems**: Mümkün olduğunda read-only
- **Security Contexts**: Güvenlik bağlamları uygulanır
- **Network Policies**: Container arası iletişim kısıtlamaları

## 🚨 Sorun Giderme

### Yaygın Sorunlar

#### Docker Servisleri Başlamıyor
```bash
# Docker daemon kontrolü
docker info

# Servisleri yeniden başlat
./scripts/docker-setup.sh restart

# Logları kontrol et
docker-compose logs
```

#### Model Sağlayıcıları Bulunamıyor
```bash
# LM Studio kontrolü
curl http://localhost:1234/v1/models

# Ollama kontrolü
curl http://localhost:11434/api/tags

# Host bağlantısını kontrol et
docker exec locodex-ai-agent curl http://host.docker.internal:11434/api/tags
```

#### Sandbox Kod Çalıştırma Hatası
```bash
# Sandbox logları
docker-compose logs sandbox

# Güvenlik kısıtlamaları
docker exec locodex-sandbox python3 -c "import os; print(os.getcwd())"

# Resource kullanımı
docker stats locodex-sandbox
```

### Debug Modu
```bash
# Debug logları aktif et
export LOG_LEVEL=debug

# Geliştirme modu
export NODE_ENV=development

# Servisleri debug modda başlat
docker-compose -f docker-compose.dev.yml up -d
```

### Log Analizi
```bash
# Hata logları
docker-compose logs | grep ERROR

# Performans logları
docker-compose logs | grep -E "(slow|timeout|memory)"

# Güvenlik logları
docker-compose logs | grep -E "(security|blocked|denied)"
```

## 🤝 Katkıda Bulunma

### Geliştirme Ortamı
```bash
# Depoyu fork edin
git clone https://github.com/your-username/LocoDex.git

# Geliştirme dalı oluşturun
git checkout -b feature/yeni-ozellik

# Değişiklikleri yapın
# ...

# Testleri çalıştırın
npm test
./scripts/test-integration.sh

# Commit ve push
git commit -m "Yeni özellik: ..."
git push origin feature/yeni-ozellik

# Pull request oluşturun
```

### Kod Standartları
- **ESLint**: JavaScript/React kod standartları
- **Prettier**: Kod formatlama
- **Black**: Python kod formatlama
- **Conventional Commits**: Commit mesaj formatı

### Test Gereksinimleri
- Unit testler %80+ coverage
- Entegrasyon testleri geçmeli
- Güvenlik testleri geçmeli
- Performance regression yok

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakın.

## 🙏 Teşekkürler

- **LM Studio** - Yerel model çalıştırma platformu
- **Ollama** - Açık kaynak model sağlayıcısı
- **Docker** - Containerization teknolojisi
- **React** - Frontend framework
- **Node.js** - Backend runtime

## 📞 İletişim

- **GitHub Issues**: [Sorun bildirin](https://github.com/your-username/LocoDex/issues)
- **Discussions**: [Tartışmalara katılın](https://github.com/your-username/LocoDex/discussions)
- **Email**: support@locodex.com

## 🗺️ Roadmap

### v1.1 (Yakında)
- [ ] OpenAI API entegrasyonu
- [ ] Anthropic Claude desteği
- [ ] Gelişmiş kod editörü
- [ ] Plugin sistemi

### v1.2 (Gelecek)
- [ ] Kubernetes desteği
- [ ] Multi-tenant mimari
- [ ] Advanced monitoring
- [ ] Mobile uygulama

### v2.0 (Uzun vadeli)
- [ ] AI model training
- [ ] Custom model deployment
- [ ] Enterprise features
- [ ] Cloud-native architecture

---

**LocoDex** - AI destekli yazılım mühendisliği platformu 🚀

