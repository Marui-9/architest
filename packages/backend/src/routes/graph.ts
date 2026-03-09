import { FastifyPluginAsync } from 'fastify';
import type { ArchitectureGraph, ScanResult } from '../types.js';
import { buildGraph } from '../graph/builder.js';
import { scanProject } from '../parsers/scanProject.js';
import type { ScanMode } from '../types.js';

/**
 * In-memory graph state. Populated by POST /api/scan or GET /api/graph?refresh.
 * In the future this could be backed by a store, but for MVP in-memory is fine.
 */
let currentGraph: ArchitectureGraph | null = null;

/** Last scan result — needed by the contract test runner for OpenAPI specs */
let currentScanResult: ScanResult | null = null;

/** Expose for testing */
export function resetGraphState(): void {
  currentGraph = null;
  currentScanResult = null;
}

export function setGraphState(graph: ArchitectureGraph, scanResult?: ScanResult): void {
  currentGraph = graph;
  if (scanResult) currentScanResult = scanResult;
}

export function getGraphState(): ArchitectureGraph | null {
  return currentGraph;
}

export function getScanResult(): ScanResult | null {
  return currentScanResult;
}

const VALID_MODES: ScanMode[] = ['compose', 'daemon', 'auto'];

export const graphRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /api/graph
   * Returns the current architecture graph.
   * If no graph has been built yet, returns 404.
   */
  app.get('/graph', async (_request, reply) => {
    if (!currentGraph) {
      return reply.status(404).send({
        error: 'No graph available. Run a scan first via POST /api/scan.',
      });
    }
    return currentGraph;
  });

  /**
   * POST /api/graph
   * Scan + build graph in a single call. Accepts same body as POST /api/scan.
   */
  app.post<{ Body: { projectPath?: string; mode?: ScanMode } }>(
    '/graph',
    async (request, reply) => {
      const { projectPath, mode = 'auto' } = request.body ?? {};

      if (!VALID_MODES.includes(mode)) {
        return reply.status(400).send({
          error: `Invalid scan mode: "${mode}". Must be one of: ${VALID_MODES.join(', ')}`,
        });
      }

      try {
        const scanResult = await scanProject(projectPath, mode);
        currentGraph = buildGraph(scanResult);
        currentScanResult = scanResult;
        return currentGraph;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return reply.status(422).send({
          error: 'Graph build failed',
          detail: message,
        });
      }
    },
  );

  /**
   * GET /api/graph/edge/:id
   * Returns details about a specific edge.
   */
  app.get<{ Params: { id: string } }>('/graph/edge/:id', async (request, reply) => {
    if (!currentGraph) {
      return reply.status(404).send({
        error: 'No graph available. Run a scan first.',
      });
    }

    const edgeId = decodeURIComponent(request.params.id);
    const edge = currentGraph.edges.find((e) => e.id === edgeId);

    if (!edge) {
      return reply.status(404).send({
        error: `Edge "${edgeId}" not found.`,
        available: currentGraph.edges.map((e) => e.id),
      });
    }

    // Find source and target nodes for enriched response
    const sourceNode = currentGraph.nodes.find((n) => n.id === edge.source);
    const targetNode = currentGraph.nodes.find((n) => n.id === edge.target);

    // Include OpenAPI spec for the target service if available
    const targetService = currentScanResult?.services.find((s) => s.id === edge.target);
    const openapi = targetService?.openapi
      ? {
          filePath: targetService.openapi.filePath,
          title: targetService.openapi.title,
          version: targetService.openapi.version,
          baseUrl: targetService.openapi.baseUrl,
          endpoints: targetService.openapi.endpoints.map((ep) => ({
            method: ep.method,
            path: ep.path,
            summary: ep.summary,
            operationId: ep.operationId,
          })),
        }
      : undefined;

    return {
      edge,
      sourceNode: sourceNode ?? null,
      targetNode: targetNode ?? null,
      openapi,
    };
  });
};
