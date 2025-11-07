"""gRPC server for metrics streaming."""
import asyncio
import logging
import sys
from typing import AsyncGenerator, Any

import grpc
from grpc import aio

# Import generated stubs (created via protoc)
from app import config, metrics_pb2, metrics_pb2_grpc
from app.metrics import MetricsCollector
from app.auth import validate_token, validate_http_token
from app import utils

try:
    from aiohttp import web
except Exception:  # pragma: no cover
    web = None

# Configure logging
logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class MetricsServicer(metrics_pb2_grpc.MetricsServiceServicer):
    """Implementation of MetricsService."""
    
    def __init__(self):
        """Initialize the servicer."""
        self.collector = MetricsCollector()
    
    async def StreamMetrics(
        self,
        request: metrics_pb2.StreamRequest,
        context: grpc.aio.ServicerContext
    ) -> AsyncGenerator[metrics_pb2.MetricsResponse, None]:
        """
        Server-side streaming RPC for metrics.
        
        Emits metrics snapshots at the requested interval.
        """
        # Validate authentication
        metadata = context.invocation_metadata()
        if not validate_token(metadata):
            await context.abort(grpc.StatusCode.UNAUTHENTICATED, "Invalid token")
        
        # Validate and bound interval
        interval_ms = config.validate_interval(request.interval_ms)
        interval_sec = interval_ms / 1000.0
        
        logger.info(
            f"StreamMetrics started: agent_id={request.agent_id}, "
            f"interval_ms={interval_ms}"
        )
        
        try:
            # Stream metrics continuously
            while True:
                # Check if client cancelled
                if context.cancelled():
                    logger.info("StreamMetrics stream cancelled by client")
                    break
                
                # Collect snapshot
                snapshot_dict = self.collector.get_full_snapshot(
                    agent_id=config.AGENT_ID,
                    n_procs=config.TOP_N_PROCS
                )
                
                # Convert dict to protobuf message
                response = self._dict_to_response(snapshot_dict)
                
                # Yield to client
                yield response
                
                # Sleep before next emission
                await asyncio.sleep(interval_sec)
        
        except asyncio.CancelledError:
            logger.info("StreamMetrics stream cancelled (asyncio)")
            raise
        except Exception as e:
            logger.error(f"Error in StreamMetrics: {e}", exc_info=True)
            await context.abort(grpc.StatusCode.INTERNAL, str(e))
    
    async def ListAgents(
        self,
        request: metrics_pb2.Empty,
        context: grpc.aio.ServicerContext
    ) -> metrics_pb2.AgentsList:
        """List available agents."""
        # Validate authentication
        metadata = context.invocation_metadata()
        if not validate_token(metadata):
            await context.abort(grpc.StatusCode.UNAUTHENTICATED, "Invalid token")
        
        hostname = config.HOSTNAME
        if hostname == "localhost":
            hostname = utils.get_local_hostname()
        
        agent = metrics_pb2.Agent(
            agent_id=config.AGENT_ID,
            hostname=hostname
        )
        
        logger.info(f"ListAgents: returning {config.AGENT_ID}")
        return metrics_pb2.AgentsList(agents=[agent])
    
    @staticmethod
    def _dict_to_response(snapshot_dict: dict) -> metrics_pb2.MetricsResponse:
        """Convert collected snapshot dict to protobuf response."""
        # Create CPU times message
        cpu_times = metrics_pb2.CpuTimes(
            user=snapshot_dict["cpu_times"]["user"],
            system=snapshot_dict["cpu_times"]["system"],
            idle=snapshot_dict["cpu_times"]["idle"],
        )
        
        # Create disk messages
        disks = [
            metrics_pb2.DiskUsage(
                mount=d["mount"],
                total=d["total"],
                used=d["used"],
                free=d["free"],
            )
            for d in snapshot_dict["disks"]
        ]
        
        # Create network usage message
        net = metrics_pb2.NetUsage(
            bytes_sent=snapshot_dict["net"]["bytes_sent"],
            bytes_recv=snapshot_dict["net"]["bytes_recv"],
        )
        
        # Create process info messages
        processes = [
            metrics_pb2.ProcessInfo(
                pid=p["pid"],
                name=p["name"],
                cpu_percent=p["cpu_percent"],
                memory_bytes=p["memory_bytes"],
            )
            for p in snapshot_dict["top_processes"]
        ]
        
        # Create metrics snapshot
        snapshot = metrics_pb2.MetricsSnapshot(
            agent_id=snapshot_dict["agent_id"],
            timestamp_unix_ms=snapshot_dict["timestamp_unix_ms"],
            cpu_percent=snapshot_dict["cpu_percent"],
            cpu_times=cpu_times,
            memory_percent=snapshot_dict["memory_percent"],
            memory_total=snapshot_dict["memory_total"],
            memory_used=snapshot_dict["memory_used"],
            load_1m=snapshot_dict["load_1m"],
            load_5m=snapshot_dict["load_5m"],
            load_15m=snapshot_dict["load_15m"],
            disks=disks,
            net=net,
            top_processes=processes,
        )
        
        return metrics_pb2.MetricsResponse(snapshot=snapshot)


