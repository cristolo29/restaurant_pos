# ── Stage 1: Build React ─────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --silent

COPY . .

# Vacío = mismo origen (nginx hace proxy de /api al backend)
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL

# Datos del emisor del comprobante (opcionales; ver .env.example)
ARG VITE_EMISOR_NOMBRE=
ARG VITE_EMISOR_RUC=
ARG VITE_EMISOR_DIRECCION=
ARG VITE_EMISOR_TELEFONO=
ARG VITE_EMISOR_LOGO=
ARG VITE_COMPROBANTE_LEYENDA=
ENV VITE_EMISOR_NOMBRE=$VITE_EMISOR_NOMBRE \
    VITE_EMISOR_RUC=$VITE_EMISOR_RUC \
    VITE_EMISOR_DIRECCION=$VITE_EMISOR_DIRECCION \
    VITE_EMISOR_TELEFONO=$VITE_EMISOR_TELEFONO \
    VITE_EMISOR_LOGO=$VITE_EMISOR_LOGO \
    VITE_COMPROBANTE_LEYENDA=$VITE_COMPROBANTE_LEYENDA

RUN npm run build

# ── Stage 2: Servir con nginx ────────────────────────────────────
FROM nginx:alpine

# Configuración de nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Build output
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
