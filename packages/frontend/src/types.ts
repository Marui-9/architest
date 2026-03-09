// ─── Shared types mirrored from backend ─────────────────────────────────
// Keep in sync with packages/backend/src/types.ts

export interface PortMapping {
  host: number;
  container: number;
  protocol?: string;
}

export type ServiceType = 'service' | 'datastore' | 'cache' | 'message-broker';
export type EdgeType = 'api' | 'dependency' | 'datastore';
export type FindingSeverity = 'error' | 'warning' | 'info';

export interface GraphNode {
  id: string;
  label: string;
  serviceType: ServiceType;
  image?: string;
  ports: PortMapping[];
  hasSpec: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  source: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  label?: string;
}

export interface ArchitectureGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Finding {
  ruleId: string;
  severity: FindingSeverity;
  message: string;
  targets: string[];
}

export interface EvaluationResult {
  score: number;
  totalFindings: number;
  counts: Record<FindingSeverity, number>;
  findings: Finding[];
  rulesEvaluated: string[];
}

export type ScanMode = 'compose' | 'daemon' | 'auto';

// ─── Test Runner Types ──────────────────────────────────────────────────

export type TestStatus = 'pass' | 'fail' | 'error' | 'running' | 'pending';

export interface EndpointTestResult {
  method: string;
  path: string;
  status: TestStatus;
  httpStatus?: number;
  latencyMs?: number;
  schemaValid?: boolean;
  schemaErrors?: string[];
  error?: string;
}

export interface ContractTestResult {
  edgeId: string;
  status: TestStatus;
  startedAt: string;
  completedAt?: string;
  endpoints: EndpointTestResult[];
  summary: { total: number; passed: number; failed: number; errors: number };
}

export interface HealthProbeResult {
  edgeId: string;
  target: string;
  status: TestStatus;
  reachable: boolean;
  latencyMs?: number;
  method: 'tcp' | 'http';
  error?: string;
}

// ─── OpenAPI types (for edge detail) ────────────────────────────────────

export interface OpenAPIEndpoint {
  method: string;
  path: string;
  summary?: string;
  operationId?: string;
}

export interface OpenAPIResult {
  filePath: string;
  title: string;
  version: string;
  baseUrl?: string;
  endpoints: OpenAPIEndpoint[];
}

// ─── Edge detail (from GET /api/graph/edge/:id) ─────────────────────────

export interface EdgeDetail {
  edge: GraphEdge;
  sourceNode: GraphNode | null;
  targetNode: GraphNode | null;
  openapi?: OpenAPIResult;
}

// ─── App-level types ────────────────────────────────────────────────────

export type AppView = 'landing' | 'canvas';
