# Multi-stage build for backend
FROM python:3.11-slim as builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy proto files and generate stubs
COPY proto/ proto/
# Create output package directory for generated stubs
RUN mkdir -p app \
    && python -m grpc_tools.protoc -I proto --python_out=app --grpc_python_out=app proto/metrics.proto

# Runtime stage
FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
# Ensure both /app and /app/app are on sys.path so generated imports like
# `import metrics_pb2` (unqualified) resolve to /app/app/metrics_pb2.py
ENV PYTHONPATH="/app/app:/app"

COPY --from=builder /build/app/ app/
COPY app/ app/
COPY proto/ proto/
COPY tests/ tests/

# Expose both gRPC and HTTP bridge ports
EXPOSE 50051 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import socket; socket.socket().connect(('localhost', 50051))" || exit 1

# Run server
CMD ["python", "-m", "app.server"]
