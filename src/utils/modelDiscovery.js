// Model Discovery and Management Utilities
export class ModelDiscovery {
  constructor() {
    this.providers = {
      ollama: {
        name: 'Ollama',
        baseUrl: 'http://localhost:11434',
        apiPath: '/api',
        healthPath: '/api/tags',
        modelsPath: '/api/tags'
      },
      lmstudio: {
        name: 'LM Studio',
        baseUrl: 'http://localhost:1234',
        apiPath: '/v1',
        healthPath: '/v1/models',
        modelsPath: '/v1/models'
      },
      localai: {
        name: 'LocalAI',
        baseUrl: 'http://localhost:8080',
        apiPath: '/v1',
        healthPath: '/v1/models',
        modelsPath: '/v1/models'
      }
    }
    
    this.cache = new Map()
    this.lastUpdate = new Map()
    this.cacheTimeout = 30000 // 30 seconds
  }

  // Check if a provider is available
  async checkProviderHealth(providerKey) {
    try {
      const provider = this.providers[providerKey]
      if (!provider) return false

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

      const response = await fetch(`${provider.baseUrl}${provider.healthPath}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      return response.ok
    } catch (error) {
      console.warn(`Provider ${providerKey} health check failed:`, error.message)
      return false
    }
  }

  // Get models from Ollama
  async getOllamaModels() {
    try {
      const provider = this.providers.ollama
      const response = await fetch(`${provider.baseUrl}${provider.modelsPath}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000)
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()
      
      return data.models?.map(model => ({
        id: model.name,
        name: model.name,
        provider: 'ollama',
        size: model.size,
        modified: model.modified_at,
        family: model.details?.family || 'unknown',
        parameters: model.details?.parameter_size || 'unknown',
        quantization: model.details?.quantization_level || 'unknown',
        capabilities: {
          chat: true,
          completion: true,
          embedding: model.name.includes('embed'),
          vision: model.name.includes('vision') || model.name.includes('llava'),
          code: model.name.includes('code') || model.name.includes('coder')
        },
        status: 'available'
      })) || []
    } catch (error) {
      console.warn('Failed to fetch Ollama models:', error.message)
      return []
    }
  }

  // Get models from LM Studio
  async getLMStudioModels() {
    try {
      const provider = this.providers.lmstudio
      const response = await fetch(`${provider.baseUrl}${provider.modelsPath}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000)
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()
      
      return data.data?.map(model => ({
        id: model.id,
        name: model.id,
        provider: 'lmstudio',
        created: model.created,
        owned_by: model.owned_by,
        capabilities: {
          chat: true,
          completion: true,
          embedding: model.id.includes('embed'),
          vision: model.id.includes('vision'),
          code: model.id.includes('code')
        },
        status: 'available'
      })) || []
    } catch (error) {
      console.warn('Failed to fetch LM Studio models:', error.message)
      return []
    }
  }

  // Get models from LocalAI
  async getLocalAIModels() {
    try {
      const provider = this.providers.localai
      const response = await fetch(`${provider.baseUrl}${provider.modelsPath}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000)
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()
      
      return data.data?.map(model => ({
        id: model.id,
        name: model.id,
        provider: 'localai',
        created: model.created,
        owned_by: model.owned_by,
        capabilities: {
          chat: true,
          completion: true,
          embedding: model.id.includes('embed'),
          vision: model.id.includes('vision'),
          code: model.id.includes('code')
        },
        status: 'available'
      })) || []
    } catch (error) {
      console.warn('Failed to fetch LocalAI models:', error.message)
      return []
    }
  }

