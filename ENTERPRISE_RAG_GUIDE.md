# 🏢 LocoDex Kurumsal RAG Sistemi

LocoDex'in en güçlü özelliklerinden biri olan Kurumsal RAG (Retrieval-Augmented Generation) sistemi, şirket içi belgeleri akıllı bir şekilde analiz ederek doğal dil sorularına yanıt verir.

## 🎯 Özellikler

### 📊 Otomatik Belge Kategorizasyonu
- **Finansal Raporlar**: Bütçe, gelir, gider, çeyrek raporları
- **İnsan Kaynakları**: Politikalar, oryantasyon, performans değerlendirme
- **Teknik Dokümanlar**: API dökümanları, sistem kurulumları
- **Politika ve Prosedürler**: Güvenlik, uyumluluk, etik kurallar
- **Pazarlama ve Satış**: Kampanyalar, müşteri analizleri
- **Eğitim Materyalleri**: Kurslar, sertifika programları

### 🔍 Gelişmiş Arama Teknolojileri
- **Semantik Arama**: Anlam tabanlı belge eşleştirme
- **Anahtar Kelime Analizi**: Frekans ve bağlam analizi
- **Çok Katmanlı Skorlama**: Dosya adı, içerik ve metadata skorlaması

### 🏢 Departman Organizasyonu
- Otomatik departman tespiti
- Departman bazlı filtreleme
- Yetki bazlı erişim kontrolleri

## 🚀 Kurulum

### 1. Otomatik Kurulum (Önerilen)
```bash
# Kurulum scriptini çalıştır
chmod +x scripts/setup-enterprise-rag.sh
./scripts/setup-enterprise-rag.sh
```

### 2. Manuel Kurulum
```bash
# Python bağımlılıklarını kur
cd src/services/enterprise_rag_service
python3 -m venv rag_env
source rag_env/bin/activate
pip install -r requirements.txt

# NLTK verilerini indir
python3 -c "import nltk; nltk.download('punkt'); nltk.download('stopwords')"
```

### 3. CLI'yi Build Et
```bash
# CLI'yi güncelle
npm run build
```

## 💻 Kullanım

### CLI Aracılığıyla
```bash
# Belge yönetimi CLI'yi başlat
npm run cli documents

# Menü seçenekleri:
# 1. Belge/Dizin Yükle ve İşle
# 2. Belge Arama
# 3. İstatistikler ve Raporlar
# 4. Belge Listesi
# 5. Veritabanını Temizle
```

### Web Arayüzü Aracılığıyla
```bash
# Ana uygulamayı başlat
npm run dev

# RAG sekmesine git
# "Kurumsal RAG Sistemi" seçeneğini seç
```

## 📁 Desteklenen Dosya Formatları

- **PDF**: Raporlar, sunumlar, dökümanlar
- **Word (.docx)**: Politikalar, prosedürler
- **Excel (.xlsx)**: Finansal tablolar, veri analizleri
- **PowerPoint (.pptx)**: Sunumlar, eğitim materyalleri
- **TXT**: Düz metin dosyaları

## 🔍 Örnek Sorgular

### Finansal Sorular
```
"Son çeyrek finansal raporuna göre en kârlı ürünümüz hangisi?"
"Bu yılın bütçe hedefleri neler?"
"Hangi departmanın harcaması en yüksek?"
```

### İnsan Kaynakları Sorguları
```
"Yeni başlayan bir çalışan için oryantasyon süreci nasıl?"
"Yıllık izin politikası nedir?"
"Performans değerlendirme kriterleri nelerdir?"
```

### Teknik Sorular
```
"API entegrasyonu nasıl yapılır?"
"Sistem bakım prosedürleri nelerdir?"
"Güvenlik protokolleri neler?"
```

## 📊 Sistem Mimarisi

```
📁 enterprise_rag_service/
├── 📄 document_processor.py     # Ana işleme motoru
├── 📄 requirements.txt         # Python bağımlılıkları
├── 🗃️ enterprise_documents.db  # SQLite veritabanı
└── 📁 rag_env/                 # Python sanal ortamı

📁 cli/src/commands/
└── 📄 DocumentManager.ts       # CLI arayüzü

📁 components/
├── 📄 EnterpriseRAG.jsx       # Web arayüzü
└── 📄 RAGChat.jsx             # RAG seçici
```

