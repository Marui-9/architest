# Stage 1: Build frontend# Stage 1: Build frontend

























CMD ["node", "packages/backend/dist/server.js"]EXPOSE 3000COPY --from=frontend-build /app/packages/frontend/dist ./packages/backend/dist/publicRUN npm run build --workspace=packages/backendCOPY tsconfig.base.json ./COPY packages/backend/ ./packages/backend/RUN npm ci --workspace=packages/backend --productionCOPY packages/backend/package.json ./packages/backend/COPY package.json package-lock.json ./WORKDIR /app    apt-get clean && rm -rf /var/lib/apt/lists/*    npx playwright install --with-deps chromium && \RUN apt-get update && \FROM node:22-slim# Stage 2: ProductionRUN npm run build --workspace=packages/frontendCOPY tsconfig.base.json ./COPY packages/frontend/ ./packages/frontend/RUN npm ci --workspace=packages/frontendCOPY packages/frontend/package.json ./packages/frontend/COPY package.json package-lock.json ./WORKDIR /appFROM node:22-slim AS frontend-buildFROM node:22-slim AS frontend-build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/frontend/package.json ./packages/frontend/
RUN npm ci --workspace=packages/frontend
COPY packages/frontend/ ./packages/frontend/
COPY tsconfig.base.json ./
RUN npm run build --workspace=packages/frontend

# Stage 2: Production
FROM node:22-slim
RUN npx playwright install --with-deps chromium && \
    rm -rf /var/lib/apt/lists/* /tmp/* /root/.cache
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/backend/package.json ./packages/backend/
RUN npm ci --workspace=packages/backend --omit=dev
COPY packages/backend/ ./packages/backend/
COPY tsconfig.base.json ./
RUN npm run build --workspace=packages/backend
COPY --from=frontend-build /app/packages/frontend/dist ./packages/backend/dist/public
EXPOSE 3000
CMD ["node", "packages/backend/dist/server.js"]
