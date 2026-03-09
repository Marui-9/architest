import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../server.js';
import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('scan routes – error handling', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
  });

  it('rejects invalid scan mode with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/scan',
      payload: { projectPath: '/tmp', mode: 'invalid' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('Invalid scan mode');
  });

  it('rejects missing projectPath for compose mode with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/scan',
      payload: { mode: 'compose' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('Missing or invalid projectPath');
  });

  it('returns 404 when projectPath does not exist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/scan',
      payload: { projectPath: '/nonexistent/path/xyz123', mode: 'compose' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toContain('does not exist');
  });

  it('returns 400 when projectPath is not a directory', async () => {
    const tmpFile = path.join(os.tmpdir(), `architest-scan-test-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, 'not a dir');
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/scan',
        payload: { projectPath: tmpFile, mode: 'compose' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('not a directory');
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it('classifies file-not-found errors as 404', async () => {
    // Use an empty temp dir that exists but has no compose file
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'architest-scan-'));
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/scan',
        payload: { projectPath: tmpDir, mode: 'compose' },
      });
      // The compose parser will throw "not found" which should map to 404
      expect(res.statusCode).toBe(404);
      expect(res.json().detail).toContain('not found');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('classifies YAML parse errors as 400', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'architest-scan-'));
    fs.writeFileSync(path.join(tmpDir, 'docker-compose.yml'), '{{{{bad yaml');
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/scan',
        payload: { projectPath: tmpDir, mode: 'compose' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('Parse error');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
