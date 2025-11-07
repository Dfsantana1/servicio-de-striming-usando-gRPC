import { useMemo, useState } from 'react';
import { useMetricsStore } from '../lib/store';
import { formatProcessName } from '../lib/formatters';

export function ProcessTable() {
  const { snapshots } = useMetricsStore();
  const [sortBy, setSortBy] = useState<'cpu' | 'memory'>('cpu');

  const processes = useMemo(() => {
    if (snapshots.length === 0) return [];
    
    const current = snapshots[snapshots.length - 1];
    const procs = [...current.top_processes];
    
    if (sortBy === 'memory') {
      procs.sort((a, b) => b.memory_bytes - a.memory_bytes);
    } else {
      procs.sort((a, b) => b.cpu_percent - a.cpu_percent);
    }
    
    return procs;
  }, [snapshots, sortBy]);

  if (snapshots.length === 0) {
    return (
      <div className="w-full bg-card rounded-lg border border-border p-4">
        <h2 className="text-lg font-semibold mb-4">Procesos Top</h2>
        <p className="text-muted-foreground text-center py-8">Sin datos disponibles</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-card rounded-lg border border-border p-4 overflow-x-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Procesos Top</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setSortBy('cpu')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              sortBy === 'cpu'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            CPU
          </button>
          <button
            onClick={() => setSortBy('memory')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              sortBy === 'memory'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Memoria
          </button>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 font-semibold text-muted-foreground">PID</th>
              <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Proceso</th>
              <th className="text-right py-2 px-3 font-semibold text-muted-foreground">CPU %</th>
              <th className="text-right py-2 px-3 font-semibold text-muted-foreground">Memoria</th>
            </tr>
          </thead>
          <tbody>
            {processes.map((proc) => (
              <tr
                key={proc.pid}
                className="border-b border-border/50 hover:bg-muted/50 transition-colors"
              >
                <td className="py-3 px-3 font-mono text-foreground">{proc.pid}</td>
                <td className="py-3 px-3 truncate text-foreground">
                  {formatProcessName(proc.name)}
                </td>
                <td className="py-3 px-3 text-right font-medium text-orange-500">
                  {Math.round(proc.cpu_percent * 10) / 10}%
                </td>
                <td className="py-3 px-3 text-right font-medium text-blue-500">
                  {Math.round(proc.memory_bytes / (1024 * 1024))} MB
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
