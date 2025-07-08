import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { ScrollArea } from '@/components/ui/scroll-area.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import StatusIndicator from '@/components/ui/status-indicator.jsx'
import { 
  Monitor, 
  Play, 
  Pause, 
  RefreshCw,
  Activity,
  Brain,
  Container,
  Terminal,
  Eye,
  EyeOff,
  Settings,
  Download,
  Upload,
  Clock,
  Zap,
  MemoryStick,
  Cpu,
  HardDrive
} from 'lucide-react'

const ModelActivityMonitor = ({ selectedModel, dockerServices = [], onClose }) => {
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [activityLogs, setActivityLogs] = useState([])
  const [modelMetrics, setModelMetrics] = useState({})
  const [containerLogs, setContainerLogs] = useState({})
  const [filters, setFilters] = useState({
    showRequests: true,
    showResponses: true,
    showErrors: true,
    showDebug: false,
    selectedContainer: 'all'
  })
  
  const scrollAreaRef = useRef(null)
  const lastLogTime = useRef(Date.now())

  // Canlı izleme başlat/durdur
  const toggleMonitoring = () => {
    setIsMonitoring(!isMonitoring)
    if (!isMonitoring) {
      startRealTimeMonitoring()
    } else {
      stopRealTimeMonitoring()
    }
  }

  // Gerçek zamanlı izleme başlat
  const startRealTimeMonitoring = () => {
    // WebSocket veya EventSource ile backend'e bağlan
    const eventSource = new EventSource('/api/monitor/stream')
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      handleNewActivity(data)
    }

    eventSource.onerror = () => {
      console.log('Model izleme bağlantısı kesildi')
      setIsMonitoring(false)
    }

    // Docker container logları
    if (dockerServices.length > 0) {
      startDockerLogStream()
    }
  }

  // İzlemeyi durdur
  const stopRealTimeMonitoring = () => {
    // Bağlantıları kapat
    // eventSource?.close()
  }

  // Yeni aktivite al
  const handleNewActivity = (activity) => {
    const timestamp = new Date().toLocaleTimeString('tr-TR', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    })

    const logEntry = {
      id: Date.now() + Math.random(),
      timestamp,
      type: activity.type,
      source: activity.source || 'model',
      content: activity.content,
      metadata: activity.metadata || {},
      level: activity.level || 'info'
    }

    setActivityLogs(prev => {
      const newLogs = [...prev, logEntry].slice(-1000) // Son 1000 log
      return newLogs
    })

    // Metrics güncelle
    if (activity.metrics) {
      setModelMetrics(prev => ({
        ...prev,
        ...activity.metrics,
        lastUpdate: Date.now()
      }))
    }

    // Auto-scroll
    setTimeout(() => {
      if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
      }
    }, 100)
  }

  // Docker log stream
  const startDockerLogStream = () => {
    dockerServices.forEach(service => {
      if (service.status === 'running') {
        // Simulated docker logs - gerçekte docker API'den gelecek
        const interval = setInterval(() => {
          const logTypes = ['request', 'response', 'compute', 'memory', 'error']
          const randomType = logTypes[Math.floor(Math.random() * logTypes.length)]
          
          handleNewActivity({
            type: randomType,
            source: `docker:${service.name}`,
            content: generateMockDockerLog(service.name, randomType),
            level: randomType === 'error' ? 'error' : 'info',
            metadata: {
              container: service.name,
              port: service.port
            }
          })
        }, 2000 + Math.random() * 3000)

        return () => clearInterval(interval)
      }
    })
  }

  // Mock docker log generator
  const generateMockDockerLog = (containerName, type) => {
    switch (type) {
      case 'request':
        return `📥 Yeni sohbet isteği alındı - Token: ${Math.floor(Math.random() * 150)}+`
      case 'response':
        return `📤 Yanıt üretildi - ${Math.floor(Math.random() * 50)} token/sn`
      case 'compute':
        return `🧠 Model hesaplama - GPU: %${Math.floor(Math.random() * 100)}, RAM: ${Math.floor(Math.random() * 16)}GB`
      case 'memory':
        return `💾 Bellek kullanımı - Cache: ${Math.floor(Math.random() * 512)}MB, Swap: ${Math.floor(Math.random() * 100)}MB`
      case 'error':
        return `❌ Geçici hata - Bağlantı timeout, yeniden deneniyor...`
      default:
        return `ℹ️ Sistem durumu normal - Aktif bağlantı: ${Math.floor(Math.random() * 5)}`
    }
  }

  // Log filtreleme
  const filteredLogs = activityLogs.filter(log => {
    if (!filters.showRequests && log.type === 'request') return false
    if (!filters.showResponses && log.type === 'response') return false
    if (!filters.showErrors && log.level === 'error') return false
    if (!filters.showDebug && log.level === 'debug') return false
    if (filters.selectedContainer !== 'all' && 
        !log.source.includes(filters.selectedContainer)) return false
    return true
  })

  // Log rengi
  const getLogColor = (log) => {
    switch (log.level) {
      case 'error': return 'text-red-600 bg-red-50 border-red-200'
      case 'warn': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'debug': return 'text-gray-500 bg-gray-50 border-gray-200'
      default: return 'text-gray-700 bg-white border-gray-200'
    }
  }

  // Log ikonu
  const getLogIcon = (log) => {
    switch (log.type) {
      case 'request': return '📥'
      case 'response': return '📤'
      case 'compute': return '🧠'
      case 'memory': return '💾'
      case 'error': return '❌'
      default: return 'ℹ️'
    }
  }

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <Monitor className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Canlı İzleme
          </h2>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant={isMonitoring ? "default" : "outline"}
            size="sm"
            onClick={toggleMonitoring}
            className={isMonitoring ? "bg-green-600 hover:bg-green-700" : ""}
          >
            {isMonitoring ? (
              <>
                <Pause className="w-4 h-4 mr-1" />
                Durdur
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-1" />
                Başlat
              </>
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        </div>
      </div>

      {/* Model Info */}
      {selectedModel && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-gray-900 dark:text-white">
              {selectedModel.name}
            </h3>
            <StatusIndicator 
              status={isMonitoring ? 'monitoring' : 'idle'} 
              size="sm"
              pulse={isMonitoring}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">CPU:</span>
              <span className="font-medium">{modelMetrics.cpu || 0}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">RAM:</span>
              <span className="font-medium">{modelMetrics.memory || 0}MB</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Token/s:</span>
              <span className="font-medium">{modelMetrics.tokensPerSecond || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">İstek:</span>
              <span className="font-medium">{modelMetrics.activeRequests || 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-wrap gap-2 mb-2">
          <Button
            variant={filters.showRequests ? "default" : "outline"}
            size="xs"
            onClick={() => setFilters(f => ({ ...f, showRequests: !f.showRequests }))}
          >
            📥 İstekler
          </Button>
          <Button
            variant={filters.showResponses ? "default" : "outline"}
            size="xs"
            onClick={() => setFilters(f => ({ ...f, showResponses: !f.showResponses }))}
          >
            📤 Yanıtlar
          </Button>
          <Button
            variant={filters.showErrors ? "default" : "outline"}
            size="xs"
            onClick={() => setFilters(f => ({ ...f, showErrors: !f.showErrors }))}
          >
            ❌ Hatalar
          </Button>
        </div>
        <Button
          variant="outline"
          size="xs"
          onClick={() => setActivityLogs([])}
          className="w-full"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Logları Temizle
        </Button>
      </div>

      {/* Activity Logs */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-3">
        <div className="space-y-2">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {isMonitoring ? (
                <div>
                  <Activity className="w-8 h-8 mx-auto mb-2 animate-pulse" />
                  <p>Aktivite bekleniyor...</p>
                </div>
              ) : (
                <div>
                  <Eye className="w-8 h-8 mx-auto mb-2" />
                  <p>İzlemeyi başlatın</p>
                </div>
              )}
            </div>
          ) : (
            filteredLogs.map(log => (
              <div
                key={log.id}
                className={`p-2 rounded-lg border text-xs ${getLogColor(log)}`}
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center space-x-1">
                    <span>{getLogIcon(log)}</span>
                    <span className="font-medium text-xs">{log.source}</span>
                  </div>
                  <span className="text-xs opacity-75">{log.timestamp}</span>
                </div>
                <p className="text-xs leading-relaxed">{log.content}</p>
                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <div className="mt-1 pt-1 border-t border-current border-opacity-20">
                    {Object.entries(log.metadata).map(([key, value]) => (
                      <span key={key} className="inline-block mr-2 text-xs opacity-75">
                        {key}: {value}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Status Bar */}
      <div className="p-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{filteredLogs.length} log görüntüleniyor</span>
          {isMonitoring && (
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Canlı</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ModelActivityMonitor