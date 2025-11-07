"""Metrics collection module using psutil."""
import psutil
import time
from typing import Tuple, List, Dict
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class ProcessSnapshot:
    """Lightweight process snapshot for top N processes."""
    pid: int
    name: str
    cpu_percent: float
    memory_bytes: int


class MetricsCollector:
    """Collects system metrics with delta calculations for network I/O."""
    
    def __init__(self):
        """Initialize collector with baseline network counters."""
        self.last_net_io = psutil.net_io_counters()
        self.last_timestamp = time.time()
    
    def get_cpu_percent(self) -> float:
        """Get overall CPU percentage (1-second interval)."""
        return psutil.cpu_percent(interval=0.1)
    
    def get_cpu_times(self) -> Tuple[float, float, float]:
        """Get CPU times (user, system, idle) as percentages."""
        times = psutil.cpu_times_percent(interval=0.1)
        return (times.user, times.system, times.idle)
    
    def get_memory_info(self) -> Tuple[float, int, int]:
        """
        Get memory info.
        
        Returns:
            (memory_percent, memory_used_bytes, memory_total_bytes)
        """
        vm = psutil.virtual_memory()
        return (vm.percent, vm.used, vm.total)
    
    def get_load_average(self) -> Tuple[float, float, float]:
        """Get load average (1m, 5m, 15m)."""
        try:
            load1, load5, load15 = psutil.getloadavg()
            return (load1, load5, load15)
        except AttributeError:
            # Windows doesn't support getloadavg()
            logger.warning("Load average not available on this platform")
            return (0.0, 0.0, 0.0)
    
    def get_disk_usage(self) -> List[Dict[str, any]]:
        """Get disk usage for all mounted partitions."""
        disks = []
        try:
            for partition in psutil.disk_partitions(all=False):
                try:
                    usage = psutil.disk_usage(partition.mountpoint)
                    disks.append({
                        "mount": partition.mountpoint,
                        "total": usage.total,
                        "used": usage.used,
                        "free": usage.free,
                    })
                except (OSError, PermissionError):
                    # Some mountpoints may be inaccessible
                    pass
        except Exception as e:
            logger.warning(f"Error collecting disk usage: {e}")
        
        return disks
    
    def get_network_io_delta(self) -> Tuple[int, int]:
        """
        Get network I/O delta (bytes sent, bytes received) since last call.
        
        Returns:
            (bytes_sent_delta, bytes_received_delta)
        """
        current_net_io = psutil.net_io_counters()
        current_timestamp = time.time()
        
        sent_delta = current_net_io.bytes_sent - self.last_net_io.bytes_sent
        recv_delta = current_net_io.bytes_recv - self.last_net_io.bytes_recv
        
        # Update baselines
        self.last_net_io = current_net_io
        self.last_timestamp = current_timestamp
        
        return (sent_delta, recv_delta)
    
    def get_top_processes(self, n: int = 10) -> List[ProcessSnapshot]:
        """
        Get top N processes by CPU usage.
        
        Args:
            n: Number of processes to return
        
        Returns:
            List of ProcessSnapshot ordered by CPU usage (descending)
        """
        processes = []
        
        try:
            for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_info']):
                try:
                    proc_info = proc.as_dict(attrs=['pid', 'name', 'cpu_percent', 'memory_info'])
                    
                    # Skip processes with None values
                    if proc_info['cpu_percent'] is None or proc_info['memory_info'] is None:
                        continue
                    
                    processes.append(
                        ProcessSnapshot(
                            pid=proc_info['pid'],
                            name=proc_info['name'],
                            cpu_percent=proc_info['cpu_percent'],
                            memory_bytes=proc_info['memory_info'].rss
                        )
                    )
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    pass
        except Exception as e:
            logger.warning(f"Error collecting processes: {e}")
        
        # Sort by CPU usage and return top N
        processes.sort(key=lambda p: p.cpu_percent, reverse=True)
        return processes[:n]
    
    def get_full_snapshot(self, agent_id: str, n_procs: int = 10) -> Dict:
        """
        Collect a complete metrics snapshot.
        
        Args:
            agent_id: ID of the agent
            n_procs: Number of top processes to include
        
        Returns:
            Dict with all metrics ready to be converted to protobuf
        """
        timestamp_ms = int(time.time() * 1000)
        cpu_percent = self.get_cpu_percent()
        cpu_user, cpu_system, cpu_idle = self.get_cpu_times()
        memory_percent, memory_used, memory_total = self.get_memory_info()
        load_1m, load_5m, load_15m = self.get_load_average()
        disks = self.get_disk_usage()
        bytes_sent, bytes_recv = self.get_network_io_delta()
        top_procs = self.get_top_processes(n_procs)
        
        return {
            "agent_id": agent_id,
            "timestamp_unix_ms": timestamp_ms,
            "cpu_percent": cpu_percent,
            "cpu_times": {
                "user": cpu_user,
                "system": cpu_system,
                "idle": cpu_idle,
            },
            "memory_percent": memory_percent,
            "memory_total": memory_total,
            "memory_used": memory_used,
            "load_1m": load_1m,
            "load_5m": load_5m,
            "load_15m": load_15m,
            "disks": disks,
            "net": {
                "bytes_sent": bytes_sent,
                "bytes_recv": bytes_recv,
            },
            "top_processes": [
                {
                    "pid": p.pid,
                    "name": p.name,
                    "cpu_percent": p.cpu_percent,
                    "memory_bytes": p.memory_bytes,
                }
                for p in top_procs
            ],
        }
