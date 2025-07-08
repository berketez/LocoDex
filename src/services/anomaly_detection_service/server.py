import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import pandas as pd
from collections import defaultdict, deque
import redis.asyncio as aioredis
import httpx
from contextlib import asynccontextmanager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class MetricData(BaseModel):
    service: str
    metric_name: str
    value: float
    timestamp: datetime
    metadata: Optional[Dict[str, Any]] = None

class AnomalyAlert(BaseModel):
    id: str
    service: str
    metric_name: str
    severity: str  # 'critical', 'warning', 'info'
    message: str
    value: float
    expected_range: Dict[str, float]
    timestamp: datetime
    anomaly_score: float
    metadata: Optional[Dict[str, Any]] = None

class AnomalyDetector:
    """AI-powered anomaly detection using multiple algorithms"""
    
    def __init__(self, window_size: int = 100, sensitivity: float = 0.95):
        self.window_size = window_size
        self.sensitivity = sensitivity
        self.data_windows = defaultdict(lambda: deque(maxlen=window_size))
        self.baselines = defaultdict(dict)
        self.alert_cooldown = defaultdict(lambda: defaultdict(datetime))
        self.cooldown_period = timedelta(minutes=5)
        
    def update_baseline(self, service: str, metric: str, value: float):
        """Update baseline statistics for a metric"""
        key = f"{service}:{metric}"
        self.data_windows[key].append(value)
        
        if len(self.data_windows[key]) >= 10:  # Minimum data points
            data = list(self.data_windows[key])
            self.baselines[key] = {
                'mean': np.mean(data),
                'std': np.std(data),
                'median': np.median(data),
                'q1': np.percentile(data, 25),
                'q3': np.percentile(data, 75),
                'min': np.min(data),
                'max': np.max(data)
            }
    
    def detect_statistical_anomaly(self, service: str, metric: str, value: float) -> Optional[Dict]:
        """Statistical anomaly detection using Z-score and IQR"""
        key = f"{service}:{metric}"
        baseline = self.baselines.get(key)
        
        if not baseline or baseline['std'] == 0:
            return None
            
        # Z-score method
        z_score = abs((value - baseline['mean']) / baseline['std'])
        z_threshold = 2.5  # 99% confidence
        
        # IQR method
        iqr = baseline['q3'] - baseline['q1']
        iqr_lower = baseline['q1'] - 1.5 * iqr
        iqr_upper = baseline['q3'] + 1.5 * iqr
        
        anomaly_detected = False
        anomaly_type = []
        severity = 'info'
        
        if z_score > z_threshold:
            anomaly_detected = True
            anomaly_type.append('z_score')
            severity = 'warning' if z_score > 3 else 'info'
            
        if value < iqr_lower or value > iqr_upper:
            anomaly_detected = True
            anomaly_type.append('iqr')
            if value < baseline['min'] * 0.5 or value > baseline['max'] * 1.5:
                severity = 'critical'
        
        if anomaly_detected:
            return {
                'anomaly_score': min(z_score / 3.0, 1.0),
                'severity': severity,
                'methods': anomaly_type,
                'baseline': baseline,
                'z_score': z_score
            }
        
        return None
    
    def detect_ml_anomaly(self, service: str, metric: str, value: float) -> Optional[Dict]:
        """ML-based anomaly detection using Isolation Forest"""
        try:
            from sklearn.ensemble import IsolationForest
            
            key = f"{service}:{metric}"
            if len(self.data_windows[key]) < 50:  # Need enough data
                return None
                
            data = np.array(list(self.data_windows[key])).reshape(-1, 1)
            
            # Train Isolation Forest
            clf = IsolationForest(contamination=0.1, random_state=42)
            clf.fit(data)
            
            # Predict anomaly
            prediction = clf.predict([[value]])[0]
            anomaly_score = clf.decision_function([[value]])[0]
            
            if prediction == -1:  # Anomaly detected
                # Normalize score to 0-1
                score = max(0, min(1, (-anomaly_score + 0.5) * 2))
                severity = 'critical' if score > 0.8 else 'warning' if score > 0.6 else 'info'
                
                return {
                    'anomaly_score': score,
                    'severity': severity,
                    'methods': ['isolation_forest'],
                    'prediction': prediction,
                    'decision_score': anomaly_score
                }
        except Exception as e:
            logger.error(f"ML anomaly detection error: {e}")
            
        return None
    
    def should_alert(self, service: str, metric: str, severity: str) -> bool:
        """Check if enough time has passed since last alert"""
        key = f"{service}:{metric}:{severity}"
        last_alert = self.alert_cooldown[service].get(key)
        
        if not last_alert:
            return True
            
        return datetime.now() - last_alert > self.cooldown_period
    
    def record_alert(self, service: str, metric: str, severity: str):
        """Record alert timestamp for cooldown"""
        key = f"{service}:{metric}:{severity}"
        self.alert_cooldown[service][key] = datetime.now()

