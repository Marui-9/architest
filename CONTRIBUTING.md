# Contributing to ArchiTest

Thank you for your interest in contributing to ArchiTest! This document outlines the development workflow, testing practices, and code standards.

---

## Development Setup

### Prerequisites
- Node.js 22+
- Docker (for local testing and builds)
- npm 10+ (workspaces enabled by default)

### Install Dependencies

From the project root:

```bash
npm install
```

This installs dependencies for both `packages/backend` and `packages/frontend` via npm workspaces.

### Run Tests

```bash
npm test
```

Or by package:

```bash
cd packages/backend && npm test
cd packages/frontend && npm test
```

### Run Locally (Development Mode)

**Terminal 1 — Backend (port 3000)**
```bash
cd packages/backend && npm run dev
```

**Terminal 2 — Frontend (port 5173)**
```bash
cd packages/frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. The frontend proxies API requests to the backend.

### Run via Docker

Build the image:

```bash
docker build -t architest:dev .
```

Run with Docker socket mounted (for daemon scanning):

```bash
docker run -v /var/run/docker.sock:/var/run/docker.sock -p 3000:3000 architest:dev
```

Then visit [http://localhost:3000](http://localhost:3000).

---

## Code Standards

### TypeScript

- Strict mode enabled (`strict: true` in `tsconfig.json`)
- No `any` types without explanation
- Use interfaces for public APIs, types for internal structures
- Run `npx tsc -b` to check compilation

### Linting & Formatting

```bash
npm run lint       # Check linting
npm run format     # Auto-format all files
npm run format:check  # Verify formatting without changes
```

All pull requests must pass linting and formatting checks.

### Testing

- Unit tests in `*.test.ts` or `*.test.tsx` files
- Use Vitest as the test runner
- Aim for >80% coverage on new code
- Use descriptive test names: `it('should validate docker-compose with missing services key')`
- Mock external dependencies (Docker socket, file system)

---

## Project Structure

```
packages/
├── backend/
│   ├── src/
│   │   ├── server.ts          # Fastify app entry
│   │   ├── types.ts           # Shared types
│   │   ├── parsers/           # Docker Compose, OpenAPI, spec discovery
│   │   ├── adapters/          # Infrastructure adapters (Compose, Daemon)
│   │   ├── graph/             # Graph builder and state management
│   │   ├── routes/            # API route handlers
│   │   └── runner/            # Contract test runner, health probes
│   └── vitest.config.ts
├── frontend/
│   ├── src/
│   │   ├── main.tsx           # React entry
│   │   ├── App.tsx            # Root component
│   │   ├── store/             # Zustand state management
│   │   ├── components/        # React components
│   │   └── index.css          # Tailwind styles
│   └── vitest.config.ts
```

---

## Making Changes

### Before You Start

1. Check if there's an open issue for the feature or bug
2. Create a new branch: `git checkout -b feature/your-feature-name`

### Workflow

1. **Make your changes** — keep commits atomic and focused
2. **Write or update tests** — test your changes before submitting
3. **Check formatting** — `npm run format && npm run lint`
4. **Verify builds** — `npm run build` in affected packages
5. **Test locally** — run the dev server or Docker image
6. **Push your branch** and create a pull request

### Pull Request Guidelines

- Describe what the PR does and why
- Reference related issues: "Fixes #42"
- Include test coverage for new features
- Ensure CI passes (linting, tests, build, Docker image size)
- Keep PRs focused — split large changes across multiple PRs if needed

---

## Testing Your Changes

### Smoke Tests

After making changes, verify the core flows:

1. **Compose scan** — Point at `packages/backend/src/parsers/__fixtures__/sample-project` and click Scan
   - Expected: Graph renders with 2 services (order-api, user-api) and 1 edge
   - Both services should show ports and OpenAPI indicators

2. **Error handling** — Enter `/nonexistent/path` and scan
   - Expected: Red banner saying "Project path does not exist"

3. **Graph interaction** — Click an edge on the graph
   - Expected: Right panel slides in with edge details and "Run Test" / "Check Connection" button

4. **Contract test** — Click an API edge and hit "Run Test"
   - Expected: Test results stream in, edge color updates to green (pass) or red (fail)

5. **TypeScript build**
   ```bash
   cd packages/backend && npx tsc -b
   cd packages/frontend && npx tsc -b && npx vite build
   ```
   - Expected: No errors

### Docker Build & Run

```bash
docker build -t architest:test .
docker run -v /var/run/docker.sock:/var/run/docker.sock -p 3000:3000 architest:test
```

Visit [http://localhost:3000](http://localhost:3000) and verify the app loads and scans work.

---

## Debugging

### Backend

- Add `console.log()` or set breakpoints in your IDE (VS Code with Node debugger works well)
- Use `npm run dev` to auto-reload on changes
- Check server logs: `[HH:MM:SS.sss] INFO` messages on startup

### Frontend

- Use browser DevTools (F12 in Chrome/Firefox)
- Zustand DevTools browser extension helps debug state
- `npm run dev` shows HMR (hot module reload) on file changes

### Docker Debugging

Build with `--progress=plain` to see full output:

```bash
docker build --progress=plain -t architest:debug .
```

If the container exits, check logs:

```bash
docker logs <container_id>
```

---

## Release Process

When ready to publish a new version:

1. Update version in `packages/backend/package.json` and `packages/frontend/package.json`
2. Tag the commit: `git tag v0.x.y`
3. Build and push Docker image:
   ```bash
   docker build -t jacobmarui/architest:latest .
   docker build -t jacobmarui/architest:0.x.y .
   docker push jacobmarui/architest:latest
   docker push jacobmarui/architest:0.x.y
   ```
4. Create a GitHub release with release notes

---

## Questions?

Open an issue on GitHub or start a discussion. We're here to help!

Happy coding! 🚀
