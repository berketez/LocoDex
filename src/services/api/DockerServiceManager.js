// Docker Service Manager for LocoDex
import mitt from 'mitt';

export class DockerServiceManager {
  constructor() {
    this.emitter = mitt();
    this.services = new Map();
    this.containers = new Map();
    this.isDockerAvailable = false;
    this.dockerVersion = null;
    this.composeVersion = null;
    
    this.initializeServices();
    this.checkDockerAvailability();
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

  initializeServices() {
    // AI Agent Service
    this.services.set('ai-agent', {
      name: 'LocoDex AI Agent',
      image: 'locodex/ai-agent:latest',
      port: 3001,
      internalPort: 3001,
      environment: {
        NODE_ENV: 'production',
        API_PORT: '3001',
        LOG_LEVEL: 'info'
      },
      volumes: [
        './data:/app/data',
        './logs:/app/logs'
      ],
      healthCheck: {
        endpoint: '/health',
        interval: 30000,
        timeout: 5000,
        retries: 3
      },
      status: 'stopped',
      containerId: null
    })

    // Sandbox Service
    this.services.set('sandbox', {
      name: 'LocoDex Sandbox',
      image: 'locodex/sandbox:latest',
      port: 3002,
      internalPort: 3002,
      environment: {
        SANDBOX_MODE: 'true',
        EXECUTION_TIMEOUT: '30',
        MAX_MEMORY: '512m'
      },
      volumes: [
        'sandbox-data:/home/sandbox/workspace'
      ],
      securityOpts: [
        'no-new-privileges:true'
      ],
      capDrop: ['ALL'],
      capAdd: ['SETUID', 'SETGID'],
      healthCheck: {
        endpoint: '/health',
        interval: 30000,
        timeout: 5000,
        retries: 3
      },
      status: 'stopped',
      containerId: null
    })

    // API Gateway Service
    this.services.set('api-gateway', {
      name: 'LocoDex API Gateway',
      image: 'nginx:alpine',
      port: 8080,
      internalPort: 80,
      volumes: [
        './nginx.conf:/etc/nginx/nginx.conf:ro'
      ],
      dependsOn: ['ai-agent', 'sandbox'],
      healthCheck: {
        endpoint: '/health',
        interval: 30000,
        timeout: 5000,
        retries: 3
      },
      status: 'stopped',
      containerId: null
    })
  }

  // Check if Docker is available
  async checkDockerAvailability() {
    try {
      // Check Docker daemon
      const dockerResult = await this.executeCommand('docker', ['version', '--format', 'json'])
      if (dockerResult.success) {
        const dockerInfo = JSON.parse(dockerResult.output)
        this.dockerVersion = dockerInfo.Client?.Version
        this.isDockerAvailable = true
      }

      // Check Docker Compose
      const composeResult = await this.executeCommand('docker-compose', ['version', '--short'])
      if (composeResult.success) {
        this.composeVersion = composeResult.output.trim()
      }

      this.emit('dockerStatusChanged', {
        available: this.isDockerAvailable,
        dockerVersion: this.dockerVersion,
        composeVersion: this.composeVersion
      })

      return this.isDockerAvailable
    } catch (error) {
      this.isDockerAvailable = false
      this.emit('dockerStatusChanged', {
        available: false,
        error: error.message
      })
      return false
    }
  }

  // Execute shell command
  async executeCommand(command, args = [], options = {}) {
    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && window.electronAPI) {
        // Use Electron's IPC for command execution
        window.electronAPI.executeCommand(command, args, options)
          .then(result => resolve(result))
          .catch(error => resolve({ success: false, error: error.message }))
      } else {
        // Fallback for non-Electron environments
        resolve({ success: false, error: 'Command execution not available' })
      }
    })
  }

  // Build Docker images
  async buildImages() {
    if (!this.isDockerAvailable) {
      throw new Error('Docker is not available')
    }

    const buildResults = {}

    try {
      this.emit('buildStarted')

      // Build AI Agent image
      this.emit('buildProgress', { service: 'ai-agent', status: 'building' })
      const aiAgentResult = await this.executeCommand('docker', [
        'build',
        '-t', 'locodex/ai-agent:latest',
        '-f', 'docker/Dockerfile.ai-agent',
        '.'
      ])
      buildResults['ai-agent'] = aiAgentResult

      // Build Sandbox image
      this.emit('buildProgress', { service: 'sandbox', status: 'building' })
      const sandboxResult = await this.executeCommand('docker', [
        'build',
        '-t', 'locodex/sandbox:latest',
        '-f', 'docker/Dockerfile.sandbox',
        '.'
      ])
      buildResults['sandbox'] = sandboxResult

      this.emit('buildCompleted', buildResults)
      return buildResults
    } catch (error) {
      this.emit('buildFailed', { error: error.message })
      throw error
    }
  }

  // Start all services using Docker Compose
  async startServices() {
    if (!this.isDockerAvailable) {
      throw new Error('Docker is not available')
    }

    try {
      this.emit('servicesStarting')

      const result = await this.executeCommand('docker-compose', [
        'up', '-d', '--build'
      ])

      if (result.success) {
        // Update service statuses
        for (const [serviceKey, service] of this.services.entries()) {
          service.status = 'starting'
          this.emit('serviceStatusChanged', { service: serviceKey, status: 'starting' })
        }

        // Wait for services to be healthy
        await this.waitForServicesHealth()

        this.emit('servicesStarted')
        return true
      } else {
        throw new Error(result.error || 'Failed to start services')
      }
    } catch (error) {
      this.emit('servicesStartFailed', { error: error.message })
      throw error
    }
  }

  // Stop all services
  async stopServices() {
    try {
      this.emit('servicesStopping')

      const result = await this.executeCommand('docker-compose', ['down'])

      if (result.success) {
        // Update service statuses
        for (const [serviceKey, service] of this.services.entries()) {
          service.status = 'stopped'
          service.containerId = null
          this.emit('serviceStatusChanged', { service: serviceKey, status: 'stopped' })
        }

        this.emit('servicesStopped')
        return true
      } else {
        throw new Error(result.error || 'Failed to stop services')
      }
    } catch (error) {
      this.emit('servicesStopFailed', { error: error.message })
      throw error
    }
  }

  // Restart services
  async restartServices() {
    await this.stopServices()
    await this.startServices()
  }

  // Start individual service
  async startService(serviceKey) {
    const service = this.services.get(serviceKey)
    if (!service) {
      throw new Error(`Service ${serviceKey} not found`)
    }

    try {
      const result = await this.executeCommand('docker-compose', [
        'up', '-d', serviceKey
      ])

      if (result.success) {
        service.status = 'starting'
        this.emit('serviceStatusChanged', { service: serviceKey, status: 'starting' })
        
        // Wait for health check
        await this.waitForServiceHealth(serviceKey)
        return true
      } else {
        throw new Error(result.error || `Failed to start ${serviceKey}`)
      }
    } catch (error) {
      service.status = 'failed'
      this.emit('serviceStatusChanged', { service: serviceKey, status: 'failed', error: error.message })
      throw error
    }
  }

  // Stop individual service
  async stopService(serviceKey) {
    const service = this.services.get(serviceKey)
    if (!service) {
      throw new Error(`Service ${serviceKey} not found`)
    }

    try {
      const result = await this.executeCommand('docker-compose', [
        'stop', serviceKey
      ])

      if (result.success) {
        service.status = 'stopped'
        service.containerId = null
        this.emit('serviceStatusChanged', { service: serviceKey, status: 'stopped' })
        return true
      } else {
        throw new Error(result.error || `Failed to stop ${serviceKey}`)
      }
    } catch (error) {
      this.emit('serviceStatusChanged', { service: serviceKey, status: 'failed', error: error.message })
      throw error
    }
  }

  // Wait for services to be healthy
  async waitForServicesHealth(timeout = 60000) {
    const startTime = Date.now()
    const serviceKeys = Array.from(this.services.keys())

    while (Date.now() - startTime < timeout) {
      let allHealthy = true

      for (const serviceKey of serviceKeys) {
        const isHealthy = await this.checkServiceHealth(serviceKey)
        if (!isHealthy) {
          allHealthy = false
          break
        }
      }

      if (allHealthy) {
        return true
      }

      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    throw new Error('Services failed to become healthy within timeout')
  }

  // Wait for individual service health
  async waitForServiceHealth(serviceKey, timeout = 30000) {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const isHealthy = await this.checkServiceHealth(serviceKey)
      if (isHealthy) {
        const service = this.services.get(serviceKey)
        service.status = 'running'
        this.emit('serviceStatusChanged', { service: serviceKey, status: 'running' })
        return true
      }

      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    throw new Error(`Service ${serviceKey} failed to become healthy within timeout`)
  }

  // Check individual service health
  async checkServiceHealth(serviceKey) {
    const service = this.services.get(serviceKey)
    if (!service || !service.healthCheck) {
      return false
    }

    try {
      const url = `http://localhost:${service.port}${service.healthCheck.endpoint}`
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(service.healthCheck.timeout)
      })

      return response.ok
    } catch (error) {
      return false
    }
  }

  // Get service status
  getServiceStatus(serviceKey) {
    if (serviceKey) {
      const service = this.services.get(serviceKey)
      return service ? {
        name: service.name,
        status: service.status,
        port: service.port,
        containerId: service.containerId
      } : null
    }

    // Return all services
    const status = {}
    for (const [key, service] of this.services.entries()) {
      status[key] = {
        name: service.name,
        status: service.status,
        port: service.port,
        containerId: service.containerId
      }
    }
    return status
  }

  // Get service logs
  async getServiceLogs(serviceKey, lines = 100) {
    const service = this.services.get(serviceKey)
    if (!service) {
      throw new Error(`Service ${serviceKey} not found`)
    }

    try {
      const result = await this.executeCommand('docker-compose', [
        'logs', '--tail', lines.toString(), serviceKey
      ])

      return result.success ? result.output : ''
    } catch (error) {
      throw new Error(`Failed to get logs for ${serviceKey}: ${error.message}`)
    }
  }

  // Get Docker system info
  async getDockerInfo() {
    if (!this.isDockerAvailable) {
      return null
    }

    try {
      const result = await this.executeCommand('docker', ['system', 'info', '--format', 'json'])
      return result.success ? JSON.parse(result.output) : null
    } catch (error) {
      return null
    }
  }

  // Clean up Docker resources
  async cleanup() {
    try {
      // Remove stopped containers
      await this.executeCommand('docker', ['container', 'prune', '-f'])
      
      // Remove unused images
      await this.executeCommand('docker', ['image', 'prune', '-f'])
      
      // Remove unused volumes
      await this.executeCommand('docker', ['volume', 'prune', '-f'])
      
      this.emit('cleanupCompleted')
      return true
    } catch (error) {
      this.emit('cleanupFailed', { error: error.message })
      throw error
    }
  }

  // Install Docker (platform-specific)
  async installDocker() {
    const platform = process.platform

    try {
      this.emit('dockerInstallStarted', { platform })

      let installCommand = []
      
      switch (platform) {
        case 'darwin': // macOS
          installCommand = ['brew', 'install', '--cask', 'docker']
          break
        
        case 'linux':
          // Ubuntu/Debian
          installCommand = [
            'curl', '-fsSL', 'https://get.docker.com', '-o', 'get-docker.sh',
            '&&', 'sh', 'get-docker.sh'
          ]
          break
        
        case 'win32': // Windows
          throw new Error('Please install Docker Desktop manually from https://docker.com/products/docker-desktop')
        
        default:
          throw new Error(`Unsupported platform: ${platform}`)
      }

      const result = await this.executeCommand(installCommand[0], installCommand.slice(1))
      
      if (result.success) {
        this.emit('dockerInstallCompleted')
        await this.checkDockerAvailability()
        return true
      } else {
        throw new Error(result.error || 'Installation failed')
      }
    } catch (error) {
      this.emit('dockerInstallFailed', { error: error.message })
      throw error
    }
  }

  // Generate Docker Compose file
  generateDockerCompose() {
    const compose = {
      version: '3.8',
      services: {},
      volumes: {
        'sandbox-data': {}
      },
      networks: {
        'locodex-network': {
          driver: 'bridge'
        }
      }
    }

    for (const [serviceKey, service] of this.services.entries()) {
      compose.services[serviceKey] = {
        image: service.image,
        ports: [`${service.port}:${service.internalPort}`],
        environment: service.environment,
        volumes: service.volumes,
        networks: ['locodex-network'],
        restart: 'unless-stopped'
      }

      if (service.dependsOn) {
        compose.services[serviceKey].depends_on = service.dependsOn
      }

      if (service.securityOpts) {
        compose.services[serviceKey].security_opt = service.securityOpts
      }

      if (service.capDrop) {
        compose.services[serviceKey].cap_drop = service.capDrop
      }

      if (service.capAdd) {
        compose.services[serviceKey].cap_add = service.capAdd
      }

      if (service.healthCheck) {
        compose.services[serviceKey].healthcheck = {
          test: [`CMD`, `curl`, `-f`, `http://localhost:${service.internalPort}${service.healthCheck.endpoint}`],
          interval: `${service.healthCheck.interval / 1000}s`,
          timeout: `${service.healthCheck.timeout / 1000}s`,
          retries: service.healthCheck.retries,
          start_period: '10s'
        }
      }
    }

    return compose
  }

  // Cleanup
  destroy() {
    this.removeAllListeners()
    this.services.clear()
    this.containers.clear()
  }
}

// Export singleton instance
export const dockerServiceManager = new DockerServiceManager()

export default dockerServiceManager

