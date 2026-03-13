# ─── Stage 1: Build frontend ────────────────────────────────────────────
FROM node:22-slim AS frontend-build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/frontend/package.json ./packages/frontend/
RUN npm ci --workspace=packages/frontend
COPY packages/frontend/ ./packages/frontend/
COPY tsconfig.base.json ./
RUN npm run build --workspace=packages/frontend

# ─── Stage 2: Production ───────────────────────────────────────────────
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/backend/package.json ./packages/backend/
RUN npm ci --workspace=packages/backend
COPY packages/backend/ ./packages/backend/
COPY tsconfig.base.json ./
RUN npm run build --workspace=packages/backend
COPY --from=frontend-build /app/packages/frontend/dist ./packages/backend/dist/public

EXPOSE 3000

# To enable live Docker daemon scanning, mount the Docker socket:
#   docker run -v /var/run/docker.sock:/var/run/docker.sock -p 3000:3000 architest
CMD ["node", "packages/backend/dist/server.js"]
