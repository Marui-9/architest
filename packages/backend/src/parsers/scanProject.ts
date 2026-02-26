import path from 'node:path';
import type { ScanResult } from '../types.js';
import { parseProjectCompose } from './dockerCompose.js';
import { discoverOpenAPISpecs, parseOpenAPISpec } from './openapi.js';
import { associateSpecsToServices } from './associate.js';

/**
 * Scan a project directory:
 * 1. Parse docker-compose.yml
 * 2. Discover OpenAPI spec files
 * 3. Parse each discovered spec
 * 4. Associate specs to services
 *
 * Returns a complete ScanResult.
 */
export async function scanProject(projectPath: string): Promise<ScanResult> {
  // Step 1: Parse Docker Compose
  const compose = parseProjectCompose(projectPath);

  // Step 2: Discover OpenAPI specs
  const discoveredSpecs = discoverOpenAPISpecs(projectPath);

  // Also discover specs inside each service's build context
  for (const service of compose.services) {
    if (service.build) {
      const serviceSpecs = discoverOpenAPISpecs(
        path.resolve(projectPath, service.build),
      );
      for (const sp of serviceSpecs) {
        if (!discoveredSpecs.includes(sp)) {
          discoveredSpecs.push(sp);
        }
      }
    }
  }

  // Step 3: Parse each spec (collect errors rather than throwing)
  const parsedSpecs = [];
  const parseErrors: Array<{ filePath: string; error: string }> = [];

  for (const specPath of discoveredSpecs) {
    try {
      const parsed = parseOpenAPISpec(specPath);
      parsedSpecs.push(parsed);
    } catch (err) {
      parseErrors.push({
        filePath: specPath,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  // Step 4: Associate specs to services
  const services = associateSpecsToServices(compose.services, parsedSpecs, projectPath);

  return {
    projectPath,
    compose,
    discoveredSpecs,
    services,
  };
}
