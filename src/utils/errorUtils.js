export const handleApiError = (addError, error, operation = 'API işlemi') => {
  let errorMessage = 'Bilinmeyen hata';
  let errorType = 'error';
  let retryable = false;
  
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;
    
    switch (status) {
      case 400:
        errorMessage = data?.message || 'Geçersiz istek';
        errorType = 'validation';
        break;
      case 401:
        errorMessage = 'Yetki gerekli';
        errorType = 'permission';
        break;
      case 403:
        errorMessage = 'Erişim reddedildi';
        errorType = 'permission';
        break;
      case 404:
        errorMessage = 'Kaynak bulunamadı';
        break;
      case 429:
        errorMessage = 'Çok fazla istek. Lütfen bekleyin.';
        errorType = 'warning';
        retryable = true;
        break;
      case 500:
        errorMessage = 'Sunucu hatası';
        retryable = true;
        break;
      case 502:
      case 503:
      case 504:
        errorMessage = 'Servis geçici olarak kullanılamıyor';
        errorType = 'warning';
        retryable = true;
        break;
      default:
        errorMessage = data?.message || `HTTP ${status} hatası`;
    }
  } else if (error.request) {
    errorMessage = 'Bağlantı hatası';
    errorType = 'network';
    retryable = true;
  } else {
    errorMessage = error.message || 'Bilinmeyen hata';
  }
  
  addError({
    message: errorMessage,
    type: errorType,
    operation: operation,
    retryable: retryable,
    details: error.response?.data?.details
  });
};

export const showSuccess = (addError, message, operation = '') => {
  addError({
    message: message,
    type: 'success',
    operation: operation
  });
};

export const showWarning = (addError, message, operation = '') => {
  addError({
    message: message,
    type: 'warning',
    operation: operation
  });
};