/**
 * gRPC-Web client (simplified) for the browser.
 *
 * Note: This implementation uses a pragmatic fallback that expects the
 * reverse proxy to expose JSON streaming (NDJSON) for StreamMetrics and
 * JSON for ListAgents at the same base path (/grpc). If you switch to
 * @bufbuild/connect-web with generated stubs, swap these functions to use
 * the real client and protobuf messages.
 */

import type { MetricsSnapshot, Agent, LogEntry } from "./store";

// Narrow import.meta typing for Vite env usage without resorting to any.
// Resolve base URL from Vite environment without using `any`.
const GRPC_BASE_URL: string = ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_GRPC_BASE) || "/grpc";

/**
 * Get base URL for a specific agent (or default)
 */
function getAgentBaseUrl(agentId?: string, agentEndpoints?: Record<string, string>): string {
  if (agentId && agentEndpoints && agentEndpoints[agentId]) {
    return agentEndpoints[agentId];
  }
  return GRPC_BASE_URL;
}

/**
 * Stream metrics snapshots as an async generator.
 * This expects the proxy to return NDJSON lines, each a MetricsResponse-like JSON object.
 */
export async function* streamMetrics(
  intervalMs: number,
  agentId?: string,
  authToken?: string,
  agentEndpoints?: Record<string, string>
): AsyncGenerator<MetricsSnapshot> {
  const baseUrl = getAgentBaseUrl(agentId, agentEndpoints);
  // Construir URL correctamente
  let url: string;
  
  // Debug: Log la URL que se está usando
  console.log('[streamMetrics] Agent ID:', agentId);
  console.log('[streamMetrics] Base URL:', baseUrl);
  console.log('[streamMetrics] Agent Endpoints:', agentEndpoints);
  if (baseUrl.startsWith('http')) {
    // URL absoluta (ngrok, etc.) - siempre agregar /grpc si no está presente
    const cleanUrl = baseUrl.replace(/\/$/, ''); // Quitar trailing slash
    if (cleanUrl.endsWith('/grpc')) {
      url = `${cleanUrl}/metrics.MetricsService/StreamMetrics`;
    } else {
      url = `${cleanUrl}/grpc/metrics.MetricsService/StreamMetrics`;
    }
  } else {
    // URL relativa - ya debería incluir /grpc
    url = baseUrl.endsWith('/grpc') || baseUrl === '/grpc'
      ? `${baseUrl}/metrics.MetricsService/StreamMetrics`
      : `${baseUrl}/metrics.MetricsService/StreamMetrics`;
  }
  
  console.log('[streamMetrics] Final URL:', url);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/x-ndjson, application/json",
  };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const body = JSON.stringify({ interval_ms: intervalMs, agent_id: agentId || "" });

  // Agregar timeout y mejor manejo de errores
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos timeout (aumentado para conexiones remotas)

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorText = await res.text().catch(() => res.statusText);
      throw new Error(`StreamMetrics failed: ${res.status} ${res.statusText} - ${errorText}`);
    }
    if (!res.body) throw new Error("StreamMetrics: empty body");
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error(`StreamMetrics timeout: No response from ${url} after 30 seconds`);
      }
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        throw new Error(`Cannot connect to ${url}. Check if the server is running and accessible.`);
      }
    }
    throw error;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        try {
          const parsed = JSON.parse(t);
          const snap = extractSnapshot(parsed.snapshot ?? parsed);
          yield snap;
        } catch {
          // ignore malformed line
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* no-op */ void 0; }
  }
}

/**
 * List available agents via JSON endpoint.
 */
export async function listAgents(authToken?: string, attempts = 1): Promise<Agent[]> {
  // Reducido a 1 intento por defecto para evitar múltiples requests innecesarios
  // Si hay múltiples backends, se pueden agregar más intentos
  const url = `${GRPC_BASE_URL}/metrics.MetricsService/ListAgents`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  // Agregar timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 15 segundos (aumentado para conexiones remotas)

  try {
    const calls = Array.from({ length: Math.max(1, attempts) }, () =>
      fetch(url, { 
        method: "POST", 
        headers, 
        body: "{}",
        signal: controller.signal
      })
    );

    const results = await Promise.allSettled(calls);
    clearTimeout(timeoutId);
    
    const map = new Map<string, Agent>();

    for (const r of results) {
      if (r.status === "fulfilled") {
        try {
          const data = await r.value.json().catch(() => ({} as any));
          const agents = Array.isArray((data as any).agents) ? (data as any).agents : [];
          for (const a of agents) {
            const agent: Agent = { 
              agent_id: String(a?.agent_id ?? ""), 
              hostname: String(a?.hostname ?? ""),
              endpoint: a?.endpoint ? String(a.endpoint) : undefined  // Incluir endpoint si viene del backend
            };
            if (agent.agent_id) map.set(agent.agent_id, agent);
          }
        } catch {
          // ignore individual parse errors
        }
      }
    }

    return Array.from(map.values());
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('ListAgents timeout: Server not responding');
    }
    throw error;
  }
}

/**
 * Stream logs as an async generator.
 */
