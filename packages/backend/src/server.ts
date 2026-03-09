import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanRoutes } from './routes/scan.js';
import { graphRoutes } from './routes/graph.js';
import { testRoutes } from './routes/test.js';
import { evaluateRoutes } from './routes/evaluate.js';

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
  await app.register(evaluateRoutes, { prefix: '/api' });

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
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EADDRINUSE') {
      app.log.error(`Port ${port} is already in use. Set a different port with PORT=<number>.`);
    } else if (code === 'EACCES') {
      app.log.error(
        `Permission denied binding to port ${port}. Use a port above 1024 or run with elevated privileges.`,
      );
    } else {
      app.log.error(err);
    }
    process.exit(1);
  }
}

// Only start the server when this module is the entry point
const isMainModule =
  process.argv[1] &&
  import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  start();
}
