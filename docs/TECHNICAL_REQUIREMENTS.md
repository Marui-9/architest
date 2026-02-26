# ArchiTest — Technical Requirements Document

## 1. Product Summary

ArchiTest is a local-first visual contract testing tool distributed as a single Docker image. It parses a user's Docker Compose and OpenAPI files, renders an interactive architecture graph, and executes contract tests against live containers — all from `localhost:3000`.

---

## 2. System Architecture Overview

```
┌─────────────────────────────────────────────────┐
│              Docker Container                    │
│                                                  │
│  ┌──────────┐   WebSocket/REST   ┌───────────┐  │
│  │ Frontend  │ ◄───────────────► │  Backend   │  │
│  │ (SPA)     │                   │  (API)     │  │
│  └──────────┘                    └─────┬──────┘  │
│                                        │         │
│                          ┌─────────────┼──────┐  │
│                          │             │      │  │
│                     ┌────▼───┐   ┌─────▼──┐   │  │
│                     │ Parser │   │ Runner │   │  │
│                     │ Engine │   │ Engine │   │  │
│                     └────────┘   └────────┘   │  │
│                                               │  │
│  Volume mount: user project dir ──────────────┘  │
└─────────────────────────────────────────────────┘
```

**Frontend** — SPA serving the graph canvas and inspection panel.  
**Backend** — API server handling parsing, graph construction, test execution, and result streaming.  
**Parser Engine** — Deterministic readers for `docker-compose.yml` and OpenAPI specs.  
**Runner Engine** — Generates and executes Playwright API tests, returns structured results.

---

## 3. Functional Requirements

### FR-1: Boot & Delivery

| ID    | Requirement |
|-------|-------------|
| FR-1.1 | Application is packaged as a single Docker image (`architest/core`). |
| FR-1.2 | Runs via `docker run -p 3000:3000 architest/core`. |
| FR-1.3 | Web UI is served on port 3000 and accessible at `http://localhost:3000`. |
| FR-1.4 | No external network dependencies at runtime. Fully local-first. |

### FR-2: Repository Connection

| ID    | Requirement |
|-------|-------------|
| FR-2.1 | User selects a local project folder via the UI. The folder is bind-mounted or pre-mounted into the container. |
| FR-2.2 | System scans the folder for `docker-compose.yml` (or `docker-compose.yaml`). |
| FR-2.3 | System scans for OpenAPI spec files (JSON/YAML) at default conventional paths (e.g. `docs/openapi.yml`, `openapi.json`, `swagger.json`). Paths configurable in later phases. |
| FR-2.4 | Parsing is fully deterministic — no AI, no heuristics, no LLM inference. |
| FR-2.5 | Parsing errors are surfaced to the user with file path and line number. |

### FR-3: Architecture Map Generation

| ID    | Requirement |
|-------|-------------|
| FR-3.1 | Each service in `docker-compose.yml` becomes a **node** on the graph. |
| FR-3.2 | Each node displays: service name, exposed port(s), and an OpenAPI availability indicator (icon/badge). |
| FR-3.3 | An **edge** is created when service A `depends_on` service B **and** service B exposes an OpenAPI spec. |
| FR-3.4 | Edges are directional: consumer → provider. |
| FR-3.5 | Graph layout is automatic. Nodes are draggable. |
| FR-3.6 | Canvas supports pan, zoom, and fit-to-screen. |

### FR-4: Edge Inspection Panel

| ID    | Requirement |
|-------|-------------|
| FR-4.1 | Clicking an edge opens a right-side detail panel. |
| FR-4.2 | Panel displays: detected base URL of the provider service. |
| FR-4.3 | Panel lists all endpoints from the provider's OpenAPI spec, showing HTTP method and route. |
| FR-4.4 | Each listed endpoint shows expected response codes and a response schema summary. |
| FR-4.5 | User can select a single endpoint to generate and run a contract test. |

### FR-5: Contract Test Generation & Execution

| ID    | Requirement |
|-------|-------------|
| FR-5.1 | Tests are generated internally using Playwright's API testing mode. |
| FR-5.2 | A generated test sends an HTTP request to the target service container. |
| FR-5.3 | Test validates that the response status code matches one of the codes defined in the OpenAPI spec. |
| FR-5.4 | Test validates that the response body conforms to the OpenAPI response schema. |
| FR-5.5 | Tests do **not** assert business logic, validate database state, or require authentication flows. |
| FR-5.6 | Test execution is triggered on-demand (user click), not automatic. |
| FR-5.7 | Test results (pass/fail, status code, response time, failure reason) are returned to the UI. |

### FR-6: Visual Feedback

