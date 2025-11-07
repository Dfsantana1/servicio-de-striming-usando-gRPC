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

  reset: () =>
    set({
      snapshots: [],
      agents: [],
      selectedAgent: null,
      selectedInterval: 1000,
      connectionStatus: 'idle',
      errorMessage: null,
      authToken: null,
    }),
}));
