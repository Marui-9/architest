import { FastifyPluginAsync } from 'fastify';

// Placeholder — will be implemented in Phase 5
export const testRoutes: FastifyPluginAsync = async (app) => {
  app.post('/test/run', async (_request, reply) => {
    return reply.status(501).send({ error: 'Not implemented' });
  });
};
