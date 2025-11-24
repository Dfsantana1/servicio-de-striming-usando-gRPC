import { useEffect, useRef, useMemo, useCallback } from 'react';
import { useMetricsStore } from '../lib/store';
import { streamLogs } from '../lib/grpc';

export function LogsViewer() {
  const {
    selectedAgent,
    logs,
    addLog,
    clearLogs,
    logFilter,
    setLogFilter,
    authToken,
    agentEndpoints,
  } = useMetricsStore();

  const streamAbortControllerRef = useRef<AbortController | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Optimizado: Auto-scroll solo si el usuario está al final
  useEffect(() => {
    if (!scrollContainerRef.current || !shouldAutoScrollRef.current) return;
    
    const container = scrollContainerRef.current;
    const isNearBottom = 
      container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    
    if (isNearBottom) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Detectar si el usuario hace scroll manual
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const isNearBottom = 
      container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    shouldAutoScrollRef.current = isNearBottom;
  }, []);

  // Stream logs con optimización
  useEffect(() => {
    if (!selectedAgent) {
      clearLogs();
      return;
    }

    // Cancel previous stream
    if (streamAbortControllerRef.current) {
      streamAbortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    streamAbortControllerRef.current = abortController;
    
    // Guardar el agente actual para validar logs
    const currentAgent = selectedAgent;

    // Batch logs para mejor rendimiento
    let logBatch: typeof logs = [];
    let batchTimeout: NodeJS.Timeout | null = null;

    const flushBatch = () => {
      if (logBatch.length > 0 && !abortController.signal.aborted) {
        logBatch.forEach(addLog);
        logBatch = [];
      }
      batchTimeout = null;
    };

    const startStream = async () => {
      try {
        const generator = streamLogs(
          selectedAgent,
          logFilter.level || undefined,
          logFilter.pattern || undefined,
          true, // follow
          authToken || undefined,
          agentEndpoints
        );

        for await (const logEntry of generator) {
          if (abortController.signal.aborted) break;
          
          // Validar que el log corresponde al agente actual
          // Si el agente cambió, ignorar este log
          if (logEntry.agent_id !== currentAgent) {
            console.warn(`Log from ${logEntry.agent_id} but selected agent is ${currentAgent}, ignoring`);
            continue;
          }
          
          // Agregar a batch
          logBatch.push(logEntry);
          
          // Flush batch cada 100ms o cuando tenga 10 logs
          if (logBatch.length >= 10) {
            flushBatch();
          } else if (!batchTimeout) {
            batchTimeout = setTimeout(flushBatch, 100);
          }
        }
        
        // Flush cualquier log pendiente
        flushBatch();
      } catch (error) {
        if (abortController.signal.aborted) return;
        console.error('Log stream error:', error);
      }
    };

    startStream();

    return () => {
      if (batchTimeout) clearTimeout(batchTimeout);
      abortController.abort();
      streamAbortControllerRef.current = null;
    };
  }, [selectedAgent, logFilter.level, logFilter.pattern, authToken, agentEndpoints, addLog, clearLogs]);
  
  // Limpiar logs cuando cambia el agente
  useEffect(() => {
    clearLogs();
  }, [selectedAgent, clearLogs]);

  // Memoizar logs filtrados para mejor rendimiento
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (selectedAgent && log.agent_id !== selectedAgent) return false;
      if (logFilter.level && log.level !== logFilter.level) return false;
      if (logFilter.pattern && !log.message.toLowerCase().includes(logFilter.pattern.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [logs, selectedAgent, logFilter.level, logFilter.pattern]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR':
        return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'WARNING':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'INFO':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'DEBUG':
        return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
      default:
        return 'text-gray-300 bg-gray-500/10 border-gray-500/20';
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="bg-card rounded-lg border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Logs del Sistema</h2>
        <div className="flex items-center gap-2">
          <select
            value={logFilter.level || ''}
            onChange={(e) => setLogFilter({ ...logFilter, level: e.target.value || null })}
            className="px-3 py-1 bg-background border rounded text-sm"
          >
            <option value="">Todos los niveles</option>
            <option value="ERROR">ERROR</option>
            <option value="WARNING">WARNING</option>
            <option value="INFO">INFO</option>
            <option value="DEBUG">DEBUG</option>
          </select>
          <input
            type="text"
            placeholder="Buscar en logs..."
            value={logFilter.pattern}
            onChange={(e) => setLogFilter({ ...logFilter, pattern: e.target.value })}
            className="px-3 py-1 bg-background border rounded text-sm flex-1 max-w-xs"
          />
          <button
            onClick={clearLogs}
            className="px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-sm hover:bg-red-500/20"
          >
            Limpiar
          </button>
        </div>
      </div>

      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="bg-background rounded border h-96 overflow-y-auto font-mono text-sm"
      >
        {filteredLogs.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            {selectedAgent ? 'Esperando logs...' : 'Selecciona un agente para ver logs'}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredLogs.map((log, idx) => (
              <div
                key={`${log.timestamp_unix_ms}-${idx}`}
                className={`p-2 rounded border ${getLevelColor(log.level)}`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-xs opacity-70">{formatTime(log.timestamp_unix_ms)}</span>
                  <span className="font-semibold min-w-[80px]">{log.level}</span>
                  <span className="text-xs opacity-70 min-w-[120px] truncate">{log.source}</span>
                  <span className="flex-1 break-words">{log.message}</span>
                </div>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}

