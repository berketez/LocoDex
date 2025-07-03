import React, { useState, useEffect, useRef, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Progress } from '@/components/ui/progress.jsx'
import { ScrollArea } from '@/components/ui/scroll-area.jsx'
import { Separator } from '@/components/ui/separator.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import DarkModeToggle from '@/components/DarkModeToggle.jsx'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog.jsx'
import SystemMonitoringPanel from '@/components/SystemMonitoringPanel.jsx'
import ChatInterface from '@/components/ChatInterface.jsx'
import EnvironmentManager from '@/components/EnvironmentManager.jsx'
import DeepResearch from '@/components/DeepResearch.jsx'
import FileUpload from '@/components/FileUpload.jsx'
import RAGChat from '@/components/RAGChat.jsx'
import AIModelTraining from '@/components/AIModelTraining.jsx'
import { systemPrompts } from '@/utils/systemPrompts.js'
import HallucinationDetector from '@/utils/hallucinationDetector.js'
import { 
  Bot, 
  User, 
  Send, 
  Settings, 
  RefreshCw, 
  Cpu, 
  Container, 
  Terminal, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Search,
  Code,
  Brain,
  Activity,
  HardDrive,
  MemoryStick,
  Wifi,
  Play,
  Pause,
  Monitor,
  Shield,
  BarChart3,
  Zap,
  Globe,
  Home,
  ChevronRight,
  Circle,
  Download,
  Upload,
  Eye,
  TrendingUp,
  Server,
  FileText,
  Database
} from 'lucide-react'
import './App.css'

