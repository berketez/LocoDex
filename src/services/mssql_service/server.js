const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const sql = require('mssql');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cron = require('node-cron');
const winston = require('winston');
require('dotenv').config();

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: './logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: './logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());

// MSSQL Configuration
const dbConfig = {
  server: process.env.MSSQL_SERVER || 'localhost',
  port: parseInt(process.env.MSSQL_PORT) || 1433,
  database: process.env.MSSQL_DATABASE || 'master',
  user: process.env.MSSQL_USER || 'sa',
  password: process.env.MSSQL_PASSWORD || '',
  options: {
    encrypt: process.env.MSSQL_ENCRYPT === 'true',
    trustServerCertificate: process.env.MSSQL_TRUST_CERT === 'true',
    enableArithAbort: true,
    requestTimeout: 30000,
    connectionTimeout: 30000
  }
};

class MSSQLMonitor {
  constructor() {
    this.pool = null;
    this.isConnected = false;
    this.metrics = {
      connectionStatus: 'disconnected',
      lastUpdated: new Date(),
      performance: {},
      queries: [],
      tables: [],
      indexes: [],
      recommendations: []
    };
    this.clients = new Set();
  }

  async initialize() {
    try {
      this.pool = new sql.ConnectionPool(dbConfig);
      await this.pool.connect();
      this.isConnected = true;
      this.metrics.connectionStatus = 'connected';
      logger.info('MSSQL connection established');
      
      // Start monitoring
      this.startPerformanceMonitoring();
      this.startHealthChecks();
      
    } catch (error) {
      logger.error('MSSQL connection failed:', error);
      this.isConnected = false;
      this.metrics.connectionStatus = 'error';
    }
  }

