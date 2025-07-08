import React, { useState, useEffect, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Progress } from '@/components/ui/progress.jsx'
import { ScrollArea } from '@/components/ui/scroll-area.jsx'
import { Separator } from '@/components/ui/separator.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Slider } from '@/components/ui/slider.jsx'
import { Switch } from '@/components/ui/switch.jsx'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog.jsx'
import {
  Cpu,
  Server,
  Zap,
  Settings,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Upload,
  Download,
  Activity,
  MemoryStick,
  HardDrive,
  Thermometer,
  Eye,
  Plus,
  Trash2,
  Play,
  Square,
  BarChart3,
  Shield,
  Clock,
  Gauge
} from 'lucide-react'

const VLLMManager = ({ onModelSelect }) => {
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)
  const [models, setModels] = useState([])
  const [loadedModel, setLoadedModel] = useState(null)
  const [isLoadingModel, setIsLoadingModel] = useState(false)
  const [loadModelDialogOpen, setLoadModelDialogOpen] = useState(false)

  // Model configuration state
  const [modelConfig, setModelConfig] = useState({
    model_path: '',
    tensor_parallel_size: 1,
    max_model_len: null,
    temperature: 0.7,
    top_p: 0.9,
    top_k: -1,
    max_tokens: 1024,
    trust_remote_code: false,
    gpu_memory_utilization: 0.85,
    enforce_eager: false,
    quantization: null
  })

  // Popular model configurations
  const popularModels = [
    {
      name: "meta-llama/Llama-2-7b-chat-hf",
      description: "Llama 2 7B Chat - Good balance of performance and speed",
      category: "chat",
      size: "7B",
      recommended: true
    },
    {
      name: "meta-llama/Llama-2-13b-chat-hf", 
      description: "Llama 2 13B Chat - Better quality, slower inference",
      category: "chat",
      size: "13B"
    },
    {
      name: "microsoft/DialoGPT-medium",
      description: "DialoGPT Medium - Conversational AI",
      category: "chat",
      size: "117M"
    },
    {
      name: "codellama/CodeLlama-7b-Python-hf",
      description: "Code Llama 7B Python - Code generation specialist",
      category: "code",
      size: "7B"
    },
    {
      name: "mistralai/Mistral-7B-Instruct-v0.1",
      description: "Mistral 7B Instruct - Fast and efficient",
      category: "instruction",
      size: "7B",
      recommended: true
    }
  ]

  // Check vLLM service health
  const checkHealth = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8000/health')
      if (response.ok) {
        const health = await response.json()
        setIsConnected(true)
        setError(null)
        
        // Update loaded model info
        if (health.current_model) {
          setLoadedModel({
            name: health.current_model,
            status: 'loaded'
          })
        } else {
          setLoadedModel(null)
        }
        
        return health
      } else {
        throw new Error(`Health check failed: ${response.status}`)
      }
    } catch (err) {
      setIsConnected(false)
      setError(err.message)
      return null
    }
  }, [])

  // Get system stats
  const getStats = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8000/stats')
      if (response.ok) {
        const statsData = await response.json()
        setStats(statsData)
        return statsData
      }
    } catch (err) {
      console.warn('Failed to get stats:', err)
    }
    return null
  }, [])

  // Get models list
  const getModels = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8000/models')
      if (response.ok) {
        const modelsData = await response.json()
        setModels(modelsData.data || [])
        return modelsData.data
      }
    } catch (err) {
      console.warn('Failed to get models:', err)
    }
    return []
  }, [])

  // Load model
  const loadModel = async (config) => {
    setIsLoadingModel(true)
    setError(null)
    
    try {
      const response = await fetch('http://localhost:8000/models/load', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ config })
      })
      
      if (response.ok) {
        const result = await response.json()
        setLoadedModel({
          name: config.model_path,
          status: 'loaded'
        })
        setLoadModelDialogOpen(false)
        
        // Refresh models and stats
        setTimeout(() => {
          getModels()
          getStats()
        }, 2000)
        
        return result
      } else {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to load model')
      }
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoadingModel(false)
    }
  }

  // Unload model
  const unloadModel = async () => {
    setIsLoadingModel(true)
    setError(null)
    
    try {
      const response = await fetch('http://localhost:8000/models/unload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        setLoadedModel(null)
        getModels()
        getStats()
        return await response.json()
      } else {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to unload model')
      }
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoadingModel(false)
    }
  }

  // Initialize and refresh data
  useEffect(() => {
    const init = async () => {
      setIsLoading(true)
      await checkHealth()
      await getStats()
      await getModels()
      setIsLoading(false)
    }

    init()

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      checkHealth()
      getStats()
      getModels()
    }, 30000)

    return () => clearInterval(interval)
  }, [checkHealth, getStats, getModels])

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  const formatGPUMemory = (gpu) => {
    if (!gpu) return null
    return `${formatBytes(gpu.allocated)} / ${formatBytes(gpu.total)} (${gpu.percent.toFixed(1)}%)`
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Zap className="w-6 h-6 text-purple-600" />
          </div>
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900">vLLM Bağlantısı Kontrol Ediliyor</h3>
          <p className="text-gray-600">Yüksek performanslı AI hızlandırma servisi...</p>
        </div>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-6">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
          <XCircle className="w-10 h-10 text-red-600" />
        </div>
        <div className="text-center max-w-md">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">vLLM Servisi Bulunamadı</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
            <h4 className="font-medium text-purple-900 mb-3">vLLM Servisi Başlatma:</h4>
            <div className="space-y-2 text-sm">
              <div className="bg-purple-100 rounded p-2">
                <span className="font-medium">Docker ile:</span>
                <code className="block mt-1 text-purple-800">docker-compose up vllm-service</code>
              </div>
              <div className="bg-purple-100 rounded p-2">
                <span className="font-medium">Manuel:</span>
                <code className="block mt-1 text-purple-800">pip install vllm && python src/services/vllm_service/server.py</code>
              </div>
            </div>
          </div>
          
          <Button onClick={() => {
            setError(null)
            setIsLoading(true)
            checkHealth().then(() => setIsLoading(false))
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
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">vLLM Manager</h2>
              <p className="text-gray-600">Yüksek Performanslı AI Hızlandırma</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              <CheckCircle className="w-3 h-3 mr-1" />
              Bağlı
            </Badge>
            <Button variant="outline" size="sm" onClick={() => {
              checkHealth()
              getStats()
              getModels()
            }}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Current Model Status */}
        {loadedModel && (
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                  <Server className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-purple-900">Yüklü Model</h3>
                  <p className="text-sm text-purple-600">{loadedModel.name}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onModelSelect && onModelSelect({
                    id: loadedModel.name,
                    name: loadedModel.name,
                    provider: 'vllm',
                    status: 'loaded',
                    capabilities: {
                      chat: true,
                      completion: true,
                      high_performance: true,
                      gpu_acceleration: true
                    }
                  })}
                >
                  <Play className="w-4 h-4 mr-1" />
                  Kullan
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={unloadModel}
                  disabled={isLoadingModel}
                >
                  {isLoadingModel ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-6">
        <Tabs defaultValue="models" className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="models">Model Yönetimi</TabsTrigger>
            <TabsTrigger value="stats">Sistem İstatistikleri</TabsTrigger>
            <TabsTrigger value="config">Yapılandırma</TabsTrigger>
          </TabsList>

          {/* Models Tab */}
          <TabsContent value="models" className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Model Yükleme</h3>
              <Dialog open={loadModelDialogOpen} onOpenChange={setLoadModelDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Model Yükle
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>vLLM Model Yükleme</DialogTitle>
                    <DialogDescription>
                      Yüksek performanslı inference için bir model yükleyin
                    </DialogDescription>
                  </DialogHeader>

                  <Tabs defaultValue="popular" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="popular">Popüler Modeller</TabsTrigger>
                      <TabsTrigger value="custom">Özel Yapılandırma</TabsTrigger>
                    </TabsList>

                    <TabsContent value="popular" className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {popularModels.map((model, index) => (
                          <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow">
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-sm">{model.name}</CardTitle>
                                {model.recommended && (
                                  <Badge className="bg-purple-100 text-purple-800">Önerilen</Badge>
                                )}
                              </div>
                              <p className="text-xs text-gray-600">{model.description}</p>
                            </CardHeader>
                            <CardContent>
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-2">
                                  <Badge variant="outline">{model.category}</Badge>
                                  <Badge variant="outline">{model.size}</Badge>
                                </div>
                              </div>
                              <Button 
                                className="w-full" 
                                size="sm"
                                onClick={() => {
                                  setModelConfig(prev => ({
                                    ...prev,
                                    model_path: model.name
                                  }))
                                  loadModel({
                                    ...modelConfig,
                                    model_path: model.name
                                  })
                                }}
                                disabled={isLoadingModel}
                              >
                                {isLoadingModel ? (
                                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <Download className="w-4 h-4 mr-2" />
                                )}
                                Yükle
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent value="custom" className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="model_path">Model Yolu</Label>
                            <Input
                              id="model_path"
                              value={modelConfig.model_path}
                              onChange={(e) => setModelConfig(prev => ({
                                ...prev,
                                model_path: e.target.value
                              }))}
                              placeholder="huggingface/model-name veya /path/to/model"
                            />
                          </div>

                          <div>
                            <Label htmlFor="tensor_parallel">Tensor Parallel Size</Label>
                            <Input
                              id="tensor_parallel"
                              type="number"
                              min="1"
                              max="8"
                              value={modelConfig.tensor_parallel_size}
                              onChange={(e) => setModelConfig(prev => ({
                                ...prev,
                                tensor_parallel_size: parseInt(e.target.value)
                              }))}
                            />
                          </div>

                          <div>
                            <Label htmlFor="max_model_len">Max Model Length</Label>
                            <Input
                              id="max_model_len"
                              type="number"
                              value={modelConfig.max_model_len || ''}
                              onChange={(e) => setModelConfig(prev => ({
                                ...prev,
                                max_model_len: e.target.value ? parseInt(e.target.value) : null
                              }))}
                              placeholder="Auto (boş bırakın)"
                            />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <Label>GPU Memory Utilization: {modelConfig.gpu_memory_utilization}</Label>
                            <Slider
                              value={[modelConfig.gpu_memory_utilization]}
                              onValueChange={([value]) => setModelConfig(prev => ({
                                ...prev,
                                gpu_memory_utilization: value
                              }))}
                              max={1}
                              min={0.1}
                              step={0.05}
                              className="mt-2"
                            />
                          </div>

                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={modelConfig.trust_remote_code}
                              onCheckedChange={(checked) => setModelConfig(prev => ({
                                ...prev,
                                trust_remote_code: checked
                              }))}
                            />
                            <Label>Trust Remote Code</Label>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={modelConfig.enforce_eager}
                              onCheckedChange={(checked) => setModelConfig(prev => ({
                                ...prev,
                                enforce_eager: checked
                              }))}
                            />
                            <Label>Enforce Eager Execution</Label>
                          </div>

                          <div>
                            <Label htmlFor="quantization">Quantization</Label>
                            <select
                              id="quantization"
                              value={modelConfig.quantization || ''}
                              onChange={(e) => setModelConfig(prev => ({
                                ...prev,
                                quantization: e.target.value || null
                              }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            >
                              <option value="">None</option>
                              <option value="awq">AWQ</option>
                              <option value="gptq">GPTQ</option>
                              <option value="squeezellm">SqueezeLLM</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setLoadModelDialogOpen(false)}>
                          İptal
                        </Button>
                        <Button 
                          onClick={() => loadModel(modelConfig)}
                          disabled={!modelConfig.model_path || isLoadingModel}
                        >
                          {isLoadingModel ? (
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4 mr-2" />
                          )}
                          Model Yükle
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span className="text-sm text-red-800">{error}</span>
                </div>
              </div>
            )}

            {/* Loaded Models */}
            <div className="flex-1">
              {models.length === 0 ? (
                <div className="text-center py-12">
                  <Server className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Henüz Model Yüklenmedi
                  </h3>
                  <p className="text-gray-600 mb-4">
                    vLLM ile yüksek performanslı inference için bir model yükleyin
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {models.map((model, index) => (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold">{model.id}</h4>
                            <p className="text-sm text-gray-600">Status: {model.status}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge className="bg-purple-100 text-purple-800">vLLM</Badge>
                            <Button size="sm" onClick={() => onModelSelect && onModelSelect({
                              id: model.id,
                              name: model.id,
                              provider: 'vllm',
                              status: model.status,
                              capabilities: {
                                chat: true,
                                completion: true,
                                high_performance: true,
                                gpu_acceleration: true
                              }
                            })}>
                              Kullan
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats" className="flex-1">
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* CPU Stats */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center space-x-2">
                      <Cpu className="w-5 h-5" />
                      <span>CPU</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Kullanım</span>
                          <span>{stats.cpu_percent?.toFixed(1)}%</span>
                        </div>
                        <Progress value={stats.cpu_percent || 0} className="h-2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Memory Stats */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center space-x-2">
                      <MemoryStick className="w-5 h-5" />
                      <span>Bellek</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>RAM Kullanımı</span>
                          <span>{stats.memory_percent?.toFixed(1)}%</span>
                        </div>
                        <Progress value={stats.memory_percent || 0} className="h-2" />
                      </div>
                      <div className="text-xs text-gray-600">
                        <div>Kullanılabilir: {formatBytes(stats.memory_available)}</div>
                        <div>Toplam: {formatBytes(stats.memory_total)}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* GPU Stats */}
                {stats.gpu_memory && stats.gpu_memory.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center space-x-2">
                        <Zap className="w-5 h-5" />
                        <span>GPU ({stats.gpu_count})</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {stats.gpu_memory.map((gpu, index) => (
                          <div key={index}>
                            <div className="flex justify-between text-sm mb-1">
                              <span>GPU {gpu.device}</span>
                              <span>{gpu.percent?.toFixed(1)}%</span>
                            </div>
                            <Progress value={gpu.percent || 0} className="h-2" />
                            <div className="text-xs text-gray-600 mt-1">
                              {formatGPUMemory(gpu)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Disk Stats */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center space-x-2">
                      <HardDrive className="w-5 h-5" />
                      <span>Disk</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Kullanım</span>
                          <span>{stats.disk_usage?.percent?.toFixed(1)}%</span>
                        </div>
                        <Progress value={stats.disk_usage?.percent || 0} className="h-2" />
                      </div>
                      <div className="text-xs text-gray-600">
                        <div>Kullanılan: {formatBytes(stats.disk_usage?.used)}</div>
                        <div>Toplam: {formatBytes(stats.disk_usage?.total)}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* vLLM Status */}
                {stats.vllm && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center space-x-2">
                        <Zap className="w-5 h-5" />
                        <span>vLLM Status</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Available:</span>
                          <Badge variant={stats.vllm.available ? "default" : "destructive"}>
                            {stats.vllm.available ? "Yes" : "No"}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Model Loaded:</span>
                          <Badge variant={stats.vllm.model_loaded ? "default" : "secondary"}>
                            {stats.vllm.model_loaded ? "Yes" : "No"}
                          </Badge>
                        </div>
                        {stats.vllm.current_model && (
                          <div>
                            <span className="text-gray-600">Current Model:</span>
                            <p className="font-mono text-xs break-all">
                              {stats.vllm.current_model}
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          {/* Config Tab */}
          <TabsContent value="config" className="flex-1">
            <Card>
              <CardHeader>
                <CardTitle>vLLM Yapılandırması</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">Sistem Gereksinimleri</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• NVIDIA GPU (CUDA destekli)</li>
                      <li>• Minimum 8GB GPU belleği</li>
                      <li>• Python 3.8+ ve PyTorch 2.0+</li>
                      <li>• vLLM library kurulu</li>
                    </ul>
                  </div>
                  
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <h4 className="font-medium text-purple-900 mb-2">Özellikler</h4>
                    <ul className="text-sm text-purple-800 space-y-1">
                      <li>• Yüksek throughput inference</li>
                      <li>• Tensor parallelism desteği</li>
                      <li>• Quantization desteği (AWQ, GPTQ)</li>
                      <li>• Streaming responses</li>
                      <li>• OpenAI uyumlu API</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default VLLMManager