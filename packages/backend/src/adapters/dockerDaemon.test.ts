import { describe, it, expect } from 'vitest';
import type Dockerode from 'dockerode';
import { containersToDiscoveredServices } from './dockerDaemon.js';

/**
 * Helper to build a minimal ContainerInfo fixture.
 */
function container(
  overrides: Partial<Dockerode.ContainerInfo> & { Names: string[] },
): Dockerode.ContainerInfo {
  return {
    Id: overrides.Id ?? 'abc123',
    Names: overrides.Names,
    Image: overrides.Image ?? 'node:22',
    ImageID: overrides.ImageID ?? 'sha256:abc',
    Command: overrides.Command ?? 'node index.js',
    Created: overrides.Created ?? Date.now(),
    Ports: overrides.Ports ?? [],
    Labels: overrides.Labels ?? {},
    State: overrides.State ?? 'running',
    Status: overrides.Status ?? 'Up 2 hours',
    HostConfig: overrides.HostConfig ?? { NetworkMode: 'bridge' },
    NetworkSettings: overrides.NetworkSettings ?? { Networks: {} },
    Mounts: overrides.Mounts ?? [],
  };
}

describe('containersToDiscoveredServices', () => {
  it('converts a single container to a DiscoveredService', () => {
    const containers = [
      container({
        Id: 'c1',
        Names: ['/my-app'],
        Image: 'node:22-alpine',
        Ports: [
          { IP: '0.0.0.0', PrivatePort: 3000, PublicPort: 3000, Type: 'tcp' },
        ],
      }),
    ];

    const services = containersToDiscoveredServices(containers);

    expect(services).toHaveLength(1);
    expect(services[0]).toMatchObject({
      id: 'my-app',
      name: 'my-app',
      source: 'docker-daemon',
      image: 'node:22-alpine',
      serviceType: 'service',
      ports: [{ host: 3000, container: 3000, protocol: 'tcp' }],
      dependsOn: [],
    });
  });

  it('classifies service types from image names', () => {
    const containers = [
      container({ Names: ['/pg'], Image: 'postgres:16' }),
      container({ Names: ['/cache'], Image: 'redis:7' }),
      container({ Names: ['/broker'], Image: 'rabbitmq:3-management' }),
      container({ Names: ['/api'], Image: 'my-company/api-server:latest' }),
    ];

    const services = containersToDiscoveredServices(containers);

    expect(services.find((s) => s.id === 'pg')!.serviceType).toBe('datastore');
    expect(services.find((s) => s.id === 'cache')!.serviceType).toBe('cache');
    expect(services.find((s) => s.id === 'broker')!.serviceType).toBe('message-broker');
    expect(services.find((s) => s.id === 'api')!.serviceType).toBe('service');
  });

  it('infers dependencies from shared user-defined networks', () => {
    const containers = [
      container({
        Id: 'c1',
        Names: ['/api'],
        Image: 'node:22',
        NetworkSettings: {
          Networks: {
            'my-app-net': { NetworkID: 'n1' } as Dockerode.NetworkInfo,
          },
        },
      }),
      container({
        Id: 'c2',
        Names: ['/db'],
        Image: 'postgres:16',
        NetworkSettings: {
          Networks: {
            'my-app-net': { NetworkID: 'n1' } as Dockerode.NetworkInfo,
          },
        },
      }),
      container({
        Id: 'c3',
        Names: ['/unrelated'],
        Image: 'nginx:latest',
        NetworkSettings: {
          Networks: {
            'other-net': { NetworkID: 'n2' } as Dockerode.NetworkInfo,
          },
        },
      }),
    ];

    const services = containersToDiscoveredServices(containers);

    const api = services.find((s) => s.id === 'api')!;
    const db = services.find((s) => s.id === 'db')!;
    const unrelated = services.find((s) => s.id === 'unrelated')!;

    // api and db share "my-app-net" → mutual dependencies
    expect(api.dependsOn).toContain('db');
    expect(db.dependsOn).toContain('api');

    // unrelated is on a different network → no cross-deps
    expect(api.dependsOn).not.toContain('unrelated');
    expect(unrelated.dependsOn).not.toContain('api');
    expect(unrelated.dependsOn).toHaveLength(0);
  });

  it('ignores default networks (bridge, host, none)', () => {
    const containers = [
      container({
        Id: 'c1',
        Names: ['/svc1'],
        NetworkSettings: {
          Networks: {
            bridge: { NetworkID: 'b' } as Dockerode.NetworkInfo,
          },
        },
      }),
      container({
        Id: 'c2',
        Names: ['/svc2'],
        NetworkSettings: {
          Networks: {
            bridge: { NetworkID: 'b' } as Dockerode.NetworkInfo,
          },
        },
      }),
    ];

    const services = containersToDiscoveredServices(containers);
    expect(services[0].dependsOn).toHaveLength(0);
    expect(services[1].dependsOn).toHaveLength(0);
  });

  it('strips leading / from container names', () => {
    const containers = [
      container({ Names: ['/my-service'] }),
    ];

    const services = containersToDiscoveredServices(containers);
    expect(services[0].id).toBe('my-service');
    expect(services[0].name).toBe('my-service');
  });

  it('picks the shortest name when multiple names exist', () => {
    const containers = [
      container({ Names: ['/long-project-name_api_1', '/api'] }),
    ];

    const services = containersToDiscoveredServices(containers);
    expect(services[0].name).toBe('api');
  });

  it('extracts only published ports', () => {
    const containers = [
      container({
        Names: ['/web'],
        Ports: [
          { IP: '0.0.0.0', PrivatePort: 80, PublicPort: 8080, Type: 'tcp' },
          // Unpublished port (no PublicPort)
          { IP: '', PrivatePort: 443, PublicPort: undefined as any, Type: 'tcp' },
        ],
      }),
    ];

    const services = containersToDiscoveredServices(containers);
    expect(services[0].ports).toEqual([
      { host: 8080, container: 80, protocol: 'tcp' },
    ]);
  });

  it('stores metadata with container details', () => {
    const containers = [
      container({
        Id: 'deadbeef1234',
        Names: ['/svc'],
        State: 'running',
        Status: 'Up 3 hours',
        Labels: { 'com.docker.compose.project': 'myapp' },
        NetworkSettings: {
          Networks: {
            'app-net': { NetworkID: 'n1' } as Dockerode.NetworkInfo,
          },
        },
      }),
    ];

    const services = containersToDiscoveredServices(containers);
    expect(services[0].metadata).toEqual({
      containerId: 'deadbeef1234',
      state: 'running',
      status: 'Up 3 hours',
      labels: { 'com.docker.compose.project': 'myapp' },
      networks: ['app-net'],
    });
  });

  it('handles empty container list', () => {
    const services = containersToDiscoveredServices([]);
    expect(services).toEqual([]);
  });

  it('handles multi-network containers correctly', () => {
    const containers = [
      container({
        Names: ['/gateway'],
        NetworkSettings: {
          Networks: {
            'frontend-net': { NetworkID: 'n1' } as Dockerode.NetworkInfo,
            'backend-net': { NetworkID: 'n2' } as Dockerode.NetworkInfo,
          },
        },
      }),
      container({
        Names: ['/web'],
        NetworkSettings: {
          Networks: {
            'frontend-net': { NetworkID: 'n1' } as Dockerode.NetworkInfo,
          },
        },
      }),
      container({
        Names: ['/api'],
        NetworkSettings: {
          Networks: {
            'backend-net': { NetworkID: 'n2' } as Dockerode.NetworkInfo,
          },
        },
      }),
    ];

    const services = containersToDiscoveredServices(containers);

    const gateway = services.find((s) => s.id === 'gateway')!;
    const web = services.find((s) => s.id === 'web')!;
    const api = services.find((s) => s.id === 'api')!;

    // gateway connects to both networks → sees web and api
    expect(gateway.dependsOn).toContain('web');
    expect(gateway.dependsOn).toContain('api');

    // web only on frontend-net → sees gateway, not api
    expect(web.dependsOn).toContain('gateway');
    expect(web.dependsOn).not.toContain('api');

    // api only on backend-net → sees gateway, not web
    expect(api.dependsOn).toContain('gateway');
    expect(api.dependsOn).not.toContain('web');
  });
});
