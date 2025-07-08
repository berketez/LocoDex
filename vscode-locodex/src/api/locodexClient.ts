import axios, { AxiosInstance, AxiosResponse } from 'axios';
import * as vscode from 'vscode';
import {
  LocoDexConfig,
  Model,
  ChatMessage,
  CompletionRequest,
  CompletionResponse,
  SecurityScanResult,
  CodeReviewResult,
  OptimizationSuggestion,
  DocumentationResult,
  TestGenerationResult,
  ModelDiscoveryResult,
  ApiResponse,
  ApiError,
  ModelError,
  CodeContext
} from '../types';

export class LocoDexApiClient {
  private client: AxiosInstance;
  private vllmClient: AxiosInstance;
  private config: LocoDexConfig;
  private maxRetries: number = 3;
  private retryDelay: number = 1000;

  constructor(config: LocoDexConfig) {
    this.config = config;
    
    // Ana LocoDex API client
    this.client = axios.create({
      baseURL: config.apiEndpoint,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LocoDex-VSCode-Extension/1.0.0'
      },
      // Retry configuration
      adapter: 'http',
      maxRedirects: 5,
      validateStatus: (status) => status < 500 // Retry on 5xx errors
    });

    // vLLM client
    this.vllmClient = axios.create({
      baseURL: config.vllmEndpoint,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LocoDex-VSCode-Extension/1.0.0'
      },
      // Retry configuration
      adapter: 'http',
      maxRedirects: 5,
      validateStatus: (status) => status < 500 // Retry on 5xx errors
    });

    this.setupInterceptors();
  }

  private async retryRequest<T>(
    requestFn: () => Promise<T>,
    retries: number = this.maxRetries
  ): Promise<T> {
    try {
      return await requestFn();
    } catch (error) {
      if (retries > 0 && this.shouldRetry(error)) {
        console.log(`[LocoDex] Retrying request. Attempts left: ${retries}`);
        await this.delay(this.retryDelay);
        return this.retryRequest(requestFn, retries - 1);
      }
      throw error;
    }
  }

  private shouldRetry(error: any): boolean {
    // Retry on network errors, timeouts, and 5xx errors
    return (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT' ||
      (error.response && error.response.status >= 500)
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[LocoDex] API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('[LocoDex] API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse<ApiResponse>) => {
        console.log(`[LocoDex] API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('[LocoDex] API Response Error:', error);
        
        if (error.response) {
          throw new ApiError(
            error.response.data?.error?.message || 'API request failed',
            error.response.status,
            error.response.data
          );
        } else if (error.request) {
          throw new ApiError(
            'Network error - cannot reach LocoDex API',
            0,
            { originalError: (error as any).message }
          );
        } else {
          throw new ApiError(
            (error as any).message || 'Unknown API error',
            0,
            { originalError: error }
          );
        }
      }
    );

    // Same for vLLM client
    this.vllmClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          throw new ApiError(
            error.response.data?.detail || 'vLLM request failed',
            error.response.status,
            error.response.data
          );
        } else if (error.request) {
          throw new ApiError(
            'Network error - cannot reach vLLM service',
            0,
            { originalError: (error as any).message }
          );
        } else {
          throw new ApiError(
            (error as any).message || 'Unknown vLLM error',
            0,
            { originalError: error }
          );
        }
      }
    );
  }

  async updateConfig(config: LocoDexConfig) {
    this.config = config;
    
    // Update endpoints if they changed
    if (this.client.defaults.baseURL !== config.apiEndpoint) {
      this.client.defaults.baseURL = config.apiEndpoint;
      console.log(`[LocoDex] API endpoint updated to: ${config.apiEndpoint}`);
    }
    
    if (this.vllmClient.defaults.baseURL !== config.vllmEndpoint) {
      this.vllmClient.defaults.baseURL = config.vllmEndpoint;
      console.log(`[LocoDex] vLLM endpoint updated to: ${config.vllmEndpoint}`);
    }
    
    // Update timeouts based on provider
    const timeout = config.preferredProvider === 'vllm' ? 60000 : 30000;
    this.client.defaults.timeout = timeout;
    this.vllmClient.defaults.timeout = timeout;
  }

  // Health check
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.retryRequest(() => this.client.get('/health'));
      return response.status === 200;
    } catch (error) {
      console.warn('[LocoDex] Health check failed:', error);
      return false;
    }
  }

  async checkVllmHealth(): Promise<boolean> {
    try {
      const response = await this.retryRequest(() => this.vllmClient.get('/health'));
      return response.status === 200;
    } catch (error) {
      console.warn('[LocoDex] vLLM health check failed:', error);
      return false;
    }
  }

  // Model discovery and management
  async discoverModels(): Promise<ModelDiscoveryResult> {
    try {
      const response = await this.client.get<ApiResponse<ModelDiscoveryResult>>('/api/models/discover');
      
      if (!response.data.success) {
        throw new ModelError(response.data.error?.message || 'Model discovery failed');
      }

      return response.data.data!;
    } catch (error) {
      console.error('[LocoDex] Model discovery failed:', error);
      throw error;
    }
  }

  async getAvailableModels(): Promise<Model[]> {
    try {
      const discovery = await this.discoverModels();
      return discovery.models;
    } catch (error) {
      console.error('[LocoDex] Get available models failed:', error);
      return [];
    }
  }

  // Chat completions
  async sendChatMessage(
    messages: ChatMessage[],
    model?: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    }
  ): Promise<ChatMessage> {
    try {
      const selectedModel = model || this.config.model;
      if (!selectedModel) {
        throw new ModelError('No model selected');
      }

      // Validate messages
      if (!messages || messages.length === 0) {
        throw new ApiError('No messages provided', 400);
      }

      const requestData = {
        model: selectedModel,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        temperature: options?.temperature || this.config.temperature,
        max_tokens: options?.maxTokens || this.config.maxTokens,
        stream: options?.stream || false
      };

      // Determine endpoint based on provider
      let response;
      if (selectedModel.includes('vllm') || this.config.preferredProvider === 'vllm') {
        response = await this.vllmClient.post('/v1/chat/completions', requestData);
      } else {
        response = await this.client.post('/chat', requestData);
      }

      // Parse response based on provider
      let content: string;
      let metadata: any = {};

      if (response.data.choices) {
        // OpenAI-style response (vLLM)
        content = response.data.choices[0]?.message?.content || '';
        metadata = {
          model: response.data.model,
          tokens: response.data.usage
        };
      } else {
        // LocoDex-style response
        content = response.data.response || response.data.message || '';
        metadata = response.data.metadata || {};
      }

      return {
        role: 'assistant',
        content,
        timestamp: new Date(),
        metadata
      };
    } catch (error) {
      console.error('[LocoDex] Chat message failed:', error);
      throw error;
    }
  }

  // Code completion
  async getCodeCompletion(request: CompletionRequest): Promise<CompletionResponse> {
    try {
      const selectedModel = this.config.model;
      if (!selectedModel) {
        throw new ModelError('No model selected for completion');
      }

      const requestData = {
        prompt: request.prompt,
        context: request.context,
        model: selectedModel,
        max_tokens: request.maxTokens || this.config.maxTokens,
        temperature: request.temperature || this.config.temperature,
        stop: request.stop || ['\n\n', '```']
      };

      let response;
      if (selectedModel.includes('vllm') || this.config.preferredProvider === 'vllm') {
        // vLLM completion
        response = await this.vllmClient.post('/v1/completions', {
          model: selectedModel,
          prompt: request.prompt,
          max_tokens: requestData.max_tokens,
          temperature: requestData.temperature,
          stop: requestData.stop
        });

        return {
          completion: response.data.choices[0]?.text || '',
          model: response.data.model,
          processingTime: 0, // vLLM doesn't provide this
          tokens: response.data.usage || { prompt: 0, completion: 0, total: 0 }
        };
      } else {
        // LocoDex completion
        response = await this.client.post('/api/completion', requestData);
        
        if (!response.data.success) {
          throw new ApiError(response.data.error?.message || 'Completion failed', response.status);
        }

        return response.data.data;
      }
    } catch (error) {
      console.error('[LocoDex] Code completion failed:', error);
      throw error;
    }
  }

  // Code explanation
  async explainCode(code: string, context: CodeContext): Promise<string> {
    try {
      const systemPrompt = `Sen bir kod analiz uzmanısın. Verilen kodu Türkçe olarak açıkla. 
Açıklaman şunları içermeli:
1. Kodun ne yaptığı
2. Kullanılan tekniklerin açıklaması
3. Kodun amacı ve mantığı
4. Varsa önemli detaylar

Kod:
\`\`\`${context.language}
${code}
\`\`\``;

      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt, timestamp: new Date() },
        { role: 'user', content: `Bu kodu açıkla: ${code}`, timestamp: new Date() }
      ];

      const response = await this.sendChatMessage(messages);
      return response.content;
    } catch (error) {
      console.error('[LocoDex] Code explanation failed:', error);
      throw error;
    }
  }

  // Code optimization
  async optimizeCode(code: string, context: CodeContext): Promise<OptimizationSuggestion[]> {
    try {
      const systemPrompt = `Sen bir kod optimizasyon uzmanısın. Verilen kodu analiz et ve optimizasyon önerileri sun.
Her öneri için şunları belirt:
- Optimizasyon türü (performance, memory, readability, best-practices)
- Açıklama
- Önceki kod
- Optimize edilmiş kod
- Etkisi (high, medium, low)
- Uygulama zorluğu (low, medium, high)

Yanıtını JSON formatında ver.`;

      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt, timestamp: new Date() },
        { role: 'user', content: `Bu kodu optimize et:\n\`\`\`${context.language}\n${code}\n\`\`\``, timestamp: new Date() }
      ];

      const response = await this.sendChatMessage(messages);
      
      // Try to parse JSON response
      try {
        const cleanContent = response.content.replace(/```json\s*|\s*```/g, '').trim();
        const suggestions = JSON.parse(cleanContent);
        return Array.isArray(suggestions) ? suggestions : [suggestions];
      } catch (parseError) {
        console.warn('[LocoDex] Failed to parse optimization response as JSON:', parseError);
        // If not JSON, create a single suggestion from the text response
        return [{
          type: 'best-practices',
          title: 'Kod Optimizasyonu',
          description: response.content,
          before: code,
          after: code, // Same as before if we can't parse specific changes
          impact: 'medium',
          effort: 'medium'
        }];
      }
    } catch (error) {
      console.error('[LocoDex] Code optimization failed:', error);
      throw error;
    }
  }

  // Security scan
  async scanSecurity(code: string, context: CodeContext): Promise<SecurityScanResult> {
    try {
      const systemPrompt = `Sen bir siber güvenlik uzmanısın. Verilen kodu güvenlik açıkları açısından analiz et.
Şunları kontrol et:
- SQL Injection
- XSS
- CSRF
- Input validation
- Authentication/Authorization
- Sensitive data exposure
- Cryptographic issues
- Business logic flaws

Yanıtını JSON formatında ver. Her güvenlik sorunu için:
- type: 'vulnerability', 'warning', 'info'
- severity: 'critical', 'high', 'medium', 'low'
- title: Sorun başlığı
- description: Açıklama
- suggestion: Çözüm önerisi
- cwe: CWE numarası (varsa)`;

      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt, timestamp: new Date() },
        { role: 'user', content: `Bu kodu güvenlik açısından analiz et:\n\`\`\`${context.language}\n${code}\n\`\`\``, timestamp: new Date() }
      ];

      const startTime = Date.now();
      const response = await this.sendChatMessage(messages);
      const scanTime = Date.now() - startTime;

      try {
        const cleanContent = response.content.replace(/```json\s*|\s*```/g, '').trim();
        const result = JSON.parse(cleanContent);
        const issues = Array.isArray(result.issues) ? result.issues : (Array.isArray(result) ? result : []);
        
        const summary = issues.reduce((acc: any, issue: any) => {
          acc[issue.severity] = (acc[issue.severity] || 0) + 1;
          return acc;
        }, { critical: 0, high: 0, medium: 0, low: 0 });

        return {
          issues,
          scanTime,
          model: this.config.model,
          summary
        };
      } catch (parseError) {
        console.warn('[LocoDex] Failed to parse security scan response as JSON:', parseError);
        // If not JSON, create a general security assessment
        return {
          issues: [{
            type: 'info',
            severity: 'low',
            title: 'Güvenlik Değerlendirmesi',
            description: response.content,
            suggestion: 'Kodu detaylı olarak gözden geçirin.'
          }],
          scanTime,
          model: this.config.model,
          summary: { critical: 0, high: 0, medium: 0, low: 1 }
        };
      }
    } catch (error) {
      console.error('[LocoDex] Security scan failed:', error);
      throw error;
    }
  }

  // Code review
  async reviewCode(code: string, context: CodeContext): Promise<CodeReviewResult> {
    try {
      const systemPrompt = `Sen deneyimli bir software engineer'sın. Verilen kodu kapsamlı olarak review et.
Şunları değerlendir:
- Code quality
- Best practices
- Performance
- Maintainability
- Security
- Readability
- Error handling
- Testing

Yanıtını JSON formatında ver:
- overall: 'excellent', 'good', 'fair', 'needs-improvement'
- score: 0-100 arası puan
- issues: Array of issues
- suggestions: Genel öneriler
- model: Model adı
- reviewTime: Review süresi`;

      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt, timestamp: new Date() },
        { role: 'user', content: `Bu kodu review et:\n\`\`\`${context.language}\n${code}\n\`\`\``, timestamp: new Date() }
      ];

      const startTime = Date.now();
      const response = await this.sendChatMessage(messages);
      const reviewTime = Date.now() - startTime;

      try {
        const result = JSON.parse(response.content);
        return {
          overall: result.overall || 'fair',
          score: result.score || 70,
          issues: result.issues || [],
          suggestions: result.suggestions || [response.content],
          model: this.config.model,
          reviewTime
        };
      } catch {
        // If not JSON, create a simple review
        return {
          overall: 'fair',
          score: 70,
          issues: [],
          suggestions: [response.content],
          model: this.config.model,
          reviewTime
        };
      }
    } catch (error) {
      console.error('[LocoDex] Code review failed:', error);
      throw error;
    }
  }

  // Generate tests
  async generateTests(code: string, context: CodeContext): Promise<TestGenerationResult> {
    try {
      const systemPrompt = `Sen bir test yazma uzmanısın. Verilen kod için kapsamlı testler oluştur.
Şunları içer:
- Unit testler
- Edge case'ler
- Error handling testleri
- Integration testleri (gerekirse)
- Mock objeler (gerekirse)

Yanıtını JSON formatında ver.`;

      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt, timestamp: new Date() },
        { role: 'user', content: `Bu kod için test yaz:\n\`\`\`${context.language}\n${code}\n\`\`\``, timestamp: new Date() }
      ];

      const response = await this.sendChatMessage(messages);

      try {
        const result = JSON.parse(response.content);
        return result;
      } catch {
        // If not JSON, create a simple test result
        return {
          framework: 'jest',
          tests: [{
            name: 'Basic Test',
            description: 'Generated test',
            code: response.content,
            type: 'unit'
          }],
          coverage: {
            functions: [],
            branches: [],
            edge_cases: []
          }
        };
      }
    } catch (error) {
      console.error('[LocoDex] Test generation failed:', error);
      throw error;
    }
  }

  // Generate documentation
  async generateDocumentation(code: string, context: CodeContext): Promise<DocumentationResult> {
    try {
      const systemPrompt = `Sen bir dokümantasyon uzmanısın. Verilen kod için kapsamlı dokümantasyon oluştur.
Şunları içer:
- Function/method açıklamaları
- Parameter açıklamaları
- Return value açıklamaları
- Usage örnekleri
- Class açıklamaları (varsa)

Yanıtını JSON formatında ver.`;

      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt, timestamp: new Date() },
        { role: 'user', content: `Bu kod için dokümantasyon oluştur:\n\`\`\`${context.language}\n${code}\n\`\`\``, timestamp: new Date() }
      ];

      const response = await this.sendChatMessage(messages);

      try {
        const result = JSON.parse(response.content);
        return result;
      } catch {
        // If not JSON, create a simple documentation result
        return {
          functions: [],
          classes: [],
          overview: response.content,
          usage: []
        };
      }
    } catch (error) {
      console.error('[LocoDex] Documentation generation failed:', error);
      throw error;
    }
  }

  // Fix issues
  async fixIssues(code: string, issues: string, context: CodeContext): Promise<string> {
    try {
      const systemPrompt = `Sen bir kod düzeltme uzmanısın. Verilen kodda belirtilen sorunları düzelt.
Düzeltirken:
- Orijinal kodu mümkün olduğunca koru
- Sadece gerekli değişiklikleri yap
- Kod stilini koru
- Açıklama ekle (gerekirse)

Sadece düzeltilmiş kodu döndür.`;

      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt, timestamp: new Date() },
        { 
          role: 'user', 
          content: `Bu kodu düzelt:\n\`\`\`${context.language}\n${code}\n\`\`\`\n\nSorunlar:\n${issues}`, 
          timestamp: new Date() 
        }
      ];

      const response = await this.sendChatMessage(messages);
      return response.content;
    } catch (error) {
      console.error('[LocoDex] Fix issues failed:', error);
      throw error;
    }
  }
}