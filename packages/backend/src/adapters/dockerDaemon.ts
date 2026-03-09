import Dockerode from 'dockerode';
import type {
  InfrastructureAdapter,
  AdapterContext,
  DiscoveredService,
  PortMapping,
} from '../types.js';
import { classifyServiceType } from './serviceType.js';

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Convert Docker API port entries to our PortMapping type.
 */
function extractPorts(ports: Dockerode.Port[]): PortMapping[] {
  return ports
    .filter((p) => p.PublicPort != null)
    .map((p) => ({
      host: p.PublicPort,
      container: p.PrivatePort,
      protocol: p.Type ?? 'tcp',
    }));
}

/**
 * Clean up a container name returned by Docker (strip leading `/`).
 */
function cleanName(name: string): string {
  return name.replace(/^\//, '');
}

/**
 * Pick the best display name from Docker container names.
 * Docker returns names like ["/myapp"], we take the shortest.
 */
function pickName(names: string[]): string {
  if (names.length === 0) return 'unknown';
  return names
    .map(cleanName)
    .sort((a, b) => a.length - b.length)[0];
}

/**
 * Infer dependencies between containers based on shared user-defined networks.
 * Containers sharing a non-default network are considered connected.
 * We avoid default networks (bridge, host, none) since they don't imply intent.
 */
function inferDependencies(
  containers: Dockerode.ContainerInfo[],
): Map<string, string[]> {
  const DEFAULT_NETWORKS = new Set(['bridge', 'host', 'none']);

  // Build: network → [container name, ...]
  const networkMembers = new Map<string, string[]>();

  for (const container of containers) {
    const name = pickName(container.Names);
    const networks = Object.keys(container.NetworkSettings?.Networks ?? {});

    for (const net of networks) {
      if (DEFAULT_NETWORKS.has(net)) continue;
      if (!networkMembers.has(net)) networkMembers.set(net, []);
      networkMembers.get(net)!.push(name);
    }
  }

  // For each container, its dependencies are all other containers on the same
  // user-defined network(s). This is symmetrical — we list peers, not direction.
  const deps = new Map<string, string[]>();

  for (const [, members] of networkMembers) {
    for (const member of members) {
      if (!deps.has(member)) deps.set(member, []);
      for (const peer of members) {
        if (peer !== member && !deps.get(member)!.includes(peer)) {
          deps.get(member)!.push(peer);
        }
      }
    }
  }

  return deps;
}

/**
 * Convert a list of Docker containers into DiscoveredService[].
 * Exported for direct use in tests and for programmatic access.
 */
export function containersToDiscoveredServices(
  containers: Dockerode.ContainerInfo[],
): DiscoveredService[] {
  const depMap = inferDependencies(containers);

  return containers.map((c) => {
    const name = pickName(c.Names);
    return {
      id: name,
      name,
      source: 'docker-daemon',
      image: c.Image,
      ports: extractPorts(c.Ports ?? []),
      dependsOn: depMap.get(name) ?? [],
      serviceType: classifyServiceType(c.Image),
      metadata: {
        containerId: c.Id,
        state: c.State,
        status: c.Status,
        labels: c.Labels ?? {},
        networks: Object.keys(c.NetworkSettings?.Networks ?? {}),
      },
    };
  });
}

// ─── Adapter ────────────────────────────────────────────────────────────

/**
 * Create a Dockerode instance. Accepts an optional socketPath for testing.
 */
export function createDockerClient(
  socketPath = '/var/run/docker.sock',
): Dockerode {
  return new Dockerode({ socketPath });
}

/**
 * Infrastructure adapter that discovers running containers from the Docker daemon
 * via the Docker socket (`/var/run/docker.sock`).
 */
export const dockerDaemonAdapter: InfrastructureAdapter = {
  id: 'docker-daemon',
  name: 'Docker Daemon',

  async detect(_context: AdapterContext): Promise<boolean> {
    try {
      const docker = createDockerClient();
      await docker.ping();
      return true;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'EACCES' || code === 'EPERM') {
        throw new Error(
          'Docker socket found but permission denied. Run with appropriate permissions or add your user to the docker group.',
        );
      }
      // ENOENT / ECONNREFUSED → Docker not available, return false quietly
      return false;
    }
  },

  async discover(_context: AdapterContext): Promise<DiscoveredService[]> {
    const docker = createDockerClient();
    let containers: Dockerode.ContainerInfo[];
    try {
      containers = await docker.listContainers({ all: false }); // running only
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'EACCES' || code === 'EPERM') {
        throw new Error(
          'Permission denied accessing Docker socket. Check that the socket is mounted and accessible.',
        );
      }
      if (code === 'ECONNREFUSED' || code === 'ENOENT') {
        throw new Error(
          'Cannot connect to the Docker daemon. Is Docker running? Is the socket mounted at /var/run/docker.sock?',
        );
      }
      throw new Error(
        `Docker daemon error: ${(err as Error).message ?? String(err)}`,
      );
    }
    return containersToDiscoveredServices(containers);
  },
};
