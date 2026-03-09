import { useAppStore } from '../store';
import type {
  ContractTestResult,
  HealthProbeResult,
  EndpointTestResult,
  TestStatus,
  EdgeType,
} from '../types';

// ─── Status helpers ─────────────────────────────────────────────────────

const STATUS_COLORS: Record<TestStatus, string> = {
  pass: 'text-emerald-400',
  fail: 'text-red-400',
  error: 'text-orange-400',
  running: 'text-blue-400',
  pending: 'text-gray-500',
};

const STATUS_BG: Record<TestStatus, string> = {
  pass: 'bg-emerald-500/20 border-emerald-500/30',
  fail: 'bg-red-500/20 border-red-500/30',
  error: 'bg-orange-500/20 border-orange-500/30',
  running: 'bg-blue-500/20 border-blue-500/30',
  pending: 'bg-gray-500/20 border-gray-500/30',
};

const STATUS_ICON: Record<TestStatus, string> = {
  pass: '✓',
  fail: '✗',
  error: '⚠',
  running: '⟳',
  pending: '○',
};

const EDGE_TYPE_LABEL: Record<EdgeType, string> = {
  api: 'API Connection',
  datastore: 'Datastore Connection',
  dependency: 'Service Dependency',
};

const METHOD_COLORS: Record<string, string> = {
  get: 'bg-emerald-600/30 text-emerald-300',
  post: 'bg-blue-600/30 text-blue-300',
  put: 'bg-amber-600/30 text-amber-300',
  patch: 'bg-orange-600/30 text-orange-300',
  delete: 'bg-red-600/30 text-red-300',
};

// ─── Sub-components ─────────────────────────────────────────────────────

function EndpointRow({ ep }: { ep: EndpointTestResult }) {
  const methodColor = METHOD_COLORS[ep.method.toLowerCase()] ?? 'bg-gray-600/30 text-gray-300';
  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-800/50 transition-colors">
      <span className={`${STATUS_COLORS[ep.status]} text-xs font-mono w-4`}>
        {STATUS_ICON[ep.status]}
      </span>
      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase ${methodColor}`}>
        {ep.method}
      </span>
      <span className="text-sm text-gray-300 font-mono truncate flex-1">{ep.path}</span>
      {ep.httpStatus && (
        <span className="text-xs text-gray-500">{ep.httpStatus}</span>
      )}
      {ep.latencyMs !== undefined && ep.latencyMs > 0 && (
        <span className="text-xs text-gray-600">{ep.latencyMs}ms</span>
      )}
    </div>
  );
}

function ContractResultView({ result }: { result: ContractTestResult }) {
  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className={`flex items-center gap-2 p-2 rounded border ${STATUS_BG[result.status]}`}>
        <span className={`text-lg ${STATUS_COLORS[result.status]}`}>
          {STATUS_ICON[result.status]}
        </span>
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-200">
            {result.status === 'pass'
              ? 'All tests passed'
              : result.status === 'fail'
                ? 'Some tests failed'
                : 'Test errors'}
          </div>
          <div className="text-xs text-gray-400">
            {result.summary.passed}/{result.summary.total} passed
            {result.summary.failed > 0 && ` · ${result.summary.failed} failed`}
            {result.summary.errors > 0 && ` · ${result.summary.errors} errors`}
          </div>
        </div>
      </div>

      {/* Endpoint results */}
      <div className="space-y-0.5">
        {result.endpoints.map((ep, i) => (
          <div key={i}>
            <EndpointRow ep={ep} />
            {ep.schemaErrors && ep.schemaErrors.length > 0 && (
              <div className="ml-8 mt-1 mb-2 space-y-1">
                {ep.schemaErrors.map((err, j) => (
                  <div key={j} className="text-xs text-red-400/80 font-mono">
                    {err}
                  </div>
                ))}
              </div>
            )}
            {ep.error && (
              <div className="ml-8 mt-1 mb-2 text-xs text-orange-400/80 font-mono">
                {ep.error}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function HealthResultView({ result }: { result: HealthProbeResult }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded border ${STATUS_BG[result.status]}`}>
      <span className={`text-2xl ${STATUS_COLORS[result.status]}`}>
        {STATUS_ICON[result.status]}
      </span>
      <div className="flex-1">
        <div className="text-sm font-medium text-gray-200">
          {result.reachable ? 'Service reachable' : 'Service unreachable'}
        </div>
        <div className="text-xs text-gray-400">
          via {result.method.toUpperCase()}
          {result.latencyMs !== undefined && ` · ${result.latencyMs}ms`}
        </div>
        {result.error && (
          <div className="text-xs text-orange-400/80 mt-1">{result.error}</div>
        )}
      </div>
    </div>
  );
}

// ─── Main panel ─────────────────────────────────────────────────────────

