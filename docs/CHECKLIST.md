# ArchiTest — Implementation Checklist

## Phase 0: Project Scaffolding

- [x] **Step 0.1 — Initialize the monorepo**
  - [x] Root `package.json` with npm workspaces (`packages/frontend`, `packages/backend`)
  - [x] `packages/frontend/package.json` with scripts
  - [x] `packages/backend/package.json` with scripts
  - [ ] Run `npm install` to verify workspace resolution

- [x] **Step 0.2 — Configure TypeScript**
  - [x] `tsconfig.base.json` (ES2022, Node16, strict)
  - [x] `packages/backend/tsconfig.json` (outDir, rootDir)
  - [x] `packages/frontend/tsconfig.json` (react-jsx, bundler)

- [x] **Step 0.3 — Configure linting and formatting**
  - [x] `eslint.config.js` (flat config, TypeScript + React rules)
  - [x] `.prettierrc` (single quotes, trailing commas, 2-space indent)
  - [x] `.prettierignore`
  - [ ] Install ESLint 9, Prettier, and plugins as root dev dependencies
  - [ ] Verify `npm run lint` and `npm run format:check` pass

- [x] **Step 0.4 — Scaffold the frontend**
  - [x] `vite.config.ts` (React plugin, proxy config for /api and /ws)
  - [x] `index.html` (dark-mode root)
  - [x] `src/main.tsx` (React entry)
  - [x] `src/App.tsx` (placeholder component)
  - [x] `src/index.css` (Tailwind import)
  - [ ] Install React, Vite, Tailwind CSS 4, and dependencies
  - [ ] Verify `npm run dev` serves a page on localhost:5173

- [x] **Step 0.5 — Scaffold the backend**
  - [x] `src/server.ts` (Fastify app with health route, static file serving, route registration)
  - [x] `src/routes/scan.ts` (POST /api/scan)
  - [x] `src/routes/graph.ts` (GET /api/graph — placeholder)
  - [x] `src/routes/test.ts` (POST /api/test/run — placeholder)
  - [ ] Install Fastify, @fastify/static, @fastify/websocket, @fastify/cors, tsx
  - [ ] Verify `npm run dev` starts on port 3000 and health check responds

- [x] **Step 0.6 — Docker dev setup**
  - [x] `Dockerfile` (multi-stage: build frontend, bundle with backend, Playwright Chromium)
  - [x] `docker-compose.dev.yml` (volume mounts, port 3000)
  - [ ] Verify `docker compose -f docker-compose.dev.yml up` works

- [x] **Step 0.7 — Testing infrastructure**
  - [x] `packages/backend/vitest.config.ts`
  - [x] `packages/frontend/vitest.config.ts`
  - [x] `packages/frontend/src/App.test.tsx` (placeholder test)
  - [ ] Install Vitest as root dev dependency
  - [ ] Verify `npm test` runs and passes

- [x] **Step 0.8 — Git setup**
  - [x] `.gitignore` (node_modules, dist, .vite, tsbuildinfo)

### Phase 0 — Remaining action
> All source files are written. Run `npm install` to install all dependencies, then verify dev server, tests, and Docker build.

---

## Phase 1: Parser Engine

- [x] **Step 1.1 — Docker Compose parser**
  - [x] `src/parsers/dockerCompose.ts` — `parseDockerCompose()`, `parseProjectCompose()`, `findComposeFile()`, `parsePort()`
  - [x] Handles: file not found, invalid YAML, missing `services` key
  - [x] Supports: short + long `depends_on` syntax, build string + object, port with protocol/IP binding
  - [x] `src/parsers/dockerCompose.test.ts` — 12 unit tests covering all variations
  - [ ] js-yaml dependency installed and tests passing

- [x] **Step 1.2 — OpenAPI spec discovery**
  - [x] `discoverOpenAPISpecs()` in `src/parsers/openapi.ts` — searches 18 conventional paths
  - [x] `discoverServiceSpecs()` — scoped search within a service's build context
  - [x] `src/parsers/openapi.test.ts` — discovery tests (root, docs/, api/, service context)
  - [ ] Tests passing

