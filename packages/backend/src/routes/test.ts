import { FastifyPluginAsync } from 'fastify';
import { getGraphState, getScanResult } from './graph.js';
import { runContractTests } from '../testing/contractRunner.js';
import { probeHealth } from '../testing/healthProbe.js';
import type { ContractTestResult, HealthProbeResult } from '../types.js';

export const testRoutes: FastifyPluginAsync = async (app) => {
  /**
   * POST /api/test/contract
   * Run contract tests for an API edge.
   * Body: { edgeId: string }
   */
  app.post<{ Body: { edgeId: string } }>('/test/contract', async (request, reply) => {
    const { edgeId } = request.body ?? {};
    if (!edgeId) {
      return reply.status(400).send({ error: 'Missing edgeId' });
    }

    const graph = getGraphState();
    if (!graph) {
      return reply.status(404).send({ error: 'No graph available. Run a scan first.' });
    }

    const edge = graph.edges.find((e) => e.id === edgeId);
    if (!edge) {
      return reply.status(404).send({ error: `Edge "${edgeId}" not found.` });
    }

    if (edge.type !== 'api') {
      return reply.status(400).send({
        error: `Edge "${edgeId}" is type "${edge.type}", not "api". Use /test/health instead.`,
      });
    }

    const scanResult = getScanResult();
    const targetNode = graph.nodes.find((n) => n.id === edge.target);
    if (!targetNode) {
      return reply.status(404).send({ error: `Target node "${edge.target}" not found.` });
    }

    // Find the enriched service with OpenAPI spec
    const targetService = scanResult?.services.find((s) => s.id === edge.target);
    if (!targetService) {
      return reply.status(404).send({
        error: `Service "${edge.target}" not found in scan results. Re-scan may be needed.`,
      });
    }

    const result = await runContractTests(edge, targetNode, targetService);
    return result;
  });

  /**
   * POST /api/test/health
   * Run a health/connectivity probe for an edge.
   * Body: { edgeId: string }
   */
  app.post<{ Body: { edgeId: string } }>('/test/health', async (request, reply) => {
    const { edgeId } = request.body ?? {};
    if (!edgeId) {
      return reply.status(400).send({ error: 'Missing edgeId' });
    }

    const graph = getGraphState();
    if (!graph) {
      return reply.status(404).send({ error: 'No graph available. Run a scan first.' });
    }

    const edge = graph.edges.find((e) => e.id === edgeId);
    if (!edge) {
      return reply.status(404).send({ error: `Edge "${edgeId}" not found.` });
    }

    const targetNode = graph.nodes.find((n) => n.id === edge.target);
    if (!targetNode) {
      return reply.status(404).send({ error: `Target node "${edge.target}" not found.` });
    }

    const result = await probeHealth(edgeId, targetNode);
    return result;
  });

  /**
   * WebSocket /api/test/ws
   * Stream test results in real-time.
   *
   * Client sends: { type: "contract" | "health", edgeId: string }
   * Server streams: progress events + final result
   */
  app.get('/test/ws', { websocket: true }, (socket, _request) => {
    socket.on('message', async (raw: Buffer | string) => {
      let msg: { type: string; edgeId: string };
      try {
        msg = JSON.parse(String(raw));
      } catch {
        socket.send(JSON.stringify({ event: 'error', error: 'Invalid JSON' }));
        return;
      }

      const { type, edgeId } = msg;
      if (!type || !edgeId) {
        socket.send(JSON.stringify({ event: 'error', error: 'Missing type or edgeId' }));
        return;
      }

      const graph = getGraphState();
      if (!graph) {
        socket.send(JSON.stringify({ event: 'error', error: 'No graph available' }));
        return;
      }

      const edge = graph.edges.find((e) => e.id === edgeId);
      if (!edge) {
        socket.send(JSON.stringify({ event: 'error', error: `Edge "${edgeId}" not found` }));
        return;
      }

      const targetNode = graph.nodes.find((n) => n.id === edge.target);
      if (!targetNode) {
        socket.send(JSON.stringify({ event: 'error', error: 'Target node not found' }));
        return;
      }

      if (type === 'contract') {
        const scanResult = getScanResult();
        const targetService = scanResult?.services.find((s) => s.id === edge.target);
        if (!targetService) {
          socket.send(
            JSON.stringify({ event: 'error', error: 'Service not found in scan results' }),
          );
          return;
        }

        socket.send(JSON.stringify({ event: 'start', type: 'contract', edgeId }));

        try {
          const result = await runContractTests(edge, targetNode, targetService, {
            onProgress: (epResult, index, total) => {
              socket.send(
                JSON.stringify({
                  event: 'progress',
                  type: 'contract',
                  edgeId,
                  index,
                  total,
                  endpointResult: epResult,
                }),
              );
            },
          });

          socket.send(JSON.stringify({ event: 'complete', type: 'contract', edgeId, result }));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          socket.send(JSON.stringify({ event: 'error', error: `Contract test error: ${message}` }));
        }
      } else if (type === 'health') {
        socket.send(JSON.stringify({ event: 'start', type: 'health', edgeId }));

        try {
          const result = await probeHealth(edgeId, targetNode);

          socket.send(JSON.stringify({ event: 'complete', type: 'health', edgeId, result }));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          socket.send(JSON.stringify({ event: 'error', error: `Health probe error: ${message}` }));
        }
      } else {
        socket.send(JSON.stringify({ event: 'error', error: `Unknown type: "${type}"` }));
      }
    });
  });
};
