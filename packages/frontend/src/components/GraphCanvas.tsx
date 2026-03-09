import { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
  type OnEdgesChange,
  type OnNodesChange,
  useNodesState,
  useEdgesState,
  type ColorMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useAppStore, findingsForNode } from '../store';
import ServiceNodeComponent from './ServiceNode';
import ContractEdgeComponent, { EdgeMarkerDefs } from './ContractEdge';
import ScoreBadge from './ScoreBadge';
import InspectionPanel from './InspectionPanel';
import type { FindingSeverity, TestStatus } from '../types';

// ─── Custom node/edge type registrations ────────────────────────────────

const nodeTypes = { service: ServiceNodeComponent };
const edgeTypes = { contract: ContractEdgeComponent };

// ─── Severity ordering ─────────────────────────────────────────────────

const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

function worstSeverity(findings: { severity: FindingSeverity }[]): FindingSeverity | null {
  if (findings.length === 0) return null;
  return findings.reduce((worst, f) =>
    SEVERITY_ORDER[f.severity] < SEVERITY_ORDER[worst.severity] ? f : worst,
  ).severity;
}

// ─── Component ──────────────────────────────────────────────────────────

export default function GraphCanvas() {
  const graph = useAppStore((s) => s.graph);
  const evaluation = useAppStore((s) => s.evaluation);
  const setSelectedEdge = useAppStore((s) => s.setSelectedEdge);
  const selectedEdgeId = useAppStore((s) => s.selectedEdgeId);
  const edgeTestStatus = useAppStore((s) => s.edgeTestStatus);
  const reset = useAppStore((s) => s.reset);

  // Convert backend graph to React Flow nodes
  const initialNodes: Node[] = useMemo(() => {
    if (!graph) return [];
    return graph.nodes.map((n) => {
      const findings = findingsForNode(evaluation, n.id);
      return {
        id: n.id,
        type: 'service',
        position: { x: n.x - n.width / 2, y: n.y - n.height / 2 },
        data: {
          label: n.label,
          serviceType: n.serviceType,
          ports: n.ports,
          hasSpec: n.hasSpec,
          findingCount: findings.length,
          worstSeverity: worstSeverity(findings),
        },
      };
    });
  }, [graph, evaluation]);

  // Convert backend graph to React Flow edges
  const initialEdges: Edge[] = useMemo(() => {
    if (!graph) return [];
    return graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'contract',
      data: {
        edgeType: e.type,
        label: e.label,
        testStatus: edgeTestStatus[e.id] as TestStatus | undefined,
      },
    }));
  }, [graph, edgeTestStatus]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      setSelectedEdge(edge.id);
    },
    [setSelectedEdge],
  );

  const onPaneClick = useCallback(() => {
    setSelectedEdge(null);
  }, [setSelectedEdge]);

  if (!graph) return null;

  const panelOpen = !!selectedEdgeId;

  return (
    <div className="w-full h-screen relative">
      {/* Top-left header bar */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
        <button
          onClick={reset}
          className="px-3 py-1.5 rounded-lg bg-gray-800/90 border border-gray-700 text-gray-300 text-sm hover:bg-gray-700 transition-colors backdrop-blur-sm"
        >
          ← New Scan
        </button>
        <span className="text-sm text-gray-500">
          {graph.nodes.length} services · {graph.edges.length} connections
        </span>
      </div>

      {/* Score badge */}
      <ScoreBadge />

      {/* Edge marker SVG defs */}
      <EdgeMarkerDefs />

      {/* React Flow canvas */}
      <div className={`h-full transition-all duration-300 ${panelOpen ? 'mr-96' : ''}`}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2}
          colorMode={'dark' as ColorMode}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#374151"
          />
          <Controls
            className="!bg-gray-800/90 !border-gray-700 !shadow-lg [&>button]:!bg-gray-800 [&>button]:!border-gray-700 [&>button]:!text-gray-300 [&>button:hover]:!bg-gray-700"
          />
          <MiniMap
            className="!bg-gray-900/90 !border-gray-700"
            nodeColor={(node) => {
              const data = node.data as Record<string, unknown>;
              const st = data?.serviceType as string;
              switch (st) {
                case 'datastore': return '#10b981';
                case 'cache': return '#f59e0b';
                case 'message-broker': return '#8b5cf6';
                default: return '#3b82f6';
              }
            }}
            maskColor="rgba(0,0,0,0.7)"
          />
        </ReactFlow>
      </div>

      {/* Inspection panel */}
      <InspectionPanel />
    </div>
  );
}
