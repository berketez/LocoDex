import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react'

// Debounce hook for performance optimization
export const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Throttle hook for performance optimization
export const useThrottle = (value, limit) => {
  const [throttledValue, setThrottledValue] = useState(value)
  const lastRan = useRef(Date.now())

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= limit) {
        setThrottledValue(value)
        lastRan.current = Date.now()
      }
    }, limit - (Date.now() - lastRan.current))

    return () => {
      clearTimeout(handler)
    }
  }, [value, limit])

  return throttledValue
}

// Intersection Observer hook for lazy loading
export const useIntersectionObserver = (options = {}) => {
  const [isIntersecting, setIsIntersecting] = useState(false)
  const [hasIntersected, setHasIntersected] = useState(false)
  const targetRef = useRef(null)

  useEffect(() => {
    const target = targetRef.current
    if (!target) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting)
        if (entry.isIntersecting && !hasIntersected) {
          setHasIntersected(true)
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options
      }
    )

    observer.observe(target)

    return () => {
      observer.unobserve(target)
    }
  }, [hasIntersected, options])

  return { targetRef, isIntersecting, hasIntersected }
}

// Virtual scrolling hook for large lists
export const useVirtualScroll = (items, itemHeight, containerHeight) => {
  const [scrollTop, setScrollTop] = useState(0)

  const visibleItems = useMemo(() => {
    if (!items.length || !itemHeight || !containerHeight) return []

    const startIndex = Math.floor(scrollTop / itemHeight)
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + 1,
      items.length
    )

    return items.slice(startIndex, endIndex).map((item, index) => ({
      ...item,
      index: startIndex + index,
      offsetY: (startIndex + index) * itemHeight
    }))
  }, [items, itemHeight, containerHeight, scrollTop])

  const totalHeight = items.length * itemHeight

  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop)
  }, [])

  return {
    visibleItems,
    totalHeight,
    onScroll: handleScroll
  }
}

// Memoized component wrapper
export const memo = (Component, areEqual) => {
  return React.memo(Component, areEqual)
}

// Performance measurement utilities
export class PerformanceProfiler {
  constructor() {
    this.measurements = new Map()
    this.isEnabled = import.meta.env.DEV
  }

  start(label) {
    if (!this.isEnabled) return
    this.measurements.set(label, performance.now())
  }

  end(label) {
    if (!this.isEnabled) return
    const startTime = this.measurements.get(label)
    if (startTime) {
      const duration = performance.now() - startTime
      console.log(`⚡ ${label}: ${duration.toFixed(2)}ms`)
      this.measurements.delete(label)
      return duration
    }
  }

  measure(label, fn) {
    if (!this.isEnabled) return fn()
    
    this.start(label)
    const result = fn()
    this.end(label)
    return result
  }

  async measureAsync(label, asyncFn) {
    if (!this.isEnabled) return await asyncFn()
    
    this.start(label)
    const result = await asyncFn()
    this.end(label)
    return result
  }
}

export const profiler = new PerformanceProfiler()

// Image optimization utilities
export const optimizeImage = (file, maxWidth = 1920, maxHeight = 1080, quality = 0.8) => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }
      
      if (height > maxHeight) {
        width = (width * maxHeight) / height
        height = maxHeight
      }

      canvas.width = width
      canvas.height = height

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height)
      
      canvas.toBlob(resolve, 'image/jpeg', quality)
    }

    img.src = URL.createObjectURL(file)
  })
}

// Memory management utilities
export class MemoryManager {
  constructor() {
    this.cache = new Map()
    this.maxCacheSize = 50
    this.cleanupInterval = null
    this.startCleanup()
  }

  set(key, value, ttl = 300000) { // 5 minutes default TTL
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl
    })
  }

  get(key) {
    const item = this.cache.get(key)
    if (!item) return null

    // Check if item has expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key)
      return null
    }

    return item.value
  }

  delete(key) {
    this.cache.delete(key)
  }

  clear() {
    this.cache.clear()
  }

  startCleanup() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now()
      for (const [key, item] of this.cache.entries()) {
        if (now - item.timestamp > item.ttl) {
          this.cache.delete(key)
        }
      }
    }, 60000) // Cleanup every minute
  }

  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      keys: Array.from(this.cache.keys())
    }
  }
}

export const memoryManager = new MemoryManager()

