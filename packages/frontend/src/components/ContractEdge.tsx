import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import type { EdgeType, TestStatus } from '../types';

// ─── Edge colors by type ────────────────────────────────────────────────

const EDGE_COLORS: Record<EdgeType, string> = {
  api: '#3b82f6',       // blue-500
  datastore: '#10b981', // emerald-500
  dependency: '#6b7280', // gray-500
};

const EDGE_STROKE_DASH: Record<EdgeType, string | undefined> = {
  api: undefined,
  datastore: '6 3',
  dependency: '4 4',
};

// ─── Test status overlay colors ─────────────────────────────────────────

const TEST_STATUS_COLORS: Record<TestStatus, string> = {
  pass: '#10b981',    // emerald-500
  fail: '#ef4444',    // red-500
  error: '#f97316',   // orange-500
  running: '#3b82f6', // blue-500 (pulsing)
  pending: '#6b7280', // gray-500
};

// ─── Component ──────────────────────────────────────────────────────────

export interface ContractEdgeData {
  edgeType: EdgeType;
  label?: string;
  testStatus?: TestStatus;
  [key: string]: unknown;
}

function ContractEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const edgeData = data as unknown as ContractEdgeData;
  const edgeType = edgeData?.edgeType ?? 'dependency';
  const label = edgeData?.label;
  const testStatus = edgeData?.testStatus;

  // Test status overrides the base edge type color
  const color = testStatus ? TEST_STATUS_COLORS[testStatus] : EDGE_COLORS[edgeType];
  const isRunning = testStatus === 'running';

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: selected ? 2.5 : testStatus ? 2 : 1.5,
          strokeDasharray: isRunning ? '8 4' : EDGE_STROKE_DASH[edgeType],
          filter: selected ? `drop-shadow(0 0 4px ${color})` : undefined,
          animation: isRunning ? 'edge-dash 0.5s linear infinite' : undefined,
        }}
        markerEnd={`url(#marker-${testStatus ? 'tested-' + testStatus : edgeType})`}
      />
      {(label || testStatus) && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            <span
              className="text-[10px] px-1.5 py-0.5 rounded bg-gray-900/90 border border-gray-700 text-gray-400"
            >
              {testStatus === 'pass' ? '✓ ' : testStatus === 'fail' ? '✗ ' : testStatus === 'error' ? '⚠ ' : testStatus === 'running' ? '⟳ ' : ''}
              {label ?? ''}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(ContractEdgeComponent);

/**
 * SVG marker definitions for edge arrowheads.
 * Render this once inside the ReactFlow wrapper.
 */
export function EdgeMarkerDefs() {
  // Combine base edge colors + test status colors into one set of markers
  const allMarkers: [string, string][] = [
    ...(Object.entries(EDGE_COLORS) as [string, string][]).map(
      ([type, color]) => [`marker-${type}`, color] as [string, string],
    ),
    ...(Object.entries(TEST_STATUS_COLORS) as [string, string][]).map(
      ([status, color]) => [`marker-tested-${status}`, color] as [string, string],
    ),
  ];

  return (
    <svg className="absolute w-0 h-0">
      <defs>
        {allMarkers.map(([markerId, color]) => (
          <marker
            key={markerId}
            id={markerId}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
          </marker>
        ))}
      </defs>
      <style>{`
        @keyframes edge-dash {
          to { stroke-dashoffset: -12; }
        }
      `}</style>
    </svg>
  );
}
