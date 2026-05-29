# ─── Stage 1: Build (cần devDependencies để compile TypeScript) ─────────────
FROM node:20-alpine AS builder
WORKDIR /app/chat-service
COPY ./chat-service/package*.json ./
COPY ./chat-service/tsconfig.json ./
RUN npm ci
WORKDIR /app
COPY ./chat-service/src ./chat-service/src
COPY ./shared ./shared
WORKDIR /app/chat-service
RUN npm run build

# ─── Stage 2: Runtime (chỉ production dependencies) ─────────────────────────
FROM node:20-alpine
WORKDIR /app
COPY ./chat-service/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/chat-service/dist ./dist
EXPOSE 3003
CMD ["node", "dist/chat-service/src/main.js"]
