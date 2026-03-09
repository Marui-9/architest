import { FastifyPluginAsync } from 'fastify';
import fs from 'node:fs';
import { scanProject } from '../parsers/scanProject.js';
import type { ScanMode } from '../types.js';
import { buildGraph } from '../graph/builder.js';
import { setGraphState } from './graph.js';

const VALID_MODES: ScanMode[] = ['compose', 'daemon', 'auto'];

/** Map well-known error patterns to HTTP status codes */
function classifyScanError(err: Error): { status: number; error: string; detail: string } {
  const msg = err.message;
  if (msg.includes('not found') || msg.includes('ENOENT') || msg.includes('No infrastructure found')) {
    return { status: 404, error: 'Not found', detail: msg };
  }
  if (msg.includes('Permission denied') || msg.includes('EACCES') || msg.includes('EPERM')) {
    return { status: 403, error: 'Permission denied', detail: msg };
  }
  if (msg.includes('Malformed YAML') || msg.includes('Malformed JSON') || msg.includes('parse')) {
    return { status: 400, error: 'Parse error', detail: msg };
  }
  return { status: 422, error: 'Scan failed', detail: msg };
}

export const scanRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: { projectPath?: string; mode?: ScanMode } }>('/scan', async (request, reply) => {
    const { projectPath, mode = 'auto' } = request.body ?? {};

    if (!VALID_MODES.includes(mode)) {
      return reply.status(400).send({
        error: `Invalid scan mode: "${mode}". Must be one of: ${VALID_MODES.join(', ')}`,
      });
    }

    // compose and auto modes require a project path
    if ((mode === 'compose' || mode === 'auto') && (!projectPath || typeof projectPath !== 'string')) {
      return reply.status(400).send({
        error: 'Missing or invalid projectPath',
      });
    }

    // Validate the path exists and is a directory
    if (projectPath) {
      if (!fs.existsSync(projectPath)) {
        return reply.status(404).send({
          error: `Project path does not exist: ${projectPath}`,
        });
      }
      try {
        const stat = fs.statSync(projectPath);
        if (!stat.isDirectory()) {
          return reply.status(400).send({
            error: `Project path is not a directory: ${projectPath}`,
          });
        }
      } catch (err) {
        return reply.status(403).send({
          error: `Cannot access project path: ${(err as Error).message}`,
        });
      }
    }

    try {
      const result = await scanProject(projectPath, mode);
      // Auto-build graph so GET /api/graph works after scanning
      const graph = buildGraph(result);
      setGraphState(graph, result);
      return result;
    } catch (err) {
      const classified = classifyScanError(
        err instanceof Error ? err : new Error(String(err)),
      );
      return reply.status(classified.status).send({
        error: classified.error,
        detail: classified.detail,
      });
    }
  });
};
