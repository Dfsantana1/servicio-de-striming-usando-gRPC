/**
 * Zustand store for managing global state
 */
import { create } from 'zustand';

export interface MetricsSnapshot {
  agent_id: string;
  timestamp_unix_ms: number;
  cpu_percent: number;
  cpu_times: {
    user: number;
    system: number;
    idle: number;
  };
  memory_percent: number;
  memory_total: number;
  memory_used: number;
  load_1m: number;
  load_5m: number;
  load_15m: number;
  disks: Array<{
    mount: string;
    total: number;
    used: number;
    free: number;
  }>;
  net: {
    bytes_sent: number;
    bytes_recv: number;
  };
  top_processes: Array<{
    pid: number;
    name: string;
    cpu_percent: number;
    memory_bytes: number;
  }>;
}

export interface Agent {
  agent_id: string;
  hostname: string;
  endpoint?: string;  // URL del endpoint (opcional, para agentes remotos)
}

export interface LogEntry {
  agent_id: string;
  timestamp_unix_ms: number;
  level: 'ERROR' | 'WARNING' | 'INFO' | 'DEBUG';
  source: string;
  message: string;
  metadata?: Record<string, string>;
}

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface MetricsStore {
  // Snapshots buffer (last 60 points)
  snapshots: MetricsSnapshot[];
  addSnapshot: (snapshot: MetricsSnapshot) => void;
  clearSnapshots: () => void;

  // Agents list
  agents: Agent[];
  setAgents: (agents: Agent[]) => void;

  // Current selections
  selectedAgent: string | null;
  setSelectedAgent: (agent: string | null) => void;

  selectedInterval: number;
  setSelectedInterval: (interval: number) => void;

  // Connection state
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;

  // Error messages
  errorMessage: string | null;
  setErrorMessage: (message: string | null) => void;

  // Auth token
  authToken: string | null;
  setAuthToken: (token: string | null) => void;

  // Logs
  logs: LogEntry[];
  addLog: (log: LogEntry) => void;
  clearLogs: () => void;
  logFilter: {
    level: string | null;
    pattern: string;
  };
  setLogFilter: (filter: { level: string | null; pattern: string }) => void;

  // Agent endpoints (para múltiples agentes)
  agentEndpoints: Record<string, string>;
  setAgentEndpoint: (agentId: string, endpoint: string) => void;

  // Reset all
  reset: () => void;
}

const MAX_SNAPSHOTS = 60;

export const useMetricsStore = create<MetricsStore>((set) => ({
  snapshots: [],
  addSnapshot: (snapshot: MetricsSnapshot) => 
    set((state) => ({
      snapshots: [
        ...state.snapshots.slice(-MAX_SNAPSHOTS + 1),
        snapshot,
      ],
    })),
  clearSnapshots: () => set({ snapshots: [] }),

  agents: [],
  setAgents: (agents: Agent[]) => set({ agents }),

  selectedAgent: null,
  setSelectedAgent: (agent: string | null) => set({ selectedAgent: agent }),

  selectedInterval: 1000,
  setSelectedInterval: (interval: number) => set({ selectedInterval: interval }),

  connectionStatus: 'idle',
  setConnectionStatus: (status: ConnectionStatus) => set({ connectionStatus: status }),

  errorMessage: null,
  setErrorMessage: (message: string | null) => set({ errorMessage: message }),

  authToken: null,
  setAuthToken: (token: string | null) => set({ authToken: token }),

  logs: [],
  addLog: (log: LogEntry) =>
    set((state) => ({
      logs: [...state.logs.slice(-999), log],  // Mantener últimos 1000 logs
    })),
  clearLogs: () => set({ logs: [] }),
  logFilter: { level: null, pattern: '' },
  setLogFilter: (filter) => set({ logFilter: filter }),

  agentEndpoints: {},
  setAgentEndpoint: (agentId: string, endpoint: string) =>
    set((state) => ({
      agentEndpoints: { ...state.agentEndpoints, [agentId]: endpoint },
    })),

  reset: () =>
    set({
      snapshots: [],
      agents: [],
      selectedAgent: null,
      selectedInterval: 1000,
      connectionStatus: 'idle',
      errorMessage: null,
      authToken: null,
      logs: [],
      logFilter: { level: null, pattern: '' },
      agentEndpoints: {},
    }),
}));
