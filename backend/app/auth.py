"""Authentication utilities for gRPC server."""
from typing import Optional
import logging
import grpc

from app import config

logger = logging.getLogger(__name__)


def extract_token_from_metadata(metadata) -> Optional[str]:
    """Extract Bearer token from gRPC metadata."""
    if not metadata:
        return None
    
    for key, value in metadata:
        if key.lower() == "authorization":
            if value.startswith("Bearer "):
                return value[7:]
    
    return None


def validate_token(metadata) -> bool:
    """
    Validate token from metadata.
    
    If API_TOKEN is empty, allow all requests (demo mode).
    If API_TOKEN is set, require valid token.
    """
    if not config.REQUIRE_AUTH:
        return True
    
    token = extract_token_from_metadata(metadata)
    if not token:
        logger.warning("Missing authorization token")
        return False
    
    if token != config.API_TOKEN:
        logger.warning("Invalid authorization token")
        return False
    
    return True


async def auth_interceptor(continuation, client_details, request):
    """
    gRPC server interceptor for token validation.
    
    Raises RpcError with UNAUTHENTICATED if token is invalid.
    """
    if not validate_token(client_details.invocation_metadata):
        raise grpc.RpcError(
            grpc.StatusCode.UNAUTHENTICATED,
            "Invalid or missing authorization token"
        )
    
    return await continuation(client_details, request)


def extract_token_from_header(header_value: Optional[str]) -> Optional[str]:
    """Extract Bearer token from HTTP Authorization header."""
    if not header_value:
        return None
    if header_value.startswith("Bearer "):
        return header_value[7:]
    return None


def validate_http_token(header_value: Optional[str]) -> bool:
    """Validate token for HTTP bridge requests."""
    if not config.REQUIRE_AUTH:
        return True
    token = extract_token_from_header(header_value)
    if not token:
        logger.warning("Missing authorization header (HTTP bridge)")
        return False
    if token != config.API_TOKEN:
        logger.warning("Invalid authorization token (HTTP bridge)")
        return False
    return True
