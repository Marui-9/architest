# ArchiTest — Viability Evaluation & Evolution Development Plan

## Part 1: Viability Evaluation

### What ArchiTest Actually Is

ArchiTest sits at an intersection no existing tool occupies: **architecture visualization + contract test execution against live containers, derived deterministically from Docker Compose and OpenAPI specs.** The abstraction — *service edge = executable contract* — is genuinely novel.

### Usefulness Assessment

**Strong points:**

1. **Real pain, underserved market.** Teams running Docker Compose + OpenAPI have no tool that shows them "are my services actually talking to each other correctly, right now?" Postman doesn't know about architecture. Swagger UI can't hit live containers in context. Playwright requires writing code. ArchiTest is the glue between all three.

2. **Zero-config discovery.** Parsing docker-compose.yml and co-located OpenAPI specs is a legitimate workflow — it reflects how real projects are structured. No config files to write, no agent to install.

3. **The "green arrow moment" is real.** Seeing your architecture graph with live-validated edges creates an immediate visceral reaction. This is the kind of thing people screenshot and share in Slack. That moment is strong marketing.

4. **Local-first resonates.** Post-2023, developers are increasingly suspicious of tools that phone home. "No telemetry, no analytics, no external calls" is a selling point.

**Weaknesses / risks:**

1. **Narrow initial audience.** You need teams using Docker Compose + OpenAPI + multiple services. That's a real but specific slice of the market. Teams using Kubernetes in production won't use Docker Compose locally. Teams without OpenAPI specs (most startups, honestly) get zero value.

2. **Contract testing is an acquired taste.** Most teams don't do contract testing at all. ArchiTest has to sell the *concept* of contract testing, not just the tool. That's a harder GTM motion.

3. **The MVP is demo-ware without running containers.** ArchiTest can only test contracts if the user's Docker services are actually running. If the user just wants to visualize architecture, there are simpler tools. The value prop depends on a multi-step workflow: start your docker-compose stack → scan → test. That's more friction than "paste a URL."

4. **OpenAPI coverage is inconsistent.** Many services expose REST APIs without OpenAPI specs. gRPC, GraphQL, and event-driven architectures are invisible to ArchiTest. This limits how "complete" the architecture view can be.

### Viability as Open Source + Paid Hosting

**The open-core model can work here. Here's why:**

| Factor | Assessment |
|--------|-----------|
| **Self-hosting difficulty** | Medium. Single Docker image is easy, but adding CI integration, team features, and historical tracking increases ops burden. This creates natural paid-tier demand. |
| **Value of hosted features** | High. Historical drift tracking, CI integration, team dashboards, and alerting are all things teams will pay for rather than build themselves. |
| **Competitive moat** | Moderate. The core parsing + visualization is not hard to replicate. The moat comes from: (a) rule library depth, (b) CI integration quality, (c) historical data and scoring, (d) community-contributed rules. |
| **Pricing psychology** | Favorable. DevOps/platform tooling commands $20-50/seat/month. ArchiTest's value prop ("catch breaking API changes before production") is a fear-based sale — those convert well. |
| **Market timing** | Good. Microservices adoption is mature enough that teams feel the pain of integration testing but haven't solved it. The "shift left" movement supports tools like this. |

**Realistic revenue potential:**

- **Open source adoption**: Could reach 1-5K GitHub stars in the first year with good positioning and dev relations. This is within reach for a well-built, well-marketed tool in the Docker/API space.
- **Paid hosting**: At $30/seat/month for teams of 5-15, you're looking at $150-450/month per customer. You need 50-100 paying teams to hit $10K-30K MRR. That's achievable but requires dedicated GTM effort.
- **Time to revenue**: Realistically 6-12 months after MVP launch to get first paying customers. The open source has to prove value first.

**Verdict: Viable, but not a slam dunk.** The tool solves a real problem for a specific audience. The open-core model fits naturally. The risk is audience size — you need to expand beyond "Docker Compose + OpenAPI" to capture a larger market, which is exactly what architest_evo.txt proposes.