  async getPerformanceMetrics() {
    if (!this.isConnected) return null;

    try {
      const request = new sql.Request(this.pool);
      
      // CPU Usage
      const cpuQuery = `
        SELECT 
          [cpu_percent] = (
            SELECT [cpu_percent] 
            FROM sys.dm_db_resource_stats 
            WHERE end_time = (SELECT MAX(end_time) FROM sys.dm_db_resource_stats)
          )
      `;
      
      // Memory Usage
      const memoryQuery = `
        SELECT 
          [memory_usage_percent] = (
            SELECT cntr_value 
            FROM sys.dm_os_performance_counters 
            WHERE counter_name = 'Memory Usage %'
          )
      `;
      
      // Active Connections
      const connectionsQuery = `
        SELECT COUNT(*) as active_connections
        FROM sys.dm_exec_sessions
        WHERE is_user_process = 1
      `;
      
      // Database Size
      const dbSizeQuery = `
        SELECT 
          DB_NAME() as database_name,
          SUM(size) * 8 / 1024 as size_mb
        FROM sys.database_files
      `;

      const [cpuResult, memoryResult, connectionsResult, dbSizeResult] = await Promise.all([
        request.query(cpuQuery).catch(() => ({ recordset: [{ cpu_percent: 0 }] })),
        request.query(memoryQuery).catch(() => ({ recordset: [{ memory_usage_percent: 0 }] })),
        request.query(connectionsQuery),
        request.query(dbSizeQuery)
      ]);

      return {
        cpu_percent: cpuResult.recordset[0]?.cpu_percent || 0,
        memory_percent: memoryResult.recordset[0]?.memory_usage_percent || 0,
        active_connections: connectionsResult.recordset[0]?.active_connections || 0,
        database_size_mb: dbSizeResult.recordset[0]?.size_mb || 0,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Error getting performance metrics:', error);
      return null;
    }
  }

  async getSlowQueries() {
    if (!this.isConnected) return [];

    try {
      const request = new sql.Request(this.pool);
      const query = `
        SELECT TOP 10
          qs.total_elapsed_time / qs.execution_count as avg_elapsed_time,
          qs.execution_count,
          qs.total_logical_reads,
          qs.total_physical_reads,
          SUBSTRING(st.text, (qs.statement_start_offset/2)+1,
            ((CASE qs.statement_end_offset
              WHEN -1 THEN DATALENGTH(st.text)
              ELSE qs.statement_end_offset
            END - qs.statement_start_offset)/2) + 1) AS statement_text
        FROM sys.dm_exec_query_stats qs
        CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
        WHERE qs.total_elapsed_time / qs.execution_count > 1000000
        ORDER BY avg_elapsed_time DESC
      `;
      
      const result = await request.query(query);
      return result.recordset.map(row => ({
        avg_elapsed_time_ms: row.avg_elapsed_time / 1000,
        execution_count: row.execution_count,
        logical_reads: row.total_logical_reads,
        physical_reads: row.total_physical_reads,
        query_text: row.statement_text?.substring(0, 200) + '...'
      }));
    } catch (error) {
      logger.error('Error getting slow queries:', error);
      return [];
    }
  }

  async getTableAnalysis() {
    if (!this.isConnected) return [];

    try {
      const request = new sql.Request(this.pool);
      const query = `
        SELECT 
          t.name as table_name,
          p.rows as row_count,
          SUM(a.total_pages) * 8 as size_kb,
          SUM(a.used_pages) * 8 as used_space_kb,
          (SUM(a.total_pages) - SUM(a.used_pages)) * 8 as unused_space_kb
        FROM sys.tables t
        INNER JOIN sys.indexes i ON t.object_id = i.object_id
        INNER JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
        INNER JOIN sys.allocation_units a ON p.partition_id = a.container_id
        WHERE t.is_ms_shipped = 0
        GROUP BY t.name, p.rows
        ORDER BY size_kb DESC
      `;
      
      const result = await request.query(query);
      return result.recordset;
    } catch (error) {
      logger.error('Error getting table analysis:', error);
      return [];
    }
  }

  async getIndexAnalysis() {
    if (!this.isConnected) return [];

    try {
      const request = new sql.Request(this.pool);
      const query = `
        SELECT 
          OBJECT_NAME(s.object_id) as table_name,
          i.name as index_name,
          s.user_seeks,
          s.user_scans,
          s.user_lookups,
          s.user_updates,
          CASE 
            WHEN s.user_seeks + s.user_scans + s.user_lookups = 0 THEN 'Unused'
            WHEN s.user_updates > (s.user_seeks + s.user_scans + s.user_lookups) * 2 THEN 'High Maintenance'
            ELSE 'Active'
          END as status
        FROM sys.dm_db_index_usage_stats s
        INNER JOIN sys.indexes i ON s.object_id = i.object_id AND s.index_id = i.index_id
        WHERE s.database_id = DB_ID()
          AND OBJECT_NAME(s.object_id) NOT LIKE 'sys%'
        ORDER BY s.user_seeks + s.user_scans + s.user_lookups DESC
      `;
      
      const result = await request.query(query);
      return result.recordset;
    } catch (error) {
      logger.error('Error getting index analysis:', error);
      return [];
    }
  }

  async generateRecommendations() {
    const recommendations = [];
    
    try {
      const performance = await this.getPerformanceMetrics();
      const slowQueries = await this.getSlowQueries();
      const tables = await this.getTableAnalysis();
      const indexes = await this.getIndexAnalysis();

      // CPU Recommendations
      if (performance?.cpu_percent > 80) {
        recommendations.push({
          type: 'performance',
          severity: 'high',
          title: 'High CPU Usage',
          description: `CPU usage is at ${performance.cpu_percent}%. Consider optimizing queries or scaling resources.`,
          suggestion: 'Review slow queries and consider adding indexes'
        });
      }

      // Memory Recommendations
      if (performance?.memory_percent > 85) {
        recommendations.push({
          type: 'performance',
          severity: 'high',
          title: 'High Memory Usage',
          description: `Memory usage is at ${performance.memory_percent}%. Consider optimizing memory-intensive operations.`,
          suggestion: 'Review query plans and consider memory optimization'
        });
      }

      // Slow Query Recommendations
      if (slowQueries.length > 0) {
        recommendations.push({
          type: 'query',
          severity: 'medium',
          title: 'Slow Queries Detected',
          description: `Found ${slowQueries.length} slow queries affecting performance.`,
          suggestion: 'Review and optimize slow queries, consider adding indexes'
        });
      }

      // Index Recommendations
      const unusedIndexes = indexes.filter(idx => idx.status === 'Unused');
      if (unusedIndexes.length > 0) {
        recommendations.push({
          type: 'index',
          severity: 'low',
          title: 'Unused Indexes',
          description: `Found ${unusedIndexes.length} unused indexes consuming space.`,
          suggestion: 'Consider dropping unused indexes to save space'
        });
      }

      // Large Table Recommendations
      const largeTables = tables.filter(table => table.size_kb > 100000); // >100MB
      if (largeTables.length > 0) {
        recommendations.push({
          type: 'storage',
          severity: 'medium',
          title: 'Large Tables Detected',
          description: `Found ${largeTables.length} tables larger than 100MB.`,
          suggestion: 'Consider partitioning or archiving old data'
        });
      }

      return recommendations;
    } catch (error) {
      logger.error('Error generating recommendations:', error);
      return [];
    }
  }

  async updateMetrics() {
    try {
      const [performance, slowQueries, tables, indexes, recommendations] = await Promise.all([
        this.getPerformanceMetrics(),
        this.getSlowQueries(),
        this.getTableAnalysis(),
        this.getIndexAnalysis(),
        this.generateRecommendations()
      ]);

      this.metrics = {
        connectionStatus: this.isConnected ? 'connected' : 'disconnected',
        lastUpdated: new Date(),
        performance,
        queries: slowQueries,
        tables,
        indexes,
        recommendations
      };

      // Broadcast to all connected clients
      this.broadcastMetrics();
    } catch (error) {
      logger.error('Error updating metrics:', error);
    }
  }

  broadcastMetrics() {
    const message = JSON.stringify({
      type: 'metrics',
      data: this.metrics
    });

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  startPerformanceMonitoring() {
    // Update metrics every 30 seconds
    setInterval(() => {
      this.updateMetrics();
    }, 30000);

    // Initial update
    this.updateMetrics();
  }

  startHealthChecks() {
    // Health check every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      try {
        if (!this.isConnected) {
          await this.initialize();
        } else {
          // Simple connectivity test
          const request = new sql.Request(this.pool);
          await request.query('SELECT 1');
        }
      } catch (error) {
        logger.error('Health check failed:', error);
        this.isConnected = false;
        this.metrics.connectionStatus = 'error';
      }
    });
  }

  addClient(ws) {
    this.clients.add(ws);
    
    // Send current metrics to new client
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'metrics',
        data: this.metrics
      }));
    }
  }

  removeClient(ws) {
    this.clients.delete(ws);
  }
}

