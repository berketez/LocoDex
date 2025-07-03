// Main API Service Orchestrator for LocoDex
import mitt from 'mitt';
import { modelProviderAPI } from './ModelProviderAPI.js';
import { dockerServiceManager } from './DockerServiceManager.js';
import { sandboxExecutionService } from './SandboxExecutionService.js';

export class LocoDexAPIService {
  constructor() {
    this.emitter = mitt();
    this.modelProvider = modelProviderAPI;
    this.dockerManager = dockerServiceManager;
    this.sandboxService = sandboxExecutionService;
    this.isInitialized = false;
    this.connectionStatus = {
      models: 'disconnected',
      docker: 'disconnected',
      sandbox: 'disconnected'
    };
    
    this.initializeServices();
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

  // Initialize all services
  async initializeServices() {
    try {
      this.emit('initializationStarted')

      // Set up event listeners
      this.setupEventListeners()

      // Check Docker availability
      const dockerAvailable = await this.dockerManager.checkDockerAvailability()
      this.connectionStatus.docker = dockerAvailable ? 'connected' : 'disconnected'

      // Initialize model providers
      await this.initializeModelProviders()

      // Initialize sandbox if Docker is available
      if (dockerAvailable) {
        await this.initializeSandbox()
      }

      this.isInitialized = true
      this.emit('initializationCompleted', this.connectionStatus)
    } catch (error) {
      this.emit('initializationFailed', { error: error.message })
      throw error
    }
  }

  // Set up event listeners for all services
  setupEventListeners() {
    // Model Provider Events
    this.modelProvider.on('providerStatusChanged', (data) => {
      this.emit('providerStatusChanged', data)
      this.updateConnectionStatus()
    })

    this.modelProvider.on('modelsUpdated', (data) => {
      this.emit('modelsUpdated', data)
    })

    this.modelProvider.on('discoveryComplete', (data) => {
      this.emit('discoveryComplete', data)
    })

    this.modelProvider.on('error', (data) => {
      this.emit('modelProviderError', data)
    })

    // Docker Manager Events
    this.dockerManager.on('dockerStatusChanged', (data) => {
      this.emit('dockerStatusChanged', data)
      this.connectionStatus.docker = data.available ? 'connected' : 'disconnected'
      this.updateConnectionStatus()
    })

    this.dockerManager.on('servicesStarted', () => {
      this.emit('servicesStarted')
      this.connectionStatus.sandbox = 'connected'
      this.updateConnectionStatus()
    })

    this.dockerManager.on('servicesStopped', () => {
      this.emit('servicesStopped')
      this.connectionStatus.sandbox = 'disconnected'
      this.updateConnectionStatus()
    })

    this.dockerManager.on('serviceStatusChanged', (data) => {
      this.emit('serviceStatusChanged', data)
    })

    // Sandbox Service Events
    this.sandboxService.on('executionStarted', (data) => {
      this.emit('executionStarted', data)
    })

    this.sandboxService.on('executionCompleted', (data) => {
      this.emit('executionCompleted', data)
    })

    this.sandboxService.on('executionFailed', (data) => {
      this.emit('executionFailed', data)
    })
  }

  // Initialize model providers
  async initializeModelProviders() {
    try {
      const discovery = await this.modelProvider.discoverAllModels()
      this.connectionStatus.models = discovery.availableProviders > 0 ? 'connected' : 'disconnected'
      return discovery
    } catch (error) {
      this.connectionStatus.models = 'disconnected'
      throw error
    }
  }

  // Initialize sandbox services
  async initializeSandbox() {
    try {
      if (this.connectionStatus.docker === 'connected') {
        // Start Docker services if not already running
        const serviceStatus = this.dockerManager.getServiceStatus()
        const hasRunningServices = Object.values(serviceStatus).some(service => service.status === 'running')
        
        if (!hasRunningServices) {
          await this.dockerManager.startServices()
        }
        
        this.connectionStatus.sandbox = 'connected'
      }
    } catch (error) {
      this.connectionStatus.sandbox = 'disconnected'
      throw error
    }
  }

  // Update overall connection status
  updateConnectionStatus() {
    const overallStatus = {
      ...this.connectionStatus,
      overall: Object.values(this.connectionStatus).every(status => status === 'connected') ? 'connected' : 'partial'
    }
    
    this.emit('connectionStatusChanged', overallStatus)
  }

  // Discover available models
  async discoverModels() {
    try {
      return await this.modelProvider.discoverAllModels()
    } catch (error) {
      this.emit('error', { operation: 'discoverModels', error: error.message })
      throw error
    }
  }

  // Send message to AI model
  async sendMessage(modelId, messages, options = {}) {
    try {
      // Find the model
      const discovery = await this.modelProvider.discoverAllModels()
      const model = discovery.models.find(m => m.id === modelId)
      
      if (!model) {
        throw new Error(`Model ${modelId} not found`)
      }

      // Send message
      const response = await this.modelProvider.sendChatMessage(model, messages, options)
      
      this.emit('messageProcessed', { model, messages, response })
      return response
    } catch (error) {
      this.emit('error', { operation: 'sendMessage', error: error.message })
      throw error
    }
  }

  // Execute code in sandbox
  async executeCode(code, language = 'python', options = {}) {
    try {
      if (this.connectionStatus.sandbox !== 'connected') {
        throw new Error('Sandbox service is not available')
      }

      const result = await this.sandboxService.executeCode(code, language, options)
      
      this.emit('codeExecuted', { code, language, result })
      return result
    } catch (error) {
      this.emit('error', { operation: 'executeCode', error: error.message })
      throw error
    }
  }

  // Install package in sandbox
  async installPackage(packageName, language = 'python') {
    try {
      if (this.connectionStatus.sandbox !== 'connected') {
        throw new Error('Sandbox service is not available')
      }

      const result = await this.sandboxService.installPackage(packageName, language)
      
      this.emit('packageInstalled', { packageName, language, result })
      return result
    } catch (error) {
      this.emit('error', { operation: 'installPackage', error: error.message })
      throw error
    }
  }

  // Test model connection
  async testModel(modelId) {
    try {
      const discovery = await this.modelProvider.discoverAllModels()
      const model = discovery.models.find(m => m.id === modelId)
      
      if (!model) {
        throw new Error(`Model ${modelId} not found`)
      }

      const result = await this.modelProvider.testModelConnection(model)
      
      this.emit('modelTested', { model, result })
      return result
    } catch (error) {
      this.emit('error', { operation: 'testModel', error: error.message })
      throw error
    }
  }

  // Get system status
  getSystemStatus() {
    return {
      initialized: this.isInitialized,
      connectionStatus: this.connectionStatus,
      modelProviders: this.modelProvider.getProviderStatus(),
      dockerServices: this.dockerManager.getServiceStatus(),
      sandboxInfo: this.sandboxService.getSandboxInfo(),
      queueStatus: this.sandboxService.getQueueStatus()
    }
  }

  // Get recommended models
  getRecommendedModels(taskType = 'general') {
    try {
      const discovery = this.modelProvider.discoverAllModels()
      return this.modelProvider.getRecommendedModels(discovery.models, taskType)
    } catch (error) {
      this.emit('error', { operation: 'getRecommendedModels', error: error.message })
      return []
    }
  }

  // Start Docker services
  async startDockerServices() {
    try {
      if (this.connectionStatus.docker !== 'connected') {
        throw new Error('Docker is not available')
      }

      await this.dockerManager.startServices()
      this.connectionStatus.sandbox = 'connected'
      this.updateConnectionStatus()
      
      return true
    } catch (error) {
      this.emit('error', { operation: 'startDockerServices', error: error.message })
      throw error
    }
  }

  // Stop Docker services
  async stopDockerServices() {
    try {
      await this.dockerManager.stopServices()
      this.connectionStatus.sandbox = 'disconnected'
      this.updateConnectionStatus()
      
      return true
    } catch (error) {
      this.emit('error', { operation: 'stopDockerServices', error: error.message })
      throw error
    }
  }

  // Restart Docker services
  async restartDockerServices() {
    try {
      await this.dockerManager.restartServices()
      return true
    } catch (error) {
      this.emit('error', { operation: 'restartDockerServices', error: error.message })
      throw error
    }
  }

  // Install Docker
  async installDocker() {
    try {
      await this.dockerManager.installDocker()
      return true
    } catch (error) {
      this.emit('error', { operation: 'installDocker', error: error.message })
      throw error
    }
  }

  // Get service logs
  async getServiceLogs(serviceName, lines = 100) {
    try {
      return await this.dockerManager.getServiceLogs(serviceName, lines)
    } catch (error) {
      this.emit('error', { operation: 'getServiceLogs', error: error.message })
      throw error
    }
  }

  // Cleanup Docker resources
  async cleanupDocker() {
    try {
      await this.dockerManager.cleanup()
      return true
    } catch (error) {
      this.emit('error', { operation: 'cleanupDocker', error: error.message })
      throw error
    }
  }

  // Health check for all services
  async healthCheck() {
    const health = {
      timestamp: new Date().toISOString(),
      overall: 'healthy',
      services: {}
    }

    try {
      // Check model providers
      const modelStatus = this.modelProvider.getProviderStatus()
      health.services.models = {
        status: Object.values(modelStatus).some(p => p.status === 'available') ? 'healthy' : 'unhealthy',
        providers: modelStatus
      }

      // Check Docker
      const dockerInfo = await this.dockerManager.getDockerInfo()
      health.services.docker = {
        status: dockerInfo ? 'healthy' : 'unhealthy',
        info: dockerInfo
      }

      // Check sandbox
      const queueStatus = this.sandboxService.getQueueStatus()
      health.services.sandbox = {
        status: this.connectionStatus.sandbox === 'connected' ? 'healthy' : 'unhealthy',
        queue: queueStatus
      }

      // Determine overall health
      const serviceStatuses = Object.values(health.services).map(s => s.status)
      if (serviceStatuses.every(s => s === 'healthy')) {
        health.overall = 'healthy'
      } else if (serviceStatuses.some(s => s === 'healthy')) {
        health.overall = 'degraded'
      } else {
        health.overall = 'unhealthy'
      }

      this.emit('healthCheckCompleted', health)
      return health
    } catch (error) {
      health.overall = 'unhealthy'
      health.error = error.message
      this.emit('healthCheckFailed', health)
      return health
    }
  }

  // Shutdown all services
  async shutdown() {
    try {
      this.emit('shutdownStarted')

      // Stop Docker services
      if (this.connectionStatus.docker === 'connected') {
        await this.dockerManager.stopServices()
      }

      // Stop health checks
      this.modelProvider.stopHealthChecks()

      // Clean up event listeners
      this.removeAllListeners()
      this.modelProvider.destroy()
      this.dockerManager.destroy()
      this.sandboxService.destroy()

      this.emit('shutdownCompleted')
    } catch (error) {
      this.emit('shutdownFailed', { error: error.message })
      throw error
    }
  }
}

// Export singleton instance
export const locoDexAPI = new LocoDexAPIService()

// Export convenience functions
export const discoverModels = () => locoDexAPI.discoverModels()
export const sendMessage = (modelId, messages, options) => locoDexAPI.sendMessage(modelId, messages, options)
export const executeCode = (code, language, options) => locoDexAPI.executeCode(code, language, options)
export const testModel = (modelId) => locoDexAPI.testModel(modelId)
export const getSystemStatus = () => locoDexAPI.getSystemStatus()
export const healthCheck = () => locoDexAPI.healthCheck()

export default locoDexAPI

