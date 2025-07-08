# LocoDex vLLM Service

Bu servis, LocoDex projesi için yüksek performanslı AI inference sağlar. vLLM (Very Large Language Model) framework'ünü kullanarak GPU hızlandırmalı model çalıştırma imkanı sunar.

## Özellikler

- 🚀 **Yüksek Performans**: vLLM ile optimize edilmiş inference
- 🔥 **GPU Hızlandırma**: CUDA destekli GPU acceleration
- ⚡ **Tensor Parallelism**: Çoklu GPU desteği
- 🎯 **Quantization**: AWQ, GPTQ gibi quantization desteği
- 🔄 **Streaming**: Real-time streaming responses
- 📊 **Monitoring**: Prometheus metrics ve sistem istatistikleri
- 🔌 **OpenAI Uyumluluk**: OpenAI API uyumlu endpoints

## Sistem Gereksinimleri

### Minimum
- NVIDIA GPU (CUDA destekli)
- 8GB+ GPU belleği
- Python 3.8+
- CUDA 11.8+

### Önerilen
- NVIDIA RTX 4090, A100, H100
- 24GB+ GPU belleği
- Python 3.11
- CUDA 12.0+

## Kurulum

### Docker ile (Önerilen)

```bash
# vLLM servisini başlat
docker-compose up vllm-service

# Logs kontrol et
docker-compose logs -f vllm-service
```

### Manuel Kurulum

```bash
# Gerekli paketleri yükle
pip install -r requirements.txt

# Servisi başlat
python server.py
```

## Kullanım

### 1. Model Yükleme

#### Popüler Modeller

```bash
# Llama 2 7B Chat
curl -X POST http://localhost:8000/models/load \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "model_path": "meta-llama/Llama-2-7b-chat-hf",
      "tensor_parallel_size": 1,
      "gpu_memory_utilization": 0.85
    }
  }'

# Mistral 7B Instruct
curl -X POST http://localhost:8000/models/load \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "model_path": "mistralai/Mistral-7B-Instruct-v0.1",
      "tensor_parallel_size": 1
    }
  }'
```

#### Özel Yapılandırma

```json
{
  "config": {
    "model_path": "model/path/or/hf/model",
    "tensor_parallel_size": 2,
    "max_model_len": 4096,
    "temperature": 0.7,
    "top_p": 0.9,
    "trust_remote_code": false,
    "gpu_memory_utilization": 0.85,
    "quantization": "awq"
  }
}
```

### 2. Chat API

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "current_model",
    "messages": [
      {"role": "user", "content": "Merhaba! Sen kimsin?"}
    ],
    "temperature": 0.7,
    "max_tokens": 1024
  }'
```

### 3. Completion API

```bash
curl -X POST http://localhost:8000/v1/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "current_model",
    "prompt": "Yapay zeka hakkında bir makale yaz:",
    "temperature": 0.7,
    "max_tokens": 1024
  }'
```

## API Endpoints

### Model Yönetimi
- `GET /models` - Yüklü modelleri listele
- `POST /models/load` - Model yükle
- `POST /models/unload` - Model kaldır

### Inference
- `POST /v1/chat/completions` - Chat completions
- `POST /v1/completions` - Text completions

### Monitoring
- `GET /health` - Servis sağlık durumu
- `GET /stats` - Sistem istatistikleri
- `GET /metrics` - Prometheus metrics

## Yapılandırma

### Environment Variables

```bash
# Sunucu ayarları
HOST=0.0.0.0
PORT=8000

# GPU ayarları
CUDA_VISIBLE_DEVICES=0,1

# Redis bağlantısı
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=password

# Otomatik model yükleme
AUTO_LOAD_MODEL=meta-llama/Llama-2-7b-chat-hf
```

### Model Parametreleri

| Parametre | Açıklama | Varsayılan |
|-----------|----------|------------|
| `model_path` | Model yolu (HuggingFace veya local) | - |
| `tensor_parallel_size` | GPU sayısı | 1 |
| `max_model_len` | Max context uzunluğu | Auto |
| `temperature` | Yaratıcılık derecesi | 0.7 |
| `top_p` | Nucleus sampling | 0.9 |
| `gpu_memory_utilization` | GPU bellek kullanımı | 0.85 |
| `quantization` | Quantization tipi | None |

## Performance Tuning

### GPU Memory Optimization

```json
{
  "gpu_memory_utilization": 0.95,  // GPU belleğinin %95'ini kullan
  "enforce_eager": false,          // CUDA graphs kullan
  "quantization": "awq"            // AWQ quantization
}
```

### Multi-GPU Setup

```json
{
  "tensor_parallel_size": 4,       // 4 GPU kullan
  "model_path": "meta-llama/Llama-2-70b-chat-hf"
}
```

## Monitoring

### Prometheus Metrics

- `vllm_requests_total` - Toplam istek sayısı
- `vllm_request_duration_seconds` - İstek süresi
- `vllm_active_requests` - Aktif istek sayısı
- `vllm_model_load_time_seconds` - Model yükleme süresi
- `vllm_gpu_memory_usage_bytes` - GPU bellek kullanımı

### Health Check

```bash
curl http://localhost:8000/health
```

```json
{
  "status": "healthy",
  "model_loaded": true,
  "current_model": "meta-llama/Llama-2-7b-chat-hf",
  "gpu_count": 1,
  "memory_usage": {
    "cpu_percent": 15.3,
    "memory_percent": 68.7,
    "gpu_memory": [
      {
        "device": 0,
        "percent": 85.2,
        "allocated": 20480000000,
        "total": 24000000000
      }
    ]
  },
  "uptime": 3600.5
}
```

## Troubleshooting

### Yaygın Sorunlar

1. **CUDA Out of Memory**
   ```bash
   # GPU bellek kullanımını azalt
   "gpu_memory_utilization": 0.7
   ```

2. **Model Yükleme Hatası**
   ```bash
   # Model yolunu kontrol et
   "trust_remote_code": true  # Gerekirse
   ```

3. **Yavaş Inference**
   ```bash
   # Tensor parallelism kullan
   "tensor_parallel_size": 2
   ```

### Loglar

```bash
# Docker logs
docker-compose logs -f vllm-service

# Manuel çalıştırma
tail -f vllm.log
```

## LocoDex Entegrasyonu

vLLM servisi LocoDex ana uygulamasında:

1. **Model Provider** olarak otomatik keşfedilir
2. **vLLM sekmesi** ile yönetilir
3. **Chat interface**'de kullanılabilir
4. **System monitoring**'de izlenir

### UI Features

- Model yükleme ve kaldırma
- GPU kullanım izleme
- Performans metrikleri
- Yapılandırma yönetimi

## Güvenlik

- Container izolasyonu
- Resource limiting
- Network segmentasyonu
- Input validation
- Rate limiting

## Lisans

Bu proje LocoDex lisansı altında lisanslanmıştır.