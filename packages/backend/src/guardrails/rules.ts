import type {
  ArchitectureGraph,
  GuardrailRule,
  Finding,
  FindingSeverity,
  GraphNode,
  GraphEdge,
} from '../types.js';

// ─── Rule 1: no-public-db ───────────────────────────────────────────────

/**
 * Databases and caches should not expose ports to the host.
 * Public datastores are a security risk.
 */
export const noPublicDb: GuardrailRule = {
  id: 'no-public-db',
  name: 'No Public Database',
  description: 'Databases and caches should not expose ports to the host',
  severity: 'error',
  evaluate(graph) {
    const findings: Finding[] = [];
    for (const node of graph.nodes) {
      if (
        (node.serviceType === 'datastore' || node.serviceType === 'cache') &&
        node.ports.length > 0
      ) {
        findings.push({
          ruleId: 'no-public-db',
          severity: 'error',
          message: `${node.label} (${node.serviceType}) exposes port(s) ${node.ports.map((p) => p.host).join(', ')} to the host`,
          targets: [node.id],
        });
      }
    }
    return findings;
  },
};

// ─── Rule 2: circular-dependency ────────────────────────────────────────

/**
 * Detect circular dependencies in the service graph.
 * Cycles create tight coupling and deployment ordering issues.
 */
export const circularDependency: GuardrailRule = {
  id: 'circular-dependency',
  name: 'Circular Dependency',
  description: 'Services should not form circular dependency chains',
  severity: 'error',
  evaluate(graph) {
    const findings: Finding[] = [];
    const cycles = findCycles(graph.nodes, graph.edges);

    for (const cycle of cycles) {
      findings.push({
        ruleId: 'circular-dependency',
        severity: 'error',
        message: `Circular dependency: ${cycle.join(' → ')} → ${cycle[0]}`,
        targets: cycle,
      });
    }
    return findings;
  },
};

/** DFS-based cycle detection */
function findCycles(nodes: GraphNode[], edges: GraphEdge[]): string[][] {
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    adjacency.set(node.id, []);
  }
  for (const edge of edges) {
    adjacency.get(edge.source)?.push(edge.target);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(nodeId: string, path: string[]): void {
    if (inStack.has(nodeId)) {
      // Found a cycle — extract the cycle portion from path
      const cycleStart = path.indexOf(nodeId);
      if (cycleStart !== -1) {
        cycles.push(path.slice(cycleStart));
      }
      return;
    }
    if (visited.has(nodeId)) return;

    visited.add(nodeId);
    inStack.add(nodeId);
    path.push(nodeId);

    for (const neighbor of adjacency.get(nodeId) ?? []) {
      dfs(neighbor, path);
    }

    path.pop();
    inStack.delete(nodeId);
  }

  for (const node of nodes) {
    dfs(node.id, []);
  }

  return cycles;
}

// ─── Rule 3: no-orphan-service ──────────────────────────────────────────

/**
 * Every service should be connected to at least one other service.
 * Orphaned services suggest misconfiguration.
 */
export const noOrphanService: GuardrailRule = {
  id: 'no-orphan-service',
  name: 'No Orphan Services',
  description: 'Every service should have at least one connection',
  severity: 'warning',
  evaluate(graph) {
    if (graph.nodes.length <= 1) return [];

    const connected = new Set<string>();
    for (const edge of graph.edges) {
      connected.add(edge.source);
      connected.add(edge.target);
    }

    const findings: Finding[] = [];
    for (const node of graph.nodes) {
      if (!connected.has(node.id)) {
        findings.push({
          ruleId: 'no-orphan-service',
          severity: 'warning',
          message: `${node.label} has no connections to other services`,
          targets: [node.id],
        });
      }
    }
    return findings;
  },
};

// ─── Rule 4: single-point-of-failure ────────────────────────────────────

/**
 * A service that many others depend on (high in-degree) is a single point of failure.
 * Threshold: more than 3 dependents.
 */
export const singlePointOfFailure: GuardrailRule = {
  id: 'single-point-of-failure',
  name: 'Single Point of Failure',
  description: 'Services with too many dependents are single points of failure',
  severity: 'warning',
  evaluate(graph) {
    const THRESHOLD = 3;
    const inDegree = new Map<string, string[]>();

    for (const node of graph.nodes) {
      inDegree.set(node.id, []);
    }
    for (const edge of graph.edges) {
      inDegree.get(edge.target)?.push(edge.source);
    }

    const findings: Finding[] = [];
    for (const [nodeId, dependents] of inDegree) {
      if (dependents.length > THRESHOLD) {
        const node = graph.nodes.find((n) => n.id === nodeId);
        findings.push({
          ruleId: 'single-point-of-failure',
          severity: 'warning',
          message: `${node?.label ?? nodeId} has ${dependents.length} dependents (${dependents.join(', ')}). Consider redundancy.`,
          targets: [nodeId],
        });
      }
    }
    return findings;
  },
};

// ─── Rule 5: no-direct-db-from-frontend ─────────────────────────────────

/**
 * Services named like frontends/UIs should not directly depend on datastores.
 * They should go through an API layer.
 */
