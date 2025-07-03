// Enhanced API Client for Model Providers
import mitt from 'mitt';

export class ModelProviderAPI {
  constructor() {
    this.emitter = mitt();
    this.providers = new Map();
    this.connections = new Map();
    this.retryAttempts = 3;
    this.timeout = 15000;
    this.healthCheckInterval = 30000;
    this.healthCheckTimers = new Map();
    
    this.initializeProviders();
    this.startHealthChecks();
  }

  on(event, handler) {
    this.emitter.on(event, handler);
  }

  off(event, handler) {
    this.emitter.off(event, handler);
  }

  emit(event, data) {
    this.emitter.emit(event, data);
  }

  initializeProviders() {
    // Ollama Provider
    this.providers.set('ollama', {
      name: 'Ollama',
      baseUrl: 'http://localhost:11434',
      endpoints: {
        models: '/api/tags',
        chat: '/api/chat',
        generate: '/api/generate',
        embeddings: '/api/embeddings',
        pull: '/api/pull',
        push: '/api/push',
        delete: '/api/delete'
      },
      headers: {
        'Content-Type': 'application/json'
      },
      status: 'unknown',
      lastCheck: null,
      models: [],
      capabilities: ['chat', 'completion', 'embedding', 'vision']
    })

    // LM Studio Provider
    this.providers.set('lmstudio', {
      name: 'LM Studio',
      baseUrl: 'http://localhost:1234',
      endpoints: {
        models: '/v1/models',
        chat: '/v1/chat/completions',
        completions: '/v1/completions',
        embeddings: '/v1/embeddings'
      },
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LMSTUDIO_API_TOKEN || 'lm-studio'}`
      },
      status: 'unknown',
      lastCheck: null,
      models: [],
      capabilities: ['chat', 'completion', 'embedding']
    })

    // LocalAI Provider
    this.providers.set('localai', {
      name: 'LocalAI',
      baseUrl: 'http://localhost:8080',
      endpoints: {
        models: '/v1/models',
        chat: '/v1/chat/completions',
        completions: '/v1/completions',
        embeddings: '/v1/embeddings'
      },
      headers: {
        'Content-Type': 'application/json'
      },
      status: 'unknown',
      lastCheck: null,
      models: [],
      capabilities: ['chat', 'completion', 'embedding', 'vision']
    })
  }

  // Enhanced HTTP client with retry logic
  async makeRequest(url, options = {}) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    const requestOptions = {
      ...options,
      signal: controller.signal
    }

    let lastError = null

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, requestOptions)
        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        return await response.json()
      } catch (error) {
        lastError = error
        
        if (error.name === 'AbortError') {
          throw new Error('Request timeout')
        }

        if (attempt < this.retryAttempts) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError
  }

  // Check provider health
  async checkProviderHealth(providerKey) {
    const provider = this.providers.get(providerKey)
    if (!provider) return false

    try {
      const url = `${provider.baseUrl}${provider.endpoints.models}`
      await this.makeRequest(url, {
        method: 'GET',
        headers: provider.headers
      })

      provider.status = 'available'
      provider.lastCheck = new Date()
      this.emit('providerStatusChanged', { provider: providerKey, status: 'available' })
      return true
    } catch (error) {
      provider.status = 'offline'
      provider.lastCheck = new Date()
      this.emit('providerStatusChanged', { provider: providerKey, status: 'offline', error: error.message })
      return false
    }
  }

  // Start periodic health checks
  startHealthChecks() {
    for (const providerKey of this.providers.keys()) {
      const timer = setInterval(() => {
        this.checkProviderHealth(providerKey)
      }, this.healthCheckInterval)
      
      this.healthCheckTimers.set(providerKey, timer)
      
      // Initial health check
      this.checkProviderHealth(providerKey)
    }
  }

  // Stop health checks
  stopHealthChecks() {
    for (const timer of this.healthCheckTimers.values()) {
      clearInterval(timer)
    }
    this.healthCheckTimers.clear()
  }

  // Get models from Ollama
  async getOllamaModels() {
    const provider = this.providers.get('ollama')
    if (!provider || provider.status !== 'available') return []

    try {
      const url = `${provider.baseUrl}${provider.endpoints.models}`
      const data = await this.makeRequest(url, {
        method: 'GET',
        headers: provider.headers
      })

      const models = data.models?.map(model => ({
        id: model.name,
        name: model.name,
        provider: 'ollama',
        size: model.size,
        modified: model.modified_at,
        digest: model.digest,
        family: model.details?.family || 'unknown',
        parameters: model.details?.parameter_size || 'unknown',
        quantization: model.details?.quantization_level || 'unknown',
        format: model.details?.format || 'unknown',
        capabilities: this.detectCapabilities(model.name),
        status: 'available',
        metadata: {
          parent_model: model.details?.parent_model,
          template: model.template,
          system: model.system,
          license: model.license
        }
      })) || []

      provider.models = models
      this.emit('modelsUpdated', { provider: 'ollama', models })
      return models
    } catch (error) {
      this.emit('error', { provider: 'ollama', operation: 'getModels', error: error.message })
      return []
    }
  }

  // Get models from LM Studio
  async getLMStudioModels() {
    const provider = this.providers.get('lmstudio')
    if (!provider || provider.status !== 'available') return []

    try {
      const url = `${provider.baseUrl}${provider.endpoints.models}`
      const data = await this.makeRequest(url, {
        method: 'GET',
        headers: provider.headers
      })

      const models = data.data?.map(model => ({
        id: model.id,
        name: model.id,
        provider: 'lmstudio',
        created: model.created,
        owned_by: model.owned_by,
        object: model.object,
        capabilities: this.detectCapabilities(model.id),
        status: 'available',
        metadata: {
          permission: model.permission,
          root: model.root
        }
      })) || []

      provider.models = models
      this.emit('modelsUpdated', { provider: 'lmstudio', models })
      return models
    } catch (error) {
      this.emit('error', { provider: 'lmstudio', operation: 'getModels', error: error.message })
      return []
    }
  }

  // Get models from LocalAI
  async getLocalAIModels() {
    const provider = this.providers.get('localai')
    if (!provider || provider.status !== 'available') return []

    try {
      const url = `${provider.baseUrl}${provider.endpoints.models}`
      const data = await this.makeRequest(url, {
        method: 'GET',
        headers: provider.headers
      })

      const models = data.data?.map(model => ({
        id: model.id,
        name: model.id,
        provider: 'localai',
        created: model.created,
        owned_by: model.owned_by,
        object: model.object,
        capabilities: this.detectCapabilities(model.id),
        status: 'available',
        metadata: {}
      })) || []

      provider.models = models
      this.emit('modelsUpdated', { provider: 'localai', models })
      return models
    } catch (error) {
      this.emit('error', { provider: 'localai', operation: 'getModels', error: error.message })
      return []
    }
  }

  // Detect model capabilities based on name
  detectCapabilities(modelName) {
    const name = modelName.toLowerCase()
    
    return {
      chat: true, // Most models support chat
      completion: true, // Most models support completion
      embedding: name.includes('embed') || name.includes('embedding'),
      vision: name.includes('vision') || name.includes('llava') || name.includes('multimodal'),
      code: name.includes('code') || name.includes('coder') || name.includes('programming'),
      function_calling: name.includes('function') || name.includes('tool'),
      reasoning: name.includes('reasoning') || name.includes('think'),
      multilingual: name.includes('multilingual') || name.includes('translate')
    }
  }

  // Discover all models from all providers
  async discoverAllModels() {
    const results = {
      providers: {},
      models: [],
      totalModels: 0,
      availableProviders: 0,
      lastUpdated: new Date().toISOString(),
      errors: []
    }

    // Check all providers in parallel
    const providerPromises = Array.from(this.providers.keys()).map(async (providerKey) => {
      try {
        const isHealthy = await this.checkProviderHealth(providerKey)
        const provider = this.providers.get(providerKey)
        
        results.providers[providerKey] = {
          name: provider.name,
          status: provider.status,
          lastCheck: provider.lastCheck,
          models: [],
          capabilities: provider.capabilities
        }

        if (isHealthy) {
          results.availableProviders++
          
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
        }
      } catch (error) {
        results.errors.push({
          provider: providerKey,
          error: error.message,
          timestamp: new Date().toISOString()
        })
      }
    })

    await Promise.all(providerPromises)

    // Sort models by provider and name
    results.models.sort((a, b) => {
      if (a.provider !== b.provider) {
        return a.provider.localeCompare(b.provider)
      }
      return a.name.localeCompare(b.name)
    })

    this.emit('discoveryComplete', results)
    return results
  }

  // Send chat message to a model
  async sendChatMessage(model, messages, options = {}) {
    const provider = this.providers.get(model.provider)
    if (!provider || provider.status !== 'available') {
      throw new Error(`Provider ${model.provider} is not available`)
    }

    const payload = this.buildChatPayload(model, messages, options)
    const url = `${provider.baseUrl}${provider.endpoints.chat}`

    try {
      const response = await this.makeRequest(url, {
        method: 'POST',
        headers: provider.headers,
        body: JSON.stringify(payload)
      })

      return this.parseChatResponse(model.provider, response)
    } catch (error) {
      this.emit('error', { 
        provider: model.provider, 
        operation: 'sendChatMessage', 
        model: model.name,
        error: error.message 
      })
      throw error
    }
  }

  // Build chat payload based on provider
  buildChatPayload(model, messages, options) {
    const basePayload = {
      model: model.id,
      messages: messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 1000,
      stream: options.stream || false
    }

    switch (model.provider) {
      case 'ollama':
        return {
          ...basePayload,
          options: {
            temperature: basePayload.temperature,
            num_predict: basePayload.max_tokens,
            top_k: options.topK || 40,
            top_p: options.topP || 0.9,
            repeat_penalty: options.repeatPenalty || 1.1
          }
        }
      
      case 'lmstudio':
      case 'localai':
        return {
          ...basePayload,
          top_p: options.topP || 0.9,
          frequency_penalty: options.frequencyPenalty || 0,
          presence_penalty: options.presencePenalty || 0
        }
      
      default:
        return basePayload
    }
  }

  // Parse chat response based on provider
  parseChatResponse(provider, response) {
    switch (provider) {
      case 'ollama':
        return {
          content: response.message?.content || '',
          role: response.message?.role || 'assistant',
          done: response.done || false,
          total_duration: response.total_duration,
          load_duration: response.load_duration,
          prompt_eval_count: response.prompt_eval_count,
          eval_count: response.eval_count
        }
      
      case 'lmstudio':
      case 'localai': {
        const choice = response.choices?.[0]
        return {
          content: choice?.message?.content || '',
          role: choice?.message?.role || 'assistant',
          finish_reason: choice?.finish_reason,
          usage: response.usage
        }
      }
      
      default:
        return response
    }
  }

  // Test model connection
  async testModelConnection(model) {
    try {
      const testMessages = [
        { role: 'user', content: 'Hello, can you respond with just "OK"?' }
      ]

      const response = await this.sendChatMessage(model, testMessages, {
        maxTokens: 10,
        temperature: 0.1
      })

      return {
        success: true,
        response: response.content,
        latency: Date.now() // You might want to measure actual latency
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  // Get provider status
  getProviderStatus(providerKey) {
    if (providerKey) {
      const provider = this.providers.get(providerKey)
      return provider ? {
        name: provider.name,
        status: provider.status,
        lastCheck: provider.lastCheck,
        modelCount: provider.models.length,
        capabilities: provider.capabilities
      } : null
    }

    // Return all providers
    const status = {}
    for (const [key, provider] of this.providers.entries()) {
      status[key] = {
        name: provider.name,
        status: provider.status,
        lastCheck: provider.lastCheck,
        modelCount: provider.models.length,
        capabilities: provider.capabilities
      }
    }
    return status
  }

  // Get recommended models
  getRecommendedModels(models, taskType = 'general') {
    const recommendations = {
      general: ['llama3.2', 'llama3.1', 'mistral', 'phi3', 'qwen'],
      code: ['codellama', 'deepseek-coder', 'starcoder', 'code-llama', 'codeqwen'],
      vision: ['llava', 'vision', 'multimodal', 'cogvlm'],
      embedding: ['embed', 'embedding', 'nomic-embed', 'bge'],
      reasoning: ['reasoning', 'think', 'o1', 'chain-of-thought'],
      multilingual: ['multilingual', 'translate', 'polyglot']
    }

    const keywords = recommendations[taskType] || recommendations.general
    
    const recommended = models.filter(model => 
      keywords.some(keyword => 
        model.name.toLowerCase().includes(keyword.toLowerCase())
      )
    )

    // Sort by relevance and popularity
    return recommended.sort((a, b) => {
      // Prefer models with more capabilities
      const aCapCount = Object.values(a.capabilities || {}).filter(Boolean).length
      const bCapCount = Object.values(b.capabilities || {}).filter(Boolean).length
      
      if (aCapCount !== bCapCount) {
        return bCapCount - aCapCount
      }
      
      // Prefer smaller models for better performance
      if (a.size && b.size) {
        return a.size - b.size
      }
      
      return a.name.localeCompare(b.name)
    }).slice(0, 5)
  }

  // Cleanup
  destroy() {
    this.stopHealthChecks()
    this.removeAllListeners()
    this.providers.clear()
    this.connections.clear()
  }
}

// Export singleton instance
export const modelProviderAPI = new ModelProviderAPI()

export default modelProviderAPI

