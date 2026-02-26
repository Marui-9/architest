import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  parseDockerCompose,
  parseProjectCompose,
  findComposeFile,
  parsePort,
} from './dockerCompose.js';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'architest-test-'));
}

function writeFile(dir: string, name: string, content: string): string {
  const filePath = path.join(dir, name);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

function cleanDir(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── parsePort ──────────────────────────────────────────────────────────

describe('parsePort', () => {
  it('parses "host:container" string', () => {
    expect(parsePort('8080:80')).toEqual({ host: 8080, container: 80 });
  });

  it('parses number as same host and container', () => {
    expect(parsePort(3000)).toEqual({ host: 3000, container: 3000 });
  });

  it('parses single string port as same host and container', () => {
    expect(parsePort('5432')).toEqual({ host: 5432, container: 5432 });
  });

  it('parses port with protocol', () => {
    expect(parsePort('8080:80/tcp')).toEqual({ host: 8080, container: 80, protocol: 'tcp' });
  });

  it('parses port with IP binding', () => {
    expect(parsePort('127.0.0.1:8080:80')).toEqual({ host: 8080, container: 80 });
  });

  it('returns null for invalid string', () => {
    expect(parsePort('not-a-port')).toBeNull();
  });
});

// ─── findComposeFile ────────────────────────────────────────────────────

describe('findComposeFile', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = createTempDir();
  });

  afterAll(() => {
    cleanDir(tmpDir);
  });

  it('returns null when no compose file exists', () => {
    expect(findComposeFile(tmpDir)).toBeNull();
  });

  it('finds docker-compose.yml', () => {
    writeFile(tmpDir, 'docker-compose.yml', 'services: {}');
    const result = findComposeFile(tmpDir);
    expect(result).toBe(path.join(tmpDir, 'docker-compose.yml'));
    fs.unlinkSync(path.join(tmpDir, 'docker-compose.yml'));
  });

  it('finds compose.yaml', () => {
    writeFile(tmpDir, 'compose.yaml', 'services: {}');
    const result = findComposeFile(tmpDir);
    expect(result).toBe(path.join(tmpDir, 'compose.yaml'));
    fs.unlinkSync(path.join(tmpDir, 'compose.yaml'));
  });
});

// ─── parseDockerCompose ─────────────────────────────────────────────────

describe('parseDockerCompose', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = createTempDir();
  });

  afterAll(() => {
    cleanDir(tmpDir);
  });

  it('parses a simple 2-service compose file', () => {
    const composePath = writeFile(
      tmpDir,
      'simple.yml',
      `
services:
  frontend:
    image: node:22
    ports:
      - "3000:3000"
  postgres:
    image: postgres:16
    ports:
      - "5432:5432"
`,
    );

    const result = parseDockerCompose(composePath);
    expect(result.services).toHaveLength(2);
    expect(result.services[0]).toMatchObject({
      name: 'frontend',
      image: 'node:22',
      ports: [{ host: 3000, container: 3000 }],
      dependsOn: [],
    });
    expect(result.services[1]).toMatchObject({
      name: 'postgres',
      image: 'postgres:16',
      ports: [{ host: 5432, container: 5432 }],
      dependsOn: [],
    });
  });

  it('parses depends_on short syntax (array)', () => {
    const composePath = writeFile(
      tmpDir,
      'depends-short.yml',
      `
services:
  api:
    image: node:22
    depends_on:
      - postgres
      - redis
  postgres:
    image: postgres:16
  redis:
    image: redis:7
`,
    );

    const result = parseDockerCompose(composePath);
    const api = result.services.find((s) => s.name === 'api');
    expect(api?.dependsOn).toEqual(['postgres', 'redis']);
  });

  it('parses depends_on long syntax (object)', () => {
    const composePath = writeFile(
      tmpDir,
      'depends-long.yml',
      `
services:
  api:
    image: node:22
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
  postgres:
    image: postgres:16
  redis:
    image: redis:7
`,
    );

    const result = parseDockerCompose(composePath);
    const api = result.services.find((s) => s.name === 'api');
    expect(api?.dependsOn).toEqual(['postgres', 'redis']);
  });

  it('handles services with no ports', () => {
    const composePath = writeFile(
      tmpDir,
      'no-ports.yml',
      `
services:
  worker:
    image: node:22
`,
    );

    const result = parseDockerCompose(composePath);
    expect(result.services[0].ports).toEqual([]);
  });

  it('parses build context string', () => {
    const composePath = writeFile(
      tmpDir,
      'build-string.yml',
      `
services:
  api:
    build: ./api
    ports:
      - "8080:8080"
`,
    );

    const result = parseDockerCompose(composePath);
    expect(result.services[0].build).toBe('./api');
  });

  it('parses build context object', () => {
    const composePath = writeFile(
      tmpDir,
      'build-object.yml',
      `
services:
  api:
    build:
      context: ./services/api
      dockerfile: Dockerfile.prod
    ports:
      - "8080:8080"
`,
    );

    const result = parseDockerCompose(composePath);
    expect(result.services[0].build).toBe('./services/api');
  });

  it('throws on file not found', () => {
    expect(() => parseDockerCompose('/nonexistent/docker-compose.yml')).toThrow('not found');
  });

  it('throws on invalid YAML', () => {
    const composePath = writeFile(tmpDir, 'bad.yml', '{{{{invalid yaml');
    expect(() => parseDockerCompose(composePath)).toThrow('Failed to parse YAML');
  });

  it('throws when services key is missing', () => {
    const composePath = writeFile(tmpDir, 'no-services.yml', 'version: "3"\nfoo: bar\n');
    expect(() => parseDockerCompose(composePath)).toThrow('No "services" key');
  });
});

// ─── parseProjectCompose ────────────────────────────────────────────────

describe('parseProjectCompose', () => {
  it('throws when no compose file exists in directory', () => {
    const tmpDir = createTempDir();
    expect(() => parseProjectCompose(tmpDir)).toThrow('No Docker Compose file found');
    cleanDir(tmpDir);
  });

  it('finds and parses docker-compose.yml in a project directory', () => {
    const tmpDir = createTempDir();
    writeFile(
      tmpDir,
      'docker-compose.yml',
      `
services:
  app:
    image: node:22
    ports:
      - "3000:3000"
`,
    );

    const result = parseProjectCompose(tmpDir);
    expect(result.services).toHaveLength(1);
    expect(result.services[0].name).toBe('app');
    cleanDir(tmpDir);
  });
});
