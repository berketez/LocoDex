import React from 'react';
import { useError } from '@/hooks/useError.js';
import { Button } from '@/components/ui/button.jsx';
import { AlertCircle, CheckCircle, XCircle, RefreshCw, X } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';

const ErrorIcon = ({ type }) => {
  switch (type) {
    case 'success':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'warning':
      return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    case 'error':
    case 'critical':
      return <XCircle className="w-5 h-5 text-red-500" />;
    default:
      return <AlertCircle className="w-5 h-5 text-blue-500" />;
  }
};

const getErrorTitle = (type) => {
  switch (type) {
    case 'success':
      return 'Başarılı';
    case 'warning':
      return 'Uyarı';
    case 'error':
      return 'Hata';
    case 'critical':
      return 'Kritik Hata';
    case 'network':
      return 'Bağlantı Hatası';
    case 'validation':
      return 'Doğrulama Hatası';
    case 'permission':
      return 'Yetki Hatası';
    default:
      return 'Bildirim';
  }
};

export const ErrorDisplay = () => {
  const { errors, removeError, retryOperation } = useError();

  if (errors.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      <AnimatePresence>
        {errors.map(error => (
          <div
            key={error.id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4"
          >
            <div className="flex items-start space-x-3">
              <ErrorIcon type={error.type} />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                    {getErrorTitle(error.type)}
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeError(error.id)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {error.message}
                </p>
                
                {error.details && (
                  <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">
                    {error.details}
                  </p>
                )}
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {error.timestamp.toLocaleTimeString('tr-TR')}
                  </span>
                  
                  {error.retryable && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => retryOperation(error)}
                      className="h-6 text-xs"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Tekrar Dene
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
};