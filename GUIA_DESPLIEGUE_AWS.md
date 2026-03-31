# 🚀 GUÍA DE DESPLIEGUE A PRODUCCIÓN - AWS

**Proyecto:** Restaurant POS (FastAPI Backend + React Frontend)
**Destino:** AWS (EC2 + RDS + ECR)
**Fecha de creación:** 2026-03-30

---

## 📋 TABLA DE CONTENIDOS

1. [Requisitos Previos](#requisitos-previos)
2. [Configuración de Variables de Entorno](#configuración-de-variables-de-entorno)
3. [Instalación y Testing del Backend](#instalación-y-testing-del-backend)
4. [Instalación del Frontend](#instalación-del-frontend)
5. [Despliegue con Docker](#despliegue-con-docker)
6. [Despliegue en AWS](#despliegue-en-aws)
7. [Verificación y Monitoreo](#verificación-y-monitoreo)
8. [Checklist Final](#checklist-final)

---

## ✅ REQUISITOS PREVIOS

Antes de comenzar, asegúrate de tener instalado en tu máquina:

- **Docker & Docker Compose** (versión 20.10 o superior)
  ```bash
  docker --version
  docker-compose --version
  ```

- **Node.js 18+** (para frontend)
  ```bash
  node --version
  npm --version
  ```

- **Python 3.11+** (para backend)
  ```bash
  python3 --version
  ```

- **AWS CLI v2** configurado con tus credenciales
  ```bash
  aws --version
  aws configure  # Ingresa Access Key ID y Secret Access Key
  ```

- **Git** (control de versiones)
  ```bash
  git --version
  ```

---

## 🔐 CONFIGURACIÓN DE VARIABLES DE ENTORNO

### Paso 1: Revisar archivo .env.production

El archivo `.env.production` ya ha sido generado con valores seguros.

**Abre el archivo y revisa:**

```env
# Base de datos PostgreSQL
POSTGRES_USER=admin
POSTGRES_PASSWORD=TuContraseñaSegura123!@#  ← CAMBIA ESTO
POSTGRES_DB=restaurant_pos

# Backend FastAPI
SECRET_KEY=rIAo4DaSDxoLDBWg6PsO-wE0...  ← NO cambies (generada de forma segura)
DATABASE_URL=postgresql://admin:TuContraseña...@db:5432/restaurant_pos

# Frontend React
VITE_API_URL=https://tudominio.com  ← CAMBIA CON TU DOMINIO
```

### Paso 2: Completar valores para producción

**Sigue estos pasos:**

1. **POSTGRES_PASSWORD**: Genera una contraseña fuerte
   - Mínimo 16 caracteres
   - Incluye mayúsculas, minúsculas, números y símbolos
   - Ejemplo: `P@ssw0rd2024!Secure`

2. **DATABASE_URL**: Actualiza con tu contraseña
   - Ejemplo: `postgresql://admin:P@ssw0rd2024!Secure@db:5432/restaurant_pos`

3. **VITE_API_URL**: Reemplaza con tu dominio/IP
   - Opción 1 (dominio): `https://api.mirestaurante.com`
   - Opción 2 (IP elástica de EC2): `https://54.123.45.67`

### Paso 3: Copiar archivo .env

```bash
# Desde la raíz del proyecto
cp .env.production .env
```

⚠️ **IMPORTANTE:** El archivo `.env` NO debe commiterse a Git (ya está en `.gitignore`)

---

## 💻 INSTALACIÓN Y TESTING DEL BACKEND

### Paso 1: Crear ambiente virtual (recomendado)

```bash
# Crear venv
python3 -m venv venv

# Activar venv
source venv/bin/activate
# En Windows: venv\Scripts\activate
```

### Paso 2: Instalar dependencias

```bash
pip install -r requirements.txt
pip install pytest pytest-asyncio  # Para testing
```

### Paso 3: Ejecutar tests

```bash
python -m pytest tests/ -v
```

**Resultado esperado:**
```
tests/test_auth.py::test_login PASSED
tests/test_usuarios.py::test_create_usuario PASSED
tests/test_pedidos.py::test_create_pedido PASSED
tests/test_comprobantes.py::test_generate_comprobante PASSED

======================== 4 passed in 1.23s ========================
```

Si algún test falla, revisa los logs y ajusta la configuración.

### Paso 4: Verificar servidor localmente

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Abre en navegador: `http://localhost:8000/docs`

✓ Deberías ver la documentación automática de FastAPI

---

## 🎨 INSTALACIÓN DEL FRONTEND

### Paso 1: Navegar al directorio

```bash
cd frontend_react
```

### Paso 2: Instalar dependencias

```bash
npm install
```

### Paso 3: Ejecutar linting

```bash
npm run lint
```

Corrije cualquier error de eslint antes de continuar.

### Paso 4: Build de producción

```bash
npm run build
```

**Resultado:** Se crea carpeta `dist/` con archivos optimizados

### Paso 5: Verificar build

```bash
npm run preview
```

Abre en navegador: `http://localhost:4173`

---

## 🐳 DESPLIEGUE CON DOCKER

### Paso 1: Verificar estructura

Asegúrate de que existen estos archivos:

```
proyecto/
├── Dockerfile (backend)
├── docker-compose.yml
├── .env (creado en paso anterior)
├── requirements.txt
├── app/
├── frontend_react/
│   ├── Dockerfile
│   └── package.json
└── ...
```

### Paso 2: Construir imágenes Docker

```bash
# Desde la raíz del proyecto
docker-compose build
```

Este comando:
- Construye imagen del backend
- Construye imagen del frontend
- Construye imagen de PostgreSQL (descargada)

### Paso 3: Probar localmente

```bash
docker-compose up
```

**Verifica en navegador:**

- Backend: `http://localhost:8000`
- Frontend: `http://localhost` (puerto 80)
- Logs: Deberías ver "Application startup complete" para backend

**Para detener:**
```bash
docker-compose down
```

---

## 🚀 DESPLIEGUE EN AWS

### Opción A: Despliegue con ECS (recomendado)

#### Paso 1: Crear repositorio ECR

En AWS Console:
1. Abre **Elastic Container Registry (ECR)**
2. Click en **Create repository**
3. Nombre: `restaurant-backend`
4. Click Create

Repite para: `restaurant-frontend`

#### Paso 2: Obtener URI del repositorio

En ECR, nota la URI de cada repositorio:
```
ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/restaurant-backend
ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/restaurant-frontend
```

#### Paso 3: Autenticarse con ECR

Reemplaza `REGION` y `ACCOUNT_ID`:

```bash
aws ecr get-login-password --region REGION \
  | docker login --username AWS --password-stdin \
  ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com
```

#### Paso 4: Taggear imágenes

```bash
# Backend
docker tag restaurant_backend:latest \
  ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/restaurant-backend:latest

# Frontend
docker tag restaurant_backend-frontend:latest \
  ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/restaurant-frontend:latest
```

#### Paso 5: Push a ECR

```bash
# Backend
docker push ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/restaurant-backend:latest

# Frontend
docker push ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/restaurant-frontend:latest
```

#### Paso 6: Crear clúster ECS

En AWS Console:
1. Abre **Elastic Container Service (ECS)**
2. Click **Clusters** → **Create cluster**
3. Nombre: `restaurant-cluster`
4. Infrastructure: EC2 (o Fargate si prefieres serverless)
5. Click Create

#### Paso 7: Crear task definition

1. Click **Task definitions** → **Create new task definition**
2. Family: `restaurant-backend-task`
3. Container name: `restaurant-backend`
4. Image: `ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/restaurant-backend:latest`
5. Port: `8000`
6. Environment variables: Copia desde `.env`
7. Click Create

Repite para frontend en puerto `80`

#### Paso 8: Crear servicio

1. En tu cluster, click **Services** → **Create service**
2. Task definition: `restaurant-backend-task`
3. Desired count: `1` (aumentar según carga)
4. Load balancer: Application Load Balancer
5. Configure...

### Opción B: Despliegue con EC2 (más simple)

#### Paso 1: Lanzar instancia EC2

1. En AWS Console → **EC2** → **Instances** → **Launch Instance**
2. AMI: Ubuntu 24.04 LTS
3. Instance type: `t3.medium` (mínimo recomendado)
4. Storage: 30 GB
5. Security group: Abre puertos:
   - 22 (SSH)
   - 80 (HTTP)
   - 443 (HTTPS)
   - 8000 (Backend si es necesario)

#### Paso 2: Conectar a instancia

```bash
ssh -i mi-clave.pem ubuntu@IP_PUBLICA
```

#### Paso 3: Instalar Docker en EC2

```bash
sudo apt update
sudo apt install -y docker.io docker-compose
sudo usermod -aG docker $USER
```

#### Paso 4: Clonar proyecto

```bash
git clone https://github.com/miusuario/restaurant-pos.git
cd restaurant-pos
```

#### Paso 5: Configurar .env

```bash
# Copia archivo .env a la instancia (o créalo con cat)
nano .env
# Pega el contenido de .env.production y actualiza valores
```

#### Paso 6: Ejecutar docker-compose

```bash
docker-compose up -d
```

Verifica:
```bash
docker-compose logs -f
```

---

## 🔍 VERIFICACIÓN Y MONITOREO

### Verificar Backend

```bash
curl http://localhost:8000/health
# Debería retornar: {"status": "healthy"}
```

### Verificar Frontend

```bash
curl http://localhost
# Debería retornar HTML del React app
```

### Monitoreo en AWS CloudWatch

1. Abre **CloudWatch** → **Logs**
2. Busca tu grupo de logs (`/ecs/restaurant-backend`)
3. Revisa errores en logs

### Escalar según demanda

En ECS, aumenta "Desired count" de tareas según tráfico.

---

## ✅ CHECKLIST FINAL

Antes de considerar producción lista:

- [ ] Archivo `.env.production` completado y seguro
- [ ] Tests del backend ejecutados y pasados
- [ ] Frontend lint y build sin errores
- [ ] Docker-compose probado localmente
- [ ] Imágenes Docker subidas a ECR
- [ ] ECS cluster o EC2 configurado y corriendo
- [ ] RDS PostgreSQL accesible (si no usas Docker)
- [ ] Security groups de AWS configurados
- [ ] Certificado SSL/TLS (ACM) instalado
- [ ] Domain/DNS apuntando a Load Balancer
- [ ] CloudWatch logs monitoreados
- [ ] Backups automáticos configurados
- [ ] Pruebas end-to-end en producción realizadas

---

## ⚠️ NOTAS IMPORTANTES

1. **Seguridad:**
   - Nunca commits `.env` a Git
   - Guarda secretos en AWS Secrets Manager
   - Usa https:// siempre en producción
   - Configura security groups restrictivos

2. **Performance:**
   - Usa CDN (CloudFront) para frontend
   - Enable caching en API responses
   - Monitor performance en CloudWatch

3. **Mantenimiento:**
   - Realiza backups regulares de DB
   - Monitorea logs regularmente
   - Actualiza dependencias mensualmente
   - Prueba disaster recovery

4. **Costos:**
   - Estima costos en AWS Calculator
   - Usa Reserved Instances para ahorrar
   - Configura alerts para gastos altos

---

## 📞 SOPORTE Y RECURSOS

- FastAPI Docs: https://fastapi.tiangolo.com/
- React Docs: https://react.dev/
- AWS ECR: https://docs.aws.amazon.com/ecr/
- AWS ECS: https://docs.aws.amazon.com/ecs/
- Docker Compose: https://docs.docker.com/compose/

---

**Última actualización:** 2026-03-30
**Versión del Proyecto:** 1.0
**Status:** 🟢 Listo para Producción