// Initialize monitor
const monitor = new MSSQLMonitor();

// WebSocket connections
wss.on('connection', (ws) => {
  logger.info('Client connected to MSSQL monitor');
  monitor.addClient(ws);

  ws.on('close', () => {
    logger.info('Client disconnected from MSSQL monitor');
    monitor.removeClient(ws);
  });

  ws.on('error', (error) => {
    logger.error('WebSocket error:', error);
    monitor.removeClient(ws);
  });
});

// REST API Endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    database_connected: monitor.isConnected
  });
});

app.get('/metrics', (req, res) => {
  res.json(monitor.metrics);
});

app.post('/test-connection', async (req, res) => {
  try {
    const { server, database, user, password } = req.body;
    
    const testConfig = {
      ...dbConfig,
      server: server || dbConfig.server,
      database: database || dbConfig.database,
      user: user || dbConfig.user,
      password: password || dbConfig.password
    };

    const testPool = new sql.ConnectionPool(testConfig);
    await testPool.connect();
    await testPool.close();

    res.json({ success: true, message: 'Connection successful' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

const PORT = process.env.PORT || 8002;

server.listen(PORT, () => {
  logger.info(`MSSQL Service running on port ${PORT}`);
  monitor.initialize();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  if (monitor.pool) {
    await monitor.pool.close();
  }
  server.close(() => {
    logger.info('Process terminated');
  });
});