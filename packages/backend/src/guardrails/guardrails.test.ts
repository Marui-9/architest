import { describe, it, expect } from 'vitest';
import type { ArchitectureGraph, GraphNode, GraphEdge } from '../types.js';
import {
  noPublicDb,
  circularDependency,
  noOrphanService,
  singlePointOfFailure,
  noDirectDbFromFrontend,
  missingApiSpec,
  tooManyPorts,
  imageTagLatest,
  noPublicBroker,
  excessiveDependencies,
  builtInRules,
} from './rules.js';
import { evaluate } from './evaluate.js';

// ─── Helpers ────────────────────────────────────────────────────────────

function node(overrides: Partial<GraphNode> & { id: string }): GraphNode {
  return {
    label: overrides.id,
    serviceType: 'service',
    ports: [],
    hasSpec: false,
    x: 0,
    y: 0,
    width: 180,
    height: 60,
    source: 'test',
    ...overrides,
  };
}

function edge(source: string, target: string, overrides?: Partial<GraphEdge>): GraphEdge {
  return {
    id: `${source}->${target}`,
    source,
    target,
    type: 'dependency',
    ...overrides,
  };
}

function graph(nodes: GraphNode[], edges: GraphEdge[] = []): ArchitectureGraph {
  return { nodes, edges };
}

// ─── Rule tests ─────────────────────────────────────────────────────────

describe('no-public-db', () => {
  it('flags datastores with host ports', () => {
    const g = graph([
      node({
        id: 'pg',
        serviceType: 'datastore',
        ports: [{ host: 5432, container: 5432 }],
      }),
    ]);
    const findings = noPublicDb.evaluate(g);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('error');
    expect(findings[0].targets).toEqual(['pg']);
  });

  it('flags caches with host ports', () => {
    const g = graph([
      node({
        id: 'redis',
        serviceType: 'cache',
        ports: [{ host: 6379, container: 6379 }],
      }),
    ]);
    expect(noPublicDb.evaluate(g)).toHaveLength(1);
  });

  it('passes datastores without host ports', () => {
    const g = graph([
      node({ id: 'pg', serviceType: 'datastore' }),
    ]);
    expect(noPublicDb.evaluate(g)).toHaveLength(0);
  });

  it('ignores regular services with ports', () => {
    const g = graph([
      node({
        id: 'api',
        serviceType: 'service',
        ports: [{ host: 3000, container: 3000 }],
      }),
    ]);
    expect(noPublicDb.evaluate(g)).toHaveLength(0);
  });
});

describe('circular-dependency', () => {
  it('detects a simple A→B→A cycle', () => {
    const g = graph(
      [node({ id: 'a' }), node({ id: 'b' })],
      [edge('a', 'b'), edge('b', 'a')],
    );
    const findings = circularDependency.evaluate(g);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].severity).toBe('error');
  });

  it('detects A→B→C→A cycle', () => {
    const g = graph(
      [node({ id: 'a' }), node({ id: 'b' }), node({ id: 'c' })],
      [edge('a', 'b'), edge('b', 'c'), edge('c', 'a')],
    );
    const findings = circularDependency.evaluate(g);
    expect(findings.length).toBeGreaterThan(0);
  });

  it('passes acyclic graphs', () => {
    const g = graph(
      [node({ id: 'a' }), node({ id: 'b' }), node({ id: 'c' })],
      [edge('a', 'b'), edge('a', 'c')],
    );
    expect(circularDependency.evaluate(g)).toHaveLength(0);
  });
});

describe('no-orphan-service', () => {
  it('flags disconnected services in multi-node graphs', () => {
    const g = graph(
      [node({ id: 'api' }), node({ id: 'db' }), node({ id: 'orphan' })],
      [edge('api', 'db')],
    );
    const findings = noOrphanService.evaluate(g);
    expect(findings).toHaveLength(1);
    expect(findings[0].targets).toEqual(['orphan']);
  });

  it('passes when all services are connected', () => {
    const g = graph(
      [node({ id: 'a' }), node({ id: 'b' })],
      [edge('a', 'b')],
    );
    expect(noOrphanService.evaluate(g)).toHaveLength(0);
  });

  it('skips single-node graphs', () => {
    const g = graph([node({ id: 'solo' })]);
    expect(noOrphanService.evaluate(g)).toHaveLength(0);
  });
});

