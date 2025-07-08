import React, { useState, memo, useCallback } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Progress } from '@/components/ui/progress.jsx'
import { ScrollArea } from '@/components/ui/scroll-area.jsx'
import StatusIndicator from '@/components/ui/status-indicator.jsx'
import HelpMessage from '@/components/ui/help-message.jsx'
import { translateStatus } from '@/utils/statusHelpers.js'
import { 
  RefreshCw, 
  CheckCircle, 
  Circle,
  Server,
  Activity,
  Clock,
  Cpu,
  MemoryStick,
  HardDrive,
  Zap,
  TrendingUp,
  FileText,
  Brain,
  Container,
  AlertCircle
} from 'lucide-react'

const SystemMonitoringPanel = ({ systemStats, selectedModel, currentPlan, activityLog, onClose }) => {
  const [activeSection, setActiveSection] = useState('system')


  const formatBytes = useCallback((bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }, [])

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl z-40">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Sistem İzleme</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          ✕
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          className={`flex-1 px-3 py-2 text-sm font-medium ${
            activeSection === 'system' 
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-950' 
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
          onClick={() => setActiveSection('system')}
        >
          <Server className="w-4 h-4 inline mr-1" />
          Sistem
        </button>
        <button
          className={`flex-1 px-3 py-2 text-sm font-medium ${
            activeSection === 'model' 
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-950' 
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
          onClick={() => setActiveSection('model')}
        >
          <Brain className="w-4 h-4 inline mr-1" />
          Model
        </button>
        <button
          className={`flex-1 px-3 py-2 text-sm font-medium ${
            activeSection === 'activity' 
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-950' 
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
          onClick={() => setActiveSection('activity')}
        >
          <Activity className="w-4 h-4 inline mr-1" />
          Aktivite
        </button>
      </div>

      {/* Content */}
      <ScrollArea className="h-full pb-16">
        {activeSection === 'system' && (
          <div className="p-4 space-y-4">
            {/* System Status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center">
                  <Server className="w-4 h-4 mr-2" />
                  Sistem Durumu
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">CPU</span>
                  <div className="flex items-center space-x-2">
                    <Progress value={systemStats?.cpu || 0} className="w-16 h-2" />
                    <span className="text-sm font-medium">{(systemStats?.cpu || 0).toFixed(1)}%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">RAM</span>
                  <div className="flex items-center space-x-2">
                    <Progress value={systemStats?.memory || 0} className="w-16 h-2" />
                    <span className="text-sm font-medium">{(systemStats?.memory || 0).toFixed(1)}%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Disk</span>
                  <div className="flex items-center space-x-2">
                    <Progress value={systemStats?.disk || 0} className="w-16 h-2" />
                    <span className="text-sm font-medium">{(systemStats?.disk || 0).toFixed(1)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Performance Metrics */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Performans
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Yanıt Süresi</span>
                  <span className="text-sm font-medium">{systemStats?.responseTime || 'Ölçülemiyor'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Toplam İstek</span>
                  <span className="text-sm font-medium">{systemStats?.totalRequests || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Başarı Oranı</span>
                  <span className="text-sm font-medium">{systemStats?.successRate || 'Hesaplanıyor'}</span>
                </div>
              </CardContent>
            </Card>

            {/* Memory Usage */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center">
                  <MemoryStick className="w-4 h-4 mr-2" />
                  Bellek Kullanımı
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Toplam</span>
                  <span className="text-sm font-medium">{formatBytes(systemStats?.totalMemory || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Kullanılan</span>
                  <span className="text-sm font-medium">{formatBytes(systemStats?.usedMemory || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Boş</span>
                  <span className="text-sm font-medium">{formatBytes(systemStats?.freeMemory || 0)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Docker Status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center">
                  <Container className="w-4 h-4 mr-2" />
                  Docker Durumu
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Durum</span>
                  <StatusIndicator 
                    status={systemStats?.dockerStatus || 'unknown'} 
                    size="sm"
                    pulse={systemStats?.dockerStatus === 'starting' || systemStats?.dockerStatus === 'stopping'}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Konteyner</span>
                  <span className="text-sm font-medium">{systemStats?.containerCount || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Çalışan</span>
                  <span className="text-sm font-medium">{systemStats?.runningContainers || 0}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeSection === 'model' && (
          <div className="p-4 space-y-4">
            {/* Selected Model Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center">
                  <Brain className="w-4 h-4 mr-2" />
                  Seçili Model
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedModel ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">İsim</span>
                      <span className="text-sm font-medium">{selectedModel.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Sağlayıcı</span>
                      <span className="text-sm font-medium">{selectedModel.provider}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Boyut</span>
                      <span className="text-sm font-medium">{formatBytes(selectedModel.size || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Durum</span>
                      <StatusIndicator 
                        status={selectedModel.status || 'unknown'} 
                        size="sm"
                        pulse={selectedModel.status === 'loading' || selectedModel.status === 'downloading'}
                      />
                    </div>
                  </>
                ) : (
                  <div className="p-4">
                    <HelpMessage 
                      errorType="no_models_available"
                      variant="inline"
                      onRetry={() => window.location.reload()}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Model Performance */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center">
                  <Zap className="w-4 h-4 mr-2" />
                  Model Performansı
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Token/sn</span>
                  <span className="text-sm font-medium">{systemStats?.tokensPerSecond || 'Ölçülemiyor'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Ortalama Gecikme</span>
                  <span className="text-sm font-medium">{systemStats?.averageLatency || 'Hesaplanıyor'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Toplam Token</span>
                  <span className="text-sm font-medium">{systemStats?.totalTokens || 0}</span>
                </div>
              </CardContent>
            </Card>

            {/* Current Plan */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  Mevcut Plan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {currentPlan ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Başlık</span>
                      <span className="text-sm font-medium">{currentPlan.title}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Durum</span>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(currentPlan.status || 'idle')}
                        <span className={`text-sm font-medium ${getStatusColor(currentPlan.status || 'idle')}`}>
                          {currentPlan.status || 'Bilinmiyor'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">İlerleme</span>
                      <div className="flex items-center space-x-2">
                        <Progress value={currentPlan.progress || 0} className="w-16 h-2" />
                        <span className="text-sm font-medium">{currentPlan.progress || 0}%</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Aktif plan yok</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeSection === 'activity' && (
          <div className="p-4 space-y-4">
            {/* Activity Log */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center">
                  <Clock className="w-4 h-4 mr-2" />
                  Aktivite Geçmişi
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {activityLog && activityLog.length > 0 ? (
                  <div className="space-y-2">
                    {activityLog.slice(-10).map((activity, index) => (
                      <div key={index} className="flex items-start space-x-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-700">
                        <div className="flex-shrink-0 mt-1">
                          {activity.type === 'error' ? (
                            <AlertCircle className="w-4 h-4 text-red-500" />
                          ) : activity.type === 'success' ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <Circle className="w-4 h-4 text-blue-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {activity.message}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(activity.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Henüz aktivite yok</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center">
                  <Activity className="w-4 h-4 mr-2" />
                  Son İşlemler
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Son Mesaj</span>
                    <span className="text-sm font-medium">{systemStats?.lastMessage || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Son İstek</span>
                    <span className="text-sm font-medium">{systemStats?.lastRequest || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Son Hata</span>
                    <span className="text-sm font-medium">{systemStats?.lastError || 'Yok'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

export default memo(SystemMonitoringPanel)