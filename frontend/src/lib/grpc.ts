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
  const url = `${baseUrl}/metrics.MetricsService/StreamMetrics`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/x-ndjson, application/json",
  };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const body = JSON.stringify({ interval_ms: intervalMs, agent_id: agentId || "" });

  const res = await fetch(url, {
    method: "POST",
    headers,
    body,
  });

  if (!res.ok) {
    throw new Error(`StreamMetrics failed: ${res.status} ${res.statusText}`);
  }
  if (!res.body) throw new Error("StreamMetrics: empty body");

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
export async function listAgents(authToken?: string, attempts = 4): Promise<Agent[]> {
  // Because the proxy load-balances between backends and each backend only knows itself,
  // we issue multiple requests and aggregate unique agents by agent_id.
  const url = `${GRPC_BASE_URL}/metrics.MetricsService/ListAgents`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const calls = Array.from({ length: Math.max(1, attempts) }, () =>
    fetch(url, { method: "POST", headers, body: "{}" })
  );

  const results = await Promise.allSettled(calls);
  const map = new Map<string, Agent>();

  for (const r of results) {
    if (r.status === "fulfilled") {
      try {
        const data = await r.value.json().catch(() => ({} as any));
        const agents = Array.isArray((data as any).agents) ? (data as any).agents : [];
        for (const a of agents) {
          const agent: Agent = { agent_id: String(a?.agent_id ?? ""), hostname: String(a?.hostname ?? "") };
          if (agent.agent_id) map.set(agent.agent_id, agent);
        }
      } catch {
        // ignore individual parse errors
      }
    }
  }

  return Array.from(map.values());
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
  const url = `${baseUrl}/metrics.MetricsService/StreamLogs`;

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

  const res = await fetch(url, {
    method: "POST",
    headers,
    body,
  });

  if (!res.ok) {
    throw new Error(`StreamLogs failed: ${res.status} ${res.statusText}`);
  }
  if (!res.body) throw new Error("StreamLogs: empty body");

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

 
