# ArchiTest — MVP Plan of Action

## Premise

ArchiTest is a layered tool where each layer delivers standalone value:

```
Layer 1 — See it    →  Discover services from any source, render the graph
Layer 2 — Score it  →  Run architecture rules on the graph (no specs needed)
Layer 3 — Test it   →  Contract-verify edges that have API specs
```

The MVP ships all three layers. Layer 1 supports two input sources: Docker Compose files and live Docker daemon inspection (via socket). Layers 1 and 2 require no API specs. Layer 3 lights up when OpenAPI specs are present.

Every edge on the graph is at minimum health-probe-testable. Edges with OpenAPI specs get full contract testing. This means every user gets a useful tool regardless of whether they have API specifications.

---

## Current State

| What | Status |
|------|--------|
| Monorepo scaffolding, TypeScript, ESLint, Vite, Fastify, Dockerfile | Code written, never `npm install`'d |
| Docker Compose parser (all format variations) | Implemented, 20 tests, unverified |
| OpenAPI parser (3.x + Swagger 2.x, JSON/YAML) | Implemented, 15+ tests, unverified |
| Spec-to-service association | Implemented, 6 tests, unverified |
| Scan orchestrator | Implemented, 7 tests, unverified |
| Graph builder, frontend, test runner | Stubs / placeholders |

The parsing foundation is solid but untested in practice. Everything else is blank.

---

## Architecture Changes From Original Plan

### 1. Source-agnostic service discovery

The original plan hardcodes Docker Compose as the only input. The new plan introduces an adapter interface so discovery is pluggable:

```typescript
interface InfrastructureAdapter {
  id: string;
  name: string;
  detect(projectPath: string): Promise<boolean>;
  discover(projectPath: string): Promise<DiscoveredService[]>;
}

interface DiscoveredService {
  id: string;                     // unique within the scan
  name: string;                   // display name
  source: string;                 // adapter id ("docker-compose" | "docker-daemon" | ...)
  image?: string;
  ports: PortMapping[];
  dependsOn: string[];            // service ids this depends on
  metadata: Record<string, unknown>; // adapter-specific data
}
```

The existing `DockerService` type maps cleanly onto `DiscoveredService`. The refactor is renaming + adding a `source` field.

### 2. Docker daemon adapter (MVP)

A second adapter that talks to the Docker socket:

```typescript
// Inspect running containers via /var/run/docker.sock
// No config files needed — works with any Docker setup
// Discovers: container names, images, exposed ports, networks
// Infers dependencies from: shared networks, links, environment variables referencing other containers
```

This is the highest-impact addition. Users run:
```bash
docker run -v /var/run/docker.sock:/var/run/docker.sock -p 3000:3000 architest/core
```
And immediately see their running architecture. No compose file, no specs, no config.

### 3. All edges are edges (not just OpenAPI ones)

The original plan only creates edges when `depends_on` target has an OpenAPI spec. The new plan:
- **Every `depends_on` relationship creates an edge**
- Edges are typed: `api` (has spec), `dependency` (no spec), `datastore` (databases/caches)
- All edges support health-probe testing (HTTP/TCP connectivity check)
- Only `api` edges support full contract testing

### 4. Built-in guardrails (no specs required)

A small set of architecture rules that evaluate the graph structure. These run on every scan and produce findings + a score. This is Layer 2 value that requires zero API specs.

---

## Phased Plan

### Phase 1: Verify & Refactor Foundation
**Effort: 2-3 days**

**1.1 — Install and verify**
- Run `npm install` at root
- Run `npm test --workspace=packages/backend` — fix any failures
- Run `npm run build --workspaces` — fix compilation errors
- Verify dev server starts (`npm run dev`)
- Verify Docker build (`docker compose -f docker-compose.dev.yml up`)

**1.2 — Refactor types to be source-agnostic**
- Define `DiscoveredService` in `types.ts` (superset of current `DockerService`)
- Add `source` field and `metadata` bag
- Define `InfrastructureAdapter` interface
- Wrap existing Docker Compose parser as a `DockerComposeAdapter` implementing the interface
- `ScanResult` now uses `DiscoveredService[]` instead of `EnrichedService[]`
- OpenAPI enrichment becomes a separate pass (not baked into the adapter)
- Update existing tests to use new types

**1.3 — Refactor scan orchestrator**
- `scanProject()` becomes adapter-aware:
  1. Run all registered adapters that detect something in the project
  2. Merge discovered services (deduplicate by name)
  3. Run spec discovery + parsing as an enrichment pass
  4. Associate specs to services
  5. Return unified `ScanResult`
