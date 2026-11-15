# syntax=docker/dockerfile:1
# cwenda: one image with the Express backend, the built React app, and mcv-cli.
# Build from the repo root: docker build -t cwenda .

# ---------- Stage 1: build the React app ----------
FROM node:24-slim AS web
WORKDIR /app/web
# lockfile first: this layer stays cached until dependencies change
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ---------- Stage 2: the app ----------
FROM node:24-slim
# git: uv installs mcv-cli from GitHub
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:0.13.5 /uv /uvx /usr/local/bin/

# run as the image's built-in non-root user; pre-create dirs so they're owned by it
RUN mkdir -p /app/backend /app/web && chown -R node:node /app
USER node
ENV PATH="/home/node/.local/bin:$PATH"

# mcv-cli pinned to a commit so rebuilds don't change under you; uv downloads Python 3.12 itself.
# The config dir becomes a volume (the MCV login); it must exist so it's owned by `node`.
ARG MCV_REF=9feded5c1308e2195a269c7d8e88cc95aa3c883b
RUN uv tool install --python 3.12 \
      --with "git+https://github.com/Okumans/mcv-cli.git@${MCV_REF}#subdirectory=packages/mcv-api" \
      "git+https://github.com/Okumans/mcv-cli.git@${MCV_REF}" \
 && mkdir -p /home/node/.config/mcv

WORKDIR /app/backend
COPY --chown=node backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev
COPY --chown=node backend/ ./
# same layout as the repo, so index.ts finds ../../../web/dist
COPY --from=web --chown=node /app/web/dist /app/web/dist

ENV NODE_ENV=production
EXPOSE 8000
CMD ["npm", "start"]
