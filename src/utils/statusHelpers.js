// Durum çevirileri ve görsel ipuçları
export const STATUS_TRANSLATIONS = {
  // Genel durumlar
  'N/A': 'Mevcut değil',
  'undefined': 'Tanımlanmamış',
  'null': 'Boş',
  'loading': 'Yükleniyor',
  'error': 'Hata',
  'success': 'Başarılı',
  'warning': 'Uyarı',
  'info': 'Bilgi',
  
  // Servis durumları
  'stopped': 'Durduruldu',
  'running': 'Çalışıyor',
  'starting': 'Başlatılıyor',
  'stopping': 'Durduruluyor',
  'restarting': 'Yeniden başlatılıyor',
  'failed': 'Başarısız',
  'pending': 'Beklemede',
  'idle': 'Boşta',
  'busy': 'Meşgul',
  'ready': 'Hazır',
  'connecting': 'Bağlanıyor',
  'connected': 'Bağlandı',
  'disconnected': 'Bağlantı kesildi',
  'timeout': 'Zaman aşımı',
  'monitoring': 'İzleniyor',
  
  // Model durumları
  'available': 'Mevcut',
  'unavailable': 'Mevcut değil',
  'downloading': 'İndiriliyor',
  'installing': 'Kuruluyor',
  'updating': 'Güncelleniyor',
  'deleting': 'Siliniyor',
  
  // Docker durumları
  'created': 'Oluşturuldu',
  'exited': 'Çıkıldı',
  'paused': 'Duraklatıldı',
  'restarting': 'Yeniden başlatılıyor',
  'removing': 'Kaldırılıyor',
  'dead': 'Ölü',
  'unknown': 'Bilinmiyor'
}

export const STATUS_COLORS = {
  // Durum renkleri (Tailwind CSS sınıfları)
  'stopped': 'text-red-500 bg-red-50 border-red-200',
  'running': 'text-green-500 bg-green-50 border-green-200',
  'starting': 'text-blue-500 bg-blue-50 border-blue-200',
  'stopping': 'text-orange-500 bg-orange-50 border-orange-200',
  'restarting': 'text-purple-500 bg-purple-50 border-purple-200',
  'failed': 'text-red-600 bg-red-100 border-red-300',
  'error': 'text-red-600 bg-red-100 border-red-300',
  'pending': 'text-yellow-500 bg-yellow-50 border-yellow-200',
  'idle': 'text-gray-500 bg-gray-50 border-gray-200',
  'busy': 'text-orange-500 bg-orange-50 border-orange-200',
  'ready': 'text-green-500 bg-green-50 border-green-200',
  'connecting': 'text-blue-500 bg-blue-50 border-blue-200',
  'connected': 'text-green-500 bg-green-50 border-green-200',
  'disconnected': 'text-red-500 bg-red-50 border-red-200',
  'timeout': 'text-red-500 bg-red-50 border-red-200',
  'monitoring': 'text-blue-500 bg-blue-50 border-blue-200',
  'available': 'text-green-500 bg-green-50 border-green-200',
  'unavailable': 'text-gray-500 bg-gray-50 border-gray-200',
  'downloading': 'text-blue-500 bg-blue-50 border-blue-200',
  'installing': 'text-blue-500 bg-blue-50 border-blue-200',
  'updating': 'text-purple-500 bg-purple-50 border-purple-200',
  'deleting': 'text-red-500 bg-red-50 border-red-200',
  'created': 'text-blue-500 bg-blue-50 border-blue-200',
  'exited': 'text-gray-500 bg-gray-50 border-gray-200',
  'paused': 'text-yellow-500 bg-yellow-50 border-yellow-200',
  'removing': 'text-red-500 bg-red-50 border-red-200',
  'dead': 'text-red-600 bg-red-100 border-red-300',
  'unknown': 'text-gray-400 bg-gray-50 border-gray-200',
  'loading': 'text-blue-500 bg-blue-50 border-blue-200',
  'success': 'text-green-500 bg-green-50 border-green-200',
  'warning': 'text-yellow-500 bg-yellow-50 border-yellow-200',
  'info': 'text-blue-500 bg-blue-50 border-blue-200'
}

