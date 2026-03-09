import dagre from '@dagrejs/dagre';
import type {
  ScanResult,
  EnrichedService,
  ArchitectureGraph,
  GraphNode,
  GraphEdge,
  EdgeType,
} from '../types.js';

// ─── Constants ──────────────────────────────────────────────────────────

/** Default node dimensions for layout */
const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;

/** Dagre layout options */
const LAYOUT_OPTIONS = {
  rankdir: 'LR' as const, // left-to-right
  nodesep: 60,
  ranksep: 120,
  edgesep: 30,
  marginx: 40,
  marginy: 40,
};

// ─── Edge classification ────────────────────────────────────────────────

/**
 * Classify the edge type based on the target service.
 *
 * - If the target is a datastore → "datastore"
 * - If the target has an OpenAPI spec → "api"
 * - Otherwise → "dependency"
 */
function classifyEdge(
  _source: EnrichedService,
  target: EnrichedService,
): EdgeType {
  if (target.serviceType === 'datastore' || target.serviceType === 'cache') {
    return 'datastore';
  }
  if (target.openapi) {
    return 'api';
  }
  return 'dependency';
}

/**
 * Build a human-readable edge label.
 */
function edgeLabel(type: EdgeType, target: EnrichedService): string | undefined {
  if (type === 'api' && target.openapi) {
    return target.openapi.title;
  }
  if (type === 'datastore') {
    // e.g. "postgres:16" → "postgres"
    return target.image?.split(':')[0]?.split('/').pop();
  }
  return undefined;
}

// ─── Graph builder ──────────────────────────────────────────────────────

/**
 * Build an architecture graph from a scan result.
 *
 * 1. Create one GraphNode per enriched service
 * 2. Create one GraphEdge per dependency relationship
 * 3. Run dagre auto-layout to compute node positions
 */
export function buildGraph(scanResult: ScanResult): ArchitectureGraph {
  const { services } = scanResult;

  // Index services by id for O(1) lookup
  const serviceMap = new Map<string, EnrichedService>();
  for (const svc of services) {
    serviceMap.set(svc.id, svc);
  }

  // Build dagre graph
  const g = new dagre.graphlib.Graph();
  g.setGraph(LAYOUT_OPTIONS);
  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes
  for (const svc of services) {
    g.setNode(svc.id, {
      label: svc.name,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });
  }

  // Build edges from dependency relationships
  const edges: GraphEdge[] = [];
  const edgeIds = new Set<string>();

  for (const svc of services) {
    for (const depId of svc.dependsOn) {
      const target = serviceMap.get(depId);
      if (!target) continue; // skip unknown deps

      const id = `${svc.id}->${depId}`;
      if (edgeIds.has(id)) continue; // deduplicate
      edgeIds.add(id);

      const type = classifyEdge(svc, target);

      edges.push({
        id,
        source: svc.id,
        target: depId,
        type,
        label: edgeLabel(type, target),
      });

      g.setEdge(svc.id, depId);
    }
  }

  // Run dagre layout
  dagre.layout(g);

  // Extract positioned nodes
  const nodes: GraphNode[] = services.map((svc) => {
    const dagreNode = g.node(svc.id);
    return {
      id: svc.id,
      label: svc.name,
      serviceType: svc.serviceType,
      image: svc.image,
      ports: svc.ports,
      hasSpec: !!svc.openapi,
      x: dagreNode?.x ?? 0,
      y: dagreNode?.y ?? 0,
      width: dagreNode?.width ?? NODE_WIDTH,
      height: dagreNode?.height ?? NODE_HEIGHT,
      source: svc.source,
    };
  });

  return { nodes, edges };
}