- [x] **Step 1.3 — OpenAPI spec parser**
  - [x] `parseOpenAPISpec()` in `src/parsers/openapi.ts`
  - [x] Handles OpenAPI 3.x (JSON + YAML) and Swagger 2.x
  - [x] Extracts: title, version, baseUrl, endpoints (method, path, operationId, summary, responses)
  - [x] Basic `$ref` resolution for `#/components/schemas/` and `#/definitions/`
  - [x] Error handling: file not found, invalid JSON/YAML, non-OpenAPI file
  - [x] `src/parsers/openapi.test.ts` — 8 parser tests (3.x YAML, 3.x JSON, Swagger 2.x, $ref resolution, multi-response, errors)
  - [ ] Tests passing

- [x] **Step 1.4 — Spec-to-service association**
  - [x] `src/parsers/associate.ts` — `associateSpecsToServices()`
  - [x] Two matching strategies: build context co-location (pass 1), port matching (pass 2)
  - [x] Each spec consumed at most once
  - [x] `src/parsers/associate.test.ts` — 6 unit tests (no specs, port match, no reuse, port mismatch, no ports, no baseUrl)
  - [ ] Tests passing

- [x] **Step 1.5 — Scan orchestration + API route**
  - [x] `src/parsers/scanProject.ts` — `scanProject()` orchestrates compose parse → spec discovery → spec parse → association
  - [x] `src/routes/scan.ts` — `POST /api/scan` route with validation and error handling
  - [x] Shared types in `src/types.ts` (DockerService, PortMapping, OpenAPIResult, OpenAPIEndpoint, EnrichedService, ScanResult)
  - [x] Test fixtures: sample project with docker-compose.yml + 2 OpenAPI specs (user-api YAML, order-api JSON)
  - [x] `src/parsers/scanProject.test.ts` — 6 integration tests (full scan, 4 services, depends_on, spec association, non-API exclusion, endpoints, error on missing compose)
  - [ ] Integration tests passing

### Phase 1 — Remaining action
> All parser code, types, and tests are written. Run `npm install` (to install js-yaml and other deps) and `npm test --workspace=packages/backend` to verify all 32+ tests pass.

---

## Phase 2: Graph Builder
> **Status: Not started**

- [ ] **Step 2.1 — Graph data model**
  - [ ] Define `GraphNode`, `GraphEdge`, `Graph` types
  - [ ] Edge status enum: `untested | verified | failed | mismatch`

- [ ] **Step 2.2 — Graph builder**
  - [ ] `src/graph/builder.ts` — `buildGraph(scanResult)` creates nodes + edges
  - [ ] Auto-layout positions (grid or layered)
  - [ ] Unit tests

- [ ] **Step 2.3 — Graph API routes**
  - [ ] `GET /api/graph` — returns full graph
  - [ ] `GET /api/graph/edge/:id` — returns edge detail with endpoints
  - [ ] In-memory graph state

---

## Phase 3: Frontend — Graph Canvas
> **Status: Not started**

- [ ] **Step 3.1 — React Flow setup**
  - [ ] Install `@xyflow/react`, `zustand`
  - [ ] Zustand store (`graphStore.ts`)
  - [ ] `Canvas.tsx` with `<ReactFlow>`

- [ ] **Step 3.2 — Project folder selection**
  - [ ] `ProjectSelector.tsx` landing screen
  - [ ] Calls `POST /api/scan` → `GET /api/graph`
  - [ ] Error display for parse failures

- [ ] **Step 3.3 — Custom service node**
  - [ ] `ServiceNode.tsx` (name, port badge, OpenAPI indicator)

- [ ] **Step 3.4 — Custom contract edge**
  - [ ] `ContractEdge.tsx` (color by status, clickable, hover tooltip)

- [ ] **Step 3.5 — Auto-layout**
  - [ ] Dagre-based layout (`@dagrejs/dagre`)
  - [ ] Re-layout button, draggable nodes

- [ ] **Step 3.6 — Dark-mode theming**
  - [ ] Tailwind dark mode by default
  - [ ] Canvas, node, edge, panel dark styles

---

## Phase 4: Frontend — Inspection Panel
> **Status: Not started**

- [ ] **Step 4.1 — Panel layout**
  - [ ] `InspectionPanel.tsx` (right-side slide-in, ~400px)

- [ ] **Step 4.2 — Edge detail display**
  - [ ] Provider name, base URL, endpoint list (method badge, route, response codes)
  - [ ] Expandable response schema summary

- [ ] **Step 4.3 — Test trigger button**
  - [ ] "Run Test" per endpoint → `POST /api/test/run`
  - [ ] Loading spinner, inline result (pass/fail, status code, response time)

