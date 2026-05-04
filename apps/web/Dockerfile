FROM node:20-alpine AS base
WORKDIR /workspace
RUN corepack enable

FROM base AS build
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @eu-ai-act/web... build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /workspace /app
EXPOSE 3000
USER node
CMD ["pnpm", "--filter", "@eu-ai-act/web", "start"]
