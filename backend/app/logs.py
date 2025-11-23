"""Log collection and streaming module."""
import asyncio
import logging
import subprocess
import platform
from typing import AsyncGenerator, List, Optional, Dict
from datetime import datetime
import re

logger = logging.getLogger(__name__)


class LogCollector:
    """Collects system logs from various sources."""
    
    def __init__(self):
        """Initialize log collector based on platform."""
        self.platform = platform.system()
        self.log_buffer: List[Dict] = []
        self.max_buffer_size = 1000
        
    def get_system_logs(self, level: Optional[str] = None, 
                       pattern: Optional[str] = None,
                       max_lines: int = 100) -> List[Dict]:
        """
        Get system logs.
        
        Args:
            level: Filter by log level (ERROR, WARNING, INFO, DEBUG)
            pattern: Search pattern in messages
            max_lines: Maximum number of lines to return
            
        Returns:
            List of log entries
        """
        logs = []
        
        try:
            if self.platform == "Darwin":  # macOS
                logs = self._get_macos_logs(level, pattern, max_lines)
            elif self.platform == "Linux":
                logs = self._get_linux_logs(level, pattern, max_lines)
            elif self.platform == "Windows":
                logs = self._get_windows_logs(level, pattern, max_lines)
            else:
                logger.warning(f"Log collection not implemented for {self.platform}")
                
        except Exception as e:
            logger.error(f"Error collecting logs: {e}", exc_info=True)
        
        return logs
    
    def _get_macos_logs(self, level: Optional[str], 
                        pattern: Optional[str],
                        max_lines: int) -> List[Dict]:
        """Get logs from macOS using log command."""
        logs = []
        
        try:
            # Construir comando log
            cmd = ["log", "show", "--predicate", "eventMessage != nil", 
                   "--style", "syslog", "--last", "5m"]
            
            if level:
                level_map = {
                    "ERROR": "error",
                    "WARNING": "fault",
                    "INFO": "info",
                    "DEBUG": "debug"
                }
                log_level = level_map.get(level.upper(), "info")
                cmd.extend(["--level", log_level])
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode == 0:
                lines = result.stdout.strip().split('\n')
                for line in lines[:max_lines]:
                    if not line.strip():
                        continue
                    
                    log_entry = self._parse_macos_log(line)
                    if log_entry:
                        # Filtrar por patrón si se especifica
                        if pattern and pattern.lower() not in log_entry['message'].lower():
                            continue
                        logs.append(log_entry)
                        
        except subprocess.TimeoutExpired:
            logger.warning("Log collection timed out")
        except FileNotFoundError:
            logger.debug("log command not available")
        except Exception as e:
            logger.warning(f"Error getting macOS logs: {e}")
        
        return logs
    
    def _get_linux_logs(self, level: Optional[str],
                        pattern: Optional[str],
                        max_lines: int) -> List[Dict]:
        """Get logs from Linux using journalctl or syslog."""
        logs = []
        
        try:
            # Intentar usar journalctl primero (systemd)
            cmd = ["journalctl", "--no-pager", "-n", str(max_lines), 
                   "--since", "5 minutes ago"]
            
            if level:
                level_map = {
                    "ERROR": "3",
                    "WARNING": "4",
                    "INFO": "6",
                    "DEBUG": "7"
                }
                priority = level_map.get(level.upper(), "6")
                cmd.extend(["-p", priority])
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode == 0:
                lines = result.stdout.strip().split('\n')
                for line in lines:
                    if not line.strip():
                        continue
                    
                    log_entry = self._parse_linux_log(line)
                    if log_entry:
                        if pattern and pattern.lower() not in log_entry['message'].lower():
                            continue
                        logs.append(log_entry)
            else:
                # Fallback a syslog
                logs = self._get_syslog_logs(level, pattern, max_lines)
                
        except FileNotFoundError:
            # Intentar syslog directo
            logs = self._get_syslog_logs(level, pattern, max_lines)
        except Exception as e:
            logger.warning(f"Error getting Linux logs: {e}")
        
        return logs
    
    def _get_syslog_logs(self, level: Optional[str],
                         pattern: Optional[str],
                         max_lines: int) -> List[Dict]:
        """Get logs from /var/log/syslog or similar."""
        logs = []
        
        try:
            log_files = [
                "/var/log/syslog",
                "/var/log/messages",
                "/var/log/system.log"
            ]
            
            for log_file in log_files:
                try:
                    with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                        lines = f.readlines()
                        # Tomar últimas líneas
                        for line in lines[-max_lines:]:
                            log_entry = self._parse_syslog_line(line)
                            if log_entry:
                                if level and log_entry['level'] != level.upper():
                                    continue
                                if pattern and pattern.lower() not in log_entry['message'].lower():
                                    continue
                                logs.append(log_entry)
                        break
                except (FileNotFoundError, PermissionError):
                    continue
                    
        except Exception as e:
            logger.warning(f"Error reading syslog: {e}")
        
        return logs
    
    def _get_windows_logs(self, level: Optional[str],
                         pattern: Optional[str],
                         max_lines: int) -> List[Dict]:
        """Get logs from Windows Event Log."""
        logs = []
        
        try:
            # Usar PowerShell para obtener eventos
            ps_cmd = f"""
            Get-EventLog -LogName Application,System -Newest {max_lines} |
            Select-Object TimeGenerated, EntryType, Source, Message |
            ConvertTo-Json
            """
            
            result = subprocess.run(
                ["powershell", "-Command", ps_cmd],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode == 0:
                # Parsear JSON (simplificado)
                # En producción, usaría json.loads
                pass
                
        except Exception as e:
            logger.warning(f"Error getting Windows logs: {e}")
        
        return logs
    
    def _parse_macos_log(self, line: str) -> Optional[Dict]:
        """Parse macOS log line."""
        try:
            # Formato: timestamp hostname process[pid]: level: message
            parts = line.split(':', 3)
            if len(parts) < 4:
                return None
            
            timestamp_str = parts[0]
            process_info = parts[1]
            level_str = parts[2].strip()
            message = parts[3].strip()
            
            # Extraer nivel
            level = "INFO"
            if "error" in level_str.lower() or "fault" in level_str.lower():
                level = "ERROR"
            elif "warning" in level_str.lower():
                level = "WARNING"
            elif "debug" in level_str.lower():
                level = "DEBUG"
            
            # Parsear timestamp (simplificado)
            timestamp = datetime.now()
            try:
                timestamp = datetime.fromisoformat(timestamp_str.replace(' ', 'T'))
            except:
                pass
            
            return {
                "timestamp": timestamp,
                "level": level,
                "source": process_info,
                "message": message
            }
        except Exception as e:
            logger.debug(f"Error parsing macOS log: {e}")
            return None
    
    def _parse_linux_log(self, line: str) -> Optional[Dict]:
        """Parse journalctl log line."""
        try:
            # Formato: timestamp hostname process[pid]: message
            # O formato journalctl con más estructura
            parts = line.split(':', 2)
            if len(parts) < 3:
                return None
            
            timestamp_str = parts[0]
            process_info = parts[1]
            message = parts[2].strip()
            
            # Detectar nivel del mensaje
            level = "INFO"
            if "error" in message.lower() or "err" in message.lower():
                level = "ERROR"
            elif "warn" in message.lower():
                level = "WARNING"
            elif "debug" in message.lower():
                level = "DEBUG"
            
            timestamp = datetime.now()
            try:
                # Intentar parsear timestamp de journalctl
                timestamp = datetime.fromisoformat(timestamp_str.replace(' ', 'T'))
            except:
                pass
            
            return {
                "timestamp": timestamp,
                "level": level,
                "source": process_info,
                "message": message
            }
        except Exception as e:
            logger.debug(f"Error parsing Linux log: {e}")
            return None
    
    def _parse_syslog_line(self, line: str) -> Optional[Dict]:
        """Parse syslog line."""
        try:
            # Formato estándar syslog
            # timestamp hostname process: message
            parts = line.split(':', 2)
            if len(parts) < 3:
                return None
            
            header = parts[0]
            message = parts[2].strip()
            
            # Extraer nivel
            level = "INFO"
            if "error" in message.lower() or "err" in message.lower():
                level = "ERROR"
            elif "warn" in message.lower():
                level = "WARNING"
            
            timestamp = datetime.now()
            
            return {
                "timestamp": timestamp,
                "level": level,
                "source": header,
                "message": message
            }
        except Exception as e:
            logger.debug(f"Error parsing syslog: {e}")
            return None
    
    async def stream_logs(self, agent_id: str, level: Optional[str] = None,
                         pattern: Optional[str] = None,
                         follow: bool = True) -> AsyncGenerator[Dict, None]:
        """
        Stream logs continuously.
        
        Args:
            agent_id: ID of the agent
            level: Filter by log level
            pattern: Search pattern
            follow: Continue streaming new logs
            
        Yields:
            Log entries as dictionaries
        """
        # Enviar logs históricos primero
        historical_logs = self.get_system_logs(level, pattern, max_lines=100)
        for log_entry in historical_logs:
            log_entry['agent_id'] = agent_id
            yield log_entry
        
        if not follow:
            return
        
        # Stream nuevos logs
        last_check = datetime.now()
        while True:
            await asyncio.sleep(1)  # Check every second
            
            current_logs = self.get_system_logs(level, pattern, max_lines=50)
            
            # Filtrar logs nuevos (después de last_check)
            for log_entry in current_logs:
                if log_entry['timestamp'] > last_check:
                    log_entry['agent_id'] = agent_id
                    yield log_entry
            
            last_check = datetime.now()