- [ ] **Step 4.4 — Panel ↔ Graph sync**
  - [ ] Update edge status + color after test completes
  - [ ] Hover tooltip updates with latest result

---

## Phase 5: Contract Test Runner
> **Status: Not started**

- [ ] **Step 5.1 — Playwright setup**
  - [ ] Install `playwright` (library API, not test runner)
  - [ ] Verify `APIRequestContext` works in Docker

- [ ] **Step 5.2 — Contract test generator**
  - [ ] `src/runner/contractRunner.ts` — `generateAndRunTest()`
  - [ ] Playwright `APIRequestContext` for HTTP calls
  - [ ] Structured `TestResult` return type

- [ ] **Step 5.3 — Response status validation**
  - [ ] Status code ∈ expected codes from spec

- [ ] **Step 5.4 — Response schema validation**
  - [ ] Ajv for JSON Schema validation of response body
  - [ ] `mismatch` status when body fails but code passes

- [ ] **Step 5.5 — Pre-flight health check**
  - [ ] TCP/HTTP check before test run
  - [ ] Clear error if service unreachable

- [ ] **Step 5.6 — Test execution route**
  - [ ] `POST /api/test/run` — full implementation
  - [ ] Updates in-memory graph state
  - [ ] Integration tests with mock HTTP server

- [ ] **Step 5.7 — WebSocket result streaming**
  - [ ] `src/ws/testStream.ts` WebSocket handler
  - [ ] Events: `test:started`, `test:running`, `test:completed`
  - [ ] Frontend subscribes and updates store

---

## Phase 6: Error Handling & Edge Cases
> **Status: Not started**

- [ ] **Step 6.1 — Parse error UX**
  - [ ] Missing compose → empty state message
  - [ ] Malformed YAML → error with line number
  - [ ] Invalid OpenAPI → warning badge on node

- [ ] **Step 6.2 — Container connectivity errors**
  - [ ] Red banner in panel, actionable guidance, retry button

- [ ] **Step 6.3 — Large spec handling**
  - [ ] Virtualized endpoint list (react-virtual)
  - [ ] Search/filter input

- [ ] **Step 6.4 — Compose format variations**
  - [ ] `depends_on` short + long syntax (already handled)
  - [ ] Compose v2 + v3 differences
  - [ ] Graceful handling of `profiles`, `extends`

- [ ] **Step 6.5 — Filesystem permission handling**
  - [ ] Detect + surface volume mount errors
  - [ ] Missing path → explain `-v` requirement

---

## Phase 7: Polish & Production Readiness
> **Status: Not started**

- [ ] **Step 7.1 — UI polish**
  - [ ] Smooth edge color transitions
  - [ ] React Flow minimap
  - [ ] Keyboard shortcuts (Esc, F)
  - [ ] Loading skeleton
  - [ ] Toast notifications

- [ ] **Step 7.2 — Docker image optimization**
  - [ ] Finalize multi-stage Dockerfile
  - [ ] Chromium-only Playwright install
  - [ ] Prune caches, verify < 500 MB

- [ ] **Step 7.3 — End-to-end smoke test**
  - [ ] Sample project fixture
  - [ ] E2E test (start container → scan → verify graph → run test → green edge)

- [ ] **Step 7.4 — Documentation**
  - [ ] README with quick start, volume mount examples, troubleshooting
  - [ ] JSDoc/TSDoc on public functions
  - [ ] CONTRIBUTING.md

- [ ] **Step 7.5 — CI pipeline (optional)**
  - [ ] GitHub Actions: lint, test, Docker build, image size check

---

## Progress Summary

| Phase | Description                  | Status         |
|-------|------------------------------|----------------|
| 0     | Project Scaffolding          | Code written, needs `npm install` verification |
| 1     | Parser Engine                | Code written, needs `npm install` + test verification |
| 2     | Graph Builder                | Not started    |
| 3     | Frontend — Graph Canvas      | Not started    |
| 4     | Frontend — Inspection Panel  | Not started    |
| 5     | Contract Test Runner         | Not started    |
| 6     | Error Handling & Edge Cases  | Not started    |
| 7     | Polish & Production Readiness| Not started    |

### Next step
Run `npm install` at the repo root, then `npm test` to confirm all Phase 0 + Phase 1 code compiles and passes.
