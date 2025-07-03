/**
 * Document Processing Utilities for RAG System
 * Handles various document formats and converts them to model-readable text
 */

class DocumentProcessor {
  constructor() {
    this.supportedFormats = ['pdf', 'docx', 'xlsx', 'pptx', 'txt', 'jpg', 'jpeg', 'png']
  }

  /**
   * Process a file and extract text content
   * @param {File} file - The file to process
   * @returns {Promise<Object>} - Processed file information
   */
  async processFile(file) {
    const extension = file.name.split('.').pop().toLowerCase()
    
    if (!this.supportedFormats.includes(extension)) {
      throw new Error(`Unsupported file format: ${extension}`)
    }

    try {
      let extractedText = ''
      let metadata = {}

      switch (extension) {
        case 'txt':
          extractedText = await this.processTxtFile(file)
          break
        case 'pdf':
          extractedText = await this.processPdfFile(file)
          break
        case 'docx':
          extractedText = await this.processDocxFile(file)
          break
        case 'xlsx':
          extractedText = await this.processXlsxFile(file)
          break
        case 'pptx':
          extractedText = await this.processPptxFile(file)
          break
        case 'jpg':
        case 'jpeg':
        case 'png':
          extractedText = await this.processImageFile(file)
          break
        default:
          throw new Error(`Handler not implemented for ${extension}`)
      }

      // Generate chunks for better RAG performance
      const chunks = this.generateChunks(extractedText, 1000, 200)

      return {
        fileName: file.name,
        fileSize: file.size,
        fileType: extension,
        extractedText,
        chunks,
        metadata,
        processedAt: new Date().toISOString(),
        wordCount: extractedText.split(/\s+/).length,
        characterCount: extractedText.length
      }

    } catch (error) {
      console.error(`Error processing ${file.name}:`, error)
      throw new Error(`Failed to process ${file.name}: ${error.message}`)
    }
  }

  /**
   * Process multiple files
   * @param {FileList|Array} files - Files to process
   * @param {Function} progressCallback - Progress callback function
   * @returns {Promise<Array>} - Array of processed file information
   */
  async processFiles(files, progressCallback = null) {
    const results = []
    const totalFiles = files.length

    for (let i = 0; i < totalFiles; i++) {
      const file = files[i]
      
      if (progressCallback) {
        progressCallback({
          current: i + 1,
          total: totalFiles,
          fileName: file.name,
          progress: Math.round((i / totalFiles) * 100)
        })
      }

      try {
        const result = await this.processFile(file)
        results.push({
          ...result,
          status: 'success',
          file: file
        })
      } catch (error) {
        results.push({
          fileName: file.name,
          fileSize: file.size,
          fileType: file.name.split('.').pop().toLowerCase(),
          status: 'error',
          error: error.message,
          file: file
        })
      }
    }

    return results
  }

