"""Metrics collection module using psutil."""
import psutil
import time
import platform
from datetime import datetime
from typing import Tuple, List, Dict, Optional
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class ProcessSnapshot:
    """Lightweight process snapshot for top N processes."""
    pid: int
    name: str
    username: str
    cpu_percent: float
    memory_bytes: int
    memory_percent: float
    status: str
    create_time: int
    num_threads: int
    exe_path: str


class MetricsCollector:
    """Collects system metrics with delta calculations for network I/O and disk I/O."""
    
    def __init__(self):
        """Initialize collector with baseline counters."""
        self.last_net_io = psutil.net_io_counters()
        self.last_disk_io = psutil.disk_io_counters()
        self.last_timestamp = time.time()
        self.boot_time = psutil.boot_time()
    
    def get_cpu_percent(self) -> float:
        """Get overall CPU percentage (1-second interval)."""
        return psutil.cpu_percent(interval=0.1)
    
    def get_cpu_times(self) -> Dict[str, float]:
        """Get CPU times (user, system, idle, nice, iowait, irq, softirq, steal) as percentages."""
        try:
            times = psutil.cpu_times_percent(interval=0.1)
            return {
                "user": getattr(times, 'user', 0.0),
                "system": getattr(times, 'system', 0.0),
                "idle": getattr(times, 'idle', 0.0),
                "nice": getattr(times, 'nice', 0.0),
                "iowait": getattr(times, 'iowait', 0.0),
                "irq": getattr(times, 'irq', 0.0),
                "softirq": getattr(times, 'softirq', 0.0),
                "steal": getattr(times, 'steal', 0.0),
            }
        except Exception as e:
            logger.warning(f"Error getting CPU times: {e}")
            return {"user": 0.0, "system": 0.0, "idle": 0.0, "nice": 0.0, 
                   "iowait": 0.0, "irq": 0.0, "softirq": 0.0, "steal": 0.0}
    
    def get_cpu_per_core(self) -> List[Dict]:
        """Get CPU usage per core."""
        try:
            per_core = psutil.cpu_percent(interval=0.1, percpu=True)
            per_core_times = psutil.cpu_times_percent(interval=0.1, percpu=True)
            result = []
            for i, (cpu_pct, cpu_times) in enumerate(zip(per_core, per_core_times)):
                result.append({
                    "core_id": i,
                    "cpu_percent": cpu_pct,
                    "cpu_times": {
                        "user": getattr(cpu_times, 'user', 0.0),
                        "system": getattr(cpu_times, 'system', 0.0),
                        "idle": getattr(cpu_times, 'idle', 0.0),
                        "nice": getattr(cpu_times, 'nice', 0.0),
                        "iowait": getattr(cpu_times, 'iowait', 0.0),
                        "irq": getattr(cpu_times, 'irq', 0.0),
                        "softirq": getattr(cpu_times, 'softirq', 0.0),
                        "steal": getattr(cpu_times, 'steal', 0.0),
                    }
                })
            return result
        except Exception as e:
            logger.warning(f"Error getting per-core CPU: {e}")
            return []
    
    def get_cpu_freq(self) -> Dict[str, float]:
        """Get CPU frequency info."""
        try:
            freq = psutil.cpu_freq()
            if freq:
                return {
                    "current": freq.current,
                    "min": freq.min if freq.min else 0.0,
                    "max": freq.max if freq.max else 0.0,
                }
        except Exception as e:
            logger.warning(f"Error getting CPU frequency: {e}")
        return {"current": 0.0, "min": 0.0, "max": 0.0}
    
    def get_memory_info(self) -> Dict:
        """
        Get detailed memory info.
        
        Returns:
            Dict with memory metrics
        """
        vm = psutil.virtual_memory()
        return {
            "percent": vm.percent,
            "total": vm.total,
            "used": vm.used,
            "available": vm.available,
            "free": vm.free,
            "cached": getattr(vm, 'cached', 0),
            "buffers": getattr(vm, 'buffers', 0),
        }
    
    def get_swap_info(self) -> Dict:
        """Get swap memory info."""
        try:
            swap = psutil.swap_memory()
            # Get swap I/O (delta)
            swap_io = getattr(swap, 'sin', 0), getattr(swap, 'sout', 0)
            return {
                "total": swap.total,
                "used": swap.used,
                "free": swap.free,
                "percent": swap.percent,
                "sin": swap_io[0],
                "sout": swap_io[1],
            }
        except Exception as e:
            logger.warning(f"Error getting swap info: {e}")
            return {"total": 0, "used": 0, "free": 0, "percent": 0.0, "sin": 0, "sout": 0}
    
    def get_load_average(self) -> Tuple[float, float, float]:
        """Get load average (1m, 5m, 15m)."""
        try:
            load1, load5, load15 = psutil.getloadavg()
            return (load1, load5, load15)
        except AttributeError:
            # Windows doesn't support getloadavg()
            logger.warning("Load average not available on this platform")
            return (0.0, 0.0, 0.0)
    
    def get_disk_usage(self) -> List[Dict]:
        """Get disk usage for all mounted partitions with I/O stats."""
        disks = []
        try:
            current_disk_io = psutil.disk_io_counters(perdisk=True)
            if current_disk_io is None:
                current_disk_io = {}
            
            for partition in psutil.disk_partitions(all=False):
                try:
                    usage = psutil.disk_usage(partition.mountpoint)
                    device_name = partition.device.split('/')[-1] if '/' in partition.device else partition.device
                    
                    # Get I/O stats for this device (delta)
                    disk_io = current_disk_io.get(device_name)
                    read_bytes = 0
                    write_bytes = 0
                    read_count = 0
                    write_count = 0
                    
                    if disk_io:
                        last_io = self.last_disk_io.get(device_name) if isinstance(self.last_disk_io, dict) else None
                        if last_io:
                            read_bytes = disk_io.read_bytes - last_io.read_bytes
                            write_bytes = disk_io.write_bytes - last_io.write_bytes
                            read_count = disk_io.read_count - last_io.read_count
                            write_count = disk_io.write_count - last_io.write_count
                        else:
                            read_bytes = disk_io.read_bytes
                            write_bytes = disk_io.write_bytes
                            read_count = disk_io.read_count
                            write_count = disk_io.write_count
                    
                    disks.append({
                        "mount": partition.mountpoint,
                        "device": partition.device,
                        "fstype": partition.fstype,
                        "total": usage.total,
                        "used": usage.used,
                        "free": usage.free,
                        "percent": usage.percent,
                        "read_bytes": max(0, read_bytes),
                        "write_bytes": max(0, write_bytes),
                        "read_count": max(0, read_count),
                        "write_count": max(0, write_count),
                    })
                except (OSError, PermissionError):
                    # Some mountpoints may be inaccessible
                    pass
            
            # Update baseline
            self.last_disk_io = current_disk_io
        except Exception as e:
            logger.warning(f"Error collecting disk usage: {e}")
        
        return disks
    
    def get_network_io_delta(self) -> Dict:
        """
        Get network I/O delta (bytes, packets, errors) since last call.
        
        Returns:
            Dict with network metrics
        """
        current_net_io = psutil.net_io_counters()
        current_timestamp = time.time()
        
        sent_delta = max(0, current_net_io.bytes_sent - self.last_net_io.bytes_sent)
        recv_delta = max(0, current_net_io.bytes_recv - self.last_net_io.bytes_recv)
        packets_sent_delta = max(0, current_net_io.packets_sent - self.last_net_io.packets_sent)
        packets_recv_delta = max(0, current_net_io.packets_recv - self.last_net_io.packets_recv)
        errin_delta = max(0, current_net_io.errin - self.last_net_io.errin)
        errout_delta = max(0, current_net_io.errout - self.last_net_io.errout)
        dropin_delta = max(0, current_net_io.dropin - self.last_net_io.dropin)
        dropout_delta = max(0, current_net_io.dropout - self.last_net_io.dropout)
        
        # Get per-interface stats
        interfaces = []
        try:
            net_if_addrs = psutil.net_if_addrs()
            net_if_stats = psutil.net_if_stats()
            net_io_counters = psutil.net_io_counters(pernic=True)
            
            for iface_name, iface_addrs in net_if_addrs.items():
                iface_stats = net_if_stats.get(iface_name)
                iface_io = net_io_counters.get(iface_name)
                
                if iface_stats and iface_io:
                    interfaces.append({
                        "name": iface_name,
                        "bytes_sent": iface_io.bytes_sent,
                        "bytes_recv": iface_io.bytes_recv,
                        "packets_sent": iface_io.packets_sent,
                        "packets_recv": iface_io.packets_recv,
                        "is_up": iface_stats.isup,
                    })
        except Exception as e:
            logger.warning(f"Error getting network interfaces: {e}")
        
        # Update baselines
        self.last_net_io = current_net_io
        self.last_timestamp = current_timestamp
        
        return {
            "bytes_sent": sent_delta,
            "bytes_recv": recv_delta,
            "packets_sent": packets_sent_delta,
            "packets_recv": packets_recv_delta,
            "errin": errin_delta,
            "errout": errout_delta,
            "dropin": dropin_delta,
            "dropout": dropout_delta,
            "interfaces": interfaces,
        }
    
    def get_top_processes(self, n: int = 10) -> List[ProcessSnapshot]:
        """
        Get top N processes by CPU usage with detailed info.
        
        Args:
            n: Number of processes to return
        
        Returns:
            List of ProcessSnapshot ordered by CPU usage (descending)
        """
        processes = []
        
        try:
            for proc in psutil.process_iter(['pid', 'name', 'username', 'cpu_percent', 
                                            'memory_info', 'memory_percent', 'status', 
                                            'create_time', 'num_threads', 'exe']):
                try:
                    proc_info = proc.as_dict(attrs=['pid', 'name', 'username', 'cpu_percent', 
                                                   'memory_info', 'memory_percent', 'status',
                                                   'create_time', 'num_threads', 'exe'])
                    
                    # Skip processes with None values
                    if proc_info.get('cpu_percent') is None or proc_info.get('memory_info') is None:
                        continue
                    
                    processes.append(
                        ProcessSnapshot(
                            pid=proc_info['pid'],
                            name=proc_info.get('name', 'unknown'),
                            username=proc_info.get('username', 'unknown'),
                            cpu_percent=proc_info.get('cpu_percent', 0.0),
                            memory_bytes=proc_info['memory_info'].rss if proc_info.get('memory_info') else 0,
                            memory_percent=proc_info.get('memory_percent', 0.0),
                            status=proc_info.get('status', 'unknown'),
                            create_time=int(proc_info.get('create_time', 0)),
                            num_threads=proc_info.get('num_threads', 0),
                            exe_path=proc_info.get('exe', '') or '',
                        )
                    )
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    pass
        except Exception as e:
            logger.warning(f"Error collecting processes: {e}")
        
        # Sort by CPU usage and return top N
        processes.sort(key=lambda p: p.cpu_percent, reverse=True)
        return processes[:n]
    
    def get_process_counts(self) -> Dict[str, int]:
        """Get counts of processes by status."""
        try:
            statuses = {}
            for proc in psutil.process_iter(['status']):
                try:
                    status = proc.status()
                    statuses[status] = statuses.get(status, 0) + 1
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
            
            return {
                "total": len(list(psutil.pids())),
                "running": statuses.get('running', 0),
                "sleeping": statuses.get('sleeping', 0),
                "zombie": statuses.get('zombie', 0),
            }
        except Exception as e:
            logger.warning(f"Error getting process counts: {e}")
            return {"total": 0, "running": 0, "sleeping": 0, "zombie": 0}
    
    def get_temperatures(self) -> List[Dict]:
        """Get system temperatures."""
        temps = []
        try:
            sensors = psutil.sensors_temperatures()
            for name, entries in sensors.items():
                for entry in entries:
                    temps.append({
                        "label": f"{name}/{entry.label or 'temp'}",
                        "current": entry.current,
                        "high": entry.high if entry.high else 0.0,
                        "critical": entry.critical if entry.critical else 0.0,
                    })
        except Exception as e:
            logger.debug(f"Temperature sensors not available: {e}")
        return temps
    
    def get_battery_info(self) -> Dict:
        """Get battery information if available."""
        try:
            battery = psutil.sensors_battery()
            if battery:
                return {
                    "battery_percent": battery.percent if battery.percent else -1.0,
                    "power_plugged": battery.power_plugged if battery.power_plugged is not None else False,
                }
        except Exception as e:
            logger.debug(f"Battery info not available: {e}")
        return {"battery_percent": -1.0, "power_plugged": False}
    
    def get_system_info(self) -> Dict:
        """Get system information."""
        try:
            uptime = time.time() - self.boot_time
            boot_time_iso = datetime.fromtimestamp(self.boot_time).isoformat()
            
            return {
                "uptime_seconds": int(uptime),
                "boot_time": boot_time_iso,
                "platform": platform.system(),
                "platform_version": platform.version(),
                "hostname": platform.node(),
            }
        except Exception as e:
            logger.warning(f"Error getting system info: {e}")
            return {
                "uptime_seconds": 0,
                "boot_time": "",
                "platform": platform.system(),
                "platform_version": "",
                "hostname": "",
            }
    
    def get_full_snapshot(self, agent_id: str, n_procs: int = 10) -> Dict:
        """
        Collect a complete metrics snapshot with all advanced metrics.
        
        Args:
            agent_id: ID of the agent
            n_procs: Number of top processes to include
        
        Returns:
            Dict with all metrics ready to be converted to protobuf
        """
        timestamp_ms = int(time.time() * 1000)
        
        # CPU metrics
        cpu_percent = self.get_cpu_percent()
        cpu_times = self.get_cpu_times()
        cpu_per_core = self.get_cpu_per_core()
        cpu_freq = self.get_cpu_freq()
        cpu_count = psutil.cpu_count(logical=False) or 0
        cpu_count_logical = psutil.cpu_count(logical=True) or 0
        
        # Memory metrics
        memory_info = self.get_memory_info()
        swap_info = self.get_swap_info()
        
        # Load average
        load_1m, load_5m, load_15m = self.get_load_average()
        
        # Disk metrics
        disks = self.get_disk_usage()
        
        # Network metrics
        net_info = self.get_network_io_delta()
        
        # Process metrics
        top_procs = self.get_top_processes(n_procs)
        process_counts = self.get_process_counts()
        
        # System info
        system_info = self.get_system_info()
        
        # Sensors
        temperatures = self.get_temperatures()
        battery_info = self.get_battery_info()
        
        return {
            "agent_id": agent_id,
            "timestamp_unix_ms": timestamp_ms,
            
            # CPU
            "cpu_percent": cpu_percent,
            "cpu_times": cpu_times,
            "cpu_count": cpu_count,
            "cpu_count_logical": cpu_count_logical,
            "cpu_per_core": cpu_per_core,
            "cpu_freq_current": cpu_freq["current"],
            "cpu_freq_min": cpu_freq["min"],
            "cpu_freq_max": cpu_freq["max"],
            
            # Memory
            "memory_percent": memory_info["percent"],
            "memory_total": memory_info["total"],
            "memory_used": memory_info["used"],
            "memory_available": memory_info["available"],
            "memory_free": memory_info["free"],
            "memory_cached": memory_info["cached"],
            "memory_buffers": memory_info["buffers"],
            "swap": swap_info,
            
            # Load
            "load_1m": load_1m,
            "load_5m": load_5m,
            "load_15m": load_15m,
            
            # Disk
            "disks": disks,
            
            # Network
            "net": net_info,
            
            # Processes
            "top_processes": [
                {
                    "pid": p.pid,
                    "name": p.name,
                    "username": p.username,
                    "cpu_percent": p.cpu_percent,
                    "memory_bytes": p.memory_bytes,
                    "memory_percent": p.memory_percent,
                    "status": p.status,
                    "create_time": p.create_time,
                    "num_threads": p.num_threads,
                    "exe_path": p.exe_path,
                }
                for p in top_procs
            ],
            "process_count": process_counts["total"],
            "process_count_running": process_counts["running"],
            "process_count_sleeping": process_counts["sleeping"],
            "process_count_zombie": process_counts["zombie"],
            
            # System
            "uptime_seconds": system_info["uptime_seconds"],
            "boot_time": system_info["boot_time"],
            "platform": system_info["platform"],
            "platform_version": system_info["platform_version"],
            "hostname": system_info["hostname"],
            
            # Sensors
            "sensors": {
                "temperatures": temperatures,
                "battery_percent": battery_info["battery_percent"],
                "power_plugged": battery_info["power_plugged"],
            },
        }
