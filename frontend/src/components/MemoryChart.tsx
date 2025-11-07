 
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useMetricsStore } from '../lib/store';

export function MemoryChart() {
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
    memory: Math.round(snap.memory_percent * 10) / 10,
    used: Math.round(snap.memory_used / (1024 * 1024)), // MB
  }));

  return (
    <div className="w-full bg-card rounded-lg border border-border p-4">
      <h2 className="text-lg font-semibold mb-4">Memoria</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="time"
            stroke="var(--muted-foreground)"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            yAxisId="left"
            domain={[0, 100]}
            stroke="var(--muted-foreground)"
            style={{ fontSize: '12px' }}
            label={{ value: '%', angle: -90, position: 'insideLeft' }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="var(--muted-foreground)"
            style={{ fontSize: '12px' }}
            label={{ value: 'MB', angle: 90, position: 'insideRight' }}
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
            dataKey="memory"
            stroke="#3b82f6"
            yAxisId="left"
            dot={false}
            name="Memoria %"
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="used"
            stroke="#8b5cf6"
            yAxisId="right"
            dot={false}
            name="Usado (MB)"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
