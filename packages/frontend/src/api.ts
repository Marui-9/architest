import type {
  ArchitectureGraph,
  EvaluationResult,
  ScanMode,
  AppView,
  Finding,
  ContractTestResult,
  HealthProbeResult,
  EdgeDetail,
} from './types';

const API_BASE = '/api';

// ─── Scan ───────────────────────────────────────────────────────────────

export async function scanProject(
  projectPath: string,
  mode: ScanMode = 'auto',
): Promise<void> {
  const res = await fetch(`${API_BASE}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectPath, mode }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? body.error ?? `Scan failed (${res.status})`);
  }
}

export async function scanDaemon(): Promise<void> {
  const res = await fetch(`${API_BASE}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'daemon' }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? body.error ?? `Scan failed (${res.status})`);
  }
}

// ─── Graph ──────────────────────────────────────────────────────────────

export async function fetchGraph(): Promise<ArchitectureGraph> {
  const res = await fetch(`${API_BASE}/graph`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `No graph available (${res.status})`);
  }
  return res.json();
}

export async function fetchEdgeDetail(edgeId: string): Promise<EdgeDetail> {
  const res = await fetch(`${API_BASE}/graph/edge/${encodeURIComponent(edgeId)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Edge not found (${res.status})`);
  }
  return res.json();
}

// ─── Evaluate ───────────────────────────────────────────────────────────

export async function fetchEvaluation(): Promise<EvaluationResult> {
  const res = await fetch(`${API_BASE}/evaluate`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Evaluation failed (${res.status})`);
  }
  return res.json();
}

// ─── Test Runner ────────────────────────────────────────────────────────

export async function runContractTest(edgeId: string): Promise<ContractTestResult> {
  const res = await fetch(`${API_BASE}/test/contract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ edgeId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Contract test failed (${res.status})`);
  }
  return res.json();
}

export async function runHealthProbe(edgeId: string): Promise<HealthProbeResult> {
  const res = await fetch(`${API_BASE}/test/health`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ edgeId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Health probe failed (${res.status})`);
  }
  return res.json();
}

// ─── WebSocket ──────────────────────────────────────────────────────────

export function createTestWebSocket(): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return new WebSocket(`${protocol}//${window.location.host}${API_BASE}/test/ws`);
}