async def serve():
    """Start the gRPC server."""
    # Create async server
    server = aio.server()
    
    # Add servicer
    servicer = MetricsServicer()
    metrics_pb2_grpc.add_MetricsServiceServicer_to_server(servicer, server)
    
    # Bind to port
    port = f"[::]:{config.GRPC_PORT}"
    server.add_insecure_port(port)
    
    logger.info(f"Starting gRPC server on {port}")
    logger.info(f"Agent ID: {config.AGENT_ID}")
    logger.info(f"Auth required: {config.REQUIRE_AUTH}")
    
    await server.start()
    logger.info("gRPC server started successfully")
    
    async def run_http_bridge():
        if not config.ENABLE_HTTP_BRIDGE:
            return
        if web is None:
            logger.warning("aiohttp not available; HTTP bridge disabled")
            return

        app = web.Application()
        async def list_agents_handler(request: Any):
            if not validate_http_token(request.headers.get("Authorization")):
                return web.json_response({"error": "unauthenticated"}, status=401)
            hostname = config.HOSTNAME if config.HOSTNAME != "localhost" else utils.get_local_hostname()
            agent = {"agent_id": config.AGENT_ID, "hostname": hostname}
            return web.json_response({"agents": [agent]})

        async def stream_metrics_handler(request: Any):
            if not validate_http_token(request.headers.get("Authorization")):
                return web.json_response({"error": "unauthenticated"}, status=401)

            payload = await request.json()
            interval_ms = config.validate_interval(int(payload.get("interval_ms", config.INTERVAL_DEFAULT_MS)))
            interval = interval_ms / 1000.0

            response = web.StreamResponse(
                status=200,
                reason='OK',
                headers={
                    'Content-Type': 'application/x-ndjson',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                }
            )
            await response.prepare(request)

            try:
                while True:
                    snapshot_dict = servicer.collector.get_full_snapshot(
                        agent_id=config.AGENT_ID,
                        n_procs=config.TOP_N_PROCS,
                    )
                    import json
                    data = json.dumps({"snapshot": snapshot_dict}) + "\n"
                    await response.write(data.encode('utf-8'))
                    await asyncio.sleep(interval)
            except (asyncio.CancelledError, ConnectionResetError):
                pass
            finally:
                await response.write_eof()
            return response

        app.router.add_post('/metrics.MetricsService/ListAgents', list_agents_handler)
        app.router.add_post('/metrics.MetricsService/StreamMetrics', stream_metrics_handler)

        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, host='0.0.0.0', port=config.HTTP_BRIDGE_PORT)
        logger.info(f"HTTP bridge started on 0.0.0.0:{config.HTTP_BRIDGE_PORT}")
        await site.start()

    # Run gRPC server and optional HTTP bridge together
    await run_http_bridge()

    try:
        await server.wait_for_termination()
    except KeyboardInterrupt:
        logger.info("Shutting down gRPC server...")
        await server.stop(grace=5)


def main():
    """Entry point for the server."""
    try:
        asyncio.run(serve())
    except KeyboardInterrupt:
        logger.info("Server interrupted")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