export const noDirectDbFromFrontend: GuardrailRule = {
  id: 'no-direct-db-from-frontend',
  name: 'No Direct DB from Frontend',
  description: 'Frontend services should not connect directly to databases',
  severity: 'error',
  evaluate(graph) {
    const FRONTEND_PATTERNS = /frontend|web|ui|client|app|dashboard|portal/i;
    const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

    const findings: Finding[] = [];
    for (const edge of graph.edges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) continue;

      if (
        FRONTEND_PATTERNS.test(source.label) &&
        (target.serviceType === 'datastore' || target.serviceType === 'cache')
      ) {
        findings.push({
          ruleId: 'no-direct-db-from-frontend',
          severity: 'error',
          message: `${source.label} connects directly to ${target.label} (${target.serviceType}). Use an API gateway.`,
          targets: [source.id, target.id],
        });
      }
    }
    return findings;
  },
};

// ─── Rule 6: missing-api-spec ───────────────────────────────────────────

/**
 * Application services (not datastores/caches/brokers) that expose ports
 * should have an OpenAPI spec.
 */
export const missingApiSpec: GuardrailRule = {
  id: 'missing-api-spec',
  name: 'Missing API Spec',
  description: 'Application services with exposed ports should have an OpenAPI spec',
  severity: 'info',
  evaluate(graph) {
    const findings: Finding[] = [];
    for (const node of graph.nodes) {
      if (
        node.serviceType === 'service' &&
        node.ports.length > 0 &&
        !node.hasSpec
      ) {
        findings.push({
          ruleId: 'missing-api-spec',
          severity: 'info',
          message: `${node.label} exposes port(s) but has no OpenAPI spec`,
          targets: [node.id],
        });
      }
    }
    return findings;
  },
};

// ─── Rule 7: too-many-ports ─────────────────────────────────────────────

/**
 * A service exposing many ports may indicate poor separation of concerns.
 */
export const tooManyPorts: GuardrailRule = {
  id: 'too-many-ports',
  name: 'Too Many Ports',
  description: 'Services should not expose an excessive number of ports',
  severity: 'warning',
  evaluate(graph) {
    const THRESHOLD = 3;
    const findings: Finding[] = [];
    for (const node of graph.nodes) {
      if (node.ports.length > THRESHOLD) {
        findings.push({
          ruleId: 'too-many-ports',
          severity: 'warning',
          message: `${node.label} exposes ${node.ports.length} ports. Consider reducing surface area.`,
          targets: [node.id],
        });
      }
    }
    return findings;
  },
};

// ─── Rule 8: image-tag-latest ───────────────────────────────────────────

/**
 * Using :latest or no tag is risky for reproducibility.
 */
export const imageTagLatest: GuardrailRule = {
  id: 'image-tag-latest',
  name: 'Pinned Image Tags',
  description: 'Services should pin image tags instead of using :latest or no tag',
  severity: 'warning',
  evaluate(graph) {
    const findings: Finding[] = [];
    for (const node of graph.nodes) {
      if (!node.image) continue;

      const tag = node.image.includes(':') ? node.image.split(':').pop() : undefined;
      if (!tag || tag === 'latest') {
        findings.push({
          ruleId: 'image-tag-latest',
          severity: 'warning',
          message: `${node.label} uses image "${node.image}" without a pinned tag`,
          targets: [node.id],
        });
      }
    }
    return findings;
  },
};

// ─── Rule 9: no-public-broker ───────────────────────────────────────────

/**
 * Message brokers should not expose ports to the host.
 */
export const noPublicBroker: GuardrailRule = {
  id: 'no-public-broker',
  name: 'No Public Message Broker',
  description: 'Message brokers should not expose ports to the host',
  severity: 'warning',
  evaluate(graph) {
    const findings: Finding[] = [];
    for (const node of graph.nodes) {
      if (node.serviceType === 'message-broker' && node.ports.length > 0) {
        findings.push({
          ruleId: 'no-public-broker',
          severity: 'warning',
          message: `${node.label} (message-broker) exposes port(s) ${node.ports.map((p) => p.host).join(', ')} to the host`,
          targets: [node.id],
        });
      }
    }
    return findings;
  },
};

// ─── Rule 10: excessive-dependencies ────────────────────────────────────

/**
 * A service with too many outgoing dependencies may be doing too much.
 */
export const excessiveDependencies: GuardrailRule = {
  id: 'excessive-dependencies',
  name: 'Excessive Dependencies',
  description: 'Services should not depend on too many other services',
  severity: 'warning',
  evaluate(graph) {
    const THRESHOLD = 5;
    const outDegree = new Map<string, number>();
    for (const node of graph.nodes) {
      outDegree.set(node.id, 0);
    }
    for (const edge of graph.edges) {
      outDegree.set(edge.source, (outDegree.get(edge.source) ?? 0) + 1);
    }

    const findings: Finding[] = [];
    for (const [nodeId, count] of outDegree) {
      if (count > THRESHOLD) {
        const node = graph.nodes.find((n) => n.id === nodeId);
        findings.push({
          ruleId: 'excessive-dependencies',
          severity: 'warning',
          message: `${node?.label ?? nodeId} depends on ${count} services. Consider decomposing.`,
          targets: [nodeId],
        });
      }
    }
    return findings;
  },
};

// ─── Exports ────────────────────────────────────────────────────────────

/** All built-in guardrail rules */
export const builtInRules: GuardrailRule[] = [
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
];
