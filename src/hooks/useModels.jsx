import { useState, useEffect, useCallback, useRef } from 'react'

// Custom hook for model management
export const useModels = () => {
  const [models, setModels] = useState([])
  const [providers, setProviders] = useState({})
  const [selectedModel, setSelectedModel] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  
  const refreshIntervalRef = useRef(null)
  const abortControllerRef = useRef(null)

  // Load models from discovery service
  const loadModels = useCallback(async () => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    abortControllerRef.current = new AbortController()
    
    try {
      setIsLoading(true)
      setError(null)
      
      // Call the discover IPC handler in the main process
      const result = await window.electronAPI.app.models.discover()
      
      // Check if request was aborted
      if (abortControllerRef.current.signal.aborted) {
        return
      }
      
      setModels(result.models)
      setProviders(result.providers)
      setLastUpdated(new Date(result.lastUpdated))
      
      // Auto-select first available model if none selected
      if (!selectedModel && result.models.length > 0) {
        // Note: getRecommendedModels is still a renderer-side utility
        // You might want to move this to main process if it involves heavy logic
        const recommendedModels = window.electronAPI.app.models.getRecommended(result.models, 'general')
        setSelectedModel(recommendedModels[0] || result.models[0])
      }
      
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Failed to load models:', err)
        setError({
          type: 'discovery_failed',
          message: 'Model keşfi başarısız oldu',
          details: err.message,
          timestamp: new Date()
        })
      }
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }, [selectedModel])

  // Refresh models (force reload)
  const refreshModels = useCallback(() => {
    // Clear cache in main process
    window.electronAPI.app.models.clearCache()
    return loadModels()
  }, [loadModels])

  // Test model connection
  const testModel = useCallback(async (model) => {
    try {
      setError(null)
      // Call the checkProvider IPC handler in the main process
      const isConnected = await window.electronAPI.app.models.checkProvider(model.provider)
      
      if (!isConnected) {
        setError({
          type: 'connection_failed',
          message: `${model.name} modeline bağlanılamadı`,
          details: `${model.provider} sağlayıcısı üzerinden model testi başarısız`,
          timestamp: new Date()
        })
      }
      
      return isConnected
    } catch (err) {
      setError({
        type: 'test_failed',
        message: 'Model testi başarısız',
        details: err.message,
        timestamp: new Date()
      })
      return false
    }
  }, [])

  // Get provider status
  const getProviderStatus = useCallback(async () => {
    try {
      return await window.electronAPI.app.models.getProviderStatus()
    } catch (err) {
      console.error('Failed to get provider status:', err)
      return {}
    }
  }, [])

  // Select model with validation
  const selectModel = useCallback(async (model) => {
    if (!model) {
      setSelectedModel(null)
      return true
    }

    try {
      setError(null)
      
      // Test connection before selecting
      const isConnected = await testModel(model)
      
      if (isConnected) {
        setSelectedModel(model)
        
        // Save to localStorage
        try {
          localStorage.setItem('locodex_selected_model', JSON.stringify(model))
        } catch (err) {
          console.warn('Failed to save model to localStorage:', err)
        }
        
        return true
      }
      
      return false
    } catch (err) {
      setError({
        type: 'selection_failed',
        message: 'Model seçimi başarısız',
        details: err.message,
        timestamp: new Date()
      })
      return false
    }
  }, [testModel])

  // Get models by provider
  const getModelsByProvider = useCallback((providerKey) => {
    return models.filter(model => model.provider === providerKey)
  }, [models])

  // Get recommended models
  const getRecommendedModels = useCallback((taskType = 'general') => {
    // This function is still running in the renderer process
    // If modelDiscovery.getRecommendedModels needs to be in main, expose it via IPC
    return window.electronAPI.app.models.getRecommended(models, taskType)
  }, [models])

  // Filter models by capability
  const getModelsByCapability = useCallback((capability) => {
    return models.filter(model => model.capabilities && model.capabilities[capability])
  }, [models])

  // Clear error
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Setup auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(() => {
        loadModels(true) // Use cache for auto-refresh
      }, 60000) // Refresh every minute
      
      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current)
        }
      }
    }
  }, [autoRefresh, loadModels])

  // Load saved model from localStorage
  useEffect(() => {
    try {
      const savedModel = localStorage.getItem('locodex_selected_model')
      if (savedModel) {
        const model = JSON.parse(savedModel)
        setSelectedModel(model)
      }
    } catch (err) {
      console.warn('Failed to load saved model:', err)
    }
  }, [])

  // Initial load
  useEffect(() => {
    loadModels()
    
    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [loadModels])

  // Get statistics
  const getStats = useCallback(() => {
    const availableProviders = Object.values(providers).filter(p => p.status === 'available').length
    const totalProviders = Object.keys(providers).length
    const modelsByProvider = {}
    
    models.forEach(model => {
      if (!modelsByProvider[model.provider]) {
        modelsByProvider[model.provider] = 0
      }
      modelsByProvider[model.provider]++
    })

    return {
      totalModels: models.length,
      availableProviders,
      totalProviders,
      modelsByProvider,
      hasSelection: !!selectedModel,
      lastUpdated
    }
  }, [models, providers, selectedModel, lastUpdated])

  return {
    // State
    models,
    providers,
    selectedModel,
    isLoading,
    error,
    lastUpdated,
    autoRefresh,
    
    // Actions
    loadModels,
    refreshModels,
    selectModel,
    testModel,
    clearError,
    setAutoRefresh,
    
    // Getters
    getModelsByProvider,
    getRecommendedModels,
    getModelsByCapability,
    getProviderStatus,
    getStats
  }
}




