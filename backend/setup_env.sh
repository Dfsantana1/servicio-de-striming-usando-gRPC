#!/bin/bash
# Script para configurar el entorno correctamente

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Verificando entorno...${NC}"

# Verificar versión de Python
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}' | cut -d. -f1,2)
PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)

echo -e "   Python detectado: ${PYTHON_VERSION}"

# Python 3.14 puede tener problemas, sugerir 3.12
if [ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -ge 14 ]; then
    echo -e "${YELLOW}⚠️  Python 3.14 detectado. Puede tener problemas de compatibilidad.${NC}"
    echo -e "${BLUE}💡 Recomendación: Usar Python 3.12${NC}"
    echo ""
    echo -e "   Para instalar Python 3.12:"
    echo -e "   ${GREEN}brew install python@3.12${NC}"
    echo ""
    echo -e "   Luego crear venv con:"
    echo -e "   ${GREEN}python3.12 -m venv venv${NC}"
    echo ""
    read -p "¿Continuar con Python 3.14 de todas formas? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}❌ Cancelado. Por favor instala Python 3.12.${NC}"
        exit 1
    fi
fi

# Crear venv si no existe
if [ ! -d "venv" ]; then
    echo -e "${BLUE}📦 Creando entorno virtual...${NC}"
    python3 -m venv venv
fi

# Activar venv
echo -e "${BLUE}🔌 Activando entorno virtual...${NC}"
source venv/bin/activate

# Actualizar pip, setuptools, wheel
echo -e "${BLUE}⬆️  Actualizando herramientas de construcción...${NC}"
pip install --upgrade pip setuptools wheel --quiet

# Intentar instalar grpcio primero (versión más reciente)
echo -e "${BLUE}📦 Instalando grpcio (puede tardar)...${NC}"
if pip install --upgrade grpcio grpcio-tools 2>&1 | grep -q "ERROR"; then
    echo -e "${YELLOW}⚠️  Error instalando grpcio. Intentando con versión específica...${NC}"
    pip install grpcio==1.63.0 grpcio-tools==1.63.0 || {
        echo -e "${RED}❌ Error instalando grpcio.${NC}"
        echo -e "${YELLOW}💡 Soluciones:${NC}"
        echo -e "   1. Instalar Python 3.12: ${GREEN}brew install python@3.12${NC}"
        echo -e "   2. Instalar dependencias del sistema: ${GREEN}xcode-select --install${NC}"
        exit 1
    }
fi

# Instalar resto de dependencias
echo -e "${BLUE}📦 Instalando otras dependencias...${NC}"
pip install -r requirements.txt

# Regenerar protobuf
echo -e "${BLUE}🔧 Regenerando stubs de protobuf...${NC}"
python -m grpc_tools.protoc -I proto --python_out=app --grpc_python_out=app proto/metrics.proto

echo -e "${GREEN}✅ Entorno configurado correctamente!${NC}"
echo ""
echo -e "${BLUE}Para ejecutar el servidor:${NC}"
echo -e "   ${GREEN}source venv/bin/activate${NC}"
echo -e "   ${GREEN}python -m app.server${NC}"
echo ""
echo -e "O simplemente ejecuta:"
echo -e "   ${GREEN}./run_local.sh${NC}"