  /**
   * Process text file
   */
  async processTxtFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.onerror = () => reject(new Error('Failed to read text file'))
      reader.readAsText(file, 'UTF-8')
    })
  }

  /**
   * Process PDF file (placeholder - would need PDF.js in real implementation)
   */
  async processPdfFile(file) {
    // This is a placeholder - in a real implementation, you'd use PDF.js
    // to extract text from PDF files
    return `[PDF Content from ${file.name}]\n\nThis is a placeholder for PDF text extraction. In a production environment, this would contain the actual text extracted from the PDF file using libraries like PDF.js or pdf-parse.\n\nThe PDF processing would:\n- Extract text content from all pages\n- Preserve formatting where possible\n- Handle embedded images and tables\n- Extract metadata like title, author, creation date\n\nFile size: ${(file.size / 1024).toFixed(2)} KB\nLast modified: ${new Date(file.lastModified).toLocaleString('tr-TR')}`
  }

  /**
   * Process Word document (placeholder)
   */
  async processDocxFile(file) {
    // Placeholder for DOCX processing - would use libraries like mammoth.js
    return `[Word Document Content from ${file.name}]\n\nThis is a placeholder for Word document text extraction. In a production environment, this would contain the actual text extracted from the DOCX file using libraries like mammoth.js or docx-parser.\n\nThe DOCX processing would:\n- Extract text content from all sections\n- Preserve basic formatting\n- Handle tables and lists\n- Extract headers and footers\n- Process embedded images and diagrams\n\nFile size: ${(file.size / 1024).toFixed(2)} KB\nLast modified: ${new Date(file.lastModified).toLocaleString('tr-TR')}`
  }

  /**
   * Process Excel file (placeholder)
   */
  async processXlsxFile(file) {
    // Placeholder for XLSX processing - would use libraries like xlsx or exceljs
    return `[Excel Spreadsheet Content from ${file.name}]\n\nThis is a placeholder for Excel spreadsheet data extraction. In a production environment, this would contain the actual data extracted from the XLSX file using libraries like xlsx or exceljs.\n\nThe XLSX processing would:\n- Extract data from all worksheets\n- Preserve cell values and formulas\n- Handle different data types (numbers, dates, text)\n- Process charts and graphs\n- Extract metadata and sheet names\n\nFile size: ${(file.size / 1024).toFixed(2)} KB\nLast modified: ${new Date(file.lastModified).toLocaleString('tr-TR')}`
  }

  /**
   * Process PowerPoint file (placeholder)
   */
  async processPptxFile(file) {
    // Placeholder for PPTX processing
    return `[PowerPoint Presentation Content from ${file.name}]\n\nThis is a placeholder for PowerPoint presentation text extraction. In a production environment, this would contain the actual text extracted from the PPTX file.\n\nThe PPTX processing would:\n- Extract text from all slides\n- Preserve slide titles and content\n- Handle speaker notes\n- Process embedded images and charts\n- Extract slide transitions and animations metadata\n\nFile size: ${(file.size / 1024).toFixed(2)} KB\nLast modified: ${new Date(file.lastModified).toLocaleString('tr-TR')}`
  }

  /**
   * Process image file (placeholder for OCR)
   */
  async processImageFile(file) {
    // Placeholder for OCR processing - would use libraries like Tesseract.js
    return `[Image Content from ${file.name}]\n\nThis is a placeholder for OCR (Optical Character Recognition) text extraction. In a production environment, this would contain the actual text extracted from the image using libraries like Tesseract.js.\n\nThe image processing would:\n- Perform OCR to extract text from images\n- Handle different image formats and qualities\n- Process both printed and handwritten text\n- Extract text in multiple languages\n- Identify and describe visual elements\n\nImage dimensions: ${file.size > 0 ? 'Available after processing' : 'Unknown'}\nFile size: ${(file.size / 1024).toFixed(2)} KB\nLast modified: ${new Date(file.lastModified).toLocaleString('tr-TR')}`
  }

  /**
   * Generate text chunks for better RAG performance
   * @param {string} text - Text to chunk
   * @param {number} chunkSize - Size of each chunk
   * @param {number} overlap - Overlap between chunks
   * @returns {Array} - Array of text chunks
   */
  generateChunks(text, chunkSize = 1000, overlap = 200) {
    if (!text || text.length <= chunkSize) {
      return [text]
    }

    const chunks = []
    let start = 0

    while (start < text.length) {
      let end = start + chunkSize
      
      // Try to break at sentence boundaries
      if (end < text.length) {
        const lastPeriod = text.lastIndexOf('.', end)
        const lastNewline = text.lastIndexOf('\n', end)
        const breakPoint = Math.max(lastPeriod, lastNewline)
        
        if (breakPoint > start + chunkSize * 0.5) {
          end = breakPoint + 1
        }
      }

      chunks.push({
        text: text.substring(start, end).trim(),
        startIndex: start,
        endIndex: end,
        chunkIndex: chunks.length
      })

      start = end - overlap
      if (start < 0) start = 0
    }

    return chunks
  }

  /**
   * Search for relevant chunks based on query
   * @param {Array} chunks - Text chunks to search
   * @param {string} query - Search query
   * @param {number} maxResults - Maximum number of results
   * @returns {Array} - Relevant chunks with scores
   */
  searchChunks(chunks, query, maxResults = 5) {
    if (!chunks || chunks.length === 0) return []

    const queryTerms = query.toLowerCase().split(/\s+/)
    const scoredChunks = []

    chunks.forEach(chunk => {
      const chunkText = chunk.text.toLowerCase()
      let score = 0

      queryTerms.forEach(term => {
        // Exact matches get higher scores
        const exactMatches = (chunkText.match(new RegExp(term, 'g')) || []).length
        score += exactMatches * 2

        // Partial matches get lower scores
        if (chunkText.includes(term)) {
          score += 1
        }
      })

      if (score > 0) {
        scoredChunks.push({
          ...chunk,
          score,
          relevance: score / queryTerms.length
        })
      }
    })

    return scoredChunks
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
  }

  /**
   * Extract metadata from file
   * @param {File} file - File to extract metadata from
   * @returns {Object} - File metadata
   */
  extractMetadata(file) {
    return {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: new Date(file.lastModified),
      extension: file.name.split('.').pop().toLowerCase()
    }
  }
}

export default DocumentProcessor