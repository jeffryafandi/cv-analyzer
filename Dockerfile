# Multi-stage Dockerfile for CV Analyzer
# Supports both backend API and worker processes

FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build stage
FROM base AS build
RUN bun run build

# Production stage for backend
FROM base AS backend
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]

# Production stage for worker
FROM base AS worker
COPY --from=build /app/dist ./dist
CMD ["bun", "run", "src/worker.ts"]

