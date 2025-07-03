import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Progress } from '@/components/ui/progress.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';
import { Separator } from '@/components/ui/separator.jsx';

import {
  Search,
  Brain,
  Globe,
  FileText,
  Clock,
  CheckCircle,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  Zap,
  Eye,
  BookOpen,
  Target,
  Lightbulb,
  Database,
  Network,
  BarChart3,
  MessageSquare,
  ExternalLink,
  Copy,
  Download,
  Share
} from 'lucide-react';

const DeepResearch = () => {
  const [topic, setTopic] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [researches, setResearches] = useState([]);
  const [selectedResearch, setSelectedResearch] = useState(null);
  const [progressSteps, setProgressSteps] = useState([]);
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const wsRef = useRef(null);
  const scrollRef = useRef(null);

  // WebSocket bağlantısı
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        wsRef.current = new WebSocket('ws://localhost:8001/research_ws');
        
        wsRef.current.onopen = () => {
          setIsWebSocketConnected(true);
          console.log('Deep Research WebSocket bağlandı');
        };

        wsRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'progress') {
              setProgress(data.step * 100);
              setCurrentStep(data.message);
              setProgressSteps(prev => [...prev, {
                id: Date.now(),
                message: data.message,
                step: data.step,
                timestamp: new Date()
              }]);
            } else if (data.type === 'result') {
              setLoading(false);
              setProgress(100);
              
              // Araştırmayı geçmişe ekle
              const newResearch = {
                id: Date.now(),
                topic,
                result: data.data,
                timestamp: new Date(),
                steps: progressSteps.length,
                duration: progressSteps.length > 0 ? 
                  (Date.now() - progressSteps[0].timestamp.getTime()) / 1000 : 0
              };
              setResearches(prev => [newResearch, ...prev.slice(0, 9)]); // Son 10 araştırmayı sakla
              setSelectedResearch(newResearch);
            } else if (data.type === 'error') {
              setLoading(false);
              setCurrentStep('Hata oluştu');
            }
          } catch (err) {
            console.error('WebSocket mesaj parse hatası:', err);
          }
        };

        wsRef.current.onclose = () => {
          setIsWebSocketConnected(false);
          console.log('Deep Research WebSocket bağlantısı kesildi');
        };

        wsRef.current.onerror = (error) => {
          console.error('WebSocket hatası:', error);
          setIsWebSocketConnected(false);
        };
      } catch (error) {
        console.error('WebSocket bağlantı hatası:', error);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Scroll to bottom when new progress step is added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollToBottom();
    }
  }, [progressSteps, topic]);

  const handleResearch = async () => {
    if (!topic.trim()) {
      alert('Lütfen bir araştırma konusu girin.');
      return;
    }

    if (!isWebSocketConnected) {
      alert('WebSocket bağlantısı yok. Lütfen servisin çalıştığından emin olun.');
      return;
    }

    setLoading(true);
    setProgress(0);
    setCurrentStep('Araştırma başlatılıyor...');
    setProgressSteps([]);
    setSelectedResearch(null);

    try {
      // WebSocket üzerinden araştırma isteği gönder
      wsRef.current.send(JSON.stringify({
        topic: topic,
        model: 'gemma-3-27b-it' // Varsayılan model
      }));
    } catch (error) {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !loading) {
      handleResearch();
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const formatDuration = (seconds) => {
    return seconds < 60 ? `${seconds.toFixed(1)}s` : `${(seconds / 60).toFixed(1)}m`;
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-indigo-900/20">
      {/* Header */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-purple-200 dark:border-purple-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Deep Research Engine
              </h1>
              <p className="text-purple-600 dark:text-purple-400 flex items-center space-x-2">
                <Globe className="w-4 h-4" />
                <span>Powered by AI • Grok-style Deep Analysis</span>
                <div className={`w-2 h-2 rounded-full ${isWebSocketConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300">
              {researches.length} Araştırma
            </Badge>
            <Badge variant={isWebSocketConnected ? "default" : "destructive"}>
              {isWebSocketConnected ? "🟢 Bağlı" : "🔴 Bağlantı Yok"}
            </Badge>
          </div>
        </div>

        {/* Search Input */}
        <div className="flex space-x-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-400 w-5 h-5" />
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Derinlemesine araştırmak istediğiniz konuyu yazın... (örn: 'Kuantum bilgisayarların geleceği')"
              disabled={loading}
              className="pl-12 h-12 text-lg border-purple-300 focus:border-purple-500 focus:ring-purple-500"
            />
          </div>
          <Button 
            onClick={handleResearch}
            disabled={loading || !topic.trim() || !isWebSocketConnected}
            size="lg"
            className="h-12 px-8 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold shadow-lg"
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                Araştırılıyor
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 mr-2" />
                Deep Search
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Results Area */}
        <div className="flex-1 flex flex-col">
          {loading && (
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-purple-200 dark:border-purple-700 p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                    Araştırma İlerlemesi
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {progress.toFixed(0)}%
                  </span>
                </div>
                <Progress value={progress} className="h-2 bg-purple-100 dark:bg-purple-900" />
                <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                  <RefreshCw className="w-4 h-4 animate-spin text-purple-500" />
                  <span>{currentStep}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 p-6 overflow-hidden">
            {!selectedResearch && !loading && (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-md">
                  <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
                    <Brain className="w-12 h-12 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                    AI Destekli Derin Araştırma
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Herhangi bir konuyu girin ve AI'ımızın kapsamlı, çok kaynaklı araştırmasını izleyin.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-3 text-left">
                    <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3 border border-purple-200 dark:border-purple-700">
                      <Target className="w-5 h-5 text-purple-500 mb-2" />
                      <div className="text-sm">
                        <div className="font-medium text-gray-900 dark:text-white">Hedefli Analiz</div>
                        <div className="text-gray-600 dark:text-gray-400">Konuya odaklı derinlemesine araştırma</div>
                      </div>
                    </div>
                    
                    <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3 border border-purple-200 dark:border-purple-700">
                      <Database className="w-5 h-5 text-purple-500 mb-2" />
                      <div className="text-sm">
                        <div className="font-medium text-gray-900 dark:text-white">Çoklu Kaynak</div>
                        <div className="text-gray-600 dark:text-gray-400">Farklı perspektiflerden bilgi toplama</div>
                      </div>
                    </div>
                    
                    <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3 border border-purple-200 dark:border-purple-700">
                      <Lightbulb className="w-5 h-5 text-purple-500 mb-2" />
                      <div className="text-sm">
                        <div className="font-medium text-gray-900 dark:text-white">AI Sentezi</div>
                        <div className="text-gray-600 dark:text-gray-400">Akıllı bilgi birleştirme</div>
                      </div>
                    </div>
                    
                    <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3 border border-purple-200 dark:border-purple-700">
                      <TrendingUp className="w-5 h-5 text-purple-500 mb-2" />
                      <div className="text-sm">
                        <div className="font-medium text-gray-900 dark:text-white">Trend Analizi</div>
                        <div className="text-gray-600 dark:text-gray-400">Güncel gelişmeleri takip</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedResearch && (
              <ScrollArea className="h-full">
                <div className="max-w-4xl mx-auto space-y-6">
                  {/* Research Header */}
                  <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-purple-200 dark:border-purple-700">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-xl text-purple-900 dark:text-purple-100 mb-2">
                            {selectedResearch.topic}
                          </CardTitle>
                          <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                            <div className="flex items-center space-x-1">
                              <Clock className="w-4 h-4" />
                              <span>{selectedResearch.timestamp.toLocaleString('tr-TR')}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <TrendingUp className="w-4 h-4" />
                              <span>{selectedResearch.steps} adım</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Zap className="w-4 h-4" />
                              <span>{formatDuration(selectedResearch.duration)}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(selectedResearch.result)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const blob = new Blob([selectedResearch.result], { type: 'text/plain' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `research-${selectedResearch.topic.slice(0, 30)}.txt`;
                              a.click();
                            }}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>

                  {/* Research Result */}
                  <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-purple-200 dark:border-purple-700">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <FileText className="w-5 h-5 text-purple-500" />
                        <span>Araştırma Sonucu</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="prose prose-purple dark:prose-invert max-w-none">
                        <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 leading-relaxed">
                          {selectedResearch.result}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            )}

            {loading && (
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-purple-200 dark:border-purple-700">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Eye className="w-5 h-5 text-purple-500" />
                    <span>Araştırma Süreci Canlı İzleme</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64" ref={scrollRef}>
                    <div className="space-y-3">
                      <AnimatePresence>
                        {progressSteps.map((step, index) => (
                          <motion.div
                            key={step.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="flex items-start space-x-3 p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg border border-purple-200 dark:border-purple-700"
                          >
                            <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-white text-xs font-bold">{index + 1}</span>
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-gray-700 dark:text-gray-300">{step.message}</p>
                              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                                {step.timestamp.toLocaleTimeString('tr-TR')} • %{(step.step * 100).toFixed(0)} tamamlandı
                              </p>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Sidebar - Research History */}
        {researches.length > 0 && (
          <div className="w-80 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-l border-purple-200 dark:border-purple-700">
            <div className="p-4 border-b border-purple-200 dark:border-purple-700">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-purple-500" />
                <span>Araştırma Geçmişi</span>
              </h3>
            </div>
            
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3">
                {researches.map((research) => (
                  <div
                    key={research.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                      selectedResearch?.id === research.id
                        ? 'bg-purple-100 dark:bg-purple-900/50 border-purple-300 dark:border-purple-600'
                        : 'bg-white/80 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 hover:border-purple-300 dark:hover:border-purple-600'
                    }`}
                    onClick={() => setSelectedResearch(research)}
                  >
                    <h4 className="font-medium text-sm text-gray-900 dark:text-white mb-2 line-clamp-2">
                      {research.topic}
                    </h4>
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>{research.timestamp.toLocaleDateString('tr-TR')}</span>
                      <span>{formatDuration(research.duration)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeepResearch;