export const STATUS_ICONS = {
  'stopped': '⏹️',
  'running': '▶️',
  'starting': '🔄',
  'stopping': '⏸️',
  'restarting': '🔁',
  'failed': '❌',
  'error': '❌',
  'pending': '⏳',
  'idle': '😴',
  'busy': '⚡',
  'ready': '✅',
  'connecting': '🔗',
  'connected': '🔗',
  'disconnected': '🔌',
  'timeout': '⏱️',
  'monitoring': '👁️',
  'available': '✅',
  'unavailable': '❌',
  'downloading': '⬇️',
  'installing': '📦',
  'updating': '🔄',
  'deleting': '🗑️',
  'created': '🆕',
  'exited': '🚪',
  'paused': '⏸️',
  'removing': '🗑️',
  'dead': '💀',
  'unknown': '❓',
  'loading': '⏳',
  'success': '✅',
  'warning': '⚠️',
  'info': 'ℹ️'
}

// Durum çevirme fonksiyonu
export const translateStatus = (status) => {
  if (!status) return 'Bilinmiyor'
  const lowerStatus = status.toString().toLowerCase()
  return STATUS_TRANSLATIONS[lowerStatus] || status
}

// Durum rengini alma fonksiyonu
export const getStatusColor = (status) => {
  if (!status) return STATUS_COLORS['unknown']
  const lowerStatus = status.toString().toLowerCase()
  return STATUS_COLORS[lowerStatus] || STATUS_COLORS['unknown']
}

// Durum ikonu alma fonksiyonu
export const getStatusIcon = (status) => {
  if (!status) return STATUS_ICONS['unknown']
  const lowerStatus = status.toString().toLowerCase()
  return STATUS_ICONS[lowerStatus] || STATUS_ICONS['unknown']
}

// Proaktif yardım mesajları
export const HELP_MESSAGES = {
  'model_not_found': {
    title: 'Model bulunamadı',
    message: 'Bu model henüz sisteminizde yüklü değil.',
    actions: [
      'Model Galerisi\'nden indirin',
      'Farklı bir model seçin',
      'LM Studio veya Ollama\'yı kontrol edin'
    ]
  },
  'ollama_not_running': {
    title: 'Ollama çalışmıyor',
    message: 'Ollama servisi başlatılmamış veya bağlantı kurulamıyor.',
    actions: [
      'Terminal\'de "ollama serve" komutunu çalıştırın',
      'Ollama\'nın kurulu olduğunu kontrol edin',
      'Port 11434\'ün açık olduğunu kontrol edin'
    ]
  },
  'lmstudio_not_running': {
    title: 'LM Studio çalışmıyor',
    message: 'LM Studio uygulaması başlatılmamış veya server modu aktif değil.',
    actions: [
      'LM Studio uygulamasını açın',
      'Developer sekmesinde "Start Server" butonuna basın',
      'Port 1234\'ün açık olduğunu kontrol edin'
    ]
  },
  'docker_not_running': {
    title: 'Docker çalışmıyor',
    message: 'Docker Desktop başlatılmamış veya Docker daemon çalışmıyor.',
    actions: [
      'Docker Desktop uygulamasını başlatın',
      'Docker daemon\'ın çalıştığını kontrol edin',
      'Docker kurulumunu kontrol edin'
    ]
  },
  'no_models_available': {
    title: 'Hiç model mevcut değil',
    message: 'Sisteminizde kullanılabilir AI modeli bulunamadı.',
    actions: [
      'Ollama ile model indirin: "ollama pull llama2"',
      'LM Studio\'dan model indirin',
      'Model ayarlarını kontrol edin'
    ]
  },
  'connection_failed': {
    title: 'Bağlantı hatası',
    message: 'Servise bağlanırken bir hata oluştu.',
    actions: [
      'İnternet bağlantınızı kontrol edin',
      'Firewall ayarlarını kontrol edin',
      'Proxy ayarlarını kontrol edin'
    ]
  },
  'websocket_failed': {
    title: 'WebSocket bağlantısı başarısız',
    message: 'Gerçek zamanlı iletişim kurulamadı.',
    actions: [
      'Sayfayı yenileyin (Cmd+R)',
      'Tarayıcı ayarlarını kontrol edin',
      'Antivirus yazılımını kontrol edin'
    ]
  }
}

// Yardım mesajı alma fonksiyonu
export const getHelpMessage = (errorType) => {
  return HELP_MESSAGES[errorType] || {
    title: 'Bir sorun oluştu',
    message: 'Beklenmeyen bir hata meydana geldi.',
    actions: [
      'Sayfayı yenileyin',
      'Uygulamayı yeniden başlatın',
      'Destek ekibiyle iletişime geçin'
    ]
  }
}