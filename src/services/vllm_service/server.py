#!/usr/bin/env python3
"""
LocoDex vLLM Service
High-performance inference server using vLLM
"""

import asyncio
import json
import logging
import os
import time
import traceback
from contextlib import asynccontextmanager
from typing import Dict, List, Optional, Union, Any
from pathlib import Path

import psutil
import redis
import structlog
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field
from prometheus_client import Counter, Histogram, Gauge, generate_latest
import uvicorn

try:
    from vllm import LLM, SamplingParams
    from vllm.model_executor.parallel_utils.parallel_state import destroy_model_parallel
    VLLM_AVAILABLE = True
except ImportError:
    print("vLLM not available. Running in mock mode.")
    VLLM_AVAILABLE = False

# Configure logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)
logger = structlog.get_logger()

# Prometheus metrics
REQUEST_COUNT = Counter('vllm_requests_total', 'Total requests', ['method', 'endpoint'])
REQUEST_DURATION = Histogram('vllm_request_duration_seconds', 'Request duration')
ACTIVE_REQUESTS = Gauge('vllm_active_requests', 'Active requests')
MODEL_LOAD_TIME = Gauge('vllm_model_load_time_seconds', 'Model load time')
GPU_MEMORY_USAGE = Gauge('vllm_gpu_memory_usage_bytes', 'GPU memory usage')

# Global model instance
llm_engine: Optional[LLM] = None
current_model_path: Optional[str] = None
model_config: Dict[str, Any] = {}

# Redis connection
redis_client: Optional[redis.Redis] = None

# Pydantic models
class ModelConfig(BaseModel):
    model_path: str = Field(..., description="Path to model directory or HuggingFace model name")
    tensor_parallel_size: int = Field(default=1, description="Number of GPUs to use")
    max_model_len: Optional[int] = Field(default=None, description="Maximum model length")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    top_p: float = Field(default=0.9, ge=0.0, le=1.0)
    top_k: int = Field(default=-1, ge=-1)
    max_tokens: int = Field(default=1024, ge=1, le=4096)
    trust_remote_code: bool = Field(default=False)
    gpu_memory_utilization: float = Field(default=0.85, ge=0.1, le=1.0)
    enforce_eager: bool = Field(default=False)
    quantization: Optional[str] = Field(default=None, description="Quantization method")

class ChatMessage(BaseModel):
    role: str = Field(..., description="Message role: user, assistant, or system")
    content: str = Field(..., description="Message content")

class ChatCompletionRequest(BaseModel):
    model: str = Field(..., description="Model name")
    messages: List[ChatMessage] = Field(..., description="List of messages")
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    top_p: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    top_k: Optional[int] = Field(default=None, ge=-1)
    max_tokens: Optional[int] = Field(default=None, ge=1, le=4096)
    stream: bool = Field(default=False, description="Enable streaming response")
    stop: Optional[Union[str, List[str]]] = Field(default=None)

class CompletionRequest(BaseModel):
    model: str = Field(..., description="Model name")
    prompt: str = Field(..., description="Input prompt")
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    top_p: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    top_k: Optional[int] = Field(default=None, ge=-1)
    max_tokens: Optional[int] = Field(default=None, ge=1, le=4096)
    stream: bool = Field(default=False)
    stop: Optional[Union[str, List[str]]] = Field(default=None)

class ModelLoadRequest(BaseModel):
    config: ModelConfig

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    current_model: Optional[str]
    gpu_count: int
    memory_usage: Dict[str, float]
    uptime: float

# Utility functions
def get_system_stats() -> Dict[str, Any]:
    """Get current system statistics"""
    memory = psutil.virtual_memory()
    cpu_percent = psutil.cpu_percent(interval=1)
    
    stats = {
        "cpu_percent": cpu_percent,
        "memory_percent": memory.percent,
        "memory_available": memory.available,
        "memory_total": memory.total,
        "disk_usage": {},
        "gpu_count": 0,
        "gpu_memory": []
    }
    
    # Add disk usage for current directory
    disk_usage = psutil.disk_usage('/')
    stats["disk_usage"] = {
        "total": disk_usage.total,
        "used": disk_usage.used,
        "free": disk_usage.free,
        "percent": (disk_usage.used / disk_usage.total) * 100
    }
    
    # Try to get GPU stats if available
    try:
        import torch
        if torch.cuda.is_available():
            stats["gpu_count"] = torch.cuda.device_count()
            for i in range(torch.cuda.device_count()):
                gpu_memory = torch.cuda.get_device_properties(i).total_memory
                gpu_allocated = torch.cuda.memory_allocated(i)
                stats["gpu_memory"].append({
                    "device": i,
                    "total": gpu_memory,
                    "allocated": gpu_allocated,
                    "free": gpu_memory - gpu_allocated,
                    "percent": (gpu_allocated / gpu_memory) * 100
                })
    except Exception as e:
        logger.warning("Could not get GPU stats", error=str(e))
    
    return stats

