import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dockerComposeAdapter, composeToDiscoveredServices } from './dockerCompose.js';
import { parseDockerCompose } from '../parsers/dockerCompose.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, '..', 'parsers', '__fixtures__');

describe('dockerComposeAdapter', () => {
  const sampleProject = path.join(FIXTURES, 'sample-project');

  describe('detect', () => {
    it('returns true when docker-compose.yml exists', async () => {
      const result = await dockerComposeAdapter.detect({ projectPath: sampleProject });
      expect(result).toBe(true);
    });

    it('returns false when no compose file exists', async () => {
      const result = await dockerComposeAdapter.detect({ projectPath: '/nonexistent' });
      expect(result).toBe(false);
    });

    it('returns false when projectPath is undefined', async () => {
      const result = await dockerComposeAdapter.detect({});
      expect(result).toBe(false);
    });
  });

  describe('discover', () => {
    it('returns DiscoveredService objects from compose file', async () => {
      const services = await dockerComposeAdapter.discover({ projectPath: sampleProject });

      expect(services).toHaveLength(4);

      const names = services.map((s) => s.name);
      expect(names).toContain('user-api');
      expect(names).toContain('order-api');
      expect(names).toContain('frontend');
      expect(names).toContain('postgres');
    });

    it('sets source to docker-compose on all services', async () => {
      const services = await dockerComposeAdapter.discover({ projectPath: sampleProject });

      for (const service of services) {
        expect(service.source).toBe('docker-compose');
      }
    });

    it('classifies service types from image names', async () => {
      const services = await dockerComposeAdapter.discover({ projectPath: sampleProject });

      const postgres = services.find((s) => s.name === 'postgres');
      expect(postgres?.serviceType).toBe('datastore');

      const userApi = services.find((s) => s.name === 'user-api');
      expect(userApi?.serviceType).toBe('service');
    });

    it('preserves ports and dependsOn from compose', async () => {
      const services = await dockerComposeAdapter.discover({ projectPath: sampleProject });

      const orderApi = services.find((s) => s.name === 'order-api');
      expect(orderApi?.ports).toHaveLength(1);
      expect(orderApi?.ports[0].container).toBe(9090);
      expect(orderApi?.dependsOn).toContain('postgres');
      expect(orderApi?.dependsOn).toContain('user-api');
    });

    it('sets id equal to service name', async () => {
      const services = await dockerComposeAdapter.discover({ projectPath: sampleProject });

      for (const service of services) {
        expect(service.id).toBe(service.name);
      }
    });

    it('throws when projectPath is not provided', async () => {
      await expect(dockerComposeAdapter.discover({})).rejects.toThrow('requires a projectPath');
    });
  });
});

describe('composeToDiscoveredServices', () => {
  const sampleProject = path.join(FIXTURES, 'sample-project');

  it('converts DockerComposeResult to DiscoveredService[]', () => {
    const compose = parseDockerCompose(path.join(sampleProject, 'docker-compose.yml'));
    const services = composeToDiscoveredServices(compose);

    expect(services).toHaveLength(4);
    expect(services[0]).toHaveProperty('source', 'docker-compose');
    expect(services[0]).toHaveProperty('serviceType');
    expect(services[0]).toHaveProperty('metadata');
    expect(services[0].metadata).toHaveProperty('composeFilePath');
  });
});
