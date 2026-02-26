import { FastifyPluginAsync } from 'fastify';

// Placeholder — will be implemented in Phase 2
export const graphRoutes: FastifyPluginAsync = async (app) => {
  app.get('/graph', async () => {
    return { nodes: [], edges: [] };
  });
};