- This is a structural refactor, not new functionality — all existing tests should still pass

**Exit criteria:** `npm test` passes. `npm run dev` starts. Existing parsing works through the new adapter interface.

---

### Phase 2: Docker Daemon Adapter
**Effort: 2-3 days**

**2.1 — Docker socket client**
- Install `dockerode` (well-maintained Docker API client for Node.js)
- Create `src/adapters/dockerDaemon.ts`
- Implement `DockerDaemonAdapter`:
  - `detect()` → check if `/var/run/docker.sock` is accessible
  - `discover()` → list running containers, extract:
    - Container name (cleaned: strip leading `/`)
    - Image name
    - Exposed ports (from port bindings)
    - Networks (from container network settings)
    - Dependencies inferred from:
      - Shared user-defined networks (containers on the same network likely communicate)
      - Environment variables containing other container names/addresses
      - Docker Compose `com.docker.compose.project` label (group by compose project)

**2.2 — Network-based dependency inference**
- Containers sharing a non-default Docker network are considered connected
- Direction heuristic: if container A has an env var referencing container B's name → A depends on B
- Fallback: bi-directional edge marked as `unknown-direction`

**2.3 — Service type classification**
- Simple heuristic from image name:
  - `postgres`, `mysql`, `mariadb`, `mongo` → `datastore`
  - `redis`, `memcached` → `cache`
  - `rabbitmq`, `kafka`, `nats` → `message-broker`
  - Everything else → `service`
- Stored in `metadata.serviceType`

**2.4 — Scan route update**
- `POST /api/scan` accepts optional `{ mode: "compose" | "daemon" | "auto" }`
- `auto` (default): try Docker daemon first (live containers are more accurate), fall back to compose file
- When using daemon mode, `projectPath` is optional

**2.5 — Update Dockerfile**
- Ensure the ArchiTest container can access the host Docker socket
- Document the `-v /var/run/docker.sock:/var/run/docker.sock` mount

