# 🌐 Configuración Multi-Agente - Monitoreo de Múltiples Máquinas

Esta guía explica cómo configurar el sistema de monitoreo gRPC en múltiples máquinas (tu máquina local, servidores remotos, etc.).

## 📋 Arquitectura

```
┌─────────────────┐
│  Frontend/UI    │
│  (Dashboard)    │
└────────┬────────┘
         │
         │ gRPC / HTTP
         │
┌────────▼────────────────────┐
│  Servidor Central (Opcional)│
│  - Agrega métricas          │
│  - Dashboard unificado     │
└────────┬──────────┬──────────┘
         │          │
    ┌────▼──┐   ┌───▼──┐
    │Agente │   │Agente│
    │Máq 1  │   │Máq 2 │
    │:50051 │   │:50051│
    └───────┘   └───────┘
```

## 🎯 Opción 1: Agentes Independientes (Recomendado para empezar)

Cada máquina corre su propio agente gRPC. El frontend se conecta directamente a cada uno.

### Paso 1: Instalar en tu Máquina Local

```bash
cd backend
./run_local.sh
```

El agente estará en: `localhost:50051`

### Paso 2: Instalar en Otra Máquina/Servidor

#### A. Copiar archivos al servidor

```bash
# Desde tu máquina local
scp -r backend/ usuario@servidor-remoto:/ruta/destino/
```

O clonar el repo en el servidor:

```bash
# En el servidor remoto
git clone <tu-repo>
cd servicio-de-striming-usando-gRPC/backend
```

#### B. Configurar el agente

```bash
# En el servidor remoto
cd backend

# Crear entorno virtual
python3 -m venv venv
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt

# Regenerar protobuf
python -m grpc_tools.protoc -I proto --python_out=app --grpc_python_out=app proto/metrics.proto

# Corregir importación
sed -i 's/^import metrics_pb2 as metrics__pb2$/from app import metrics_pb2 as metrics__pb2/' app/metrics_pb2_grpc.py
```

#### C. Configurar variables de entorno

```bash
# Crear archivo .env o exportar variables
export AGENT_ID="servidor-produccion-1"
export HOSTNAME=$(hostname)
export GRPC_PORT=50051
export HTTP_BRIDGE_PORT=8000
export LOG_LEVEL=INFO
```

#### D. Ejecutar como servicio (systemd)

Crear archivo `/etc/systemd/system/grpc-monitor.service`:

```ini
[Unit]
Description=gRPC Metrics Monitor Agent
After=network.target

[Service]
Type=simple
User=tu-usuario
WorkingDirectory=/ruta/a/backend
Environment="AGENT_ID=servidor-produccion-1"
Environment="GRPC_PORT=50051"
Environment="HTTP_BRIDGE_PORT=8000"
ExecStart=/ruta/a/backend/venv/bin/python -m app.server
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Activar servicio:

```bash
sudo systemctl daemon-reload
sudo systemctl enable grpc-monitor
sudo systemctl start grpc-monitor
sudo systemctl status grpc-monitor
```

### Paso 3: Conectar desde el Frontend

El frontend puede conectarse a múltiples agentes. Configura las URLs:

```typescript
// frontend/src/lib/config.ts
export const AGENT_ENDPOINTS = {
  'local-machine': 'http://localhost:8000/grpc',
  'servidor-1': 'http://192.168.1.100:8000/grpc',
  'servidor-2': 'http://servidor-remoto.com:8000/grpc',
};
```

## 🎯 Opción 2: Servidor Central con Agregación

Un servidor central se conecta a múltiples agentes y agrega las métricas.

### Arquitectura

```
Frontend → Servidor Central (puerto 8080)
            ├─→ Agente 1 (192.168.1.100:50051)
            ├─→ Agente 2 (192.168.1.101:50051)
            └─→ Agente 3 (192.168.1.102:50051)
```

### Implementar Servidor Central

```python
# backend/app/aggregator.py

import asyncio
import grpc
from app import metrics_pb2, metrics_pb2_grpc

class MetricsAggregator:
    """Agrega métricas de múltiples agentes"""
    
    def __init__(self, agent_endpoints: dict):
        self.agent_endpoints = agent_endpoints
        self.agents = {}
    
    async def connect_agents(self):
        """Conectar a todos los agentes"""
        for agent_id, endpoint in self.agent_endpoints.items():
            try:
                channel = grpc.aio.insecure_channel(endpoint)
                stub = metrics_pb2_grpc.MetricsServiceStub(channel)
                self.agents[agent_id] = stub
                print(f"✅ Conectado a {agent_id}")
            except Exception as e:
                print(f"❌ Error conectando a {agent_id}: {e}")
    
    async def get_aggregated_metrics(self):
        """Obtener métricas agregadas de todos los agentes"""
        tasks = []
        for agent_id, stub in self.agents.items():
            task = self._get_agent_metrics(agent_id, stub)
            tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return self._aggregate_results(results)
    
    async def _get_agent_metrics(self, agent_id, stub):
        """Obtener métricas de un agente"""
        try:
            request = metrics_pb2.StreamRequest(interval_ms=1000)
            async for response in stub.StreamMetrics(request):
                return response.snapshot
        except Exception as e:
            print(f"Error obteniendo métricas de {agent_id}: {e}")
            return None
