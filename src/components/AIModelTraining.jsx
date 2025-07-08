import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { 
  Upload, 
  Play, 
  Square, 
  Download, 
  FileText, 
  Database, 
  Brain, 
  BarChart3, 
  Settings, 
  Cpu, 
  HardDrive, 
  Zap,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

const AIModelTraining = () => {
  const [trainingData, setTrainingData] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [trainingStatus, setTrainingStatus] = useState('idle');
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [trainingLogs, setTrainingLogs] = useState([]);
  const [evaluationMetrics, setEvaluationMetrics] = useState({});
  const [ragSettings, setRagSettings] = useState({
    embeddingModel: 'all-MiniLM-L6-v2',
    chunkSize: 1000,
    chunkOverlap: 200,
    vectorDB: 'chroma',
    retrievalK: 5,
    temperature: 0.7,
    maxTokens: 2048
  });

  const [fineTuningSettings, setFineTuningSettings] = useState({
    learningRate: 0.0001,
    batchSize: 4,
    epochs: 3,
    warmupSteps: 100,
    saveSteps: 500,
    evaluationStrategy: 'steps',
    evaluationSteps: 250,
    weightDecay: 0.01
  });

  const [systemStats, setSystemStats] = useState({
    cpu: 0,
    memory: 0,
    gpu: 0,
    diskSpace: 0
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setSystemStats({
        cpu: Math.random() * 100,
        memory: Math.random() * 100,
        gpu: Math.random() * 100,
        diskSpace: Math.random() * 100
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const [, setTrainingDatasets] = useState([]);

  const handleDatasetUpload = async (event) => {
    const files = Array.from(event.target.files);
    setTrainingStatus('processing');
    
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch('http://localhost:8001/upload_dataset/', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Dataset upload failed for ${file.name}`);
        }

        const result = await response.json();
        setTrainingDatasets(prev => [...prev, result]);
        setTrainingData(prev => [...prev, {
          id: Date.now() + Math.random(),
          name: file.name,
          size: file.size,
          status: 'uploaded'
        }]);

      } catch (error) {
        console.error('Error uploading dataset:', error);
        setTrainingStatus('error');
        return;
      }
    }

    setTrainingStatus('processed');
  };

  const processTrainingData = async () => {
    setTrainingStatus('processing');
    // Add your data processing logic here
    setTimeout(() => {
      setTrainingStatus('processed');
    }, 2000);
  };

  

  const handleMergeModel = async () => {
    const requestBody = {
      base_model: selectedModel,
      lora_adapter_path: `models/finetuned-${selectedModel}`,
      output_path: `models/merged_models/merged-${selectedModel}`,
    };

    try {
      const response = await fetch('http://localhost:8001/merge_model/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error('Failed to start model merging.');
      }

      const result = await response.json();
      console.log('Model merging started:', result);

    } catch (error) {
      console.error('Error starting model merging:', error);
    }
  };

  const startTraining = async () => {
    setTrainingStatus('training');
    setTrainingLogs([]);

    const requestBody = {
      base_model: selectedModel,
      dataset_path: "path/to/your/dataset.jsonl", // Bu dinamik olarak ayarlanmalı
      output_path: `models/finetuned-${selectedModel}`,
      config: fineTuningSettings,
    };

    try {
      const response = await fetch('http://localhost:8001/finetune/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error('Failed to start fine-tuning.');
      }

      const result = await response.json();
      console.log('Fine-tuning started:', result);
      // Burada eğitim ilerlemesini izlemek için bir WebSocket veya yoklama mekanizması uygulayabilirsiniz.

    } catch (error) {
      console.error('Error starting fine-tuning:', error);
      setTrainingStatus('error');
    }
  };

  const stopTraining = () => {
    setTrainingStatus('stopped');
  };

  const resetTraining = () => {
    setTrainingStatus('idle');
    setTrainingProgress(0);
    setTrainingLogs([]);
    setEvaluationMetrics({});
  };

  const exportModel = () => {
    const modelData = {
      model: selectedModel,
      ragSettings,
      fineTuningSettings,
      metrics: evaluationMetrics,
      trainingData: trainingData.map(d => ({ name: d.name, size: d.size }))
    };
    
    const blob = new Blob([JSON.stringify(modelData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `model-${selectedModel}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'idle': return 'bg-gray-500';
      case 'processing': return 'bg-blue-500';
      case 'training': return 'bg-yellow-500';
      case 'completed': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      case 'stopped': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'error': return <XCircle className="h-4 w-4" />;
      case 'training': return <RefreshCw className="h-4 w-4 animate-spin" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">AI Model Training</h1>
          <p className="text-muted-foreground mt-2">
            Fine-tune AI models with RAG-based training for improved performance
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className={`${getStatusColor(trainingStatus)} text-white`}>
            {getStatusIcon(trainingStatus)}
            <span className="ml-2 capitalize">{trainingStatus}</span>
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Cpu className="h-4 w-4 mr-2" />
              CPU Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStats.cpu.toFixed(1)}%</div>
            <Progress value={systemStats.cpu} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <HardDrive className="h-4 w-4 mr-2" />
              Memory
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStats.memory.toFixed(1)}%</div>
            <Progress value={systemStats.memory} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Zap className="h-4 w-4 mr-2" />
              GPU Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStats.gpu.toFixed(1)}%</div>
            <Progress value={systemStats.gpu} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Database className="h-4 w-4 mr-2" />
              Disk Space
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStats.diskSpace.toFixed(1)}%</div>
            <Progress value={systemStats.diskSpace} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="data" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="data">Training Data</TabsTrigger>
          <TabsTrigger value="rag">RAG Settings</TabsTrigger>
          <TabsTrigger value="finetune">Fine-tuning</TabsTrigger>
          <TabsTrigger value="training">Training</TabsTrigger>
          <TabsTrigger value="evaluation">Evaluation</TabsTrigger>
        </TabsList>

        <TabsContent value="data" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Training Data Management
              </CardTitle>
              <CardDescription>
                Upload and manage your training datasets for model fine-tuning
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-sm text-gray-600 mb-2">
                  Drag and drop your training files here, or click to browse
                </p>
                <Input
                  type="file"
                  multiple
                  accept=".txt,.json,.csv,.jsonl"
                  onChange={handleDatasetUpload}
                  className="w-full"
                />
              </div>

              {trainingData.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium">Uploaded Files ({trainingData.length})</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {trainingData.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4" />
                          <span className="text-sm">{file.name}</span>
                          <span className="text-xs text-gray-500">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <Badge variant={file.status === 'processed' ? 'default' : 'secondary'}>
                          {file.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <Button onClick={processTrainingData} disabled={trainingStatus === 'processing'}>
                    {trainingStatus === 'processing' ? 'Processing...' : 'Process Data'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rag" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Brain className="h-5 w-5 mr-2" />
                RAG Configuration
              </CardTitle>
              <CardDescription>
                Configure Retrieval-Augmented Generation settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="embedding-model">Embedding Model</Label>
                  <Select value={ragSettings.embeddingModel} onValueChange={(value) => 
                    setRagSettings(prev => ({ ...prev, embeddingModel: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-MiniLM-L6-v2">all-MiniLM-L6-v2</SelectItem>
                      <SelectItem value="all-mpnet-base-v2">all-mpnet-base-v2</SelectItem>
                      <SelectItem value="text-embedding-ada-002">text-embedding-ada-002</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vector-db">Vector Database</Label>
                  <Select value={ragSettings.vectorDB} onValueChange={(value) => 
                    setRagSettings(prev => ({ ...prev, vectorDB: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chroma">Chroma</SelectItem>
                      <SelectItem value="pinecone">Pinecone</SelectItem>
                      <SelectItem value="weaviate">Weaviate</SelectItem>
                      <SelectItem value="qdrant">Qdrant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="chunk-size">Chunk Size</Label>
                  <Input
                    id="chunk-size"
                    type="number"
                    value={ragSettings.chunkSize}
                    onChange={(e) => setRagSettings(prev => ({ ...prev, chunkSize: parseInt(e.target.value) }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="chunk-overlap">Chunk Overlap</Label>
                  <Input
                    id="chunk-overlap"
                    type="number"
                    value={ragSettings.chunkOverlap}
                    onChange={(e) => setRagSettings(prev => ({ ...prev, chunkOverlap: parseInt(e.target.value) }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="retrieval-k">Retrieval K</Label>
                  <Input
                    id="retrieval-k"
                    type="number"
                    value={ragSettings.retrievalK}
                    onChange={(e) => setRagSettings(prev => ({ ...prev, retrievalK: parseInt(e.target.value) }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="temperature">Temperature</Label>
                  <Input
                    id="temperature"
                    type="number"
                    step="0.1"
                    value={ragSettings.temperature}
                    onChange={(e) => setRagSettings(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="finetune" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                Fine-tuning Settings
              </CardTitle>
              <CardDescription>
                Configure model fine-tuning parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="learning-rate">Learning Rate</Label>
                  <Input
                    id="learning-rate"
                    type="number"
                    step="0.0001"
                    value={fineTuningSettings.learningRate}
                    onChange={(e) => setFineTuningSettings(prev => ({ ...prev, learningRate: parseFloat(e.target.value) }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="batch-size">Batch Size</Label>
                  <Input
                    id="batch-size"
                    type="number"
                    value={fineTuningSettings.batchSize}
                    onChange={(e) => setFineTuningSettings(prev => ({ ...prev, batchSize: parseInt(e.target.value) }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="epochs">Epochs</Label>
                  <Input
                    id="epochs"
                    type="number"
                    value={fineTuningSettings.epochs}
                    onChange={(e) => setFineTuningSettings(prev => ({ ...prev, epochs: parseInt(e.target.value) }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="warmup-steps">Warmup Steps</Label>
                  <Input
                    id="warmup-steps"
                    type="number"
                    value={fineTuningSettings.warmupSteps}
                    onChange={(e) => setFineTuningSettings(prev => ({ ...prev, warmupSteps: parseInt(e.target.value) }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="save-steps">Save Steps</Label>
                  <Input
                    id="save-steps"
                    type="number"
                    value={fineTuningSettings.saveSteps}
                    onChange={(e) => setFineTuningSettings(prev => ({ ...prev, saveSteps: parseInt(e.target.value) }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weight-decay">Weight Decay</Label>
                  <Input
                    id="weight-decay"
                    type="number"
                    step="0.01"
                    value={fineTuningSettings.weightDecay}
                    onChange={(e) => setFineTuningSettings(prev => ({ ...prev, weightDecay: parseFloat(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="base-model">Base Model</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a base model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="codellama/CodeLlama-7b-hf">CodeLlama-7b</SelectItem>
                    <SelectItem value="mistralai/Mistral-7B-Instruct-v0.2">Mistral-7B-Instruct</SelectItem>
                    <SelectItem value="meta-llama/Llama-2-70b-chat-hf">Llama-2-70b-chat</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2 mt-4">
                <input type="checkbox" id="qlora-checkbox" />
                <Label htmlFor="qlora-checkbox">Enable QLoRA for Efficient Training</Label>
              </div>

              {trainingStatus === 'completed' && (
                <div className="flex space-x-2 mt-4">
                  <Button onClick={handleMergeModel}>Merge Model</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="training" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Brain className="h-5 w-5 mr-2" />
                Training Control
              </CardTitle>
              <CardDescription>
                Monitor and control the training process
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Button
                  onClick={startTraining}
                  disabled={trainingStatus === 'training' || !selectedModel || trainingData.length === 0}
                  className="flex items-center space-x-2"
                >
                  <Play className="h-4 w-4" />
                  <span>Start Training</span>
                </Button>
                <Button
                  onClick={stopTraining}
                  disabled={trainingStatus !== 'training'}
                  variant="outline"
                  className="flex items-center space-x-2"
                >
                  <Square className="h-4 w-4" />
                  <span>Stop</span>
                </Button>
                <Button
                  onClick={resetTraining}
                  variant="outline"
                  className="flex items-center space-x-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Reset</span>
                </Button>
              </div>

              {trainingProgress > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Training Progress</span>
                    <span>{trainingProgress.toFixed(1)}%</span>
                  </div>
                  <Progress value={trainingProgress} />
                </div>
              )}

              {trainingLogs.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium">Training Logs</h3>
                  <div className="max-h-64 overflow-y-auto bg-gray-50 p-3 rounded text-sm font-mono">
                    {trainingLogs.map((log, index) => (
                      <div key={index} className="flex justify-between">
                        <span>Step {log.step}: Loss {log.loss}</span>
                        <span className="text-gray-500">LR: {log.learningRate}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evaluation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Model Evaluation
              </CardTitle>
              <CardDescription>
                Performance metrics and model evaluation results
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.keys(evaluationMetrics).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Accuracy</Label>
                    <div className="flex items-center space-x-2">
                      <Progress value={evaluationMetrics.accuracy * 100} className="flex-1" />
                      <span className="text-sm font-mono">{(evaluationMetrics.accuracy * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Precision</Label>
                    <div className="flex items-center space-x-2">
                      <Progress value={evaluationMetrics.precision * 100} className="flex-1" />
                      <span className="text-sm font-mono">{(evaluationMetrics.precision * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Recall</Label>
                    <div className="flex items-center space-x-2">
                      <Progress value={evaluationMetrics.recall * 100} className="flex-1" />
                      <span className="text-sm font-mono">{(evaluationMetrics.recall * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>F1 Score</Label>
                    <div className="flex items-center space-x-2">
                      <Progress value={evaluationMetrics.f1Score * 100} className="flex-1" />
                      <span className="text-sm font-mono">{(evaluationMetrics.f1Score * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Perplexity</Label>
                    <div className="text-2xl font-bold">{evaluationMetrics.perplexity.toFixed(2)}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>BLEU Score</Label>
                    <div className="text-2xl font-bold">{evaluationMetrics.bleuScore.toFixed(3)}</div>
                  </div>
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No evaluation metrics available. Complete a training run to see performance metrics.
                  </AlertDescription>
                </Alert>
              )}

              {Object.keys(evaluationMetrics).length > 0 && (
                <div className="flex space-x-2">
                  <Button onClick={exportModel} className="flex items-center space-x-2">
                    <Download className="h-4 w-4" />
                    <span>Export Model</span>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AIModelTraining;