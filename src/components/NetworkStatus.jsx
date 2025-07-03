import React from 'react';
import { useError } from '@/hooks/useError.js';
import { WifiOff } from 'lucide-react';

export const NetworkStatus = () => {
  const { networkStatus } = useError();
  
  if (networkStatus === 'online') {
    return null;
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 bg-red-500 text-white p-2 text-center"
    >
      <div className="flex items-center justify-center space-x-2">
        <WifiOff className="w-4 h-4" />
        <span className="text-sm font-medium">
          İnternet bağlantısı yok
        </span>
      </div>
    </div>
  );
};