import React, { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Progress } from '@/components/ui/progress.jsx'
import { Upload, FileText, Image, X, Check, AlertCircle } from 'lucide-react'
import DocumentProcessor from '@/utils/documentProcessor.js'

const FileUpload = ({ onFilesUpload, supportedTypes = ['pdf', 'docx', 'xlsx', 'pptx', 'jpg', 'jpeg', 'png', 'txt'] }) => {
  const [dragActive, setDragActive] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [uploadProgress, setUploadProgress] = useState({})
  const [processing, setProcessing] = useState(false)
  const [documentProcessor] = useState(() => new DocumentProcessor())

  const handleDrag = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }, [handleFiles])

  const handleFileInput = useCallback((e) => {
    const files = Array.from(e.target.files)
    handleFiles(files)
  }, [handleFiles])

  const handleFolderInput = useCallback((e) => {
    const files = Array.from(e.target.files)
    handleFiles(files)
  }, [handleFiles])

  const handleFiles = async (files) => {
    setProcessing(true)
    const validFiles = files.filter(file => {
      const extension = file.name.split('.').pop().toLowerCase()
      return supportedTypes.includes(extension)
    })

    if (validFiles.length === 0) {
      alert('Desteklenmeyen dosya formatı. Lütfen PDF, Word, Excel, PowerPoint veya resim dosyası seçin.')
      setProcessing(false)
      return
    }

    const newFiles = []
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i]
      const fileId = `${Date.now()}-${i}`
      
      const fileInfo = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        extension: file.name.split('.').pop().toLowerCase(),
        status: 'processing',
        processed: false,
        extractedText: '',
        file: file
      }

      newFiles.push(fileInfo)
      setUploadProgress(prev => ({ ...prev, [fileId]: 0 }))
    }

    setUploadedFiles(prev => [...prev, ...newFiles])

    // Simulate processing each file
    for (const fileInfo of newFiles) {
      await processFile(fileInfo)
    }

    setProcessing(false)
    if (onFilesUpload) {
      onFilesUpload(newFiles)
    }
  }

  const processFile = async (fileInfo) => {
    try {
      // Update progress during processing
      setUploadProgress(prev => ({ ...prev, [fileInfo.id]: 25 }))

      // Use DocumentProcessor to extract content
      const processedData = await documentProcessor.processFile(fileInfo.file)
      
      setUploadProgress(prev => ({ ...prev, [fileInfo.id]: 75 }))

      // Update file info with processed data
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileInfo.id ? {
          ...f,
          status: 'completed',
          processed: true,
          extractedText: processedData.extractedText,
          chunks: processedData.chunks,
          metadata: processedData.metadata,
          wordCount: processedData.wordCount,
          characterCount: processedData.characterCount
        } : f
      ))

      setUploadProgress(prev => ({ ...prev, [fileInfo.id]: 100 }))

    } catch (error) {
      console.error('File processing error:', error)
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileInfo.id ? {
          ...f,
          status: 'error',
          error: error.message
        } : f
      ))
    }
  }


  const removeFile = (fileId) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId))
    setUploadProgress(prev => {
      const newProgress = { ...prev }
      delete newProgress[fileId]
      return newProgress
    })
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (extension) => {
    if (['jpg', 'jpeg', 'png'].includes(extension)) {
      return <Image className="w-4 h-4" />
    }
    return <FileText className="w-4 h-4" />
  }

  const getFileTypeColor = (extension) => {
    const colorMap = {
      pdf: 'bg-red-100 text-red-800',
      docx: 'bg-blue-100 text-blue-800',
      xlsx: 'bg-green-100 text-green-800',
      pptx: 'bg-orange-100 text-orange-800',
      jpg: 'bg-purple-100 text-purple-800',
      jpeg: 'bg-purple-100 text-purple-800',
      png: 'bg-purple-100 text-purple-800',
      txt: 'bg-gray-100 text-gray-800'
    }
    return colorMap[extension] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-semibold mb-2">Belge Yükleme</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Dosyaları buraya sürükleyin veya seçin. PDF, Word, Excel, PowerPoint ve resim dosyaları desteklenir.
        </p>
        <div className="flex justify-center space-x-4">
          <Button onClick={() => document.getElementById('file-input').click()} disabled={processing}>
            <Upload className="w-4 h-4 mr-2" />
            Dosya Seç
          </Button>
          <Button variant="outline" onClick={() => document.getElementById('folder-input').click()} disabled={processing}>
            <Upload className="w-4 h-4 mr-2" />
            Klasör Seç
          </Button>
        </div>
        
        <input
          id="file-input"
          type="file"
          multiple
          accept=".pdf,.docx,.xlsx,.pptx,.jpg,.jpeg,.png,.txt"
          onChange={handleFileInput}
          className="hidden"
        />
        <input
          id="folder-input"
          type="file"
          multiple
          webkitdirectory="true"
          accept=".pdf,.docx,.xlsx,.pptx,.jpg,.jpeg,.png,.txt"
          onChange={handleFolderInput}
          className="hidden"
        />
      </div>

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Yüklenen Belgeler ({uploadedFiles.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {uploadedFiles.map((file) => (
                <div key={file.id} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex-shrink-0">
                    {getFileIcon(file.extension)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {file.name}
                      </span>
                      <Badge variant="outline" className={`text-xs ${getFileTypeColor(file.extension)}`}>
                        {file.extension.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {formatFileSize(file.size)}
                    </div>
                    
                    {file.status === 'processing' && (
                      <div className="mt-2">
                        <Progress value={uploadProgress[file.id] || 0} className="h-1" />
                        <div className="text-xs text-gray-500 mt-1">İşleniyor...</div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {file.status === 'completed' && (
                      <Check className="w-4 h-4 text-green-500" />
                    )}
                    {file.status === 'error' && (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(file.id)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default FileUpload