---

## Part 2: Current State

| Phase | Status | What Exists |
|-------|--------|------------|
| 0 — Scaffolding | **Code written** | Monorepo, TypeScript, ESLint, Vite, Fastify, Dockerfile, docker-compose.dev.yml. Not yet verified with `npm install`. |
| 1 — Parser Engine | **Code written** | Docker Compose parser, OpenAPI parser (3.x + Swagger 2.x), spec-to-service association, scan orchestrator, 32+ unit/integration tests. Not yet verified. |
| 2 — Graph Builder | Not started | `GET /api/graph` returns empty stub. |
| 3 — Frontend Canvas | Not started | App.tsx is a placeholder `<h1>`. |
| 4 — Inspection Panel | Not started | No UI components. |
| 5 — Contract Test Runner | Not started | `POST /api/test/run` returns 501. |
| 6 — Error Handling | Not started | — |
| 7 — Polish | Not started | — |

**The parsing foundation is solid.** The Docker Compose and OpenAPI parsers are thorough, well-tested, and handle real-world format variations. This is the hardest "boring" work and it's done.

---

## Part 3: Evolution Development Plan

This plan covers two tracks:
- **Track A: Complete the MVP** (Phases 2–7 from the existing implementation plan)
- **Track B: Evolve toward the product vision** (from architest_evo.txt)

Track A must reach completion before Track B begins. Track B items are ordered by business impact.

---

### Track A: MVP Completion

#### A1. Verify & Stabilize Foundation (1 day)
**Goal:** Confirm all Phase 0 + Phase 1 code actually compiles and passes.

- [ ] Run `npm install` at root
- [ ] Run `npm test --workspace=packages/backend` — fix any failures
- [ ] Run `npm run build --workspaces` — fix any compilation errors
- [ ] Run `npm run lint` — fix any lint issues
- [ ] Verify `docker compose -f docker-compose.dev.yml up` builds and starts

This is the current blocker. Nothing has been verified yet.

#### A2. Graph Builder — Backend (2 days)
**Goal:** `GET /api/graph` returns a real graph from scan results.

- [ ] Define `GraphNode`, `GraphEdge`, `Graph` types (shared in `types.ts` or `graph/types.ts`)
- [ ] Implement `buildGraph(scanResult)` in `src/graph/builder.ts`
  - One `GraphNode` per Docker service (id, label, ports, hasOpenAPI, position)
  - One `GraphEdge` per `depends_on` relationship where target has OpenAPI spec
  - Simple grid auto-layout (no external dependency needed for MVP; dagre can come later)
- [ ] Wire graph state: scan → build graph → store in memory
- [ ] Implement `GET /api/graph` returning the stored graph
- [ ] Implement `GET /api/graph/edge/:id` returning endpoint details for a specific edge
- [ ] Unit tests for builder (various scan result shapes)

#### A3. Frontend — Graph Canvas (4-5 days)
**Goal:** Render the architecture graph with custom nodes and edges.

- [ ] Install `@xyflow/react`, `zustand`, `@dagrejs/dagre`
- [ ] Create Zustand store (`src/store/graphStore.ts`) — nodes, edges, selectedEdge, testResults
- [ ] Create `ProjectSelector.tsx` — landing screen, text input for project path, calls `POST /api/scan` → `GET /api/graph`
- [ ] Create `ServiceNode.tsx` — dark box with service name, port badge, OpenAPI indicator (green/gray dot)
- [ ] Create `ContractEdge.tsx` — directional arrow, color-coded by test status (gray/green/red/yellow), clickable
- [ ] Create `Canvas.tsx` — ReactFlow wrapper, pan/zoom, minimap
- [ ] Dagre auto-layout on initial load + "Re-layout" button
- [ ] Dark-mode theming: Tailwind `dark` class on root, dark canvas background, dark node/edge styles
- [ ] Hover tooltip on edges showing test status

