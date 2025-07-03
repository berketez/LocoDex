import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Progress } from '@/components/ui/progress.jsx'
import { ScrollArea } from '@/components/ui/scroll-area.jsx'
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip.jsx'
import { 
  Container,
  Shield,
  Monitor,
  Server,
  Play,
  Pause,
  Square,
  RefreshCw,
  Settings,
  AlertCircle,
  CheckCircle,
  Clock,
  Activity,
  BarChart3,
  Terminal,
  FileText,
  Download,
  Trash2,
  Home,
  Cloud,
  Cpu,
  HardDrive,
  Wifi,
  Lock
} from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import { locoDexAPI } from '@/services/api'

const EnvironmentManager = ({ className = '' }) => {
  const [environments, setEnvironments] = useState({})
  const [selectedEnvironment, setSelectedEnvironment] = useState('local')
  const [systemStatus, setSystemStatus] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [logs, setLogs] = useState({})
  const [isSetupDialogOpen, setIsSetupDialogOpen] = useState(false)
  const [setupProgress, setSetupProgress] = useState(0)

  // Environment definitions
  const environmentDefinitions = useMemo(() => ({
    local: {
      name: 'Yerel Ortam',
      description: 'Doğrudan yerel model sağlayıcıları',
      icon: Home,
      color: 'blue',
      features: ['Hızlı yanıt', 'Tam kontrol', 'Gizlilik'],
      requirements: ['LM Studio veya Ollama'],
      ports: [],
      services: []
    },
    docker: {
      name: 'Docker Ortamı',
      description: 'İzole Docker konteynerlerinde çalışan modeller',
      icon: Container,
      color: 'purple',
      features: ['İzolasyon', 'Ölçeklenebilirlik', 'Güvenlik'],
      requirements: ['Docker Desktop'],
      ports: [3001, 8080],
      services: ['ai-agent', 'api-gateway']
    },
    sandbox: {
      name: 'Sandbox Ortamı',
      description: 'Güvenli sandbox ortamında kod çalıştırma',
      icon: Shield,
      color: 'green',
      features: ['Maksimum güvenlik', 'Kod çalıştırma', 'İzolasyon'],
      requirements: ['Docker', 'Sandbox servisleri'],
      ports: [3001, 3002, 8080],
      services: ['ai-agent', 'sandbox', 'api-gateway']
    },
    cloud: {
      name: 'Bulut Ortamı',
      description: 'Bulut tabanlı AI servisleri',
      icon: Cloud,
      color: 'gray',
      features: ['Yüksek performans', 'Sınırsız kapasite'],
      requirements: ['İnternet bağlantısı', 'API anahtarları'],
      ports: [],
      services: [],
      comingSoon: true
    }
  }), []);
  const initializeEnvironments = useCallback(async () => {
    try {
      setIsLoading(true)
      const status = locoDexAPI.getSystemStatus()
      setSystemStatus(status)
      
      // Initialize environment states
      const envStates = {}
      Object.keys(environmentDefinitions).forEach(key => {
        envStates[key] = {
          ...environmentDefinitions[key],
          status: getEnvironmentStatus(key, status),
          services: getEnvironmentServices(key, status)
        }
      })
      
      setEnvironments(envStates)
    } catch (err) {
      setError({
        type: 'initialization_failed',
        message: 'Ortam başlatma hatası',
        details: err.message
      })
    } finally {
      setIsLoading(false)
    }
  }, [environmentDefinitions, getEnvironmentServices])

  useEffect(() => {
    initializeEnvironments()
    
    // Set up event listeners
    const handleStatusChange = (status) => setSystemStatus(status)
    const handleServiceStatusChange = (data) => updateServiceStatus(data)
    const handleError = (error) => setError(error)

    locoDexAPI.on('connectionStatusChanged', handleStatusChange)
    locoDexAPI.on('serviceStatusChanged', handleServiceStatusChange)
    locoDexAPI.on('error', handleError)

    return () => {
      locoDexAPI.off('connectionStatusChanged', handleStatusChange)
      locoDexAPI.off('serviceStatusChanged', handleServiceStatusChange)
      locoDexAPI.off('error', handleError)
    }
  }, [initializeEnvironments])

  

  const getEnvironmentStatus = (envKey, status) => {
    switch (envKey) {
      case 'local':
        return status?.connectionStatus?.models === 'connected' ? 'running' : 'stopped'
      case 'docker':
        return status?.connectionStatus?.docker === 'connected' ? 'running' : 'stopped'
      case 'sandbox':
        return status?.connectionStatus?.sandbox === 'connected' ? 'running' : 'stopped'
      case 'cloud':
        return 'coming_soon'
      default:
        return 'unknown'
    }
  }

  const getEnvironmentServices = useCallback((envKey, status) => {
    const envDef = environmentDefinitions[envKey]
    if (!envDef.services || envDef.services.length === 0) return []

    return envDef.services.map(serviceName => {
      const serviceStatus = status?.dockerServices?.[serviceName]
      return {
        name: serviceName,
        displayName: getServiceDisplayName(serviceName),
        status: serviceStatus?.status || 'stopped',
        port: serviceStatus?.port,
        containerId: serviceStatus?.containerId
      }
    })
  }, [environmentDefinitions])

  const getServiceDisplayName = (serviceName) => {
    const names = {
      'ai-agent': 'AI Agent',
      'sandbox': 'Sandbox',
      'api-gateway': 'API Gateway'
    }
    return names[serviceName] || serviceName
  }

  const updateServiceStatus = (data) => {
    setEnvironments(prev => {
      const updated = { ...prev }
      Object.keys(updated).forEach(key => {
        const env = updated[key]
        if (env.services) {
          env.services = env.services.map(service => 
            service.name === data.service 
              ? { ...service, status: data.status }
              : service
          )
        }
      })
      return updated
    })
  }

  const handleEnvironmentChange = async (envKey) => {
    try {
      setSelectedEnvironment(envKey)
      
      if (envKey === 'docker' || envKey === 'sandbox') {
        const env = environments[envKey]
        if (env.status === 'stopped') {
          setIsSetupDialogOpen(true)
        }
      }
    } catch (err) {
      setError({
        type: 'environment_change_failed',
        message: 'Ortam değişikliği başarısız',
        details: err.message
      })
    }
  }

  const handleStartEnvironment = async (envKey) => {
    try {
      setIsLoading(true)
      
      if (envKey === 'docker' || envKey === 'sandbox') {
        await locoDexAPI.startDockerServices()
      }
      
      await initializeEnvironments()
    } catch (err) {
      setError({
        type: 'start_failed',
        message: 'Ortam başlatma hatası',
        details: err.message
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleStopEnvironment = async (envKey) => {
    try {
      setIsLoading(true)
      
      if (envKey === 'docker' || envKey === 'sandbox') {
        await locoDexAPI.stopDockerServices()
      }
      
      await initializeEnvironments()
    } catch (err) {
      setError({
        type: 'stop_failed',
        message: 'Ortam durdurma hatası',
        details: err.message
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRestartEnvironment = async (envKey) => {
    try {
      setIsLoading(true)
      
      if (envKey === 'docker' || envKey === 'sandbox') {
        await locoDexAPI.restartDockerServices()
      }
      
      await initializeEnvironments()
    } catch (err) {
      setError({
        type: 'restart_failed',
        message: 'Ortam yeniden başlatma hatası',
        details: err.message
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleGetLogs = async (serviceName) => {
    try {
      const logData = await locoDexAPI.getServiceLogs(serviceName, 100)
      setLogs(prev => ({ ...prev, [serviceName]: logData }))
    } catch (err) {
      setError({
        type: 'logs_failed',
        message: 'Log alma hatası',
        details: err.message
      })
    }
  }

  const handleSetupEnvironment = async (envKey) => {
    try {
      setSetupProgress(0)
      
      // Simulate setup steps
      const steps = [
        'Docker kurulumu kontrol ediliyor...',
        'Gerekli imajlar indiriliyor...',
        'Konteynerler oluşturuluyor...',
        'Servisler başlatılıyor...',
        'Sağlık kontrolü yapılıyor...',
        'Kurulum tamamlandı!'
      ]

      for (let i = 0; i < steps.length; i++) {
        setSetupProgress((i + 1) * (100 / steps.length))
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      await handleStartEnvironment(envKey)
      setIsSetupDialogOpen(false)
    } catch (err) {
      setError({
        type: 'setup_failed',
        message: 'Kurulum hatası',
        details: err.message
      })
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return 'text-green-600'
      case 'starting': return 'text-yellow-600'
      case 'stopping': return 'text-orange-600'
      case 'stopped': return 'text-red-600'
      case 'coming_soon': return 'text-gray-400'
      default: return 'text-gray-600'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running': return CheckCircle
      case 'starting': return Clock
      case 'stopping': return Clock
      case 'stopped': return Square
      case 'coming_soon': return Clock
      default: return AlertCircle
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Ortam Yönetimi
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Çalışma ortamlarını yönetin ve izleyin
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={initializeEnvironments}
                  disabled={isLoading}
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Durumu Yenile</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Genel Bakış</TabsTrigger>
          <TabsTrigger value="services">Servisler</TabsTrigger>
          <TabsTrigger value="monitoring">İzleme</TabsTrigger>
          <TabsTrigger value="logs">Loglar</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(environments).map(([key, env]) => (
              <EnvironmentCard
                key={key}
                envKey={key}
                environment={env}
                isSelected={selectedEnvironment === key}
                onSelect={() => handleEnvironmentChange(key)}
                onStart={() => handleStartEnvironment(key)}
                onStop={() => handleStopEnvironment(key)}
                onRestart={() => handleRestartEnvironment(key)}
                getStatusColor={getStatusColor}
                getStatusIcon={getStatusIcon}
                isLoading={isLoading}
              />
            ))}
          </div>
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-4">
          <ServicesPanel
            environments={environments}
            onGetLogs={handleGetLogs}
            getStatusColor={getStatusColor}
            getStatusIcon={getStatusIcon}
          />
        </TabsContent>

        {/* Monitoring Tab */}
        <TabsContent value="monitoring" className="space-y-4">
          <MonitoringPanel systemStatus={systemStatus} />
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <LogsPanel
            logs={logs}
            environments={environments}
            onGetLogs={handleGetLogs}
          />
        </TabsContent>
      </Tabs>

      {/* Setup Dialog */}
      <EnvironmentSetupDialog
        isOpen={isSetupDialogOpen}
        onClose={() => setIsSetupDialogOpen(false)}
        environment={selectedEnvironment}
        progress={setupProgress}
        onSetup={() => handleSetupEnvironment(selectedEnvironment)}
      />
    </div>
  )
}

// Environment Card Component
const EnvironmentCard = ({ environment, isSelected, onSelect, onStart, onStop, onRestart,
  getStatusColor, getStatusIcon, isLoading 
}) => {
  const Icon = environment.icon
  const StatusIcon = getStatusIcon(environment.status)
  const canStart = environment.status === 'stopped' && !environment.comingSoon
  const canStop = environment.status === 'running' && !environment.comingSoon
  const canRestart = environment.status === 'running' && !environment.comingSoon

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card 
        className={`cursor-pointer transition-all duration-200 ${
          isSelected 
            ? 'ring-2 ring-blue-500 ring-opacity-50 bg-blue-50 dark:bg-blue-950' 
            : 'hover:shadow-md'
        } ${environment.comingSoon ? 'opacity-60' : ''}`}
        onClick={() => !environment.comingSoon && onSelect()}
      >
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center bg-${environment.color}-100 dark:bg-${environment.color}-900`}>
                <Icon className={`w-6 h-6 text-${environment.color}-600 dark:text-${environment.color}-400`} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {environment.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {environment.description}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <StatusIcon className={`w-5 h-5 ${getStatusColor(environment.status)}`} />
              <Badge 
                variant={environment.status === 'running' ? 'default' : 'secondary'}
                className={environment.status === 'running' ? 'bg-green-500' : ''}
              >
                {environment.status === 'coming_soon' ? 'Yakında' : environment.status}
              </Badge>
            </div>
          </div>

          {/* Services */}
          {environment.services && environment.services.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Servisler:
              </h4>
              <div className="space-y-1">
                {environment.services.map(service => (
                  <div key={service.name} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      {service.displayName}
                    </span>
                    <div className="flex items-center space-x-2">
                      {service.port && (
                        <Badge variant="outline" className="text-xs">
                          :{service.port}
                        </Badge>
                      )}
                      <Badge 
                        variant={service.status === 'running' ? 'default' : 'secondary'}
                        className={`text-xs ${service.status === 'running' ? 'bg-green-500' : ''}`}
                      >
                        {service.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Features */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Özellikler:
            </h4>
            <div className="flex flex-wrap gap-1">
              {environment.features.map((feature, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {feature}
                </Badge>
              ))}
            </div>
          </div>

          {/* Actions */}
          {!environment.comingSoon && (
            <div className="flex items-center space-x-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onStart()
                      }}
                      disabled={!canStart || isLoading}
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Başlat</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onStop()
                      }}
                      disabled={!canStop || isLoading}
                    >
                      <Square className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Durdur</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRestart()
                      }}
                      disabled={!canRestart || isLoading}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Yeniden Başlat</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// Services Panel Component
const ServicesPanel = ({ environments, onGetLogs, getStatusColor, getStatusIcon }) => {
  const allServices = Object.entries(environments)
    .filter(([, env]) => env.services && env.services.length > 0)
    .flatMap(([, env]) => 
      env.services.map(service => ({
        ...service,
        environment: env.name,
        environmentName: env.name
      }))
    )

  return (
    <div className="space-y-4">
      {allServices.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Server className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Aktif Servis Yok
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Docker veya Sandbox ortamını başlatın
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {allServices.map(service => {
            const StatusIcon = getStatusIcon(service.status)
            
            return (
              <Card key={`${service.environment}-${service.name}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {service.displayName}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {service.environmentName}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <StatusIcon className={`w-4 h-4 ${getStatusColor(service.status)}`} />
                      <Badge 
                        variant={service.status === 'running' ? 'default' : 'secondary'}
                        className={service.status === 'running' ? 'bg-green-500' : ''}
                      >
                        {service.status}
                      </Badge>
                    </div>
                  </div>

                  {service.port && (
                    <div className="mb-3">
                      <Badge variant="outline">
                        Port: {service.port}
                      </Badge>
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onGetLogs(service.name)}
                    >
                      <FileText className="w-4 h-4 mr-1" />
                      Loglar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Monitoring Panel Component
const MonitoringPanel = ({ systemStatus }) => {
  if (!systemStatus) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Sistem durumu yükleniyor...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="w-5 h-5" />
            <span>Bağlantı Durumu</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(systemStatus.connectionStatus || {}).map(([key, status]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="capitalize font-medium">{key}</span>
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${
                    status === 'connected' ? 'bg-green-500' : 
                    status === 'partial' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                  <Badge variant={status === 'connected' ? 'default' : 'secondary'}>
                    {status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Resource Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5" />
            <span>Kaynak Kullanımı</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>CPU</span>
                <span>45%</span>
              </div>
              <Progress value={45} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Bellek</span>
                <span>62%</span>
              </div>
              <Progress value={62} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Disk</span>
                <span>28%</span>
              </div>
              <Progress value={28} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Logs Panel Component
const LogsPanel = ({ logs, environments, onGetLogs }) => {
  const [selectedService, setSelectedService] = useState('')

  const allServices = Object.entries(environments)
    .filter(([, env]) => env.services && env.services.length > 0)
    .flatMap(([, env]) => 
      env.services.map(service => ({
        ...service,
        environment: env.name,
        environmentName: env.name
      }))
    )

  return (
    <div className="space-y-4">
      {/* Service Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium">Servis Seç:</span>
            <div className="flex flex-wrap gap-2">
              {allServices.map(service => (
                <Button
                  key={`${service.environment}-${service.name}`}
                  variant={selectedService === service.name ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSelectedService(service.name)
                    onGetLogs(service.name)
                  }}
                >
                  {service.displayName}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Display */}
      {selectedService && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{selectedService} Logları</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onGetLogs(selectedService)}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Yenile
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-96">
              <div className="p-4">
                <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-mono">
                  {logs[selectedService] || 'Log verisi yükleniyor...'}
                </pre>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Environment Setup Dialog Component
const EnvironmentSetupDialog = ({ isOpen, onClose, environment, progress, onSetup }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ortam Kurulumu</DialogTitle>
          <DialogDescription>
            {environment} ortamını kurmak için gerekli adımlar gerçekleştiriliyor.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {progress > 0 ? (
            <div className="space-y-4">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-gray-600">
                Kurulum devam ediyor... {Math.round(progress)}%
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                {environment} ortamını kurmak için Docker servisleri başlatılacak.
              </p>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={onClose}>
                  İptal
                </Button>
                <Button onClick={onSetup}>
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

export default EnvironmentManager