// Bundle size optimization utilities
export const loadComponentLazy = (importFn) => {
  return React.lazy(() => 
    importFn().catch(err => {
      console.error('Failed to load component:', err)
      // Return a fallback component
      return { 
        default: () => (
          <div className="p-4 text-center text-red-500">
            Bileşen yüklenemedi. Lütfen sayfayı yenileyin.
          </div>
        )
      }
    })
  )
}

// Network optimization utilities
export class NetworkOptimizer {
  constructor() {
    this.requestQueue = []
    this.isProcessing = false
    this.maxConcurrentRequests = 6
    this.activeRequests = 0
  }

  async request(url, options = {}) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        url,
        options,
        resolve,
        reject
      })
      
      this.processQueue()
    })
  }

  async processQueue() {
    if (this.isProcessing || this.activeRequests >= this.maxConcurrentRequests) {
      return
    }

    this.isProcessing = true

    while (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
      const request = this.requestQueue.shift()
      this.activeRequests++

      this.executeRequest(request)
        .finally(() => {
          this.activeRequests--
          this.processQueue()
        })
    }

    this.isProcessing = false
  }

  async executeRequest({ url, options, resolve, reject }) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(10000) // 10 second timeout
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      resolve(data)
    } catch (error) {
      reject(error)
    }
  }

  // Batch multiple requests
  async batchRequests(requests) {
    const promises = requests.map(({ url, options }) => 
      this.request(url, options)
    )
    
    return Promise.allSettled(promises)
  }
}

export const networkOptimizer = new NetworkOptimizer()

// Component performance wrapper
export const withPerformanceMonitoring = (WrappedComponent, componentName) => {
  const PerformanceMonitoredComponent = React.forwardRef((props, ref) => {
    const renderStart = useRef(performance.now())
    
    useEffect(() => {
      const renderTime = performance.now() - renderStart.current
      if (renderTime > 16) { // More than one frame (60fps)
        console.warn(`🐌 ${componentName} slow render: ${renderTime.toFixed(2)}ms`)
      }
    })

    return <WrappedComponent {...props} ref={ref} />
  })
  PerformanceMonitoredComponent.displayName = `withPerformanceMonitoring(${componentName})`
  return PerformanceMonitoredComponent
}

// Resource preloader
export class ResourcePreloader {
  constructor() {
    this.preloadedResources = new Set()
  }

  preloadImage(src) {
    if (this.preloadedResources.has(src)) return Promise.resolve()

    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        this.preloadedResources.add(src)
        resolve()
      }
      img.onerror = reject
      img.src = src
    })
  }

  preloadScript(src) {
    if (this.preloadedResources.has(src)) return Promise.resolve()

    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.onload = () => {
        this.preloadedResources.add(src)
        resolve()
      }
      script.onerror = reject
      script.src = src
      document.head.appendChild(script)
    })
  }

  preloadCSS(href) {
    if (this.preloadedResources.has(href)) return Promise.resolve()

    return new Promise((resolve, reject) => {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.onload = () => {
        this.preloadedResources.add(href)
        resolve()
      }
      link.onerror = reject
      link.href = href
      document.head.appendChild(link)
    })
  }

  async preloadResources(resources) {
    const promises = resources.map(({ type, src }) => {
      switch (type) {
        case 'image':
          return this.preloadImage(src)
        case 'script':
          return this.preloadScript(src)
        case 'css':
          return this.preloadCSS(src)
        default:
          return Promise.resolve()
      }
    })

    return Promise.allSettled(promises)
  }
}

export const resourcePreloader = new ResourcePreloader()

// Cleanup utilities
export const useCleanup = (cleanupFn) => {
  useEffect(() => {
    return cleanupFn
  }, [cleanupFn])
}

// Global performance monitoring
if (typeof window !== 'undefined') {
  // Monitor long tasks
  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) {
          console.warn(`🐌 Long task detected: ${entry.duration.toFixed(2)}ms`)
        }
      }
    })
    
    try {
      observer.observe({ entryTypes: ['longtask'] })
    } catch (e) {
      // Longtask API not supported
    }
  }

  // Monitor memory usage
  if ('memory' in performance) {
    setInterval(() => {
      const memory = performance.memory
      const usedMB = memory.usedJSHeapSize / 1024 / 1024
      
      if (usedMB > 100) {
        console.warn(`🧠 High memory usage: ${usedMB.toFixed(2)}MB`)
      }
    }, 30000)
  }
}