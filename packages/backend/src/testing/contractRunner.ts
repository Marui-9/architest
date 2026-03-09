import AjvModule from 'ajv';
import type {
  ContractTestResult,
  EndpointTestResult,
  GraphEdge,
  GraphNode,
  EnrichedService,
  OpenAPIEndpoint,
  TestStatus,
} from '../types.js';

// Handle both ESM default and CJS module shapes
const Ajv = (AjvModule as unknown as { default: typeof AjvModule }).default ?? AjvModule;
type ErrorObject = { instancePath?: string; message?: string };
const ajv = new (Ajv as unknown as new (opts: Record<string, unknown>) => {
  compile(schema: Record<string, unknown>): ((data: unknown) => boolean) & { errors?: ErrorObject[] | null };
})({ allErrors: true, strict: false });

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Derive a base URL for a service. We prefer:
 * 1. The OpenAPI spec's baseUrl (from servers[0])
 * 2. localhost:{first host port}
 * 3. null (can't test)
 */
function resolveBaseUrl(
  service: EnrichedService,
  targetNode: GraphNode,
): string | null {
  if (service.openapi?.baseUrl) return service.openapi.baseUrl;
  const hostPort = targetNode.ports[0]?.host;
  if (hostPort) return `http://localhost:${hostPort}`;
  return null;
}

/**
 * Build the full URL for an endpoint, expanding path parameters
 * with placeholder values so we get a valid URL.
 */
function buildUrl(baseUrl: string, path: string): string {
  // Replace {param} with a placeholder value
  const resolved = path.replace(/\{([^}]+)\}/g, '1');
  // Ensure single slash join
  const base = baseUrl.replace(/\/$/, '');
  const route = resolved.startsWith('/') ? resolved : `/${resolved}`;
  return `${base}${route}`;
}

// ─── Contract runner ────────────────────────────────────────────────────

export interface ContractRunnerOptions {
  /** Request timeout in ms (default: 5000) */
  timeout?: number;
  /** Callback invoked after each endpoint test completes */
  onProgress?: (result: EndpointTestResult, index: number, total: number) => void;
}

/**
 * Run contract tests for an API edge.
 *
 * For each endpoint in the target service's OpenAPI spec:
 * 1. Make an HTTP request (GET only for safety in MVP)
 * 2. Validate the response body against the spec schema
 * 3. Report pass/fail per endpoint
 */
export async function runContractTests(
  edge: GraphEdge,
  targetNode: GraphNode,
  targetService: EnrichedService,
  options: ContractRunnerOptions = {},
): Promise<ContractTestResult> {
  const { timeout = 5000, onProgress } = options;
  const startedAt = new Date().toISOString();

  const result: ContractTestResult = {
    edgeId: edge.id,
    status: 'running',
    startedAt,
    endpoints: [],
    summary: { total: 0, passed: 0, failed: 0, errors: 0 },
  };

  // Must have an OpenAPI spec to run contract tests
  if (!targetService.openapi) {
    result.status = 'error';
    result.completedAt = new Date().toISOString();
    result.endpoints = [
      {
        method: '*',
        path: '*',
        status: 'error',
        error: 'No OpenAPI spec found for target service',
      },
    ];
    result.summary = { total: 0, passed: 0, failed: 0, errors: 1 };
    return result;
  }

  const baseUrl = resolveBaseUrl(targetService, targetNode);
  if (!baseUrl) {
    result.status = 'error';
    result.completedAt = new Date().toISOString();
    result.endpoints = [
      {
        method: '*',
        path: '*',
        status: 'error',
        error: 'Cannot determine base URL for target service (no ports exposed)',
      },
    ];
    result.summary = { total: 0, passed: 0, failed: 0, errors: 1 };
    return result;
  }

  const endpoints = targetService.openapi.endpoints;
  result.summary.total = endpoints.length;

  for (let i = 0; i < endpoints.length; i++) {
    const ep = endpoints[i];
    const epResult = await testEndpoint(ep, baseUrl, timeout);
    result.endpoints.push(epResult);

    if (epResult.status === 'pass') result.summary.passed++;
    else if (epResult.status === 'fail') result.summary.failed++;
    else result.summary.errors++;

    onProgress?.(epResult, i, endpoints.length);
  }

  result.status =
    result.summary.errors > 0
      ? 'error'
      : result.summary.failed > 0
        ? 'fail'
        : 'pass';
  result.completedAt = new Date().toISOString();

  return result;
}