```

## 🔒 Seguridad para Agentes Remotos

### 1. Autenticación con Tokens

```bash
# En cada agente
export API_TOKEN="token-secreto-compartido-123"
```

### 2. Firewall

```bash
# Permitir solo conexiones desde el servidor central
sudo ufw allow from 192.168.1.50 to any port 50051
sudo ufw allow from 192.168.1.50 to any port 8000
```

### 3. TLS/SSL (Producción)

```python
# Usar certificados TLS en lugar de insecure_channel
credentials = grpc.ssl_channel_credentials(
    root_certificates=open('ca.pem').read(),
    private_key=open('client.key').read(),
    certificate_chain=open('client.pem').read()
)
channel = grpc.aio.secure_channel(endpoint, credentials)
```

## 📦 Script de Instalación Automática

Crear `install_agent.sh`:

```bash
#!/bin/bash
# Script para instalar agente en servidor remoto

set -e

AGENT_ID=${1:-"agent-$(hostname)"}
GRPC_PORT=${2:-50051}
HTTP_PORT=${3:-8000}

echo "🚀 Instalando agente gRPC: $AGENT_ID"

# Crear directorio
mkdir -p /opt/grpc-monitor
cd /opt/grpc-monitor

# Clonar o copiar código
# git clone <repo> . || scp -r backend/* .

# Crear venv
python3 -m venv venv
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt

# Generar protobuf
python -m grpc_tools.protoc -I proto --python_out=app --grpc_python_out=app proto/metrics.proto

# Corregir importación
sed -i 's/^import metrics_pb2 as metrics__pb2$/from app import metrics_pb2 as metrics__pb2/' app/metrics_pb2_grpc.py

# Crear archivo de configuración
cat > .env << EOF
AGENT_ID=$AGENT_ID
GRPC_PORT=$GRPC_PORT
HTTP_BRIDGE_PORT=$HTTP_PORT
LOG_LEVEL=INFO
EOF

# Crear servicio systemd
sudo tee /etc/systemd/system/grpc-monitor.service > /dev/null << EOF
[Unit]
Description=gRPC Metrics Monitor
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/grpc-monitor
EnvironmentFile=/opt/grpc-monitor/.env
ExecStart=/opt/grpc-monitor/venv/bin/python -m app.server
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Activar servicio
sudo systemctl daemon-reload
sudo systemctl enable grpc-monitor
sudo systemctl start grpc-monitor

echo "✅ Agente instalado y corriendo"
echo "   Agent ID: $AGENT_ID"
echo "   gRPC: localhost:$GRPC_PORT"
echo "   HTTP: localhost:$HTTP_PORT"
```

Uso:

```bash
chmod +x install_agent.sh
./install_agent.sh "mi-servidor" 50051 8000
```

## 🔍 Verificar Conexión

### Desde tu máquina local

```bash
# Probar conexión gRPC
grpcurl -plaintext servidor-remoto:50051 metrics.MetricsService/ListAgents

# Probar HTTP bridge
curl http://servidor-remoto:8000/metrics.MetricsService/ListAgents \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Desde Python

```python
import grpc
from app import metrics_pb2, metrics_pb2_grpc

# Conectar a agente remoto
channel = grpc.insecure_channel('servidor-remoto:50051')
stub = metrics_pb2_grpc.MetricsServiceStub(channel)

# Listar agentes
agents = stub.ListAgents(metrics_pb2.Empty())
print(agents)

# Stream métricas
request = metrics_pb2.StreamRequest(interval_ms=1000)
for response in stub.StreamMetrics(request):
    print(f"CPU: {response.snapshot.cpu_percent}%")
```

## 📊 Dashboard Multi-Agente

El frontend puede mostrar múltiples agentes:

```typescript
// frontend/src/App.tsx
const agents = [
  { id: 'local', endpoint: 'http://localhost:8000/grpc' },
  { id: 'server1', endpoint: 'http://192.168.1.100:8000/grpc' },
  { id: 'server2', endpoint: 'http://192.168.1.101:8000/grpc' },
];

// Conectar a todos y mostrar en dashboard
```

## 🐳 Docker para Agentes Remotos

```yaml
# docker-compose.agent.yml
version: "3.9"
services:
  agent:
    build: ./backend
    container_name: grpc-monitor-agent
    environment:
      - AGENT_ID=${AGENT_ID:-agent-docker}
      - GRPC_PORT=50051
      - HTTP_BRIDGE_PORT=8000
    ports:
      - "50051:50051"
      - "8000:8000"
    restart: unless-stopped
```

Ejecutar en servidor remoto:

```bash
AGENT_ID=servidor-produccion docker-compose -f docker-compose.agent.yml up -d
```

## ✅ Checklist de Configuración

- [ ] Agente instalado en máquina local
- [ ] Agente instalado en servidor remoto
- [ ] Puertos abiertos en firewall
- [ ] Tokens de autenticación configurados
- [ ] Frontend configurado con endpoints
- [ ] Servicios systemd activos (si aplica)
- [ ] Conexiones verificadas

## 🆘 Troubleshooting

### No puedo conectar al agente remoto

```bash
# Verificar que el agente está corriendo
ssh usuario@servidor "systemctl status grpc-monitor"

# Verificar puertos
ssh usuario@servidor "netstat -tuln | grep 50051"

# Verificar firewall
ssh usuario@servidor "sudo ufw status"
```

### Error de autenticación

```bash
# Verificar token en agente
ssh usuario@servidor "grep API_TOKEN /opt/grpc-monitor/.env"

# Usar mismo token en cliente
export API_TOKEN="token-secreto"
```

---

**¡Listo!** Ahora puedes monitorear múltiples máquinas desde un solo dashboard. 🎉