| ID    | Requirement |
|-------|-------------|
| FR-6.1 | Edge color reflects test state: **Gray** (not tested), **Green** (verified), **Red** (failed), **Yellow** (spec mismatch). |
| FR-6.2 | Hovering an edge shows a tooltip with: last run timestamp, response time, status code, failure reason (if any). |
| FR-6.3 | State updates are reflected immediately after test execution completes. |

---

## 4. Non-Functional Requirements

| ID     | Category      | Requirement |
|--------|---------------|-------------|
| NFR-1  | Performance   | Graph rendering should handle at least 30 services / 50 edges without UI jank (<16ms frame budget). |
| NFR-2  | Performance   | Docker Compose + OpenAPI parsing should complete within 3 seconds for typical projects. |
| NFR-3  | Performance   | Individual contract test execution should complete within 10 seconds (network-bound). |
| NFR-4  | Portability   | Runs on any system with Docker Desktop (macOS, Windows, Linux). |
| NFR-5  | Security      | No data leaves the user's machine. No telemetry, no analytics, no external calls. |
| NFR-6  | UX            | UI is dark-mode by default. |
| NFR-7  | Reliability   | Graceful error handling for: missing files, malformed YAML, unreachable containers, invalid OpenAPI specs. |
| NFR-8  | Image Size    | Docker image should stay under 500 MB. |

---

## 5. MVP Scope Exclusions

Explicitly out of scope for v1:

- No browser automation (Playwright browser mode)
- No test editing UI
- No multi-environment support
- No CI integration or JSON export
- No AI-generated tests
- No drift detection beyond basic spec mismatch
- No authentication flow handling

---

## 6. Proposed Tech Stack

### Frontend

| Layer | Technology | Purpose |
|-------|-----------|---------|
| UI Framework | **React 19** | Component model, ecosystem maturity, broad hiring pool. |
| Graph Visualization | **React Flow** | Purpose-built for node/edge graphs with pan, zoom, drag, and custom rendering. |
| Styling | **Tailwind CSS 4** | Utility-first CSS; fast dark-mode theming via `dark:` variants. |
| State Management | **Zustand** | Lightweight store for graph state, test results, and panel data. |
| HTTP Client | **Built-in Fetch API** | Calls to the backend API; no extra dependency needed. |
| Build Tool | **Vite** | Fast dev builds, optimized production bundles. |

**Documentation Links:**

- React: https://react.dev
- React Flow: https://reactflow.dev
- Tailwind CSS: https://tailwindcss.com/docs
- Zustand: https://docs.pmnd.rs/zustand/getting-started/introduction
- Vite: https://vite.dev/guide

### Backend

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | **Node.js 22 LTS** | JavaScript runtime; shares language with frontend; native Playwright support. |
| Framework | **Fastify** | High-performance HTTP server with schema validation and plugin architecture. |
| WebSocket | **Fastify WebSocket** (via `@fastify/websocket`) | Stream test execution progress and results to the UI in real time. |
| Docker Compose Parser | **js-yaml** | Parse `docker-compose.yml` / `docker-compose.yaml` into structured objects. |
| OpenAPI Parser | **@readme/openapi-parser** (fork of swagger-parser) | Dereference and validate OpenAPI 3.x specs. |
| Schema Validation | **Ajv** | Validate HTTP response bodies against JSON Schema (extracted from OpenAPI). |
| Test Runner | **Playwright** (`@playwright/test`) | API testing mode — `request` context for HTTP calls without a browser. |

**Documentation Links:**

- Node.js: https://nodejs.org/docs/latest-v22.x/api
- Fastify: https://fastify.dev/docs/latest
- @fastify/websocket: https://github.com/fastify/fastify-websocket
- js-yaml: https://github.com/nodeca/js-yaml
- @readme/openapi-parser: https://github.com/readmeio/openapi-parser
- Ajv: https://ajv.js.org
- Playwright: https://playwright.dev/docs/api-testing

### Infrastructure & Tooling

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Containerization | **Docker** | Single-image distribution; multi-stage build. |
| Base Image | **node:22-slim** | Minimal Node.js image for small footprint. |
| Monorepo Tool | **npm workspaces** | Manage `packages/frontend` and `packages/backend` in one repo without extra tooling. |
| TypeScript | **TypeScript 5.x** | Static typing across frontend and backend. |
| Linting | **ESLint 9** (flat config) | Code quality enforcement. |
| Formatting | **Prettier** | Consistent code style. |
| Testing (unit) | **Vitest** | Fast, Vite-native unit test runner for both frontend and backend code. |

**Documentation Links:**

- Docker: https://docs.docker.com
- npm workspaces: https://docs.npmjs.com/cli/using-npm/workspaces
- TypeScript: https://www.typescriptlang.org/docs
- ESLint: https://eslint.org/docs/latest
- Prettier: https://prettier.io/docs/en
- Vitest: https://vitest.dev/guide

---

## 7. Key Technical Decisions & Rationale

