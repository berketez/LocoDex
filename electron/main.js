const { app, BrowserWindow, Menu, ipcMain, shell, dialog, nativeTheme } = require("electron");
const path = require("path");
const isDev = process.env.NODE_ENV === "development";
const { checkAndApplyCodeUpdates } = require('./codeUpdater');

// systeminformation'ı optional olarak yükle
let si = null;
try {
  si = require('systeminformation');
} catch (error) {
  console.warn('systeminformation module not available:', error.message);
}

// ModelDiscovery'yi dinamik import ile yükle
let modelDiscovery = null;
async function loadModelDiscovery() {
  try {
    const module = await import("../src/utils/modelDiscovery.js");
    modelDiscovery = module.modelDiscovery;
    console.log("ModelDiscovery loaded successfully");
  } catch (error) {
    console.warn("ModelDiscovery not available:", error.message);
  }
}

// Optional electron-updater import
let autoUpdater = null;
try {
  autoUpdater = require("electron-updater").autoUpdater;
  console.log("Auto-updater loaded successfully");
} catch (error) {
  console.log("Auto-updater not available:", error.message);
}

// Keep a global reference of the window object
let mainWindow;
let splashWindow;

// macOS specific configurations
const isMac = process.platform === "darwin";

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  splashWindow.loadFile(path.join(__dirname, "splash.html"));

  splashWindow.on("closed", () => {
    splashWindow = null;
  });
}

function createMainWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    show: false, // Don't show until ready
    titleBarStyle: isMac ? "hiddenInset" : "default",
    trafficLightPosition: isMac ? { x: 20, y: 20 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../assets/icon.png'),
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  // Show window when ready to prevent visual flash
  mainWindow.once("ready-to-show", () => {
    if (splashWindow) {
      splashWindow.close();
    }
    mainWindow.show();

    // Focus on macOS
    if (isMac) {
      app.focus();
    }
  });

  // Handle window closed
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Prevent navigation to external URLs
  mainWindow.webContents.on("will-navigate", (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);

    if (parsedUrl.origin !== "http://localhost:5173" && !isDev) {
      event.preventDefault();
    }
  });

  return mainWindow;
}

