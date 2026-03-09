import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './store';
import { findingsForNode } from './store';
import type { EvaluationResult, TestStatus } from './types';

describe('frontend', () => {
  beforeEach(() => {
    // Reset store between tests
    useAppStore.setState({
      view: 'landing',
      scanning: false,
      scanError: null,
      graph: null,
      evaluation: null,
      selectedEdgeId: null,
      edgeDetail: null,
      edgeDetailLoading: false,
      contractResults: {},
      healthResults: {},
      edgeTestStatus: {},
      testRunning: null,
    });
  });

  it('store initialises with landing view', () => {
    const state = useAppStore.getState();
    expect(state.view).toBe('landing');
    expect(state.graph).toBeNull();
    expect(state.evaluation).toBeNull();
  });

  it('setView switches to canvas', () => {
    useAppStore.getState().setView('canvas');
    expect(useAppStore.getState().view).toBe('canvas');
  });

  it('setSelectedEdge tracks edge id and clears previous detail', () => {
    useAppStore.setState({
      edgeDetail: { edge: { id: 'x', source: 'a', target: 'b', type: 'api' }, sourceNode: null, targetNode: null },
    });
    useAppStore.getState().setSelectedEdge('api->db');
    const state = useAppStore.getState();
    expect(state.selectedEdgeId).toBe('api->db');
    expect(state.edgeDetail).toBeNull();
  });

  it('setSelectedEdge(null) clears selection', () => {
    useAppStore.getState().setSelectedEdge('api->db');
    useAppStore.getState().setSelectedEdge(null);
    expect(useAppStore.getState().selectedEdgeId).toBeNull();
  });

  it('reset clears all state', () => {
    useAppStore.setState({
      view: 'canvas',
      graph: { nodes: [], edges: [] },
      evaluation: {
        score: 100,
        totalFindings: 0,
        counts: { error: 0, warning: 0, info: 0 },
        findings: [],
        rulesEvaluated: [],
      },
      selectedEdgeId: 'x->y',
      contractResults: { 'x->y': { edgeId: 'x->y', status: 'pass', startedAt: '', endpoints: [], summary: { total: 0, passed: 0, failed: 0, errors: 0 } } },
      healthResults: { 'a->b': { edgeId: 'a->b', target: 'b', status: 'pass', reachable: true, method: 'http' } },
      edgeTestStatus: { 'x->y': 'pass' },
      testRunning: null,
    });

    useAppStore.getState().reset();
    const state = useAppStore.getState();
    expect(state.view).toBe('landing');
    expect(state.graph).toBeNull();
    expect(state.evaluation).toBeNull();
    expect(state.selectedEdgeId).toBeNull();
    expect(state.contractResults).toEqual({});
    expect(state.healthResults).toEqual({});
    expect(state.edgeTestStatus).toEqual({});
    expect(state.testRunning).toBeNull();
  });

  it('findingsForNode filters findings by target', () => {
    const evaluation: EvaluationResult = {
      score: 80,
      totalFindings: 3,
      counts: { error: 1, warning: 1, info: 1 },
      findings: [
        { ruleId: 'r1', severity: 'error', message: 'bad', targets: ['api'] },
        { ruleId: 'r2', severity: 'warning', message: 'meh', targets: ['db'] },
        { ruleId: 'r3', severity: 'info', message: 'ok', targets: ['api', 'db'] },
      ],
      rulesEvaluated: ['r1', 'r2', 'r3'],
    };

    expect(findingsForNode(evaluation, 'api')).toHaveLength(2);
    expect(findingsForNode(evaluation, 'db')).toHaveLength(2);
    expect(findingsForNode(evaluation, 'unknown')).toHaveLength(0);
    expect(findingsForNode(null, 'api')).toHaveLength(0);
  });

  // ── Test result state management ────────────────────────────────────

  it('stores contract test results and updates edge test status', () => {
    const testResult = {
      edgeId: 'a->b',
      status: 'pass' as TestStatus,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      endpoints: [],
      summary: { total: 1, passed: 1, failed: 0, errors: 0 },
    };

    useAppStore.setState({
      contractResults: { 'a->b': testResult },
      edgeTestStatus: { 'a->b': 'pass' },
    });

    const state = useAppStore.getState();
    expect(state.contractResults['a->b'].status).toBe('pass');
    expect(state.edgeTestStatus['a->b']).toBe('pass');
  });

  it('stores health probe results', () => {
    const healthResult = {
      edgeId: 'a->db',
      target: 'db',
      status: 'pass' as TestStatus,
      reachable: true,
      latencyMs: 5,
      method: 'http' as const,
    };

    useAppStore.setState({
      healthResults: { 'a->db': healthResult },
      edgeTestStatus: { 'a->db': 'pass' },
    });

    const state = useAppStore.getState();
    expect(state.healthResults['a->db'].reachable).toBe(true);
    expect(state.edgeTestStatus['a->db']).toBe('pass');
  });

  it('testRunning tracks which edge is being tested', () => {
    useAppStore.setState({ testRunning: 'a->b' });
    expect(useAppStore.getState().testRunning).toBe('a->b');

    useAppStore.setState({ testRunning: null });
    expect(useAppStore.getState().testRunning).toBeNull();
  });
});
