import { describe, it, expect } from 'vitest';
import { classifyServiceType } from './serviceType.js';

describe('classifyServiceType', () => {
  it('returns "datastore" for postgres images', () => {
    expect(classifyServiceType('postgres:16')).toBe('datastore');
    expect(classifyServiceType('postgres')).toBe('datastore');
    expect(classifyServiceType('library/postgres:latest')).toBe('datastore');
  });

  it('returns "datastore" for mysql and mongo images', () => {
    expect(classifyServiceType('mysql:8')).toBe('datastore');
    expect(classifyServiceType('mongo:7')).toBe('datastore');
    expect(classifyServiceType('mariadb:11')).toBe('datastore');
  });

  it('returns "cache" for redis and memcached images', () => {
    expect(classifyServiceType('redis:7-alpine')).toBe('cache');
    expect(classifyServiceType('memcached:latest')).toBe('cache');
    expect(classifyServiceType('valkey/valkey:8')).toBe('cache');
  });

  it('returns "message-broker" for rabbitmq and kafka images', () => {
    expect(classifyServiceType('rabbitmq:3-management')).toBe('message-broker');
    expect(classifyServiceType('confluentinc/cp-kafka:7.5')).toBe('message-broker');
    expect(classifyServiceType('nats:latest')).toBe('message-broker');
  });

  it('returns "service" for application images', () => {
    expect(classifyServiceType('node:22-slim')).toBe('service');
    expect(classifyServiceType('my-app:latest')).toBe('service');
    expect(classifyServiceType('nginx:alpine')).toBe('service');
  });

  it('returns "service" for undefined image', () => {
    expect(classifyServiceType(undefined)).toBe('service');
  });

  it('handles registry-prefixed images', () => {
    expect(classifyServiceType('ghcr.io/myorg/postgres-custom:1.0')).toBe('datastore');
    expect(classifyServiceType('docker.io/library/redis:7')).toBe('cache');
  });
});