describe('single-point-of-failure', () => {
  it('flags services with >3 dependents', () => {
    const g = graph(
      [
        node({ id: 'db', serviceType: 'datastore' }),
        node({ id: 'svc1' }),
        node({ id: 'svc2' }),
        node({ id: 'svc3' }),
        node({ id: 'svc4' }),
      ],
      [edge('svc1', 'db'), edge('svc2', 'db'), edge('svc3', 'db'), edge('svc4', 'db')],
    );
    const findings = singlePointOfFailure.evaluate(g);
    expect(findings).toHaveLength(1);
    expect(findings[0].targets).toEqual(['db']);
  });

  it('passes with ≤3 dependents', () => {
    const g = graph(
      [node({ id: 'db' }), node({ id: 'a' }), node({ id: 'b' }), node({ id: 'c' })],
      [edge('a', 'db'), edge('b', 'db'), edge('c', 'db')],
    );
    expect(singlePointOfFailure.evaluate(g)).toHaveLength(0);
  });
});

describe('no-direct-db-from-frontend', () => {
  it('flags frontend→datastore edges', () => {
    const g = graph(
      [
        node({ id: 'frontend', label: 'frontend' }),
        node({ id: 'pg', serviceType: 'datastore' }),
      ],
      [edge('frontend', 'pg')],
    );
    const findings = noDirectDbFromFrontend.evaluate(g);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('error');
  });

  it('detects ui/web/dashboard/client patterns', () => {
    for (const name of ['web-ui', 'dashboard', 'client-app', 'admin-portal']) {
      const g = graph(
        [node({ id: name, label: name }), node({ id: 'db', serviceType: 'datastore' })],
        [edge(name, 'db')],
      );
      expect(noDirectDbFromFrontend.evaluate(g).length).toBeGreaterThan(0);
    }
  });

  it('passes backend→datastore edges', () => {
    const g = graph(
      [node({ id: 'api' }), node({ id: 'pg', serviceType: 'datastore' })],
      [edge('api', 'pg')],
    );
    expect(noDirectDbFromFrontend.evaluate(g)).toHaveLength(0);
  });
});

describe('missing-api-spec', () => {
  it('flags services with ports but no spec', () => {
    const g = graph([
      node({
        id: 'api',
        serviceType: 'service',
        ports: [{ host: 3000, container: 3000 }],
        hasSpec: false,
      }),
    ]);
    const findings = missingApiSpec.evaluate(g);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('info');
  });

  it('passes services with spec', () => {
    const g = graph([
      node({
        id: 'api',
        serviceType: 'service',
        ports: [{ host: 3000, container: 3000 }],
        hasSpec: true,
      }),
    ]);
    expect(missingApiSpec.evaluate(g)).toHaveLength(0);
  });

  it('ignores datastores without spec', () => {
    const g = graph([
      node({
        id: 'pg',
        serviceType: 'datastore',
        ports: [{ host: 5432, container: 5432 }],
      }),
    ]);
    expect(missingApiSpec.evaluate(g)).toHaveLength(0);
  });
});

describe('too-many-ports', () => {
  it('flags services exposing >3 ports', () => {
    const g = graph([
      node({
        id: 'svc',
        ports: [
          { host: 80, container: 80 },
          { host: 443, container: 443 },
          { host: 8080, container: 8080 },
          { host: 9090, container: 9090 },
        ],
      }),
    ]);
    const findings = tooManyPorts.evaluate(g);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('warning');
  });

  it('passes services with ≤3 ports', () => {
    const g = graph([
      node({
        id: 'svc',
        ports: [
          { host: 80, container: 80 },
          { host: 443, container: 443 },
        ],
      }),
    ]);
    expect(tooManyPorts.evaluate(g)).toHaveLength(0);
  });
});

describe('image-tag-latest', () => {
  it('flags :latest tag', () => {
    const g = graph([node({ id: 'svc', image: 'nginx:latest' })]);
    const findings = imageTagLatest.evaluate(g);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('warning');
  });

  it('flags missing tag', () => {
    const g = graph([node({ id: 'svc', image: 'nginx' })]);
    expect(imageTagLatest.evaluate(g)).toHaveLength(1);
  });

  it('passes pinned tags', () => {
    const g = graph([node({ id: 'svc', image: 'nginx:1.25-alpine' })]);
    expect(imageTagLatest.evaluate(g)).toHaveLength(0);
  });

  it('skips nodes without image', () => {
    const g = graph([node({ id: 'svc' })]);
    expect(imageTagLatest.evaluate(g)).toHaveLength(0);
  });
});

describe('no-public-broker', () => {
  it('flags brokers with host ports', () => {
    const g = graph([
      node({
        id: 'rmq',
        serviceType: 'message-broker',
        ports: [{ host: 5672, container: 5672 }],
      }),
    ]);
    const findings = noPublicBroker.evaluate(g);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('warning');
  });

  it('passes brokers without ports', () => {
    const g = graph([
      node({ id: 'rmq', serviceType: 'message-broker' }),
    ]);
    expect(noPublicBroker.evaluate(g)).toHaveLength(0);
  });
});