  // Discover all available models
  async discoverAllModels(useCache = true) {
    const cacheKey = 'all_models'
    const now = Date.now()
    
    // Check cache
    if (useCache && this.cache.has(cacheKey)) {
      const lastUpdate = this.lastUpdate.get(cacheKey) || 0
      if (now - lastUpdate < this.cacheTimeout) {
        return this.cache.get(cacheKey)
      }
    }

    const results = {
      providers: {},
      models: [],
      totalModels: 0,
      availableProviders: 0,
      lastUpdated: new Date().toISOString()
    }

    // Check each provider
    const providerChecks = Object.keys(this.providers).map(async (providerKey) => {
      const isHealthy = await this.checkProviderHealth(providerKey)
      
      results.providers[providerKey] = {
        name: this.providers[providerKey].name,
        status: isHealthy ? 'available' : 'offline',
        models: []
      }

      if (isHealthy) {
        results.availableProviders++
        
        try {
          let models = []
          switch (providerKey) {
            case 'ollama':
              models = await this.getOllamaModels()
              break
            case 'lmstudio':
              models = await this.getLMStudioModels()
              break
            case 'localai':
              models = await this.getLocalAIModels()
              break
          }
          
          results.providers[providerKey].models = models
          results.models.push(...models)
          results.totalModels += models.length
        } catch (error) {
          console.warn(`Failed to get models from ${providerKey}:`, error.message)
        }
      }
    })

    await Promise.all(providerChecks)

    // Sort models by provider and name
    results.models.sort((a, b) => {
      if (a.provider !== b.provider) {
        return a.provider.localeCompare(b.provider)
      }
      return a.name.localeCompare(b.name)
    })

    // Cache results
    this.cache.set(cacheKey, results)
    this.lastUpdate.set(cacheKey, now)

    return results
  }

  // Get recommended models based on task type
  getRecommendedModels(models, taskType = 'general') {
    const recommendations = {
      general: ['llama3.2', 'llama3.1', 'mistral', 'phi3'],
      code: ['codellama', 'deepseek-coder', 'starcoder', 'code-llama'],
      vision: ['llava', 'vision', 'multimodal'],
      embedding: ['embed', 'embedding', 'nomic-embed']
    }

    const keywords = recommendations[taskType] || recommendations.general
    
    return models.filter(model => 
      keywords.some(keyword => 
        model.name.toLowerCase().includes(keyword.toLowerCase())
      )
    ).slice(0, 5) // Return top 5 recommendations
  }

  // Test model connectivity
  async testModelConnection(model) {
    try {
      const provider = this.providers[model.provider]
      if (!provider) return false

      const testPayload = {
        model: model.id,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10,
        temperature: 0.1
      }

      const endpoint = model.provider === 'ollama' 
        ? `${provider.baseUrl}/api/chat`
        : `${provider.baseUrl}/v1/chat/completions`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(15000)
      })

      return response.ok
    } catch (error) {
      console.warn(`Model connection test failed for ${model.name}:`, error.message)
      return false
    }
  }

  // Clear cache
  clearCache() {
    this.cache.clear()
    this.lastUpdate.clear()
  }

  // Get provider status summary
  async getProviderStatus() {
    const status = {}
    
    for (const [key, provider] of Object.entries(this.providers)) {
      const isHealthy = await this.checkProviderHealth(key)
      status[key] = {
        name: provider.name,
        baseUrl: provider.baseUrl,
        status: isHealthy ? 'available' : 'offline',
        lastChecked: new Date().toISOString()
      }
    }
    
    return status
  }
}

// Export singleton instance
export const modelDiscovery = new ModelDiscovery()

// Utility functions for React components
export const useModelDiscovery = () => {
  return {
    discoverModels: () => modelDiscovery.discoverAllModels(),
    checkProvider: (provider) => modelDiscovery.checkProviderHealth(provider),
    testModel: (model) => modelDiscovery.testModelConnection(model),
    getRecommended: (models, taskType) => modelDiscovery.getRecommendedModels(models, taskType),
    getProviderStatus: () => modelDiscovery.getProviderStatus(),
    clearCache: () => modelDiscovery.clearCache()
  }
}


// Export convenience functions
export const discoverModels = () => modelDiscovery.discoverAllModels()
export const testModelConnection = (model) => modelDiscovery.testModelConnection(model)
export const checkProviderHealth = (provider) => modelDiscovery.checkProviderHealth(provider)
export const getRecommendedModels = (models, taskType) => modelDiscovery.getRecommendedModels(models, taskType)
export const getProviderStatus = () => modelDiscovery.getProviderStatus()
export const clearCache = () => modelDiscovery.clearCache()

export default modelDiscovery

