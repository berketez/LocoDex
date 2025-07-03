import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react({
      // React Fast Refresh optimizasyonu
      fastRefresh: true,
      // JSX runtime optimizasyonu
      jsxRuntime: 'automatic'
    })
  ],
  
  // Build optimizasyonları
  build: {
    // Terser ile minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Console.log'ları kaldır
        drop_debugger: true, // Debugger'ları kaldır
        pure_funcs: ['console.log', 'console.info', 'console.debug'], // Belirli fonksiyonları kaldır
      },
      mangle: {
        safari10: true, // Safari 10 uyumluluğu
      },
    },
    
    // Chunk optimizasyonu
    rollupOptions: {
      output: {
        // Vendor chunks'ları ayır
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: [
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-avatar',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-progress',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip'
          ],
          motion: ['framer-motion'],
          icons: ['lucide-react']
        },
        // Chunk dosya isimlendirme
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    
    // Bundle boyutu optimizasyonu
    chunkSizeWarningLimit: 1000, // 1MB chunk uyarı limiti
    
    // Source map optimizasyonu
    sourcemap: process.env.NODE_ENV === 'development',
    
    // Asset inlining
    assetsInlineLimit: 4096, // 4KB altındaki assetleri inline yap
    
    // CSS code splitting
    cssCodeSplit: true,
    
    // Target modern browsers
    target: ['es2020', 'chrome80', 'firefox78', 'safari14', 'edge88']
  },
  
  // Development server optimizasyonları
  server: {
    // HMR optimizasyonu
    hmr: {
      overlay: true
    },
    // Port ve host
    port: 5173,
    host: true,
    // Pre-bundling optimizasyonu
    force: false
  },
  
  // Dependency pre-bundling optimizasyonu
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'framer-motion',
      'lucide-react',
      'clsx',
      'tailwind-merge',
      'class-variance-authority'
    ],
    exclude: [
      // Electron main process modules
      'electron'
    ]
  },
  
  // Path resolution
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@services': resolve(__dirname, './src/services'),
      '@utils': resolve(__dirname, './src/utils'),
      '@assets': resolve(__dirname, './assets')
    }
  },
  
  // CSS optimizasyonu
  css: {
    // PostCSS optimizasyonu
    postcss: {
      plugins: [
        require('autoprefixer'),
        require('tailwindcss')
      ]
    },
    // CSS modules optimizasyonu
    modules: {
      localsConvention: 'camelCase'
    }
  },
  
  // Environment variables
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  },
  
  // Worker optimizasyonu
  worker: {
    format: 'es'
  },
  
  // Preview server
  preview: {
    port: 4173,
    host: true
  },
  
  // Experimental features
  experimental: {
    renderBuiltUrl(filename) {
      return { runtime: `window.__assetsPath(${JSON.stringify(filename)})` }
    }
  }
})