#### A4. Frontend — Inspection Panel (2-3 days)
**Goal:** Click edge → see endpoints → trigger tests.

- [ ] Create `InspectionPanel.tsx` — right-side slide-in panel (~400px, dark-themed)
- [ ] On edge click: fetch `GET /api/graph/edge/:id`, display provider name, base URL, endpoint list
- [ ] Each endpoint row: HTTP method badge (color-coded), route, expected response codes
- [ ] Expandable response schema summary (formatted JSON)
- [ ] "Run Test" button per endpoint → calls `POST /api/test/run`
- [ ] Loading spinner during test, inline result display (pass/fail badge, status code, response time)
- [ ] Panel ↔ Graph sync: update edge color + tooltip after test result

#### A5. Contract Test Runner (4-5 days)
**Goal:** Execute real HTTP contract tests against live containers.

- [ ] Install `playwright` (library API) and `ajv` + `ajv-formats`
- [ ] Implement `src/runner/contractRunner.ts`:
  - `generateAndRunTest(endpoint, baseURL)` using Playwright `APIRequestContext`
  - Build HTTP request from endpoint definition (method, path)
  - GET: send as-is. POST/PUT/PATCH: send minimal body or empty body for MVP
  - Return `TestResult`: { pass, statusCode, expectedCodes, responseTimeMs, responseBody, validationErrors }
- [ ] Response status validation: check status code ∈ expected codes from spec
- [ ] Response schema validation with Ajv: extract JSON Schema from parsed OpenAPI response, validate body
  - Status code match + body mismatch → `mismatch` status (yellow)
- [ ] Pre-flight health check: TCP/HTTP probe before running test, clear error if unreachable
- [ ] Implement `POST /api/test/run` fully: look up edge + endpoint, health check, run test, update in-memory graph
- [ ] WebSocket streaming (`/ws/test`): emit `test:started`, `test:running`, `test:completed`
- [ ] Frontend WebSocket client: connect on mount, update Zustand store on events
- [ ] Integration tests with a mock HTTP server as stand-in for Docker services

#### A6. Error Handling & Edge Cases (2-3 days)
**Goal:** Harden for real-world usage.

- [ ] Missing docker-compose.yml → clear empty state with instructions
- [ ] Malformed YAML → error with line number
- [ ] Invalid OpenAPI spec → warning badge on node, details in panel
- [ ] Container unreachable → red banner in panel, retry button, actionable guidance
- [ ] Large specs (100+ endpoints) → virtualized list with search/filter
- [ ] Compose v2/v3 format variations, `profiles`, `extends` → graceful handling
- [ ] Volume mount permission errors → clear explanation of `-v` requirement

#### A7. Polish & Ship (3-4 days)
**Goal:** Production-ready Docker image + documentation.

- [ ] UI polish: edge color transitions, minimap, keyboard shortcuts (Esc, F), loading skeletons, toast notifications
- [ ] Docker image optimization: Chromium-only Playwright, prune caches, verify <500 MB
- [ ] E2E smoke test: start container → scan sample project → verify graph → run test → green edge
- [ ] README: quick start, volume mount examples (macOS/Windows/Linux), screenshots, FAQ
- [ ] CONTRIBUTING.md with dev setup instructions
- [ ] GitHub Actions CI: lint, test, Docker build, image size assertion

**Track A total: ~19-23 working days from current state.**

---

### Track B: Product Evolution (post-MVP)

These are the features from architest_evo.txt, ordered by impact and feasibility. Each is scoped as a development phase with concrete deliverables.

#### B1. Architecture Guardrails Engine (2-3 weeks)
**Why first:** This is the single biggest expansion of ArchiTest's value proposition. It transforms the tool from "contract test runner" to "architecture quality analyzer," which is a much larger market.

**Deliverables:**