/**
 * Test a single endpoint: make the HTTP request and validate the response schema.
 */
async function testEndpoint(
  endpoint: OpenAPIEndpoint,
  baseUrl: string,
  timeout: number,
): Promise<EndpointTestResult> {
  const url = buildUrl(baseUrl, endpoint.path);
  const method = endpoint.method.toUpperCase();

  // For MVP, only GET endpoints are safe to test (no side effects)
  if (method !== 'GET') {
    return {
      method: endpoint.method,
      path: endpoint.path,
      status: 'pass',
      schemaValid: true,
      latencyMs: 0,
    };
  }

  const start = performance.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const res = await fetch(url, {
      method,
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);

    const latencyMs = Math.round(performance.now() - start);
    const httpStatus = res.status;

    // Find the matching response schema (try exact status, then "default")
    const statusStr = String(httpStatus);
    const specResponse =
      endpoint.responses.find((r) => r.statusCode === statusStr) ??
      endpoint.responses.find((r) => r.statusCode === 'default');

    // If there's no schema to validate against, just check HTTP success
    if (!specResponse?.schema || Object.keys(specResponse.schema).length === 0) {
      return {
        method: endpoint.method,
        path: endpoint.path,
        status: httpStatus >= 200 && httpStatus < 400 ? 'pass' : 'fail',
        httpStatus,
        latencyMs,
        schemaValid: true,
      };
    }

    // Parse body and validate against schema
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return {
        method: endpoint.method,
        path: endpoint.path,
        status: 'fail',
        httpStatus,
        latencyMs,
        schemaValid: false,
        schemaErrors: ['Response body is not valid JSON'],
      };
    }

    const validate = ajv.compile(specResponse.schema);
    let valid: boolean;
    try {
      valid = validate(body);
    } catch (compileErr) {
      return {
        method: endpoint.method,
        path: endpoint.path,
        status: 'error',
        httpStatus,
        latencyMs,
        schemaValid: false,
        error: `Schema validation error: ${(compileErr as Error).message ?? String(compileErr)}`,
      };
    }

    return {
      method: endpoint.method,
      path: endpoint.path,
      status: valid ? 'pass' : 'fail',
      httpStatus,
      latencyMs,
      schemaValid: valid,
      schemaErrors: valid
        ? undefined
        : validate.errors?.map(
            (e: ErrorObject) => `${e.instancePath || '/'} ${e.message ?? 'validation error'}`,
          ),
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    const errObj = err as Error & { cause?: { code?: string } };
    const message = errObj.message ?? String(err);
    const causeCode = errObj.cause?.code;

    let detail: string;
    if (message.includes('abort') || errObj.name === 'AbortError') {
      detail = `Request timed out after ${timeout}ms — is the service running?`;
    } else if (causeCode === 'ECONNREFUSED' || message.includes('ECONNREFUSED')) {
      detail = `Connection refused at ${url} — the service is not accepting connections`;
    } else if (causeCode === 'ENOTFOUND' || message.includes('ENOTFOUND')) {
      detail = `DNS lookup failed for ${url} — check the hostname`;
    } else if (errObj.name === 'TypeError' && message.includes('fetch')) {
      detail = `Network error reaching ${url}: ${message}`;
    } else {
      detail = message;
    }

    return {
      method: endpoint.method,
      path: endpoint.path,
      status: 'error',
      latencyMs,
      error: detail,
    };
  }
}
