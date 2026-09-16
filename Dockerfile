# Panel runtime
FROM node:20-alpine AS base
WORKDIR /app
COPY backend/package*.json backend/
RUN npm install --omit=dev --prefix backend
COPY backend/src/ backend/src/

# Frontend production build, served by the panel
FROM node:20-alpine AS frontend
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npx vite build --mode production

# Final panel image
FROM node:20-alpine AS panel
WORKDIR /app
COPY --from=base /app /app
COPY --from=frontend /app/dist /app/public
COPY --from=frontend /app/dist/index.html /app/public/index.html
EXPOSE 3000
CMD ["node", "src/index.js"]