async def load_model(config: ModelConfig) -> bool:
    """Load vLLM model with given configuration"""
    global llm_engine, current_model_path, model_config
    
    if not VLLM_AVAILABLE:
        logger.warning("vLLM not available, cannot load model")
        return False
    
    try:
        start_time = time.time()
        logger.info("Loading model", model_path=config.model_path)
        
        # Unload current model if exists
        if llm_engine is not None:
            logger.info("Unloading current model")
            del llm_engine
            destroy_model_parallel()
            llm_engine = None
        
        # Convert config to dict for vLLM
        vllm_kwargs = {
            "model": config.model_path,
            "tensor_parallel_size": config.tensor_parallel_size,
            "trust_remote_code": config.trust_remote_code,
            "gpu_memory_utilization": config.gpu_memory_utilization,
            "enforce_eager": config.enforce_eager,
        }
        
        if config.max_model_len:
            vllm_kwargs["max_model_len"] = config.max_model_len
        
        if config.quantization:
            vllm_kwargs["quantization"] = config.quantization
        
        # Initialize vLLM engine
        llm_engine = LLM(**vllm_kwargs)
        current_model_path = config.model_path
        model_config = config.dict()
        
        load_time = time.time() - start_time
        MODEL_LOAD_TIME.set(load_time)
        
        logger.info("Model loaded successfully", 
                   model_path=config.model_path, 
                   load_time=load_time)
        
        return True
        
    except Exception as e:
        logger.error("Failed to load model", 
                    model_path=config.model_path, 
                    error=str(e),
                    traceback=traceback.format_exc())
        return False

def create_sampling_params(request: Union[ChatCompletionRequest, CompletionRequest]) -> SamplingParams:
    """Create vLLM sampling parameters from request"""
    params = {
        "temperature": request.temperature or model_config.get("temperature", 0.7),
        "top_p": request.top_p or model_config.get("top_p", 0.9),
        "max_tokens": request.max_tokens or model_config.get("max_tokens", 1024),
    }
    
    if request.top_k is not None:
        params["top_k"] = request.top_k
    elif "top_k" in model_config and model_config["top_k"] > 0:
        params["top_k"] = model_config["top_k"]
    
    if request.stop:
        params["stop"] = request.stop if isinstance(request.stop, list) else [request.stop]
    
    return SamplingParams(**params)

def messages_to_prompt(messages: List[ChatMessage]) -> str:
    """Convert chat messages to a single prompt string"""
    prompt_parts = []
    
    for message in messages:
        if message.role == "system":
            prompt_parts.append(f"<|system|>\n{message.content}\n<|end|>")
        elif message.role == "user":
            prompt_parts.append(f"<|user|>\n{message.content}\n<|end|>")
        elif message.role == "assistant":
            prompt_parts.append(f"<|assistant|>\n{message.content}\n<|end|>")
    
    # Add assistant prompt start
    prompt_parts.append("<|assistant|>\n")
    
    return "\n".join(prompt_parts)

# Initialize Redis connection
def init_redis():
    """Initialize Redis connection"""
    global redis_client
    try:
        redis_host = os.getenv("REDIS_HOST", "redis")
        redis_port = int(os.getenv("REDIS_PORT", "6379"))
        redis_password = os.getenv("REDIS_PASSWORD")
        
        redis_client = redis.Redis(
            host=redis_host,
            port=redis_port,
            password=redis_password,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5
        )
        redis_client.ping()
        logger.info("Redis connection established")
    except Exception as e:
        logger.warning("Redis connection failed", error=str(e))
        redis_client = None

# Startup and shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle management"""
    logger.info("Starting vLLM service")
    init_redis()
    
    # Auto-load model if configured
    auto_load_model = os.getenv("AUTO_LOAD_MODEL")
    if auto_load_model:
        config = ModelConfig(model_path=auto_load_model)
        await load_model(config)
    
    yield
    
    logger.info("Shutting down vLLM service")
    global llm_engine
    if llm_engine:
        del llm_engine
        destroy_model_parallel()

