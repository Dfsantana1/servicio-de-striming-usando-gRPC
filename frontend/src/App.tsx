import { useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { MetricsCards } from './components/MetricsCards';
import { CpuChart } from './components/CpuChart';
import { MemoryChart } from './components/MemoryChart';
import { NetChart } from './components/NetChart';
import { ProcessTable } from './components/ProcessTable';
import { useMetricsStore } from './lib/store';
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
  } = useMetricsStore();

  const streamAbortControllerRef = useRef<AbortController | null>(null);

  // Load agents on mount
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const agents = await listAgents(authToken || undefined);
        setAgents(agents);
        // Auto-select first agent if none selected yet
        if (agents.length > 0 && !selectedAgent) {
          setSelectedAgent(agents[0].agent_id);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to load agents';
        setErrorMessage(msg);
        console.error('Error loading agents:', error);
      }
    };

    loadAgents();
  }, [authToken, setAgents, selectedAgent, setErrorMessage]);

  // Stream metrics when agent or interval changes
  useEffect(() => {
    if (!selectedAgent) {
      setConnectionStatus('idle');
      setErrorMessage('Selecciona un agente');
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
        const generator = streamMetrics(selectedInterval, selectedAgent, authToken || undefined);

        for await (const snapshot of generator) {
          if (abortController.signal.aborted) break;

          // If the incoming snapshot agent differs, auto-adjust selection so it doesn't stay "connecting" forever.
          if (!selectedAgent || snapshot.agent_id !== selectedAgent) {
            setSelectedAgent(snapshot.agent_id);
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

        // Retry after 5 seconds
        const timer = setTimeout(startStream, 5000);
        return () => clearTimeout(timer);
      }
    };

    startStream();

    return () => {
      abortController.abort();
      streamAbortControllerRef.current = null;
    };
  }, [selectedAgent, selectedInterval, authToken, setConnectionStatus, setErrorMessage, addSnapshot]);

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
      </main>
    </div>
  );
}

export default App;
