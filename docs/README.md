# ArchiTest

**A local-first visual contract testing tool that converts Docker + OpenAPI systems into an executable architecture map.**

ArchiTest lets teams see and verify service integrations instantly. Point it at your Docker Compose project, and it builds a live graph where every service connection is an executable contract test.

---

## Quick Start

```bash
docker run -p 3000:3000 architest/core
```

Open [http://localhost:3000](http://localhost:3000).

## How It Works

### 1. Connect a Repository

Select your local project folder. ArchiTest deterministically parses:

- `docker-compose.yml` — discovers services, ports, and dependencies
- OpenAPI spec files — discovers API contracts

No AI. No heuristics. Deterministic parsing only.

### 2. Architecture Map

A dark-mode graph canvas renders your system:

**Nodes** — one per Docker service (e.g. `frontend`, `user-api`, `postgres`), showing:
- Service name
- Exposed port
- OpenAPI availability indicator

**Edges** — created when a service `depends_on` another that exposes an OpenAPI spec. Each edge represents a *consumer → provider API contract*.

### 3. Inspect Edges

Click any edge to open the inspection panel:

- Detected base URL
- All endpoints from the provider's OpenAPI spec (method + route)
- Expected response codes
- Response schema summary

Select an endpoint to generate a contract test.

### 4. Run Contract Tests

ArchiTest generates and executes a [Playwright](https://playwright.dev/) API test that:

- Sends a request to the live service container
- Validates the status code against the OpenAPI spec
- Validates the response body against the OpenAPI schema

It deliberately does **not** assert business logic, validate DB state, or require auth flows.

### 5. Visual Feedback

Edges update in real time:

| Color  | Meaning                   |
|--------|---------------------------|
| Gray   | Not tested                |
| Green  | Contract verified         |
| Red    | Contract failed           |
| Yellow | Spec mismatch detected    |

Hover any edge to see: last run timestamp, response time, status code, and failure reason (if applicable).

> The green arrow moment is the product.

---

## What the MVP Does NOT Do

To keep scope sharp, the MVP explicitly excludes:

- Browser automation
- Test editing UI
- Multi-environment support
- CI integration
- AI-generated tests
- Drift detection beyond basic spec mismatch

These are planned for future phases.

---

## Differentiation

| Tool       | What It Does            | Why ArchiTest Is Different             |
|------------|-------------------------|----------------------------------------|
| Postman    | Manual API testing      | Not architecture-aware                 |
| Swagger UI | Spec visualization      | Not executable system-wide             |
| Playwright | Code-based testing      | No architectural abstraction           |

**ArchiTest's core abstraction:** *service edge = executable contract.*

---

## Ideal Users

- Teams using Docker Compose locally
- Backend-first SaaS startups
- Platform engineers enforcing API contracts
- Microservice teams with OpenAPI discipline

---

## Roadmap

- Authentication helpers (token auto-injection)
- Frontend → API E2E via Playwright browser mode
- CI mode with JSON export
- Drift detection on PRs
- Historical integration health tracking
- Multi-repo service graph

---

## License

TBD
