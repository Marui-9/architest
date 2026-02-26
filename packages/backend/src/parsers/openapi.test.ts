import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { discoverOpenAPISpecs, discoverServiceSpecs, parseOpenAPISpec } from './openapi.js';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'architest-openapi-'));
}

function writeFile(dir: string, relPath: string, content: string): string {
  const fullPath = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
  return fullPath;
}

function cleanDir(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── Sample specs ───────────────────────────────────────────────────────

const OPENAPI_3_YAML = `
openapi: "3.0.3"
info:
  title: User API
  version: "1.0.0"
servers:
  - url: http://localhost:8080
paths:
  /users:
    get:
      summary: List users
      operationId: listUsers
      responses:
        "200":
          description: Success
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/User"
    post:
      summary: Create user
      operationId: createUser
      responses:
        "201":
          description: Created
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/User"
  /users/{id}:
    get:
      summary: Get user by ID
      operationId: getUser
      responses:
        "200":
          description: Success
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/User"
        "404":
          description: Not found
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
        email:
          type: string
`;

const OPENAPI_3_JSON = JSON.stringify({
  openapi: '3.0.3',
  info: { title: 'Order API', version: '2.0.0' },
  servers: [{ url: 'http://localhost:9090/api' }],
  paths: {
    '/orders': {
      get: {
        summary: 'List orders',
        operationId: 'listOrders',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: { type: 'array', items: { type: 'object' } },
              },
            },
          },
        },
      },
    },
  },
});

const SWAGGER_2_YAML = `
swagger: "2.0"
info:
  title: Legacy API
  version: "1.0.0"
host: localhost:7070
basePath: /v1
schemes:
  - http
paths:
  /items:
    get:
      summary: List items
      responses:
        "200":
          description: Success
          schema:
            type: array
            items:
              $ref: "#/definitions/Item"
definitions:
  Item:
    type: object
    properties:
      id:
        type: integer
      name:
        type: string
`;

// ─── discoverOpenAPISpecs ───────────────────────────────────────────────

describe('discoverOpenAPISpecs', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = createTempDir();
  });

  afterAll(() => {
    cleanDir(tmpDir);
  });

  it('returns empty array when no specs exist', () => {
    expect(discoverOpenAPISpecs(tmpDir)).toEqual([]);
  });

  it('discovers openapi.yml at root', () => {
    writeFile(tmpDir, 'openapi.yml', OPENAPI_3_YAML);
    const result = discoverOpenAPISpecs(tmpDir);
    expect(result).toContain(path.join(tmpDir, 'openapi.yml'));
  });

  it('discovers specs in docs/ subdirectory', () => {
    writeFile(tmpDir, 'docs/swagger.json', OPENAPI_3_JSON);
    const result = discoverOpenAPISpecs(tmpDir);
    expect(result).toContain(path.join(tmpDir, 'docs', 'swagger.json'));
  });

  it('discovers specs in api/ subdirectory', () => {
    writeFile(tmpDir, 'api/openapi.yaml', OPENAPI_3_YAML);
    const result = discoverOpenAPISpecs(tmpDir);
    expect(result).toContain(path.join(tmpDir, 'api', 'openapi.yaml'));
  });
});

// ─── discoverServiceSpecs ───────────────────────────────────────────────

describe('discoverServiceSpecs', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = createTempDir();
  });

  afterAll(() => {
    cleanDir(tmpDir);
  });

  it('returns empty array when no build context', () => {
    expect(discoverServiceSpecs(tmpDir, undefined)).toEqual([]);
  });

  it('returns empty array when build context does not exist', () => {
    expect(discoverServiceSpecs(tmpDir, './nonexistent')).toEqual([]);
  });

  it('finds spec inside build context', () => {
    writeFile(tmpDir, 'services/api/openapi.json', OPENAPI_3_JSON);
    const result = discoverServiceSpecs(tmpDir, './services/api');
    expect(result).toContain(path.join(tmpDir, 'services', 'api', 'openapi.json'));
  });
});

