# ── Stage 1: Build React ─────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --silent

COPY . .

# La URL del backend se inyecta en build time
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ── Stage 2: Servir con nginx ────────────────────────────────────
FROM nginx:alpine

# Configuración de nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Build output
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
