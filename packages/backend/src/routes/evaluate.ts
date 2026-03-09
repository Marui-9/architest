import { FastifyPluginAsync } from 'fastify';
import { getGraphState } from './graph.js';
import { evaluate } from '../guardrails/evaluate.js';

export const evaluateRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /api/evaluate
   * Evaluate the current architecture graph against all guardrail rules.
   * Returns findings + score (0-100).
   */
  app.get('/evaluate', async (_request, reply) => {
    const graph = getGraphState();

    if (!graph) {
      return reply.status(404).send({
        error: 'No graph available. Run a scan first via POST /api/scan.',
      });
    }

    return evaluate(graph);
  });
};
