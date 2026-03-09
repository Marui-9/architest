import { describe, it, expect, beforeEach } from 'vitest';
import { resetGraphState, setGraphState } from './graph.js';
import type { ArchitectureGraph } from '../types.js';
import { evaluate } from '../guardrails/evaluate.js';

describe('evaluate route logic', () => {
  beforeEach(() => {
    resetGraphState();
  });

  it('evaluates a clean graph via the evaluate function', () => {
    const graph: ArchitectureGraph = {
      nodes: [
        {
          id: 'api',
          label: 'api',
          serviceType: 'service',
          image: 'node:22',
          ports: [{ host: 3000, container: 3000 }],
          hasSpec: true,
          x: 0,
          y: 0,
          width: 180,
          height: 60,
          source: 'docker-compose',
        },
        {
          id: 'db',
          label: 'db',
          serviceType: 'datastore',
          image: 'postgres:16',
          ports: [],
          hasSpec: false,
          x: 200,
          y: 0,
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

    setGraphState(graph);
    const result = evaluate(graph);

    expect(result.score).toBe(100);
    expect(result.totalFindings).toBe(0);
    expect(result.rulesEvaluated).toHaveLength(10);
  });

  it('produces findings for a problematic architecture', () => {
    const graph: ArchitectureGraph = {
      nodes: [
        {
          id: 'frontend',
          label: 'frontend',
          serviceType: 'service',
          image: 'nginx:latest',
          ports: [{ host: 80, container: 80 }],
          hasSpec: false,
          x: 0,
          y: 0,
          width: 180,
          height: 60,
          source: 'docker-compose',
        },
        {
          id: 'pg',
          label: 'pg',
          serviceType: 'datastore',
          image: 'postgres',
          ports: [{ host: 5432, container: 5432 }],
          hasSpec: false,
          x: 200,
          y: 0,
          width: 180,
          height: 60,
          source: 'docker-compose',
        },
      ],
      edges: [
        {
          id: 'frontend->pg',
          source: 'frontend',
          target: 'pg',
          type: 'datastore',
        },
      ],
    };

    const result = evaluate(graph);

    // Expected findings:
    // - no-public-db: pg has port 5432 → error
    // - no-direct-db-from-frontend: frontend→pg → error
    // - missing-api-spec: frontend has port but no spec → info
    // - image-tag-latest: nginx:latest → warning
    // - image-tag-latest: postgres (no tag) → warning
    expect(result.totalFindings).toBeGreaterThanOrEqual(4);
    expect(result.score).toBeLessThan(80);

    const ruleIds = result.findings.map((f) => f.ruleId);
    expect(ruleIds).toContain('no-public-db');
    expect(ruleIds).toContain('no-direct-db-from-frontend');
    expect(ruleIds).toContain('image-tag-latest');
  });
});
