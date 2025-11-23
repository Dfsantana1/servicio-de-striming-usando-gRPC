#!/bin/bash
# Script para instalar agente gRPC en servidor remoto

set -e

AGENT_ID=${1:-"agent-$(hostname)"}
GRPC_PORT=${2:-50051}
HTTP_PORT=${3:-8000}
INSTALL_DIR=${4:-"/opt/grpc-monitor"}

echo "🚀 Instalando agente gRPC: $AGENT_ID"
echo "   Directorio: $INSTALL_DIR"
echo "   Puerto gRPC: $GRPC_PORT"
echo "   Puerto HTTP: $HTTP_PORT"

# Crear directorio
sudo mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Si no existe el código, copiarlo
if [ ! -f "requirements.txt" ]; then
    echo "📦 Copiando código del agente..."
    # Asumimos que estamos en el directorio backend
    # Si se ejecuta remotamente, usar scp o git clone
    if [ -f "../backend/requirements.txt" ]; then
        cp -r ../backend/* .
    else
        echo "❌ Error: No se encontró el código del agente"
        echo "   Copia los archivos del backend a $INSTALL_DIR"
        exit 1
    fi
fi

# Crear venv
echo "🐍 Creando entorno virtual..."
python3 -m venv venv
source venv/bin/activate

# Instalar dependencias
echo "📦 Instalando dependencias..."
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt

# Generar protobuf
echo "🔧 Generando stubs de protobuf..."
python -m grpc_tools.protoc -I proto --python_out=app --grpc_python_out=app proto/metrics.proto

# Corregir importación
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' 's/^import metrics_pb2 as metrics__pb2$/from app import metrics_pb2 as metrics__pb2/' app/metrics_pb2_grpc.py
else
    sed -i 's/^import metrics_pb2 as metrics__pb2$/from app import metrics_pb2 as metrics__pb2/' app/metrics_pb2_grpc.py
fi

# Crear archivo de configuración
echo "⚙️  Creando configuración..."
cat > .env << EOF
AGENT_ID=$AGENT_ID
HOSTNAME=$(hostname)
GRPC_PORT=$GRPC_PORT
HTTP_BRIDGE_PORT=$HTTP_PORT
TOP_N_PROCS=10
INTERVAL_MIN_MS=250
INTERVAL_MAX_MS=60000
LOG_LEVEL=INFO
ENABLE_HTTP_BRIDGE=1
# API_TOKEN=  # Descomentar y agregar token para autenticación
EOF

# Crear servicio systemd
echo "🔧 Creando servicio systemd..."
sudo tee /etc/systemd/system/grpc-monitor.service > /dev/null << EOF
[Unit]
Description=gRPC Metrics Monitor Agent
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=$INSTALL_DIR/venv/bin/python -m app.server
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Activar servicio
echo "🚀 Activando servicio..."
sudo systemctl daemon-reload
sudo systemctl enable grpc-monitor
sudo systemctl start grpc-monitor

# Esperar un momento
sleep 2

# Verificar estado
if sudo systemctl is-active --quiet grpc-monitor; then
    echo "✅ Agente instalado y corriendo"
    echo ""
    echo "📊 Información:"
    echo "   Agent ID: $AGENT_ID"
    echo "   Hostname: $(hostname)"
    echo "   gRPC: localhost:$GRPC_PORT"
    echo "   HTTP: localhost:$HTTP_PORT"
    echo ""
    echo "📝 Comandos útiles:"
    echo "   Ver estado: sudo systemctl status grpc-monitor"
    echo "   Ver logs: sudo journalctl -u grpc-monitor -f"
    echo "   Reiniciar: sudo systemctl restart grpc-monitor"
    echo "   Detener: sudo systemctl stop grpc-monitor"
else
    echo "❌ Error: El servicio no está corriendo"
    echo "   Ver logs: sudo journalctl -u grpc-monitor -n 50"
    exit 1
fi

