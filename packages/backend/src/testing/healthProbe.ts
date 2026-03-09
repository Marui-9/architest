import * as net from 'node:net';
import type { HealthProbeResult, GraphNode } from '../types.js';

// ─── TCP probe ──────────────────────────────────────────────────────────

/**
 * Attempt a raw TCP connection to host:port.
 * Resolves with true if the connection succeeds within the timeout.
 */
function tcpProbe(host: string, port: number, timeout: number): Promise<{ ok: boolean; latencyMs: number }> {
  return new Promise((resolve) => {
    const start = performance.now();
    const socket = new net.Socket();

    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, latencyMs: Math.round(performance.now() - start) });
    }, timeout);

    socket.connect(port, host, () => {
      clearTimeout(timer);
      const latencyMs = Math.round(performance.now() - start);
      socket.destroy();
      resolve({ ok: true, latencyMs });
    });

    socket.on('error', () => {
      clearTimeout(timer);
      const latencyMs = Math.round(performance.now() - start);
      socket.destroy();
      resolve({ ok: false, latencyMs });
    });
  });
}

// ─── HTTP probe ─────────────────────────────────────────────────────────

/**
 * Attempt an HTTP GET to the root of a service.
 * Any 1xx–5xx response is considered "reachable" (service is running).
 */
async function httpProbe(
  url: string,
  timeout: number,
): Promise<{ ok: boolean; latencyMs: number; httpStatus?: number; error?: string }> {
  const start = performance.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: '*/*' },
    });
    clearTimeout(timer);

    return {
      ok: true,
      latencyMs: Math.round(performance.now() - start),
      httpStatus: res.status,
    };
  } catch (err) {
    const errObj = err as Error & { cause?: { code?: string } };
    const message = errObj.message ?? String(err);
    const causeCode = errObj.cause?.code;
    let detail: string;

    if (message.includes('abort') || errObj.name === 'AbortError') {
      detail = `HTTP probe timed out after ${timeout}ms`;
    } else if (causeCode === 'ECONNREFUSED' || message.includes('ECONNREFUSED')) {
      detail = 'Connection refused';
    } else if (causeCode === 'ENOTFOUND' || message.includes('ENOTFOUND')) {
      detail = 'DNS lookup failed';
    } else {
      detail = message;
    }

    return {
      ok: false,
      latencyMs: Math.round(performance.now() - start),
      error: detail,
    };
  }
}

// ─── Health probe ───────────────────────────────────────────────────────

export interface HealthProbeOptions {
  /** Timeout per probe attempt in ms (default: 3000) */
  timeout?: number;
  /** Host to connect to (default: "localhost") */
  host?: string;
}

/**
 * Probe a service for connectivity.
 *
 * Strategy:
 * 1. If the service has host ports, try HTTP first, then TCP fallback
 * 2. Reports reachability + latency
 */
export async function probeHealth(
  edgeId: string,
  targetNode: GraphNode,
  options: HealthProbeOptions = {},
): Promise<HealthProbeResult> {
  const { timeout = 3000, host = 'localhost' } = options;
  const target = targetNode.label;

  // Need at least one host port to probe
  const hostPort = targetNode.ports[0]?.host;
  if (!hostPort) {
    return {
      edgeId,
      target,
      status: 'error',
      reachable: false,
      method: 'tcp',
      error: 'No host ports exposed — cannot probe connectivity',
    };
  }

  // Try HTTP first (more informative)
  const httpUrl = `http://${host}:${hostPort}/`;
  const httpResult = await httpProbe(httpUrl, timeout);
  if (httpResult.ok) {
    return {
      edgeId,
      target,
      status: 'pass',
      reachable: true,
      latencyMs: httpResult.latencyMs,
      method: 'http',
    };
  }

  // Fall back to TCP probe
  const tcpResult = await tcpProbe(host, hostPort, timeout);
  return {
    edgeId,
    target,
    status: tcpResult.ok ? 'pass' : 'fail',
    reachable: tcpResult.ok,
    latencyMs: tcpResult.latencyMs,
    method: 'tcp',
    error: tcpResult.ok
      ? undefined
      : `TCP connection to ${host}:${hostPort} failed${httpResult.error ? ` (HTTP: ${httpResult.error})` : ''}`,
  };
}
