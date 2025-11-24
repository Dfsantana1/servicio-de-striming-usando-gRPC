import { useState } from 'react';
import { useMetricsStore } from '../lib/store';

export function AgentSelector() {
  const { agents, selectedAgent, setSelectedAgent, agentEndpoints, setAgentEndpoint, removeAgentEndpoint } = useMetricsStore();
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [newAgentId, setNewAgentId] = useState('');
  const [newAgentEndpoint, setNewAgentEndpoint] = useState('');

  const handleAddAgent = () => {
    if (newAgentId && newAgentEndpoint) {
      setAgentEndpoint(newAgentId, newAgentEndpoint);
      setNewAgentId('');
      setNewAgentEndpoint('');
      setShowAddAgent(false);
    }
  };

  const allAgents = [
    ...agents,
    ...Object.keys(agentEndpoints)
      .filter(id => !agents.find(a => a.agent_id === id))
      .map(id => ({ agent_id: id, hostname: id, endpoint: agentEndpoints[id] }))
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-muted-foreground">Agente</label>
        <button
          onClick={() => setShowAddAgent(!showAddAgent)}
          className="text-xs px-2 py-1 bg-primary/10 text-primary border border-primary/20 rounded hover:bg-primary/20"
          title="Agregar agente remoto"
        >
          +
        </button>
      </div>
      
      {showAddAgent && (
        <div className="p-2 bg-card border rounded space-y-2">
          <input
            type="text"
            placeholder="Agent ID (ej: servidor-1)"
            value={newAgentId}
            onChange={(e) => setNewAgentId(e.target.value)}
            className="w-full px-2 py-1 text-sm border rounded bg-background"
          />
          <input
            type="text"
            placeholder="Endpoint (ej: http://192.168.1.100:8000/grpc)"
            value={newAgentEndpoint}
            onChange={(e) => setNewAgentEndpoint(e.target.value)}
            className="w-full px-2 py-1 text-sm border rounded bg-background"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAddAgent}
              className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Agregar
            </button>
            <button
              onClick={() => {
                setShowAddAgent(false);
                setNewAgentId('');
                setNewAgentEndpoint('');
              }}
              className="px-3 py-1 text-xs bg-muted text-muted-foreground rounded hover:bg-muted/80"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <select
          value={selectedAgent || ''}
          onChange={(e) => setSelectedAgent(e.target.value || null)}
          className="flex-1 px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">-- Seleccionar agente --</option>
          {allAgents.map((agent) => (
            <option key={agent.agent_id} value={agent.agent_id}>
              {agent.hostname} ({agent.agent_id})
              {agent.endpoint && ' [Remoto]'}
            </option>
          ))}
        </select>
        {selectedAgent && agentEndpoints[selectedAgent] && (
          <button
            onClick={() => {
              if (confirm(`¿Eliminar agente remoto "${selectedAgent}"?`)) {
                removeAgentEndpoint(selectedAgent);
                if (selectedAgent === selectedAgent) {
                  setSelectedAgent(null);
                }
              }
            }}
            className="px-2 py-1 text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded hover:bg-destructive/20"
            title="Eliminar agente remoto"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
