import { useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { MetricsCards } from './components/MetricsCards';
import { CpuChart } from './components/CpuChart';
import { MemoryChart } from './components/MemoryChart';
import { NetChart } from './components/NetChart';
import { ProcessTable } from './components/ProcessTable';
import { LogsViewer } from './components/LogsViewer';
import { useMetricsStore, Agent } from './lib/store';
import { streamMetrics, listAgents } from './lib/grpc';
import './styles/globals.css';

function App() {
  const {
    selectedAgent,
    selectedInterval,
    connectionStatus,
    setConnectionStatus,
    setErrorMessage,
    addSnapshot,
    setAgents,
    authToken,
    setSelectedAgent,
    agentEndpoints,
  } = useMetricsStore();

  const streamAbortControllerRef = useRef<AbortController | null>(null);

  // Load agents on mount and periodically (cada 30 segundos)
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    const loadAgents = async () => {
      try {
        const agents = await listAgents(authToken || undefined);
        setAgents(agents);
        
        // Si los agentes vienen con endpoints del backend, guardarlos automáticamente
        const { setAgentEndpoint } = useMetricsStore.getState();
        agents.forEach((agent: Agent) => {
          if (agent.endpoint) {
            // Guardar el endpoint del backend (puede sobrescribir config manual si viene del backend)
            const currentEndpoints = useMetricsStore.getState().agentEndpoints;
            // Solo actualizar si no existe o si viene del backend (prioridad al backend)
            if (!currentEndpoints[agent.agent_id] || agent.endpoint) {
              console.log(`[App] Guardando endpoint para ${agent.agent_id}: ${agent.endpoint}`);
              setAgentEndpoint(agent.agent_id, agent.endpoint);
            }
          }
        });
        
        // Auto-select first agent if none selected yet
        if (agents.length > 0 && !selectedAgent) {
          setSelectedAgent(agents[0].agent_id);
        }
      } catch (error) {
        // No mostrar error si es solo un problema temporal
        console.debug('Error loading agents (will retry):', error);
      }
    };

    // Cargar inmediatamente
    loadAgents();
    
    // Recargar cada 30 segundos (en lugar de en cada render)
    intervalId = setInterval(loadAgents, 30000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [authToken, setAgents, selectedAgent, setSelectedAgent, setErrorMessage]);

  // Stream metrics when agent or interval changes
  useEffect(() => {
    if (!selectedAgent) {
      setConnectionStatus('idle');
      setErrorMessage(null);
      return;
    }

    // Cancel previous stream
    if (streamAbortControllerRef.current) {
      streamAbortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    streamAbortControllerRef.current = abortController;

    const startStream = async () => {
      setConnectionStatus('connecting');
      setErrorMessage(null);

      try {
        const generator = streamMetrics(
          selectedInterval,
          selectedAgent,
          authToken || undefined,
          agentEndpoints
        );

        for await (const snapshot of generator) {
          if (abortController.signal.aborted) break;

          // Validar que el snapshot corresponde al agente seleccionado
          // Si el agente cambió mientras se recibía el snapshot, ignorarlo
          if (snapshot.agent_id !== selectedAgent) {
            console.warn(`Snapshot from ${snapshot.agent_id} but selected agent is ${selectedAgent}, ignoring`);
            continue;
          }

          addSnapshot(snapshot);
          setConnectionStatus('connected');
        }
      } catch (error) {
        if (abortController.signal.aborted) return;

        const msg = error instanceof Error ? error.message : 'Stream error';
        setErrorMessage(msg);
        setConnectionStatus('error');
        console.error('Stream error:', error);
        console.error('Agent:', selectedAgent);
        console.error('Endpoint:', agentEndpoints[selectedAgent || ''] || 'default');
        console.error('Full error:', error);

        // Retry after 5 seconds solo si el agente sigue siendo el mismo
        const timer = setTimeout(() => {
          if (selectedAgent) {
            console.log('Retrying connection...');
            startStream();
          }
        }, 5000);
        return () => clearTimeout(timer);
      }
    };

    startStream();

    return () => {
      abortController.abort();
      streamAbortControllerRef.current = null;
    };
  }, [selectedAgent, selectedInterval, authToken, setConnectionStatus, setErrorMessage, addSnapshot, setSelectedAgent, agentEndpoints]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      
      <main className="container mx-auto px-4 py-6 space-y-6 max-w-7xl">
        {/* Connection warning */}
        {connectionStatus !== 'connected' && (
          <div className={`p-4 rounded-lg text-sm ${
            connectionStatus === 'error'
              ? 'bg-red-500/10 text-red-700 border border-red-200'
              : connectionStatus === 'connecting'
              ? 'bg-yellow-500/10 text-yellow-700 border border-yellow-200'
              : 'bg-gray-500/10 text-gray-700 border border-gray-200'
          }`}>
            {connectionStatus === 'idle' && 'Selecciona un agente para comenzar'}
            {connectionStatus === 'connecting' && 'Conectando...'}
            {connectionStatus === 'error' && 'Error de conexión. Reintentando...'}
          </div>
        )}

        {/* Metrics cards */}
        <MetricsCards />

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CpuChart />
          <MemoryChart />
        </div>

        {/* Network chart */}
        <NetChart />

        {/* Process table */}
        <ProcessTable />

        {/* Logs viewer */}
        <LogsViewer />
      </main>
    </div>
  );
}

export default App;
