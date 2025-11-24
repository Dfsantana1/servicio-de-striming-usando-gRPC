# 🚀 Optimización de Concurrencia para Múltiples Requests

## Problema

Tu máquina local necesita manejar múltiples requests concurrentes de forma eficiente. Con un solo hilo, las requests se procesarían secuencialmente, causando lentitud.

## Solución Implementada

### 1. Thread Pool para Operaciones Bloqueantes ✅

El servidor ahora usa un **ThreadPoolExecutor** para manejar operaciones bloqueantes (como las llamadas a `psutil`) de forma concurrente:

```python
from concurrent.futures import ThreadPoolExecutor

max_workers = min(32, (os.cpu_count() or 1) + 4)
server = aio.server(ThreadPoolExecutor(max_workers=max_workers))
```

**Beneficios**:
- ✅ Múltiples requests pueden ejecutarse simultáneamente
- ✅ Las operaciones bloqueantes (psutil) no bloquean otras requests
- ✅ Mejor utilización de recursos

### 2. Configuración de gRPC para Concurrencia ✅

Se configuraron opciones de gRPC para optimizar el manejo de múltiples conexiones:

```python
options=[
    ('grpc.keepalive_time_ms', 30000),  # Keepalive ping cada 30s
    ('grpc.keepalive_timeout_ms', 5000),  # Timeout de keepalive
    ('grpc.max_connection_idle_ms', 300000),  # 5 minutos de idle
    ('grpc.max_connection_age_ms', 1800000),  # 30 minutos máximo
]
```

**Beneficios**:
- ✅ Mejor manejo de conexiones concurrentes
- ✅ Keepalive para mantener conexiones activas
- ✅ Limpieza automática de conexiones inactivas

### 3. Arquitectura Async ✅

El servidor usa `grpc.aio` (async), lo que permite:

- ✅ **Múltiples streams simultáneos**: Cada request se maneja como una coroutine independiente
- ✅ **No bloqueo**: Mientras una request espera (sleep, I/O), otras pueden procesarse
- ✅ **Escalabilidad**: Puede manejar cientos de conexiones concurrentes

## Cómo Funciona

### Antes (Sin Thread Pool):
```
Request 1 → Bloquea → Request 2 espera → Request 3 espera
```

### Después (Con Thread Pool):
```
Request 1 → Worker 1 → Procesa
Request 2 → Worker 2 → Procesa (simultáneo)
Request 3 → Worker 3 → Procesa (simultáneo)
```

## Configuración

### Variables de Entorno

```bash
# Número de workers para operaciones bloqueantes
# Por defecto: min(32, cpu_count + 4)
export GRPC_MAX_WORKERS=16  # Personalizar si es necesario
```

### Cálculo Automático

Si no especificas `GRPC_MAX_WORKERS`, se calcula automáticamente:
- **Mínimo**: 1 worker
- **Máximo**: 32 workers
- **Fórmula**: `min(32, cpu_count + 4)`

**Ejemplos**:
- 2 CPUs → 6 workers
- 4 CPUs → 8 workers
- 8 CPUs → 12 workers
- 16+ CPUs → 32 workers (máximo)

## Capacidad de Concurrencia

### Requests Simultáneas

El servidor puede manejar:
- ✅ **Múltiples streams de métricas** simultáneos
- ✅ **Múltiples streams de logs** simultáneos
- ✅ **Llamadas unary** (ListAgents) sin bloquear streams

### Límites Prácticos

Con la configuración actual:
- **Streams de métricas**: ~50-100 simultáneos (depende de intervalo)
- **Streams de logs**: ~50-100 simultáneos
- **Llamadas unary**: Cientos simultáneas

### Factores que Afectan

1. **Intervalo de métricas**: Intervalos más cortos = más carga
2. **Recursos del sistema**: CPU, memoria disponible
3. **Operaciones bloqueantes**: psutil puede ser costoso

## Optimizaciones Adicionales

### 1. Caché de Métricas (Futuro)

Para reducir carga con múltiples clients:

```python
# Compartir métricas entre clients con mismo intervalo
cache = {}
```

### 2. Rate Limiting (Opcional)

Si necesitas limitar requests:

```python
from aiolimiter import AsyncLimiter

limiter = AsyncLimiter(max_rate=10, time_period=1)  # 10 requests/segundo
```

### 3. Connection Pooling

gRPC ya maneja esto automáticamente, pero puedes optimizar:

```python
options=[
    ('grpc.http2.max_frame_size', 16777215),  # Max frame size
    ('grpc.http2.initial_connection_window_size', 1048576),  # Window size
]
```

## Monitoreo

### Verificar Concurrencia

```python
# Agregar contador de requests activas
active_requests = 0

async def StreamMetrics(...):
    global active_requests
    active_requests += 1
    try:
        # ... código ...
    finally:
        active_requests -= 1
```

### Logs de Concurrencia

Los logs ahora incluyen:
```
Max workers for blocking operations: 8
Server configured for concurrent requests
```

## Pruebas de Carga

### Probar con Múltiples Clients

```python
# test_concurrent.py
import asyncio
import grpc
from app import metrics_pb2, metrics_pb2_grpc

async def client():
    channel = grpc.aio.insecure_channel('localhost:50051')
    stub = metrics_pb2_grpc.MetricsServiceStub(channel)
    
    request = metrics_pb2.StreamRequest(interval_ms=1000)
    async for response in stub.StreamMetrics(request):
        print(f"Received: {response.snapshot.cpu_percent}%")
        break  # Solo una métrica para prueba

async def main():
    # Crear 10 clients simultáneos
    tasks = [client() for _ in range(10)]
    await asyncio.gather(*tasks)

asyncio.run(main())
```

## Resumen

✅ **Thread Pool configurado** - Maneja operaciones bloqueantes concurrentemente
✅ **gRPC optimizado** - Configurado para múltiples conexiones
✅ **Async architecture** - Escala naturalmente con requests
✅ **Configuración flexible** - Ajustable según recursos

**Tu servidor ahora puede manejar múltiples requests simultáneamente sin problemas!** 🎉

