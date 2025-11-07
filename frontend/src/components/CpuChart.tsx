import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useMetricsStore } from '../lib/store';

export function CpuChart() {
  const { snapshots } = useMetricsStore();

  if (snapshots.length === 0) {
    return (
      <div className="w-full h-80 flex items-center justify-center bg-card rounded-lg border border-border">
        <p className="text-muted-foreground">Sin datos</p>
      </div>
    );
  }

  const data = snapshots.map((snap, idx) => ({
    time: idx,
    cpu: Math.round(snap.cpu_percent * 10) / 10,
  }));

  return (
    <div className="w-full bg-card rounded-lg border border-border p-4">
      <h2 className="text-lg font-semibold mb-4">CPU (%)</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="time"
            stroke="var(--muted-foreground)"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            domain={[0, 100]}
            stroke="var(--muted-foreground)"
            style={{ fontSize: '12px' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '0.5rem',
            }}
            labelStyle={{ color: 'var(--foreground)' }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="cpu"
            stroke="#ef4444"
            dot={false}
            name="CPU %"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
