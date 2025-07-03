import { createContext, useContext, useState, useEffect } from 'react';

const ErrorContext = createContext();

export const useError = () => {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
};

export const ErrorProvider = ({ children }) => {
  const [errors, setErrors] = useState([]);
  const [networkStatus, setNetworkStatus] = useState('online');

  const addError = (error) => {
    const errorObj = {
      id: Date.now() + Math.random(),
      message: error.message || error,
      type: error.type || 'error',
      timestamp: new Date(),
      details: error.details,
      operation: error.operation,
      retryable: error.retryable || false
    };
    
    setErrors(prev => [...prev, errorObj]);
    
    if (errorObj.type !== 'critical') {
      setTimeout(() => {
        removeError(errorObj.id);
      }, 10000);
    }
  };

  const removeError = (id) => {
    setErrors(prev => prev.filter(error => error.id !== id));
  };

  const clearErrors = () => {
    setErrors([]);
  };

  const retryOperation = (error) => {
    if (error.retryCallback) {
      error.retryCallback();
    }
    removeError(error.id);
  };

  useEffect(() => {
    const handleOnline = () => setNetworkStatus('online');
    const handleOffline = () => setNetworkStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    setNetworkStatus(navigator.onLine ? 'online' : 'offline');

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const value = {
    errors,
    networkStatus,
    addError,
    removeError,
    clearErrors,
    retryOperation
  };

  return (
    <ErrorContext.Provider value={value}>
      {children}
    </ErrorContext.Provider>
  );
};