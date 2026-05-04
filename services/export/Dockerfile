# Headless Chromium for PDF generation (Puppeteer).
FROM node:20-bookworm-slim AS base
WORKDIR /workspace
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium fonts-liberation libnss3 libxss1 ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
RUN corepack enable

FROM base AS build
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY services/export ./services/export
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @eu-ai-act/export... build

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /workspace /app
EXPOSE 4008
USER node
CMD ["node", "services/export/dist/index.js"]
