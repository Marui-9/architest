import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ServiceType, FindingSeverity } from '../types';

// ─── Icon components ────────────────────────────────────────────────────

function ServiceIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="18" rx="2" />
      <path d="M9 3v18M2 9h7M2 15h7" />
    </svg>
  );
}

function DatastoreIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
      <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
    </svg>
  );
}

function CacheIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function BrokerIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h16v6H4zM4 14h16v6H4z" />
      <circle cx="8" cy="7" r="1" fill="currentColor" />
      <circle cx="8" cy="17" r="1" fill="currentColor" />
    </svg>
  );
}

const TYPE_ICONS: Record<ServiceType, React.ComponentType> = {
  service: ServiceIcon,
  datastore: DatastoreIcon,
  cache: CacheIcon,
  'message-broker': BrokerIcon,
};

// ─── Color schemes ──────────────────────────────────────────────────────

const TYPE_COLORS: Record<ServiceType, { border: string; bg: string; icon: string }> = {
  service: { border: 'border-blue-500/50', bg: 'bg-blue-500/10', icon: 'text-blue-400' },
  datastore: { border: 'border-emerald-500/50', bg: 'bg-emerald-500/10', icon: 'text-emerald-400' },
  cache: { border: 'border-amber-500/50', bg: 'bg-amber-500/10', icon: 'text-amber-400' },
  'message-broker': { border: 'border-purple-500/50', bg: 'bg-purple-500/10', icon: 'text-purple-400' },
};

const SEVERITY_BADGE: Record<FindingSeverity, { bg: string; text: string }> = {
  error: { bg: 'bg-red-500', text: 'text-white' },
  warning: { bg: 'bg-amber-500', text: 'text-black' },
  info: { bg: 'bg-blue-500', text: 'text-white' },
};

// ─── Node data type ─────────────────────────────────────────────────────

export interface ServiceNodeData {
  label: string;
  serviceType: ServiceType;
  ports: Array<{ host: number; container: number }>;
  hasSpec: boolean;
  findingCount: number;
  worstSeverity: FindingSeverity | null;
  [key: string]: unknown;
}

// ─── Component ──────────────────────────────────────────────────────────

function ServiceNodeComponent({ data }: NodeProps) {
  const nodeData = data as unknown as ServiceNodeData;
  const { label, serviceType, ports, hasSpec, findingCount, worstSeverity } = nodeData;
  const colors = TYPE_COLORS[serviceType] ?? TYPE_COLORS.service;
  const Icon = TYPE_ICONS[serviceType] ?? TYPE_ICONS.service;

  return (
    <div
      className={`
        relative px-4 py-3 rounded-xl border backdrop-blur-sm
        bg-gray-900/80 shadow-lg shadow-black/20
        min-w-[160px] max-w-[220px]
        ${colors.border}
      `}
    >
      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-gray-600 !border-gray-500"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-gray-600 !border-gray-500"
      />

      {/* Header: icon + name */}
      <div className="flex items-center gap-2">
        <div className={`${colors.icon} ${colors.bg} p-1 rounded`}>
          <Icon />
        </div>
        <span className="text-sm font-semibold text-gray-100 truncate">
          {label}
        </span>
      </div>

      {/* Port badge */}
      {ports.length > 0 && (
        <div className="mt-1.5 flex items-center gap-1 flex-wrap">
          {ports.slice(0, 3).map((p) => (
            <span
              key={p.host}
              className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 font-mono"
            >
              :{p.host}
            </span>
          ))}
          {ports.length > 3 && (
            <span className="text-[10px] text-gray-500">+{ports.length - 3}</span>
          )}
        </div>
      )}

      {/* Spec indicator */}
      {hasSpec && (
        <div className="mt-1 text-[10px] text-green-400 flex items-center gap-1">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M5 13l4 4L19 7" />
          </svg>
          OpenAPI
        </div>
      )}

      {/* Finding badge */}
      {findingCount > 0 && worstSeverity && (
        <div
          className={`
            absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center
            text-[10px] font-bold shadow-md
            ${SEVERITY_BADGE[worstSeverity].bg} ${SEVERITY_BADGE[worstSeverity].text}
          `}
        >
          {findingCount}
        </div>
      )}
    </div>
  );
}

export default memo(ServiceNodeComponent);
