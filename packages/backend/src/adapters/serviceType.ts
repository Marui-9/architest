import type { ServiceType } from '../types.js';

/**
 * Known image patterns → service type classification.
 * Checked against the image name (lowercased, without tag).
 */
const DATASTORE_PATTERNS = [
  'postgres', 'postgresql', 'mysql', 'mariadb', 'mongo', 'mongodb',
  'cockroachdb', 'cockroach', 'cassandra', 'scylladb', 'couchdb',
  'neo4j', 'dgraph', 'arangodb', 'rethinkdb', 'timescaledb',
  'clickhouse', 'influxdb', 'questdb', 'mssql', 'sql-server',
  'sqlite', 'duckdb', 'surrealdb',
];

const CACHE_PATTERNS = [
  'redis', 'memcached', 'keydb', 'dragonfly', 'valkey', 'hazelcast',
];

const MESSAGE_BROKER_PATTERNS = [
  'rabbitmq', 'kafka', 'nats', 'pulsar', 'activemq', 'mosquitto',
  'emqx', 'redpanda', 'zookeeper', 'strimzi',
];

/**
 * Classify a service type from its Docker image name.
 * Returns 'service' if no known pattern matches.
 */
export function classifyServiceType(image?: string): ServiceType {
  if (!image) return 'service';

  // Strip tag and registry prefix, lowercase
  const name = image.split(':')[0].split('/').pop()?.toLowerCase() ?? '';

  if (DATASTORE_PATTERNS.some((p) => name.includes(p))) return 'datastore';
  if (CACHE_PATTERNS.some((p) => name.includes(p))) return 'cache';
  if (MESSAGE_BROKER_PATTERNS.some((p) => name.includes(p))) return 'message-broker';

  return 'service';
}
