import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import type { DockerComposeResult, DockerService, PortMapping } from '../types.js';

const COMPOSE_FILENAMES = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'];

/**
 * Find the docker-compose file in the given directory.
 * Checks standard filenames in priority order.
 */
export function findComposeFile(projectPath: string): string | null {
  for (const filename of COMPOSE_FILENAMES) {
    const fullPath = path.join(projectPath, filename);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

/**
 * Parse a port string/number into a PortMapping.
 *
 * Supports formats:
 *  - "8080:80"
 *  - "8080:80/tcp"
 *  - 8080  (host and container are the same)
 *  - "80"
 */
export function parsePort(port: string | number): PortMapping | null {
  if (typeof port === 'number') {
    return { host: port, container: port };
  }

  const str = String(port);

  // Strip protocol suffix
  let protocol: string | undefined;
  let portPart = str;
  const slashIdx = str.lastIndexOf('/');
  if (slashIdx !== -1) {
    protocol = str.slice(slashIdx + 1);
    portPart = str.slice(0, slashIdx);
  }

  // Handle IP binding prefix (e.g. "127.0.0.1:8080:80")
  const segments = portPart.split(':');

  let host: number;
  let container: number;

  if (segments.length === 1) {
    const p = parseInt(segments[0], 10);
    if (isNaN(p)) return null;
    host = p;
    container = p;
  } else if (segments.length === 2) {
    host = parseInt(segments[0], 10);
    container = parseInt(segments[1], 10);
    if (isNaN(host) || isNaN(container)) return null;
  } else if (segments.length === 3) {
    // "ip:host:container"
    host = parseInt(segments[1], 10);
    container = parseInt(segments[2], 10);
    if (isNaN(host) || isNaN(container)) return null;
  } else {
    return null;
  }

  const result: PortMapping = { host, container };
  if (protocol) result.protocol = protocol;
  return result;
}

/**
 * Extract depends_on as a flat string array from both short and long syntax.
 *
 * Short: depends_on: [db, redis]
 * Long:  depends_on: { db: { condition: service_healthy }, redis: {} }
 */
function parseDependsOn(raw: unknown): string[] {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw.filter((v) => typeof v === 'string');
  }

  if (typeof raw === 'object' && raw !== null) {
    return Object.keys(raw);
  }

  return [];
}

/**
 * Parse a Docker Compose file and return a structured result.
 */
export function parseDockerCompose(filePath: string): DockerComposeResult {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Docker Compose file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  let doc: Record<string, unknown>;
  try {
    doc = yaml.load(content) as Record<string, unknown>;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown YAML parse error';
    throw new Error(`Failed to parse YAML in ${filePath}: ${message}`);
  }

  if (!doc || typeof doc !== 'object') {
    throw new Error(`Invalid Docker Compose file: ${filePath} — expected a YAML mapping`);
  }

  // Compose v2+ uses top-level "services", v1 was flat (we only support v2+)
  const rawServices = doc.services as Record<string, Record<string, unknown>> | undefined;
  if (!rawServices || typeof rawServices !== 'object') {
    throw new Error(
      `No "services" key found in ${filePath}. ArchiTest requires Docker Compose v2+ format.`,
    );
  }

  const services: DockerService[] = Object.entries(rawServices).map(([name, def]) => {
    // Ports
    const rawPorts = (def.ports as (string | number)[] | undefined) ?? [];
    const ports: PortMapping[] = rawPorts
      .map((p) => parsePort(p))
      .filter((p): p is PortMapping => p !== null);

    // Build context
    let build: string | undefined;
    if (typeof def.build === 'string') {
      build = def.build;
    } else if (typeof def.build === 'object' && def.build !== null) {
      build = (def.build as Record<string, unknown>).context as string | undefined;
    }

    return {
      name,
      image: typeof def.image === 'string' ? def.image : undefined,
      build,
      ports,
      dependsOn: parseDependsOn(def.depends_on),
    };
  });

  return {
    filePath,
    version: typeof doc.version === 'string' ? doc.version : undefined,
    services,
  };
}

/**
 * High-level: find and parse the Docker Compose file in a project directory.
 */
export function parseProjectCompose(projectPath: string): DockerComposeResult {
  const filePath = findComposeFile(projectPath);
  if (!filePath) {
    throw new Error(
      `No Docker Compose file found in ${projectPath}. Looked for: ${COMPOSE_FILENAMES.join(', ')}`,
    );
  }
  return parseDockerCompose(filePath);
}
