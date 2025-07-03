import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { ScrollArea } from '@/components/ui/scroll-area.jsx'
import { Separator } from '@/components/ui/separator.jsx'
import { 
  Send, 
  Bot, 
  User, 
  FileText, 
  Database,
  Search,
  Lightbulb,
  RefreshCw,
  AlertCircle
} from 'lucide-react'
import DocumentProcessor from '@/utils/documentProcessor.js'

const RAGChat = ({ uploadedFiles = [] }) => {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [ragContext, setRagContext] = useState([])
  const [documentProcessor] = useState(() => new DocumentProcessor())
  const messagesEndRef = useRef(null)

  useEffect(() => {
    // Initialize RAG context from uploaded files
    if (uploadedFiles.length > 0) {
      const context = uploadedFiles
        .filter(file => file.processed && file.extractedText)
        .map(file => ({
          source: file.name,
          content: file.extractedText,
          type: file.extension
        }))
      setRagContext(context)
    }
  }, [uploadedFiles])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: input,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Simulate RAG processing
      const relevantContext = findRelevantContext(input)
      
      // Simulate AI response with RAG context
      const aiResponse = await generateRAGResponse(input, relevantContext)
      
      const assistantMessage = {
        id: Date.now() + 1,
        type: 'assistant',
        content: aiResponse.content,
        ragContext: relevantContext,
        sources: aiResponse.sources,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('RAG Chat Error:', error)
      const errorMessage = {
        id: Date.now() + 1,
        type: 'assistant',
        content: 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.',
        error: true,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const findRelevantContext = (query) => {
    if (ragContext.length === 0) return []
    
    // Use DocumentProcessor for better chunk searching
    const allChunks = []
    ragContext.forEach(doc => {
      if (doc.chunks && doc.chunks.length > 0) {
        doc.chunks.forEach(chunk => {
          allChunks.push({
            ...chunk,
            source: doc.source,
            type: doc.type
          })
        })
      } else {
        // Fallback for documents without chunks
        allChunks.push({
          text: doc.content,
          source: doc.source,
          type: doc.type,
          chunkIndex: 0
        })
      }
    })
    
    // Use DocumentProcessor's search functionality
    const relevantChunks = documentProcessor.searchChunks(allChunks, query, 3)
    
    return relevantChunks.map(chunk => ({
      source: chunk.source,
      content: chunk.text,
      type: chunk.type,
      relevanceScore: chunk.score,
      chunkIndex: chunk.chunkIndex
    }))
  }

  const generateRAGResponse = async (query, context) => {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))
    
    if (context.length === 0) {
      return {
        content: 'Üzgünüm, yüklenen belgelerde bu konuyla ilgili bilgi bulamadım. Lütfen daha spesifik bir soru sorun veya ilgili belgeleri yüklediğinizden emin olun.',
        sources: []
      }
    }

    // Generate response based on context
    const sources = context.map(doc => doc.source)
    const response = `Yüklenen belgelerinize göre bu konuyla ilgili bilgileri buldum:

${context.map((doc, index) => `
${index + 1}. **${doc.source}** dosyasından:
   ${doc.content.slice(0, 200)}${doc.content.length > 200 ? '...' : ''}
`).join('\n')}

Bu bilgilere dayanarak size daha detaylı yanıt verebilirim. Başka sorularınız varsa lütfen sorun!`

    return {
      content: response,
      sources: sources
    }
  }

  const clearChat = () => {
    setMessages([])
  }

  const formatTime = (timestamp) => {
    return timestamp.toLocaleTimeString('tr-TR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const getSourceIcon = (type) => {
    switch (type) {
      case 'pdf': return '📄'
      case 'docx': return '📝'
      case 'xlsx': return '📊'
      case 'pptx': return '📋'
      case 'jpg':
      case 'jpeg':
      case 'png': return '🖼️'
      default: return '📄'
    }
  }

  if (ragContext.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center p-8">
          <Database className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold mb-2">Belge Gerekli</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            RAG tabanlı sohbet için önce belgelerinizi yüklemelisiniz.
          </p>
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
            <FileText className="w-4 h-4" />
            <span>RAG sekmesine geçerek belge yükleyin</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* RAG Status Bar */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-700 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Database className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
              RAG Aktif
            </span>
            <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800">
              {ragContext.length} belge yüklendi
            </Badge>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" onClick={clearChat}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Knowledge Base Info */}
      <div className="p-3 bg-gray-50 dark:bg-gray-800 border-b">
        <div className="flex items-center space-x-2 mb-2">
          <Lightbulb className="w-4 h-4 text-yellow-500" />
          <span className="text-sm font-medium">Bilgi Tabanı</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {ragContext.map((doc, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {getSourceIcon(doc.type)} {doc.source}
            </Badge>
          ))}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <Bot className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="text-gray-500">Belgeleriniz hakkında sorularınızı sorun</p>
            </div>
          )}
          
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${message.type === 'user' ? 'order-2' : 'order-1'}`}>
                <div className={`flex items-start space-x-2 ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.type === 'user' 
                      ? 'bg-blue-500 text-white' 
                      : message.error 
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-500 text-white'
                  }`}>
                    {message.type === 'user' ? (
                      <User className="w-4 h-4" />
                    ) : message.error ? (
                      <AlertCircle className="w-4 h-4" />
                    ) : (
                      <Bot className="w-4 h-4" />
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <div className={`p-3 rounded-lg ${
                      message.type === 'user'
                        ? 'bg-blue-500 text-white'
                        : message.error
                          ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700'
                          : 'bg-gray-100 dark:bg-gray-800'
                    }`}>
                      <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                      
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                          <div className="flex items-center space-x-2 mb-2">
                            <Search className="w-3 h-3 text-gray-500" />
                            <span className="text-xs text-gray-500">Kaynaklar:</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {message.sources.map((source, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {source}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="text-xs text-gray-500 mt-1 px-1">
                      {formatTime(message.timestamp)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-start space-x-2">
                <div className="flex-shrink-0 w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center text-white">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500"></div>
                    <span className="text-sm text-gray-500">Belgeleriniz analiz ediliyor...</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Belgeleriniz hakkında soru sorun..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}

export default RAGChat