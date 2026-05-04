FROM node:20-alpine AS base
WORKDIR /workspace
RUN corepack enable

FROM base AS build
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY services/classification-engine ./services/classification-engine
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @eu-ai-act/classification-engine... build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /workspace /app
EXPOSE 4001
USER node
CMD ["node", "services/classification-engine/dist/index.js"]
