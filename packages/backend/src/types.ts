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

// ─── Source-Agnostic Service Types ──────────────────────────────────────

/** Classified service type, inferred from image name or adapter context */
export type ServiceType = 'service' | 'datastore' | 'cache' | 'message-broker';

/** A service discovered from any infrastructure source */
export interface DiscoveredService {
  /** Unique identifier within the scan */
  id: string;
  /** Display name */
  name: string;
  /** Which adapter discovered this service */
  source: string;
  /** Image name (e.g. "postgres:16") */
  image?: string;
  /** Build context path (compose-specific, but useful for spec discovery) */
  build?: string;
  /** Parsed port mappings */
  ports: PortMapping[];
  /** List of service ids this service depends on */
  dependsOn: string[];
  /** Classified service type */
  serviceType: ServiceType;
  /** Adapter-specific metadata */
  metadata: Record<string, unknown>;
}

// ─── Infrastructure Adapter Interface ───────────────────────────────────

/** An adapter that discovers services from an infrastructure source */
export interface InfrastructureAdapter {
  /** Unique adapter identifier (e.g. "docker-compose", "docker-daemon") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Check whether this adapter can find something to parse in the given context */
  detect(context: AdapterContext): Promise<boolean>;
  /** Discover services from this source */
  discover(context: AdapterContext): Promise<DiscoveredService[]>;
}

/** Context passed to adapters */
export interface AdapterContext {
  /** Project directory path (may be undefined for daemon-only scans) */
  projectPath?: string;
}

// ─── Scan Mode ──────────────────────────────────────────────────────────

/** How to scan: compose files, live daemon, or auto-detect */
export type ScanMode = 'compose' | 'daemon' | 'auto';

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

// ─── Graph Types ────────────────────────────────────────────────────────

/** Edge type classification */
export type EdgeType = 'api' | 'dependency' | 'datastore';

/** A node in the architecture graph */
export interface GraphNode {
  /** Same as the service id */
  id: string;
  /** Display label */
  label: string;
  /** Classified type */
  serviceType: ServiceType;
  /** Docker image name (e.g. "postgres:16") */
  image?: string;
  /** Port(s) exposed on the host */
  ports: PortMapping[];
  /** Whether this service has an OpenAPI spec */
  hasSpec: boolean;
  /** dagre-computed x position */
  x: number;
  /** dagre-computed y position */
  y: number;
  /** Node width used for layout */
  width: number;
  /** Node height used for layout */
  height: number;
  /** Adapter source(s) */
  source: string;
}

/** An edge in the architecture graph */
export interface GraphEdge {
  /** Unique edge id: "source->target" */
  id: string;
  /** Source service id */
  source: string;
  /** Target service id */
  target: string;
  /** Classified edge type */
  type: EdgeType;
  /** Human-readable label */
  label?: string;
}

/** The complete architecture graph */
export interface ArchitectureGraph {
  /** All service nodes */
  nodes: GraphNode[];
  /** All relationship edges */
  edges: GraphEdge[];
}

// ─── Guardrail Types ────────────────────────────────────────────────────

/** Severity of a guardrail finding */
export type FindingSeverity = 'error' | 'warning' | 'info';

/** A single finding produced by a guardrail rule */
export interface Finding {
  /** Rule id that produced this finding */
  ruleId: string;
  /** Severity level */
  severity: FindingSeverity;
  /** Human-readable message */
  message: string;
  /** Node id(s) or edge id(s) involved */
  targets: string[];
}

/** A guardrail rule that inspects the architecture graph */
export interface GuardrailRule {
  /** Unique rule identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this rule checks */
  description: string;
  /** Default severity */
  severity: FindingSeverity;
  /** Evaluate the graph and return findings (empty = pass) */
  evaluate(graph: ArchitectureGraph): Finding[];
}

/** Result of evaluating all guardrail rules */
export interface EvaluationResult {
  /** Architecture health score (0-100, higher is better) */
  score: number;
  /** Total number of findings */
  totalFindings: number;
  /** Counts by severity */
  counts: Record<FindingSeverity, number>;
  /** All findings grouped by rule */
  findings: Finding[];
  /** Which rules were evaluated */
  rulesEvaluated: string[];
}

// ─── Test Runner Types ──────────────────────────────────────────────────

/** Status of a test or probe */
export type TestStatus = 'pass' | 'fail' | 'error' | 'running' | 'pending';

/** Result for a single endpoint contract test */
export interface EndpointTestResult {
  /** HTTP method tested */
  method: string;
  /** Path tested */
  path: string;
  /** Test status */
  status: TestStatus;
  /** HTTP status code received */
  httpStatus?: number;
  /** Request/response latency in ms */
  latencyMs?: number;
  /** Whether the response matched the OpenAPI schema */
  schemaValid?: boolean;
  /** Ajv validation error messages */
  schemaErrors?: string[];
  /** Error message if the request failed entirely */
  error?: string;
}

/** Aggregated result for a contract test run against an edge */
export interface ContractTestResult {
  /** The edge that was tested */
  edgeId: string;
  /** Overall status */
  status: TestStatus;
  /** ISO timestamp when test run started */
  startedAt: string;
  /** ISO timestamp when test run completed */
  completedAt?: string;
  /** Per-endpoint results */
  endpoints: EndpointTestResult[];
  /** Summary counts */
  summary: { total: number; passed: number; failed: number; errors: number };
}

/** Result of a health/connectivity probe */
export interface HealthProbeResult {
  /** The edge that was probed */
  edgeId: string;
  /** Target service name */
  target: string;
  /** Probe status */
  status: TestStatus;
  /** Whether the target was reachable */
  reachable: boolean;
  /** Latency in ms */
  latencyMs?: number;
  /** Probe method used */
  method: 'tcp' | 'http';
  /** Error message if probe failed */
  error?: string;
}

// ─── Enriched Service ───────────────────────────────────────────────────

export interface EnrichedService extends DiscoveredService {
  /** Associated OpenAPI spec, if found */
  openapi?: OpenAPIResult;
}

// ─── Scan Result ────────────────────────────────────────────────────────

export interface ScanResult {
  /** The project root path that was scanned (if applicable) */
  projectPath?: string;
  /** Which scan mode was used */
  mode: ScanMode;
  /** Docker Compose parse result (only present for compose/auto scans) */
  compose?: DockerComposeResult;
  /** All discovered OpenAPI spec files */
  discoveredSpecs: string[];
  /** Services enriched with OpenAPI associations */
  services: EnrichedService[];
  /** Parse errors encountered during scanning (non-fatal) */
  parseErrors: Array<{ filePath: string; error: string }>;
}