// App event handlers
app.whenReady().then(async () => {
  createSplashWindow();

  // Load ModelDiscovery
  await loadModelDiscovery();

  // Create main window after a short delay
  setTimeout(() => {
    createMainWindow();
    createMenu();

    // Setup auto updater
    if (!isDev && autoUpdater) {
      autoUpdater.checkForUpdatesAndNotify();
    }

    // Check for code updates
    checkAndApplyCodeUpdates(mainWindow); // Yeni eklenen kod güncelleme kontrolü
  }, 2000);

  app.on("activate", () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // On macOS, keep app running even when all windows are closed
  if (!isMac) {
    app.quit();
  }
});

// Security: Prevent new window creation
app.on("web-contents-created", (event, contents) => {
  contents.on("new-window", (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});

// Create application menu
function createMenu() {
  const template = [
    // macOS app menu
    ...(isMac
      ? [
          {
            label: app.getName(),
            submenu: [
              { label: "LocoDex Hakkında", role: "about" },
              { type: "separator" },
              { label: "Ayarlar...", accelerator: "Cmd+", click: () => openSettings() },
              { type: "separator" },
              { label: "Servisleri Gizle", role: "hide" },
              { label: "Diğerlerini Gizle", role: "hideothers" },
              { label: "Tümünü Göster", role: "unhide" },
              { type: "separator" },
              { label: "LocoDex'ten Çık", role: "quit" },
            ],
          },
        ]
      : []),

    // File menu
    {
      label: "Dosya",
      submenu: [
        {
          label: "Yeni Sohbet",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            mainWindow.webContents.send("new-chat");
          },
        },
        {
          label: "Dosya Aç...",
          accelerator: "CmdOrCtrl+O",
          click: () => openFile(),
        },
        {
          label: "Sohbeti Kaydet...",
          accelerator: "CmdOrCtrl+S",
          click: () => saveChat(),
        },
        { type: "separator" },
        ...(isMac
          ? []
          : [
              {
                label: "Ayarlar...",
                accelerator: "Ctrl+",
                click: () => openSettings(),
              },
              { type: "separator" },
              { label: "Çıkış", role: "quit" },
            ]),
      ],
    },

    // Edit menu
    {
      label: "Düzenle",
      submenu: [
        { label: "Geri Al", role: "undo" },
        { label: "Yinele", role: "redo" },
        { type: "separator" },
        { label: "Kes", role: "cut" },
        { label: "Kopyala", role: "copy" },
        { label: "Yapıştır", role: "paste" },
        { label: "Tümünü Seç", role: "selectall" },
      ],
    },

    // View menu
    {
      label: "Görünüm",
      submenu: [
        { label: "Yeniden Yükle", role: "reload" },
        { label: "Zorla Yeniden Yükle", role: "forceReload" },
        { label: "Geliştirici Araçları", role: "toggleDevTools" },
        { type: "separator" },
        { label: "Gerçek Boyut", role: "resetZoom" },
        { label: "Yakınlaştır", role: "zoomIn" },
        { label: "Uzaklaştır", role: "zoomOut" },
        { type: "separator" },
        { label: "Tam Ekran", role: "togglefullscreen" },
        { type: "separator" },
        {
          label: "Koyu Tema",
          type: "checkbox",
          checked: nativeTheme.shouldUseDarkColors,
          click: () => toggleTheme(),
        },
      ],
    },

    // Models menu
    {
      label: "Modeller",
      submenu: [
        {
          label: "Model Seç...",
          accelerator: "CmdOrCtrl+M",
          click: () => {
            mainWindow.webContents.send("open-model-selector");
          },
        },
        {
          label: "Modelleri Yenile",
          accelerator: "CmdOrCtrl+R",
          click: () => {
            mainWindow.webContents.send("refresh-models");
          },
        },
        { type: "separator" },
        {
          label: "Ollama Durumu",
          click: () => {
            mainWindow.webContents.send("check-ollama-status");
          },
        },
        {
          label: "LM Studio Durumu",
          click: () => {
            mainWindow.webContents.send("check-lmstudio-status");
          },
        },
      ],
    },

    // Window menu
    {
      label: "Pencere",
      submenu: [
        { label: "Simge Durumuna Küçült", role: "minimize" },
        { label: "Kapat", role: "close" },
        ...(isMac
          ? [
              { type: "separator" },
              { label: "Öne Getir", role: "front" },
            ]
          : []),
      ],
    },

    // Help menu
    {
      label: "Yardım",
      submenu: [
        {
          label: "LocoDex Hakkında",
          click: () => showAbout(),
        },
        {
          label: "Klavye Kısayolları",
          accelerator: "CmdOrCtrl+?",
          click: () => showKeyboardShortcuts(),
        },
        { type: "separator" },
        {
          label: "Kod Güncelleştirmelerini Kontrol Et",
          click: () => checkAndApplyCodeUpdates(mainWindow),
        },
        { type: "separator" },
        {
          label: "Hakkında",
          click: () => showAbout(),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Menu handlers
async function openFile() {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [
      {
        name: "Text Files",
        extensions: ["txt", "md", "js", "ts", "jsx", "tsx", "py", "java", "cpp", "c", "h"],
      },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    mainWindow.webContents.send("file-opened", result.filePaths[0]);
  }
}

async function saveChat() {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `LocoDex-Chat-${new Date().toISOString().split("T")[0]}.json`,
    filters: [
      { name: "JSON Files", extensions: ["json"] },
      { name: "Text Files", extensions: ["txt"] },
    ],
  });

  if (!result.canceled) {
    mainWindow.webContents.send("save-chat", result.filePath);
  }
}

function openSettings() {
  mainWindow.webContents.send("open-settings");
}

function toggleTheme() {
  nativeTheme.themeSource = nativeTheme.shouldUseDarkColors ? "light" : "dark";
  mainWindow.webContents.send("theme-changed", nativeTheme.shouldUseDarkColors);
}

function showAbout() {
  dialog.showMessageBox(mainWindow, {
    type: "info",
    title: "LocoDex Hakkında",
    message: "LocoDex",
    detail: `Sürüm: ${app.getVersion()}\nYerel AI modelleri ile çalışan akıllı kod asistanı.\n\n© 2024 LocoDex Team`,
    buttons: ["Tamam"],
  });
}

function showKeyboardShortcuts() {
  const shortcuts = [
    "Cmd/Ctrl + N: Yeni Sohbet",
    "Cmd/Ctrl + O: Dosya Aç",
    "Cmd/Ctrl + S: Sohbeti Kaydet",
    "Cmd/Ctrl + M: Model Seç",
    "Cmd/Ctrl + R: Modelleri Yenile",
    "Cmd/Ctrl + ,: Ayarlar",
    "Cmd/Ctrl + ?: Klavye Kısayolları",
  ];

  dialog.showMessageBox(mainWindow, {
    type: "info",
    title: "Klavye Kısayolları",
    message: "LocoDex Klavye Kısayolları",
    detail: shortcuts.join("\n"),
    buttons: ["Tamam"],
  });
}

// IPC handlers
ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});

ipcMain.handle("get-platform", () => {
  return process.platform;
});

ipcMain.handle("show-message-box", async (event, options) => {
  const result = await dialog.showMessageBox(mainWindow, options);
  return result;
});

ipcMain.handle("show-open-dialog", async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

ipcMain.handle("show-save-dialog", async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

ipcMain.handle("open-external", async (event, url) => {
  await shell.openExternal(url);
});

ipcMain.handle("get-theme", () => {
  return nativeTheme.shouldUseDarkColors ? "dark" : "light";
});

ipcMain.handle("set-theme", (event, theme) => {
  nativeTheme.themeSource = theme;
});

// Model discovery IPC handlers
ipcMain.handle("discover-models", async () => {
  if (!modelDiscovery) {
    return { models: [], error: 'ModelDiscovery not available' };
  }
  try {
    return await modelDiscovery.discoverAllModels();
  } catch (error) {
    console.error('Model discovery error:', error);
    return { models: [], error: error.message };
  }
});

ipcMain.handle("check-provider", async (event, providerKey) => {
  if (!modelDiscovery) {
    return { available: false, error: 'ModelDiscovery not available' };
  }
  try {
    return await modelDiscovery.checkProviderHealth(providerKey);
  } catch (error) {
    console.error('Provider check error:', error);
    return { available: false, error: error.message };
  }
});

ipcMain.handle("get-recommended-models", async (event, models, taskType) => {
  if (!modelDiscovery) {
    return [];
  }
  try {
    return modelDiscovery.getRecommendedModels(models, taskType);
  } catch (error) {
    console.error('Get recommended models error:', error);
    return [];
  }
});

ipcMain.handle("clear-model-cache", async () => {
  if (!modelDiscovery) {
    return;
  }
  try {
    modelDiscovery.clearCache();
  } catch (error) {
    console.error('Clear model cache error:', error);
  }
});

ipcMain.handle("get-provider-status", async () => {
  if (!modelDiscovery) {
    return {};
  }
  try {
    return modelDiscovery.getProviderStatus();
  } catch (error) {
    console.error('Get provider status error:', error);
    return {};
  }
});

ipcMain.handle("test-model-connection", async (event, model) => {
  if (!modelDiscovery) {
    return { success: false, error: 'ModelDiscovery not available' };
  }
  try {
    return modelDiscovery.testModelConnection(model);
  } catch (error) {
    console.error('Test model connection error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-system-stats", async () => {
  if (!si) {
    // systeminformation mevcut değilse mock data dön
    return {
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      disk: Math.random() * 100,
      network: { upload: 0, download: 0 },
      modelStatus: 'idle',
      lastActivity: null,
      activeConnections: 0,
      connectionStatus: {
        docker: 'disconnected',
        sandbox: 'disconnected',
        ollama: 'connected',
        lmstudio: 'connected'
      }
    };
  }

  try {
    const cpu = await si.currentLoad();
    const mem = await si.mem();
    const disk = await si.fsSize();

    return {
      cpu: cpu.currentLoad,
      memory: mem.active / mem.total * 100,
      disk: disk[0] ? disk[0].use : 0,
      network: { upload: 0, download: 0 },
      modelStatus: 'idle',
      lastActivity: null,
      activeConnections: 0,
      connectionStatus: {
        docker: 'disconnected',
        sandbox: 'disconnected', 
        ollama: 'connected',
        lmstudio: 'connected'
      }
    };
  } catch (error) {
    console.error('System stats error:', error);
    return {
      cpu: 0,
      memory: 0,
      disk: 0,
      network: { upload: 0, download: 0 },
      modelStatus: 'idle',
      lastActivity: null,
      activeConnections: 0,
      connectionStatus: {
        docker: 'disconnected',
        sandbox: 'disconnected',
        ollama: 'disconnected',
        lmstudio: 'disconnected'
      }
    };
  }
});

// App control handlers\nipcMain.handle('reload-app', () => {\n  if (mainWindow) {\n    mainWindow.reload();\n  }\n});\n\nipcMain.handle('open-dev-tools', () => {\n  if (mainWindow) {\n    mainWindow.webContents.openDevTools();\n  }\n});\n\n// Auto updater events (only if available)
if (autoUpdater) {
  autoUpdater.on("checking-for-update", () => {
    console.log("Checking for update...");
  });

  autoUpdater.on("update-available", () => {
    console.log("Update available.");
    dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Güncelleme Mevcut",
      message: "Yeni bir sürüm mevcut. İndiriliyor...",
      buttons: ["Tamam"],
    });
  });

  autoUpdater.on("update-not-available", () => {
    console.log("Update not available.");
  });

  autoUpdater.on("error", (err) => {
    console.log("Error in auto-updater. " + err);
  });

  autoUpdater.on("download-progress", (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + " - Downloaded " + progressObj.percent + "%";
    log_message = log_message + " (" + progressObj.transferred + "/" + progressObj.total + ")";
    console.log(log_message);
  });

  autoUpdater.on("update-downloaded", () => {
    console.log("Update downloaded");
    dialog
      .showMessageBox(mainWindow, {
        type: "info",
        title: "Güncelleme Hazır",
        message: "Güncelleme indirildi. Uygulamayı yeniden başlatmak istiyor musunuz?",
        buttons: ["Yeniden Başlat", "Daha Sonra"],
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
  });
} else {
  console.log("Auto-updater not available - running in standalone mode");
}

// Handle certificate errors
app.on("certificate-error", (event, webContents, url, error, certificate, callback) => {
  if (isDev) {
    // In development, ignore certificate errors
    event.preventDefault();
    callback(true);
  } else {
    // In production, use default behavior
    callback(false);
  }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}


