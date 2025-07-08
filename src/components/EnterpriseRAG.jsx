import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { ScrollArea } from '@/components/ui/scroll-area.jsx'
import { Separator } from '@/components/ui/separator.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { 
  Send, 
  Bot, 
  User, 
  FileText, 
  Database,
  Search,
  Building2,
  DollarSign,
  Users,
  Settings,
  TrendingUp,
  Shield,
  BookOpen,
  Calendar,
  RefreshCw,
  AlertCircle,
  Filter,
  Upload,
  Check,
  X
} from 'lucide-react'

const EnterpriseRAG = ({ uploadedFiles = [] }) => {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [documentIndex, setDocumentIndex] = useState([])
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchFilters, setSearchFilters] = useState({
    category: 'all',
    dateRange: 'all',
    department: 'all'
  })
  const messagesEndRef = useRef(null)

  // Gelişmiş belge kategorileri
  const documentCategories = {
    financial: {
      name: 'Finansal Raporlar',
      icon: DollarSign,
      color: 'bg-green-100 text-green-800',
      keywords: ['finansal', 'bütçe', 'gelir', 'gider', 'kâr', 'zarar', 'bilanço', 'çeyrek', 'annual']
    },
    hr: {
      name: 'İnsan Kaynakları',
      icon: Users,
      color: 'bg-blue-100 text-blue-800',
      keywords: ['ik', 'personel', 'çalışan', 'oryantasyon', 'izin', 'maaş', 'performans', 'işe alım']
    },
    technical: {
      name: 'Teknik Dokümanlar',
      icon: Settings,
      color: 'bg-purple-100 text-purple-800',
      keywords: ['api', 'dokümantasyon', 'teknik', 'sistem', 'kurulum', 'konfigürasyon', 'development']
    },
    policy: {
      name: 'Politika ve Prosedürler',
      icon: Shield,
      color: 'bg-orange-100 text-orange-800',
      keywords: ['politika', 'prosedür', 'kural', 'yönetmelik', 'güvenlik', 'uyumluluk', 'etik']
    },
    marketing: {
      name: 'Pazarlama ve Satış',
      icon: TrendingUp,
      color: 'bg-pink-100 text-pink-800',
      keywords: ['pazarlama', 'satış', 'kampanya', 'müşteri', 'analiz', 'strateji', 'hedef']
    },
    training: {
      name: 'Eğitim Materyalleri',
      icon: BookOpen,
      color: 'bg-yellow-100 text-yellow-800',
      keywords: ['eğitim', 'kurs', 'öğrenim', 'sertifika', 'workshop', 'seminer', 'gelişim']
    }
  }

  // Örnek soruları kategorilere göre organize et
  const sampleQuestions = {
    financial: [
      "Son çeyrek finansal raporuna göre en kârlı ürünümüz hangisi?",
      "Bu yılın gelir hedefleri nedir?",
      "Hangi departmanın bütçe kullanımı en yüksek?"
    ],
    hr: [
      "Yeni başlayan bir çalışan için oryantasyon süreci nasıl işliyor?",
      "Yıllık izin politikası nedir?",
      "Performans değerlendirme kriterleri nelerdir?"
    ],
    technical: [
      "API entegrasyonu nasıl yapılır?",
      "Sistem bakım prosedürleri nelerdir?",
      "Yeni geliştirici onboarding süreci nasıl?"
    ],
    policy: [
      "Uzaktan çalışma politikası nedir?",
      "Veri güvenliği kuralları nelerdir?",
      "Etik ihlal durumunda hangi prosedür izlenir?"
    ]
  }

  useEffect(() => {
    // Belgeleri kategorilere ayır ve indeksle
    if (uploadedFiles.length > 0) {
      const indexed = uploadedFiles
        .filter(file => file.processed && file.extractedText)
        .map(file => {
          const category = categorizeDocument(file.name, file.extractedText)
          return {
            id: file.id || Date.now() + Math.random(),
            name: file.name,
            content: file.extractedText,
            type: file.extension,
            category: category,
            uploadDate: file.uploadDate || new Date(),
            summary: generateSummary(file.extractedText),
            keywords: extractKeywords(file.extractedText),
            department: inferDepartment(file.name, file.extractedText)
          }
        })
      setDocumentIndex(indexed)
    }
  }, [uploadedFiles])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Belgeyi içeriğine göre kategorize et
  const categorizeDocument = (filename, content) => {
    const text = (filename + ' ' + content).toLowerCase()
    
    for (const [key, category] of Object.entries(documentCategories)) {
      if (category.keywords.some(keyword => text.includes(keyword))) {
        return key
      }
    }
    return 'general'
  }

  // Belge özeti oluştur
  const generateSummary = (content) => {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20)
    return sentences.slice(0, 2).join('. ') + '.'
  }

  // Anahtar kelimeleri çıkar
  const extractKeywords = (content) => {
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
    
    const frequency = {}
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1
    })
    
    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word)
  }

  // Departmanı belirle
  const inferDepartment = (filename, content) => {
    const text = (filename + ' ' + content).toLowerCase()
    
    if (text.includes('ik') || text.includes('hr') || text.includes('personel')) return 'İnsan Kaynakları'
    if (text.includes('finans') || text.includes('muhasebe') || text.includes('bütçe')) return 'Finans'
    if (text.includes('pazarlama') || text.includes('satış') || text.includes('marketing')) return 'Pazarlama'
    if (text.includes('teknik') || text.includes('geliştirme') || text.includes('it')) return 'Teknoloji'
    if (text.includes('hukuk') || text.includes('legal') || text.includes('uyumluluk')) return 'Hukuk'
    
    return 'Genel'
  }

  // Gelişmiş arama fonksiyonu
  const enhancedSearch = (query, documents) => {
    const queryLower = query.toLowerCase()
    const results = []

    documents.forEach(doc => {
      let score = 0
      const content = doc.content.toLowerCase()
      
      // Başlık eşleşmesi (yüksek puan)
      if (doc.name.toLowerCase().includes(queryLower)) score += 10
      
      // İçerik eşleşmesi
      const matches = (content.match(new RegExp(queryLower, 'g')) || []).length
      score += matches * 2
      
      // Anahtar kelime eşleşmesi
      doc.keywords.forEach(keyword => {
        if (queryLower.includes(keyword)) score += 5
      })
      
      // Kategori eşleşmesi
      if (searchFilters.category !== 'all' && doc.category === searchFilters.category) {
        score += 3
      }
      
      if (score > 0) {
        results.push({ ...doc, relevanceScore: score })
      }
    })

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore)
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
    const currentQuery = input
    setInput('')
    setIsLoading(true)

    try {
      // Gelişmiş belge arama
      const relevantDocs = enhancedSearch(currentQuery, documentIndex)
      const topDocs = relevantDocs.slice(0, 5)
      
      // Context oluştur
      const context = topDocs.map(doc => `
Belge: ${doc.name}
Kategori: ${documentCategories[doc.category]?.name || 'Genel'}
Departman: ${doc.department}
İçerik: ${doc.content.substring(0, 1000)}...
`).join('\n\n')

      // AI'ya gelişmiş prompt gönder
      const enhancedPrompt = `
Kurumsal belge sorgulama sistemi olarak, aşağıdaki belgeler temel alınarak soruyu yanıtla:

${context}

Kullanıcı Sorusu: ${currentQuery}

Yanıt kuralları:
1. Sadece verilen belgelerden bilgi kullan
2. Hangi belgeden alındığını belirt
3. Eğer bilgi belgede yoksa "Bu bilgi mevcut belgelerde bulunmuyor" de
4. Detaylı ve profesyonel yanıt ver
5. Gerekirse sayısal verileri öne çıkar
`

      // Model API çağrısı
      const response = await fetch('http://localhost:1234/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'default',
          messages: [
            {
              role: 'system',
              content: 'Sen kurumsal belge analizi yapan bir AI asistansısın. Verilen belgelerden doğru bilgi çıkarıp profesyonel yanıtlar verirsin.'
            },
            {
              role: 'user',
              content: enhancedPrompt
            }
          ],
          temperature: 0.1,
          max_tokens: 1000
        }),
      })

      if (!response.ok) {
        throw new Error('Model yanıt vermedi')
      }

      const data = await response.json()
      const aiResponse = data.choices[0]?.message?.content || 'Yanıt alınamadı.'

      const assistantMessage = {
        id: Date.now() + 1,
        type: 'assistant',
        content: aiResponse,
        sources: topDocs.map(doc => ({
          name: doc.name,
          category: documentCategories[doc.category]?.name || 'Genel',
          department: doc.department,
          relevance: doc.relevanceScore
        })),
        timestamp: new Date(),
        searchResults: topDocs.length
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Enterprise RAG Error:', error)
      const errorMessage = {
        id: Date.now() + 1,
        type: 'assistant',
        content: 'Üzgünüm, belge analizi sırasında bir hata oluştu. Lütfen tekrar deneyin.',
        error: true,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
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

  const getCategoryStats = () => {
    const stats = {}
    documentIndex.forEach(doc => {
      stats[doc.category] = (stats[doc.category] || 0) + 1
    })
    return stats
  }

  const filteredDocuments = documentIndex.filter(doc => {
    if (searchFilters.category !== 'all' && doc.category !== searchFilters.category) return false
    if (searchFilters.department !== 'all' && doc.department !== searchFilters.department) return false
    return true
  })

  if (documentIndex.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <Building2 className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold mb-2">Kurumsal Belge Sistemi</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Finansal raporlar, HR politikaları, teknik dokümanlar ve daha fazlasını yükleyerek 
            akıllı belge sorgulama sisteminizi başlatın.
          </p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center space-x-2 text-green-600">
              <DollarSign className="w-4 h-4" />
              <span>Finansal Raporlar</span>
            </div>
            <div className="flex items-center space-x-2 text-blue-600">
              <Users className="w-4 h-4" />
              <span>HR Politikaları</span>
            </div>
            <div className="flex items-center space-x-2 text-purple-600">
              <Settings className="w-4 h-4" />
              <span>Teknik Dokümanlar</span>
            </div>
            <div className="flex items-center space-x-2 text-orange-600">
              <Shield className="w-4 h-4" />
              <span>Prosedürler</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <Tabs value={activeCategory} onValueChange={setActiveCategory} className="h-full flex flex-col">
        {/* Header with Stats */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-b p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <Building2 className="w-6 h-6 text-blue-600" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Kurumsal Belge Sorgulama</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{documentIndex.length} belge indekslendi</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={clearChat}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Category Stats */}
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(getCategoryStats()).map(([category, count]) => {
              const categoryInfo = documentCategories[category]
              if (!categoryInfo) return null
              const Icon = categoryInfo.icon
              
              return (
                <div key={category} className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
                  <div className="flex items-center space-x-2">
                    <Icon className="w-4 h-4 text-gray-600" />
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{categoryInfo.name}</p>
                      <p className="font-semibold text-lg">{count}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Tab Navigation */}
        <TabsList className="w-full justify-start p-0 h-auto bg-transparent border-b rounded-none">
          <TabsTrigger value="all" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
            Sohbet
          </TabsTrigger>
          <TabsTrigger value="documents" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
            Belge Gezgini
          </TabsTrigger>
          <TabsTrigger value="analytics" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
            Analitik
          </TabsTrigger>
        </TabsList>

        {/* Chat Tab */}
        <TabsContent value="all" className="flex-1 flex flex-col mt-0">
          {/* Sample Questions */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b">
            <p className="text-sm font-medium mb-3">Örnek Sorular:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {Object.values(sampleQuestions).flat().slice(0, 4).map((question, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  className="text-left justify-start h-auto p-2 text-xs"
                  onClick={() => setInput(question)}
                >
                  <span className="truncate">{question}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <Bot className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-gray-500">Kurumsal belgeleriniz hakkında sorularınızı sorun</p>
                </div>
              )}
              
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] ${message.type === 'user' ? 'order-2' : 'order-1'}`}>
                    <div className={`flex items-start space-x-3 ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                        message.type === 'user' 
                          ? 'bg-blue-500 text-white' 
                          : message.error 
                            ? 'bg-red-500 text-white'
                            : 'bg-gray-600 text-white'
                      }`}>
                        {message.type === 'user' ? (
                          <User className="w-5 h-5" />
                        ) : message.error ? (
                          <AlertCircle className="w-5 h-5" />
                        ) : (
                          <Bot className="w-5 h-5" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className={`p-4 rounded-xl ${
                          message.type === 'user'
                            ? 'bg-blue-500 text-white'
                            : message.error
                              ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700'
                              : 'bg-white dark:bg-gray-800 border shadow-sm'
                        }`}>
                          <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div>
                          
                          {message.sources && message.sources.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                              <div className="flex items-center space-x-2 mb-3">
                                <Search className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Kaynaklar ({message.searchResults} belge tarandı):
                                </span>
                              </div>
                              <div className="space-y-2">
                                {message.sources.map((source, index) => (
                                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                    <div className="flex items-center space-x-2 min-w-0">
                                      <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium truncate">{source.name}</p>
                                        <p className="text-xs text-gray-500">{source.category} • {source.department}</p>
                                      </div>
                                    </div>
                                    <Badge variant="secondary" className="text-xs">
                                      {Math.round(source.relevance)}% eşleşme
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <div className="text-xs text-gray-500 mt-2 px-1">
                          {formatTime(message.timestamp)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center text-white">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div className="bg-white dark:bg-gray-800 border shadow-sm p-4 rounded-xl">
                      <div className="flex items-center space-x-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                        <span className="text-sm text-gray-600">Belgeler analiz ediliyor...</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div ref={messagesEndRef} />
          </ScrollArea>

          {/* Input */}
          <div className="border-t p-4 bg-white dark:bg-gray-800">
            <form onSubmit={handleSubmit} className="flex space-x-3">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Örn: Son çeyrek raporuna göre hangi departmanın performansı en iyi?"
                disabled={isLoading}
                className="flex-1"
              />
              <Button type="submit" disabled={isLoading || !input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </TabsContent>

        {/* Document Explorer Tab */}
        <TabsContent value="documents" className="flex-1 mt-0">
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocuments.map((doc) => {
                const categoryInfo = documentCategories[doc.category] || { 
                  name: 'Genel', 
                  icon: FileText, 
                  color: 'bg-gray-100 text-gray-800' 
                }
                const Icon = categoryInfo.icon

                return (
                  <Card key={doc.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2">
                          <Icon className="w-5 h-5 text-gray-600" />
                          <CardTitle className="text-sm font-medium truncate">{doc.name}</CardTitle>
                        </div>
                        <Badge className={`text-xs ${categoryInfo.color}`}>
                          {categoryInfo.name}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                        {doc.summary}
                      </p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Departman:</span>
                          <span className="font-medium">{doc.department}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Yüklenme:</span>
                          <span>{new Date(doc.uploadDate).toLocaleDateString('tr-TR')}</span>
                        </div>
                      </div>
                      <div className="mt-3">
                        <p className="text-xs text-gray-500 mb-1">Anahtar kelimeler:</p>
                        <div className="flex flex-wrap gap-1">
                          {doc.keywords.slice(0, 3).map((keyword, index) => (
                            <Badge key={index} variant="outline" className="text-xs px-1 py-0">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="flex-1 mt-0">
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(documentCategories).map(([key, category]) => {
                const count = getCategoryStats()[key] || 0
                const Icon = category.icon
                
                return (
                  <Card key={key}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{category.name}</CardTitle>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{count}</div>
                      <p className="text-xs text-muted-foreground">
                        belge mevcut
                      </p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default EnterpriseRAG