### Why Node.js over Go / Rust?

Playwright is a first-class Node.js library. Using Node.js avoids shelling out to a subprocess for test execution and keeps the entire stack in one language (TypeScript). The performance ceiling of Go/Rust is unnecessary — the bottleneck is network I/O to service containers, not CPU.

### Why React Flow over D3 / Cytoscape.js?

React Flow provides built-in node/edge rendering, pan/zoom, drag, minimap, and custom node components — all integrated into React's component model. D3 would require building these primitives from scratch. Cytoscape.js is powerful but optimized for large scientific graphs and is harder to style with modern CSS tooling.

### Why Fastify over Express?

Fastify is faster, has built-in JSON schema validation (useful for validating our own API responses), a robust plugin system, and first-class TypeScript support. Express is viable but offers less out of the box.

### Why Ajv for schema validation?

OpenAPI response schemas are JSON Schema. Ajv is the most battle-tested JSON Schema validator in the Node.js ecosystem, supporting drafts 4/6/7/2019-09/2020-12 and OpenAPI 3.x schema extensions.

### Why WebSocket for test results?

Contract tests are I/O-bound and may take several seconds. Streaming results via WebSocket lets the UI update edge colors and tooltips in real time rather than polling or waiting for a full response.

---

## 8. Proposed Directory Structure

```
architest/
├── packages/
│   ├── frontend/               # React SPA
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── Canvas.tsx          # React Flow graph canvas
│   │   │   │   ├── ServiceNode.tsx     # Custom node component
│   │   │   │   ├── ContractEdge.tsx    # Custom edge with color state
│   │   │   │   └── InspectionPanel.tsx # Right-side endpoint panel
│   │   │   ├── store/
│   │   │   │   └── graphStore.ts       # Zustand store
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── index.html
│   │   ├── tailwind.config.ts
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── backend/                # Fastify API + test runner
│       ├── src/
│       │   ├── server.ts               # Fastify app entry
│       │   ├── routes/
│       │   │   ├── scan.ts             # POST /scan — parse project
│       │   │   ├── graph.ts            # GET /graph — return graph data
│       │   │   └── test.ts             # POST /test — run contract test
│       │   ├── parsers/
│       │   │   ├── dockerCompose.ts    # docker-compose.yml parser
│       │   │   └── openapi.ts          # OpenAPI spec parser
│       │   ├── runner/
│       │   │   └── contractRunner.ts   # Playwright API test generator + executor
│       │   ├── graph/
│       │   │   └── builder.ts          # Build nodes/edges from parsed data
│       │   └── ws/
│       │       └── testStream.ts       # WebSocket handler for test results
│       ├── tsconfig.json
│       └── package.json
│
├── Dockerfile                  # Multi-stage: build frontend, bundle with backend
├── docker-compose.dev.yml      # Local dev with hot reload
├── package.json                # Root workspace config
├── tsconfig.base.json          # Shared TS config
└── README.md
```

---

## 9. API Surface (Backend)

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/scan` | Accepts a project path. Parses Docker Compose + OpenAPI files. Returns structured parse result. |
| `GET`  | `/api/graph` | Returns the current graph (nodes + edges) as JSON. |
| `GET`  | `/api/graph/edge/:id` | Returns detailed endpoint info for a specific edge. |
| `POST` | `/api/test/run` | Accepts an edge ID + endpoint. Generates and runs the contract test. Returns result. |
| `WS`   | `/ws/test` | Streams test execution progress (started → running → result). |

---

## 10. Docker Build Strategy

```dockerfile
# Stage 1: Build frontend
FROM node:22-slim AS frontend-build
WORKDIR /app
COPY packages/frontend/ ./
RUN npm ci && npm run build

# Stage 2: Production
FROM node:22-slim
RUN npx playwright install --with-deps chromium
WORKDIR /app
COPY packages/backend/ ./
COPY --from=frontend-build /app/dist ./public
RUN npm ci --production
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

The backend serves the frontend's static build from `/public`. Single container, single port.

> **Note:** Playwright is installed with only Chromium (not Firefox/WebKit) to minimize image size. For API-only testing, Playwright does not launch a browser, but the dependency is still required at install time.

---

## 11. Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| User's Docker services not running when test executes | Test fails with connection error, confusing UX | Pre-flight container health check before test run; clear error messaging. |
| OpenAPI spec not co-located with service in compose file | System can't auto-associate spec to service | Convention-based path resolution + manual override in future phase. |
| Large OpenAPI specs slow down panel rendering | UI jank | Lazy-load endpoint list; virtualize long lists. |
| Volume mount permissions on Windows/macOS | Container can't read project files | Document required `-v` mount flag; detect and surface permission errors. |
| Playwright install bloats Docker image | Image > 500 MB | Use `node:22-slim`, install only Chromium, prune apt cache. |