**2.6 — Tests**
- Unit tests with mocked dockerode responses
- Integration test that inspects the ArchiTest container itself (it's a running container, so the daemon adapter should discover at least one service)

**Exit criteria:** Running `docker run -v /var/run/docker.sock:/var/run/docker.sock -p 3000:3000 architest/core` and hitting `POST /api/scan { mode: "daemon" }` returns discovered services from running containers.

---

### Phase 3: Graph Builder
**Effort: 2-3 days**

**3.1 — Graph types**
```typescript
interface GraphNode {
  id: string;
  label: string;
  serviceType: 'service' | 'datastore' | 'cache' | 'message-broker';
  source: string;           // which adapter discovered this
  ports: PortMapping[];
  hasOpenAPI: boolean;
  position: { x: number; y: number };
}

type EdgeStatus = 'untested' | 'healthy' | 'verified' | 'failed' | 'mismatch' | 'unreachable';
type EdgeType = 'api' | 'dependency' | 'datastore';

interface GraphEdge {
  id: string;
  source: string;           // node id (consumer)
  target: string;           // node id (provider)
  edgeType: EdgeType;
  status: EdgeStatus;
  endpoints?: OpenAPIEndpoint[];  // only for 'api' edges
  lastResult?: TestResult;
}
```

**3.2 — Build graph from scan result**
- `buildGraph(scanResult)` in `src/graph/builder.ts`
- One node per discovered service
- One edge per dependency relationship (ALL `depends_on`, not just OpenAPI ones)
- Edge type derived from target service type
- If target has an associated OpenAPI spec → `edgeType: 'api'` and carry endpoints
- Auto-layout: simple layered layout using `@dagrejs/dagre`

**3.3 — In-memory graph state**
- Graph state singleton (local-first, single-user — no DB for MVP)
- Updated after scan, after test runs
- `GET /api/graph` returns the current graph
- `GET /api/graph/edge/:id` returns edge detail + endpoints (if API edge)

**3.4 — Tests**
- Various scan result shapes: compose-only, daemon-only, mixed
- Edges with and without specs
- Service type classification

**Exit criteria:** `POST /api/scan` followed by `GET /api/graph` returns a well-typed graph with nodes for all services and edges for all dependencies.

---

### Phase 4: Architecture Guardrails
**Effort: 3-4 days**

**4.1 — Rule engine**
```typescript
interface Rule {
  id: string;
  name: string;
  description: string;
  category: 'security' | 'reliability' | 'architecture' | 'hygiene';
  severity: 'error' | 'warning' | 'info';
  evaluate(scanResult: ScanResult, graph: Graph): Finding[];
}

interface Finding {
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  service?: string;       // affected service (if applicable)
  message: string;
  remediation?: string;   // what to do about it
}
```

**4.2 — MVP rule library (10 rules)**

| # | Rule ID | Category | What it catches |
|---|---------|----------|----------------|
| 1 | `no-public-db` | Security | Database/cache services exposing ports to host |
| 2 | `no-latest-tag` | Security | Images using `:latest` instead of pinned versions |
| 3 | `no-privileged` | Security | Services running in privileged mode |
| 4 | `circular-dependency` | Architecture | Circular `depends_on` chains |
| 5 | `excessive-dependencies` | Architecture | Services with >5 direct dependencies |
| 6 | `missing-healthcheck` | Reliability | Services without a healthcheck |
| 7 | `no-restart-policy` | Reliability | Services without a restart policy |
| 8 | `orphan-service` | Hygiene | Services with no dependencies in either direction and no exposed ports |
| 9 | `no-resource-limits` | Reliability | Services without memory/CPU limits |
| 10 | `missing-api-spec` | Hygiene | HTTP services (non-database, has ports) without an OpenAPI spec |

Rules 1-9 work purely on Docker Compose / daemon data. No API specs needed. Rule 10 is a nudge toward better spec coverage.

**4.3 — Scorer**
- `calculateScore(findings)` → 0-100
- Starts at 100, deducts points per finding:
  - `error` → -10
  - `warning` → -5
  - `info` → -1
- Floor at 0
- Category breakdown: separate score per category

**4.4 — API routes**
- `GET /api/rules` — list available rules
- `GET /api/evaluate` — run all rules against current scan, return findings + score

**4.5 — Tests**
- Each rule tested with a scan result that should trigger it and one that shouldn't
- Scorer tested with various finding combinations

**Exit criteria:** After a scan, `GET /api/evaluate` returns findings and a score. Rules detect real issues in docker-compose configurations.

---

### Phase 5: Frontend — Graph Canvas
**Effort: 5-6 days**

**5.1 — Dependencies**
- Install `@xyflow/react` (React Flow v12), `zustand`, `@dagrejs/dagre`

**5.2 — Zustand store** (`src/store/graphStore.ts`)
- State: `nodes`, `edges`, `selectedEdge`, `scanResult`, `testResults`, `score`, `findings`, `scanMode`
- Actions: `scan(path?, mode)`, `selectEdge(id)`, `updateTestResult(edgeId, result)`, `evaluate()`

**5.3 — Landing screen** (`src/components/ProjectSelector.tsx`)
- Two scan modes:
  - **"Scan project folder"** — text input for path → `POST /api/scan { projectPath, mode: "compose" }`
  - **"Scan running containers"** — single button → `POST /api/scan { mode: "daemon" }`
- On success: fetch graph, fetch evaluation, switch to canvas
- On error: display error details with guidance

**5.4 — Service node** (`src/components/ServiceNode.tsx`)
- Dark-themed box
- Service name (bold)
- Port badge (e.g. `:8080`) — or "no ports" muted text
- Service type icon (different icon for datastore / cache / message-broker / service)
- OpenAPI indicator: green dot if spec found, absent if not (not gray — don't draw attention to absence)
- Finding badge: orange/red dot with count if rules flagged this service

**5.5 — Edge component** (`src/components/ContractEdge.tsx`)
- Directional arrow (consumer → provider)
- Visual style by edge type:
  - `api` edge: solid line, shows testable actions
  - `dependency` edge: solid line, lighter color
  - `datastore` edge: dashed line (to visually distinguish data dependencies)
- Color by test status:
  - Gray: untested
  - Green: verified / healthy
  - Red: failed / unreachable
  - Yellow: spec mismatch
- Clickable → sets `selectedEdge` in store
- Hover tooltip: edge type, test status, last result summary

**5.6 — Canvas** (`src/components/Canvas.tsx`)
- React Flow wrapper
- Pan, zoom, fit-to-screen
- Minimap (bottom-right)
- Score badge (top-left): overall score with color (green >80, yellow >50, red ≤50)

**5.7 — Auto-layout**
- Dagre layout on initial load (top-down, grouped by service type)
- "Re-layout" button
- Nodes draggable after layout

**5.8 — Dark-mode theming**
- `dark` class on root HTML
- Dark background, dark nodes, dark panel
- React Flow controls styled to match

**Exit criteria:** Loading a project (via compose or daemon scan) renders a dark-mode graph with all services as nodes, all dependencies as edges, and a score badge. Nodes show type icons and finding badges. Edges are visually differentiated by type.

---

### Phase 6: Frontend — Inspection Panel + Testing
**Effort: 5-6 days**

This phase combines the original Phases 4 and 5 (inspection panel + contract test runner) because they're tested together.

**6.1 — Inspection panel layout** (`src/components/InspectionPanel.tsx`)
- Right-side slide-in, ~420px, dark-themed, scrollable
- Opens when an edge is selected, closes on Escape or deselect
- Content varies by edge type

**6.2 — Panel for `api` edges (has OpenAPI spec)**
- Header: consumer → provider (names + ports)
- Base URL display
- Endpoint list:
  - Each row: HTTP method badge (color-coded), route path, expected response codes
  - Expandable: response schema summary (formatted JSON)
  - "Run Test" button per endpoint
  - "Test All" button at top
- Inline results: pass/fail badge, status code, response time, validation errors

**6.3 — Panel for `dependency` / `datastore` edges (no spec)**
- Header: consumer → provider
- Connection info (port, protocol)
- "Check Connection" button → health probe (TCP connect or HTTP HEAD)
- Result: reachable / unreachable, response time
- If it's a datastore: show a note like "PostgreSQL on port 5432 — connection check only"
- Suggestion: "Add an OpenAPI spec to enable full contract testing" (with doc link)

**6.4 — Contract test runner** (`src/runner/contractRunner.ts`)
- Install `playwright` (library API) and `ajv` + `ajv-formats`
- `generateAndRunTest(endpoint, baseURL)`:
  - Create Playwright `APIRequestContext`
  - Build request from endpoint definition (method, path)
  - GET: send as-is. POST/PUT/PATCH: empty body for MVP
  - Return `TestResult`: `{ pass, statusCode, expectedCodes, responseTimeMs, responseBody, validationErrors }`
- Status validation: response status ∈ expected codes from spec
- Schema validation with Ajv: extract JSON Schema, validate body
  - Code match + body mismatch → `mismatch` (yellow)

**6.5 — Health probe** (`src/runner/healthProbe.ts`)
- `probeService(host, port, protocol?)`:
  - Attempt TCP connection (net.createConnection)
  - If port looks HTTP (80, 443, 8080, 3000, etc.), also try HTTP GET /
  - Return `{ reachable: boolean, responseTimeMs: number, error?: string }`
- Used for both pre-flight checks and "Check Connection" button

**6.6 — Test execution route** (`POST /api/test/run`)
- Full implementation:
  - Accepts `{ edgeId, endpointMethod?, endpointPath? }`
  - If endpoint specified → full contract test (API edges only)
  - If no endpoint → health probe (works for all edge types)
  - Pre-flight health check before contract test
  - Updates in-memory graph state
  - Returns `TestResult`

**6.7 — WebSocket streaming** (`/ws/test`)
- `test:started`, `test:running`, `test:completed` events
- Frontend connects on mount, updates Zustand store on events
- Edge color updates live on the canvas

**6.8 — Panel ↔ Graph sync**
- After test completes: update edge status + color in store
- Hover tooltip updates with latest result
- Score re-evaluates (if test results affect score — future consideration)

**6.9 — Tests**
- Contract runner: integration tests against a mock HTTP server
- Health probe: test against localhost (known reachable) and non-existent host (unreachable)
- API route: test with mock graph state

**Exit criteria:** Clicking an API edge opens a panel with endpoints, tests can be run, results appear inline, edge color updates. Clicking a non-API edge shows connection info and a probe button. WebSocket streams results live.

---

### Phase 7: Error Handling & Hardening
**Effort: 2-3 days**

- Missing docker-compose.yml → clear empty state: "No docker-compose.yml found. Try scanning running containers instead."
- Docker socket not mounted → clear error: "Cannot connect to Docker daemon. Mount the socket with -v /var/run/docker.sock:/var/run/docker.sock"
- Malformed YAML → error with line number
- Invalid OpenAPI → warning badge on node, details in panel
- Container unreachable → red banner in panel, retry button
- Large specs (100+ endpoints) → virtualized list + search/filter
- No running containers → empty state with guidance
- Graph with 30+ nodes → verify performance, add pagination or clustering if needed

**Exit criteria:** All real-world error paths produce helpful, actionable messages. No unhandled exceptions.

---

### Phase 8: Polish & Ship
**Effort: 3-4 days**

**8.1 — UI polish**
- Edge color transitions (CSS transition on stroke)
- Loading skeletons during scan
- Toast notifications (success/error)
- Keyboard shortcuts: `Escape` close panel, `F` fit-to-screen, `R` re-layout
- Score card animation on load
- Findings panel: expandable from score badge (filterable by severity/category)

**8.2 — Docker image**
- Finalize multi-stage Dockerfile
- Chromium-only Playwright install
- Prune caches
- Verify < 500 MB
- Test on macOS, Windows, Linux Docker Desktop

**8.3 — Smoke test**
- E2E: start ArchiTest container → scan sample project → verify graph → run test → green edge
- E2E: start ArchiTest with Docker socket → scan running containers → verify discovery

**8.4 — Documentation**
- README: quick start (two modes: compose scan + daemon scan)
- Volume mount examples for all platforms
- Screenshots/GIFs
- FAQ and troubleshooting
- CONTRIBUTING.md

**8.5 — CI (GitHub Actions)**
- Lint + format check
- Unit tests (Vitest)
- Docker build
- Image size assertion

**Exit criteria:** Ship-ready. `docker run` works in both modes. Documentation is complete. Image is optimized.

---

## Timeline

| Phase | What | Days | Cumulative |
|-------|------|------|------------|
| 1 | Verify & refactor foundation | 2-3 | 2-3 |
| 2 | Docker daemon adapter | 2-3 | 4-6 |
| 3 | Graph builder | 2-3 | 6-9 |
| 4 | Architecture guardrails | 3-4 | 9-13 |
| 5 | Frontend — graph canvas | 5-6 | 14-19 |
| 6 | Inspection panel + test runner | 5-6 | 19-25 |
| 7 | Error handling | 2-3 | 21-28 |
| 8 | Polish & ship | 3-4 | **24-32** |

**Total: ~5-7 weeks solo.** Phases 4 and 5 can be parallelized with two developers (backend rules + frontend canvas are independent).

---

## What the MVP Demo Looks Like

### Demo 1: Zero-config (Docker socket)
```bash
# User has some containers running (any Docker setup)
docker run -v /var/run/docker.sock:/var/run/docker.sock -p 3000:3000 architest/core
# Opens localhost:3000
# Clicks "Scan running containers"
# → Graph appears with all running containers as nodes
# → Edges inferred from shared networks
# → Score badge shows 72/100
# → Clicks score → sees findings: "postgres exposes port 5432 to host"
# → Clicks an edge → "Check Connection" → green: reachable
```

### Demo 2: Full contract testing (Docker Compose + OpenAPI)
```bash
# User has a Docker Compose project with OpenAPI specs
docker run -v $(pwd):/project -p 3000:3000 architest/core
# Opens localhost:3000
# Enters "/project" as project path
# → Graph appears with services, edges, spec indicators
# → Score badge shows 85/100
# → API edges show full endpoint lists
# → Clicks "Run Test" on GET /users → green arrow → contract verified
# → Non-API edges still show connection checks
```

### Demo 3: Architecture review (no specs, no running containers)
```bash
# User just wants to analyze their docker-compose.yml
docker run -v $(pwd):/project -p 3000:3000 architest/core
# Scans project folder
# → Graph shows service topology
# → Score reveals: circular dependency, public database, no healthchecks
# → Actionable findings with remediation steps
# Value delivered without a single API spec or running container
```

Demo 3 is the key unlock. The original ArchiTest delivers zero value in that scenario. The new ArchiTest delivers architecture insights from just a docker-compose.yml. That's the TAM expansion in action.

---

## Dependency Graph

```
Phase 1 (Verify + Refactor Types)
  │
  ├──► Phase 2 (Docker Daemon Adapter)
  │       │
  │       └──► Phase 3 (Graph Builder)
  │               │
  │               ├──► Phase 4 (Guardrails) ──────────┐
  │               │                                    │
  │               └──► Phase 5 (Frontend Canvas) ◄─────┘
  │                       │
  │                       └──► Phase 6 (Panel + Testing)
  │                               │
  │                               ▼
  │                       Phase 7 (Error Handling)
  │                               │
  └───────────────────────────────▼
                          Phase 8 (Polish & Ship)
```

Phase 4 (guardrails) and Phase 5 (frontend canvas) can be done in parallel once Phase 3 is complete. Phase 6 depends on both.
