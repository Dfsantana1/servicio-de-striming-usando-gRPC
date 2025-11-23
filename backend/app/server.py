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
from app.logs import LogCollector
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
        self.log_collector = LogCollector()
    
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
    
    async def StreamLogs(
        self,
        request: metrics_pb2.LogRequest,
        context: grpc.aio.ServicerContext
    ) -> AsyncGenerator[metrics_pb2.LogEntry, None]:
        """
        Server-side streaming RPC for system logs.
        
        Streams log entries in real-time with optional filtering.
        """
        # Validate authentication
        metadata = context.invocation_metadata()
        if not validate_token(metadata):
            await context.abort(grpc.StatusCode.UNAUTHENTICATED, "Invalid token")
        
        # Check if agent_id matches (if specified)
        if request.agent_id and request.agent_id != config.AGENT_ID:
            await context.abort(
                grpc.StatusCode.NOT_FOUND,
                f"Agent {request.agent_id} not found"
            )
        
        logger.info(
            f"StreamLogs started: agent_id={request.agent_id or 'all'}, "
            f"level={request.level or 'all'}, pattern={request.pattern or 'none'}, "
            f"follow={request.follow}"
        )
        
        try:
            async for log_dict in self.log_collector.stream_logs(
                agent_id=config.AGENT_ID,
                level=request.level if request.level else None,
                pattern=request.pattern if request.pattern else None,
                follow=request.follow
            ):
                # Check if client cancelled
                if context.cancelled():
                    logger.info("StreamLogs stream cancelled by client")
                    break
                
                # Convert dict to protobuf message
                log_entry = metrics_pb2.LogEntry(
                    agent_id=log_dict.get("agent_id", config.AGENT_ID),
                    timestamp_unix_ms=int(log_dict["timestamp"].timestamp() * 1000),
                    level=log_dict.get("level", "INFO"),
                    source=log_dict.get("source", "system"),
                    message=log_dict.get("message", ""),
                )
                
                # Add metadata if present
                if "metadata" in log_dict:
                    for key, value in log_dict["metadata"].items():
                        log_entry.metadata[key] = value
                
                yield log_entry
        
        except asyncio.CancelledError:
            logger.info("StreamLogs stream cancelled (asyncio)")
            raise
        except Exception as e:
            logger.error(f"Error in StreamLogs: {e}", exc_info=True)
            await context.abort(grpc.StatusCode.INTERNAL, str(e))
    
    @staticmethod
    def _dict_to_response(snapshot_dict: dict) -> metrics_pb2.MetricsResponse:
        """Convert collected snapshot dict to protobuf response."""
        # Create CPU times message
        cpu_times_dict = snapshot_dict.get("cpu_times", {})
        cpu_times = metrics_pb2.CpuTimes(
            user=cpu_times_dict.get("user", 0.0),
            system=cpu_times_dict.get("system", 0.0),
            idle=cpu_times_dict.get("idle", 0.0),
            nice=cpu_times_dict.get("nice", 0.0),
            iowait=cpu_times_dict.get("iowait", 0.0),
            irq=cpu_times_dict.get("irq", 0.0),
            softirq=cpu_times_dict.get("softirq", 0.0),
            steal=cpu_times_dict.get("steal", 0.0),
        )
        
        # Create CPU per core messages
        cpu_per_core = []
        for core in snapshot_dict.get("cpu_per_core", []):
            core_times_dict = core.get("cpu_times", {})
            core_times = metrics_pb2.CpuTimes(
                user=core_times_dict.get("user", 0.0),
                system=core_times_dict.get("system", 0.0),
                idle=core_times_dict.get("idle", 0.0),
                nice=core_times_dict.get("nice", 0.0),
                iowait=core_times_dict.get("iowait", 0.0),
                irq=core_times_dict.get("irq", 0.0),
                softirq=core_times_dict.get("softirq", 0.0),
                steal=core_times_dict.get("steal", 0.0),
            )
            cpu_per_core.append(
                metrics_pb2.CpuPerCore(
                    core_id=core.get("core_id", 0),
                    cpu_percent=core.get("cpu_percent", 0.0),
                    cpu_times=core_times,
                )
            )
        
        # Create disk messages
        disks = []
        for d in snapshot_dict.get("disks", []):
            disks.append(
                metrics_pb2.DiskUsage(
                    mount=d.get("mount", ""),
                    device=d.get("device", ""),
                    fstype=d.get("fstype", ""),
                    total=d.get("total", 0),
                    used=d.get("used", 0),
                    free=d.get("free", 0),
                    percent=d.get("percent", 0.0),
                    read_bytes=d.get("read_bytes", 0),
                    write_bytes=d.get("write_bytes", 0),
                    read_count=d.get("read_count", 0),
                    write_count=d.get("write_count", 0),
                )
            )
        
        # Create network interfaces
        net_interfaces = []
        for iface in snapshot_dict.get("net", {}).get("interfaces", []):
            net_interfaces.append(
                metrics_pb2.NetInterface(
                    name=iface.get("name", ""),
                    bytes_sent=iface.get("bytes_sent", 0),
                    bytes_recv=iface.get("bytes_recv", 0),
                    packets_sent=iface.get("packets_sent", 0),
                    packets_recv=iface.get("packets_recv", 0),
                    is_up=iface.get("is_up", False),
                )
            )
        
        # Create network usage message
        net_dict = snapshot_dict.get("net", {})
        net = metrics_pb2.NetUsage(
            bytes_sent=net_dict.get("bytes_sent", 0),
            bytes_recv=net_dict.get("bytes_recv", 0),
            packets_sent=net_dict.get("packets_sent", 0),
            packets_recv=net_dict.get("packets_recv", 0),
            errin=net_dict.get("errin", 0),
            errout=net_dict.get("errout", 0),
            dropin=net_dict.get("dropin", 0),
            dropout=net_dict.get("dropout", 0),
            interfaces=net_interfaces,
        )
        
        # Create swap info
        swap_dict = snapshot_dict.get("swap", {})
        swap = metrics_pb2.SwapInfo(
            total=swap_dict.get("total", 0),
            used=swap_dict.get("used", 0),
            free=swap_dict.get("free", 0),
            percent=swap_dict.get("percent", 0.0),
            sin=swap_dict.get("sin", 0),
            sout=swap_dict.get("sout", 0),
        )
        
        # Create temperature info
        temps = []
        for temp in snapshot_dict.get("sensors", {}).get("temperatures", []):
            temps.append(
                metrics_pb2.TemperatureInfo(
                    label=temp.get("label", ""),
                    current=temp.get("current", 0.0),
                    high=temp.get("high", 0.0),
                    critical=temp.get("critical", 0.0),
                )
            )
        
        # Create sensor info
        sensors_dict = snapshot_dict.get("sensors", {})
        sensors = metrics_pb2.SensorInfo(
            temperatures=temps,
            battery_percent=sensors_dict.get("battery_percent", -1.0),
            power_plugged=sensors_dict.get("power_plugged", False),
        )
        
        # Create process info messages
        processes = []
        for p in snapshot_dict.get("top_processes", []):
            processes.append(
                metrics_pb2.ProcessInfo(
                    pid=p.get("pid", 0),
                    name=p.get("name", ""),
                    username=p.get("username", ""),
                    cpu_percent=p.get("cpu_percent", 0.0),
                    memory_bytes=p.get("memory_bytes", 0),
                    memory_percent=p.get("memory_percent", 0.0),
                    status=p.get("status", ""),
                    create_time=p.get("create_time", 0),
                    num_threads=p.get("num_threads", 0),
                    exe_path=p.get("exe_path", ""),
                )
            )
        
        # Create metrics snapshot
        snapshot = metrics_pb2.MetricsSnapshot(
            agent_id=snapshot_dict.get("agent_id", ""),
            timestamp_unix_ms=snapshot_dict.get("timestamp_unix_ms", 0),
            cpu_percent=snapshot_dict.get("cpu_percent", 0.0),
            cpu_times=cpu_times,
            cpu_count=snapshot_dict.get("cpu_count", 0),
            cpu_count_logical=snapshot_dict.get("cpu_count_logical", 0),
            cpu_per_core=cpu_per_core,
            cpu_freq_current=snapshot_dict.get("cpu_freq_current", 0.0),
            cpu_freq_min=snapshot_dict.get("cpu_freq_min", 0.0),
            cpu_freq_max=snapshot_dict.get("cpu_freq_max", 0.0),
            memory_percent=snapshot_dict.get("memory_percent", 0.0),
            memory_total=snapshot_dict.get("memory_total", 0),
            memory_used=snapshot_dict.get("memory_used", 0),
            memory_available=snapshot_dict.get("memory_available", 0),
            memory_free=snapshot_dict.get("memory_free", 0),
            memory_cached=snapshot_dict.get("memory_cached", 0),
            memory_buffers=snapshot_dict.get("memory_buffers", 0),
            swap=swap,
            load_1m=snapshot_dict.get("load_1m", 0.0),
            load_5m=snapshot_dict.get("load_5m", 0.0),
            load_15m=snapshot_dict.get("load_15m", 0.0),
            disks=disks,
            net=net,
            top_processes=processes,
            process_count=snapshot_dict.get("process_count", 0),
            process_count_running=snapshot_dict.get("process_count_running", 0),
            process_count_sleeping=snapshot_dict.get("process_count_sleeping", 0),
            process_count_zombie=snapshot_dict.get("process_count_zombie", 0),
            uptime_seconds=snapshot_dict.get("uptime_seconds", 0),
            boot_time=snapshot_dict.get("boot_time", ""),
            platform=snapshot_dict.get("platform", ""),
            platform_version=snapshot_dict.get("platform_version", ""),
            hostname=snapshot_dict.get("hostname", ""),
            sensors=sensors,
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

        try:
            runner = web.AppRunner(app)
            await runner.setup()
            site = web.TCPSite(runner, host='0.0.0.0', port=config.HTTP_BRIDGE_PORT)
            await site.start()
            logger.info(f"HTTP bridge started on 0.0.0.0:{config.HTTP_BRIDGE_PORT}")
        except OSError as e:
            if e.errno == 48:  # Address already in use
                logger.warning(
                    f"HTTP bridge port {config.HTTP_BRIDGE_PORT} is already in use. "
                    f"HTTP bridge disabled. gRPC server continues on port {config.GRPC_PORT}."
                )
                logger.info(f"To free the port, run: lsof -ti :{config.HTTP_BRIDGE_PORT} | xargs kill")
                logger.info(f"Or set HTTP_BRIDGE_PORT to a different port (e.g., export HTTP_BRIDGE_PORT=8001)")
            else:
                logger.error(f"Failed to start HTTP bridge: {e}")
                raise
        except Exception as e:
            logger.error(f"Failed to start HTTP bridge: {e}")
            logger.warning("Continuing with gRPC server only...")

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
