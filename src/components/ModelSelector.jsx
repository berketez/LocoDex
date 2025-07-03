import React, { useState } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Progress } from '@/components/ui/progress.jsx'
import { ScrollArea } from '@/components/ui/scroll-area.jsx'
import { Separator } from '@/components/ui/separator.jsx'
import { Input } from '@/components/ui/input.jsx'
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
  Pause
} from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import { useModels } from '@/hooks/useModels.jsx'

const ModelSelector = ({ onModelSelect, className = '' }) => {
  const {
    models,
    providers,
    selectedModel,
    isLoading,
    error,
    lastUpdated,
    refreshModels,
    selectModel,
    testModel,
    clearError,
    getRecommendedModels,
    getStats
  } = useModels()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProvider, setSelectedProvider] = useState('all')
  const [selectedCapability, setSelectedCapability] = useState('all')
  const [showOnlyRecommended, setShowOnlyRecommended] = useState(false)
  const [testingModel, setTestingModel] = useState(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const stats = getStats()

  // Filter models based on search and filters
  const filteredModels = models.filter(model => {
    const matchesSearch = model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         model.provider.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesProvider = selectedProvider === 'all' || model.provider === selectedProvider
    
    const matchesCapability = selectedCapability === 'all' || 
                             (model.capabilities && model.capabilities[selectedCapability])
    
    const matchesRecommended = !showOnlyRecommended || 
                              getRecommendedModels().some(rec => rec.id === model.id)
    
    return matchesSearch && matchesProvider && matchesCapability && matchesRecommended
  })

  // Handle model selection
  const handleModelSelect = async (model) => {
    const success = await selectModel(model)
    if (success && onModelSelect) {
      onModelSelect(model)
    }
  }

  // Handle model test
  const handleTestModel = async (model) => {
    setTestingModel(model.id)
    try {
      await testModel(model)
    } finally {
      setTestingModel(null)
    }
  }

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
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Model Seçimi</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {stats.totalModels} model, {stats.availableProviders} sağlayıcı mevcut
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
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Model Ayarları</DialogTitle>
                <DialogDescription>
                  Model sağlayıcıları ve bağlantı ayarları
                </DialogDescription>
              </DialogHeader>
              <ProviderSettings providers={providers} />
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
                onClick={clearError}
                className="text-red-600 hover:text-red-700"
              >
                ✕
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                    {getProviderIcon(key)} {provider.name}
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
          </div>
        </CardContent>
      </Card>

      {/* Selected Model */}
      {selectedModel && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold">
                  {getProviderIcon(selectedModel.provider)}
                </div>
                <div>
                  <h3 className="font-medium text-blue-900 dark:text-blue-100">
                    Seçili Model: {selectedModel.name}
                  </h3>
                  <p className="text-sm text-blue-600 dark:text-blue-300">
                    {selectedModel.provider} • {formatSize(selectedModel.size)}
                  </p>
                </div>
              </div>
              <Badge variant="default" className="bg-blue-500">
                <CheckCircle className="w-3 h-3 mr-1" />
                Aktif
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Models List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Mevcut Modeller ({filteredModels.length})</span>
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
                {filteredModels.map((model, index) => (
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
                      onSelect={() => handleModelSelect(model)}
                      onTest={() => handleTestModel(model)}
                      getProviderIcon={getProviderIcon}
                      getCapabilityIcon={getCapabilityIcon}
                      formatSize={formatSize}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {filteredModels.length === 0 && !isLoading && (
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

      {/* Stats */}
      {lastUpdated && (
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Son güncelleme: {lastUpdated.toLocaleString('tr-TR')}
        </div>
      )}
    </div>
  )
}

// Model Card Component
const ModelCard = ({ 
  model, 
  isSelected, 
  isTesting, 
  onSelect, 
  onTest, 
  getProviderIcon, 
  getCapabilityIcon, 
  formatSize 
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

// Provider Settings Component
const ProviderSettings = ({ providers }) => {
  return (
    <div className="space-y-4">
      {Object.entries(providers).map(([key, provider]) => (
        <Card key={key}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="text-2xl">{key === 'ollama' ? '🦙' : key === 'lmstudio' ? '🎬' : '🤖'}</div>
                <div>
                  <h3 className="font-medium">{provider.name}</h3>
                  <p className="text-sm text-gray-500">
                    {provider.models?.length || 0} model mevcut
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {provider.status === 'available' ? (
                  <Badge variant="default" className="bg-green-500">
                    <Wifi className="w-3 h-3 mr-1" />
                    Çevrimiçi
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <WifiOff className="w-3 h-3 mr-1" />
                    Çevrimdışı
                  </Badge>
                )}
              </div>
            </div>
            
            {provider.models && provider.models.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Mevcut Modeller:
                </h4>
                <div className="flex flex-wrap gap-1">
                  {provider.models.slice(0, 5).map(model => (
                    <Badge key={model.id} variant="outline" className="text-xs">
                      {model.name}
                    </Badge>
                  ))}
                  {provider.models.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{provider.models.length - 5} daha
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default ModelSelector

