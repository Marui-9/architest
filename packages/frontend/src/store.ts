import { create } from 'zustand';
import type {
  ArchitectureGraph,
  EvaluationResult,
  AppView,
  Finding,
  ContractTestResult,
  HealthProbeResult,
  EdgeDetail,
  TestStatus,
} from './types';
import {
  scanProject as apiScanProject,
  scanDaemon as apiScanDaemon,
  fetchGraph,
  fetchEvaluation,
  fetchEdgeDetail,
  runContractTest as apiRunContractTest,
  runHealthProbe as apiRunHealthProbe,
} from './api';

// ─── Store interface ────────────────────────────────────────────────────

export interface AppState {
  // View
  view: AppView;
  setView: (view: AppView) => void;

  // Scan
  scanning: boolean;
  scanError: string | null;

  // Graph
  graph: ArchitectureGraph | null;

  // Evaluation
  evaluation: EvaluationResult | null;

  // Selected edge/node
  selectedEdgeId: string | null;
  setSelectedEdge: (id: string | null) => void;

  // Edge detail (from GET /api/graph/edge/:id)
  edgeDetail: EdgeDetail | null;
  edgeDetailLoading: boolean;
  edgeDetailError: string | null;

  // Test results (keyed by edgeId)
  contractResults: Record<string, ContractTestResult>;
  healthResults: Record<string, HealthProbeResult>;

  // Edge test status (for coloring edges on canvas)
  edgeTestStatus: Record<string, TestStatus>;

  // Test runner state
  testRunning: string | null; // edgeId currently being tested

  // Actions
  scanProject: (projectPath: string) => Promise<void>;
  scanDaemon: () => Promise<void>;
  loadEdgeDetail: (edgeId: string) => Promise<void>;
  runContractTest: (edgeId: string) => Promise<void>;
  runHealthProbe: (edgeId: string) => Promise<void>;
  reset: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────

/** Get findings targeting a specific node */
export function findingsForNode(
  evaluation: EvaluationResult | null,
  nodeId: string,
): Finding[] {
  if (!evaluation) return [];
  return evaluation.findings.filter((f) => f.targets.includes(nodeId));
}

// ─── Store ──────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>((set, get) => ({
  view: 'landing',
  setView: (view) => set({ view }),

  scanning: false,
  scanError: null,

  graph: null,
  evaluation: null,

  selectedEdgeId: null,
  setSelectedEdge: (id) => {
    set({ selectedEdgeId: id, edgeDetail: null, edgeDetailLoading: false, edgeDetailError: null });
    if (id) get().loadEdgeDetail(id);
  },

  edgeDetail: null,
  edgeDetailLoading: false,
  edgeDetailError: null,

  contractResults: {},
  healthResults: {},
  edgeTestStatus: {},
  testRunning: null,

  scanProject: async (projectPath: string) => {
    set({ scanning: true, scanError: null });
    try {
      await apiScanProject(projectPath);
      const [graph, evaluation] = await Promise.all([
        fetchGraph(),
        fetchEvaluation(),
      ]);
      set({
        graph,
        evaluation,
        view: 'canvas',
        scanning: false,
        contractResults: {},
        healthResults: {},
        edgeTestStatus: {},
      });
    } catch (err) {
      set({
        scanning: false,
        scanError: err instanceof Error ? err.message : String(err),
      });
    }
  },

  scanDaemon: async () => {
    set({ scanning: true, scanError: null });
    try {
      await apiScanDaemon();
      const [graph, evaluation] = await Promise.all([
        fetchGraph(),
        fetchEvaluation(),
      ]);
      set({
        graph,
        evaluation,
        view: 'canvas',
        scanning: false,
        contractResults: {},
        healthResults: {},
        edgeTestStatus: {},
      });
    } catch (err) {
      set({
        scanning: false,
        scanError: err instanceof Error ? err.message : String(err),
      });
    }
  },

  loadEdgeDetail: async (edgeId: string) => {
    set({ edgeDetailLoading: true, edgeDetailError: null });
    try {
      const detail = await fetchEdgeDetail(edgeId);
      set({ edgeDetail: detail, edgeDetailLoading: false });
    } catch (err) {
      set({
        edgeDetailLoading: false,
        edgeDetailError: err instanceof Error ? err.message : String(err),
      });
    }
  },

  runContractTest: async (edgeId: string) => {
    set((s) => ({
      testRunning: edgeId,
      edgeTestStatus: { ...s.edgeTestStatus, [edgeId]: 'running' as TestStatus },
    }));
    try {
      const result = await apiRunContractTest(edgeId);
      set((s) => ({
        testRunning: null,
        contractResults: { ...s.contractResults, [edgeId]: result },
        edgeTestStatus: { ...s.edgeTestStatus, [edgeId]: result.status },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set((s) => ({
        testRunning: null,
        contractResults: {
          ...s.contractResults,
          [edgeId]: {
            edgeId,
            status: 'error' as TestStatus,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            endpoints: [{ method: '*', path: '*', status: 'error' as TestStatus, error: message }],
            summary: { total: 0, passed: 0, failed: 0, errors: 1 },
          },
        },
        edgeTestStatus: { ...s.edgeTestStatus, [edgeId]: 'error' as TestStatus },
      }));
    }
  },

  runHealthProbe: async (edgeId: string) => {
    set((s) => ({
      testRunning: edgeId,
      edgeTestStatus: { ...s.edgeTestStatus, [edgeId]: 'running' as TestStatus },
    }));
    try {
      const result = await apiRunHealthProbe(edgeId);
      set((s) => ({
        testRunning: null,
        healthResults: { ...s.healthResults, [edgeId]: result },
        edgeTestStatus: { ...s.edgeTestStatus, [edgeId]: result.status },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set((s) => ({
        testRunning: null,
        healthResults: {
          ...s.healthResults,
          [edgeId]: {
            edgeId,
            target: edgeId,
            status: 'error' as TestStatus,
            reachable: false,
            method: 'tcp' as const,
            error: message,
          },
        },
        edgeTestStatus: { ...s.edgeTestStatus, [edgeId]: 'error' as TestStatus },
      }));
    }
  },

  reset: () =>
    set({
      view: 'landing',
      graph: null,
      evaluation: null,
      selectedEdgeId: null,
      scanError: null,
      edgeDetail: null,
      edgeDetailLoading: false,
      contractResults: {},
      healthResults: {},
      edgeTestStatus: {},
      testRunning: null,
    }),
}));
