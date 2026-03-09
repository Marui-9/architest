import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as net from 'node:net';
import { probeHealth } from './healthProbe.js';
import type { GraphNode } from '../types.js';

// ─── Test helpers ────────────────────────────────────────────────────────

function makeNode(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: 'postgres',
    label: 'postgres',
    serviceType: 'datastore',
    ports: [{ host: 5432, container: 5432 }],
    hasSpec: false,
    x: 0,
    y: 0,
    width: 200,
    height: 80,
    source: 'docker-compose',
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe('healthProbe', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns error when no ports are exposed', async () => {
    const result = await probeHealth('edge-1', makeNode({ ports: [] }));

    expect(result.status).toBe('error');
    expect(result.reachable).toBe(false);
    expect(result.error).toContain('No host ports exposed');
  });

  it('returns pass when HTTP probe succeeds', async () => {
    fetchSpy.mockResolvedValue(
      new Response('OK', { status: 200 }),
    );

    const result = await probeHealth('edge-1', makeNode());

    expect(result.status).toBe('pass');
    expect(result.reachable).toBe(true);
    expect(result.method).toBe('http');
    expect(result.latencyMs).toBeDefined();
  });

  it('returns pass with target name from node label', async () => {
    fetchSpy.mockResolvedValue(
      new Response('OK', { status: 200 }),
    );

    const result = await probeHealth('edge-1', makeNode({ label: 'my-postgres' }));

    expect(result.target).toBe('my-postgres');
  });

  it('falls back to TCP when HTTP fails', async () => {
    // HTTP fails
    fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));

    // We can't easily mock net.Socket in unit tests, so we'll just verify
    // the TCP fallback is attempted and returns fail (since nothing is listening)
    const result = await probeHealth('edge-1', makeNode({ ports: [{ host: 19999, container: 5432 }] }), {
      timeout: 500,
    });

    // HTTP was attempted
    expect(fetchSpy).toHaveBeenCalled();
    // TCP fallback should have been tried and failed (nothing on port 19999)
    expect(result.method).toBe('tcp');
    expect(result.reachable).toBe(false);
    expect(result.status).toBe('fail');
  });

  it('uses custom host option', async () => {
    fetchSpy.mockResolvedValue(
      new Response('', { status: 404 }),
    );

    const result = await probeHealth('edge-1', makeNode(), { host: '127.0.0.1' });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://127.0.0.1:5432/',
      expect.anything(),
    );
    expect(result.reachable).toBe(true);
  });

  it('treats any HTTP response as reachable', async () => {
    // Even 500 means the service is running
    fetchSpy.mockResolvedValue(
      new Response('Internal Server Error', { status: 500 }),
    );

    const result = await probeHealth('edge-1', makeNode());

    expect(result.reachable).toBe(true);
    expect(result.status).toBe('pass');
  });

  it('includes edgeId in result', async () => {
    fetchSpy.mockResolvedValue(
      new Response('OK', { status: 200 }),
    );

    const result = await probeHealth('my-edge-123', makeNode());

    expect(result.edgeId).toBe('my-edge-123');
  });
});
