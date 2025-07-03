import React, { useEffect, useRef, memo, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Progress } from '@/components/ui/progress.jsx'
import { ScrollArea } from '@/components/ui/scroll-area.jsx'
import { Separator } from '@/components/ui/separator.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { 
  Bot, 
  User, 
  Send, 
  RefreshCw, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Code,
  Brain,
  Activity,
  Play,
  Pause,
  Monitor,
  FileText,
  Download,
  Upload,
  Eye,
  TrendingUp,
  Server,
  Database
} from 'lucide-react'
import HallucinationDetector from '@/utils/hallucinationDetector.js'

const ChatInterface = ({ 
  messages, 
  setMessages, 
  inputValue, 
  setInputValue, 
  isTyping, 
  setIsTyping, 
  selectedModel,
  isProcessing,
  setIsProcessing,
  onSendMessage,
  currentPlan,
  completedTasks,
  codeExecutionResults,
  setActivityLog
}) => {
  const messagesEndRef = useRef(null)
  const _hallucinationDetector = useRef(new HallucinationDetector())

  // Activity logging
  const addActivity = useCallback((type, message, details = null) => {
    const activity = {
      id: Date.now(),
      type,
      message,
      details,
      timestamp: new Date()
    }
    setActivityLog(prev => [...prev, activity])
  }, [setActivityLog])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isProcessing) return

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsProcessing(true)
    setIsTyping(true)

    addActivity('info', 'Yeni mesaj gönderildi', inputValue)

    try {
      if (onSendMessage) {
        await onSendMessage(inputValue)
      } else {
        // Default behavior - simulate AI response
        setTimeout(() => {
          const aiResponse = {
            id: Date.now() + 1,
            type: 'assistant',
            content: 'Bu bir örnek AI yanıtı. Gerçek AI entegrasyonu için onSendMessage propunu kullanın.',
            timestamp: new Date()
          }
          setMessages(prev => [...prev, aiResponse])
          setIsTyping(false)
          setIsProcessing(false)
          addActivity('success', 'AI yanıtı alındı')
        }, 2000)
      }
    } catch (error) {
      addActivity('error', 'Mesaj gönderme hatası', error.message)
      setIsTyping(false)
      setIsProcessing(false)
    }
  }, [inputValue, isProcessing, setMessages, setInputValue, setIsProcessing, setIsTyping, addActivity, onSendMessage])

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }, [handleSendMessage])

  const formatMessageContent = useCallback((content) => {
    // Simple code block detection and formatting
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
    const inlineCodeRegex = /`([^`]+)`/g
    
    let formattedContent = content
      .replace(codeBlockRegex, (match, language, code) => {
        return `<div class="code-block bg-gray-100 dark:bg-gray-800 p-3 rounded-lg mt-2 mb-2 overflow-x-auto">
          <div class="text-xs text-gray-500 mb-1">${language || 'code'}</div>
          <pre class="text-sm"><code>${code.trim()}</code></pre>
        </div>`
      })
      .replace(inlineCodeRegex, '<code class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm">$1</code>')
    
    return formattedContent
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4">
            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] ${message.type === 'user' ? 'order-2' : 'order-1'}`}>
                    <div className={`flex items-start space-x-2 ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        message.type === 'user' 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}>
                        {message.type === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                      </div>
                      <div className={`flex-1 ${message.type === 'user' ? 'text-right' : 'text-left'}`}>
                        <div className={`inline-block p-3 rounded-lg ${
                          message.type === 'user'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                        }`}>
                          <div 
                            className="text-sm"
                            dangerouslySetInnerHTML={{ __html: formatMessageContent(message.content) }}
                          />
                        </div>
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {message.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {/* Typing indicator */}
            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="flex items-start space-x-2">
                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
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
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
        <div className="flex space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={selectedModel ? `${selectedModel.name} ile konuşun...` : "Önce bir model seçin..."}
                disabled={isProcessing || !selectedModel}
                className="pr-12"
              />
              {isProcessing && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
                </div>
              )}
            </div>
          </div>
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isProcessing || !selectedModel}
            className="px-4"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Model Status */}
        <div className="mt-2 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center space-x-2">
            {selectedModel ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Model: {selectedModel.name}</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-yellow-500" />
                <span>Model seçilmedi</span>
              </>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <span>{messages.length} mesaj</span>
            {isProcessing && <span>İşleniyor...</span>}
          </div>
        </div>
      </div>

      {/* Code Execution Results */}
      {codeExecutionResults.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Kod Çalıştırma Sonuçları
            </h3>
            <div className="space-y-2">
              {codeExecutionResults.map((result, index) => (
                <div key={index} className="text-sm bg-white dark:bg-gray-900 p-2 rounded border">
                  <div className="flex items-center space-x-2 mb-1">
                    <Code className="w-4 h-4" />
                    <span className="font-medium">{result.type}</span>
                    <Badge variant={result.success ? "default" : "destructive"}>
                      {result.success ? "Başarılı" : "Hata"}
                    </Badge>
                  </div>
                  <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto">
                    {result.output}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Current Plan Display */}
      {currentPlan && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-950">
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Aktif Plan: {currentPlan.title}
              </h3>
              <Badge variant="outline" className="text-blue-600 border-blue-600">
                {completedTasks}/{currentPlan.totalTasks} tamamlandı
              </Badge>
            </div>
            <Progress 
              value={(completedTasks / currentPlan.totalTasks) * 100} 
              className="h-2 bg-blue-200 dark:bg-blue-800"
            />
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              {currentPlan.description}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(ChatInterface)