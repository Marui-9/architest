import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../server.js';
import { setGraphState, resetGraphState } from './graph.js';
import type { ArchitectureGraph, ScanResult } from '../types.js';

// ─── Test fixtures ───────────────────────────────────────────────────────

const testGraph: ArchitectureGraph = {
  nodes: [
    {
      id: 'order-api',
      label: 'order-api',
      serviceType: 'service',
      ports: [{ host: 3000, container: 3000 }],
      hasSpec: false,
      x: 0,
      y: 0,
      width: 200,
      height: 80,
      source: 'docker-compose',
    },
    {
      id: 'user-api',
      label: 'user-api',
      serviceType: 'service',
      ports: [{ host: 3001, container: 3000 }],
      hasSpec: true,
      x: 300,
      y: 0,
      width: 200,
      height: 80,
      source: 'docker-compose',
    },
    {
      id: 'postgres',
      label: 'postgres',
      serviceType: 'datastore',
      image: 'postgres:16',
      ports: [{ host: 5432, container: 5432 }],
      hasSpec: false,
      x: 150,
      y: 200,
      width: 200,
      height: 80,
      source: 'docker-compose',
    },
  ],
  edges: [
    {
      id: 'order-api->user-api',
      source: 'order-api',
      target: 'user-api',
      type: 'api',
      label: 'API',
    },
    {
      id: 'order-api->postgres',
      source: 'order-api',
      target: 'postgres',
      type: 'datastore',
      label: 'Datastore',
    },
  ],
};

const testScanResult: ScanResult = {
  projectPath: '/test',
  mode: 'compose',
  discoveredSpecs: ['/test/openapi.json'],
  services: [
    {
      id: 'order-api',
      name: 'order-api',
      source: 'docker-compose',
      ports: [{ host: 3000, container: 3000 }],
      dependsOn: ['user-api', 'postgres'],
      serviceType: 'service',
      metadata: {},
    },
    {
      id: 'user-api',
      name: 'user-api',
      source: 'docker-compose',
      ports: [{ host: 3001, container: 3000 }],
      dependsOn: [],
      serviceType: 'service',
      metadata: {},
      openapi: {
        filePath: '/test/openapi.json',
        title: 'User API',
        version: '1.0.0',
        baseUrl: 'http://localhost:3001',
        endpoints: [
          {
            method: 'get',
            path: '/users',
            summary: 'List users',
            responses: [
              {
                statusCode: '200',
                description: 'OK',
                schema: { type: 'array', items: { type: 'object' } },
              },
            ],
          },
        ],
      },
    },
    {
      id: 'postgres',
      name: 'postgres',
      source: 'docker-compose',
      image: 'postgres:16',
      ports: [{ host: 5432, container: 5432 }],
      dependsOn: [],
      serviceType: 'datastore',
      metadata: {},
    },
  ],
  parseErrors: [],
};

// ─── Tests ──────────────────────────────────────────────────────────────

describe('test routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    app = await buildApp();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    resetGraphState();
    setGraphState(testGraph, testScanResult);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    resetGraphState();
    await app.close();
  });

  // ── POST /api/test/contract ───────────────────────────────────────────

  describe('POST /api/test/contract', () => {
    it('returns 400 when edgeId is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/test/contract',
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 404 when no graph exists', async () => {
      resetGraphState();
      const res = await app.inject({
        method: 'POST',
        url: '/api/test/contract',
        payload: { edgeId: 'order-api->user-api' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 404 for unknown edge', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/test/contract',
        payload: { edgeId: 'nonexistent' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 400 for non-api edge', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/test/contract',
        payload: { edgeId: 'order-api->postgres' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('datastore');
    });

    it('runs contract tests for an API edge', async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify([{ id: 1 }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/test/contract',
        payload: { edgeId: 'order-api->user-api' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.edgeId).toBe('order-api->user-api');
      expect(body.status).toBe('pass');
      expect(body.endpoints).toBeDefined();
      expect(body.summary).toBeDefined();
    });
  });

  // ── POST /api/test/health ─────────────────────────────────────────────

  describe('POST /api/test/health', () => {
    it('returns 400 when edgeId is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/test/health',
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 404 when no graph exists', async () => {
      resetGraphState();
      const res = await app.inject({
        method: 'POST',
        url: '/api/test/health',
        payload: { edgeId: 'order-api->postgres' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 404 for unknown edge', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/test/health',
        payload: { edgeId: 'nonexistent' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('probes health for an edge', async () => {
      // HTTP probe will fail (nothing listening), TCP will also fail
      fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));

      const res = await app.inject({
        method: 'POST',
        url: '/api/test/health',
        payload: { edgeId: 'order-api->postgres' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.edgeId).toBe('order-api->postgres');
      expect(body.target).toBe('postgres');
      expect(body).toHaveProperty('reachable');
      expect(body).toHaveProperty('method');
    });
  });

  // ── GET /api/graph/edge/:id with openapi ──────────────────────────────

  describe('GET /api/graph/edge/:id enriched', () => {
    it('includes openapi data for target service', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/graph/edge/order-api-%3Euser-api',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.openapi).toBeDefined();
      expect(body.openapi.title).toBe('User API');
      expect(body.openapi.endpoints).toHaveLength(1);
      expect(body.openapi.endpoints[0].method).toBe('get');
    });

    it('does not include openapi for non-api target', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/graph/edge/order-api-%3Epostgres',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.openapi).toBeUndefined();
    });
  });
});
