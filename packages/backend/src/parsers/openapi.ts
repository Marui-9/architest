import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import type { OpenAPIResult, OpenAPIEndpoint, OpenAPIResponse } from '../types.js';

/**
 * Conventional paths to search for OpenAPI spec files, relative to project root.
 */
const SPEC_SEARCH_PATHS = [
  'openapi.json',
  'openapi.yml',
  'openapi.yaml',
  'swagger.json',
  'swagger.yml',
  'swagger.yaml',
  'docs/openapi.json',
  'docs/openapi.yml',
  'docs/openapi.yaml',
  'docs/swagger.json',
  'docs/swagger.yml',
  'docs/swagger.yaml',
  'api/openapi.json',
  'api/openapi.yml',
  'api/openapi.yaml',
  'api/swagger.json',
  'api/swagger.yml',
  'api/swagger.yaml',
];

/**
 * Discover OpenAPI spec files at conventional paths within a project directory.
 * Returns absolute paths of found spec files.
 */
export function discoverOpenAPISpecs(projectPath: string): string[] {
  const found: string[] = [];

  for (const relPath of SPEC_SEARCH_PATHS) {
    const fullPath = path.join(projectPath, relPath);
    if (fs.existsSync(fullPath)) {
      found.push(fullPath);
    }
  }

  return found;
}

/**
 * Discover OpenAPI specs scoped to a specific service build context.
 * Searches the same conventional filenames within the service's build directory.
 */
export function discoverServiceSpecs(projectPath: string, buildContext?: string): string[] {
  if (!buildContext) return [];

  const serviceDir = path.resolve(projectPath, buildContext);
  if (!fs.existsSync(serviceDir)) return [];

  const found: string[] = [];
  const specNames = [
    'openapi.json',
    'openapi.yml',
    'openapi.yaml',
    'swagger.json',
    'swagger.yml',
    'swagger.yaml',
    'docs/openapi.json',
    'docs/openapi.yml',
    'docs/openapi.yaml',
    'api/openapi.json',
    'api/openapi.yml',
    'api/openapi.yaml',
  ];

  for (const name of specNames) {
    const fullPath = path.join(serviceDir, name);
    if (fs.existsSync(fullPath)) {
      found.push(fullPath);
    }
  }

  return found;
}

// ─── HTTP methods we extract endpoints for ──────────────────────────────
const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'] as const;

/**
 * Parse an OpenAPI 3.x spec file and return a structured result.
 * Handles both JSON and YAML formats.
 * Performs basic $ref resolution for inline definitions.
 */
export function parseOpenAPISpec(filePath: string): OpenAPIResult {
  if (!fs.existsSync(filePath)) {
    throw new Error(`OpenAPI spec file not found: ${filePath}`);
  }

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EACCES' || code === 'EPERM') {
      throw new Error(`Permission denied reading ${filePath}. Check file permissions.`);
    }
    throw new Error(`Cannot read ${filePath}: ${(err as Error).message ?? String(err)}`);
  }

  const ext = path.extname(filePath).toLowerCase();

  let doc: Record<string, unknown>;
  try {
    if (ext === '.json') {
      doc = JSON.parse(content) as Record<string, unknown>;
    } else {
      doc = yaml.load(content) as Record<string, unknown>;
    }
  } catch (err) {
    const isJson = ext === '.json';
    const format = isJson ? 'JSON' : 'YAML';
    const yamlErr = err as { mark?: { line?: number; column?: number }; message?: string };
    const position =
      !isJson && yamlErr.mark
        ? ` at line ${(yamlErr.mark.line ?? 0) + 1}, column ${(yamlErr.mark.column ?? 0) + 1}`
        : '';
    throw new Error(
      `Malformed ${format} in OpenAPI spec ${filePath}${position}: ${yamlErr.message ?? String(err)}`,
    );
  }

  if (!doc || typeof doc !== 'object') {
    throw new Error(`Invalid OpenAPI spec: ${filePath} — expected an object`);
  }

  // Validate it looks like an OpenAPI spec
  const openapi = doc.openapi as string | undefined;
  const swagger = doc.swagger as string | undefined;

  if (!openapi && !swagger) {
    throw new Error(
      `File ${filePath} does not appear to be an OpenAPI spec (missing "openapi" or "swagger" field)`,
    );
  }

  // Extract info
  const info = (doc.info as Record<string, unknown>) ?? {};
  const title = (info.title as string) ?? 'Untitled API';
  const version = (info.version as string) ?? '0.0.0';

  // Extract base URL from servers array (OpenAPI 3.x)
  let baseUrl: string | undefined;
  const servers = doc.servers as Array<{ url: string }> | undefined;
  if (servers && servers.length > 0 && typeof servers[0].url === 'string') {
    baseUrl = servers[0].url;
  }
  // Swagger 2.x: construct from host + basePath
  if (!baseUrl && swagger) {
    const host = doc.host as string | undefined;
    const basePath = (doc.basePath as string) ?? '';
    const scheme = ((doc.schemes as string[]) ?? ['http'])[0];
    if (host) {
      baseUrl = `${scheme}://${host}${basePath}`;
    }
  }

  // Build components/definitions map for basic $ref resolution
  const components = doc.components as Record<string, Record<string, unknown>> | undefined;
  const schemas = components?.schemas as Record<string, unknown> | undefined;
  const definitions = doc.definitions as Record<string, unknown> | undefined;
  const schemaMap = schemas ?? definitions ?? {};

  // Extract endpoints from paths
  const paths = (doc.paths as Record<string, Record<string, unknown>>) ?? {};
  const endpoints: OpenAPIEndpoint[] = [];

  for (const [routePath, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method] as Record<string, unknown> | undefined;
      if (!operation) continue;

      const responses = extractResponses(
        operation.responses as Record<string, unknown> | undefined,
        schemaMap,
      );

      endpoints.push({
        method: method.toUpperCase(),
        path: routePath,
        summary: (operation.summary as string) ?? undefined,
        operationId: (operation.operationId as string) ?? undefined,
        responses,
      });
    }
  }

  return {
    filePath,
    title,
    version,
    baseUrl,
    endpoints,
  };
}