- [ ] **Rule engine core** (`src/rules/engine.ts`)
  - Rule interface: `{ id, name, severity, category, evaluate(scanResult) → Finding[] }`
  - Rule registry: load built-in rules + user-defined rules
  - Finding type: `{ ruleId, severity, service, message, remediation }`

- [ ] **Built-in rule library** (start with 10-15 high-value rules):

  | Rule | Category | Description |
  |------|----------|-------------|
  | `no-public-db` | Security | Database services (postgres, mysql, redis, mongo) should not expose ports to host |
  | `no-privileged` | Security | Services should not run in privileged mode |
  | `no-shared-volumes` | Coupling | Flag when 3+ services mount the same volume |
  | `unused-service` | Hygiene | Services with no `depends_on` references and no exposed ports |
  | `missing-healthcheck` | Reliability | Services without a healthcheck definition |
  | `circular-dependency` | Architecture | Detect circular `depends_on` chains |
  | `excessive-dependencies` | Architecture | Flag services with >5 direct dependencies |
  | `no-resource-limits` | Operations | Services without `mem_limit` or `cpus` constraints |
  | `spec-coverage` | Contracts | Services with HTTP ports but no OpenAPI spec |
  | `orphan-network` | Hygiene | Defined networks not used by any service |
  | `latest-tag` | Security | Images using `:latest` tag instead of pinned versions |
  | `no-restart-policy` | Reliability | Services without `restart` policy |

- [ ] **Configurable rule policies** via `.architest.yml` at project root:
  ```yaml
  rules:
    no-public-db: error     # fail scan
    missing-healthcheck: warn  # show warning
    no-resource-limits: off    # ignore
  ```

- [ ] **Architecture score** (`src/rules/scorer.ts`):
  - Compute a 0-100 score based on findings (weighted by severity)
  - Categories: Security, Reliability, Architecture, Hygiene
  - Display on dashboard with breakdown

- [ ] **Guardrails UI**:
  - Score card on main canvas (top-left overlay)
  - Findings list panel (filterable by severity/category)
  - Affected nodes highlighted on the graph
  - Finding details with remediation suggestions

- [ ] **API routes**:
  - `GET /api/rules` — list all available rules with current policy
  - `GET /api/rules/evaluate` — run rules against current scan, return findings + score
  - `PUT /api/rules/policy` — update rule severities

#### B2. CI/CD & Policy Enforcement (2-3 weeks)
**Why second:** This is where ArchiTest becomes a workflow tool, not just a dev utility. CI integration is the bridge to the SaaS model — teams that use it in CI are far more likely to pay for hosted dashboards.

**Deliverables:**

- [ ] **CLI mode** (`architest-cli`):
  - `architest scan <path>` — run scan + rules, output JSON or human-readable report
  - `architest test <path>` — run all contract tests, exit with non-zero on failures
  - `architest score <path>` — output architecture score
  - Exit codes: 0 = pass, 1 = failures/errors, 2 = warnings (configurable)
  - `--format json|table|markdown` output format flag
  - Publishable as `npx architest` or standalone Docker command

- [ ] **GitHub Actions integration**:
  - `architest/action@v1` — reusable action that runs scan + rules + tests
  - PR comment with architecture score diff, new findings, test results
  - Status check: pass/fail based on policy
  - Provide ready-to-use workflow YAML examples

- [ ] **GitLab CI integration**:
  - Docker-based job definition
  - MR comment via GitLab API
  - Pipeline status integration

- [ ] **Baseline & drift detection**:
  - `architest baseline <path>` — snapshot current state to `.architest-baseline.json`
  - On subsequent runs, diff against baseline:
    - New findings → flagged
    - Score decrease → flagged
    - New services/edges → noted
  - Configurable: `--fail-on-regression` flag for CI

#### B3. Historical Tracking & Diffing (2-3 weeks)
**Why third:** This is the core SaaS differentiator. Historical data requires persistence, which naturally pushes toward a hosted solution. This is where you charge.

