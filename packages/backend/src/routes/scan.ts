import { FastifyPluginAsync } from 'fastify';
import { scanProject } from '../parsers/scanProject.js';

export const scanRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: { projectPath: string } }>('/scan', async (request, reply) => {
    const { projectPath } = request.body;

    if (!projectPath || typeof projectPath !== 'string') {
      return reply.status(400).send({
        error: 'Missing or invalid projectPath',
      });
    }

    try {
      const result = await scanProject(projectPath);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return reply.status(422).send({
        error: 'Scan failed',
        detail: message,
      });
    }
  });
};
