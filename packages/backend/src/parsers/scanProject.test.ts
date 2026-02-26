import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanProject } from './scanProject.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, '__fixtures__');

describe('scanProject', () => {
  const sampleProject = path.join(FIXTURES, 'sample-project');

  it('returns a complete scan result for the sample project', async () => {
    const result = await scanProject(sampleProject);

    // Basic structure
    expect(result.projectPath).toBe(sampleProject);
    expect(result.compose).toBeDefined();
    expect(result.services).toBeDefined();
    expect(Array.isArray(result.discoveredSpecs)).toBe(true);
  });

  it('parses all 4 services from docker-compose.yml', async () => {
    const result = await scanProject(sampleProject);

    const names = result.services.map((s) => s.name);
    expect(names).toContain('user-api');
    expect(names).toContain('order-api');
    expect(names).toContain('frontend');
    expect(names).toContain('postgres');
    expect(result.services).toHaveLength(4);
  });

  it('resolves depends_on correctly', async () => {
    const result = await scanProject(sampleProject);

    const orderApi = result.services.find((s) => s.name === 'order-api');
    expect(orderApi?.dependsOn).toContain('postgres');
    expect(orderApi?.dependsOn).toContain('user-api');

    const frontend = result.services.find((s) => s.name === 'frontend');
    expect(frontend?.dependsOn).toContain('user-api');
    expect(frontend?.dependsOn).toContain('order-api');

    const postgres = result.services.find((s) => s.name === 'postgres');
    expect(postgres?.dependsOn).toEqual([]);
  });

  it('discovers and associates OpenAPI specs to the correct services', async () => {
    const result = await scanProject(sampleProject);

    const userApi = result.services.find((s) => s.name === 'user-api');
    expect(userApi?.openapi).toBeDefined();
    expect(userApi?.openapi?.title).toBe('User API');
    expect(userApi?.openapi?.baseUrl).toBe('http://localhost:8080');

    const orderApi = result.services.find((s) => s.name === 'order-api');
    expect(orderApi?.openapi).toBeDefined();
    expect(orderApi?.openapi?.title).toBe('Order API');
    expect(orderApi?.openapi?.baseUrl).toBe('http://localhost:9090');
  });

  it('does not associate specs to non-API services', async () => {
    const result = await scanProject(sampleProject);

    const frontend = result.services.find((s) => s.name === 'frontend');
    expect(frontend?.openapi).toBeUndefined();

    const postgres = result.services.find((s) => s.name === 'postgres');
    expect(postgres?.openapi).toBeUndefined();
  });

  it('extracts endpoints from associated specs', async () => {
    const result = await scanProject(sampleProject);

    const userApi = result.services.find((s) => s.name === 'user-api');
    expect(userApi?.openapi?.endpoints.length).toBeGreaterThanOrEqual(3);

    const listUsers = userApi?.openapi?.endpoints.find((e) => e.operationId === 'listUsers');
    expect(listUsers?.method).toBe('GET');
    expect(listUsers?.path).toBe('/users');

    const orderApi = result.services.find((s) => s.name === 'order-api');
    expect(orderApi?.openapi?.endpoints.length).toBeGreaterThanOrEqual(2);
  });

  it('throws when project has no docker-compose file', async () => {
    await expect(scanProject('/nonexistent/path')).rejects.toThrow('No Docker Compose file found');
  });
});