export default function InspectionPanel() {
  const selectedEdgeId = useAppStore((s) => s.selectedEdgeId);
  const edgeDetail = useAppStore((s) => s.edgeDetail);
  const edgeDetailLoading = useAppStore((s) => s.edgeDetailLoading);
  const edgeDetailError = useAppStore((s) => s.edgeDetailError);
  const setSelectedEdge = useAppStore((s) => s.setSelectedEdge);
  const contractResults = useAppStore((s) => s.contractResults);
  const healthResults = useAppStore((s) => s.healthResults);
  const testRunning = useAppStore((s) => s.testRunning);
  const runContractTest = useAppStore((s) => s.runContractTest);
  const runHealthProbe = useAppStore((s) => s.runHealthProbe);

  if (!selectedEdgeId) return null;

  const isOpen = !!selectedEdgeId;
  const isLoading = edgeDetailLoading;
  const isRunning = testRunning === selectedEdgeId;
  const contractResult = contractResults[selectedEdgeId];
  const healthResult = healthResults[selectedEdgeId];

  const edge = edgeDetail?.edge;
  const sourceNode = edgeDetail?.sourceNode;
  const targetNode = edgeDetail?.targetNode;
  const edgeType = edge?.type ?? 'dependency';
  const isApiEdge = edgeType === 'api';

  return (
    <div
      className={`fixed top-0 right-0 h-full w-96 bg-gray-900 border-l border-gray-700 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-900/95 backdrop-blur-sm">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300 uppercase font-mono">
            {edgeType}
          </span>
          <h2 className="text-sm font-semibold text-gray-200 truncate">
            {EDGE_TYPE_LABEL[edgeType]}
          </h2>
        </div>
        <button
          onClick={() => setSelectedEdge(null)}
          className="text-gray-400 hover:text-gray-200 transition-colors p-1"
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="overflow-y-auto h-[calc(100%-52px)] p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500 text-sm animate-pulse">Loading edge details...</div>
          </div>
        ) : edgeDetailError ? (
          <div className="text-red-400 text-sm text-center py-12 px-4">
            <p className="text-lg mb-2">⚠</p>
            <p>{edgeDetailError}</p>
          </div>
        ) : !edge ? (
          <div className="text-gray-500 text-sm text-center py-12">
            Edge details not available
          </div>
        ) : (
          <>
            {/* Connection info */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Connection
              </h3>
              <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-14">Source</span>
                  <span className="text-sm text-gray-200 font-medium">
                    {sourceNode?.label ?? edge.source}
                  </span>
                </div>
                <div className="flex items-center justify-center">
                  <span className="text-gray-600">→</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-14">Target</span>
                  <span className="text-sm text-gray-200 font-medium">
                    {targetNode?.label ?? edge.target}
                  </span>
                </div>
                {targetNode && targetNode.ports.length > 0 && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-gray-500 w-14">Ports</span>
                    <div className="flex gap-1 flex-wrap">
                      {targetNode.ports.map((p, i) => (
                        <span
                          key={i}
                          className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 font-mono"
                        >
                          {p.host}:{p.container}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {targetNode?.image && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-14">Image</span>
                    <span className="text-xs text-gray-400 font-mono truncate">
                      {targetNode.image}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* API Edge: Endpoint list + Run Test */}
            {isApiEdge && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Endpoints
                  </h3>
                  {edgeDetail?.openapi && (
                    <span className="text-xs text-gray-500">
                      {edgeDetail.openapi.endpoints.length} endpoint
                      {edgeDetail.openapi.endpoints.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Endpoint list from OpenAPI */}
                {edgeDetail?.openapi ? (
                  <div className="bg-gray-800/50 rounded-lg p-2 space-y-0.5 max-h-48 overflow-y-auto">
                    {edgeDetail.openapi.endpoints.map((ep, i) => {
                      const methodColor =
                        METHOD_COLORS[ep.method.toLowerCase()] ?? 'bg-gray-600/30 text-gray-300';
                      return (
                        <div key={i} className="flex items-center gap-2 py-1 px-1">
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase ${methodColor}`}
                          >
                            {ep.method}
                          </span>
                          <span className="text-xs text-gray-300 font-mono truncate flex-1">
                            {ep.path}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 bg-gray-800/50 rounded-lg p-3">
                    No OpenAPI spec available for this service.
                    <br />
                    Add an openapi.json or openapi.yml file to enable contract testing.
                  </div>
                )}

                {/* Run Test button */}
                <button
                  onClick={() => runContractTest(selectedEdgeId)}
                  disabled={isRunning}
                  className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    isRunning
                      ? 'bg-blue-600/30 text-blue-300 cursor-wait'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  {isRunning ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin">⟳</span> Running Tests...
                    </span>
                  ) : (
                    '▶ Run Contract Tests'
                  )}
                </button>

                {/* Contract test results */}
                {contractResult && <ContractResultView result={contractResult} />}
              </div>
            )}

            {/* Non-API Edge: Health probe */}
            {!isApiEdge && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Connectivity
                </h3>

                <button
                  onClick={() => runHealthProbe(selectedEdgeId)}
                  disabled={isRunning}
                  className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    isRunning
                      ? 'bg-emerald-600/30 text-emerald-300 cursor-wait'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {isRunning ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin">⟳</span> Checking...
                    </span>
                  ) : (
                    '⚡ Check Connection'
                  )}
                </button>

                {/* Health probe result */}
                {healthResult && <HealthResultView result={healthResult} />}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
