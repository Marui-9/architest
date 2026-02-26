import path from 'node:path';
import type { DockerService, OpenAPIResult, EnrichedService } from '../types.js';
import { discoverServiceSpecs } from './openapi.js';

/**
 * Try to extract a port number from an OpenAPI base URL.
 * e.g. "http://localhost:8080/api" → 8080
 */
function extractPortFromUrl(url: string): number | null {
  try {
    const parsed = new URL(url);
    if (parsed.port) return parseInt(parsed.port, 10);
    // Implicit ports
    if (parsed.protocol === 'https:') return 443;
    if (parsed.protocol === 'http:') return 80;
    return null;
  } catch {
    return null;
  }
}

/**
 * Associate OpenAPI specs with Docker Compose services.
 *
 * Matching strategies (in priority order):
 * 1. **Build context co-location:** If a service has a `build` context, search for
 *    OpenAPI spec files inside that directory. First match wins.
 * 2. **Port matching:** If a spec's `servers[0].url` contains a port that matches
 *    a service's exposed container port, associate them.
 *
 * Each service gets at most one OpenAPI spec. Each spec is consumed at most once.
 */
export function associateSpecsToServices(
  services: DockerService[],
  parsedSpecs: OpenAPIResult[],
  projectPath: string,
): EnrichedService[] {
  const usedSpecPaths = new Set<string>();
  const enriched: EnrichedService[] = [];

  // --- Pass 1: Build context co-location ---
  for (const service of services) {
    let matched: OpenAPIResult | undefined;

    if (service.build) {
      // Find specs co-located with this service's build context
      const serviceSpecPaths = discoverServiceSpecs(projectPath, service.build);

      for (const specPath of serviceSpecPaths) {
        const normalized = path.resolve(specPath);
        const spec = parsedSpecs.find((s) => path.resolve(s.filePath) === normalized);
        if (spec && !usedSpecPaths.has(normalized)) {
          matched = spec;
          usedSpecPaths.add(normalized);
          break;
        }
      }
    }

    enriched.push({ ...service, openapi: matched });
  }

  // --- Pass 2: Port matching for services that don't have a spec yet ---
  for (const enrichedService of enriched) {
    if (enrichedService.openapi) continue;
    if (enrichedService.ports.length === 0) continue;

    const containerPorts = new Set(enrichedService.ports.map((p) => p.container));

    for (const spec of parsedSpecs) {
      const normalized = path.resolve(spec.filePath);
      if (usedSpecPaths.has(normalized)) continue;

      if (spec.baseUrl) {
        const specPort = extractPortFromUrl(spec.baseUrl);
        if (specPort !== null && containerPorts.has(specPort)) {
          enrichedService.openapi = spec;
          usedSpecPaths.add(normalized);
          break;
        }
      }
    }
  }

  return enriched;
}
