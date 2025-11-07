"""Configuration module for gRPC metrics server."""
import os

# Server config
GRPC_PORT = int(os.getenv("GRPC_PORT", 50051))
AGENT_ID = os.getenv("AGENT_ID", "agent-default")
HOSTNAME = os.getenv("HOSTNAME", "localhost")

# Optional HTTP bridge (for simplified frontend streaming)
ENABLE_HTTP_BRIDGE = os.getenv("ENABLE_HTTP_BRIDGE", "1") in {"1", "true", "True"}
HTTP_BRIDGE_PORT = int(os.getenv("HTTP_BRIDGE_PORT", 8000))

# Metrics collection config
INTERVAL_DEFAULT_MS = int(os.getenv("INTERVAL_DEFAULT_MS", 1000))
INTERVAL_MIN_MS = int(os.getenv("INTERVAL_MIN_MS", 250))
INTERVAL_MAX_MS = int(os.getenv("INTERVAL_MAX_MS", 60000))
TOP_N_PROCS = int(os.getenv("TOP_N_PROCS", 10))

# Security config
API_TOKEN = os.getenv("API_TOKEN", "")  # Empty = no authentication required
REQUIRE_AUTH = bool(API_TOKEN)

# Logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# Validate interval bounds
def validate_interval(interval_ms: int) -> int:
    """Ensure interval is within acceptable bounds."""
    return max(INTERVAL_MIN_MS, min(interval_ms, INTERVAL_MAX_MS))