**Deliverables:**

- [ ] **Persistence layer**:
  - SQLite for local/self-hosted (zero-config)
  - PostgreSQL adapter for hosted SaaS
  - Schema: scans, findings, scores, test results, snapshots (all timestamped)

- [ ] **Scan history**:
  - Store every scan result with timestamp and git commit hash (if available)
  - `GET /api/history` — list recent scans with scores
  - `GET /api/history/:id` — full scan detail

- [ ] **Diff engine** (`src/diff/engine.ts`):
  - Compare two scan snapshots:
    - Services added/removed
    - Edges added/removed
    - Score changes (overall + per-category)
    - New findings introduced
    - Findings resolved
  - `GET /api/diff?from=<id>&to=<id>` — return structured diff

- [ ] **Trend dashboard**:
  - Score over time (line chart)
  - Finding count over time (stacked bar by severity)
  - Service count over time
  - Worst-offending services (sorted by finding count)

- [ ] **Alerting** (SaaS tier):
  - Webhook on score drop below threshold
  - Slack integration for new critical findings
  - Email digest (weekly architecture health report)

#### B4. Visual Storytelling & IDE Integration (2 weeks)
**Why fourth:** Expands distribution channels and makes the graph a communication tool, not just a dev tool.

**Deliverables:**

- [ ] **Risk visualization on graph**:
  - Nodes with findings: red/yellow glow or warning badge with count
  - Hovering a node with findings shows finding summary tooltip
  - Edge thickness proportional to coupling or traffic (if available)
  - Score overlay on canvas: overall score prominently displayed

- [ ] **Graph export**:
  - PNG/SVG export of current graph state (for docs, presentations)
  - Mermaid diagram export
  - JSON export (for custom integrations)

- [ ] **VS Code extension** (stretch goal):
  - Sidebar panel showing architecture score for current project
  - Quick-scan command from palette
  - Inline warnings on docker-compose.yml lines that violate rules
  - Link to web UI for full graph

- [ ] **Slack integration**:
  - Bot command: `/architest score` → posts current score + top findings
  - Webhook notifications (ties into B3 alerting)

#### B5. Multi-Environment & Auth Support (2-3 weeks)
**Why fifth:** Removes the two biggest MVP limitations that block adoption by larger teams.

**Deliverables:**

- [ ] **Environment profiles**:
  - `.architest.yml` supports multiple environments:
    ```yaml
    environments:
      local:
        compose: docker-compose.yml
        baseUrl: http://localhost
      staging:
        compose: docker-compose.staging.yml
        baseUrl: https://staging.example.com
    ```
  - UI environment switcher
  - Separate test results per environment

- [ ] **Authentication helpers**:
  - Token injection: configure auth tokens per service in `.architest.yml`
  - Auto-renewal: OAuth2 client credentials flow
  - Header injection: custom headers per service (API keys, etc.)
  - Cookie-based auth: configured cookies sent with test requests

- [ ] **Non-OpenAPI protocols** (incremental):
  - gRPC: proto file discovery, reflection-based endpoint listing, basic connectivity test
  - GraphQL: introspection query, schema validation
  - Health-check only: for services without specs, at least verify they respond

---

### SaaS Architecture (Hosted Offering)

When Track B features are mature enough, the hosted SaaS layer adds:

