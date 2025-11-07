import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useMetricsStore } from '../lib/store';

export function NetChart() {
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
    sent: Math.round(snap.net.bytes_sent / 1024), // KB
    recv: Math.round(snap.net.bytes_recv / 1024), // KB
  }));

  return (
    <div className="w-full bg-card rounded-lg border border-border p-4">
      <h2 className="text-lg font-semibold mb-4">Red (KB/s)</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="time"
            stroke="var(--muted-foreground)"
            style={{ fontSize: '12px' }}
          />
          <YAxis
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
            dataKey="sent"
            stroke="#06b6d4"
            dot={false}
            name="Enviado"
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="recv"
            stroke="#10b981"
            dot={false}
            name="Recibido"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
