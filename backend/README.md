# Backend gRPC Metrics Server

Server gRPC asincrónico que proporciona streaming en tiempo real de métricas del sistema.

## Estructura

- `proto/metrics.proto`: Definición del servicio y mensajes protobuf
- `app/config.py`: Configuración centralizada (puertos, intervalos, tokens)
- `app/metrics.py`: Colección de métricas con psutil
- `app/auth.py`: Validación de tokens via metadata
- `app/server.py`: Implementación del servidor gRPC
- `tests/test_metrics.py`: Tests unitarios

## Requisitos

- Python 3.11+
- grpcio, grpcio-tools, psutil

## Instalación y Desarrollo Local

```bash
# Instalar dependencias
pip install -r requirements.txt

# Generar stubs de protobuf
python -m grpc_tools.protoc -I proto --python_out=app --grpc_python_out=app proto/metrics.proto

# Ejecutar servidor
python -m app.server

# Correr tests
pytest tests/
```

## Configuración

Variables de entorno:

| Variable | Defecto | Descripción |
|----------|---------|-------------|
| `GRPC_PORT` | 50051 | Puerto gRPC del servidor |
| `AGENT_ID` | agent-default | ID único del agente |
| `HOSTNAME` | localhost | Nombre del host reportado |
| `INTERVAL_DEFAULT_MS` | 1000 | Intervalo por defecto de emisión |
| `INTERVAL_MIN_MS` | 250 | Intervalo mínimo permitido |
| `INTERVAL_MAX_MS` | 60000 | Intervalo máximo permitido |
| `TOP_N_PROCS` | 10 | Número de procesos top a reportar |
| `API_TOKEN` | "" | Token requerido (vacío = sin auth) |
| `LOG_LEVEL` | INFO | Nivel de logging |

## Seguridad

Si `API_TOKEN` está configurado, el servidor requiere autenticación:

```
metadata: authorization: Bearer <token>
```

Si no se proporciona o es inválido, rechaza con `UNAUTHENTICATED`.

En modo demo (sin API_TOKEN), permite todas las conexiones.

## Servicios gRPC

### StreamMetrics(StreamRequest) → stream MetricsResponse

Emite snapshots de métricas en tiempo real.

**Parámetros de request:**
- `interval_ms`: Intervalo de emisión en milisegundos
- `agent_id`: (Opcional) ID del agente deseado

**Response:**
- `snapshot`: MetricsSnapshot con CPU, memoria, discos, procesos, etc.

### ListAgents(Empty) → AgentsList

Devuelve la lista de agentes disponibles (en despliegue, Nginx distribuye).

## Docker

```bash
# Build
docker build -t rpc-stream-monitor-backend .

# Run
docker run -e AGENT_ID=agent-1 -p 50051:50051 rpc-stream-monitor-backend
```

## Diagrama de Flujo

```
Cliente → Nginx (grpc_pass) → backend1:50051 / backend2:50051
                               (least_conn balancing)
```

Nginx distribuye automáticamente entre instancias usando `least_conn`.
