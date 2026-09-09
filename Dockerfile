# Zoreon — self-hosted Node (podman / systemd lab)
# Build: NITRO_PRESET=node-server so Nitro emits .output/server (not Vercel).

FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
# Prefer lockfile; fall back to install if host/npm and image npm disagree.
RUN npm ci || npm install

COPY . .
ENV NITRO_PRESET=node-server
ENV NODE_ENV=production
# Build without Neon — PGLite/migrations bootstrap at runtime when needed.
RUN npm run build \
  && cp node_modules/@electric-sql/pglite/dist/pglite.data \
        node_modules/@electric-sql/pglite/dist/pglite.wasm \
        .output/server/_libs/

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080
ENV NITRO_PRESET=node-server

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.output ./.output
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/.grok/app-env.json ./.grok/app-env.json

RUN chmod +x /app/scripts/docker-entrypoint.sh

EXPOSE 8080
USER node
ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
