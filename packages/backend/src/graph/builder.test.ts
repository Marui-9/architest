import { describe, it, expect } from 'vitest';
import { buildGraph } from './builder.js';
import type { ScanResult, EnrichedService, ScanMode } from '../types.js';

/** Helper: build a minimal enriched service */
function svc(overrides: Partial<EnrichedService> & { id: string }): EnrichedService {
  return {
    name: overrides.id,
    source: 'test',
    ports: [],
    dependsOn: [],
    serviceType: 'service',
    metadata: {},
    ...overrides,
  };
}

/** Helper: build a minimal scan result */
function scan(services: EnrichedService[], mode: ScanMode = 'auto'): ScanResult {
  return {
    mode,
    discoveredSpecs: [],
    services,
    parseErrors: [],
  };
}

describe('buildGraph', () => {
  it('creates one node per service', () => {
    const result = scan([
      svc({ id: 'api' }),
      svc({ id: 'db', serviceType: 'datastore', image: 'postgres:16' }),
    ]);

    const graph = buildGraph(result);

    expect(graph.nodes).toHaveLength(2);
    expect(graph.nodes.map((n) => n.id).sort()).toEqual(['api', 'db']);
  });

  it('creates edges from dependsOn relationships', () => {
    const result = scan([
      svc({ id: 'api', dependsOn: ['db'] }),
      svc({ id: 'db', serviceType: 'datastore', image: 'postgres:16' }),
    ]);

    const graph = buildGraph(result);

    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({
      id: 'api->db',
      source: 'api',
      target: 'db',
    });
  });

  it('classifies edges to datastores as "datastore"', () => {
    const result = scan([
      svc({ id: 'api', dependsOn: ['pg'] }),
      svc({ id: 'pg', serviceType: 'datastore', image: 'postgres:16' }),
    ]);

    const graph = buildGraph(result);
    expect(graph.edges[0].type).toBe('datastore');
    expect(graph.edges[0].label).toBe('postgres');
  });

  it('classifies edges to caches as "datastore"', () => {
    const result = scan([
      svc({ id: 'api', dependsOn: ['cache'] }),
      svc({ id: 'cache', serviceType: 'cache', image: 'redis:7' }),
    ]);

    const graph = buildGraph(result);
    expect(graph.edges[0].type).toBe('datastore');
  });

  it('classifies edges to services with OpenAPI specs as "api"', () => {
    const result = scan([
      svc({ id: 'gateway', dependsOn: ['users'] }),
      svc({
        id: 'users',
        openapi: {
          filePath: '/specs/users.json',
          title: 'Users API',
          version: '1.0',
          endpoints: [],
        },
      }),
    ]);

    const graph = buildGraph(result);
    expect(graph.edges[0].type).toBe('api');
    expect(graph.edges[0].label).toBe('Users API');
  });

  it('classifies other edges as "dependency"', () => {
    const result = scan([
      svc({ id: 'api', dependsOn: ['worker'] }),
      svc({ id: 'worker' }),
    ]);

    const graph = buildGraph(result);
    expect(graph.edges[0].type).toBe('dependency');
    expect(graph.edges[0].label).toBeUndefined();
  });

  it('skips edges to unknown services', () => {
    const result = scan([
      svc({ id: 'api', dependsOn: ['nonexistent'] }),
    ]);

    const graph = buildGraph(result);
    expect(graph.edges).toHaveLength(0);
  });

  it('deduplicates edges', () => {
    // If the same dependency appears twice in dependsOn
    const result = scan([
      svc({ id: 'api', dependsOn: ['db', 'db'] }),
      svc({ id: 'db', serviceType: 'datastore', image: 'postgres:16' }),
    ]);

    const graph = buildGraph(result);
    expect(graph.edges).toHaveLength(1);
  });

  it('assigns dagre positions to all nodes', () => {
    const result = scan([
      svc({ id: 'gateway', dependsOn: ['api'] }),
      svc({ id: 'api', dependsOn: ['db'] }),
      svc({ id: 'db', serviceType: 'datastore', image: 'postgres:16' }),
    ]);

    const graph = buildGraph(result);

    // All nodes should have positions (dagre sets x, y)
    for (const node of graph.nodes) {
      expect(typeof node.x).toBe('number');
      expect(typeof node.y).toBe('number');
      expect(node.x).toBeGreaterThan(0);
      expect(node.y).toBeGreaterThan(0);
    }

    // With LR layout, gateway should be leftmost, db rightmost
    const gw = graph.nodes.find((n) => n.id === 'gateway')!;
    const api = graph.nodes.find((n) => n.id === 'api')!;
    const db = graph.nodes.find((n) => n.id === 'db')!;

    expect(gw.x).toBeLessThan(api.x);
    expect(api.x).toBeLessThan(db.x);
  });

  it('propagates service metadata to nodes', () => {
    const result = scan([
      svc({
        id: 'api',
        serviceType: 'service',
        ports: [{ host: 8080, container: 3000 }],
        source: 'docker-compose',
        openapi: {
          filePath: '/specs/api.json',
          title: 'My API',
          version: '2.0',
          endpoints: [{ method: 'get', path: '/health', responses: [] }],
        },
      }),
    ]);

    const graph = buildGraph(result);
    const node = graph.nodes[0];

    expect(node.serviceType).toBe('service');
    expect(node.ports).toEqual([{ host: 8080, container: 3000 }]);
    expect(node.hasSpec).toBe(true);
    expect(node.source).toBe('docker-compose');
  });

  it('handles empty scan result', () => {
    const result = scan([]);
    const graph = buildGraph(result);

    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
  });

  it('handles complex multi-service graph', () => {
    const result = scan([
      svc({ id: 'gateway', dependsOn: ['user-api', 'order-api'] }),
      svc({
        id: 'user-api',
        dependsOn: ['postgres', 'redis'],
        openapi: {
          filePath: '/specs/users.json',
          title: 'User Service',
          version: '1.0',
          endpoints: [],
        },
      }),
      svc({
        id: 'order-api',
        dependsOn: ['postgres', 'rabbitmq'],
        openapi: {
          filePath: '/specs/orders.json',
          title: 'Order Service',
          version: '1.0',
          endpoints: [],
        },
      }),
      svc({ id: 'postgres', serviceType: 'datastore', image: 'postgres:16' }),
      svc({ id: 'redis', serviceType: 'cache', image: 'redis:7' }),
      svc({ id: 'rabbitmq', serviceType: 'message-broker', image: 'rabbitmq:3' }),
    ]);

    const graph = buildGraph(result);

    expect(graph.nodes).toHaveLength(6);
    // gateway→user-api, gateway→order-api, user-api→postgres, user-api→redis,
    // order-api→postgres, order-api→rabbitmq
    expect(graph.edges).toHaveLength(6);

    // Check edge types
    const edgeMap = new Map(graph.edges.map((e) => [e.id, e]));
    expect(edgeMap.get('gateway->user-api')!.type).toBe('api');
    expect(edgeMap.get('gateway->order-api')!.type).toBe('api');
    expect(edgeMap.get('user-api->postgres')!.type).toBe('datastore');
    expect(edgeMap.get('user-api->redis')!.type).toBe('datastore');
    expect(edgeMap.get('order-api->postgres')!.type).toBe('datastore');
    // rabbitmq is message-broker, not datastore/cache, no spec → dependency
    expect(edgeMap.get('order-api->rabbitmq')!.type).toBe('dependency');
  });
});
