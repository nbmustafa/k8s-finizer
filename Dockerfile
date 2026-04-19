# ==================== DEPENDENCIES STAGE ====================
FROM node:20-alpine AS deps
WORKDIR /app

# Copy only package files first (maximizes Docker layer cache)
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json

# Use ci for exact, reproducible install (includes dev deps needed for build)
RUN npm ci

# ==================== BUILD STAGE ====================
FROM deps AS build
WORKDIR /app

# Copy source (now that deps are cached)
COPY . .
RUN npm run build --workspace frontend

# ==================== RUNTIME STAGE (this is what gets deployed) ====================
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

# Copy only package files again (for production install)
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json

# Install ONLY backend production dependencies
# --workspace=backend skips frontend deps (React etc.) → huge size win
RUN npm ci --omit=dev --workspace=backend && \
    npm cache clean --force

# Copy built frontend (static files only) + backend source
COPY --from=build /app/frontend/dist ./frontend/dist
COPY backend ./backend

EXPOSE 8080
CMD ["npm", "run", "start", "--workspace", "backend"]
