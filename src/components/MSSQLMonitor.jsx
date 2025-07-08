import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import {
  Database,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
  Clock,
  HardDrive,
  Cpu,
  Memory,
  Settings,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Zap,
  Table,
  Index,
  Search
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
  Legend
} from 'recharts';

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

const MSSQLMonitor = () => {
  const [metrics, setMetrics] = useState({
    connectionStatus: 'disconnected',
    lastUpdated: null,
    performance: null,
    queries: [],
    tables: [],
    indexes: [],
    recommendations: []
  });
  
  const [connectionConfig, setConnectionConfig] = useState({
    server: 'localhost',
    database: 'master',
    user: 'sa',
    password: ''
  });
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [performanceHistory, setPerformanceHistory] = useState([]);
  const wsRef = useRef(null);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const connectWebSocket = () => {
    try {
      wsRef.current = new WebSocket('ws://localhost:8002');
      
      wsRef.current.onopen = () => {
        console.log('Connected to MSSQL monitor');
      };
      
      wsRef.current.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'metrics') {
          setMetrics(message.data);
          
          // Update performance history
          if (message.data.performance) {
            setPerformanceHistory(prev => {
              const newHistory = [...prev, {
                timestamp: new Date(message.data.performance.timestamp).toLocaleTimeString(),
                cpu: message.data.performance.cpu_percent,
                memory: message.data.performance.memory_percent,
                connections: message.data.performance.active_connections
              }];
              return newHistory.slice(-20); // Keep last 20 points
            });
          }
        }
      };
      
      wsRef.current.onclose = () => {
        console.log('Disconnected from MSSQL monitor');
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

  const testConnection = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch('http://localhost:8002/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(connectionConfig),
      });
      
      const result = await response.json();
      if (result.success) {
        alert('Connection successful!');
      } else {
        alert(`Connection failed: ${result.message}`);
      }
    } catch (error) {
      alert(`Connection error: ${error.message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected': return 'text-green-500';
      case 'disconnected': return 'text-gray-500';
      case 'error': return 'text-red-500';
      default: return 'text-yellow-500';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'connected': return <CheckCircle className="w-4 h-4" />;
      case 'disconnected': return <XCircle className="w-4 h-4" />;
      case 'error': return <AlertTriangle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Database className="w-8 h-8 text-blue-500" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              MSSQL Monitor
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Real-time database monitoring and analysis
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className={`flex items-center space-x-2 ${getStatusColor(metrics.connectionStatus)}`}>
            {getStatusIcon(metrics.connectionStatus)}
            <span className="font-medium capitalize">{metrics.connectionStatus}</span>
          </div>
          {metrics.lastUpdated && (
            <span className="text-sm text-gray-500">
              Last updated: {new Date(metrics.lastUpdated).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Connection Configuration */}
      {metrics.connectionStatus !== 'connected' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="w-5 h-5" />
              <span>Database Connection</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="server">Server</Label>
                <Input
                  id="server"
                  value={connectionConfig.server}
                  onChange={(e) => setConnectionConfig(prev => ({ ...prev, server: e.target.value }))}
                  placeholder="localhost"
                />
              </div>
              <div>
                <Label htmlFor="database">Database</Label>
                <Input
                  id="database"
                  value={connectionConfig.database}
                  onChange={(e) => setConnectionConfig(prev => ({ ...prev, database: e.target.value }))}
                  placeholder="master"
                />
              </div>
              <div>
                <Label htmlFor="user">User</Label>
                <Input
                  id="user"
                  value={connectionConfig.user}
                  onChange={(e) => setConnectionConfig(prev => ({ ...prev, user: e.target.value }))}
                  placeholder="sa"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={connectionConfig.password}
                  onChange={(e) => setConnectionConfig(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Enter password"
                />
              </div>
            </div>
            <Button 
              className="mt-4" 
              onClick={testConnection}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Database className="w-4 h-4 mr-2" />
                  Test Connection
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Main Content - Only show if connected */}
      {metrics.connectionStatus === 'connected' && (
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="queries">Queries</TabsTrigger>
            <TabsTrigger value="storage">Storage</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <Cpu className="w-8 h-8 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">CPU Usage</p>
                      <p className="text-2xl font-bold">{metrics.performance?.cpu_percent?.toFixed(1) || 0}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <Memory className="w-8 h-8 text-green-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Memory Usage</p>
                      <p className="text-2xl font-bold">{metrics.performance?.memory_percent?.toFixed(1) || 0}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <Activity className="w-8 h-8 text-purple-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Connections</p>
                      <p className="text-2xl font-bold">{metrics.performance?.active_connections || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <HardDrive className="w-8 h-8 text-orange-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Database Size</p>
                      <p className="text-2xl font-bold">{formatBytes((metrics.performance?.database_size_mb || 0) * 1024 * 1024)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Real-time Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Real-time Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={performanceHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="cpu" stroke="#3b82f6" name="CPU %" />
                    <Line type="monotone" dataKey="memory" stroke="#10b981" name="Memory %" />
                    <Line type="monotone" dataKey="connections" stroke="#f59e0b" name="Connections" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* CPU and Memory Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Resource Usage</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={performanceHistory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="timestamp" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="cpu" stackId="1" stroke="#3b82f6" fill="#3b82f6" name="CPU %" />
                      <Area type="monotone" dataKey="memory" stackId="2" stroke="#10b981" fill="#10b981" name="Memory %" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Connection Activity */}
              <Card>
                <CardHeader>
                  <CardTitle>Connection Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={performanceHistory.slice(-10)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="timestamp" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="connections" fill="#f59e0b" name="Active Connections" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Queries Tab */}
          <TabsContent value="queries" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Search className="w-5 h-5" />
                  <span>Slow Queries</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {metrics.queries.length > 0 ? (
                      metrics.queries.map((query, index) => (
                        <div key={index} className="p-4 border rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <Badge variant="outline">
                              {query.avg_elapsed_time_ms?.toFixed(2)}ms avg
                            </Badge>
                            <div className="text-sm text-gray-500">
                              Executed {query.execution_count} times
                            </div>
                          </div>
                          <code className="text-sm bg-gray-100 dark:bg-gray-800 p-2 rounded block">
                            {query.query_text}
                          </code>
                          <div className="mt-2 text-xs text-gray-500">
                            Logical reads: {query.logical_reads?.toLocaleString()} | 
                            Physical reads: {query.physical_reads?.toLocaleString()}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-gray-500 py-8">
                        No slow queries detected
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Storage Tab */}
          <TabsContent value="storage" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Tables */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Table className="w-5 h-5" />
                    <span>Table Analysis</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-80">
                    <div className="space-y-2">
                      {metrics.tables.map((table, index) => (
                        <div key={index} className="flex justify-between items-center p-3 border rounded">
                          <div>
                            <div className="font-medium">{table.table_name}</div>
                            <div className="text-sm text-gray-500">
                              {table.row_count?.toLocaleString()} rows
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{formatBytes(table.size_kb * 1024)}</div>
                            <div className="text-sm text-gray-500">
                              {((table.used_space_kb / table.size_kb) * 100).toFixed(1)}% used
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Indexes */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Index className="w-5 h-5" />
                    <span>Index Analysis</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-80">
                    <div className="space-y-2">
                      {metrics.indexes.map((index, idx) => (
                        <div key={idx} className="p-3 border rounded">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="font-medium">{index.index_name}</div>
                              <div className="text-sm text-gray-500">{index.table_name}</div>
                            </div>
                            <Badge variant={
                              index.status === 'Active' ? 'default' :
                              index.status === 'Unused' ? 'destructive' : 'secondary'
                            }>
                              {index.status}
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-500">
                            Seeks: {index.user_seeks} | Scans: {index.user_scans} | 
                            Lookups: {index.user_lookups} | Updates: {index.user_updates}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Recommendations Tab */}
          <TabsContent value="recommendations" className="space-y-6">
            <div className="space-y-4">
              {metrics.recommendations.length > 0 ? (
                metrics.recommendations.map((rec, index) => (
                  <Alert key={index} className={
                    rec.severity === 'high' ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10' :
                    rec.severity === 'medium' ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/10' :
                    'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/10'
                  }>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="flex items-center space-x-2">
                      <span>{rec.title}</span>
                      <Badge variant={getSeverityColor(rec.severity)}>
                        {rec.severity}
                      </Badge>
                    </AlertTitle>
                    <AlertDescription>
                      <p className="mb-2">{rec.description}</p>
                      <p className="text-sm font-medium">💡 Suggestion: {rec.suggestion}</p>
                    </AlertDescription>
                  </Alert>
                ))
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                  <p>No recommendations at this time. Your database is performing well!</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default MSSQLMonitor;