class AnomalyDetectionService:
    """Main anomaly detection service"""
    
    def __init__(self):
        self.detector = AnomalyDetector()
        self.clients = set()
        self.redis = None
        self.data_sources = {
            'mssql': 'http://localhost:8002/metrics',
            'deep_research': 'http://localhost:8001/health',
            'system': 'http://localhost:3001/health'
        }
        self.monitoring_active = False
        
    async def initialize_redis(self):
        """Initialize Redis connection for data persistence"""
        try:
            self.redis = aioredis.from_url(
                "redis://localhost:6379",
                password=os.getenv("REDIS_PASSWORD", "default_insecure_password"),
                decode_responses=True
            )
            await self.redis.ping()
            logger.info("Redis connection established")
        except Exception as e:
            logger.error(f"Redis connection failed: {e}")
            self.redis = None
    
    async def collect_mssql_metrics(self) -> List[MetricData]:
        """Collect MSSQL performance metrics"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(self.data_sources['mssql'], timeout=5.0)
                if response.status_code == 200:
                    data = response.json()
                    metrics = []
                    
                    if data.get('performance'):
                        perf = data['performance']
                        timestamp = datetime.now()
                        
                        metrics.extend([
                            MetricData(
                                service='mssql',
                                metric_name='cpu_percent',
                                value=float(perf.get('cpu_percent', 0)),
                                timestamp=timestamp,
                                metadata={'source': 'mssql_monitor'}
                            ),
                            MetricData(
                                service='mssql',
                                metric_name='memory_percent',
                                value=float(perf.get('memory_percent', 0)),
                                timestamp=timestamp,
                                metadata={'source': 'mssql_monitor'}
                            ),
                            MetricData(
                                service='mssql',
                                metric_name='active_connections',
                                value=float(perf.get('active_connections', 0)),
                                timestamp=timestamp,
                                metadata={'source': 'mssql_monitor'}
                            ),
                            MetricData(
                                service='mssql',
                                metric_name='database_size_mb',
                                value=float(perf.get('database_size_mb', 0)),
                                timestamp=timestamp,
                                metadata={'source': 'mssql_monitor'}
                            )
                        ])
                    
                    return metrics
        except Exception as e:
            logger.error(f"Failed to collect MSSQL metrics: {e}")
        
        return []
    
    async def collect_system_metrics(self) -> List[MetricData]:
        """Collect system performance metrics"""
        try:
            # Get Docker container stats
            import docker
            client = docker.from_env()
            timestamp = datetime.now()
            metrics = []
            
            for container in client.containers.list():
                if 'locodex' in container.name:
                    stats = container.stats(stream=False)
                    
                    # CPU usage
                    cpu_delta = stats['cpu_stats']['cpu_usage']['total_usage'] - \
                               stats['precpu_stats']['cpu_usage']['total_usage']
                    system_delta = stats['cpu_stats']['system_cpu_usage'] - \
                                  stats['precpu_stats']['system_cpu_usage']
                    
                    if system_delta > 0:
                        cpu_percent = (cpu_delta / system_delta) * 100.0
                        metrics.append(MetricData(
                            service='docker',
                            metric_name=f'{container.name}_cpu_percent',
                            value=cpu_percent,
                            timestamp=timestamp,
                            metadata={'container': container.name}
                        ))
                    
                    # Memory usage
                    mem_usage = stats['memory_stats']['usage']
                    mem_limit = stats['memory_stats']['limit']
                    mem_percent = (mem_usage / mem_limit) * 100.0
                    
                    metrics.append(MetricData(
                        service='docker',
                        metric_name=f'{container.name}_memory_percent',
                        value=mem_percent,
                        timestamp=timestamp,
                        metadata={'container': container.name}
                    ))
            
            return metrics
        except Exception as e:
            logger.error(f"Failed to collect system metrics: {e}")
        
        return []
    
    async def process_metrics(self, metrics: List[MetricData]):
        """Process metrics and detect anomalies"""
        alerts = []
        
        for metric in metrics:
            # Update baseline
            self.detector.update_baseline(
                metric.service, 
                metric.metric_name, 
                metric.value
            )
            
            # Detect anomalies
            stat_anomaly = self.detector.detect_statistical_anomaly(
                metric.service, 
                metric.metric_name, 
                metric.value
            )
            
            ml_anomaly = self.detector.detect_ml_anomaly(
                metric.service, 
                metric.metric_name, 
                metric.value
            )
            
            # Process anomalies
            anomaly = stat_anomaly or ml_anomaly
            if anomaly and self.detector.should_alert(
                metric.service, 
                metric.metric_name, 
                anomaly['severity']
            ):
                alert = AnomalyAlert(
                    id=f"{metric.service}_{metric.metric_name}_{int(metric.timestamp.timestamp())}",
                    service=metric.service,
                    metric_name=metric.metric_name,
                    severity=anomaly['severity'],
                    message=self.generate_alert_message(metric, anomaly),
                    value=metric.value,
                    expected_range=self.get_expected_range(metric.service, metric.metric_name),
                    timestamp=metric.timestamp,
                    anomaly_score=anomaly['anomaly_score'],
                    metadata={
                        'methods': anomaly.get('methods', []),
                        'baseline': anomaly.get('baseline'),
                        **dict(metric.metadata or {})
                    }
                )
                
                alerts.append(alert)
                self.detector.record_alert(
                    metric.service, 
                    metric.metric_name, 
                    anomaly['severity']
                )
                
                # Store alert in Redis
                if self.redis:
                    await self.redis.lpush(
                        'anomaly_alerts', 
                        alert.model_dump_json()
                    )
                    await self.redis.ltrim('anomaly_alerts', 0, 999)  # Keep last 1000
        
        # Broadcast alerts to connected clients
        if alerts:
            await self.broadcast_alerts(alerts)
    
    def generate_alert_message(self, metric: MetricData, anomaly: Dict) -> str:
        """Generate human-readable alert message"""
        severity_emoji = {
            'critical': '🚨',
            'warning': '⚠️',
            'info': 'ℹ️'
        }
        
        emoji = severity_emoji.get(anomaly['severity'], '📊')
        
        return f"{emoji} {metric.service.upper()} anomaly detected: " \
               f"{metric.metric_name} = {metric.value:.2f} " \
               f"(score: {anomaly['anomaly_score']:.2f})"
    
    def get_expected_range(self, service: str, metric: str) -> Dict[str, float]:
        """Get expected range for a metric"""
        key = f"{service}:{metric}"
        baseline = self.detector.baselines.get(key, {})
        
        return {
            'min': baseline.get('q1', 0) - 1.5 * (baseline.get('q3', 0) - baseline.get('q1', 0)),
            'max': baseline.get('q3', 0) + 1.5 * (baseline.get('q3', 0) - baseline.get('q1', 0)),
            'mean': baseline.get('mean', 0),
            'std': baseline.get('std', 0)
        }
    
    async def broadcast_alerts(self, alerts: List[AnomalyAlert]):
        """Broadcast alerts to all connected WebSocket clients"""
        if not self.clients:
            return
            
        message = {
            'type': 'anomaly_alerts',
            'alerts': [alert.model_dump() for alert in alerts],
            'timestamp': datetime.now().isoformat()
        }
        
        disconnected_clients = set()
        for client in self.clients:
            try:
                await client.send_text(json.dumps(message, default=str))
            except Exception as e:
                logger.error(f"Failed to send alert to client: {e}")
                disconnected_clients.add(client)
        
        # Remove disconnected clients
        self.clients -= disconnected_clients
    
    async def monitoring_loop(self):
        """Main monitoring loop"""
        logger.info("Starting anomaly detection monitoring loop")
        self.monitoring_active = True
        
        while self.monitoring_active:
            try:
                # Collect metrics from all sources
                all_metrics = []
                
                # MSSQL metrics
                mssql_metrics = await self.collect_mssql_metrics()
                all_metrics.extend(mssql_metrics)
                
                # System metrics
                system_metrics = await self.collect_system_metrics()
                all_metrics.extend(system_metrics)
                
                # Process metrics and detect anomalies
                if all_metrics:
                    await self.process_metrics(all_metrics)
                
                # Wait before next collection
                await asyncio.sleep(30)  # Check every 30 seconds
                
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                await asyncio.sleep(60)  # Wait longer on error
    
    def add_client(self, websocket: WebSocket):
        """Add WebSocket client"""
        self.clients.add(websocket)
        logger.info(f"Client connected. Total clients: {len(self.clients)}")
    
    def remove_client(self, websocket: WebSocket):
        """Remove WebSocket client"""
        self.clients.discard(websocket)
        logger.info(f"Client disconnected. Total clients: {len(self.clients)}")
    
    async def get_recent_alerts(self, limit: int = 50) -> List[Dict]:
        """Get recent alerts from Redis"""
        if not self.redis:
            return []
            
        try:
            alerts = await self.redis.lrange('anomaly_alerts', 0, limit - 1)
            return [json.loads(alert) for alert in alerts]
        except Exception as e:
            logger.error(f"Failed to get recent alerts: {e}")
            return []

# Initialize service
anomaly_service = AnomalyDetectionService()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    await anomaly_service.initialize_redis()
    
    # Start monitoring loop
    monitoring_task = asyncio.create_task(anomaly_service.monitoring_loop())
    
    yield
    
    # Shutdown
    anomaly_service.monitoring_active = False
    monitoring_task.cancel()
    
    if anomaly_service.redis:
        await anomaly_service.redis.close()

# Create FastAPI app
app = FastAPI(
    title="LocoDex Anomaly Detection Service",
    description="AI-powered anomaly detection for all LocoDex systems",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now(),
        "monitoring_active": anomaly_service.monitoring_active,
        "connected_clients": len(anomaly_service.clients),
        "redis_connected": anomaly_service.redis is not None
    }

@app.get("/alerts")
async def get_alerts(limit: int = 50):
    """Get recent anomaly alerts"""
    alerts = await anomaly_service.get_recent_alerts(limit)
    return {
        "alerts": alerts,
        "count": len(alerts),
        "timestamp": datetime.now()
    }

@app.get("/metrics/baselines")
async def get_baselines():
    """Get current baseline statistics"""
    return {
        "baselines": dict(anomaly_service.detector.baselines),
        "data_points": {
            key: len(window) 
            for key, window in anomaly_service.detector.data_windows.items()
        },
        "timestamp": datetime.now()
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time alerts"""
    await websocket.accept()
    anomaly_service.add_client(websocket)
    
    try:
        # Send current status
        await websocket.send_text(json.dumps({
            "type": "status",
            "monitoring_active": anomaly_service.monitoring_active,
            "timestamp": datetime.now().isoformat()
        }, default=str))
        
        # Keep connection alive
        while True:
            await websocket.receive_text()
            
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        anomaly_service.remove_client(websocket)

if __name__ == "__main__":
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=8003,
        reload=True,
        log_level="info"
    )