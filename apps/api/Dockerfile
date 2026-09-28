FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci
COPY packages/contracts packages/contracts
COPY apps/api apps/api
WORKDIR /app/apps/api
ENV DATABASE_URL="postgresql://pantry:pantry@postgres:5432/smart_pantry?schema=public"
RUN npx prisma generate
WORKDIR /app
RUN npm run build -w @smart-pantry/contracts \
  && npm run build -w @smart-pantry/api
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