```
┌─────────────────────────────────────────────────────────┐
│                     SaaS Platform                        │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐              │
│  │ Auth/SSO │  │ Team Mgmt│  │ Billing   │              │
│  └──────────┘  └──────────┘  └───────────┘              │
│                                                          │
│  ┌──────────────────────────────────────────────┐       │
│  │            Multi-tenant API Gateway           │       │
│  └──────────────────┬───────────────────────────┘       │
│                     │                                    │
│  ┌──────────────────▼───────────────────────────┐       │
│  │            ArchiTest Core Engine              │       │
│  │  (scan, rules, score, diff, history, alerts)  │       │
│  └──────────────────┬───────────────────────────┘       │
│                     │                                    │
│  ┌──────────────────▼───────────────────────────┐       │
│  │         PostgreSQL (per-tenant data)           │       │
│  └──────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

**Tier structure:**

| Tier | Price | Features |
|------|-------|----------|
| **Free** (OSS) | $0 | CLI, local graph, rules, contract tests, SQLite history |
| **Team** | $25/seat/mo | Hosted dashboard, CI integrations, PR comments, 90-day history |
| **Pro** | $50/seat/mo | Custom rules, alerting (Slack/webhook/email), unlimited history, trend analytics |
| **Enterprise** | Custom | SSO/SAML, audit logs, on-prem deployment support, dedicated support |

---

### Development Timeline

| Phase | What | Duration | Cumulative |
|-------|------|----------|------------|
| **A1** | Verify & stabilize | 1 day | 1 day |
| **A2** | Graph builder | 2 days | 3 days |
| **A3** | Frontend canvas | 4-5 days | ~1.5 weeks |
| **A4** | Inspection panel | 2-3 days | ~2 weeks |
| **A5** | Contract test runner | 4-5 days | ~3 weeks |
| **A6** | Error handling | 2-3 days | ~3.5 weeks |
| **A7** | Polish & ship MVP | 3-4 days | **~4-5 weeks** |
| — | *MVP launch. Start collecting feedback.* | | |
| **B1** | Architecture guardrails | 2-3 weeks | ~7-8 weeks |
| **B2** | CI/CD + CLI | 2-3 weeks | ~10-11 weeks |
| **B3** | Historical tracking | 2-3 weeks | ~13-14 weeks |
| **B4** | Visual storytelling | 2 weeks | ~15-16 weeks |
| **B5** | Multi-env + auth | 2-3 weeks | **~17-19 weeks** |

**Total to full evolution: ~4-5 months solo.** Parallelizable to ~3 months with a second developer (frontend/backend split).

---

### Recommended Sequencing Strategy

1. **Ship the MVP (Track A) as fast as possible.** A working demo > a perfect plan. The "green arrow moment" is the hook — get it in front of people.

2. **B1 (Guardrails) is the most important evolution.** It expands the audience from "teams who do contract testing" to "teams who want to understand their Docker architecture." That's 10x the market.

3. **B2 (CI/CD) is the monetization bridge.** Once teams use ArchiTest in CI, they need dashboards and history — which is the SaaS. Don't build CI without B3 close behind.

4. **Open source the core aggressively.** CLI + rules + local graph + contract tests should all be free. The paid tier is dashboards, history, alerting, team features. Don't gate core functionality behind payment — it kills adoption.

5. **Collect architecture rules from the community.** A rule library that grows through contributions becomes a moat. Make rule authoring as easy as writing a function that takes a `ScanResult` and returns `Finding[]`.

---

### Key Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Audience too narrow (Docker Compose + OpenAPI only) | Low adoption | B5 adds gRPC/GraphQL/health-only support; B1 guardrails work without OpenAPI |
| Playwright in Docker adds image bloat | Bad first impression | For guardrails/visualization-only use cases, make Playwright optional. Only install when contract testing is needed. |
| Contract tests fail due to auth/state | User frustration | Clear messaging that MVP tests unauthenticated GET endpoints. B5 adds auth. Consider "dry run" mode that validates spec structure without hitting live services. |
| SaaS requires significant additional infrastructure | Delayed revenue | Start with a simple hosted version (single-tenant, manual onboarding) before building full multi-tenant platform. Validate willingness to pay first. |
| Competition from larger DevOps platforms | Market pressure | Speed and focus are the advantage. Ship the niche tool well before trying to be a platform. The specific "Docker Compose → visual contract tests" workflow is unlikely to be a priority for Datadog/PagerDuty/etc. |
