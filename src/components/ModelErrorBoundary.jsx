import React, { useState, useEffect } from 'react';

export const ModelErrorBoundary = ({ children, fallback }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleError = (event) => {
      if (event.error && event.error.message.includes('model')) {
        setHasError(true);
        setError(event.error);
      }
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return fallback || (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-red-800 font-medium">Model Hatası</h3>
        <p className="text-red-600 text-sm mt-1">
          {error?.message || 'Bilinmeyen model hatası'}
        </p>
        <button 
          onClick={() => {
            setHasError(false);
            setError(null);
          }}
          className="mt-2 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
        >
          Yeniden Dene
        </button>
      </div>
    );
  }

  return children;
};