### Veritabanı Şeması
```sql
-- Belgeler tablosu
documents (
    id TEXT PRIMARY KEY,
    filename TEXT,
    content TEXT,
    category TEXT,
    department TEXT,
    keywords TEXT,
    summary TEXT,
    upload_date TEXT
)

-- Embedding vektörleri
embeddings (
    document_id TEXT,
    chunk_id TEXT,
    chunk_text TEXT,
    embedding BLOB
)

-- Arama geçmişi
search_history (
    query TEXT,
    results_count INTEGER,
    timestamp TEXT,
    response_time_ms INTEGER
)
```

## ⚡ Performans Optimizasyonları

### Arama Optimizasyonu
- Çok katmanlı skorlama sistemi
- Similarity threshold ile filtreleme
- Chunk-based embedding arama

### Bellek Yönetimi
- Lazy loading of embeddings
- Chunk-based text processing
- Database connection pooling

### Önbellek Stratejisi
- Arama sonuçları önbellekleme
- Model embedding cache
- Frequently accessed documents

## 🔒 Güvenlik Özellikleri

### Veri Güvenliği
- Lokal SQLite veritabanı
- Hassas bilgi filtering
- Access control logs

### Dosya Güvenliği
- File hash verification
- Malware scanning hooks
- Size limitations

## 🎛️ Yapılandırma

### Python Servisi Ayarları
```python
# document_processor.py içinde
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
CHUNK_SIZE = 512  # Token chunk size
SIMILARITY_THRESHOLD = 0.3  # Minimum similarity
TOP_K_RESULTS = 10  # Maximum results
```

### CLI Ayarları
```typescript
// DocumentManager.ts içinde
private pythonService: string  # Python script path
private spinner: Ora           # Loading indicators
```

## 📈 İstatistikler ve Analitik

### Sistem Metrikleri
- Toplam belge sayısı
- Kategori dağılımı
- Departman bazlı analiz
- Arama performansı

### Kullanım Analitikleri
- Popüler sorgular
- Yanıt süreleri
- Başarı oranları

## 🚨 Sorun Giderme

### Python Bağımlılık Hatları
```bash
# Sanal ortamı yeniden oluştur
rm -rf rag_env
python3 -m venv rag_env
source rag_env/bin/activate
pip install -r requirements.txt
```

### NLTK Veri Hatası
```bash
python3 -c "import nltk; nltk.download('all')"
```

### SQLite Hatası
```bash
# Veritabanını sıfırla
rm enterprise_documents.db
# CLI'den "Veritabanını Temizle" seçeneğini kullan
```

### Model Yükleme Hatası
```bash
# Sentence transformers cache temizle
rm -rf ~/.cache/huggingface/
```

## 🔄 Güncelleme ve Bakım

### Sistem Güncellemesi
```bash
# Python paketlerini güncelle
pip install --upgrade -r requirements.txt

# CLI'yi yeniden build et
npm run build
```

### Veritabanı Bakımı
```bash
# CLI aracılığıyla
npm run cli documents
# Seçenek 3: İstatistikler ve Raporlar
# Seçenek 5: Veritabanını Temizle
```

## 📞 Destek

### Geliştirici Modu
```bash
# Debug logs için
export LOCODEX_DEBUG=true
npm run cli documents
```

### Log Dosyaları
- CLI logs: `packages/cli/logs/`
- Python logs: Console output
- Application logs: Browser DevTools

## 🎉 Sonuç

LocoDex Kurumsal RAG Sistemi, şirket içi bilgi yönetimini devrim niteliğinde değiştiren güçlü bir araçtır. Otomatik kategorizasyon, semantik arama ve akıllı sorgulama özellikleriyle çalışanlarınızın verimliliğini artırır ve bilgiye erişimi kolaylaştırır.

### Başlıca Faydalar:
- ⏱️ **Zaman Tasarrufu**: Belgelerde manuel arama yerine AI destekli sorgulama
- 🎯 **Hassas Sonuçlar**: Semantik arama ile ilgili bilgileri bulma
- 📊 **Organizasyon**: Otomatik kategorizasyon ve departman organizasyonu
- 🔍 **Derinlemesine Analiz**: Belge içeriğini anlayarak doğru yanıtlar verme

Kurumsal RAG sisteminiz hazır! 🚀