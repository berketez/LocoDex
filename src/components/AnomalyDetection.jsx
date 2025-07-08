import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  TrendingUp,
  TrendingDown,
  Bell,
  BellOff,
  Zap,
  Shield,
  BarChart3,
  Eye,
  Settings,
  RefreshCw,
  Target,
  Brain,
  AlertCircle,
  Info,
  Flame
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ScatterChart,
  Scatter
} from 'recharts';

const SEVERITY_COLORS = {
  critical: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6'
};

const SEVERITY_ICONS = {
  critical: <Flame className="w-4 h-4" />,
  warning: <AlertTriangle className="w-4 h-4" />,
  info: <Info className="w-4 h-4" />
};

const AnomalyDetection = () => {
  const [alerts, setAlerts] = useState([]);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [anomalyStats, setAnomalyStats] = useState({
    total: 0,
    critical: 0,
    warning: 0,
    info: 0,
    last24h: 0
  });
  const [monitoringStatus, setMonitoringStatus] = useState({
    active: false,
    connectedClients: 0,
    lastUpdate: null
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [selectedTab, setSelectedTab] = useState('dashboard');
  const [anomalyTrends, setAnomalyTrends] = useState([]);
  const [serviceHealth, setServiceHealth] = useState({});
  const [baselines, setBaselines] = useState({});
  const wsRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Initialize WebSocket connection
    connectWebSocket();
    
    // Load initial data
    loadRecentAlerts();
    loadBaselines();
    
    // Set up periodic data refresh
    const interval = setInterval(() => {
      loadRecentAlerts();
      loadBaselines();
    }, 60000); // Every minute

    return () => {
      clearInterval(interval);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const connectWebSocket = () => {
    try {
      wsRef.current = new WebSocket('ws://localhost:8003/ws');
      
      wsRef.current.onopen = () => {
        console.log('Connected to anomaly detection service');
        setMonitoringStatus(prev => ({ ...prev, active: true }));
      };
      
      wsRef.current.onmessage = (event) => {
        const message = JSON.parse(event.data);
        
        if (message.type === 'anomaly_alerts') {
          handleNewAlerts(message.alerts);
        } else if (message.type === 'status') {
          setMonitoringStatus({
            active: message.monitoring_active,
            connectedClients: message.connected_clients || 0,
            lastUpdate: new Date(message.timestamp)
          });
        }
      };
      
      wsRef.current.onclose = () => {
        console.log('Disconnected from anomaly detection service');
        setMonitoringStatus(prev => ({ ...prev, active: false }));
        // Attempt to reconnect after 5 seconds
        setTimeout(connectWebSocket, 5000);
      };
      
      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  };

  const handleNewAlerts = (newAlerts) => {
    setAlerts(prev => [...newAlerts, ...prev].slice(0, 100)); // Keep last 100 alerts
    
    // Update statistics
    const now = new Date();
    const last24h = now.getTime() - (24 * 60 * 60 * 1000);
    
    setAnomalyStats(prev => {
      const allAlerts = [...newAlerts, ...prev.alerts || []];
      const recentAlerts = allAlerts.filter(alert => 
        new Date(alert.timestamp).getTime() > last24h
      );
      
      return {
        total: allAlerts.length,
        critical: allAlerts.filter(a => a.severity === 'critical').length,
        warning: allAlerts.filter(a => a.severity === 'warning').length,
        info: allAlerts.filter(a => a.severity === 'info').length,
        last24h: recentAlerts.length
      };
    });
    
    // Update trends
    updateAnomalyTrends(newAlerts);
    
    // Show notifications for critical alerts
    newAlerts.forEach(alert => {
      if (alert.severity === 'critical' && notificationsEnabled) {
        showNotification(alert);
        playAlertSound();
      }
    });
  };

  const loadRecentAlerts = async () => {
    try {
      const response = await fetch('http://localhost:8003/alerts?limit=100');
      if (response.ok) {
        const data = await response.json();
        setRecentAlerts(data.alerts);
        
        // Update stats
        const now = new Date();
        const last24h = now.getTime() - (24 * 60 * 60 * 1000);
        const recentCount = data.alerts.filter(alert => 
          new Date(alert.timestamp).getTime() > last24h
        ).length;
        
        setAnomalyStats({
          total: data.alerts.length,
          critical: data.alerts.filter(a => a.severity === 'critical').length,
          warning: data.alerts.filter(a => a.severity === 'warning').length,
          info: data.alerts.filter(a => a.severity === 'info').length,
          last24h: recentCount
        });
      }
    } catch (error) {
      console.error('Failed to load recent alerts:', error);
    }
  };

  const loadBaselines = async () => {
    try {
      const response = await fetch('http://localhost:8003/metrics/baselines');
      if (response.ok) {
        const data = await response.json();
        setBaselines(data.baselines);
      }
    } catch (error) {
      console.error('Failed to load baselines:', error);
    }
  };

  const updateAnomalyTrends = (newAlerts) => {
    const now = new Date();
    const timeSlot = Math.floor(now.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000); // 5-minute slots
    
    setAnomalyTrends(prev => {
      const existingIndex = prev.findIndex(trend => trend.timestamp === timeSlot);
      
      if (existingIndex >= 0) {
        // Update existing slot
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          count: updated[existingIndex].count + newAlerts.length,
          critical: updated[existingIndex].critical + newAlerts.filter(a => a.severity === 'critical').length,
          warning: updated[existingIndex].warning + newAlerts.filter(a => a.severity === 'warning').length,
          info: updated[existingIndex].info + newAlerts.filter(a => a.severity === 'info').length
        };
        return updated.slice(-24); // Keep last 2 hours (24 * 5-minute slots)
      } else {
        // Add new slot
        return [...prev, {
          timestamp: timeSlot,
          time: new Date(timeSlot).toLocaleTimeString(),
          count: newAlerts.length,
          critical: newAlerts.filter(a => a.severity === 'critical').length,
          warning: newAlerts.filter(a => a.severity === 'warning').length,
          info: newAlerts.filter(a => a.severity === 'info').length
        }].slice(-24);
      }
    });
  };

  const showNotification = (alert) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`🚨 ${alert.service.toUpperCase()} Anomaly`, {
        body: alert.message,
        icon: '/favicon.ico',
        tag: alert.id
      });
    }
  };

  const playAlertSound = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.log('Audio play failed:', e));
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'info': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatValue = (value) => {
    return typeof value === 'number' ? value.toFixed(2) : value;
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Audio element for alerts */}
      <audio ref={audioRef} preload="auto">
        <source src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+j4tGQdBzuP1Ozc" type="audio/wav" />
      </audio>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Shield className="w-8 h-8 text-red-500" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Anomaly Detection
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              AI-powered real-time system monitoring and alerts
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className={`flex items-center space-x-2 ${monitoringStatus.active ? 'text-green-500' : 'text-red-500'}`}>
            {monitoringStatus.active ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
            <span className="font-medium">
              {monitoringStatus.active ? 'Active' : 'Inactive'}
            </span>
          </div>
          
          <Button
            variant={notificationsEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
          >
            {notificationsEnabled ? (
              <Bell className="w-4 h-4 mr-2" />
            ) : (
              <BellOff className="w-4 h-4 mr-2" />
            )}
            Notifications
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Activity className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Alerts</p>
                <p className="text-2xl font-bold">{anomalyStats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Flame className="w-8 h-8 text-red-500" />
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Critical</p>
                <p className="text-2xl font-bold text-red-600">{anomalyStats.critical}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Warnings</p>
                <p className="text-2xl font-bold text-yellow-600">{anomalyStats.warning}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Clock className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Last 24h</p>
                <p className="text-2xl font-bold">{anomalyStats.last24h}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="baselines">Baselines</TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Anomaly Trends Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Anomaly Trends (Last 2 Hours)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={anomalyTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="critical" stackId="1" stroke="#ef4444" fill="#ef4444" name="Critical" />
                    <Area type="monotone" dataKey="warning" stackId="1" stroke="#f59e0b" fill="#f59e0b" name="Warning" />
                    <Area type="monotone" dataKey="info" stackId="1" stroke="#3b82f6" fill="#3b82f6" name="Info" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Service Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Alert Distribution by Service</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'MSSQL', value: recentAlerts.filter(a => a.service === 'mssql').length, fill: '#3b82f6' },
                        { name: 'Docker', value: recentAlerts.filter(a => a.service === 'docker').length, fill: '#10b981' },
                        { name: 'System', value: recentAlerts.filter(a => a.service === 'system').length, fill: '#f59e0b' },
                        { name: 'Other', value: recentAlerts.filter(a => !['mssql', 'docker', 'system'].includes(a.service)).length, fill: '#8b5cf6' }
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Recent Critical Alerts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Flame className="w-5 h-5 text-red-500" />
                <span>Recent Critical Alerts</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {recentAlerts
                    .filter(alert => alert.severity === 'critical')
                    .slice(0, 10)
                    .map((alert, index) => (
                      <Alert key={index} className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10">
                        <Flame className="h-4 w-4" />
                        <AlertTitle className="flex items-center justify-between">
                          <span>{alert.service.toUpperCase()} - {alert.metric_name}</span>
                          <Badge variant="destructive">{alert.severity}</Badge>
                        </AlertTitle>
                        <AlertDescription>
                          <p>{alert.message}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Value: {formatValue(alert.value)} | Score: {alert.anomaly_score?.toFixed(2)} | {formatTimestamp(alert.timestamp)}
                          </p>
                        </AlertDescription>
                      </Alert>
                    ))}
                  {recentAlerts.filter(alert => alert.severity === 'critical').length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                      <p>No critical alerts detected. System is healthy!</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>All Anomaly Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {recentAlerts.map((alert, index) => (
                    <div key={index} className={`p-4 border rounded-lg ${getSeverityColor(alert.severity)}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center space-x-2">
                          {SEVERITY_ICONS[alert.severity]}
                          <span className="font-medium">{alert.service.toUpperCase()}</span>
                          <Badge variant="outline">{alert.metric_name}</Badge>
                        </div>
                        <Badge variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
                          {alert.severity}
                        </Badge>
                      </div>
                      <p className="text-sm mb-2">{alert.message}</p>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="font-medium">Value:</span> {formatValue(alert.value)}
                        </div>
                        <div>
                          <span className="font-medium">Anomaly Score:</span> {alert.anomaly_score?.toFixed(2)}
                        </div>
                        <div>
                          <span className="font-medium">Expected Range:</span> 
                          {alert.expected_range?.min?.toFixed(2)} - {alert.expected_range?.max?.toFixed(2)}
                        </div>
                        <div>
                          <span className="font-medium">Time:</span> {formatTimestamp(alert.timestamp)}
                        </div>
                      </div>
                      {alert.metadata?.methods && (
                        <div className="mt-2">
                          <span className="text-xs font-medium">Detection Methods:</span>
                          <div className="flex space-x-1 mt-1">
                            {alert.metadata.methods.map((method, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {method}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Anomaly Detection Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={anomalyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="critical" stroke="#ef4444" name="Critical" strokeWidth={2} />
                  <Line type="monotone" dataKey="warning" stroke="#f59e0b" name="Warning" strokeWidth={2} />
                  <Line type="monotone" dataKey="info" stroke="#3b82f6" name="Info" strokeWidth={2} />
                  <Line type="monotone" dataKey="count" stroke="#8b5cf6" name="Total" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Baselines Tab */}
        <TabsContent value="baselines" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Metric Baselines</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {Object.entries(baselines).map(([key, baseline]) => {
                    const [service, metric] = key.split(':');
                    return (
                      <div key={key} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-medium">{service.toUpperCase()}</h4>
                            <p className="text-sm text-gray-600">{metric}</p>
                          </div>
                          <Badge variant="outline">Baseline</Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Mean:</span> {baseline.mean?.toFixed(2)}
                          </div>
                          <div>
                            <span className="font-medium">Std Dev:</span> {baseline.std?.toFixed(2)}
                          </div>
                          <div>
                            <span className="font-medium">Median:</span> {baseline.median?.toFixed(2)}
                          </div>
                          <div>
                            <span className="font-medium">Min:</span> {baseline.min?.toFixed(2)}
                          </div>
                          <div>
                            <span className="font-medium">Max:</span> {baseline.max?.toFixed(2)}
                          </div>
                          <div>
                            <span className="font-medium">IQR:</span> {baseline.q1?.toFixed(2)} - {baseline.q3?.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnomalyDetection;