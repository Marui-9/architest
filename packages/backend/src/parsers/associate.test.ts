import { describe, it, expect } from 'vitest';
import { associateSpecsToServices } from './associate.js';
import type { DockerService, OpenAPIResult } from '../types.js';

function makeService(overrides: Partial<DockerService> & { name: string }): DockerService {
  return {
    ports: [],
    dependsOn: [],
    ...overrides,
  };
}

function makeSpec(overrides: Partial<OpenAPIResult> & { filePath: string }): OpenAPIResult {
  return {
    title: 'Test API',
    version: '1.0.0',
    endpoints: [],
    ...overrides,
  };
}

describe('associateSpecsToServices', () => {
  it('returns all services with no specs when no specs provided', () => {
    const services = [makeService({ name: 'api' }), makeService({ name: 'db' })];
    const result = associateSpecsToServices(services, [], '/project');

    expect(result).toHaveLength(2);
    expect(result[0].openapi).toBeUndefined();
    expect(result[1].openapi).toBeUndefined();
  });

  it('matches by port when spec baseUrl port equals service container port', () => {
    const services = [
      makeService({ name: 'user-api', ports: [{ host: 8080, container: 8080 }] }),
      makeService({ name: 'postgres', ports: [{ host: 5432, container: 5432 }] }),
    ];
    const specs = [
      makeSpec({
        filePath: '/project/openapi.yml',
        baseUrl: 'http://localhost:8080',
        title: 'User API',
      }),
    ];

    const result = associateSpecsToServices(services, specs, '/project');

    expect(result[0].name).toBe('user-api');
    expect(result[0].openapi?.title).toBe('User API');
    expect(result[1].openapi).toBeUndefined();
  });

  it('does not reuse a spec for multiple services', () => {
    const services = [
      makeService({ name: 'api-a', ports: [{ host: 8080, container: 8080 }] }),
      makeService({ name: 'api-b', ports: [{ host: 8080, container: 8080 }] }),
    ];
    const specs = [
      makeSpec({
        filePath: '/project/openapi.yml',
        baseUrl: 'http://localhost:8080',
      }),
    ];

    const result = associateSpecsToServices(services, specs, '/project');

    const matched = result.filter((s) => s.openapi);
    expect(matched).toHaveLength(1);
  });

  it('does not match when ports differ', () => {
    const services = [
      makeService({ name: 'api', ports: [{ host: 3000, container: 3000 }] }),
    ];
    const specs = [
      makeSpec({
        filePath: '/project/openapi.yml',
        baseUrl: 'http://localhost:9090',
      }),
    ];

    const result = associateSpecsToServices(services, specs, '/project');
    expect(result[0].openapi).toBeUndefined();
  });

  it('handles services with no ports gracefully', () => {
    const services = [makeService({ name: 'worker' })];
    const specs = [
      makeSpec({
        filePath: '/project/openapi.yml',
        baseUrl: 'http://localhost:8080',
      }),
    ];

    const result = associateSpecsToServices(services, specs, '/project');
    expect(result[0].openapi).toBeUndefined();
  });

  it('handles specs with no baseUrl gracefully', () => {
    const services = [
      makeService({ name: 'api', ports: [{ host: 8080, container: 8080 }] }),
    ];
    const specs = [
      makeSpec({
        filePath: '/project/openapi.yml',
        baseUrl: undefined,
      }),
    ];

    const result = associateSpecsToServices(services, specs, '/project');
    expect(result[0].openapi).toBeUndefined();
  });
});
