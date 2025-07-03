const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  
  // Dialog methods
  showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  
  // External links
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // Theme
  getTheme: () => ipcRenderer.invoke('get-theme'),
  setTheme: (theme) => ipcRenderer.invoke('set-theme', theme),
  
  // Model discovery
  discoverModels: () => ipcRenderer.invoke('discover-models'),
  checkProvider: (providerKey) => ipcRenderer.invoke('check-provider', providerKey),
  getRecommendedModels: (models, taskType) => ipcRenderer.invoke('get-recommended-models', models, taskType),
  clearModelCache: () => ipcRenderer.invoke('clear-model-cache'),
  getProviderStatus: () => ipcRenderer.invoke('get-provider-status'),
  testModelConnection: (model) => ipcRenderer.invoke('test-model-connection', model),
  getSystemStats: () => ipcRenderer.invoke('get-system-stats'),
  reloadApp: () => ipcRenderer.invoke('reload-app'),
  openDevTools: () => ipcRenderer.invoke('open-dev-tools'),
  
  // Event listeners
  onNewChat: (callback) => ipcRenderer.on('new-chat', callback),
  onFileOpened: (callback) => ipcRenderer.on('file-opened', callback),
  onSaveChat: (callback) => ipcRenderer.on('save-chat', callback),
  onOpenSettings: (callback) => ipcRenderer.on('open-settings', callback),
  onThemeChanged: (callback) => ipcRenderer.on('theme-changed', callback),
  onOpenModelSelector: (callback) => ipcRenderer.on('open-model-selector', callback),
  onRefreshModels: (callback) => ipcRenderer.on('refresh-models', callback),
  onCheckOllamaStatus: (callback) => ipcRenderer.on('check-ollama-status', callback),
  onCheckLMStudioStatus: (callback) => ipcRenderer.on('check-lmstudio-status', callback),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

// Backward compatibility for window.electron
contextBridge.exposeInMainWorld('electron', {
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  
  // Dialog methods
  showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  
  // External links
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // Theme
  getTheme: () => ipcRenderer.invoke('get-theme'),
  setTheme: (theme) => ipcRenderer.invoke('set-theme', theme),
  
  // Model discovery
  discoverModels: () => ipcRenderer.invoke('discover-models'),
  checkProvider: (providerKey) => ipcRenderer.invoke('check-provider', providerKey),
  getRecommendedModels: (models, taskType) => ipcRenderer.invoke('get-recommended-models', models, taskType),
  clearModelCache: () => ipcRenderer.invoke('clear-model-cache'),
  getProviderStatus: () => ipcRenderer.invoke('get-provider-status'),
  testModelConnection: (model) => ipcRenderer.invoke('test-model-connection', model),
  getSystemStats: () => ipcRenderer.invoke('get-system-stats'),
  reloadApp: () => ipcRenderer.invoke('reload-app'),
  openDevTools: () => ipcRenderer.invoke('open-dev-tools'),
  
  // Event listeners
  onNewChat: (callback) => ipcRenderer.on('new-chat', callback),
  onFileOpened: (callback) => ipcRenderer.on('file-opened', callback),
  onSaveChat: (callback) => ipcRenderer.on('save-chat', callback),
  onOpenSettings: (callback) => ipcRenderer.on('open-settings', callback),
  onThemeChanged: (callback) => ipcRenderer.on('theme-changed', callback),
  onOpenModelSelector: (callback) => ipcRenderer.on('open-model-selector', callback),
  onRefreshModels: (callback) => ipcRenderer.on('refresh-models', callback),
  onCheckOllamaStatus: (callback) => ipcRenderer.on('check-ollama-status', callback),
  onCheckLMStudioStatus: (callback) => ipcRenderer.on('check-lmstudio-status', callback),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

// Node.js API exposure (limited)
contextBridge.exposeInMainWorld('nodeAPI', {
  process: {
    platform: process.platform,
    arch: process.arch,
    versions: process.versions
  }
});

