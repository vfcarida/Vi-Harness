# Build Stage
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies for native modules (e.g. better-sqlite3)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/

RUN npm run build

# Production Runtime Stage
FROM node:20-slim AS runtime

WORKDIR /app

# Install runtime dependencies (git for workspace tracking, ca-certificates)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist/ ./dist/
COPY README.md LICENSE CHANGELOG.md ./

# Link binary globally
RUN npm link

ENV NODE_ENV=production
ENV VI_HARNESS_MODE=headless

USER node

ENTRYPOINT ["vi-harness"]
CMD ["--help"]
