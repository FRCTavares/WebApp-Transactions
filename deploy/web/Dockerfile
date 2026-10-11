# Self-hosted web image: the built SPA served by Caddy, which also proxies
# /api to the backend container. Build context: the repository root.
#
#   docker build -f deploy/web/Dockerfile \
#     --build-arg VITE_API_BASE_URL=https://finance.<tailnet>.ts.net \
#     --build-arg VITE_GOOGLE_CLIENT_ID=<id>.apps.googleusercontent.com .
#
# The API origin and client id are baked into the bundle at build time.
FROM node:24-bookworm-slim AS build
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./

ARG VITE_API_BASE_URL
ARG VITE_GOOGLE_CLIENT_ID
ARG GIT_COMMIT=unknown
RUN test -n "$VITE_API_BASE_URL" && test -n "$VITE_GOOGLE_CLIENT_ID"
ENV VITE_AUTH_MODE=google \
    VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    APP_GIT_COMMIT=$GIT_COMMIT
RUN npm run build

FROM caddy:2.10-alpine
ARG GIT_COMMIT=unknown
LABEL org.opencontainers.image.revision="${GIT_COMMIT}"
COPY deploy/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /build/frontend/dist /srv
# The official binary carries a file capability (cap_net_bind_service); a container that drops ALL
# capabilities cannot exec it. A plain copy carries none, and we listen on the unprivileged 8080.
RUN cp /usr/bin/caddy /usr/local/bin/caddy && chmod 0755 /usr/local/bin/caddy
RUN /usr/local/bin/caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
USER 65534:65534
EXPOSE 8080
CMD ["/usr/local/bin/caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
