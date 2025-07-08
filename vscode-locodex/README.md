# LocoDex AI Code Assistant - VS Code Extension

🤖 **Enterprise-grade AI coding assistant for Visual Studio Code**

LocoDex AI Code Assistant extension provides intelligent code completion, security scanning, code review, and chat capabilities directly in your VS Code environment. Designed for enterprise use with local AI models to ensure your code never leaves your company.

## ✨ Features

### 🔮 Intelligent Code Completion
- **Inline Completion**: Real-time code suggestions as you type
- **Context-Aware**: Uses surrounding code context for better suggestions
- **Multi-language Support**: Works with JavaScript, TypeScript, Python, Java, Go, Rust, C++, and more

### 💬 AI Chat Assistant
- **Interactive Chat**: Ask questions about your code
- **Code Explanation**: Get detailed explanations of code snippets
- **Session Management**: Keep track of multiple chat conversations
- **Export Capabilities**: Save chat history for future reference

### 🛡️ Security Scanning
- **Vulnerability Detection**: Scan code for security issues
- **CWE Mapping**: Industry-standard security classifications
- **Auto-Fix**: Automatic security issue resolution
- **Workspace Scanning**: Scan entire projects for security vulnerabilities

### 🔍 Code Review
- **Quality Assessment**: Comprehensive code quality analysis
- **Performance Optimization**: Get suggestions for better performance
- **Best Practices**: Ensure your code follows industry standards
- **Automated Fixes**: Apply suggested improvements automatically

### ⚙️ Enterprise Configuration
- **Local AI Models**: Use your company's local AI infrastructure
- **Multiple Providers**: Support for Ollama, LM Studio, vLLM
- **Security Levels**: Configurable security policies
- **No Data Leakage**: All processing happens locally

## 🚀 Quick Start

### Prerequisites

1. **LocoDex Backend**: Ensure LocoDex API service is running
2. **AI Model Provider**: One of the following:
   - Ollama (recommended for local development)
   - LM Studio (user-friendly interface)
   - vLLM (high-performance inference)

### Installation

1. **Install the Extension**:
   ```bash
   # Clone and build the extension
   git clone <repository-url>
   cd extensions/vscode-locodex
   npm install
   npm run compile
   ```

2. **Package the Extension**:
   ```bash
   # Install vsce (VS Code Extension CLI)
   npm install -g vsce
   
   # Package the extension
   vsce package
   ```

3. **Install in VS Code**:
   - Open VS Code
   - Go to Extensions (Ctrl+Shift+X)
   - Click "Install from VSIX..."
   - Select the generated `.vsix` file

### Configuration

1. **Open Settings**: `Ctrl+Shift+P` → "LocoDex: Configure"
2. **Set Endpoints**:
   - LocoDex API: `http://localhost:8000`
   - vLLM Service: `http://localhost:8080`
3. **Select Model**: Choose from available AI models
4. **Configure Features**: Enable/disable completion, security, review features

## 📋 Commands

Access these commands via Command Palette (`Ctrl+Shift+P`):

| Command | Description |
|---------|-------------|
| `LocoDex: Open Chat` | Open AI chat panel |
| `LocoDex: Explain Code` | Explain selected code |
| `LocoDex: Security Scan` | Scan code for security issues |
| `LocoDex: Code Review` | Perform code quality review |
| `LocoDex: Optimize Code` | Get optimization suggestions |
| `LocoDex: Configure` | Open configuration UI |
| `LocoDex: Select Model` | Choose AI model |
| `LocoDex: Health Check` | Test service connections |

## 🎯 Usage Examples

### Code Completion
```javascript
// Start typing and get intelligent suggestions
function calculateTax(income) {
  // LocoDex will suggest tax calculation logic
}
```

### Security Scanning
```javascript
// This code will be flagged for SQL injection vulnerability
const query = "SELECT * FROM users WHERE id = " + userId;
// LocoDex suggests: Use parameterized queries instead
```

### Code Review
```python
# LocoDex will review this function and suggest improvements
def process_data(data):
    result = []
    for item in data:
        if item > 0:
            result.append(item * 2)
    return result
# Suggestion: Use list comprehension for better performance
```

## ⚙️ Configuration Options

### Connection Settings
- **API Endpoint**: LocoDex API service URL
- **vLLM Endpoint**: vLLM inference service URL  
- **Preferred Provider**: Auto, Ollama, LM Studio, or vLLM

