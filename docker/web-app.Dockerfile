# Web application image.
#
# Two workspaces are built from this one file. The seller dashboard is a static Vite
# bundle, served by whatever fronts it; the storefront is a Next.js server, and the
# runtime stage below is what serves it.
#
# The build never leaves this repository: no Core checkout, no sibling workspace, no
# artifact downloaded from another repository (ADR-017). Secrets are never baked in;
# every value the storefront needs is supplied at runtime.

FROM node:24-alpine AS build

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /src
COPY package.json package-lock.json ./
COPY web/seller/package.json web/seller/package.json
COPY web/storefront/package.json web/storefront/package.json
RUN npm ci

COPY web ./web
COPY scripts ./scripts

ARG WORKSPACE=@commerce/seller-web
RUN npm run build --workspace ${WORKSPACE}

# Storefront runtime.
#
# `output: "standalone"` produces a self-contained server plus exactly the dependencies
# it traced, so this stage installs nothing and carries no source tree. It is only used
# when the image is built for the storefront workspace; the seller dashboard is a static
# bundle and stops at the build stage above.
FROM node:24-alpine AS storefront

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

WORKDIR /app

# The traced server bundle, then the client assets it serves. Static assets live outside
# the traced output and have to be copied separately.
COPY --from=build --chown=node:node /src/web/storefront/.next/standalone ./
COPY --from=build --chown=node:node /src/web/storefront/.next/static ./web/storefront/.next/static

# node:alpine ships an unprivileged `node` user. Nothing in the runtime writes to disk.
USER node

EXPOSE 3000

# STOREFRONT_API_BASE_URL is required at runtime: it is the private address of
# storefront-api. It is never a public URL, never baked into a layer, and never exposed
# to the browser.
CMD ["node", "web/storefront/server.js"]
