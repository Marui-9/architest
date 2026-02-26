import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanRoutes } from './routes/scan.js';
import { graphRoutes } from './routes/graph.js';
import { testRoutes } from './routes/test.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    },
  });

  await app.register(cors, { origin: true });
  await app.register(websocket);

  // API routes
  await app.register(scanRoutes, { prefix: '/api' });
  await app.register(graphRoutes, { prefix: '/api' });
  await app.register(testRoutes, { prefix: '/api' });

  // Health check
  app.get('/api/health', async () => ({ status: 'ok' }));

  // Serve frontend static files in production
  const publicDir = path.join(__dirname, 'public');
  await app.register(fastifyStatic, {
    root: publicDir,
    wildcard: false,
  });

  // SPA fallback
  app.setNotFoundHandler((_request, reply) => {
    return reply.sendFile('index.html');
  });

  return app;
}

async function start() {
  const app = await buildApp();
  const port = Number(process.env.PORT) || 3000;

  try {
    await app.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
