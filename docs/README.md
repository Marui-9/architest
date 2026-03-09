# ArchiTest

**Point at your infrastructure. See it, score it, test it.**

ArchiTest is a local-first tool that discovers your containerized services, renders them as an interactive architecture graph, scores your setup against architecture quality rules, and  runs live contract tests against running containers when API specs are present.

No data leaves your machine. No config files to write. No agents to install.

---

## Quick Start

### Scan running containers (zero-config)

```bash
docker run -v /var/run/docker.sock:/var/run/docker.sock -p 3000:3000 architest/core
```

### Scan a project folder

```bash
docker run -v $(pwd):/project -p 3000:3000 architest/core
```

Open [http://localhost:3000](http://localhost:3000).

---

## What It Does

ArchiTest delivers value in three layers. Each layer works independently — you don't need API specs or running containers to get useful output.

### Layer 1: See It — Architecture Discovery

ArchiTest discovers services from multiple sources:

- **Docker Compose** — parses `docker-compose.yml` to extract services, ports, and dependencies
- **Docker daemon** — inspects running containers via the Docker socket to map live architecture (no compose file needed)

Every discovered service becomes a **node** on a dark-mode graph canvas. Every dependency becomes a **directional edge**. Services are classified by type — application, datastore, cache, message broker — and styled accordingly.

No AI. No heuristics. Deterministic parsing and live inspection.

### Layer 2: Score It — Architecture Guardrails

Without any API specs, ArchiTest evaluates your architecture against a built-in rule library:

| Rule | What it catches |
|------|----------------|
| `no-public-db` | Database or cache services exposing ports to the host |
| `no-latest-tag` | Images using `:latest` instead of pinned versions |
| `circular-dependency` | Circular dependency chains between services |
| `missing-healthcheck` | Services without a healthcheck definition |
| `no-restart-policy` | Services without a restart policy |
| `no-resource-limits` | Services without memory or CPU constraints |
| `excessive-dependencies` | Services with too many direct dependencies |
| `orphan-service` | Services with no connections and no exposed ports |
| ... | And more |

Results produce a **0–100 architecture score** with a category breakdown (security, reliability, architecture, hygiene) and actionable remediation for each finding.

### Layer 3: Test It — Contract Verification

When OpenAPI specs are present, ArchiTest unlocks full contract testing:

- Click any API edge to see all endpoints (method, route, expected responses, schema)
- Run a contract test with one click — ArchiTest sends a real HTTP request to the live container and validates the response status code and body against the OpenAPI spec
- Edge colors update in real time: **gray** (untested), **green** (verified), **red** (failed), **yellow** (schema mismatch)

Even without specs, every edge supports **health-probe testing** — a connectivity check that verifies the target service is reachable. No edge is untestable.

---

## Three Ways to Use It

**1. Zero-config live scan** — Mount the Docker socket. Click "Scan running containers." See your running architecture immediately, regardless of how it was deployed.

**2. Compose analysis** — Point it at a project folder with a `docker-compose.yml`. Get topology visualization and architecture findings. No specs or running containers required.

**3. Full contract testing** — Project folder with Docker Compose + OpenAPI specs + running containers. The full experience: graph, score, and live contract verification.

---

## What It Doesn't Do

The MVP is deliberately scoped:

- No browser automation — API testing only
- No test editing UI — tests are generated and run internally
- No CI integration — local-first only (CI is planned post-MVP)
- No AI — everything is deterministic
- No multi-environment support — single environment per scan

---

## Differentiation

| Tool | What It Does | ArchiTest's Difference |
|------|-------------|----------------------|
| Postman | Manual API testing | Not architecture-aware |
| Swagger UI | Spec visualization | Not executable, not system-wide |
| Playwright | Code-based testing | No architectural abstraction |
| Docker Desktop | Container management | No dependency graph, no quality scoring |
| YAML linters | Syntax checking | No architectural analysis or contract testing |

ArchiTest's core abstraction: **infrastructure in → architecture graph + quality score + executable contract tests.**

---

## Who It's For

- Any team running Docker containers locally
- Backend teams building microservices
- Platform engineers reviewing architecture quality
- Teams with OpenAPI specs who want instant contract validation
- Developers who want to understand their system topology without reading YAML

---

## Roadmap

- Kubernetes manifest parsing (Helm, Kustomize, raw YAML)
- CI/CD integration with PR-blocking policy checks
- CLI mode (`npx architest scan`)
- Historical tracking and architecture drift detection
- Authentication helpers for contract tests
- GraphQL and gRPC spec support
- Hosted SaaS with team dashboards and alerting

---

## License

TBD
