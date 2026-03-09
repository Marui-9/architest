import type {
  InfrastructureAdapter,
  AdapterContext,
  DiscoveredService,
  DockerComposeResult,
} from '../types.js';
import { parseProjectCompose } from '../parsers/dockerCompose.js';
import { classifyServiceType } from './serviceType.js';

/**
 * Convert a Docker Compose parse result into source-agnostic DiscoveredServices.
 */
export function composeToDiscoveredServices(
  compose: DockerComposeResult,
): DiscoveredService[] {
  return compose.services.map((svc) => ({
    id: svc.name,
    name: svc.name,
    source: 'docker-compose',
    image: svc.image,
    build: svc.build,
    ports: svc.ports,
    dependsOn: svc.dependsOn,
    serviceType: classifyServiceType(svc.image),
    metadata: {
      composeFilePath: compose.filePath,
      composeVersion: compose.version,
    },
  }));
}

/**
 * Infrastructure adapter that discovers services from docker-compose.yml files.
 */
export const dockerComposeAdapter: InfrastructureAdapter = {
  id: 'docker-compose',
  name: 'Docker Compose',

  async detect(context: AdapterContext): Promise<boolean> {
    if (!context.projectPath) return false;
    try {
      // Try to find a compose file — throws if none found
      const { findComposeFile } = await import('../parsers/dockerCompose.js');
      return findComposeFile(context.projectPath) !== null;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'EACCES' || code === 'EPERM') {
        throw new Error(
          `Permission denied scanning ${context.projectPath} for compose files. Check directory permissions.`,
        );
      }
      // Other errors (dir doesn't exist, etc.) → not detected
      return false;
    }
  },

  async discover(context: AdapterContext): Promise<DiscoveredService[]> {
    if (!context.projectPath) {
      throw new Error('Docker Compose adapter requires a projectPath');
    }
    const compose = parseProjectCompose(context.projectPath);
    return composeToDiscoveredServices(compose);
  },
};
