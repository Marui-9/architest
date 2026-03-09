import path from 'node:path';
import type { ScanResult, ScanMode, InfrastructureAdapter, AdapterContext, DiscoveredService } from '../types.js';
import { parseProjectCompose } from './dockerCompose.js';
import { discoverOpenAPISpecs, parseOpenAPISpec } from './openapi.js';
import { associateSpecsToServices } from './associate.js';
import { dockerComposeAdapter, composeToDiscoveredServices } from '../adapters/dockerCompose.js';
import { dockerDaemonAdapter } from '../adapters/dockerDaemon.js';

/**
 * Registry of available infrastructure adapters.
 */
const adapters: InfrastructureAdapter[] = [
  dockerComposeAdapter,
  dockerDaemonAdapter,
];

/**
 * Select which adapters to run based on the scan mode.
 */
async function selectAdapters(
  mode: ScanMode,
  context: AdapterContext,
): Promise<InfrastructureAdapter[]> {
  if (mode === 'compose') {
    return adapters.filter((a) => a.id === 'docker-compose');
  }
  if (mode === 'daemon') {
    return adapters.filter((a) => a.id === 'docker-daemon');
  }
  // auto: return all adapters that detect something
  const detected: InfrastructureAdapter[] = [];
  for (const adapter of adapters) {
    if (await adapter.detect(context)) {
      detected.push(adapter);
    }
  }
  return detected;
}

/**
 * Merge services from multiple adapters, deduplicating by name.
 * First adapter to claim a name wins.
 */
function mergeServices(serviceGroups: DiscoveredService[][]): DiscoveredService[] {
  const seen = new Set<string>();
  const merged: DiscoveredService[] = [];

  for (const group of serviceGroups) {
    for (const service of group) {
      if (!seen.has(service.id)) {
        seen.add(service.id);
        merged.push(service);
      }
    }
  }

  return merged;
}

/**
 * Discover OpenAPI specs from project root and service build contexts.
 */
function discoverAllSpecs(
  projectPath: string,
  services: DiscoveredService[],
): string[] {
  const discoveredSpecs = discoverOpenAPISpecs(projectPath);

  for (const service of services) {
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

  return discoveredSpecs;
}

/**
 * Scan a project directory using the adapter-based pipeline:
 * 1. Run infrastructure adapters to discover services
 * 2. Discover OpenAPI spec files (if projectPath available)
 * 3. Parse each discovered spec
 * 4. Associate specs to services
 *
 * Returns a complete ScanResult.
 */
export async function scanProject(
  projectPath?: string,
  mode: ScanMode = 'auto',
): Promise<ScanResult> {
  const context: AdapterContext = { projectPath };

  // Step 1: Select and run adapters
  const selectedAdapters = await selectAdapters(mode, context);

  if (selectedAdapters.length === 0) {
    throw new Error(
      projectPath
        ? `No infrastructure found in ${projectPath}. Looked for: docker-compose.yml`
        : 'No infrastructure source available. Provide a project path or mount the Docker socket.',
    );
  }

  const serviceGroups: DiscoveredService[][] = [];
  for (const adapter of selectedAdapters) {
    const discovered = await adapter.discover(context);
    serviceGroups.push(discovered);
  }

  const allServices = mergeServices(serviceGroups);

  // Step 2: Get compose result if available (for backward compat in ScanResult)
  const parseErrors: Array<{ filePath: string; error: string }> = [];
  let compose;
  if (projectPath && selectedAdapters.some((a) => a.id === 'docker-compose')) {
    try {
      compose = parseProjectCompose(projectPath);
    } catch (err) {
      // Compose result is optional metadata when the adapter already provided services.
      // Track the error for visibility but don't fail the scan.
      const message = err instanceof Error ? err.message : String(err);
      parseErrors.push({ filePath: `${projectPath}/docker-compose.yml`, error: message });
    }
  }

  // Step 3: Discover and parse OpenAPI specs (only if we have a project path)
  let discoveredSpecs: string[] = [];
  const parsedSpecs = [];

  if (projectPath) {
    discoveredSpecs = discoverAllSpecs(projectPath, allServices);

    for (const specPath of discoveredSpecs) {
      try {
        const parsed = parseOpenAPISpec(specPath);
        parsedSpecs.push(parsed);
      } catch (err) {
        parseErrors.push({
          filePath: specPath,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // Step 4: Associate specs to services
  const services = associateSpecsToServices(
    allServices,
    parsedSpecs,
    projectPath ?? '',
  );

  return {
    projectPath,
    mode,
    compose,
    discoveredSpecs,
    services,
    parseErrors,
  };
}
