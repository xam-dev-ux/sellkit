FROM node:20-alpine
WORKDIR /app

# Copy monorepo root manifests
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/agent/package.json ./packages/agent/package.json

RUN npm ci

# Copy source
COPY packages/shared ./packages/shared
COPY packages/agent ./packages/agent

# Build shared then agent
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/agent

EXPOSE 3001

CMD ["node", "packages/agent/dist/index.js"]
