# CerebroKognit web — production bundle served by nginx (Phase 9).
# Stage 1 builds the Vite app (VITE_API_URL baked in at build time);
# stage 2 serves dist/ as static files with SPA fallback. No dev server,
# no source maps, no node runtime in the final image.
ARG VITE_API_URL=http://localhost:8000

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
