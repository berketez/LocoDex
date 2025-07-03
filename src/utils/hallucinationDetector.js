/**
 * Hallucination Detection and Prevention System
 * Advanced AI output validation and fact-checking
 */

export class HallucinationDetector {
  constructor() {
    this.confidence_threshold = 0.7
    this.factCheckingEnabled = true
    this.detectionPatterns = this.initializePatterns()
  }

  initializePatterns() {
    return {
      // Şüpheli ifadeler
      suspicious_phrases: [
        'kesinlikle eminim',
        'hiç şüphe yok',
        '%100 doğru',
        'kesin bilgi',
        'mutlaka doğru',
        'garanti ediyorum',
        'absolutely certain',
        'I guarantee',
        'definitely true',
        'without doubt'
      ],
      
      // Belirsizlik ifadeleri (iyi işaretler)
      uncertainty_indicators: [
        'sanırım',
        'galiba',
        'muhtemelen',
        'olabilir',
        'görünüyor',
        'seems like',
        'probably',
        'might be',
        'appears to',
        'likely',
        'possibly'
      ],
      
      // Çelişkili ifadeler
      contradictory_patterns: [
        /(hem .+ hem de .+)/gi,
        /(aynı zamanda .+ ama .+)/gi,
        /(both .+ and .+)/gi,
        /(at the same time .+ but .+)/gi
      ],
      
      // Sayısal tutarsızlıklar
      numeric_inconsistencies: [
        /(\d+)\s*[+-]\s*(\d+)\s*=\s*(\d+)/g,  // Basit matematik hataları
        /(\d{4})\s*yıl[ıi]nda.*(\d{4})\s*yıl[ıi]nda/g  // Tarih çelişkileri
      ]
    }
  }

  /**
   * Ana hallucination detection fonksiyonu
   */
  async detectHallucinations(response, context = {}) {
    const detectionResults = {
      isHallucination: false,
      confidence: 1.0,
      issues: [],
      recommendations: [],
      correctedResponse: response
    }

    try {
      // 1. Metin tabanlı pattern analizi
      const patternAnalysis = this.analyzePatterns(response)
      detectionResults.issues.push(...patternAnalysis.issues)
      
      // 2. Tutarlılık kontrolü
      const consistencyCheck = this.checkConsistency(response, context)
      detectionResults.issues.push(...consistencyCheck.issues)
      
      // 3. Güven skoru hesaplama
      detectionResults.confidence = this.calculateConfidenceScore(response, detectionResults.issues)
      
      // 4. Hallucination tespiti
      detectionResults.isHallucination = detectionResults.confidence < this.confidence_threshold
      
      // 5. Öneriler oluştur
      if (detectionResults.isHallucination) {
        detectionResults.recommendations = this.generateRecommendations(detectionResults.issues)
        detectionResults.correctedResponse = this.generateCorrectedResponse(response, detectionResults.issues)
      }

      return detectionResults
      
    } catch (error) {
      console.error('Hallucination detection error:', error)
      return {
        isHallucination: true,
        confidence: 0.0,
        issues: ['Detection system error'],
        recommendations: ['Please verify the response manually'],
        correctedResponse: response
      }
    }
  }