// ─── parseOpenAPISpec ───────────────────────────────────────────────────

describe('parseOpenAPISpec', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = createTempDir();
  });

  afterAll(() => {
    cleanDir(tmpDir);
  });

  it('parses an OpenAPI 3.x YAML spec', () => {
    const specPath = writeFile(tmpDir, 'parse-test-3.yml', OPENAPI_3_YAML);
    const result = parseOpenAPISpec(specPath);

    expect(result.title).toBe('User API');
    expect(result.version).toBe('1.0.0');
    expect(result.baseUrl).toBe('http://localhost:8080');
    expect(result.endpoints).toHaveLength(3);

    const listUsers = result.endpoints.find((e) => e.operationId === 'listUsers');
    expect(listUsers).toBeDefined();
    expect(listUsers?.method).toBe('GET');
    expect(listUsers?.path).toBe('/users');
    expect(listUsers?.responses).toHaveLength(1);
    expect(listUsers?.responses[0].statusCode).toBe('200');
  });

  it('parses an OpenAPI 3.x JSON spec', () => {
    const specPath = writeFile(tmpDir, 'parse-test-3.json', OPENAPI_3_JSON);
    const result = parseOpenAPISpec(specPath);

    expect(result.title).toBe('Order API');
    expect(result.version).toBe('2.0.0');
    expect(result.baseUrl).toBe('http://localhost:9090/api');
    expect(result.endpoints).toHaveLength(1);
    expect(result.endpoints[0].method).toBe('GET');
    expect(result.endpoints[0].path).toBe('/orders');
  });

  it('parses a Swagger 2.x YAML spec', () => {
    const specPath = writeFile(tmpDir, 'parse-test-2.yml', SWAGGER_2_YAML);
    const result = parseOpenAPISpec(specPath);

    expect(result.title).toBe('Legacy API');
    expect(result.version).toBe('1.0.0');
    expect(result.baseUrl).toBe('http://localhost:7070/v1');
    expect(result.endpoints).toHaveLength(1);
    expect(result.endpoints[0].method).toBe('GET');
    expect(result.endpoints[0].path).toBe('/items');
    // $ref should be resolved
    expect(result.endpoints[0].responses[0].schema).toHaveProperty('properties');
  });

  it('resolves $ref to components/schemas', () => {
    const specPath = writeFile(tmpDir, 'ref-test.yml', OPENAPI_3_YAML);
    const result = parseOpenAPISpec(specPath);

    const createUser = result.endpoints.find((e) => e.operationId === 'createUser');
    expect(createUser?.responses[0].schema).toHaveProperty('properties');
    expect(createUser?.responses[0].schema?.properties).toHaveProperty('name');
  });

  it('extracts multiple responses for an endpoint', () => {
    const specPath = writeFile(tmpDir, 'multi-response.yml', OPENAPI_3_YAML);
    const result = parseOpenAPISpec(specPath);

    const getUser = result.endpoints.find((e) => e.operationId === 'getUser');
    expect(getUser?.responses).toHaveLength(2);
    expect(getUser?.responses.map((r) => r.statusCode)).toEqual(['200', '404']);
  });

  it('throws on file not found', () => {
    expect(() => parseOpenAPISpec('/nonexistent/openapi.json')).toThrow('not found');
  });

  it('throws on invalid JSON', () => {
    const specPath = writeFile(tmpDir, 'bad.json', '{invalid json}');
    expect(() => parseOpenAPISpec(specPath)).toThrow('Failed to parse');
  });

  it('throws on non-OpenAPI file', () => {
    const specPath = writeFile(tmpDir, 'not-openapi.yml', 'foo: bar\nbaz: 123\n');
    expect(() => parseOpenAPISpec(specPath)).toThrow('does not appear to be an OpenAPI spec');
  });
});
