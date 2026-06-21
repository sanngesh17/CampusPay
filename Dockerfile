FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/rails/package.json packages/rails/package.json
COPY packages/xrpl/package.json packages/xrpl/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm -r build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=3000 XRPL_ENABLED=false PERSISTENCE=memory
COPY --from=build /app /app
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
