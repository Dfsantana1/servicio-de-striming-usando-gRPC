"""Utility functions for the gRPC server."""
import socket


def get_local_hostname() -> str:
    """Get the local hostname."""
    try:
        return socket.gethostname()
    except Exception:
        return "unknown"
