# ArchiTest — Implementation Plan

A step-by-step build plan for the ArchiTest MVP, organized into phases. Each phase produces a working, testable increment. Estimated effort assumes a single developer working full-time.

---

## Phase 0: Project Scaffolding
**Goal:** Repo structure, tooling, and dev workflow — nothing functional yet.  
**Estimated effort:** 1–2 days

### Step 0.1 — Initialize the monorepo

1. Create root `package.json` with npm workspaces pointing to `packages/frontend` and `packages/backend`.
2. Create `packages/frontend/package.json` and `packages/backend/package.json` with placeholder scripts.
3. Run `npm install` from root to verify workspace resolution.

### Step 0.2 — Configure TypeScript

1. Create `tsconfig.base.json` at root with shared compiler options:
   - `target: ES2022`, `module: Node16`, `strict: true`, `skipLibCheck: true`.
2. Create `packages/backend/tsconfig.json` extending the base, with `outDir: dist`, `rootDir: src`.
3. Create `packages/frontend/tsconfig.json` extending the base, adjusted for Vite/React (`jsx: react-jsx`, `moduleResolution: bundler`).

### Step 0.3 — Configure linting and formatting

1. Install ESLint 9 and Prettier as root dev dependencies.
2. Create `eslint.config.js` (flat config) with TypeScript and React rules.
3. Create `.prettierrc` with project defaults (single quotes, 2-space indent, trailing commas).
4. Add root scripts: `lint`, `format`, `format:check`.

### Step 0.4 — Scaffold the frontend

1. `npm create vite@latest` inside `packages/frontend` with the React + TypeScript template (or manually create `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`).
2. Install Tailwind CSS 4 and configure it (`tailwind.config.ts`, `@tailwind` directives in `index.css`).
3. Verify `npm run dev` serves a blank dark-mode page on `localhost:5173`.

### Step 0.5 — Scaffold the backend

1. Install `fastify`, `@fastify/static`, `@fastify/websocket`, `@fastify/cors` in `packages/backend`.
2. Create `src/server.ts`: a Fastify instance listening on port 3000 with a health check route (`GET /api/health → 200`).
3. Add a `dev` script using `tsx watch src/server.ts` for auto-reload.
4. Verify `curl localhost:3000/api/health` returns `{ "status": "ok" }`.

### Step 0.6 — Docker dev setup

1. Create `Dockerfile` (multi-stage, as specified in the tech requirements).
2. Create `docker-compose.dev.yml` for local development with:
   - Volume mounts for live code reload.
   - Port mapping `3000:3000`.
3. Verify `docker compose -f docker-compose.dev.yml up` starts the app and serves the health endpoint.

### Step 0.7 — Testing infrastructure

1. Install Vitest as a root dev dependency.
2. Add `vitest.config.ts` to both `packages/frontend` and `packages/backend`.
3. Write one trivial test per package to confirm the test runner works.
4. Add root script: `npm test` runs both packages.

**Phase 0 exit criteria:** `npm run dev` starts both frontend and backend with hot reload. `npm test` passes. `docker compose up` builds and runs. Linting and formatting pass on empty project.

---

## Phase 1: Parser Engine
**Goal:** Given a project path, produce a structured JSON representation of services, dependencies, and OpenAPI specs.  
**Estimated effort:** 3–4 days

### Step 1.1 — Docker Compose parser

1. Install `js-yaml` in `packages/backend`.
2. Create `src/parsers/dockerCompose.ts`.
3. Implement `parseDockerCompose(filePath: string)` that:
   - Reads `docker-compose.yml` or `docker-compose.yaml`.
   - Extracts each service's `name`, `ports` (host:container mapping), `depends_on` list, and `build`/`image` field.
   - Returns a typed `DockerComposeResult` object.
4. Handle error cases: file not found, invalid YAML syntax, missing `services` key.
5. Write unit tests with fixture YAML files covering:
   - Simple 2-service compose.
   - Compose with `depends_on` (short and long syntax).
   - Compose with no ports exposed.
   - Malformed YAML.