### Model Settings
- **Active Model**: Selected AI model
- **Max Tokens**: Maximum response length (100-4000)
- **Temperature**: Creativity level (0.0-2.0)

### Feature Toggles
- **Inline Completion**: Enable/disable code completion
- **Security Scanning**: Enable/disable security features
- **Code Review**: Enable/disable review capabilities
- **Auto Save Chat**: Automatically save chat sessions

### Security Levels
- **Low**: Basic security checks
- **Medium**: Standard enterprise security
- **High**: Strict security policies (recommended)
- **Enterprise**: Maximum security with audit logging

## 🔧 Development

### Building from Source

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes during development
npm run watch

# Run tests
npm test

# Package for distribution
npm run package
```

### Project Structure

```
src/
├── extension.ts              # Main extension entry point
├── api/
│   └── locodexClient.ts     # API client for LocoDex services
├── providers/
│   ├── completionProvider.ts    # Code completion logic
│   ├── chatProvider.ts          # Chat interface
│   ├── securityProvider.ts      # Security scanning
│   └── codeReviewProvider.ts    # Code review features
├── config/
│   └── configurationProvider.ts # Settings UI
├── utils/
│   └── codeUtils.ts         # Code analysis utilities
└── types.ts                 # TypeScript type definitions
```

## 🛡️ Security & Privacy

### Enterprise Security
- **Local Processing**: All AI inference happens on your infrastructure
- **No Data Transmission**: Code never leaves your network
- **Audit Logging**: Track all AI interactions (enterprise level)
- **Access Controls**: Configurable security policies

### Data Privacy
- **Zero External Dependencies**: No cloud AI services required
- **Local Storage**: Chat history stored locally in VS Code
- **Optional Telemetry**: Usage analytics (local only, opt-in)

## 🤝 Integration

### Supported AI Providers

#### Ollama
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model
ollama pull llama3

# Start Ollama (runs on localhost:11434)
ollama serve
```

#### LM Studio
1. Download from [lmstudio.ai](https://lmstudio.ai)
2. Load a model
3. Start local server (default: localhost:1234)

#### vLLM
```bash
# Install vLLM
pip install vllm

# Start vLLM server
python -m vllm.entrypoints.openai.api_server \
  --model microsoft/DialoGPT-medium \
  --host 0.0.0.0 \
  --port 8080
```

### LocoDex Backend
Ensure the LocoDex API service is running:
```bash
# Start LocoDex API
cd /path/to/locodex
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

## 📊 Performance

### Optimized for Enterprise
- **Low Latency**: Sub-second response times
- **Minimal Resource Usage**: Lightweight VS Code integration
- **Scalable**: Supports multiple concurrent users
- **Caching**: Intelligent caching for faster responses

### System Requirements
- **VS Code**: Version 1.74.0 or later
- **Node.js**: Version 16.0 or later (for development)
- **Memory**: 512MB available RAM
- **Network**: Access to local AI services

## 🐛 Troubleshooting

### Common Issues

#### Extension Not Loading
```bash
# Check VS Code developer console
Help > Toggle Developer Tools > Console
```

#### Connection Issues
1. Verify services are running:
   ```bash
   curl http://localhost:8000/health  # LocoDex API
   curl http://localhost:8080/health  # vLLM
   ```
2. Check firewall settings
3. Verify endpoints in configuration

#### Performance Issues
1. Reduce max tokens in settings
2. Increase temperature for faster responses
3. Check system resources

#### Model Not Loading
1. Verify model is downloaded/available
2. Check model compatibility
3. Try different model provider

### Debug Mode
Enable debug logging in VS Code settings:
```json
{
  "locodex.debug": true,
  "locodex.logLevel": "verbose"
}
```

## 🔄 Updates

### Staying Updated
The extension will notify you of updates. To manually update:

1. Download latest release
2. Uninstall current version
3. Install new version via VSIX

### Release Notes
Check `CHANGELOG.md` for detailed release information.

## 📞 Support

### Enterprise Support
- **Documentation**: Complete API and configuration docs
- **Training**: Team onboarding and best practices
- **Custom Integration**: Tailored enterprise deployments

### Community
- **Issues**: Report bugs and feature requests
- **Discussions**: Community forum for questions
- **Contributions**: We welcome pull requests

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built on the robust LocoDex AI infrastructure
- Integrates with popular AI model providers
- Designed for enterprise security and privacy
- Community-driven development and feedback

---

**Enterprise AI Coding Assistant - Secure, Local, Powerful** 🚀