#!/bin/bash
# Script para ejecutar el servidor gRPC localmente y monitorear tu máquina

set -e

echo "🚀 Iniciando servidor de monitoreo gRPC..."

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar si estamos en un entorno virtual
if [ -z "$VIRTUAL_ENV" ]; then
    echo -e "${YELLOW}⚠️  No se detectó un entorno virtual. Creando uno...${NC}"
    if [ ! -d "venv" ]; then
        python3 -m venv venv
    fi
    echo -e "${BLUE}📦 Activando entorno virtual...${NC}"
    source venv/bin/activate
fi

# Instalar dependencias si es necesario
echo -e "${BLUE}📦 Verificando dependencias...${NC}"
# Actualizar pip primero para asegurar mejor compatibilidad
pip install --upgrade pip setuptools wheel
# Instalar dependencias (usar --only-binary para evitar compilación si es posible)
pip install -r requirements.txt

# Regenerar stubs de protobuf
echo -e "${BLUE}🔧 Regenerando stubs de protobuf...${NC}"
python -m grpc_tools.protoc -I proto --python_out=app --grpc_python_out=app proto/metrics.proto

# Corregir importación en metrics_pb2_grpc.py (el generador usa import absoluto incorrecto)
if [ -f "app/metrics_pb2_grpc.py" ]; then
    echo -e "${BLUE}🔧 Corrigiendo importaciones...${NC}"
    # Reemplazar import absoluto por import relativo desde app
    # macOS usa sed -i '', Linux usa sed -i
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' 's/^import metrics_pb2 as metrics__pb2$/from app import metrics_pb2 as metrics__pb2/' app/metrics_pb2_grpc.py
    else
        sed -i 's/^import metrics_pb2 as metrics__pb2$/from app import metrics_pb2 as metrics__pb2/' app/metrics_pb2_grpc.py
    fi
fi

# Configurar variables de entorno (puedes modificarlas aquí)
export AGENT_ID=${AGENT_ID:-"ngrok-1"}
export HOSTNAME=${HOSTNAME:-$(hostname)}
export GRPC_PORT=${GRPC_PORT:-50051}
export TOP_N_PROCS=${TOP_N_PROCS:-10}
export INTERVAL_MIN_MS=${INTERVAL_MIN_MS:-250}
export INTERVAL_MAX_MS=${INTERVAL_MAX_MS:-60000}
export LOG_LEVEL=${LOG_LEVEL:-INFO}
export ENABLE_HTTP_BRIDGE=${ENABLE_HTTP_BRIDGE:-1}
export HTTP_BRIDGE_PORT=${HTTP_BRIDGE_PORT:-8000}

# Opcional: descomentar para habilitar autenticación
# export API_TOKEN="tu-token-secreto-aqui"

# Opcional: Registrar agentes remotos conocidos
# Formato: "agent_id1:endpoint1,agent_id2:endpoint2"
# Ejemplo:
# export KNOWN_AGENTS="ngrok-1:https://98cf7bfce07a.ngrok-free.app/grpc,ngrok-2:http://localhost:8000p/grpc"
export KNOWN_AGENTS=${KNOWN_AGENTS:-"ngrok-1:https://f72a9450f815.ngrok-free.app/grpc"}

echo -e "${GREEN}✅ Configuración:${NC}"
echo -e "   Agent ID: $AGENT_ID"
echo -e "   Hostname: $HOSTNAME"
echo -e "   Puerto gRPC: $GRPC_PORT"
echo -e "   Puerto HTTP Bridge: $HTTP_BRIDGE_PORT"
echo -e "   Log Level: $LOG_LEVEL"
echo ""
echo -e "${GREEN}🎯 Iniciando servidor...${NC}"
echo -e "${BLUE}   El servidor estará disponible en:${NC}"
echo -e "   - gRPC: localhost:$GRPC_PORT"
echo -e "   - HTTP Bridge: http://localhost:$HTTP_BRIDGE_PORT"
echo ""
echo -e "${YELLOW}💡 Presiona Ctrl+C para detener el servidor${NC}"
echo ""

# Ejecutar el servidor
python -m app.server