### Step 1.2 — OpenAPI spec discovery

1. Create `src/parsers/openapi.ts`.
2. Implement `discoverOpenAPISpecs(projectPath: string)` that:
   - Searches conventional paths: `openapi.json`, `openapi.yml`, `openapi.yaml`, `swagger.json`, `swagger.yaml`, `docs/openapi.*`, `api/openapi.*`.
   - Returns a list of discovered spec file paths.
3. Write unit tests using a temp directory with various file layouts.

### Step 1.3 — OpenAPI spec parser

1. Install `@readme/openapi-parser` in `packages/backend`.
2. Implement `parseOpenAPISpec(filePath: string)` that:
   - Reads and dereferences the spec (resolves `$ref`).
   - Extracts: spec title, version, base URL (from `servers`), and a list of endpoints (method, path, response codes, response schemas).
   - Returns a typed `OpenAPIResult` object.
3. Handle error cases: invalid JSON/YAML, non-OpenAPI file, unsupported spec version.
4. Write unit tests with fixture OpenAPI 3.0 and 3.1 files.

### Step 1.4 — Spec-to-service association

1. Implement logic to associate discovered OpenAPI specs with Docker Compose services.
2. Strategy: match by directory co-location (spec lives inside a service's build context) or by port (spec's `servers[0].url` port matches a service's exposed port).
3. Return an enriched service list where each service optionally carries its parsed OpenAPI data.
4. Write unit tests for matching and non-matching scenarios.

### Step 1.5 — Scan API route

1. Create `src/routes/scan.ts`.
2. Implement `POST /api/scan` that:
   - Accepts `{ projectPath: string }`.
   - Calls the Docker Compose parser, OpenAPI discovery, OpenAPI parser, and association logic.
   - Returns the full structured result (services + specs + associations).
   - Returns error details with file paths and line numbers on failure.
3. Write integration tests using fixture project directories.

**Phase 1 exit criteria:** `POST /api/scan` with a path to a sample Docker Compose + OpenAPI project returns a complete, structured JSON response. All parser unit tests pass. Error cases return helpful messages.

---

## Phase 2: Graph Builder
**Goal:** Transform parser output into a graph data structure (nodes + edges) suitable for the frontend.  
**Estimated effort:** 2 days

### Step 2.1 — Graph data model

1. Define TypeScript types in a shared location (or `packages/backend/src/graph/types.ts`):
   - `GraphNode`: `{ id, label, port, hasOpenAPI, position }`.
   - `GraphEdge`: `{ id, source, target, status, endpoints, lastResult }`.
   - `Graph`: `{ nodes: GraphNode[], edges: GraphEdge[] }`.
2. Edge `status` is an enum: `untested | verified | failed | mismatch`.

### Step 2.2 — Graph builder

1. Create `src/graph/builder.ts`.
2. Implement `buildGraph(scanResult)` that:
   - Creates one `GraphNode` per Docker service.
   - Creates one `GraphEdge` for each `depends_on` relationship where the target has an OpenAPI spec.
   - Assigns initial auto-layout positions (simple grid or layered layout).
3. Write unit tests verifying correct node/edge generation from various scan results.

### Step 2.3 — Graph API route

1. Create `src/routes/graph.ts`.
2. Implement `GET /api/graph` — returns the current graph as JSON.
3. Implement `GET /api/graph/edge/:id` — returns the detailed endpoint list for one edge.
4. Graph state is held in memory (single-user, local-first — no database needed for MVP).

**Phase 2 exit criteria:** After a scan, `GET /api/graph` returns well-typed nodes and edges. Edge detail route returns endpoint info from the associated OpenAPI spec.

---

## Phase 3: Frontend — Graph Canvas
**Goal:** Render the architecture map in the browser. No test execution yet.  
**Estimated effort:** 4–5 days

### Step 3.1 — React Flow setup

1. Install `@xyflow/react` (React Flow v12) and `zustand` in `packages/frontend`.
2. Create `src/store/graphStore.ts` — Zustand store holding:
   - `nodes`, `edges`, `selectedEdge`, `inspectionPanelOpen`, `testResults`.
3. Create `src/components/Canvas.tsx` — renders `<ReactFlow>` with nodes and edges from the store.
4. Verify an empty canvas renders with pan/zoom controls.

### Step 3.2 — Project folder selection

1. Create `src/components/ProjectSelector.tsx` — a landing screen shown when no project is loaded.
2. User enters or selects a project path (text input for MVP; the path is the container-internal mount path).
3. On submit, call `POST /api/scan` then `GET /api/graph`.
4. On success, populate the Zustand store and switch to the canvas view.
5. On error, display the parse error with file/line details.

### Step 3.3 — Custom service node

1. Create `src/components/ServiceNode.tsx`.
2. Renders a dark-themed box showing:
   - Service name (bold).
   - Port badge (e.g. `:8080`).
   - OpenAPI indicator (green dot if spec available, gray if not).
3. Register as a custom node type in React Flow.

### Step 3.4 — Custom contract edge

1. Create `src/components/ContractEdge.tsx`.
2. Renders a directional arrow with color based on `edge.data.status`:
   - Gray (untested), Green (verified), Red (failed), Yellow (mismatch).
3. Edge is clickable — sets `selectedEdge` in the store and opens the inspection panel.
4. Add hover tooltip showing last run summary (or "Not tested").

### Step 3.5 — Auto-layout

1. Implement a simple layout algorithm (e.g. Dagre via `@dagrejs/dagre`) to position nodes in a top-down or left-right hierarchy based on dependency direction.
2. Apply layout on initial load and provide a "Re-layout" button.
3. Nodes remain draggable after auto-layout.

### Step 3.6 — Dark-mode theming

1. Configure Tailwind for `darkMode: 'class'` (or media).
2. Set the root `<html>` element to dark mode by default.
3. Style all components (canvas background, nodes, panel, tooltips) in dark theme.
4. Ensure React Flow's built-in controls (minimap, zoom buttons) match the theme.

**Phase 3 exit criteria:** Loading a project renders a dark-mode graph with correctly labeled nodes and colored edges. Nodes are draggable. Canvas supports pan/zoom. Clicking an edge highlights it.

---

## Phase 4: Frontend — Inspection Panel
**Goal:** Show edge details and allow the user to trigger a contract test.  
**Estimated effort:** 2–3 days

### Step 4.1 — Panel layout

1. Create `src/components/InspectionPanel.tsx`.
2. Slides in from the right when an edge is selected; slides out on close or deselect.
3. Panel is ~400px wide, dark-themed, scrollable.

### Step 4.2 — Edge detail display

1. When an edge is selected, fetch `GET /api/graph/edge/:id`.
2. Display in the panel:
   - **Provider service name** and **base URL**.
   - **Endpoint list** — each row shows: HTTP method badge (color-coded GET/POST/PUT/DELETE), route path, expected response codes.
3. Clicking an endpoint row expands it to show the response schema summary (formatted JSON Schema or a simplified tree view).

### Step 4.3 — Test trigger button

1. Each endpoint row has a "Run Test" button.
2. Clicking it calls `POST /api/test/run` with the edge ID and endpoint details.
3. Button shows a loading spinner while the test executes.
4. On completion, display inline result: status badge (pass/fail), status code, response time.

### Step 4.4 — Panel ↔ Graph sync

1. After a test completes, update the edge's `status` and `lastResult` in the Zustand store.
2. The `ContractEdge` component re-renders with the new color.
3. Hover tooltip updates with the latest result data.

**Phase 4 exit criteria:** Clicking an edge opens a panel with real endpoint data. A test can be triggered from the panel. Results appear inline and the edge color updates on the canvas.

---

## Phase 5: Contract Test Runner
**Goal:** Generate and execute Playwright API tests from OpenAPI endpoint definitions.  
**Estimated effort:** 4–5 days

### Step 5.1 — Playwright setup

1. Install `playwright` (not `@playwright/test` — we use the library API directly for programmatic test execution).
2. Verify Playwright API request context works inside the Docker container (no browser needed).

### Step 5.2 — Contract test generator

1. Create `src/runner/contractRunner.ts`.
2. Implement `generateAndRunTest(endpoint, baseURL)` that:
   - Creates a Playwright `APIRequestContext` targeting the base URL.
   - Builds an HTTP request from the endpoint definition (method, path).
   - For GET endpoints: sends the request as-is.
   - For POST/PUT/PATCH: generates a minimal valid request body from the OpenAPI request schema (optional — MVP can skip request body generation and test only GET endpoints, or send an empty body).
3. Returns a structured `TestResult`: `{ pass, statusCode, expectedCodes, responseTimeMs, responseBody, validationErrors }`.

### Step 5.3 — Response status validation

1. After the request completes, check if the response status code is in the set of expected codes from the OpenAPI spec.
2. If not, mark the test as `failed` with a clear reason: `"Expected one of [200, 201], got 500"`.

### Step 5.4 — Response schema validation

1. Install `ajv` and `ajv-formats` in `packages/backend`.
2. Extract the JSON Schema for the response from the parsed OpenAPI data (for the matching status code).
3. Compile the schema with Ajv and validate the response body.
4. If validation fails, include the Ajv error details in `TestResult.validationErrors`.
5. If the status code matched but the body didn't, set status to `mismatch` (yellow).

### Step 5.5 — Pre-flight health check

1. Before running a contract test, attempt a TCP connection (or HTTP HEAD) to the target service.
2. If unreachable, return immediately with a clear error: `"Service 'user-api' is not reachable at http://localhost:8080. Is the container running?"`.
3. This avoids confusing Playwright timeout errors.

### Step 5.6 — Test execution route

1. Create `src/routes/test.ts`.
2. Implement `POST /api/test/run`:
   - Accepts `{ edgeId: string, endpointMethod: string, endpointPath: string }`.
   - Looks up the edge and endpoint from the in-memory graph.
   - Runs the pre-flight check.
   - Calls `generateAndRunTest`.
   - Updates the edge state in the in-memory graph.
   - Returns the `TestResult`.
3. Write integration tests using a mock HTTP server as a stand-in for a Docker service.

### Step 5.7 — WebSocket result streaming

1. Create `src/ws/testStream.ts`.
2. Implement WebSocket handler at `/ws/test` that:
   - Accepts a connection from the frontend.
   - Emits events: `test:started`, `test:running`, `test:completed`.
   - The frontend subscribes on mount and updates the store on each event.
3. Wire the test execution route to emit events through the WebSocket.
4. Update the frontend to connect to `/ws/test` and handle incoming messages.

**Phase 5 exit criteria:** Triggering a test from the UI executes a real HTTP request against a running container, validates status + schema, and streams the result back. Edge color updates live.

---

## Phase 6: Error Handling & Edge Cases
**Goal:** Harden the application for real-world project structures.  
**Estimated effort:** 2–3 days

### Step 6.1 — Parse error UX

1. If `docker-compose.yml` is missing, show a clear empty state: "No docker-compose.yml found in the selected folder."
2. If YAML is malformed, show the parse error with line number.
3. If OpenAPI specs are found but invalid, mark affected services with a warning badge on the node. Display details in a toast or the inspection panel.

### Step 6.2 — Container connectivity errors

1. If a test target is unreachable, display a red banner in the inspection panel with actionable guidance.
2. Add a "Retry" button that re-runs the health check.

### Step 6.3 — Large spec handling

1. For OpenAPI specs with 100+ endpoints, virtualize the endpoint list in the inspection panel (e.g. `react-window` or `@tanstack/react-virtual`).
2. Add a search/filter input at the top of the endpoint list.

### Step 6.4 — Compose format variations

1. Support both `depends_on` short syntax (`depends_on: [db]`) and long syntax (`depends_on: { db: { condition: service_healthy } }`).
2. Support Compose v2 and v3 format differences.
3. Handle `profiles`, `extends`, and other modifiers gracefully (ignore unsupported fields with a warning, not a crash).

### Step 6.5 — Filesystem permission handling

1. Detect and surface volume mount permission errors clearly.
2. If the project path doesn't exist inside the container, explain the `-v` mount requirement.

**Phase 6 exit criteria:** The application handles all common real-world scenarios gracefully. No unhandled exceptions reach the user. Error messages are actionable.

---

## Phase 7: Polish & Production Readiness
**Goal:** Final UI polish, Docker image optimization, documentation.  
**Estimated effort:** 3–4 days

### Step 7.1 — UI polish

1. Add smooth transitions for edge color changes (CSS transitions on stroke color).
2. Add a minimap component (React Flow built-in).
3. Add keyboard shortcuts: `Escape` to close panel, `F` to fit-to-screen.
4. Add a loading skeleton while the scan/graph is processing.
5. Add a toast notification system for success/error messages.

### Step 7.2 — Docker image optimization

1. Finalize the multi-stage Dockerfile.
2. Install only Chromium (not all browsers) for Playwright.
3. Prune apt cache and npm cache in the final stage.
4. Verify image size is under 500 MB.
5. Test the image on macOS (Docker Desktop), Windows (Docker Desktop), and Linux.

### Step 7.3 — End-to-end smoke test

1. Create a sample project with a `docker-compose.yml` and two services (one with an OpenAPI spec).
2. Place it in a `test/fixtures/sample-project/` directory.
3. Write an E2E test that:
   - Starts the ArchiTest container.
   - Loads the sample project.
   - Verifies nodes and edges appear.
   - Runs a contract test.
   - Verifies edge turns green.
4. This can be a simple script or a Playwright browser test against the ArchiTest UI itself.

### Step 7.4 — Documentation

1. Finalize `README.md` with:
   - Quick start instructions.
   - Volume mount examples for macOS, Windows, Linux.
   - Screenshots/GIFs of the UI.
   - FAQ / troubleshooting section.
2. Add inline JSDoc/TSDoc comments to all public functions.
3. Add `CONTRIBUTING.md` with dev setup instructions.

### Step 7.5 — CI pipeline (optional, pre-Phase 2)

1. GitHub Actions workflow:
   - Lint + format check.
   - Unit tests (Vitest).
   - Docker build.
   - Image size assertion.
2. This is lightweight and doesn't conflict with the "no CI integration" MVP exclusion (that exclusion is about the *product feature*, not the project's own CI).

