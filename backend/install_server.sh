#!/bin/bash
# Script para instalar y configurar el servidor gRPC en un servidor externo

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🚀 Instalación de gRPC Monitor en Servidor Externo${NC}"
echo ""

# Obtener parámetros
AGENT_ID=${1:-"servidor-remoto"}
INSTALL_DIR=${2:-"$HOME/rpc-monitor"}
HTTP_PORT=${3:-8000}

echo -e "${GREEN}📋 Configuración:${NC}"
echo -e "   Agent ID: $AGENT_ID"
echo -e "   Directorio: $INSTALL_DIR"
echo -e "   Puerto HTTP: $HTTP_PORT"
echo ""

# Verificar Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 no está instalado${NC}"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
echo -e "${GREEN}✅ Python $PYTHON_VERSION detectado${NC}"

# Crear directorio si no existe
if [ ! -d "$INSTALL_DIR" ]; then
    echo -e "${BLUE}📦 Clonando repositorio...${NC}"
    read -p "Ingresa la URL del repositorio (o Enter para usar directorio actual): " REPO_URL
    
    if [ -z "$REPO_URL" ]; then
        # Usar directorio actual
        INSTALL_DIR=$(pwd)/..
        echo -e "${YELLOW}⚠️  Usando directorio actual: $INSTALL_DIR${NC}"
    else
        git clone "$REPO_URL" "$INSTALL_DIR"
    fi
fi

cd "$INSTALL_DIR/backend"

# Crear entorno virtual
if [ ! -d "venv" ]; then
    echo -e "${BLUE}📦 Creando entorno virtual...${NC}"
    python3 -m venv venv
fi

echo -e "${BLUE}📦 Activando entorno virtual...${NC}"
source venv/bin/activate

# Instalar dependencias
echo -e "${BLUE}📦 Instalando dependencias...${NC}"
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt

# Regenerar protobuf
echo -e "${BLUE}🔧 Regenerando stubs de protobuf...${NC}"
python -m grpc_tools.protoc -I proto --python_out=app --grpc_python_out=app proto/metrics.proto

# Corregir importaciones
if [ -f "app/metrics_pb2_grpc.py" ]; then
    echo -e "${BLUE}🔧 Corrigiendo importaciones...${NC}"
    sed -i 's/^import metrics_pb2 as metrics__pb2$/from app import metrics_pb2 as metrics__pb2/' app/metrics_pb2_grpc.py 2>/dev/null || \
    sed -i '' 's/^import metrics_pb2 as metrics__pb2$/from app import metrics_pb2 as metrics__pb2/' app/metrics_pb2_grpc.py
fi

# Crear script de inicio
echo -e "${BLUE}📝 Creando script de inicio...${NC}"
cat > start_server.sh << EOF
#!/bin/bash
cd "$INSTALL_DIR/backend"
source venv/bin/activate

export AGENT_ID="$AGENT_ID"
export HOSTNAME=\$(hostname)
export GRPC_PORT=50051
export HTTP_BRIDGE_PORT=$HTTP_PORT
export ENABLE_HTTP_BRIDGE=1
export LOG_LEVEL=INFO

echo "🚀 Iniciando servidor..."
echo "   Agent ID: \$AGENT_ID"
echo "   HTTP Bridge: http://0.0.0.0:\$HTTP_BRIDGE_PORT"
echo ""

python -m app.server
EOF

chmod +x start_server.sh

# Configurar firewall
echo -e "${BLUE}🔥 Configurando firewall...${NC}"
if command -v ufw &> /dev/null; then
    sudo ufw allow $HTTP_PORT/tcp 2>/dev/null || echo -e "${YELLOW}⚠️  No se pudo configurar ufw (puede requerir permisos)${NC}"
elif command -v firewall-cmd &> /dev/null; then
    sudo firewall-cmd --permanent --add-port=$HTTP_PORT/tcp 2>/dev/null || echo -e "${YELLOW}⚠️  No se pudo configurar firewalld${NC}"
    sudo firewall-cmd --reload 2>/dev/null || true
else
    echo -e "${YELLOW}⚠️  Firewall no detectado. Asegúrate de abrir el puerto $HTTP_PORT manualmente${NC}"
fi

# Obtener IP del servidor
SERVER_IP=$(hostname -I | awk '{print $1}' || hostname)
if [ -z "$SERVER_IP" ]; then
    SERVER_IP="<IP_DEL_SERVIDOR>"
fi

echo ""
echo -e "${GREEN}✅ Instalación completada!${NC}"
echo ""
echo -e "${BLUE}📋 Próximos pasos:${NC}"
echo ""
echo -e "1. Iniciar el servidor:"
echo -e "   ${GREEN}cd $INSTALL_DIR/backend${NC}"
echo -e "   ${GREEN}./start_server.sh${NC}"
echo ""
echo -e "2. En tu máquina local, configurar frontend:"
echo -e "   ${GREEN}cd frontend${NC}"
echo -e "   ${GREEN}echo \"VITE_GRPC_BASE=http://$SERVER_IP:$HTTP_PORT\" > .env${NC}"
echo -e "   ${GREEN}npm run dev${NC}"
echo ""
echo -e "3. Verificar conexión:"
echo -e "   ${GREEN}curl http://$SERVER_IP:$HTTP_PORT/metrics.MetricsService/ListAgents \\${NC}"
echo -e "   ${GREEN}  -H \"Content-Type: application/json\" -d '{}'${NC}"
echo ""
echo -e "${YELLOW}💡 Para ejecutar como servicio, ver: DESPLIEGUE_SERVIDOR_EXTERNO.md${NC}"