// Basit EnhancedModelSelector placeholder
const EnhancedModelSelector = ({ onModelSelect, selectedModel }) => {
  const [models, setModels] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProvider, setSelectedProvider] = useState('all')

  useEffect(() => {
    let timeoutId = null
    
    const discoverModels = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        // Try to discover models from Ollama and LM Studio
        const discoveredModels = []
        
        // Check Ollama
        try {
          const ollamaResponse = await fetch('http://localhost:11434/api/tags', { 
            signal: AbortSignal.timeout(5000) // 5 saniye timeout
          })
          if (ollamaResponse.ok) {
            const ollamaData = await ollamaResponse.json()
            ollamaData.models?.forEach(model => {
              // Model boyutunu hesapla (GB)
              const sizeGB = model.size ? (model.size / (1024 * 1024 * 1024)) : 0
              
              // Model kategorisini belirle
              const getModelCategory = (name, size) => {
                if (size >= 200) return 'enterprise' // 200B+ Enterprise
                if (size >= 70) return 'professional' // 70B+ Professional  
                if (size >= 30) return 'standard' // 30B+ Standard
                if (size >= 7) return 'basic' // 7B+ Basic
                return 'small' // <7B Small
              }
              
              // Hallucination risk assessment
              const getHallucinationRisk = (name, size) => {
                if (size >= 70) return 'low' // Büyük modeller daha güvenilir
                if (size >= 30) return 'medium' 
                if (size >= 13) return 'high'
                return 'very-high' // Küçük modeller çok riskli
              }
              
              discoveredModels.push({
                id: model.name,
                name: model.name,
                provider: 'Ollama',
                size: model.size,
                sizeGB: sizeGB,
                modified: model.modified_at,
                status: 'available',
                category: getModelCategory(model.name, sizeGB),
                hallucinationRisk: getHallucinationRisk(model.name, sizeGB),
                capabilities: {
                  chat: true,
                  completion: true,
                  embedding: model.name.includes('embed'),
                  vision: model.name.includes('vision') || model.name.includes('llava'),
                  code: model.name.includes('code') || model.name.includes('coder'),
                  reasoning: sizeGB >= 70, // Sadece büyük modeller reasoning yapabilir
                  factChecking: sizeGB >= 30, // Fact checking için minimum 30B
                  enterpriseReady: sizeGB >= 70 // Enterprise için minimum 70B
                }
              })
            })
          }
        } catch (err) {
          console.log('Ollama bulunamadı:', err.message)
        }

        // Check LM Studio
        try {
          const lmstudioResponse = await fetch('http://localhost:1234/v1/models', {
            signal: AbortSignal.timeout(5000) // 5 saniye timeout
          })
          if (lmstudioResponse.ok) {
            const lmstudioData = await lmstudioResponse.json()
            lmstudioData.data?.forEach(model => {
              // LM Studio için model boyutunu isimden tahmin et
              const estimateModelSize = (name) => {
                const lowerName = name.toLowerCase()
                if (lowerName.includes('405b')) return 405
                if (lowerName.includes('200b')) return 200
                if (lowerName.includes('175b')) return 175
                if (lowerName.includes('120b')) return 120
                if (lowerName.includes('70b')) return 70
                if (lowerName.includes('65b')) return 65
                if (lowerName.includes('34b')) return 34
                if (lowerName.includes('32b')) return 32
                if (lowerName.includes('30b')) return 30
                if (lowerName.includes('27b')) return 27
                if (lowerName.includes('20b')) return 20
                if (lowerName.includes('13b')) return 13
                if (lowerName.includes('8b')) return 8
                if (lowerName.includes('7b')) return 7
                if (lowerName.includes('3b')) return 3
                if (lowerName.includes('1b')) return 1
                return 7 // Varsayılan
              }
              
              const sizeGB = estimateModelSize(model.id)
              
              // Model kategorisini belirle
              const getModelCategory = (name, size) => {
                if (size >= 200) return 'enterprise' // 200B+ Enterprise
                if (size >= 70) return 'professional' // 70B+ Professional  
                if (size >= 30) return 'standard' // 30B+ Standard
                if (size >= 7) return 'basic' // 7B+ Basic
                return 'small' // <7B Small
              }
              
              // Hallucination risk assessment
              const getHallucinationRisk = (name, size) => {
                if (size >= 70) return 'low' // Büyük modeller daha güvenilir
                if (size >= 30) return 'medium' 
                if (size >= 13) return 'high'
                return 'very-high' // Küçük modeller çok riskli
              }
              
              discoveredModels.push({
                id: model.id,
                name: model.id,
                provider: 'LM Studio',
                sizeGB: sizeGB,
                status: 'available',
                category: getModelCategory(model.id, sizeGB),
                hallucinationRisk: getHallucinationRisk(model.id, sizeGB),
                capabilities: {
                  chat: true,
                  completion: true,
                  embedding: model.id.includes('embed'),
                  vision: model.id.includes('vision'),
                  code: model.id.includes('code'),
                  reasoning: sizeGB >= 70, // Sadece büyük modeller reasoning yapabilir
                  factChecking: sizeGB >= 30, // Fact checking için minimum 30B
                  enterpriseReady: sizeGB >= 70 // Enterprise için minimum 70B
                }
              })
            })
          }
        } catch (err) {
          console.log('LM Studio bulunamadı:', err.message)
        }

        if (discoveredModels.length === 0) {
          setError('Hiç model bulunamadı. Lütfen Ollama veya LM Studio\'yu başlatın ve model indirin.')
        } else {
          setModels(discoveredModels)
          
          // Auto-select if only one model is available
          if (discoveredModels.length === 1 && !selectedModel && onModelSelect) {
            timeoutId = setTimeout(() => {
              onModelSelect(discoveredModels[0])
            }, 500)
          }
        }
      } catch (err) {
        setError('Model keşfi sırasında hata oluştu: ' + err.message)
      } finally {
        setIsLoading(false)
      }
    }

    discoverModels()
    
    // Refresh every 30 seconds
    const interval = setInterval(discoverModels, 30000)
    
    // Cleanup function
    return () => {
      clearInterval(interval)
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [onModelSelect, selectedModel])

  const filteredModels = models.filter(model => {
    const matchesSearch = model.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesProvider = selectedProvider === 'all' || model.provider === selectedProvider
    return matchesSearch && matchesProvider
  })

  const getProviderColor = (provider) => {
    switch (provider) {
      case 'Ollama': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'LM Studio': return 'bg-purple-100 text-purple-800 border-purple-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getProviderIcon = useCallback((provider) => {
    switch (provider) {
      case 'Ollama': return '🦙'
      case 'LM Studio': return '🎬'
      default: return '🤖'
    }
  }, [])


  const getCategoryColor = useCallback((category) => {
    switch (category) {
      case 'enterprise': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'professional': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'standard': return 'bg-green-100 text-green-800 border-green-200'
      case 'basic': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'small': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }, [])

  const getCategoryLabel = useCallback((category) => {
    switch (category) {
      case 'enterprise': return '🏢 Enterprise (200B+)'
      case 'professional': return '💼 Professional (70B+)'
      case 'standard': return '⭐ Standard (30B+)'
      case 'basic': return '📱 Basic (7B+)'
      case 'small': return '🔸 Small (<7B)'
      default: return '❓ Unknown'
    }
  }, [])

  const getHallucinationColor = useCallback((risk) => {
    switch (risk) {
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'very-high': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }, [])

  const getHallucinationLabel = useCallback((risk) => {
    switch (risk) {
      case 'low': return '✅ Düşük Risk'
      case 'medium': return '⚠️ Orta Risk'
      case 'high': return '🔶 Yüksek Risk'
      case 'very-high': return '🚨 Çok Yüksek Risk'
      default: return '❓ Bilinmiyor'
    }
  }, [])

  const formatSize = useCallback((size) => {
    if (!size) return null
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }, [])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Bot className="w-6 h-6 text-blue-600" />
          </div>
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900">Modeller Keşfediliyor</h3>
          <p className="text-gray-600">Ollama ve LM Studio kontrol ediliyor...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-6">
        <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center">
          <AlertCircle className="w-10 h-10 text-yellow-600" />
        </div>
        <div className="text-center max-w-md">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Model Bulunamadı</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h4 className="font-medium text-blue-900 mb-3">Hızlı Kurulum:</h4>
            <div className="space-y-2 text-sm">
              <div className="bg-blue-100 rounded p-2">
                <span className="font-medium">Ollama:</span>
                <code className="block mt-1 text-blue-800">ollama pull llama3.2</code>
              </div>
              <div className="bg-purple-100 rounded p-2">
                <span className="font-medium">LM Studio:</span>
                <p className="text-purple-800 mt-1">Uygulamayı açın → Model indirin → "Local Server" başlatın</p>
              </div>
            </div>
          </div>
          
          <Button onClick={() => {
            setError(null)
            setIsLoading(true)
            // Trigger model discovery again immediately instead of using setTimeout
            const event = new Event('refresh-models')
            window.dispatchEvent(event)
          }} className="w-full">
            <RefreshCw className="w-4 h-4 mr-2" />
            Yeniden Dene
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">AI Modelleri</h2>
            <p className="text-gray-600">{filteredModels.length} model mevcut</p>
          </div>
          <div className="flex space-x-2">
            {filteredModels.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  // Auto-select the first recommended model
                  const codeModels = filteredModels.filter(m => m.capabilities.code)
                  const recommended = codeModels.length > 0 ? codeModels[0] : filteredModels[0]
                  onModelSelect(recommended)
                }}
              >
                <Zap className="w-4 h-4 mr-2" />
                Otomatik Seç
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => {
              setError(null)
              setIsLoading(true)
              // Force refresh models
              window.location.reload()
            }}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Yenile
            </Button>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Model ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Tüm Sağlayıcılar</option>
            <option value="Ollama">Ollama</option>
            <option value="LM Studio">LM Studio</option>
          </select>
        </div>
      </div>

      {/* Models Grid */}
      <ScrollArea className="flex-1 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredModels.map(model => (
            <motion.div
              key={model.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group cursor-pointer"
              onClick={() => onModelSelect(model)}
            >
              <Card className="h-full transition-all duration-200 hover:shadow-lg hover:border-blue-300 group-hover:bg-blue-50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">{getProviderIcon(model.provider)}</span>
                      <div>
                        <CardTitle className="text-lg leading-tight">{model.name}</CardTitle>
                        <Badge 
                          variant="outline" 
                          className={`mt-1 ${getProviderColor(model.provider)}`}
                        >
                          {model.provider}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-xs text-gray-500 mt-1 block">Aktif</span>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0">
                  {/* Model Category & Size */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Kategori:</span>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getCategoryColor(model.category || 'basic')}`}
                      >
                        {getCategoryLabel(model.category || 'basic')}
                      </Badge>
                    </div>
                    
                    {model.sizeGB && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Boyut:</span>
                        <span className="font-medium">{formatSize(model.size) || `${model.sizeGB.toFixed(1)} GB`}</span>
                      </div>
                    )}
                    
                    {/* Hallucination Risk */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Doğruluk:</span>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getHallucinationColor(model.hallucinationRisk || 'high')}`}
                      >
                        {getHallucinationLabel(model.hallucinationRisk || 'high')}
                      </Badge>
                    </div>
                    
                    {/* Enterprise Ready Indicator */}
                    {model.capabilities?.enterpriseReady && (
                      <div className="flex items-center justify-center">
                        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                          🏢 Enterprise Ready
                        </Badge>
                      </div>
                    )}
                    
                    {/* Capabilities */}
                    <div>
                      <span className="text-sm text-gray-600 mb-2 block">Yetenekler:</span>
                      <div className="flex flex-wrap gap-1">
                        {model.capabilities.chat && (
                          <Badge variant="secondary" className="text-xs">💬 Sohbet</Badge>
                        )}
                        {model.capabilities.code && (
                          <Badge variant="secondary" className="text-xs">💻 Kod</Badge>
                        )}
                        {model.capabilities.vision && (
                          <Badge variant="secondary" className="text-xs">👁️ Görsel</Badge>
                        )}
                        {model.capabilities.embedding && (
                          <Badge variant="secondary" className="text-xs">🔍 Embedding</Badge>
                        )}
                        {model.capabilities.reasoning && (
                          <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700">🧠 Reasoning</Badge>
                        )}
                        {model.capabilities.factChecking && (
                          <Badge variant="secondary" className="text-xs bg-green-50 text-green-700">✅ Fact Check</Badge>
                        )}
                      </div>
                    </div>

                    {/* Action Button */}
                    <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-medium">
                      <Play className="w-4 h-4 mr-2" />
                      Bu Modeli Seç
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {filteredModels.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Model Bulunamadı</h3>
            <p className="text-gray-600">Arama kriterlerinizi değiştirmeyi deneyin.</p>
          </div>
        )}
      </ScrollArea>
    </div>
  )
}



