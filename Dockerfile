# =====================================================================
# Intelligent Cognitive Alarm Platform - Frontend Production Dockerfile
# Multi-stage build: Node.js 20 Alpine -> Nginx Alpine
# =====================================================================

# STAGE 1: Vite Build Stage
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build production bundle with optimized Vite chunks
RUN npm run build


# STAGE 2: Nginx Web Server Runtime
FROM nginx:alpine AS runtime

# Remove default nginx configuration and public html
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# Health check probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
