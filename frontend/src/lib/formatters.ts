/**
 * Utility functions for formatting metrics data
 */

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function formatBytesPerSecond(bytes: number): string {
  return formatBytes(bytes) + '/s';
}

export function formatCPU(percent: number): string {
  return Math.round(percent * 10) / 10 + '%';
}

export function formatMemory(percent: number): string {
  return Math.round(percent * 10) / 10 + '%';
}

export function formatLoad(load: number): string {
  return (Math.round(load * 100) / 100).toString();
}

export function formatProcessName(name: string): string {
  // Truncate long process names
  if (name.length > 30) {
    return name.substring(0, 27) + '...';
  }
  return name;
}

export function formatTimestamp(unixMs: number): string {
  const date = new Date(unixMs);
  return date.toLocaleTimeString();
}

export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  return `${hours}h`;
}

export function cpuTrendIcon(current: number, previous: number): string {
  if (previous === 0) return '→';
  if (current > previous) return '↑';
  if (current < previous) return '↓';
  return '→';
}

export function cpuTrendColor(current: number, previous: number): string {
  if (previous === 0) return 'text-muted-foreground';
  if (current > previous) return 'text-red-500';
  if (current < previous) return 'text-green-500';
  return 'text-muted-foreground';
}
