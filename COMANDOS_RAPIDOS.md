# ⚡ COMANDOS RÁPIDOS - DEPLOYMENT REFERENCE

## 🚀 INICIO RÁPIDO

```bash
# Ejecutar script automatizado (recomendado)
./deploy.sh

# O hacer todo manualmente paso a paso
```

---

## 🔐 VARIABLES DE ENTORNO

```bash
# Copiar archivo template
cp .env.production .env

# Editar variables
nano .env

# Verificar variables (NO ejecutar en prod, solo desarrollo)
cat .env
```

---

## 💻 BACKEND (FastAPI)

### Instalación
```bash
python3 -m venv venv
source venv/bin/activate  # Mac/Linux
venv\Scripts\activate     # Windows

pip install -r requirements.txt
```

### Testing
```bash
# Instalar pytest
pip install pytest pytest-asyncio

# Ejecutar tests
python -m pytest tests/ -v

# Tests específico
python -m pytest tests/test_auth.py -v
```

### Ejecutar servidor
```bash
# Development (con reload)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Production
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Ver documentación API
```
http://localhost:8000/docs
```

---

## 🎨 FRONTEND (React + Vite)

### Instalación
```bash
cd frontend_react
npm install
```

### Development
```bash
npm run dev
# Abre http://localhost:5173
```

### Linting
```bash
npm run lint
npm run lint -- --fix  # Auto-fix problemas
```

### Build para producción
```bash
npm run build
# Output: dist/
```

### Preview del build
```bash
npm run preview
# Abre http://localhost:4173
```

---

## 🐳 DOCKER

### Build
```bash
# Build todas las imágenes
docker-compose build

# Build específica
docker-compose build backend
docker-compose build frontend
```

### Ejecutar
```bash
# Ejecutar en foreground (ver logs)
docker-compose up

# Ejecutar en background
docker-compose up -d

# Ver logs
docker-compose logs -f
docker-compose logs backend  # Solo backend
```

### Detener
```bash
# Detener servicios
docker-compose down

# Detener y eliminar volúmenes (⚠️ PERDERÁS DATOS)
docker-compose down -v
```

### Debugging
```bash
# Acceder a contenedor
docker exec -it restaurant_backend bash

# Ver procesos
docker-compose ps

# Inspeccionar contenedor
docker inspect restaurant_backend

# Limpiar imagenes/contenedores no usados
docker system prune
```

---

## 🚀 AWS - PREPARACIÓN

### Credenciales
```bash
# Configurar AWS CLI
aws configure

# Verificar credenciales
aws sts get-caller-identity
```

### ECR (Elastic Container Registry)

#### Crear repositorio
```bash
aws ecr create-repository --repository-name restaurant-backend --region us-east-1
aws ecr create-repository --repository-name restaurant-frontend --region us-east-1
```

#### Login a ECR
```bash
aws ecr get-login-password --region REGION | docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com
```

#### Taggear imagenes
```bash
ACCOUNT_ID=123456789012
REGION=us-east-1

# Backend
docker tag restaurant_backend:latest $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/restaurant-backend:latest

# Frontend
docker tag restaurant_backend-frontend:latest $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/restaurant-frontend:latest
```

#### Push a ECR
```bash
ACCOUNT_ID=123456789012
REGION=us-east-1

# Backend
docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/restaurant-backend:latest

# Frontend
docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/restaurant-frontend:latest
```

### EC2 (Elastic Compute Cloud)

#### SSH a instancia
```bash
ssh -i mi-clave.pem ec2-user@IP_INSTANCIA
ssh -i mi-clave.pem ubuntu@IP_INSTANCIA
```

#### Instalar Docker en EC2
```bash
# Ubuntu
sudo apt update
sudo apt install -y docker.io docker-compose
sudo usermod -aG docker $USER

# Amazon Linux
sudo yum update -y
sudo yum install -y docker
sudo service docker start
sudo usermod -aG docker $USER
```

#### Clonar y ejecutar proyecto
```bash
git clone https://github.com/mi-usuario/restaurant-pos.git
cd restaurant-pos

