FROM node:22-alpine AS deps
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/web/package.json apps/web/package.json
COPY packages/sdk/package.json packages/sdk/package.json
RUN pnpm install --frozen-lockfile || pnpm install

FROM node:22-alpine AS builder
WORKDIR /repo
RUN corepack enable
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /repo/packages/sdk/node_modules ./packages/sdk/node_modules
COPY . .
RUN pnpm --filter promptimizer build && pnpm --filter @promptimizer/web build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN adduser -D -g "" promptimizer
COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /repo/apps/web/public ./apps/web/public
USER promptimizer
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