describe('excessive-dependencies', () => {
  it('flags services with >5 outgoing edges', () => {
    const targets = ['a', 'b', 'c', 'd', 'e', 'f'];
    const g = graph(
      [node({ id: 'hub' }), ...targets.map((id) => node({ id }))],
      targets.map((t) => edge('hub', t)),
    );
    const findings = excessiveDependencies.evaluate(g);
    expect(findings).toHaveLength(1);
    expect(findings[0].targets).toEqual(['hub']);
  });

  it('passes services with ≤5 deps', () => {
    const g = graph(
      [node({ id: 'hub' }), node({ id: 'a' }), node({ id: 'b' })],
      [edge('hub', 'a'), edge('hub', 'b')],
    );
    expect(excessiveDependencies.evaluate(g)).toHaveLength(0);
  });
});

// ─── Built-in rules registry ───────────────────────────────────────────

describe('builtInRules', () => {
  it('has exactly 10 rules', () => {
    expect(builtInRules).toHaveLength(10);
  });

  it('all rules have unique ids', () => {
    const ids = builtInRules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─── Evaluator / Scorer ─────────────────────────────────────────────────

describe('evaluate', () => {
  it('returns score 100 for clean architecture', () => {
    const g = graph(
      [
        node({ id: 'api', hasSpec: true, ports: [{ host: 3000, container: 3000 }], image: 'node:22' }),
        node({ id: 'db', serviceType: 'datastore', image: 'postgres:16' }),
      ],
      [edge('api', 'db', { type: 'datastore' })],
    );

    const result = evaluate(g);
    expect(result.score).toBe(100);
    expect(result.totalFindings).toBe(0);
    expect(result.counts).toEqual({ error: 0, warning: 0, info: 0 });
    expect(result.rulesEvaluated).toHaveLength(10);
  });

  it('deducts 15 per error finding', () => {
    // Public DB → 1 error
    const g = graph([
      node({
        id: 'pg',
        serviceType: 'datastore',
        ports: [{ host: 5432, container: 5432 }],
        image: 'postgres:16',
      }),
    ]);

    const result = evaluate(g);
    expect(result.counts.error).toBeGreaterThanOrEqual(1);
    // Score should be 100 - (errors * 15) - (warnings * 5) - (infos * 1)
    const expected =
      100 -
      result.counts.error * 15 -
      result.counts.warning * 5 -
      result.counts.info * 1;
    expect(result.score).toBe(Math.max(0, expected));
  });

  it('clamps score at 0', () => {
    // Many public datastores → lots of errors
    const nodes = Array.from({ length: 10 }, (_, i) =>
      node({
        id: `db${i}`,
        serviceType: 'datastore',
        ports: [{ host: 5432 + i, container: 5432 + i }],
        image: 'postgres',
      }),
    );
    const g = graph(nodes);

    const result = evaluate(g);
    expect(result.score).toBe(0);
  });

  it('accepts custom rules subset', () => {
    const g = graph([
      node({
        id: 'pg',
        serviceType: 'datastore',
        ports: [{ host: 5432, container: 5432 }],
      }),
    ]);

    // Only run no-public-db
    const result = evaluate(g, [noPublicDb]);
    expect(result.rulesEvaluated).toEqual(['no-public-db']);
    expect(result.totalFindings).toBe(1);
  });

  it('handles empty graph gracefully', () => {
    const g = graph([]);
    const result = evaluate(g);
    expect(result.score).toBe(100);
    expect(result.totalFindings).toBe(0);
  });

  it('scores a complex architecture', () => {
    const g = graph(
      [
        node({
          id: 'frontend',
          label: 'frontend',
          ports: [{ host: 80, container: 80 }],
          image: 'nginx:1.25',
          hasSpec: false,
        }),
        node({
          id: 'api',
          ports: [{ host: 3000, container: 3000 }],
          image: 'node:22',
          hasSpec: true,
        }),
        node({
          id: 'pg',
          serviceType: 'datastore',
          image: 'postgres:16',
        }),
      ],
      [edge('frontend', 'api'), edge('api', 'pg', { type: 'datastore' })],
    );

    const result = evaluate(g);
    // frontend has no spec but it's a "service" with port → missing-api-spec (info, -1)
    // Otherwise clean
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.totalFindings).toBeGreaterThanOrEqual(1);
  });
});
