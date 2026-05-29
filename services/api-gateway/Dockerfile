FROM node:20-alpine AS base
WORKDIR /workspace
RUN corepack enable

FROM base AS build
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY services/api-gateway ./services/api-gateway
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @eu-ai-act/api-gateway... build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /workspace /app
EXPOSE 4000
USER node
CMD ["node", "services/api-gateway/dist/index.js"]
