FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm install

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build --workspace frontend

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm install --omit=dev
COPY --from=build /app/frontend/dist ./frontend/dist
COPY backend ./backend
EXPOSE 8080
CMD ["npm", "run", "start", "--workspace", "backend"]
