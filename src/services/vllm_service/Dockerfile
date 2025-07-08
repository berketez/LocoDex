FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies based on mode
COPY requirements*.txt ./
ARG VLLM_MODE=full
RUN if [ "$VLLM_MODE" = "light" ]; then \
        pip install --no-cache-dir -r requirements-light.txt; \
    else \
        pip install --no-cache-dir -r requirements.txt; \
    fi

# Copy application
COPY . .

# Create non-root user
RUN useradd -m -u 1001 vllm && \
    chown -R vllm:vllm /app
USER vllm

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run the application
CMD ["python", "server.py"]