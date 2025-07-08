// LocoDex VS Code Extension Types

export interface LocoDexConfig {
  apiEndpoint: string;
  vllmEndpoint: string;
  preferredProvider: 'ollama' | 'lmstudio' | 'vllm' | 'auto';
  model: string;
  maxTokens: number;
  temperature: number;
  enableInlineCompletion: boolean;
  enableSecurityScan: boolean;
  enableCodeReview: boolean;
  autoSaveChat: boolean;
  securityLevel: 'low' | 'medium' | 'high' | 'enterprise';
  enableTelemetry: boolean;
  codeLanguages: string[];
}

export interface Model {
  id: string;
  name: string;
  provider: string;
  status: 'available' | 'loaded' | 'loading' | 'error';
  capabilities: {
    chat: boolean;
    completion: boolean;
    embedding?: boolean;
    vision?: boolean;
    code?: boolean;
    reasoning?: boolean;
    factChecking?: boolean;
    enterpriseReady?: boolean;
    highPerformance?: boolean;
    gpuAcceleration?: boolean;
  };
  metadata?: Record<string, any>;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    model?: string;
    tokens?: number;
    processingTime?: number;
  };
}

export interface CodeContext {
  filePath: string;
  language: string;
  selectedText?: string;
  surroundingCode?: string;
  lineNumber?: number;
  columnNumber?: number;
  projectContext?: {
    packageJson?: any;
    gitBranch?: string;
    dependencies?: string[];
  };
}

export interface CompletionRequest {
  prompt: string;
  context: CodeContext;
  maxTokens?: number;
  temperature?: number;
  stop?: string[];
}

export interface CompletionResponse {
  completion: string;
  model: string;
  processingTime: number;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  metadata?: Record<string, any>;
}

export interface SecurityIssue {
  type: 'vulnerability' | 'warning' | 'info';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  line?: number;
  column?: number;
  suggestion?: string;
  cwe?: string;
  references?: string[];
}

export interface SecurityScanResult {
  issues: SecurityIssue[];
  scanTime: number;
  model: string;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface CodeReviewResult {
  overall: 'excellent' | 'good' | 'fair' | 'needs-improvement';
  score: number; // 0-100
  issues: {
    type: 'bug' | 'performance' | 'maintainability' | 'security' | 'style';
    severity: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    suggestion: string;
    line?: number;
    column?: number;
  }[];
  suggestions: string[];
  model: string;
  reviewTime: number;
}

export interface OptimizationSuggestion {
  type: 'performance' | 'memory' | 'readability' | 'best-practices';
  title: string;
  description: string;
  before: string;
  after: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  line?: number;
  column?: number;
}

export interface DocumentationResult {
  functions: {
    name: string;
    description: string;
    parameters: {
      name: string;
      type: string;
      description: string;
      required: boolean;
    }[];
    returns: {
      type: string;
      description: string;
    };
    examples: string[];
  }[];
  classes: {
    name: string;
    description: string;
    methods: string[];
    properties: string[];
  }[];
  overview: string;
  usage: string[];
}

export interface TestGenerationResult {
  framework: string;
  tests: {
    name: string;
    description: string;
    code: string;
    type: 'unit' | 'integration' | 'e2e';
  }[];
  setup?: string;
  mocks?: string[];
  coverage: {
    functions: string[];
    branches: string[];
    edge_cases: string[];
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    model?: string;
    processingTime?: number;
    requestId?: string;
  };
}

export interface ProviderStatus {
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  endpoint: string;
  lastCheck: Date | null;
  models: Model[];
  capabilities: string[];
  metadata?: Record<string, any>;
}

export interface ModelDiscoveryResult {
  providers: Record<string, ProviderStatus>;
  models: Model[];
  totalModels: number;
  availableProviders: number;
  lastUpdated: string;
  errors: Array<{
    provider: string;
    error: string;
    timestamp: string;
  }>;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  model: string;
  created: Date;
  updated: Date;
  metadata?: Record<string, any>;
}

// VS Code specific types
export interface WebviewMessage {
  type: string;
  payload?: any;
}

export interface ExtensionState {
  isActivated: boolean;
  currentModel: Model | null;
  chatSessions: ChatSession[];
  config: LocoDexConfig;
  providerStatus: Record<string, ProviderStatus>;
}

// Telemetry types (all local)
export interface TelemetryEvent {
  event: string;
  timestamp: Date;
  properties?: Record<string, any>;
  measurements?: Record<string, number>;
}

export interface UsageStats {
  totalRequests: number;
  completionRequests: number;
  chatRequests: number;
  codeReviews: number;
  securityScans: number;
  averageResponseTime: number;
  favoriteModels: Record<string, number>;
  languageDistribution: Record<string, number>;
  dailyUsage: Record<string, number>;
}

// Error types
export class LocoDexError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'LocoDexError';
  }
}

export class ApiError extends LocoDexError {
  constructor(message: string, public statusCode: number, details?: any) {
    super(message, 'API_ERROR', details);
    this.name = 'ApiError';
  }
}

export class ConfigError extends LocoDexError {
  constructor(message: string, details?: any) {
    super(message, 'CONFIG_ERROR', details);
    this.name = 'ConfigError';
  }
}

export class ModelError extends LocoDexError {
  constructor(message: string, details?: any) {
    super(message, 'MODEL_ERROR', details);
    this.name = 'ModelError';
  }
}