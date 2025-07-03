// Sandbox Execution Service for LocoDex
import mitt from 'mitt';

export class SandboxExecutionService {
  constructor() {
    this.emitter = mitt();
    this.sandboxes = new Map();
    this.executionQueue = [];
    this.maxConcurrentExecutions = 3;
    this.currentExecutions = 0;
    this.defaultTimeout = 30000; // 30 seconds
    this.maxMemory = 512 * 1024 * 1024; // 512MB
    this.allowedCommands = new Set([
      'python3', 'python', 'node', 'npm', 'pip3', 'pip',
      'git', 'curl', 'wget', 'ls', 'cat', 'echo', 'mkdir',
      'cd', 'pwd', 'touch', 'rm', 'cp', 'mv'
    ]);
    
    this.initializeSandboxEnvironments();
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

  // Initialize sandbox environments
  initializeSandboxEnvironments() {
    // Python sandbox
    this.sandboxes.set('python', {
      name: 'Python Sandbox',
      language: 'python',
      interpreter: 'python3',
      fileExtension: '.py',
      dockerImage: 'python:3.11-alpine',
      allowedPackages: [
        'numpy', 'pandas', 'matplotlib', 'seaborn', 'requests',
        'beautifulsoup4', 'flask', 'fastapi', 'sqlalchemy'
      ],
      securityRestrictions: {
        networkAccess: false,
        fileSystemAccess: 'restricted',
        maxExecutionTime: 30000,
        maxMemoryUsage: 256 * 1024 * 1024
      }
    })

    // Node.js sandbox
    this.sandboxes.set('nodejs', {
      name: 'Node.js Sandbox',
      language: 'javascript',
      interpreter: 'node',
      fileExtension: '.js',
      dockerImage: 'node:18-alpine',
      allowedPackages: [
        'express', 'lodash', 'axios', 'moment', 'uuid',
        'bcrypt', 'jsonwebtoken', 'cors', 'helmet'
      ],
      securityRestrictions: {
        networkAccess: false,
        fileSystemAccess: 'restricted',
        maxExecutionTime: 30000,
        maxMemoryUsage: 256 * 1024 * 1024
      }
    })

    // Shell sandbox
    this.sandboxes.set('shell', {
      name: 'Shell Sandbox',
      language: 'bash',
      interpreter: 'bash',
      fileExtension: '.sh',
      dockerImage: 'alpine:latest',
      allowedPackages: [],
      securityRestrictions: {
        networkAccess: false,
        fileSystemAccess: 'restricted',
        maxExecutionTime: 15000,
        maxMemoryUsage: 128 * 1024 * 1024
      }
    })
  }

  // Execute code in sandbox
  async executeCode(code, language = 'python', options = {}) {
    const executionId = this.generateExecutionId()
    const sandbox = this.sandboxes.get(language)
    
    if (!sandbox) {
      throw new Error(`Unsupported language: ${language}`)
    }

    // Validate code
    this.validateCode(code, language)

    const execution = {
      id: executionId,
      code,
      language,
      sandbox,
      options: {
        timeout: options.timeout || sandbox.securityRestrictions.maxExecutionTime,
        memory: options.memory || sandbox.securityRestrictions.maxMemoryUsage,
        networkAccess: options.networkAccess || sandbox.securityRestrictions.networkAccess,
        ...options
      },
      status: 'queued',
      startTime: null,
      endTime: null,
      result: null,
      error: null
    }

    // Add to queue
    this.executionQueue.push(execution)
    this.emit('executionQueued', { executionId, position: this.executionQueue.length })

    // Process queue
    this.processExecutionQueue()

    // Return promise that resolves when execution completes
    return new Promise((resolve, reject) => {
      const checkExecution = () => {
        const currentExecution = this.findExecution(executionId)
        if (!currentExecution) {
          reject(new Error('Execution not found'))
          return
        }

        if (currentExecution.status === 'completed') {
          resolve(currentExecution.result)
        } else if (currentExecution.status === 'failed') {
          reject(new Error(currentExecution.error))
        } else {
          setTimeout(checkExecution, 100)
        }
      }

      checkExecution()
    })
  }

  // Process execution queue
  async processExecutionQueue() {
    if (this.currentExecutions >= this.maxConcurrentExecutions || this.executionQueue.length === 0) {
      return
    }

    const execution = this.executionQueue.shift()
    this.currentExecutions++

    try {
      await this.runExecution(execution)
    } catch (error) {
      execution.status = 'failed'
      execution.error = error.message
      execution.endTime = new Date()
      this.emit('executionFailed', execution)
    } finally {
      this.currentExecutions--
      // Process next in queue
      setTimeout(() => this.processExecutionQueue(), 0)
    }
  }

  // Run individual execution
  async runExecution(execution) {
    execution.status = 'running'
    execution.startTime = new Date()
    this.emit('executionStarted', execution)

    try {
      // Create temporary file
      const fileName = `exec_${execution.id}${execution.sandbox.fileExtension}`
      const filePath = `/tmp/${fileName}`

      // Write code to file
      await this.writeCodeToFile(filePath, execution.code)

      // Execute in Docker container
      const result = await this.executeInDocker(execution, filePath)

      execution.status = 'completed'
      execution.result = result
      execution.endTime = new Date()
      this.emit('executionCompleted', execution)

    } catch (error) {
      execution.status = 'failed'
      execution.error = error.message
      execution.endTime = new Date()
      this.emit('executionFailed', execution)
      throw error
    }
  }

  // Execute code in Docker container
  async executeInDocker(execution, filePath) {
    const { sandbox, options } = execution
    
    const dockerArgs = [
      'run',
      '--rm',
      '--network', 'none', // No network access
      '--memory', `${Math.floor(options.memory / 1024 / 1024)}m`,
      '--cpus', '0.5',
      '--user', 'nobody',
      '--read-only',
      '--tmpfs', '/tmp:rw,noexec,nosuid,size=100m',
      '--tmpfs', '/var/tmp:rw,noexec,nosuid,size=100m',
      '--security-opt', 'no-new-privileges:true',
      '--cap-drop', 'ALL',
      '--pids-limit', '50',
      '--ulimit', 'nproc=50:50',
      '--ulimit', 'nofile=100:100',
      '-v', `${filePath}:/app/code${sandbox.fileExtension}:ro`,
      sandbox.dockerImage
    ]

    // Add execution command
    switch (sandbox.language) {
      case 'python':
        dockerArgs.push(sandbox.interpreter, '/app/code.py')
        break
      case 'javascript':
        dockerArgs.push(sandbox.interpreter, '/app/code.js')
        break
      case 'bash':
        dockerArgs.push(sandbox.interpreter, '/app/code.sh')
        break
      default:
        throw new Error(`Unsupported language: ${sandbox.language}`)
    }

    // Execute with timeout
    const result = await this.executeCommandWithTimeout('docker', dockerArgs, options.timeout)
    
    // Clean up temporary file
    await this.cleanupFile(filePath)

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      executionTime: result.executionTime,
      memoryUsage: result.memoryUsage
    }
  }