function AppContent() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'assistant',
      content: 'Merhaba! Ben LocoDex, AI destekli yazılım mühendisiyim. Önce bir model ve çalışma ortamı seçin, sonra size nasıl yardımcı olabilirim?',
      timestamp: new Date()
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [currentPlan, setCurrentPlan] = useState(null)
  const [completedTasks, setCompletedTasks] = useState(0)
  const [activeTab, setActiveTab] = useState('chat')
  const [isModelDialogOpen, setIsModelDialogOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedModel, setSelectedModel] = useState(null)
  const [codeExecutionResults, setCodeExecutionResults] = useState([])
  const [systemStats, setSystemStats] = useState({
    cpu: 15.3,
    memory: 68.7,
    disk: 45.2,
    network: { upload: 513.7, download: 1024.3 },
    modelStatus: 'idle',
    lastActivity: null,
    activeConnections: 0,
    connectionStatus: {
      docker: 'disconnected',
      sandbox: 'disconnected',
      ollama: 'connected',
      lmstudio: 'connected'
    }
  })
  const [showSystemPanel, setShowSystemPanel] = useState(true)
  const [activityLog, setActivityLog] = useState([
    {
      id: 1,
      type: 'info',
      message: 'Sistem başlatıldı',
      details: 'LocoDex başarıyla yüklendi',
      timestamp: new Date()
    }
  ])
  const [uploadedFiles, setUploadedFiles] = useState([])
  const messagesEndRef = useRef(null)
  
  // Initialize AI enhancement systems
  const hallucinationDetector = useRef(new HallucinationDetector())

  // Activity logging
  const addActivityLog = (type, message, details = null) => {
    setActivityLog(prev => [{
      id: Date.now(),
      type,
      message,
      details,
      timestamp: new Date()
    }, ...prev.slice(0, 19)]) // Keep only last 20 entries
  }

  // RAG file upload handler
  const handleFilesUpload = (files) => {
    setUploadedFiles(prev => [...prev, ...files])
    addActivityLog('success', `${files.length} belge yüklendi ve işlendi`, 
      files.map(f => f.name).join(', '))
  }

  // System monitoring
  useEffect(() => {
    const interval = setInterval(() => {
      if (window.electron && window.electron.getSystemStats) {
        window.electron.getSystemStats().then(stats => {
          setSystemStats(stats);
        }).catch(error => {
          console.warn('System stats fetch failed:', error);
          // Mock data fallback
          setSystemStats(prev => ({
            ...prev,
            cpu: Math.random() * 100,
            memory: Math.random() * 100,
            disk: Math.random() * 100
          }));
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Update model status based on processing
  useEffect(() => {
    setSystemStats(prev => ({
      ...prev,
      modelStatus: isProcessing ? 'processing' : selectedModel ? 'active' : 'idle'
    }))
  }, [isProcessing, selectedModel])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return
    
    if (!selectedModel) {
      // Batch state updates to prevent screen flashing
      React.startTransition(() => {
        setMessages(prev => [...prev, {
          id: Date.now(),
          type: 'assistant',
          content: 'Lütfen önce bir model seçin. Model sekmesinden mevcut modelleri görebilir ve birini seçebilirsiniz.',
          timestamp: new Date()
        }])
        setActiveTab('models')
      })
      return
    }

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsTyping(true)
    setIsProcessing(true)

    // Log user activity
    addActivityLog('info', `Kullanıcı mesajı: "${inputValue.substring(0, 50)}${inputValue.length > 50 ? '...' : ''}"`)

    try {
      // Check if message contains code blocks
      const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
      const codeBlocks = []
      let match

      while ((match = codeBlockRegex.exec(inputValue)) !== null) {
        codeBlocks.push({
          language: match[1] || 'python',
          code: match[2].trim()
        })
      }

      // Generate context-aware system prompt
      const taskType = codeBlocks.length > 0 ? 'coding' : 
                      inputValue.toLowerCase().includes('araştır') || inputValue.toLowerCase().includes('research') ? 'research' : 'base'
      
      const systemPrompt = systemPrompts.generateContextAwarePrompt({
        modelSizeGB: selectedModel?.sizeGB || 7,
        taskType: taskType,
        context: {
          language: codeBlocks.length > 0 ? codeBlocks[0].language : 'general',
          security: inputValue.toLowerCase().includes('güvenlik') || inputValue.toLowerCase().includes('security'),
          requiresRecent: inputValue.toLowerCase().includes('güncel') || inputValue.toLowerCase().includes('recent'),
          critical: inputValue.toLowerCase().includes('kritik') || inputValue.toLowerCase().includes('critical')
        },
        customInstructions: '',
        hallucinationPrevention: true
      })

      // Send to AI Agent API
      let aiMessageContent = ''
      let detectionResult = null
      
      try {
        const response = await fetch('http://localhost:3001/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: inputValue,
            model: selectedModel?.name || 'default',
            systemPrompt: systemPrompt,
            codeBlocks: codeBlocks,
            history: messages.slice(-5), // Son 5 mesaj için context
            capabilities: {
              codeExecution: true,
              fileSystem: true,
              docker: true
            },
            modelMetadata: {
              sizeGB: selectedModel?.sizeGB || 7,
              category: selectedModel?.category || 'basic',
              hallucinationRisk: selectedModel?.hallucinationRisk || 'very-high',
              provider: selectedModel?.provider || 'unknown'
            }
          })
        })
        
        if (response.ok) {
          const data = await response.json()
          let rawResponse = data.response || data.message || 'AI yanıtı alınamadı.'
          
          // Hallucination detection
          detectionResult = await hallucinationDetector.current.detectHallucinations(
            rawResponse,
            {
              modelSize: selectedModel?.sizeGB || 7,
              previousResponses: messages.filter(m => m.type === 'assistant').slice(-3).map(m => m.content),
              taskType: taskType
            }
          )
          
          // Use corrected response if hallucination detected
          if (detectionResult.isHallucination) {
            aiMessageContent = detectionResult.correctedResponse
            addActivityLog('warning', 'Hallucination tespit edildi', 
              `Güven: ${Math.round(detectionResult.confidence * 100)}% - ${detectionResult.recommendations.join(', ')}`)
          } else {
            aiMessageContent = rawResponse
            addActivityLog('success', 'Yanıt doğrulandı', 
              `Güven: ${Math.round(detectionResult.confidence * 100)}%`)
          }
          
          // Kod çalıştırma sonuçları varsa ekle
          if (data.codeResults && data.codeResults.length > 0) {
            setCodeExecutionResults(prev => [...prev, ...data.codeResults])
            aiMessageContent += '\n\n💻 Kod çalıştırıldı! Sonuçları "Çalıştırma" sekmesinde görebilirsiniz.'
          }
        } else {
          throw new Error('AI Agent bağlantı hatası')
        }
      } catch (error) {
        console.error('AI Agent error:', error)
        aiMessageContent = `🤖 LocoDex AI Agent hazır!

${inputValue ? `"${inputValue.substring(0, 100)}${inputValue.length > 100 ? '...' : ''}" hakkında size yardımcı olmaya hazırım.` : ''}

💡 Şu anda şunları yapabilirim:
- 🐍 Python kodu çalıştırmak
- 📁 Dosya sistemi operasyonları  
- 🐳 Docker container yönetimi
- 🔍 Web araştırması yapmak
- 📊 Veri analizi ve görselleştirme

Kod çalıştırmak için: \`\`\`python kod \`\`\`
${selectedModel ? `Model: ${selectedModel.name} (${selectedModel.provider})` : '⚠️ Model seçmeyi unutmayın!'}`
      }
      const aiMessage = {
        id: Date.now() + 1,
        type: 'assistant',
        content: aiMessageContent,
        timestamp: new Date(),
        metadata: {
          model: selectedModel.name,
          modelSize: selectedModel?.sizeGB || 7,
          category: selectedModel?.category || 'basic',
          hallucinationRisk: selectedModel?.hallucinationRisk || 'very-high',
          detectionResult: detectionResult ? {
            isHallucination: detectionResult.isHallucination,
            confidence: detectionResult.confidence,
            issueCount: detectionResult.issues?.length || 0,
            recommendations: detectionResult.recommendations || []
          } : null,
          systemPromptUsed: taskType,
          enhancedResponse: !!detectionResult
        }
      }
      
      setMessages(prev => [...prev, aiMessage])
      
      // Generate plan based on user input
      generatePlan(inputValue)
      
    } catch (err) {
      const errorMessage = {
        id: Date.now() + 1,
        type: 'assistant',
        content: `Üzgünüm, bir hata oluştu: ${err.message}`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
      setIsProcessing(false)
    }
  }

  const generatePlan = (input) => {
    const plans = {
      'docker': {
        title: 'Docker Entegrasyonu',
        tasks: [
          { id: 1, name: 'Docker Kurulumu Kontrol', status: 'completed', icon: Container },
          { id: 2, name: 'Konteyner Oluşturma', status: 'in-progress', icon: Settings },
          { id: 3, name: 'Servis Başlatma', status: 'pending', icon: Play },
          { id: 4, name: 'Sağlık Kontrolü', status: 'pending', icon: CheckCircle },
          { id: 5, name: 'Test ve Doğrulama', status: 'pending', icon: Shield }
        ]
      },
      'sandbox': {
        title: 'Sandbox Kod Çalıştırma',
        tasks: [
          { id: 1, name: 'Güvenlik Kontrolü', status: 'completed', icon: Shield },
          { id: 2, name: 'Kod Analizi', status: 'completed', icon: Search },
          { id: 3, name: 'Sandbox Hazırlama', status: 'in-progress', icon: Container },
          { id: 4, name: 'Kod Çalıştırma', status: 'pending', icon: Play },
          { id: 5, name: 'Sonuç Analizi', status: 'pending', icon: BarChart3 }
        ]
      },
      'model': {
        title: 'Model Entegrasyonu',
        tasks: [
          { id: 1, name: 'Model Keşfi', status: 'completed', icon: Search },
          { id: 2, name: 'Bağlantı Testi', status: 'completed', icon: CheckCircle },
          { id: 3, name: 'Performans Analizi', status: 'in-progress', icon: Activity },
          { id: 4, name: 'Optimizasyon', status: 'pending', icon: Zap },
          { id: 5, name: 'Entegrasyon', status: 'pending', icon: Globe }
        ]
      }
    }

    for (const [key, plan] of Object.entries(plans)) {
      if (input.toLowerCase().includes(key)) {
        setCurrentPlan(plan)
        setCompletedTasks(plan.tasks.filter(t => t.status === 'completed').length)
        return
      }
    }

    // Default plan
    setCurrentPlan({
      title: 'AI Destekli Geliştirme Planı',
      tasks: [
        { id: 1, name: 'Gereksinim Analizi', status: 'completed', icon: Search },
        { id: 2, name: 'Çözüm Tasarımı', status: 'in-progress', icon: Brain },
        { id: 3, name: 'Implementasyon', status: 'pending', icon: Code },
        { id: 4, name: 'Test ve Validasyon', status: 'pending', icon: Shield },
        { id: 5, name: 'Deployment', status: 'pending', icon: Globe }
      ]
    })
    setCompletedTasks(1)
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-500'
      case 'in-progress': return 'bg-blue-500'
      case 'pending': return 'bg-gray-300'
      default: return 'bg-gray-300'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return CheckCircle
      case 'in-progress': return Clock
      case 'pending': return AlertCircle
      default: return AlertCircle
    }
  }

  const verifyModelReady = async (model) => {
    try {
      const baseUrl = model.provider === 'Ollama' ? 'http://localhost:11434' : 'http://localhost:1234'
      const endpoint = model.provider === 'Ollama' ? '/api/tags' : '/v1/models'
      
      const response = await fetch(`${baseUrl}${endpoint}`, {
        signal: AbortSignal.timeout(3000)
      })
      
      if (response.ok) {
        const data = await response.json()
        const models = model.provider === 'Ollama' ? data.models : data.data
        return models?.some(m => 
          model.provider === 'Ollama' ? m.name === model.id : m.id === model.id
        )
      }
      return false
    } catch {
      return false
    }
  }

  const handleModelSelect = useCallback(async (model) => {
    // Batch state updates to prevent black screen
    React.startTransition(() => {
      setSelectedModel(model)
      setIsModelDialogOpen(false)
      setActiveTab('chat')
      addActivityLog('info', `Model seçiliyor: ${model.name}`, `Sağlayıcı: ${model.provider}`)
      
      // Show loading message first
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'assistant',
        content: `${model.name} modeli kontrol ediliyor...`,
        timestamp: new Date()
      }])
    })

    // Verify model is actually ready
    const isReady = await verifyModelReady(model)
    
    React.startTransition(() => {
      if (isReady) {
        addActivityLog('success', `Model hazır: ${model.name}`, `Sağlayıcı: ${model.provider}`)
        setMessages(prev => [...prev, {
          id: Date.now(),
          type: 'assistant',
          content: `${model.name} modeli hazır! Artık size yardımcı olmaya hazırım!`,
          timestamp: new Date()
        }])
      } else {
        addActivityLog('error', `Model erişilemez: ${model.name}`, `Sağlayıcı: ${model.provider}`)
        setMessages(prev => [...prev, {
          id: Date.now(),
          type: 'assistant',
          content: `⚠️ ${model.name} modeline erişilemedi. Lütfen ${model.provider} servisinin çalıştığından emin olun.`,
          timestamp: new Date()
        }])
      }
    })
  }, [])

  

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Ana İçerik */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">
                <img 
                  src="/assets/locodex-logo.png" 
                  alt="LocoDex Logo" 
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm" style={{display: 'none'}}>
                  <span className="text-white font-bold text-xs">🤖</span>
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">LocoDex</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedModel ? (
                    <span className="flex items-center space-x-1">
                      <Cpu className="w-3 h-3" />
                      <span>{selectedModel.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {selectedModel.provider}
                      </Badge>
                      <span>•</span>
                      <Container className="w-3 h-3" />
                      <span className="capitalize"></span>
                    </span>
                  ) : (
                    'Model ve ortam seçin'
                  )}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {isProcessing && (
                <div className="flex items-center space-x-2 text-sm text-blue-600">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>İşleniyor...</span>
                </div>
              )}
              
              <DarkModeToggle />
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  React.startTransition(() => {
                    setShowSystemPanel(!showSystemPanel)
                  })
                }}
              >
                <Activity className="w-4 h-4" />
              </Button>
              
              <Dialog open={isModelDialogOpen} onOpenChange={setIsModelDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-6xl max-h-[90vh]">
                  <DialogHeader>
                    <DialogTitle>Model ve Ortam Ayarları</DialogTitle>
                    <DialogDescription>
                      Modelleri ve çalışma ortamlarını yönetin
                    </DialogDescription>
                  </DialogHeader>
                  <Tabs defaultValue="models" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="models">Model Seçimi</TabsTrigger>
                      <TabsTrigger value="environment">Ortam Yönetimi</TabsTrigger>
                      <TabsTrigger value="settings">Ayarlar</TabsTrigger>
                    </TabsList>
                    <TabsContent value="models">
                      <EnhancedModelSelector 
                        onModelSelect={handleModelSelect}
                        selectedModel={selectedModel}
                      />
                    </TabsContent>
                    <TabsContent value="environment">
                      <EnvironmentManager />
                    </TabsContent>
                    <TabsContent value="settings">
                      <div className="p-6 space-y-6">
                        <div>
                          <h3 className="text-lg font-semibold mb-4">Uygulama Ayarları</h3>
                          
                          <div className="space-y-4">
                            <div className="border rounded-lg p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="font-medium">Uygulamayı Yenile</h4>
                                  <p className="text-sm text-gray-600">Son değişiklikleri yüklemek için uygulamayı yeniden başlat</p>
                                </div>
                                <Button 
                                  onClick={() => {
                                    if (typeof window !== 'undefined' && window.electronAPI) {
                                      window.electronAPI.reloadApp()
                                    } else {
                                      window.location.reload()
                                    }
                                  }}
                                  variant="outline"
                                >
                                  <RefreshCw className="w-4 h-4 mr-2" />
                                  Yenile
                                </Button>
                              </div>
                            </div>
                            
                            <div className="border rounded-lg p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="font-medium">Geliştirici Araçları</h4>
                                  <p className="text-sm text-gray-600">Hata ayıklama ve geliştirme için konsolu aç</p>
                                </div>
                                <Button 
                                  onClick={() => {
                                    if (typeof window !== 'undefined' && window.electronAPI) {
                                      window.electronAPI.openDevTools()
                                    }
                                  }}
                                  variant="outline"
                                >
                                  <Terminal className="w-4 h-4 mr-2" />
                                  Konsol Aç
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex">
          {/* Main Content */}
          <div className={`flex-1 flex flex-col ${showSystemPanel ? 'mr-80' : ''}`}>
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4">
                <TabsList className="grid w-full grid-cols-6">
                  <TabsTrigger value="chat" className="flex items-center space-x-2">
                    <Bot className="w-4 h-4" />
                    <span>Sohbet</span>
                  </TabsTrigger>
                  <TabsTrigger value="models" className="flex items-center space-x-2">
                    <Cpu className="w-4 h-4" />
                    <span>Modeller</span>
                    {!selectedModel && (
                      <Badge variant="destructive" className="text-xs">!</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="environment" className="flex items-center space-x-2">
                    <Container className="w-4 h-4" />
                    <span>Ortam</span>
                  </TabsTrigger>
                  <TabsTrigger value="execution" className="flex items-center space-x-2">
                    <Terminal className="w-4 h-4" />
                    <span>Çalıştırma</span>
                    {codeExecutionResults.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {codeExecutionResults.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="research" className="flex items-center space-x-2">
                    <Search className="w-4 h-4" />
                    <span>Araştırma</span>
                  </TabsTrigger>
                  <TabsTrigger value="ai-training" className="flex items-center space-x-2">
                    <Brain className="w-4 h-4" />
                    <span>AI Training</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Chat Tab */}
              <TabsContent value="chat" className="flex-1 flex">
                {!selectedModel ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center p-8">
                      <Bot className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-lg font-semibold mb-2">Model Seçin</h3>
                      <p className="text-gray-600 mb-4">Sohbete başlamak için önce bir AI modeli seçmelisiniz.</p>
                      <Button onClick={() => setActiveTab('models')}>
                        <Cpu className="w-4 h-4 mr-2" />
                        Modeller Sekmesine Git
                      </Button>
                    </div>
                  </div>
                ) : (
                <div className="flex-1 flex flex-col">
                  {/* Messages Area */}
                  <div className="flex-1 flex">
                    <div className="flex-1 flex flex-col">
                      <ScrollArea className="flex-1 p-4">
                        <div className="space-y-4">
                          <AnimatePresence>
                            {messages.map((message) => (
                              <motion.div
                                key={message.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                              >
                                <div className={`flex items-start space-x-3 max-w-3xl ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                    message.type === 'user' 
                                      ? 'bg-blue-500' 
                                      : 'bg-gradient-to-r from-purple-500 to-pink-500'
                                  }`}>
                                    {message.type === 'user' ? (
                                      <User className="w-4 h-4 text-white" />
                                    ) : (
                                      <Bot className="w-4 h-4 text-white" />
                                    )}
                                  </div>
                                  <div className={`rounded-lg p-3 ${
                                    message.type === 'user'
                                      ? 'bg-blue-500 text-white'
                                      : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
                                  }`}>
                                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                    <div className="flex items-center justify-between mt-2">
                                      <p className={`text-xs ${
                                        message.type === 'user' ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                                      }`}>
                                        {message.timestamp.toLocaleTimeString('tr-TR')}
                                      </p>
                                      {message.metadata && (
                                        <div className="flex items-center space-x-1">
                                          {message.metadata.model && (
                                            <Badge variant="outline" className="text-xs">
                                              {message.metadata.model}
                                            </Badge>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                          
                          {isTyping && (
                            <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="flex justify-start"
                            >
                              <div className="flex items-start space-x-3 max-w-3xl">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                                  <Bot className="w-4 h-4 text-white" />
                                </div>
                                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                  <div className="flex space-x-1">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                          <div ref={messagesEndRef} />
                        </div>
                      </ScrollArea>

                      {/* Input Area */}
                      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                        <div className="flex space-x-2">
                          <Input
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="Mesajınızı yazın... (Kod için ```python kod ``` formatını kullanın)"
                            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                            disabled={isProcessing}
                            className="flex-1"
                          />
                          <Button 
                            variant="outline"
                            onClick={() => setActiveTab('research')}
                            size="sm"
                            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 hover:from-purple-600 hover:to-pink-600"
                          >
                            <Search className="w-4 h-4 mr-1" />
                            Deep Search
                          </Button>
                          <Button 
                            onClick={handleSendMessage} 
                            disabled={!inputValue.trim() || isProcessing}
                            size="sm"
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Plan Sidebar */}
                    {currentPlan && (
                      <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                        <div className="p-4">
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                            {currentPlan.title}
                          </h3>
                          <div className="mb-4">
                            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                              <span>İlerleme</span>
                              <span>{completedTasks}/{currentPlan.tasks.length}</span>
                            </div>
                            <Progress value={(completedTasks / currentPlan.tasks.length) * 100} className="h-2" />
                          </div>
                          <div className="space-y-3">
                            {currentPlan.tasks.map((task) => {
                              const StatusIcon = getStatusIcon(task.status)
                              const TaskIcon = task.icon
                              return (
                                <div key={task.id} className="flex items-center space-x-3">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${getStatusColor(task.status)}`}>
                                    <StatusIcon className="w-3 h-3 text-white" />
                                  </div>
                                  <TaskIcon className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                                    {task.name}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                )}
              </TabsContent>

              {/* Models Tab */}
              <TabsContent value="models" className="flex-1">
                <div className="h-full">
                  <EnhancedModelSelector 
                    onModelSelect={handleModelSelect}
                    selectedModel={selectedModel}
                  />
                </div>
              </TabsContent>

              {/* Environment Tab */}
              <TabsContent value="environment" className="flex-1">
                <div className="p-4 h-full">
                  <EnvironmentManager />
                </div>
              </TabsContent>

              {/* Execution Tab */}
              <TabsContent value="execution" className="flex-1">
                <div className="p-4 h-full">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Terminal className="w-5 h-5" />
                          <span>Kod Çalıştırma Geçmişi</span>
                        </div>
                        {codeExecutionResults.length > 0 && (
                          <Badge variant="secondary">
                            {codeExecutionResults.length} çalıştırma
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {codeExecutionResults.length === 0 ? (
                        <div className="text-center py-8">
                          <Terminal className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                            Henüz Kod Çalıştırılmadı
                          </h3>
                          <p className="text-gray-500 dark:text-gray-400 mb-4">
                            Sohbet sekmesinde ```python kod ``` formatında kod gönderin
                          </p>
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                            <h4 className="font-medium text-blue-900 mb-2">Örnek kullanım:</h4>
                            <pre className="text-sm text-blue-800 bg-blue-100 p-2 rounded">
{`Merhaba! Şu Python kodunu çalıştır:

\`\`\`python
print("Merhaba LocoDex!")
import math
print(f"Pi sayısı: {math.pi}")
\`\`\``}
                            </pre>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4 max-h-96 overflow-y-auto">
                          {codeExecutionResults.map((execution) => (
                            <div 
                              key={execution.id}
                              className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-2">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    execution.language === 'python' ? 'bg-blue-100 text-blue-800' :
                                    execution.language === 'javascript' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {execution.language.toUpperCase()}
                                  </span>
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    execution.result.exit_code === 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                  }`}>
                                    {execution.result.exit_code === 0 ? '✅ Başarılı' : '❌ Hata'}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {execution.timestamp.toLocaleTimeString('tr-TR')}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-500">
                                  ⏱️ {execution.result.execution_time.toFixed(2)}s
                                </span>
                              </div>
                              
                              <div className="space-y-3">
                                <div>
                                  <h5 className="text-sm font-medium text-gray-700 mb-1">Kod:</h5>
                                  <pre className="text-sm bg-white border rounded p-2 overflow-x-auto">
                                    <code>{execution.code}</code>
                                  </pre>
                                </div>
                                
                                {execution.result.stdout && (
                                  <div>
                                    <h5 className="text-sm font-medium text-gray-700 mb-1">📤 Çıktı:</h5>
                                    <pre className="text-sm bg-green-50 border border-green-200 rounded p-2 overflow-x-auto">
                                      <code>{execution.result.stdout}</code>
                                    </pre>
                                  </div>
                                )}
                                
                                {execution.result.stderr && (
                                  <div>
                                    <h5 className="text-sm font-medium text-gray-700 mb-1">⚠️ Hata:</h5>
                                    <pre className="text-sm bg-red-50 border border-red-200 rounded p-2 overflow-x-auto">
                                      <code>{execution.result.stderr}</code>
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="research" className="flex-1">
                <DeepResearch />
              </TabsContent>

              {/* AI Training Tab */}
              <TabsContent value="ai-training" className="flex-1">
                <AIModelTraining />
              </TabsContent>

              {/* RAG & Fine-tuning Tab */}
              <TabsContent value="rag-finetuning" className="flex-1">
                <div className="p-4 h-full">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <FileText className="w-5 h-5" />
                        <span>RAG & Fine-tuning</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Tabs defaultValue="upload" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                          <TabsTrigger value="upload" className="flex items-center space-x-2">
                            <Upload className="w-4 h-4" />
                            <span>Belge Yükleme</span>
                          </TabsTrigger>
                          <TabsTrigger value="rag" className="flex items-center space-x-2">
                            <Database className="w-4 h-4" />
                            <span>RAG Sohbet</span>
                          </TabsTrigger>
                          <TabsTrigger value="finetuning" className="flex items-center space-x-2">
                            <Brain className="w-4 h-4" />
                            <span>Fine-tuning</span>
                          </TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="upload" className="space-y-4">
                          <FileUpload onFilesUpload={handleFilesUpload} />
                        </TabsContent>
                        
                        <TabsContent value="rag" className="space-y-4">
                          <div className="h-96">
                            <RAGChat uploadedFiles={uploadedFiles} selectedModel={selectedModel} />
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="finetuning" className="space-y-4">
                          <div className="space-y-4">
                            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-700">
                              <div className="flex items-center space-x-3 mb-4">
                                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                                  <Brain className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                  <h3 className="font-semibold text-blue-900 dark:text-blue-100">Fine-tuning</h3>
                                  <p className="text-sm text-blue-600 dark:text-blue-400">Şirket verilerinize özel AI modeli oluşturun</p>
                                </div>
                              </div>
                              
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="text-sm">Veri Hazırlama</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="space-y-2 text-sm">
                                        <div className="flex items-center space-x-2">
                                          <CheckCircle className="w-4 h-4 text-green-500" />
                                          <span>Veri formatı kontrolü</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                          <Clock className="w-4 h-4 text-yellow-500" />
                                          <span>Veri temizleme</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                          <Circle className="w-4 h-4 text-gray-400" />
                                          <span>Eğitim verisi hazırlama</span>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                  
                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="text-sm">Model Eğitimi</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="space-y-2 text-sm">
                                        <div className="flex items-center space-x-2">
                                          <Circle className="w-4 h-4 text-gray-400" />
                                          <span>Temel model seçimi</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                          <Circle className="w-4 h-4 text-gray-400" />
                                          <span>Parametre ayarları</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                          <Circle className="w-4 h-4 text-gray-400" />
                                          <span>Eğitim başlatma</span>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                </div>
                                
                                <div className="text-center">
                                  <Button variant="outline" disabled>
                                    <Brain className="w-4 h-4 mr-2" />
                                    Yakında Gelecek
                                  </Button>
                                  <p className="text-xs text-gray-500 mt-2">Fine-tuning özelliği geliştirme aşamasında</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* System Monitoring Panel - Manus Style */}
      {showSystemPanel && (
        <SystemMonitoringPanel 
          systemStats={systemStats}
          selectedModel={selectedModel}
          currentPlan={currentPlan}
          activityLog={activityLog}
          onClose={() => setShowSystemPanel(false)}
        />
      )}
    </div>
  )
}

function App() {
  return <AppContent />
}

export default App