**Phase 7 exit criteria:** `docker run -p 3000:3000 architest/core` launches a polished, dark-mode application. User can scan a project, see the graph, inspect edges, run tests, and see live visual feedback. Image is under 500 MB. README is complete.

---

## Summary Timeline

| Phase | Description | Est. Days | Cumulative |
|-------|-------------|-----------|------------|
| 0 | Project Scaffolding | 1–2 | 1–2 |
| 1 | Parser Engine | 3–4 | 4–6 |
| 2 | Graph Builder | 2 | 6–8 |
| 3 | Frontend — Graph Canvas | 4–5 | 10–13 |
| 4 | Frontend — Inspection Panel | 2–3 | 12–16 |
| 5 | Contract Test Runner | 4–5 | 16–21 |
| 6 | Error Handling & Edge Cases | 2–3 | 18–24 |
| 7 | Polish & Production Readiness | 3–4 | 21–28 |

**Total estimated effort: 21–28 working days (~4–6 weeks solo).**

---

## Dependency Graph Between Phases

```
Phase 0 (Scaffolding)
  │
  ├──► Phase 1 (Parser Engine)
  │       │
  │       └──► Phase 2 (Graph Builder)
  │               │
  │               ├──► Phase 3 (Graph Canvas) ──► Phase 4 (Inspection Panel)
  │               │                                        │
  │               └──► Phase 5 (Contract Test Runner) ◄────┘
  │                       │
  │                       ▼
  │               Phase 6 (Error Handling)
  │                       │
  └───────────────────────▼
                  Phase 7 (Polish)
```

Phases 3 and 5 can be parallelized if two developers are available — the frontend graph canvas and the backend test runner are independent once Phase 2 is complete.
