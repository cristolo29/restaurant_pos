#!/bin/bash

# 🚀 SCRIPT DE DESPLIEGUE AUTOMATIZADO - RESTAURANT POS
# Este script automatiza los pasos iniciales de despliegue

set -e  # Detener en caso de error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funciones helper
print_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Verificar requisitos
check_requirements() {
    print_header "VERIFICANDO REQUISITOS"

    # Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker no está instalado"
        exit 1
    fi
    print_success "Docker instalado: $(docker --version)"

    # Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose no está instalado"
        exit 1
    fi
    print_success "Docker Compose instalado: $(docker-compose --version)"

    # Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js no está instalado"
        exit 1
    fi
    print_success "Node.js instalado: $(node --version)"

    # Python
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 no está instalado"
        exit 1
    fi
    print_success "Python 3 instalado: $(python3 --version)"
}

# Configurar .env
setup_env() {
    print_header "CONFIGURANDO VARIABLES DE ENTORNO"

    if [ ! -f .env.production ]; then
        print_error ".env.production no encontrado"
        exit 1
    fi

    if [ ! -f .env ]; then
        print_warning "Archivo .env no existe, copiando desde .env.production"
        cp .env.production .env
        print_success "Archivo .env creado"
        print_warning "⚠️  POR FAVOR: Edita .env y completa los valores siguientes:"
        echo "    - POSTGRES_PASSWORD (contraseña fuerte, 16+ caracteres)"
        echo "    - VITE_API_URL (tu dominio o IP pública)"
        echo ""
        read -p "¿Presiona enter cuando hayas completado el archivo .env..."
    else
        print_success ".env ya existe"
    fi

    # Verificar que .env tiene valores reales
    if grep -q "TuContraseña\|tudominio" .env; then
        print_error ".env aún tiene placeholders"
        print_error "Por favor edita .env y reemplaza los valores placeholder"
        exit 1
    fi
}

# Instalar backend
install_backend() {
    print_header "INSTALANDO BACKEND"

    # Crear venv si no existe
    if [ ! -d "venv" ]; then
        print_warning "Creando ambiente virtual..."
        python3 -m venv venv
        print_success "Ambiente virtual creado"
    fi

    # Activar venv
    source venv/bin/activate

    # Instalar dependencias
    print_warning "Instalando dependencias (esto puede tomar un minuto)..."
    pip install -r requirements.txt > /dev/null 2>&1
    print_success "Dependencias instaladas"
}

# Ejecutar tests backend
test_backend() {
    print_header "EJECUTANDO TESTS DEL BACKEND"

    source venv/bin/activate

    # Instalar pytest si no está
    pip install pytest pytest-asyncio > /dev/null 2>&1

    print_warning "Ejecutando pytest..."
    if python -m pytest tests/ -v; then
        print_success "Todos los tests pasaron"
    else
        print_error "Algunos tests fallaron"
        exit 1
    fi
}

# Instalar frontend
install_frontend() {
    print_header "INSTALANDO FRONTEND"

    cd frontend_react

    if [ -d "node_modules" ]; then
        print_warning "node_modules ya existe, saltando npm install"
    else
        print_warning "Instalando dependencias (esto puede tomar un minuto)..."
        npm install > /dev/null 2>&1
        print_success "Dependencias instaladas"
    fi

    print_warning "Ejecutando linting..."
    if npm run lint; then
        print_success "Linting completado"
    else
        print_error "Hay errores de linting"
        print_warning "Intenta corregirlos manualmente"
    fi

    print_warning "Construyendo proyecto..."
    npm run build > /dev/null 2>&1
    print_success "Build completado"

    cd ..
}

# Construir Docker
build_docker() {
    print_header "CONSTRUYENDO IMÁGENES DOCKER"

    print_warning "Esto puede tomar algunos minutos..."
    docker-compose build

    print_success "Imágenes Docker construidas"
}

# Probar localmente
test_docker() {
    print_header "PROBANDO DOCKER LOCALMENTE"

    print_warning "Iniciando servicios..."
    docker-compose up -d

    print_warning "Esperando que los servicios se inicien (10 segundos)..."
    sleep 10

    # Verificar backend
    if curl -s http://localhost:8000/health > /dev/null; then
        print_success "Backend está respondiendo"
    else
        print_error "Backend no responde"
        print_warning "Logs:"
        docker-compose logs backend
    fi

    # Verificar frontend
    if curl -s http://localhost > /dev/null; then
        print_success "Frontend está respondiendo"
    else
        print_error "Frontend no responde"
        print_warning "Logs:"
        docker-compose logs frontend
    fi

    print_warning "Deteniendo servicios..."
    docker-compose down

    print_success "Test completado"
}

# Menu principal
main() {
    print_header "🚀 SCRIPT DE DESPLIEGUE - RESTAURANT POS"

    echo "Selecciona qué deseas hacer:"
    echo "1) Verificar todos los requisitos"
    echo "2) Configurar variables de entorno (.env)"
    echo "3) Instalar y testear backend"
    echo "4) Instalar frontend"
    echo "5) Construir imágenes Docker"
    echo "6) Probar todo localmente con Docker"
    echo "7) EJECUTAR TODO (1-6)"
    echo ""

    read -p "Opción (1-7): " option

    case $option in
        1)
            check_requirements
            ;;
        2)
            setup_env
            ;;
        3)
            install_backend
            test_backend
            ;;
        4)
            install_frontend
            ;;
        5)
            build_docker
            ;;
        6)
            test_docker
            ;;
        7)
            check_requirements
            setup_env
            install_backend
            test_backend
            install_frontend
            build_docker
            test_docker
            print_header "✓ ¡DESPLIEGUE COMPLETADO!"
            echo "Tu proyecto está listo para producción."
            echo ""
            echo "Próximos pasos:"
            echo "1) Lee GUIA_DESPLIEGUE_AWS.md para instrucciones de AWS"
            echo "2) Crea repositorios en AWS ECR"
            echo "3) Sube las imágenes Docker a ECR"
            echo "4) Configura ECS o EC2 en AWS"
            echo ""
            ;;
        *)
            print_error "Opción inválida"
            exit 1
            ;;
    esac
}

# Ejecutar main
main
