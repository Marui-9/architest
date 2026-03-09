import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runContractTests } from './contractRunner.js';
import type {
  GraphEdge,
  GraphNode,
  EnrichedService,
  EndpointTestResult,
} from '../types.js';

// ─── Test helpers ────────────────────────────────────────────────────────

function makeEdge(overrides: Partial<GraphEdge> = {}): GraphEdge {
  return {
    id: 'order-api->user-api',
    source: 'order-api',
    target: 'user-api',
    type: 'api',
    label: 'API',
    ...overrides,
  };
}

function makeNode(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: 'user-api',
    label: 'user-api',
    serviceType: 'service',
    ports: [{ host: 3001, container: 3000 }],
    hasSpec: true,
    x: 0,
    y: 0,
    width: 200,
    height: 80,
    source: 'docker-compose',
    ...overrides,
  };
}

function makeService(overrides: Partial<EnrichedService> = {}): EnrichedService {
  return {
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
              schema: {
                type: 'array',
                items: { type: 'object', properties: { id: { type: 'number' } } },
              },
            },
          ],
        },
        {
          method: 'get',
          path: '/users/{id}',
          summary: 'Get user by ID',
          responses: [
            {
              statusCode: '200',
              description: 'OK',
              schema: {
                type: 'object',
                properties: { id: { type: 'number' }, name: { type: 'string' } },
              },
            },
          ],
        },
        {
          method: 'post',
          path: '/users',
          summary: 'Create user',
          responses: [
            {
              statusCode: '201',
              description: 'Created',
              schema: {
                type: 'object',
                properties: { id: { type: 'number' } },
              },
            },
          ],
        },
      ],
    },
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe('contractRunner', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns error when service has no OpenAPI spec', async () => {
    const result = await runContractTests(
      makeEdge(),
      makeNode(),
      makeService({ openapi: undefined }),
    );

    expect(result.status).toBe('error');
    expect(result.endpoints).toHaveLength(1);
    expect(result.endpoints[0].error).toContain('No OpenAPI spec');
  });

  it('returns error when service has no ports', async () => {
    const result = await runContractTests(
      makeEdge(),
      makeNode({ ports: [] }),
      makeService({
        openapi: {
          filePath: '/test/openapi.json',
          title: 'User API',
          version: '1.0.0',
          baseUrl: undefined, // no baseUrl
          endpoints: [
            {
              method: 'get',
              path: '/users',
              summary: 'List users',
              responses: [],
            },
          ],
        },
      }),
    );

    expect(result.status).toBe('error');
    expect(result.endpoints[0].error).toContain('Cannot determine base URL');
  });

  it('skips non-GET endpoints (auto-pass)', async () => {
    // Make a service with only POST endpoints
    const service = makeService({
      openapi: {
        filePath: '/test/openapi.json',
        title: 'User API',
        version: '1.0.0',
        baseUrl: 'http://localhost:3001',
        endpoints: [
          {
            method: 'post',
            path: '/users',
            summary: 'Create user',
            responses: [],
          },
        ],
      },
    });

    const result = await runContractTests(makeEdge(), makeNode(), service);

    expect(result.status).toBe('pass');
    expect(result.summary.passed).toBe(1);
    expect(result.endpoints[0].status).toBe('pass');
    // Fetch should not have been called for POST endpoints
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('passes when GET returns valid schema', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify([{ id: 1 }, { id: 2 }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    // Service with just one GET endpoint
    const service = makeService({
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
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { id: { type: 'number' } },
                  },
                },
              },
            ],
          },
        ],
      },
    });

    const result = await runContractTests(makeEdge(), makeNode(), service);

    expect(result.status).toBe('pass');
    expect(result.summary.passed).toBe(1);
    expect(result.endpoints[0].schemaValid).toBe(true);
    expect(result.endpoints[0].httpStatus).toBe(200);
  });

  it('fails when response does not match schema', async () => {
    // Return a string instead of an array
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ invalid: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const service = makeService({
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
    });

    const result = await runContractTests(makeEdge(), makeNode(), service);

    expect(result.status).toBe('fail');
    expect(result.summary.failed).toBe(1);
    expect(result.endpoints[0].schemaValid).toBe(false);
    expect(result.endpoints[0].schemaErrors).toBeDefined();
    expect(result.endpoints[0].schemaErrors!.length).toBeGreaterThan(0);
  });

  it('handles fetch errors gracefully', async () => {
    fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));

    const service = makeService({
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
            responses: [],
          },
        ],
      },
    });

    const result = await runContractTests(makeEdge(), makeNode(), service);

    expect(result.status).toBe('error');
    expect(result.summary.errors).toBe(1);
    expect(result.endpoints[0].error).toContain('Connection refused');
  });

  it('passes when no schema defined but HTTP is 2xx', async () => {
    fetchSpy.mockResolvedValue(
      new Response('OK', { status: 200 }),
    );

    const service = makeService({
      openapi: {
        filePath: '/test/openapi.json',
        title: 'User API',
        version: '1.0.0',
        baseUrl: 'http://localhost:3001',
        endpoints: [
          {
            method: 'get',
            path: '/health',
            summary: 'Health check',
            responses: [
              { statusCode: '200', description: 'OK' },
            ],
          },
        ],
      },
    });

    const result = await runContractTests(makeEdge(), makeNode(), service);

    expect(result.status).toBe('pass');
    expect(result.endpoints[0].httpStatus).toBe(200);
    expect(result.endpoints[0].schemaValid).toBe(true);
  });

  it('calls onProgress for each endpoint', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const progress: EndpointTestResult[] = [];
    const service = makeService({
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
              { statusCode: '200', description: 'OK', schema: { type: 'array' } },
            ],
          },
          {
            method: 'post',
            path: '/users',
            summary: 'Create user',
            responses: [],
          },
        ],
      },
    });

    await runContractTests(makeEdge(), makeNode(), service, {
      onProgress: (result) => progress.push(result),
    });

    expect(progress).toHaveLength(2);
  });

  it('uses spec baseUrl over localhost port', async () => {
    fetchSpy.mockResolvedValue(
      new Response('OK', { status: 200 }),
    );

    const service = makeService({
      openapi: {
        filePath: '/test/openapi.json',
        title: 'User API',
        version: '1.0.0',
        baseUrl: 'http://api.example.com',
        endpoints: [
          {
            method: 'get',
            path: '/users',
            summary: 'List users',
            responses: [{ statusCode: '200', description: 'OK' }],
          },
        ],
      },
    });

    await runContractTests(makeEdge(), makeNode(), service);

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://api.example.com/users',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('expands path parameters in URLs', async () => {
    fetchSpy.mockResolvedValue(
      new Response('OK', { status: 200 }),
    );

    const service = makeService({
      openapi: {
        filePath: '/test/openapi.json',
        title: 'User API',
        version: '1.0.0',
        baseUrl: 'http://localhost:3001',
        endpoints: [
          {
            method: 'get',
            path: '/users/{userId}/orders/{orderId}',
            summary: 'Get order',
            responses: [{ statusCode: '200', description: 'OK' }],
          },
        ],
      },
    });

    await runContractTests(makeEdge(), makeNode(), service);

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3001/users/1/orders/1',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('sets timestamps and completedAt', async () => {
    fetchSpy.mockResolvedValue(
      new Response('OK', { status: 200 }),
    );

    const service = makeService({
      openapi: {
        filePath: '/test/openapi.json',
        title: 'User API',
        version: '1.0.0',
        baseUrl: 'http://localhost:3001',
        endpoints: [
          {
            method: 'get',
            path: '/health',
            responses: [{ statusCode: '200', description: 'OK' }],
          },
        ],
      },
    });

    const result = await runContractTests(makeEdge(), makeNode(), service);

    expect(result.startedAt).toBeDefined();
    expect(result.completedAt).toBeDefined();
    expect(new Date(result.startedAt).getTime()).toBeLessThanOrEqual(
      new Date(result.completedAt!).getTime(),
    );
  });
});
