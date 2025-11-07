import { useMetricsStore } from '../lib/store';

export function AgentSelector() {
  const { agents, selectedAgent, setSelectedAgent } = useMetricsStore();

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">Agente</label>
      <select
        value={selectedAgent || ''}
        onChange={(e) => setSelectedAgent(e.target.value || null)}
        className="px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="">-- Seleccionar agente --</option>
        {agents.map((agent) => (
          <option key={agent.agent_id} value={agent.agent_id}>
            {agent.hostname} ({agent.agent_id})
          </option>
        ))}
      </select>
    </div>
  );
}
