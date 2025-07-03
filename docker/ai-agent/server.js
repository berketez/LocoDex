// LocoDex AI Agent Server
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const fetch = require('node-fetch')
const WebSocket = require('ws')
const http = require('http')
const path = require('path')
const fs = require('fs').promises
const { spawn } = require('child_process')

const app = express()
const server = http.createServer(app)
const wss = new WebSocket.Server({ server })

const PORT = process.env.API_PORT || 3001
const LOG_LEVEL = process.env.LOG_LEVEL || 'info'
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'localhost:11434'
const LMSTUDIO_HOST = process.env.LMSTUDIO_HOST || 'localhost:1234'

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  }
}))

// CORS configuration
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
})
app.use('/api/', limiter)

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ${req.method} ${req.path} - ${req.ip}`)
  next()
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0'
  })
})

// Model provider discovery
app.get('/api/models/discover', async (req, res) => {
  try {
    const providers = {}
    const models = []

    // Check Ollama
    try {
      const ollamaResponse = await fetch(`http://${OLLAMA_HOST}/api/tags`)
      if (ollamaResponse.ok) {
        const ollamaData = await ollamaResponse.json()
        providers.ollama = {
          name: 'Ollama',
          status: 'available',
          models: ollamaData.models?.length || 0
        }
        
        ollamaData.models?.forEach(model => {
          models.push({
            id: model.name,
            name: model.name,
            provider: 'ollama',
            size: model.size,
            modified: model.modified_at,
            capabilities: {
              chat: true,
              completion: true,
              embedding: model.name.includes('embed'),
              vision: model.name.includes('vision') || model.name.includes('llava')
            }
          })
        })
      }
    } catch (error) {
      providers.ollama = {
        name: 'Ollama',
        status: 'offline',
        error: error.message
      }
    }

    // Check LM Studio
    try {
      const lmstudioResponse = await fetch(`http://${LMSTUDIO_HOST}/v1/models`)
      if (lmstudioResponse.ok) {
        const lmstudioData = await lmstudioResponse.json()
        providers.lmstudio = {
          name: 'LM Studio',
          status: 'available',
          models: lmstudioData.data?.length || 0
        }
        
        lmstudioData.data?.forEach(model => {
          models.push({
            id: model.id,
            name: model.id,
            provider: 'lmstudio',
            created: model.created,
            capabilities: {
              chat: true,
              completion: true,
              embedding: model.id.includes('embed'),
              vision: model.id.includes('vision')
            }
          })
        })
      }
    } catch (error) {
      providers.lmstudio = {
        name: 'LM Studio',
        status: 'offline',
        error: error.message
      }
    }

    res.json({
      providers,
      models,
      totalModels: models.length,
      availableProviders: Object.values(providers).filter(p => p.status === 'available').length,
      lastUpdated: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({
      error: 'Model discovery failed',
      details: error.message
    })
  }
})

// Chat completion endpoint
app.post('/api/chat/completions', async (req, res) => {
  try {
    const { model, messages, temperature = 0.7, max_tokens = 1000 } = req.body

    if (!model || !messages) {
      return res.status(400).json({
        error: 'Missing required fields: model, messages'
      })
    }

    // Determine provider from model name
    let provider = 'ollama'
    let endpoint = `http://${OLLAMA_HOST}/api/chat`
    
    if (model.includes('lmstudio') || model.startsWith('gpt')) {
      provider = 'lmstudio'
      endpoint = `http://${LMSTUDIO_HOST}/v1/chat/completions`
    }

    // Build request payload
    let payload
    if (provider === 'ollama') {
      payload = {
        model: model,
        messages: messages,
        stream: false,
        options: {
          temperature: temperature,
          num_predict: max_tokens
        }
      }
    } else {
      payload = {
        model: model,
        messages: messages,
        temperature: temperature,
        max_tokens: max_tokens
      }
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error(`Provider responded with ${response.status}`)
    }

    const data = await response.json()
    
    // Normalize response format
    let normalizedResponse
    if (provider === 'ollama') {
      normalizedResponse = {
        choices: [{
          message: {
            role: data.message?.role || 'assistant',
            content: data.message?.content || ''
          },
          finish_reason: data.done ? 'stop' : 'length'
        }],
        usage: {
          prompt_tokens: data.prompt_eval_count || 0,
          completion_tokens: data.eval_count || 0,
          total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
        }
      }
    } else {
      normalizedResponse = data
    }

    res.json(normalizedResponse)
  } catch (error) {
    res.status(500).json({
      error: 'Chat completion failed',
      details: error.message
    })
  }
})

// Code execution endpoint
app.post('/api/execute', async (req, res) => {
  try {
    const { code, language = 'python', timeout = 30000 } = req.body

    if (!code) {
      return res.status(400).json({
        error: 'Missing required field: code'
      })
    }

    // Validate language
    const supportedLanguages = ['python', 'javascript', 'bash']
    if (!supportedLanguages.includes(language)) {
      return res.status(400).json({
        error: `Unsupported language: ${language}`
      })
    }

    // Create temporary file
    const tempDir = '/app/temp'
    const fileName = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const fileExt = language === 'python' ? '.py' : language === 'javascript' ? '.js' : '.sh'
    const filePath = path.join(tempDir, fileName + fileExt)

    await fs.writeFile(filePath, code)

    // Execute code
    const startTime = Date.now()
    let command, args

    switch (language) {
      case 'python':
        command = 'python3'
        args = [filePath]
        break
      case 'javascript':
        command = 'node'
        args = [filePath]
        break
      case 'bash':
        command = 'bash'
        args = [filePath]
        break
    }

    const child = spawn(command, args, {
      timeout: timeout,
      killSignal: 'SIGKILL'
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', async (code) => {
      const executionTime = Date.now() - startTime

      // Clean up temporary file
      try {
        await fs.unlink(filePath)
      } catch (err) {
        console.warn('Failed to clean up temp file:', err.message)
      }

      res.json({
        stdout: stdout,
        stderr: stderr,
        exitCode: code,
        executionTime: executionTime,
        language: language
      })
    })

    child.on('error', async (error) => {
      // Clean up temporary file
      try {
        await fs.unlink(filePath)
      } catch (err) {
        console.warn('Failed to clean up temp file:', err.message)
      }

      res.status(500).json({
        error: 'Execution failed',
        details: error.message
      })
    })

  } catch (error) {
    res.status(500).json({
      error: 'Code execution failed',
      details: error.message
    })
  }
})

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  console.log('WebSocket connection established', req)
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message)
      
      switch (data.type) {
        case 'ping': {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }))
          break
        }
        case 'chat': {
          // Handle real-time chat
          const response = await handleChatMessage(data.payload)
          ws.send(JSON.stringify({ type: 'chat_response', payload: response }))
          break
        }
        default:
          ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }))
      }
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', message: error.message }))
    }
  })
  
  ws.on('close', () => {
    console.log('WebSocket connection closed')
  })
})

async function handleChatMessage(payload) {
  // Implement real-time chat handling
  console.log(payload)
  return { message: 'Chat response', timestamp: Date.now() }
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error, req, next)
  res.status(500).json({
    error: 'Internal server error',
    details: LOG_LEVEL === 'debug' ? error.message : 'An unexpected error occurred'
  })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  })
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully')
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`LocoDex AI Agent Server running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV}`)
  console.log(`Log Level: ${LOG_LEVEL}`)
  console.log(`Ollama Host: ${OLLAMA_HOST}`)
  console.log(`LM Studio Host: ${LMSTUDIO_HOST}`)
})

module.exports = app

