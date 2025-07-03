import React, { useState, useEffect, useCallback, memo } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Progress } from '@/components/ui/progress.jsx'
import { ScrollArea } from '@/components/ui/scroll-area.jsx'
import { Separator } from '@/components/ui/separator.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog.jsx'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx'
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip.jsx'
import { 
  RefreshCw, 
  Search, 
  Settings, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Cpu,
  HardDrive,
  Zap,
  Eye,
  Code,
  Brain,
  Wifi,
  WifiOff,
  Star,
  Filter,
  Download,
  Play,
  Pause,
  Container,
  Shield,
  Monitor,
  Server,
  Cloud,
  Home,
  Globe,
  Lock,
  Unlock,
  Activity,
  BarChart3
} from 'lucide-react'

import { locoDexAPI } from '@/services/api'

const EnhancedModelSelector = ({ onModelSelect, onEnvironmentChange, className = '' }) => {
  // State management
  const [models, setModels] = useState([])
  const [providers, setProviders] = useState({})
  const [selectedModel, setSelectedModel] = useState(null)
  const [selectedEnvironment, setSelectedEnvironment] = useState('local')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  
  
  const [systemStatus, setSystemStatus] = useState(null)
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProvider, setSelectedProvider] = useState('all')
  const [selectedCapability, setSelectedCapability] = useState('all')
  const [showOnlyRecommended, setShowOnlyRecommended] = useState(false)
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(true)
  
  // UI states
  const [testingModel, setTestingModel] = useState(null)
  const [activeTab, setActiveTab] = useState('models')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isEnvironmentSetupOpen, setIsEnvironmentSetupOpen] = useState(false)

  // Environment configurations
  const environments = {
    local: {
      name: 'Yerel',
      description: 'Doğrudan yerel model sağlayıcıları (LM Studio, Ollama)',
      icon: Home,
      color: 'blue',
      requirements: ['LM Studio veya Ollama kurulu olmalı'],
      features: ['Hızlı yanıt', 'Tam kontrol', 'Gizlilik'],
      status: 'available'
    },
    docker: {
      name: 'Docker',
      description: 'İzole Docker konteynerlerinde çalışan modeller',
      icon: Container,
      color: 'purple',
      requirements: ['Docker Desktop kurulu olmalı'],
      features: ['İzolasyon', 'Ölçeklenebilirlik', 'Güvenlik'],
      status: 'checking'
    },
    sandbox: {
      name: 'Sandbox',
      description: 'Güvenli sandbox ortamında kod çalıştırma',
      icon: Shield,
      color: 'green',
      requirements: ['Docker ve sandbox servisleri'],
      features: ['Maksimum güvenlik', 'Kod çalıştırma', 'İzolasyon'],
      status: 'checking'
    },
    cloud: {
      name: 'Bulut',
      description: 'Bulut tabanlı AI servisleri (gelecek özellik)',
      icon: Cloud,
      color: 'gray',
      requirements: ['İnternet bağlantısı', 'API anahtarları'],
      features: ['Yüksek performans', 'Sınırsız kapasite', 'Güncel modeller'],
      status: 'coming_soon'
    }
  }
  const initializeService = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      await locoDexAPI.initializeServices()
      const status = locoDexAPI.getSystemStatus()
      setSystemStatus(status)
      
      await loadModels()
    } catch (err) {
      setError({
        type: 'initialization_failed',
        message: 'Servis başlatma hatası',
        details: err.message
      })
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initialize API service and load data
  useEffect(() => {
    initializeService()
    
    // Set up event listeners
    const handleStatusChange = (status) => setSystemStatus(status)
    const handleModelsUpdate = (data) => {
      setModels(data.models || [])
      setProviders(data.providers || {})
    }
    const handleError = (error) => setError(error)

    locoDexAPI.on('connectionStatusChanged', handleStatusChange)
    locoDexAPI.on('discoveryComplete', handleModelsUpdate)
    locoDexAPI.on('error', handleError)

    return () => {
      locoDexAPI.off('connectionStatusChanged', handleStatusChange)
      locoDexAPI.off('discoveryComplete', handleModelsUpdate)
      locoDexAPI.off('error', handleError)
    }
  }, [initializeService])

  // Initialize the API service
  

  // Load models from API
  const loadModels = useCallback(async () => {
    try {
      setIsLoading(true)
      const discovery = await locoDexAPI.discoverModels()
      
      setModels(discovery.models || [])
      setProviders(discovery.providers || {})
      
      // Auto-select first recommended model if none selected
      if (!selectedModel && discovery.models.length > 0) {
        const recommended = locoDexAPI.getRecommendedModels('general')
        if (recommended.length > 0) {
          handleModelSelect(recommended[0])
        }
      }
    } catch (err) {
      setError({
        type: 'discovery_failed',
        message: 'Model keşfi başarısız',
        details: err.message
      })
    } finally {
      setIsLoading(false)
    }
  }, [selectedModel, handleModelSelect])

  // Refresh models
  const refreshModels = useCallback(async () => {
    await loadModels()
  }, [loadModels]);

  // Handle model selection
  const handleModelSelect = useCallback(async (model) => {
    try {
      setSelectedModel(model)
      if (onModelSelect) {
        onModelSelect(model)
      }
    } catch (err) {
      setError({
        type: 'selection_failed',
        message: 'Model seçimi başarısız',
        details: err.message
      })
    }
  }, [onModelSelect])

  // Handle environment change
  const handleEnvironmentChange = async (envKey) => {
    try {
      setSelectedEnvironment(envKey)
      
      if (envKey === 'docker' || envKey === 'sandbox') {
        // Check if Docker services are running
        const status = locoDexAPI.getSystemStatus()
        if (status.connectionStatus.docker !== 'connected') {
          setIsEnvironmentSetupOpen(true)
          return
        }
      }
      
      if (onEnvironmentChange) {
        onEnvironmentChange(envKey)
      }
    } catch (err) {
      setError({
        type: 'environment_change_failed',
        message: 'Ortam değişikliği başarısız',
        details: err.message
      })
    }
  }

  // Test model connection
  const handleTestModel = async (model) => {
    setTestingModel(model.id)
    try {
      const result = await locoDexAPI.testModel(model.id)
      
      if (!result.success) {
        setError({
          type: 'test_failed',
          message: `${model.name} test başarısız`,
          details: result.error
        })
      }
    } catch (err) {
      setError({
        type: 'test_failed',
        message: 'Model testi başarısız',
        details: err.message
      })
    } finally {
      setTestingModel(null)
    }
  }

  // Filter models
  const filteredModels = models.filter(model => {
    const matchesSearch = model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         model.provider.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesProvider = selectedProvider === 'all' || model.provider === selectedProvider
    
    const matchesCapability = selectedCapability === 'all' || 
                             (model.capabilities && model.capabilities[selectedCapability])
    
    const matchesRecommended = !showOnlyRecommended || 
                              locoDexAPI.getRecommendedModels().some(rec => rec.id === model.id)
    
    const matchesAvailable = !showOnlyAvailable || model.status === 'available'
    
    return matchesSearch && matchesProvider && matchesCapability && matchesRecommended && matchesAvailable
  })

  // Get provider icon
  const getProviderIcon = (provider) => {
    switch (provider) {
      case 'ollama': return '🦙'
      case 'lmstudio': return '🎬'
      case 'localai': return '🤖'
      default: return '📦'
    }
  }

  // Get capability icon
  const getCapabilityIcon = (capability) => {
    switch (capability) {
      case 'chat': return Brain
      case 'completion': return Zap
      case 'embedding': return HardDrive
      case 'vision': return Eye
      case 'code': return Code
      default: return Cpu
    }
  }

  // Format model size
  const formatSize = (size) => {
    if (!size) return 'Bilinmiyor'
    if (size < 1024 * 1024 * 1024) {
      return `${(size / (1024 * 1024)).toFixed(1)} MB`
    }
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Model ve Ortam Seçimi
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {models.length} model, {Object.keys(providers).length} sağlayıcı mevcut
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshModels}
                  disabled={isLoading}
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Modelleri Yenile</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle>Sistem Ayarları</DialogTitle>
                <DialogDescription>
                  Model sağlayıcıları ve sistem durumu
                </DialogDescription>
              </DialogHeader>
              <SystemStatusPanel systemStatus={systemStatus} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-red-50 border border-red-200 rounded-lg"
          >
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-red-800 font-medium">{error.message}</h4>
                {error.details && (
                  <p className="text-red-600 text-sm mt-1">{error.details}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-700"
              >
                ✕
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="environment" className="flex items-center space-x-2">
            <Container className="w-4 h-4" />
            <span>Ortam</span>
          </TabsTrigger>
          <TabsTrigger value="models" className="flex items-center space-x-2">
            <Cpu className="w-4 h-4" />
            <span>Modeller</span>
          </TabsTrigger>
          <TabsTrigger value="status" className="flex items-center space-x-2">
            <Activity className="w-4 h-4" />
            <span>Durum</span>
          </TabsTrigger>
        </TabsList>

        {/* Environment Selection Tab */}
        <TabsContent value="environment" className="space-y-4">
          <EnvironmentSelector
            environments={environments}
            selectedEnvironment={selectedEnvironment}
            onEnvironmentChange={handleEnvironmentChange}
            systemStatus={systemStatus}
          />
        </TabsContent>

        {/* Models Tab */}
        <TabsContent value="models" className="space-y-4">
          <ModelFilters
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedProvider={selectedProvider}
            setSelectedProvider={setSelectedProvider}
            selectedCapability={selectedCapability}
            setSelectedCapability={setSelectedCapability}
            showOnlyRecommended={showOnlyRecommended}
            setShowOnlyRecommended={setShowOnlyRecommended}
            showOnlyAvailable={showOnlyAvailable}
            setShowOnlyAvailable={setShowOnlyAvailable}
            providers={providers}
          />
          
          <ModelsList
            models={filteredModels}
            selectedModel={selectedModel}
            testingModel={testingModel}
            onModelSelect={handleModelSelect}
            onTestModel={handleTestModel}
            getProviderIcon={getProviderIcon}
            getCapabilityIcon={getCapabilityIcon}
            formatSize={formatSize}
            isLoading={isLoading}
          />
        </TabsContent>

        {/* Status Tab */}
        <TabsContent value="status" className="space-y-4">
          <SystemStatusPanel systemStatus={systemStatus} />
        </TabsContent>
      </Tabs>

      {/* Environment Setup Dialog */}
      <EnvironmentSetupDialog
        isOpen={isEnvironmentSetupOpen}
        onClose={() => setIsEnvironmentSetupOpen(false)}
        environment={selectedEnvironment}
        onSetupComplete={() => {
          setIsEnvironmentSetupOpen(false)
          loadModels()
        }}
      />
    </div>
  )
}

// Environment Selector Component
const EnvironmentSelector = ({ environments, selectedEnvironment, onEnvironmentChange, systemStatus }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Object.entries(environments).map(([key, env]) => {
        const Icon = env.icon
        const isSelected = selectedEnvironment === key
        const isAvailable = env.status === 'available' || 
                           (key === 'docker' && systemStatus?.connectionStatus?.docker === 'connected') ||
                           (key === 'sandbox' && systemStatus?.connectionStatus?.sandbox === 'connected')
        
        return (
          <motion.div
            key={key}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Card 
              className={`cursor-pointer transition-all duration-200 ${
                isSelected 
                  ? 'ring-2 ring-blue-500 ring-opacity-50 bg-blue-50 dark:bg-blue-950' 
                  : 'hover:shadow-md'
              } ${!isAvailable && env.status !== 'coming_soon' ? 'opacity-60' : ''}`}
              onClick={() => env.status !== 'coming_soon' && onEnvironmentChange(key)}
            >
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center bg-${env.color}-100 dark:bg-${env.color}-900`}>
                    <Icon className={`w-6 h-6 text-${env.color}-600 dark:text-${env.color}-400`} />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {env.name}
                      </h3>
                      {isSelected && (
                        <Badge variant="default" className="bg-blue-500">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Seçili
                        </Badge>
                      )}
                      {env.status === 'coming_soon' && (
                        <Badge variant="secondary">
                          Yakında
                        </Badge>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {env.description}
                    </p>
                    
                    <div className="space-y-2">
                      <div>
                        <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Gereksinimler:
                        </h4>
                        <ul className="text-xs text-gray-600 dark:text-gray-400">
                          {env.requirements.map((req, index) => (
                            <li key={index}>• {req}</li>
                          ))}
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Özellikler:
                        </h4>
                        <div className="flex flex-wrap gap-1">
                          {env.features.map((feature, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )
      })}
    </div>
  )
}

// Model Filters Component
const ModelFilters = ({ 
  searchTerm, setSearchTerm, selectedProvider, setSelectedProvider,
  selectedCapability, setSelectedCapability, showOnlyRecommended, setShowOnlyRecommended,
  showOnlyAvailable, setShowOnlyAvailable, providers 
}) => {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Model ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={selectedProvider} onValueChange={setSelectedProvider}>
            <SelectTrigger>
              <SelectValue placeholder="Sağlayıcı" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Sağlayıcılar</SelectItem>
              {Object.entries(providers).map(([key, provider]) => (
                <SelectItem key={key} value={key}>
                  {provider.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedCapability} onValueChange={setSelectedCapability}>
            <SelectTrigger>
              <SelectValue placeholder="Yetenek" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Yetenekler</SelectItem>
              <SelectItem value="chat">💬 Sohbet</SelectItem>
              <SelectItem value="code">💻 Kod</SelectItem>
              <SelectItem value="vision">👁️ Görsel</SelectItem>
              <SelectItem value="embedding">📊 Embedding</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center space-x-2">
            <Button
              variant={showOnlyRecommended ? "default" : "outline"}
              size="sm"
              onClick={() => setShowOnlyRecommended(!showOnlyRecommended)}
              className="flex-1"
            >
              <Star className="w-4 h-4 mr-1" />
              Önerilen
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant={showOnlyAvailable ? "default" : "outline"}
              size="sm"
              onClick={() => setShowOnlyAvailable(!showOnlyAvailable)}
              className="flex-1"
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              Mevcut
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Models List Component
const ModelsList = ({ 
  models, selectedModel, testingModel, onModelSelect, onTestModel,
  getProviderIcon, getCapabilityIcon, formatSize, isLoading 
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Mevcut Modeller ({models.length})</span>
          {isLoading && (
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Yükleniyor...</span>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-96">
          <div className="p-4 space-y-3">
            <AnimatePresence>
              {models.map((model, index) => (
                <motion.div
                  key={model.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <ModelCard
                    model={model}
                    isSelected={selectedModel?.id === model.id}
                    isTesting={testingModel === model.id}
                    onSelect={() => onModelSelect(model)}
                    onTest={() => onTestModel(model)}
                    getProviderIcon={getProviderIcon}
                    getCapabilityIcon={getCapabilityIcon}
                    formatSize={formatSize}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
            
            {models.length === 0 && !isLoading && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Model Bulunamadı
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Arama kriterlerinize uygun model bulunamadı.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// Model Card Component
const ModelCard = ({ 
  model, isSelected, isTesting, onSelect, onTest,
  getProviderIcon, getCapabilityIcon, formatSize 
}) => {
  const capabilities = Object.entries(model.capabilities || {})
    .filter(([, enabled]) => enabled)
    .map(([capability]) => capability)

  return (
    <Card className={`transition-all duration-200 cursor-pointer hover:shadow-md ${
      isSelected ? 'ring-2 ring-blue-500 ring-opacity-50 bg-blue-50 dark:bg-blue-950' : ''
    }`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1" onClick={onSelect}>
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white text-lg">
              {getProviderIcon(model.provider)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <h3 className="font-medium text-gray-900 dark:text-white truncate">
                  {model.name}
                </h3>
                {isSelected && (
                  <Badge variant="default" className="bg-blue-500">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Seçili
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400 mb-2">
                <span className="flex items-center space-x-1">
                  <span>{getProviderIcon(model.provider)}</span>
                  <span className="capitalize">{model.provider}</span>
                </span>
                
                {model.size && (
                  <span className="flex items-center space-x-1">
                    <HardDrive className="w-3 h-3" />
                    <span>{formatSize(model.size)}</span>
                  </span>
                )}
                
                {model.parameters && (
                  <span className="flex items-center space-x-1">
                    <Cpu className="w-3 h-3" />
                    <span>{model.parameters}</span>
                  </span>
                )}
              </div>
              
              {capabilities.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {capabilities.map(capability => {
                    const Icon = getCapabilityIcon(capability)
                    return (
                      <Badge key={capability} variant="secondary" className="text-xs">
                        <Icon className="w-3 h-3 mr-1" />
                        {capability}
                      </Badge>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2 ml-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onTest()
                    }}
                    disabled={isTesting}
                  >
                    {isTesting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Modeli Test Et</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// System Status Panel Component
const SystemStatusPanel = ({ systemStatus }) => {
  if (!systemStatus) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>Sistem durumu yükleniyor...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="w-5 h-5" />
            <span>Bağlantı Durumu</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(systemStatus.connectionStatus || {}).map(([key, status]) => (
              <div key={key} className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${
                  status === 'connected' ? 'bg-green-500' : 
                  status === 'partial' ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
                <span className="capitalize font-medium">{key}</span>
                <Badge variant={status === 'connected' ? 'default' : 'secondary'}>
                  {status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Model Providers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Server className="w-5 h-5" />
            <span>Model Sağlayıcıları</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(systemStatus.modelProviders || {}).map(([key, provider]) => (
              <div key={key} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    provider.status === 'available' ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <span className="font-medium">{provider.name}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">
                    {provider.modelCount || 0} model
                  </Badge>
                  <Badge variant={provider.status === 'available' ? 'default' : 'secondary'}>
                    {provider.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Docker Services */}
      {systemStatus.dockerServices && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Container className="w-5 h-5" />
              <span>Docker Servisleri</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(systemStatus.dockerServices).map(([key, service]) => (
                <div key={key} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      service.status === 'running' ? 'bg-green-500' : 
                      service.status === 'starting' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                    <span className="font-medium">{service.name}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {service.port && (
                      <Badge variant="outline">
                        :{service.port}
                      </Badge>
                    )}
                    <Badge variant={service.status === 'running' ? 'default' : 'secondary'}>
                      {service.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Environment Setup Dialog Component
const EnvironmentSetupDialog = ({ isOpen, onClose, environment, onSetupComplete }) => {
  const [isSetupInProgress, setIsSetupInProgress] = useState(false)
  const [setupProgress, setSetupProgress] = useState(0)
  const [setupStatus, setSetupStatus] = useState('')

  const handleSetup = async () => {
    setIsSetupInProgress(true)
    setSetupProgress(0)
    setSetupStatus('Docker kurulumu kontrol ediliyor...')

    try {
      // Simulate setup process
      const steps = [
        'Docker kurulumu kontrol ediliyor...',
        'Docker servisleri başlatılıyor...',
        'Konteynerler oluşturuluyor...',
        'Sağlık kontrolü yapılıyor...',
        'Kurulum tamamlandı!'
      ]

      for (let i = 0; i < steps.length; i++) {
        setSetupStatus(steps[i])
        setSetupProgress((i + 1) * 20)
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      onSetupComplete()
    } catch (error) {
      setSetupStatus(`Kurulum hatası: ${error.message}`)
    } finally {
      setIsSetupInProgress(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ortam Kurulumu</DialogTitle>
          <DialogDescription>
            {environment === 'docker' ? 'Docker' : 'Sandbox'} ortamını kurmak için aşağıdaki adımları takip edin.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {isSetupInProgress ? (
            <div className="space-y-4">
              <Progress value={setupProgress} className="w-full" />
              <p className="text-sm text-gray-600">{setupStatus}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                {environment === 'docker' 
                  ? 'Docker Desktop kurulu değil veya çalışmıyor. Kurulum yapmak ister misiniz?'
                  : 'Sandbox ortamı için Docker servisleri gerekli. Kurulum yapmak ister misiniz?'
                }
              </p>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={onClose}>
                  İptal
                </Button>
                <Button onClick={handleSetup}>
                  Kurulumu Başlat
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default memo(EnhancedModelSelector)

