# 🚀 Ejecutar el Servidor de Monitoreo Localmente

Este documento explica cómo ejecutar el servidor gRPC de monitoreo directamente en tu máquina (sin Docker) para monitorear todos los recursos del sistema.

## 📋 Requisitos Previos

- Python 3.11 o superior
- pip (gestor de paquetes de Python)

## 🎯 Opción 1: Script Automático (Recomendado)

El script `run_local.sh` automatiza todo el proceso:

```bash
cd backend
./run_local.sh
```

El script:
- ✅ Crea y activa un entorno virtual si no existe
- ✅ Instala todas las dependencias
- ✅ Regenera los stubs de protobuf
- ✅ Configura variables de entorno
- ✅ Inicia el servidor

## 🎯 Opción 2: Manual

### 1. Crear y activar entorno virtual

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
```

### 2. Instalar dependencias

```bash
pip install -r requirements.txt
```

### 3. Regenerar stubs de protobuf

```bash
python -m grpc_tools.protoc -I proto --python_out=app --grpc_python_out=app proto/metrics.proto
```

O usando el Makefile:

```bash
make gen-proto
```

### 4. Configurar variables de entorno (opcional)

```bash
export AGENT_ID="mi-maquina"
export HOSTNAME=$(hostname)
export GRPC_PORT=50051
export HTTP_BRIDGE_PORT=8000
export LOG_LEVEL=INFO
export TOP_N_PROCS=10
```

### 5. Ejecutar el servidor

```bash
python -m app.server
```

O usando el Makefile:

```bash
make run
```

## 🔧 Configuración Avanzada

### Variables de Entorno Disponibles

| Variable | Descripción | Valor por Defecto |
|----------|-------------|-------------------|
| `AGENT_ID` | Identificador único del agente | `local-machine` |
| `HOSTNAME` | Nombre del host | `hostname` del sistema |
| `GRPC_PORT` | Puerto para conexiones gRPC | `50051` |
| `HTTP_BRIDGE_PORT` | Puerto para HTTP bridge | `8000` |
| `TOP_N_PROCS` | Número de procesos top a mostrar | `10` |
| `INTERVAL_MIN_MS` | Intervalo mínimo en milisegundos | `250` |
| `INTERVAL_MAX_MS` | Intervalo máximo en milisegundos | `60000` |
| `LOG_LEVEL` | Nivel de logging (DEBUG, INFO, WARNING, ERROR) | `INFO` |
| `ENABLE_HTTP_BRIDGE` | Habilitar puente HTTP (1 o 0) | `1` |
| `API_TOKEN` | Token de autenticación (vacío = sin auth) | `""` |

### Ejemplo con Autenticación

```bash
export API_TOKEN="mi-token-secreto-123"
python -m app.server
```

## 📡 Endpoints Disponibles

Una vez que el servidor esté corriendo:

### gRPC (Puerto 50051)

- **StreamMetrics**: Streaming de métricas en tiempo real
- **ListAgents**: Lista de agentes disponibles

### HTTP Bridge (Puerto 8000)

Si `ENABLE_HTTP_BRIDGE=1`:

- `POST /metrics.MetricsService/ListAgents` - Lista agentes
- `POST /metrics.MetricsService/StreamMetrics` - Stream de métricas (NDJSON)

## 🧪 Probar el Servidor

### Con gRPC (usando grpcurl)

```bash
# Instalar grpcurl si no lo tienes
brew install grpcurl  # macOS
# o
go install github.com/fullstorydev/grpcurl/cmd/grpcurl@latest

# Listar agentes
grpcurl -plaintext localhost:50051 metrics.MetricsService/ListAgents

# Stream de métricas (requiere token si está configurado)
grpcurl -plaintext -d '{"interval_ms": 1000}' localhost:50051 metrics.MetricsService/StreamMetrics
```

### Con HTTP Bridge

```bash
# Listar agentes
curl -X POST http://localhost:8000/metrics.MetricsService/ListAgents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tu-token" \
  -d '{}'

# Stream de métricas
curl -X POST http://localhost:8000/metrics.MetricsService/StreamMetrics \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tu-token" \
  -d '{"interval_ms": 1000}'
```

## 📊 Métricas Disponibles

El servidor monitorea:

- ✅ **CPU**: Uso total, por núcleo, frecuencia, tiempos (user, system, idle, iowait, etc.)
- ✅ **Memoria**: RAM total, usada, disponible, caché, buffers
- ✅ **Swap**: Uso y estadísticas de swap
- ✅ **Disco**: Uso por partición, I/O (lectura/escritura)
- ✅ **Red**: Bytes, paquetes, errores, drops, por interfaz
- ✅ **Procesos**: Top N procesos con detalles completos
- ✅ **Sistema**: Uptime, boot time, plataforma, hostname
- ✅ **Sensores**: Temperatura, batería (si está disponible)

## 🐛 Troubleshooting

### Error: "ModuleNotFoundError: No module named 'grpc_tools'"

```bash
pip install -r requirements.txt
```

### Error: "Address already in use"

El puerto está ocupado. Cambia el puerto:

```bash
export GRPC_PORT=50052
python -m app.server
```

### Error: "Permission denied" al leer ciertos procesos

Algunos procesos del sistema requieren permisos elevados. Esto es normal y el servidor continuará funcionando.

### No se muestran temperaturas

Las temperaturas dependen del hardware y drivers. En macOS puede requerir permisos adicionales.

## 🔒 Seguridad

⚠️ **Importante para producción:**

- Usa autenticación con `API_TOKEN`
- Configura HTTPS/TLS para gRPC
- Limita el acceso a la red
- No expongas el puerto públicamente sin protección

## 📝 Logs

Los logs se muestran en la consola. Para guardarlos en un archivo:

```bash
python -m app.server 2>&1 | tee server.log
```

## 🛑 Detener el Servidor

Presiona `Ctrl+C` en la terminal donde está corriendo el servidor.

## 🔗 Conectar desde el Frontend

Si tienes el frontend corriendo, apunta a:

```
http://localhost:50051  # gRPC directo
# o
http://localhost:8000   # HTTP Bridge
```

Configura en el frontend:

```typescript
// En vite.config.ts o variables de entorno
VITE_GRPC_BASE=http://localhost:8000/grpc
```

---

**¡Listo!** Tu servidor de monitoreo está corriendo y monitoreando tu máquina en tiempo real. 🎉

