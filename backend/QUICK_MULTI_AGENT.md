# ⚡ Guía Rápida - Multi-Agente

## 🎯 Monitorear tu Máquina + Otro Servidor

### Paso 1: Tu Máquina Local

```bash
cd backend
./run_local.sh
```

✅ Agente corriendo en `localhost:50051`

### Paso 2: Servidor Remoto

#### Opción A: Instalación Automática (Recomendado)

```bash
# En el servidor remoto
cd backend
./install_agent.sh "mi-servidor" 50051 8000
```

#### Opción B: Manual

```bash
# En el servidor remoto
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m grpc_tools.protoc -I proto --python_out=app --grpc_python_out=app proto/metrics.proto

# Corregir importación
sed -i 's/^import metrics_pb2 as metrics__pb2$/from app import metrics_pb2 as metrics__pb2/' app/metrics_pb2_grpc.py

# Configurar
export AGENT_ID="mi-servidor"
export GRPC_PORT=50051
export HTTP_BRIDGE_PORT=8000

# Ejecutar
python -m app.server
```

### Paso 3: Conectar desde Frontend

```typescript
// frontend/src/lib/config.ts
export const AGENTS = {
  'local': 'http://localhost:8000/grpc',
  'servidor-remoto': 'http://IP-DEL-SERVIDOR:8000/grpc',
};
```

### Paso 4: Abrir Puertos (si es necesario)

```bash
# En el servidor remoto
sudo ufw allow 50051/tcp
sudo ufw allow 8000/tcp
```

## 🔍 Verificar Conexión

```bash
# Desde tu máquina local
grpcurl -plaintext IP-SERVIDOR:50051 metrics.MetricsService/ListAgents

# O con curl
curl http://IP-SERVIDOR:8000/metrics.MetricsService/ListAgents \
  -H "Content-Type: application/json" \
  -d '{}'
```

## 📝 Variables Importantes

Cada agente necesita:

```bash
AGENT_ID="nombre-unico"  # Diferente para cada máquina
GRPC_PORT=50051          # Puede ser el mismo
HTTP_BRIDGE_PORT=8000    # Puede ser el mismo
```

## 🎯 Ejemplo Completo

**Máquina 1 (Local):**
```bash
export AGENT_ID="mi-pc"
./run_local.sh
```

**Máquina 2 (Servidor):**
```bash
export AGENT_ID="servidor-prod"
./run_local.sh
```

**Frontend:**
- Selecciona "mi-pc" → Ve métricas de tu máquina
- Selecciona "servidor-prod" → Ve métricas del servidor

---

**¿Problemas?** Ver `MULTI_AGENT_SETUP.md` para más detalles.

