"""Tests for metrics collection."""
import pytest
from app.metrics import MetricsCollector


def test_metrics_collector_initialization():
    """Test collector can be initialized."""
    collector = MetricsCollector()
    assert collector is not None


def test_get_cpu_percent():
    """Test CPU percentage collection."""
    collector = MetricsCollector()
    cpu_percent = collector.get_cpu_percent()
    assert 0 <= cpu_percent <= 100


def test_get_cpu_times():
    """Test CPU times collection."""
    collector = MetricsCollector()
    user, system, idle = collector.get_cpu_times()
    assert user >= 0
    assert system >= 0
    assert idle >= 0
    # Sum should be close to 100
    assert 95 <= (user + system + idle) <= 105


def test_get_memory_info():
    """Test memory info collection."""
    collector = MetricsCollector()
    memory_percent, memory_used, memory_total = collector.get_memory_info()
    assert 0 <= memory_percent <= 100
    assert memory_used > 0
    assert memory_total > 0
    assert memory_used <= memory_total


def test_get_load_average():
    """Test load average collection."""
    collector = MetricsCollector()
    load_1m, load_5m, load_15m = collector.get_load_average()
    # On most systems, these should be >= 0
    # (Windows may return 0s)
    assert load_1m >= 0
    assert load_5m >= 0
    assert load_15m >= 0


def test_get_disk_usage():
    """Test disk usage collection."""
    collector = MetricsCollector()
    disks = collector.get_disk_usage()
    assert isinstance(disks, list)
    # Should have at least one disk
    if disks:
        disk = disks[0]
        assert "mount" in disk
        assert "total" in disk
        assert "used" in disk
        assert "free" in disk
        assert disk["total"] > 0


def test_get_network_io_delta():
    """Test network I/O delta calculation."""
    collector = MetricsCollector()
    # First call initializes baseline
    bytes_sent1, bytes_recv1 = collector.get_network_io_delta()
    assert bytes_sent1 >= 0
    assert bytes_recv1 >= 0


def test_get_top_processes():
    """Test top processes collection."""
    collector = MetricsCollector()
    procs = collector.get_top_processes(n=5)
    assert isinstance(procs, list)
    assert len(procs) <= 5
    
    if procs:
        proc = procs[0]
        assert proc.pid > 0
        assert proc.name
        assert proc.cpu_percent >= 0
        assert proc.memory_bytes >= 0


def test_get_full_snapshot():
    """Test full metrics snapshot collection."""
    collector = MetricsCollector()
    snapshot = collector.get_full_snapshot(agent_id="test-agent", n_procs=10)
    
    assert snapshot["agent_id"] == "test-agent"
    assert snapshot["timestamp_unix_ms"] > 0
    assert 0 <= snapshot["cpu_percent"] <= 100
    assert snapshot["cpu_times"]["user"] >= 0
    assert snapshot["cpu_times"]["system"] >= 0
    assert snapshot["cpu_times"]["idle"] >= 0
    assert 0 <= snapshot["memory_percent"] <= 100
    assert snapshot["memory_total"] > 0
    assert snapshot["memory_used"] > 0
    assert snapshot["load_1m"] >= 0
    assert isinstance(snapshot["disks"], list)
    assert snapshot["net"]["bytes_sent"] >= 0
    assert snapshot["net"]["bytes_recv"] >= 0
    assert isinstance(snapshot["top_processes"], list)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
