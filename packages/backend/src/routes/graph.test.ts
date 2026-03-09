import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetGraphState,
  setGraphState,
  getGraphState,
} from './graph.js';
import { buildApp } from '../server.js';
import type { ArchitectureGraph } from '../types.js';
import type { FastifyInstance } from 'fastify';

const SAMPLE_GRAPH: ArchitectureGraph = {
  nodes: [
    {
      id: 'api',
      label: 'api',
      serviceType: 'service',
      ports: [{ host: 3000, container: 3000 }],
      hasSpec: true,
      x: 100,
      y: 50,
      width: 180,
      height: 60,
      source: 'docker-compose',
    },
    {
      id: 'db',
      label: 'db',
      serviceType: 'datastore',
      ports: [{ host: 5432, container: 5432 }],
      hasSpec: false,
      x: 300,
      y: 50,
      width: 180,
      height: 60,
      source: 'docker-compose',
    },
  ],
  edges: [
    {
      id: 'api->db',
      source: 'api',
      target: 'db',
      type: 'datastore',
      label: 'postgres',
    },
  ],
};

describe('graph state management', () => {
  beforeEach(() => {
    resetGraphState();
  });

  it('starts with null state', () => {
    expect(getGraphState()).toBeNull();
  });

  it('sets and gets graph state', () => {
    setGraphState(SAMPLE_GRAPH);
    expect(getGraphState()).toBe(SAMPLE_GRAPH);
  });

  it('resets graph state', () => {
    setGraphState(SAMPLE_GRAPH);
    resetGraphState();
    expect(getGraphState()).toBeNull();
  });
});

describe('graph route – error handling', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    resetGraphState();
    app = await buildApp();
  });

  it('GET /api/graph returns 404 when no graph available', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/graph' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toContain('No graph available');
  });

  it('POST /api/graph rejects invalid mode', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/graph',
      payload: { projectPath: '/tmp', mode: 'bogus' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('Invalid scan mode');
  });
});