/**
 * Extract response definitions from an operation's responses object.
 */
function extractResponses(
  rawResponses: Record<string, unknown> | undefined,
  schemaMap: Record<string, unknown>,
): OpenAPIResponse[] {
  if (!rawResponses) return [];

  const results: OpenAPIResponse[] = [];

  for (const [statusCode, responseDef] of Object.entries(rawResponses)) {
    if (!responseDef || typeof responseDef !== 'object') continue;

    const def = responseDef as Record<string, unknown>;
    const description = (def.description as string) ?? undefined;

    // OpenAPI 3.x: content → application/json → schema
    let schema: Record<string, unknown> | undefined;
    const content = def.content as Record<string, Record<string, unknown>> | undefined;
    if (content?.['application/json']?.schema) {
      schema = resolveRef(
        content['application/json'].schema as Record<string, unknown>,
        schemaMap,
      );
    }

    // Swagger 2.x: schema directly on response
    if (!schema && def.schema) {
      schema = resolveRef(def.schema as Record<string, unknown>, schemaMap);
    }

    results.push({ statusCode, description, schema });
  }

  return results;
}

/**
 * Resolve $ref references in a schema object.
 * Handles top-level $ref, and recursively resolves $ref inside nested fields
 * (e.g. `items`, `properties`, `additionalProperties`).
 */
function resolveRef(
  obj: Record<string, unknown>,
  schemaMap: Record<string, unknown>,
): Record<string, unknown> {
  // Resolve top-level $ref first
  if (obj.$ref && typeof obj.$ref === 'string') {
    const match = obj.$ref.match(/#\/(?:components\/schemas|definitions)\/(.+)/);
    if (match) {
      const resolved = schemaMap[match[1]];
      if (resolved && typeof resolved === 'object') {
        // Recurse into the resolved schema in case it also has $refs
        return resolveRef(resolved as Record<string, unknown>, schemaMap);
      }
    }
    return obj;
  }

  // Recursively resolve nested $refs in known schema fields
  const result: Record<string, unknown> = { ...obj };

  if (result.items && typeof result.items === 'object') {
    result.items = resolveRef(result.items as Record<string, unknown>, schemaMap);
  }

  if (result.properties && typeof result.properties === 'object') {
    const props = result.properties as Record<string, unknown>;
    result.properties = Object.fromEntries(
      Object.entries(props).map(([k, v]) => [
        k,
        typeof v === 'object' && v !== null
          ? resolveRef(v as Record<string, unknown>, schemaMap)
          : v,
      ]),
    );
  }

  if (result.additionalProperties && typeof result.additionalProperties === 'object') {
    result.additionalProperties = resolveRef(
      result.additionalProperties as Record<string, unknown>,
      schemaMap,
    );
  }

  return result;
}