# Create FastAPI app
app = FastAPI(
    title="LocoDex vLLM Service",
    description="High-performance LLM inference using vLLM",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    stats = get_system_stats()
    
    return HealthResponse(
        status="healthy",
        model_loaded=llm_engine is not None,
        current_model=current_model_path,
        gpu_count=stats["gpu_count"],
        memory_usage={
            "cpu_percent": stats["cpu_percent"],
            "memory_percent": stats["memory_percent"],
            "gpu_memory": stats["gpu_memory"]
        },
        uptime=time.time() - start_time
    )

@app.get("/models")
async def list_models():
    """List available models"""
    models = []
    
    if current_model_path:
        models.append({
            "id": current_model_path,
            "object": "model",
            "created": int(time.time()),
            "owned_by": "vllm",
            "status": "loaded" if llm_engine else "unloaded",
            "config": model_config
        })
    
    return {"object": "list", "data": models}

@app.post("/models/load")
async def load_model_endpoint(request: ModelLoadRequest, background_tasks: BackgroundTasks):
    """Load a model"""
    REQUEST_COUNT.labels(method="POST", endpoint="/models/load").inc()
    
    if not VLLM_AVAILABLE:
        raise HTTPException(status_code=500, detail="vLLM not available")
    
    # Load model in background
    success = await load_model(request.config)
    
    if success:
        return {"status": "success", "message": f"Model {request.config.model_path} loaded successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to load model")

@app.post("/models/unload")
async def unload_model():
    """Unload current model"""
    global llm_engine, current_model_path, model_config
    
    if llm_engine:
        del llm_engine
        destroy_model_parallel()
        llm_engine = None
        current_model_path = None
        model_config = {}
        return {"status": "success", "message": "Model unloaded"}
    else:
        return {"status": "info", "message": "No model currently loaded"}

@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest):
    """OpenAI-compatible chat completions endpoint"""
    REQUEST_COUNT.labels(method="POST", endpoint="/v1/chat/completions").inc()
    ACTIVE_REQUESTS.inc()
    
    try:
        if not llm_engine:
            raise HTTPException(status_code=400, detail="No model loaded")
        
        if not VLLM_AVAILABLE:
            # Mock response for testing
            return {
                "id": f"chatcmpl-{int(time.time())}",
                "object": "chat.completion",
                "created": int(time.time()),
                "model": request.model,
                "choices": [{
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": f"Mock response to: {request.messages[-1].content}"
                    },
                    "finish_reason": "stop"
                }],
                "usage": {
                    "prompt_tokens": 10,
                    "completion_tokens": 10,
                    "total_tokens": 20
                }
            }
        
        # Convert messages to prompt
        prompt = messages_to_prompt(request.messages)
        sampling_params = create_sampling_params(request)
        
        # Generate response
        with REQUEST_DURATION.time():
            outputs = llm_engine.generate([prompt], sampling_params)
        
        response_text = outputs[0].outputs[0].text
        
        return {
            "id": f"chatcmpl-{int(time.time())}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": request.model,
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": response_text
                },
                "finish_reason": "stop"
            }],
            "usage": {
                "prompt_tokens": len(outputs[0].prompt_token_ids),
                "completion_tokens": len(outputs[0].outputs[0].token_ids),
                "total_tokens": len(outputs[0].prompt_token_ids) + len(outputs[0].outputs[0].token_ids)
            }
        }
        
    except Exception as e:
        logger.error("Chat completion failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        ACTIVE_REQUESTS.dec()

@app.post("/v1/completions")
async def completions(request: CompletionRequest):
    """OpenAI-compatible completions endpoint"""
    REQUEST_COUNT.labels(method="POST", endpoint="/v1/completions").inc()
    ACTIVE_REQUESTS.inc()
    
    try:
        if not llm_engine:
            raise HTTPException(status_code=400, detail="No model loaded")
        
        if not VLLM_AVAILABLE:
            # Mock response for testing
            return {
                "id": f"cmpl-{int(time.time())}",
                "object": "text_completion",
                "created": int(time.time()),
                "model": request.model,
                "choices": [{
                    "index": 0,
                    "text": f"Mock completion for: {request.prompt[:50]}...",
                    "finish_reason": "stop"
                }],
                "usage": {
                    "prompt_tokens": 10,
                    "completion_tokens": 10,
                    "total_tokens": 20
                }
            }
        
        sampling_params = create_sampling_params(request)
        
        # Generate response
        with REQUEST_DURATION.time():
            outputs = llm_engine.generate([request.prompt], sampling_params)
        
        response_text = outputs[0].outputs[0].text
        
        return {
            "id": f"cmpl-{int(time.time())}",
            "object": "text_completion",
            "created": int(time.time()),
            "model": request.model,
            "choices": [{
                "index": 0,
                "text": response_text,
                "finish_reason": "stop"
            }],
            "usage": {
                "prompt_tokens": len(outputs[0].prompt_token_ids),
                "completion_tokens": len(outputs[0].outputs[0].token_ids),
                "total_tokens": len(outputs[0].prompt_token_ids) + len(outputs[0].outputs[0].token_ids)
            }
        }
        
    except Exception as e:
        logger.error("Completion failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        ACTIVE_REQUESTS.dec()

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return Response(generate_latest(), media_type="text/plain")

@app.get("/stats")
async def get_stats():
    """Get detailed system statistics"""
    stats = get_system_stats()
    
    # Add vLLM specific stats
    stats.update({
        "vllm": {
            "model_loaded": llm_engine is not None,
            "current_model": current_model_path,
            "model_config": model_config,
            "available": VLLM_AVAILABLE
        }
    })
    
    return stats

# Global startup time
start_time = time.time()

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    
    uvicorn.run(
        "server:app",
        host=host,
        port=port,
        reload=False,
        log_level="info"
    )