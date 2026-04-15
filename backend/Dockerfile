# ── Stage 1: dependencies ─────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# ── Stage 2: production image ─────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy installed deps and source
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Remove dev/local files that shouldn't be in the image
RUN rm -f .env .env.local

RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 5001

CMD ["node", "server.js"]