  // Execute command with timeout
  async executeCommandWithTimeout(command, args, timeout) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now()
      
      if (typeof window !== 'undefined' && window.electronAPI) {
        // Use Electron's IPC for command execution
        const timeoutId = setTimeout(() => {
          reject(new Error('Execution timeout'))
        }, timeout)

        window.electronAPI.executeCommand(command, args, { timeout })
          .then(result => {
            clearTimeout(timeoutId)
            resolve({
              ...result,
              executionTime: Date.now() - startTime
            })
          })
          .catch(error => {
            clearTimeout(timeoutId)
            reject(error)
          })
      } else {
        reject(new Error('Command execution not available'))
      }
    })
  }

  // Write code to temporary file
  async writeCodeToFile(filePath, code) {
    if (typeof window !== 'undefined' && window.electronAPI) {
      return window.electronAPI.writeFile(filePath, code)
    } else {
      throw new Error('File system access not available')
    }
  }

  // Clean up temporary file
  async cleanupFile(filePath) {
    if (typeof window !== 'undefined' && window.electronAPI) {
      return window.electronAPI.deleteFile(filePath)
    }
  }

  // Validate code for security
  validateCode(code, language) {
    const dangerousPatterns = [
      // File system operations
      /import\s+os/gi,
      /import\s+subprocess/gi,
      /import\s+sys/gi,
      /require\s*\(\s*['"]fs['"]\s*\)/gi,
      /require\s*\(\s*['"]child_process['"]\s*\)/gi,
      
      // Network operations
      /import\s+socket/gi,
      /import\s+urllib/gi,
      /import\s+requests/gi,
      /require\s*\(\s*['"]http['"]\s*\)/gi,
      /require\s*\(\s*['"]https['"]\s*\)/gi,
      /require\s*\(\s*['"]net['"]\s*\)/gi,
      
      // Dangerous functions
      /eval\s*\(/gi,
      /exec\s*\(/gi,
      /system\s*\(/gi,
      /shell_exec/gi,
      /passthru/gi,
      
      // File operations
      /open\s*\(/gi,
      /file\s*\(/gi,
      /fopen/gi,
      /readfile/gi,
      /file_get_contents/gi,
      
      // Process operations
      /fork\s*\(/gi,
      /spawn/gi,
      /process\./gi
    ]

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        throw new Error(`Potentially dangerous code detected: ${pattern.source}`)
      }
    }

    // Check for command injection
    const commandInjectionPatterns = [
      /;\s*rm\s+/gi,
      /;\s*sudo\s+/gi,
      /;\s*su\s+/gi,
      /;\s*chmod\s+/gi,
      /;\s*chown\s+/gi,
      /&&\s*rm\s+/gi,
      /\|\s*rm\s+/gi,
      /`.*`/gi, // Backticks
      /\$\(.*\)/gi // Command substitution
    ]

    for (const pattern of commandInjectionPatterns) {
      if (pattern.test(code)) {
        throw new Error(`Command injection attempt detected: ${pattern.source}`)
      }
    }

    // Language-specific validations
    switch (language) {
      case 'python':
        this.validatePythonCode(code)
        break
      case 'javascript':
        this.validateJavaScriptCode(code)
        break
      case 'bash':
        this.validateBashCode(code)
        break
    }
  }

  // Validate Python code
  validatePythonCode(code) {
    const pythonDangerousPatterns = [
      /__import__/gi,
      /getattr/gi,
      /setattr/gi,
      /delattr/gi,
      /globals\s*\(/gi,
      /locals\s*\(/gi,
      /vars\s*\(/gi,
      /dir\s*\(/gi,
      /compile\s*\(/gi,
      /execfile/gi
    ]

    for (const pattern of pythonDangerousPatterns) {
      if (pattern.test(code)) {
        throw new Error(`Dangerous Python function detected: ${pattern.source}`)
      }
    }
  }

  // Validate JavaScript code
  validateJavaScriptCode(code) {
    const jsDangerousPatterns = [
      /Function\s*\(/gi,
      /setTimeout\s*\(/gi,
      /setInterval\s*\(/gi,
      /setImmediate\s*\(/gi,
      /process\.exit/gi,
      /process\.kill/gi,
      /global\./gi,
      /window\./gi,
      /document\./gi
    ]

    for (const pattern of jsDangerousPatterns) {
      if (pattern.test(code)) {
        throw new Error(`Dangerous JavaScript function detected: ${pattern.source}`)
      }
    }
  }

  // Validate Bash code
  validateBashCode(code) {
    const bashDangerousPatterns = [
      /rm\s+-rf/gi,
      /sudo\s+/gi,
      /su\s+/gi,
      /chmod\s+/gi,
      /chown\s+/gi,
      /passwd/gi,
      /useradd/gi,
      /userdel/gi,
      /groupadd/gi,
      /groupdel/gi,
      /mount\s+/gi,
      /umount\s+/gi,
      /fdisk/gi,
      /mkfs/gi,
      /dd\s+/gi
    ]

    for (const pattern of bashDangerousPatterns) {
      if (pattern.test(code)) {
        throw new Error(`Dangerous Bash command detected: ${pattern.source}`)
      }
    }
  }

  // Install package in sandbox
  async installPackage(packageName, language = 'python') {
    const sandbox = this.sandboxes.get(language)
    if (!sandbox) {
      throw new Error(`Unsupported language: ${language}`)
    }

    // Check if package is allowed
    if (!sandbox.allowedPackages.includes(packageName)) {
      throw new Error(`Package ${packageName} is not allowed in ${language} sandbox`)
    }

    let installCommand = []
    switch (language) {
      case 'python':
        installCommand = ['pip3', 'install', packageName]
        break
      case 'javascript':
        installCommand = ['npm', 'install', packageName]
        break
      default:
        throw new Error(`Package installation not supported for ${language}`)
    }

    try {
      const result = await this.executeCommandWithTimeout(
        installCommand[0], 
        installCommand.slice(1), 
        60000 // 1 minute timeout for package installation
      )

      this.emit('packageInstalled', { language, packageName, result })
      return result
    } catch (error) {
      this.emit('packageInstallFailed', { language, packageName, error: error.message })
      throw error
    }
  }

  // Get execution status
  getExecutionStatus(executionId) {
    return this.findExecution(executionId) || null
  }

  // Get queue status
  getQueueStatus() {
    return {
      queueLength: this.executionQueue.length,
      currentExecutions: this.currentExecutions,
      maxConcurrentExecutions: this.maxConcurrentExecutions
    }
  }

  // Get sandbox information
  getSandboxInfo(language) {
    if (language) {
      return this.sandboxes.get(language) || null
    }

    const info = {}
    for (const [key, sandbox] of this.sandboxes.entries()) {
      info[key] = {
        name: sandbox.name,
        language: sandbox.language,
        interpreter: sandbox.interpreter,
        allowedPackages: sandbox.allowedPackages,
        securityRestrictions: sandbox.securityRestrictions
      }
    }
    return info
  }

  // Find execution by ID
  findExecution(executionId) {
    // Check queue
    const queuedExecution = this.executionQueue.find(exec => exec.id === executionId)
    if (queuedExecution) return queuedExecution

    // Check completed executions (you might want to store these)
    return null
  }

  // Generate unique execution ID
  generateExecutionId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Cleanup
  destroy() {
    this.removeAllListeners()
    this.sandboxes.clear()
    this.executionQueue.length = 0
  }
}

// Export singleton instance
export const sandboxExecutionService = new SandboxExecutionService()

export default sandboxExecutionService

