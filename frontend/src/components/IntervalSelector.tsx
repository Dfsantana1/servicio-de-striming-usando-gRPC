import { useMetricsStore } from '../lib/store';

const INTERVAL_OPTIONS = [
  { value: 250, label: '250ms' },
  { value: 500, label: '500ms' },
  { value: 1000, label: '1s' },
  { value: 2000, label: '2s' },
  { value: 5000, label: '5s' },
];

export function IntervalSelector() {
  const { selectedInterval, setSelectedInterval } = useMetricsStore();

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">Intervalo</label>
      <select
        value={selectedInterval}
        onChange={(e) => setSelectedInterval(parseInt(e.target.value))}
        className="px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {INTERVAL_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
