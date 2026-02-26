// ─── Docker Compose Types ───────────────────────────────────────────────

export interface PortMapping {
  /** Host port */
  host: number;
  /** Container port */
  container: number;
  /** Protocol (tcp/udp), defaults to tcp */
  protocol?: string;
}

export interface DockerService {
  /** Service name as defined in docker-compose */
  name: string;
  /** Image name (e.g. "postgres:16") */
  image?: string;
  /** Build context path */
  build?: string;
  /** Parsed port mappings */
  ports: PortMapping[];
  /** List of service names this service depends on */
  dependsOn: string[];
}

export interface DockerComposeResult {
  /** Path to the parsed file */
  filePath: string;
  /** Compose file version (if specified) */
  version?: string;
  /** Parsed services */
  services: DockerService[];
}

// ─── OpenAPI Types ──────────────────────────────────────────────────────

export interface OpenAPIEndpoint {
  /** HTTP method (get, post, put, delete, patch) */
  method: string;
  /** Route path (e.g. "/users/{id}") */
  path: string;
  /** Operation summary from the spec */
  summary?: string;
  /** Operation ID from the spec */
  operationId?: string;
  /** Map of status code → response schema */
  responses: OpenAPIResponse[];
}

export interface OpenAPIResponse {
  /** HTTP status code (e.g. "200", "201", "default") */
  statusCode: string;
  /** Description from the spec */
  description?: string;
  /** JSON Schema for the response body (if defined) */
  schema?: Record<string, unknown>;
}

export interface OpenAPIResult {
  /** Path to the parsed spec file */
  filePath: string;
  /** API title from the spec */
  title: string;
  /** API version from the spec */
  version: string;
  /** Base URL derived from spec's servers array */
  baseUrl?: string;
  /** All parsed endpoints */
  endpoints: OpenAPIEndpoint[];
}

// ─── Association Types ──────────────────────────────────────────────────

export interface EnrichedService extends DockerService {
  /** Associated OpenAPI spec, if found */
  openapi?: OpenAPIResult;
}

// ─── Scan Result ────────────────────────────────────────────────────────

export interface ScanResult {
  /** The project root path that was scanned */
  projectPath: string;
  /** Docker Compose parse result */
  compose: DockerComposeResult;
  /** All discovered OpenAPI spec files */
  discoveredSpecs: string[];
  /** Services enriched with OpenAPI associations */
  services: EnrichedService[];
}
