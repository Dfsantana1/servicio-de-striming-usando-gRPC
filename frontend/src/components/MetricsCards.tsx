import { useMetricsStore } from '../lib/store';
import { formatCPU, formatMemory, formatLoad, cpuTrendIcon, cpuTrendColor } from '../lib/formatters';

interface MetricCardProps {
  label: string;
  value: string;
  icon?: string;
  trend?: string;
  trendColor?: string;
}

function MetricCard({ label, value, icon, trend = '', trendColor = '' }: MetricCardProps) {
  return (
    <div className="bg-card rounded-lg border border-border p-4 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-foreground">{value}</span>
        {trend && (
          <span className={`text-lg font-semibold ${trendColor}`}>{trend}</span>
        )}
      </div>
    </div>
  );
}

export function MetricsCards() {
  const { snapshots } = useMetricsStore();
  
  if (snapshots.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard label="CPU" value="--" icon="📊" />
        <MetricCard label="Memoria" value="--" icon="💾" />
        <MetricCard label="Carga (1m)" value="--" icon="⚡" />
      </div>
    );
  }

  const current = snapshots[snapshots.length - 1];
  const previous = snapshots.length > 1 ? snapshots[snapshots.length - 2] : current;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <MetricCard
        label="CPU"
        value={formatCPU(current.cpu_percent)}
        icon="📊"
        trend={cpuTrendIcon(current.cpu_percent, previous.cpu_percent)}
        trendColor={cpuTrendColor(current.cpu_percent, previous.cpu_percent)}
      />
      <MetricCard
        label="Memoria"
        value={formatMemory(current.memory_percent)}
        icon="💾"
      />
      <MetricCard
        label="Carga (1m)"
        value={formatLoad(current.load_1m)}
        icon="⚡"
      />
    </div>
  );
}