export async function* streamLogs(
  agentId?: string,
  level?: string,
  pattern?: string,
  follow: boolean = true,
  authToken?: string,
  agentEndpoints?: Record<string, string>
): AsyncGenerator<LogEntry> {
  const baseUrl = getAgentBaseUrl(agentId, agentEndpoints);
  // Construir URL correctamente
  let url: string;
  if (baseUrl.startsWith('http')) {
    // URL absoluta (ngrok, etc.) - siempre agregar /grpc si no está presente
    const cleanUrl = baseUrl.replace(/\/$/, ''); // Quitar trailing slash
    if (cleanUrl.endsWith('/grpc')) {
      url = `${cleanUrl}/metrics.MetricsService/StreamLogs`;
    } else {
      url = `${cleanUrl}/grpc/metrics.MetricsService/StreamLogs`;
    }
  } else {
    // URL relativa - ya debería incluir /grpc
    url = baseUrl.endsWith('/grpc') || baseUrl === '/grpc'
      ? `${baseUrl}/metrics.MetricsService/StreamLogs`
      : `${baseUrl}/metrics.MetricsService/StreamLogs`;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/x-ndjson, application/json",
  };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const body = JSON.stringify({
    agent_id: agentId || "",
    level: level || "",
    pattern: pattern || "",
    follow,
    max_lines: follow ? 0 : 100,
  });

  // Agregar timeout y mejor manejo de errores
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos timeout (aumentado para conexiones remotas)

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorText = await res.text().catch(() => res.statusText);
      throw new Error(`StreamLogs failed: ${res.status} ${res.statusText} - ${errorText}`);
    }
    if (!res.body) throw new Error("StreamLogs: empty body");
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error(`StreamLogs timeout: No response from ${url} after 30 seconds`);
      }
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        throw new Error(`Cannot connect to ${url}. Check if the server is running and accessible.`);
      }
    }
    throw error;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        try {
          const parsed = JSON.parse(t);
          const logEntry: LogEntry = {
            agent_id: String(parsed.agent_id ?? agentId ?? "unknown"),
            timestamp_unix_ms: Number(parsed.timestamp_unix_ms ?? 0),
            level: (parsed.level ?? "INFO") as LogEntry["level"],
            source: String(parsed.source ?? "system"),
            message: String(parsed.message ?? ""),
            metadata: parsed.metadata || {},
          };
          yield logEntry;
        } catch {
          // ignore malformed line
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* no-op */ void 0; }
  }
}

interface RawCpuTimes { user?: unknown; system?: unknown; idle?: unknown; }
interface RawDisk { mount?: unknown; total?: unknown; used?: unknown; free?: unknown; }
interface RawNet { bytes_sent?: unknown; bytes_recv?: unknown; }
interface RawProcess { pid?: unknown; name?: unknown; cpu_percent?: unknown; memory_bytes?: unknown; }
interface RawSnapshot {
  agent_id?: unknown;
  timestamp_unix_ms?: unknown;
  cpu_percent?: unknown;
  cpu_times?: RawCpuTimes;
  memory_percent?: unknown;
  memory_total?: unknown;
  memory_used?: unknown;
  load_1m?: unknown;
  load_5m?: unknown;
  load_15m?: unknown;
  disks?: RawDisk[];
  net?: RawNet;
  top_processes?: RawProcess[];
}

function extractSnapshot(x: unknown): MetricsSnapshot {
  const obj: RawSnapshot = x && typeof x === 'object' ? (x as RawSnapshot) : {};
  return {
    agent_id: String(obj.agent_id ?? "unknown"),
    timestamp_unix_ms: Number(obj.timestamp_unix_ms ?? 0),
    cpu_percent: Number(obj.cpu_percent ?? 0),
    cpu_times: {
      user: Number(obj.cpu_times?.user ?? 0),
      system: Number(obj.cpu_times?.system ?? 0),
      idle: Number(obj.cpu_times?.idle ?? 0),
    },
    memory_percent: Number(obj.memory_percent ?? 0),
    memory_total: Number(obj.memory_total ?? 0),
    memory_used: Number(obj.memory_used ?? 0),
    load_1m: Number(obj.load_1m ?? 0),
    load_5m: Number(obj.load_5m ?? 0),
    load_15m: Number(obj.load_15m ?? 0),
    disks: Array.isArray(obj.disks)
      ? obj.disks.map((d: RawDisk) => ({
          mount: String(d.mount ?? ""),
          total: Number(d.total ?? 0),
          used: Number(d.used ?? 0),
          free: Number(d.free ?? 0),
        }))
      : [],
    net: {
      bytes_sent: Number(obj.net?.bytes_sent ?? 0),
      bytes_recv: Number(obj.net?.bytes_recv ?? 0),
    },
    top_processes: Array.isArray(obj.top_processes)
      ? obj.top_processes.map((p: RawProcess) => ({
          pid: Number(p.pid ?? 0),
          name: String(p.name ?? ""),
          cpu_percent: Number(p.cpu_percent ?? 0),
          memory_bytes: Number(p.memory_bytes ?? 0),
        }))
      : [],
  };
}

 