# Crear .env
nano .env

# Ejecutar
docker-compose up -d

# Ver logs
docker-compose logs -f
```

---

## 📊 MONITOREO

### Verificar servicios
```bash
# Backend health
curl http://localhost:8000/health

# Frontend
curl http://localhost

# En AWS (reemplaza IP)
curl http://54.123.45.67/health
```

### Logs
```bash
# Docker local
docker-compose logs backend

# AWS CloudWatch
aws logs get-log-events \
  --log-group-name /ecs/restaurant-backend \
  --log-stream-name ecs/restaurant-backend/ID

# AWS ECS
aws ecs describe-tasks --cluster restaurant-cluster --tasks TASK_ARN

# AWS EC2
ssh -i clave.pem ubuntu@IP
docker-compose logs -f
```

---

## 🔄 DESPLEGAR CAMBIOS

### Actualizar código
```bash
# Pull cambios
git pull origin main

# Rebuild imagenes
docker-compose build

# Reiniciar servicios
docker-compose down
docker-compose up -d
```

### En AWS ECR
```bash
# Rebuild local
docker-compose build

# Push nueva version
docker tag restaurant_backend:latest $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/restaurant-backend:latest
docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/restaurant-backend:latest

# En ECS: actualizar task definition y servicio
# En EC2: git pull && docker-compose build && docker-compose down && docker-compose up -d
```

---

## 🆘 TROUBLESHOOTING

### Backend no responde
```bash
# Verificar logs
docker-compose logs backend

# Revisar puerto
lsof -i :8000

# Verificar conexión a DB
docker-compose logs db
```

### Frontend no carga
```bash
# Verificar API URL en .env
echo $VITE_API_URL

# Verificar logs
docker-compose logs frontend

# Limpiar cache
npm run build
docker-compose rebuild frontend
```

### Base de datos
```bash
# Conectar a PostgreSQL
docker-compose exec db psql -U admin -d restaurant_pos

# Ver tablas
\dt

# Ver logs
docker-compose logs db
```

### Permisos en EC2
```bash
# Dar permisos Docker al usuario
sudo usermod -aG docker $USER
newgrp docker
```

---

## 📝 VARIABLES DE ENTORNO IMPORTANTE

```bash
# Backend
DATABASE_URL=postgresql://user:password@host:5432/database
SECRET_KEY=clave-segura-de-64-caracteres

# Frontend
VITE_API_URL=https://api.midominio.com

# Docker
POSTGRES_USER=admin
POSTGRES_PASSWORD=password-fuerte
POSTGRES_DB=restaurant_pos
```

---

## ✅ CHECKLIST PRE-PRODUCCIÓN

- [ ] .env.production completado
- [ ] Tests: `pytest` pasados
- [ ] Frontend: `npm run lint` sin errores
- [ ] Docker: `docker-compose up` sin errores
- [ ] Backend responde: `curl localhost:8000/health`
- [ ] Frontend carga: `curl localhost`
- [ ] Imágenes en ECR
- [ ] Security groups en AWS abiertos (80, 443, 22)
- [ ] RDS o DB de Docker funcionando
- [ ] Certificado SSL/TLS configurado
- [ ] Monitoreo en CloudWatch activado
- [ ] Backups automáticos configurados

---

## 🎯 FLUJO TÍPICO DE DESARROLLO

```bash
# 1. Cambios locales
git checkout -b feature/mi-feature
# ... hacer cambios ...
git add .
git commit -m "feat: descripcion"
git push origin feature/mi-feature

# 2. Pull request y merge a main

# 3. Desplegar cambios
git pull origin main
docker-compose build
docker-compose down
docker-compose up -d

# 4. En AWS (ECR + ECS)
docker tag ... $ECR_URI:latest
docker push $ECR_URI:latest
# Actualizar task definition en ECS
```

---

**Última actualización:** 2026-03-30
**Para más detalles:** Ver GUIA_DESPLIEGUE_AWS.md
