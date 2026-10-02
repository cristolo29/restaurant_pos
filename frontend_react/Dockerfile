# ── Stage 1: Build React ─────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --silent

COPY . .

# Vacío = mismo origen (nginx hace proxy de /api al backend)
ARG VITE_API_URL=
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