  /**
   * Pattern tabanlı analiz
   */
  analyzePatterns(text) {
    const issues = []
    const lowerText = text.toLowerCase()

    // Şüpheli ifadeler kontrolü
    this.detectionPatterns.suspicious_phrases.forEach(phrase => {
      if (lowerText.includes(phrase.toLowerCase())) {
        issues.push({
          type: 'suspicious_confidence',
          severity: 'medium',
          description: `Aşırı güvenli ifade tespit edildi: "${phrase}"`,
          position: text.toLowerCase().indexOf(phrase.toLowerCase())
        })
      }
    })

    // Belirsizlik ifadeleri kontrolü (pozitif skor)
    let uncertaintyCount = 0
    this.detectionPatterns.uncertainty_indicators.forEach(indicator => {
      if (lowerText.includes(indicator.toLowerCase())) {
        uncertaintyCount++
      }
    })

    // Çelişkili ifadeler kontrolü
    this.detectionPatterns.contradictory_patterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) {
        matches.forEach(match => {
          issues.push({
            type: 'contradiction',
            severity: 'high',
            description: `Çelişkili ifade tespit edildi: "${match}"`,
            position: text.indexOf(match)
          })
        })
      }
    })

    // Sayısal tutarsızlıklar
    this.detectionPatterns.numeric_inconsistencies.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) {
        matches.forEach(match => {
          issues.push({
            type: 'numeric_inconsistency',
            severity: 'high',
            description: `Sayısal tutarsızlık tespit edildi: "${match}"`,
            position: text.indexOf(match)
          })
        })
      }
    })

    return { issues, uncertaintyCount }
  }

  /**
   * Tutarlılık kontrolü
   */
  checkConsistency(response, context) {
    const issues = []

    // Context ile tutarlılık kontrolü
    if (context.previousResponses) {
      const contradictions = this.findContradictions(response, context.previousResponses)
      issues.push(...contradictions)
    }

    // Model size ile response complexity uyumu
    if (context.modelSize && context.modelSize < 30) {
      const complexity = this.calculateResponseComplexity(response)
      if (complexity > 0.8) {
        issues.push({
          type: 'complexity_mismatch',
          severity: 'medium',
          description: 'Küçük model için çok karmaşık yanıt - hallucination riski yüksek',
          confidence: 0.6
        })
      }
    }

    return { issues }
  }

  /**
   * Güven skoru hesaplama
   */
  calculateConfidenceScore(text, issues) {
    let baseScore = 1.0

    issues.forEach(issue => {
      switch (issue.severity) {
        case 'high':
          baseScore -= 0.3
          break
        case 'medium':
          baseScore -= 0.2
          break
        case 'low':
          baseScore -= 0.1
          break
      }
    })

    // Belirsizlik ifadeleri pozitif etki (gerçekçi model)
    const uncertaintyBonus = Math.min(0.2, (text.match(/sanırım|galiba|muhtemelen|olabilir/gi) || []).length * 0.05)
    baseScore += uncertaintyBonus

    return Math.max(0.0, Math.min(1.0, baseScore))
  }

  /**
   * Yanıt karmaşıklığı hesaplama
   */
  calculateResponseComplexity(text) {
    const factors = {
      length: Math.min(1.0, text.length / 2000),
      vocabulary: this.calculateVocabularyComplexity(text),
      structure: this.calculateStructureComplexity(text)
    }

    return (factors.length + factors.vocabulary + factors.structure) / 3
  }

  calculateVocabularyComplexity(text) {
    const words = text.split(/\s+/)
    const uniqueWords = new Set(words.map(w => w.toLowerCase()))
    const complexWords = words.filter(w => w.length > 7).length
    
    return Math.min(1.0, (uniqueWords.size / words.length) + (complexWords / words.length))
  }

  calculateStructureComplexity(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const avgSentenceLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length
    const nestedStructures = (text.match(/\([^)]*\)/g) || []).length
    
    return Math.min(1.0, (avgSentenceLength / 100) + (nestedStructures / 10))
  }

  /**
   * Çelişkileri bulma
   */
  findContradictions(currentResponse, previousResponses) {
    const contradictions = []
    
    // Bu kısım daha karmaşık NLP analizi gerektirir
    // Şimdilik basit keyword matching ile başlayalım
    
    previousResponses.forEach((prevResponse, index) => {
      const currentKeywords = this.extractKeywords(currentResponse)
      const prevKeywords = this.extractKeywords(prevResponse)
      
      // Çelişkili keyword'ler ara
      const conflicts = this.findKeywordConflicts(currentKeywords, prevKeywords)
      if (conflicts.length > 0) {
        contradictions.push({
          type: 'context_contradiction',
          severity: 'high',
          description: `Önceki yanıt #${index + 1} ile çelişki tespit edildi`,
          conflicts: conflicts
        })
      }
    })

    return contradictions
  }

  extractKeywords(text) {
    // Basit keyword extraction
    const words = text.toLowerCase().split(/\s+/)
    const stopWords = new Set(['ve', 'ile', 'bu', 'bir', 'da', 'de', 'için', 'and', 'the', 'is', 'in', 'to'])
    return words.filter(word => word.length > 3 && !stopWords.has(word))
  }

  findKeywordConflicts() {
    // Bu kısım daha sofistike olabilir
    // Antonim sözlük, semantic similarity vs.
    return []
  }

  /**
   * Öneriler oluşturma
   */
  generateRecommendations(issues) {
    const recommendations = []

    if (issues.some(i => i.type === 'suspicious_confidence')) {
      recommendations.push('Model aşırı güvenli ifadeler kullanıyor - çift kontrol edin')
    }

    if (issues.some(i => i.type === 'contradiction')) {
      recommendations.push('Yanıtta çelişkili ifadeler var - tutarlılığı kontrol edin')
    }

    if (issues.some(i => i.type === 'numeric_inconsistency')) {
      recommendations.push('Sayısal bilgileri doğrulayın - hesaplama hataları olabilir')
    }

    if (issues.some(i => i.type === 'complexity_mismatch')) {
      recommendations.push('Daha büyük bir model kullanmayı düşünün (70B+)')
    }

    return recommendations
  }

  /**
   * Düzeltilmiş yanıt oluşturma
   */
  generateCorrectedResponse(originalResponse, issues) {
    let corrected = originalResponse

    // Aşırı güvenli ifadeleri yumuşat
    issues.forEach(issue => {
      if (issue.type === 'suspicious_confidence') {
        const suspiciousPhrases = {
          'kesinlikle eminim': 'sanırım',
          'hiç şüphe yok': 'muhtemelen',
          '%100 doğru': 'büyük olasılıkla doğru',
          'absolutely certain': 'quite likely',
          'I guarantee': 'I believe'
        }

        Object.entries(suspiciousPhrases).forEach(([original, replacement]) => {
          corrected = corrected.replace(new RegExp(original, 'gi'), replacement)
        })
      }
    })

    // Uyarı ekleme
    if (issues.length > 0) {
      corrected += '\n\n⚠️ Bu yanıt otomatik doğrulama sisteminden geçmiştir. Kritik kararlar için ek doğrulama önerilir.'
    }

    return corrected
  }

  /**
   * Model boyutuna göre güven seviyesi ayarlama
   */
  adjustConfidenceByModelSize(confidence, modelSizeGB) {
    if (modelSizeGB >= 70) {
      return Math.min(1.0, confidence + 0.1) // Büyük modellere bonus
    } else if (modelSizeGB < 13) {
      return Math.max(0.0, confidence - 0.2) // Küçük modellere penalty
    }
    return confidence
  }
}

/**
 * Kullanım örneği:
 * 
 * const detector = new HallucinationDetector()
 * const result = await detector.detectHallucinations(
 *   "Kesinlikle eminim ki 2+2=5 çünkü matematik böyle çalışır.",
 *   { modelSize: 7, previousResponses: [] }
 * )
 * 
 * if (result.isHallucination) {
 *   console.log('Hallucination detected:', result.issues)
 *   console.log('Recommendations:', result.recommendations)
 *   console.log('Corrected:', result.correctedResponse)
 * }
 */

export default HallucinationDetector