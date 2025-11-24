# 📡 Explicación: Streaming en gRPC

## ¿Es un Stream Continuo?

**¡SÍ!** El servidor usa **Server-Side Streaming** de gRPC, que es un stream continuo. El intervalo (0.3s, 1s, etc.) es el tiempo **entre cada mensaje** que se envía en el stream, no el tiempo entre conexiones.

## Cómo Funciona el Streaming

### 1. Conexión Única y Permanente ✅

```
Cliente → Conecta una vez → Stream abierto
         ↓
    [Conexión permanece abierta]
         ↓
    Recibe mensajes continuamente
```

**El stream NO se cierra entre mensajes**. Es una conexión HTTP/2 persistente que permanece abierta.

### 2. Envío Periódico de Datos

```python
# Backend (server.py)
async def StreamMetrics(...):
    while True:  # ← Loop infinito = stream continuo
        # Recolectar métricas
        snapshot = self.collector.get_full_snapshot(...)
        
        # Enviar al cliente (sin cerrar conexión)
        yield response  # ← Envía mensaje en el stream
        
        # Esperar intervalo antes del siguiente mensaje
        await asyncio.sleep(interval_sec)  # ← 0.3s, 1s, etc.
```

### 3. Cliente Recibe Continuamente

```typescript
// Frontend (grpc.ts)
for await (const snapshot of generator) {
  // Recibe cada snapshot cuando llega
  // El stream permanece abierto entre snapshots
  setSnapshot(snapshot);
}
```

## ¿Por Qué Hay un Intervalo?

El intervalo **NO es el tiempo entre conexiones**, sino el tiempo **entre cada mensaje** en el stream:

### Razones del Intervalo:

1. **Evitar saturación**: Sin intervalo, el servidor enviaría miles de mensajes por segundo
2. **Recursos del sistema**: Recolectar métricas tiene costo (CPU, I/O)
3. **Ancho de banda**: Reducir tráfico de red
4. **Configurable por cliente**: Cada cliente puede elegir su intervalo

### Ejemplo Visual:

```
Stream abierto ──────────────────────────────────────>
                 
Tiempo:  0s    1s    2s    3s    4s    5s
         │     │     │     │     │     │
Mensajes:●─────●─────●─────●─────●─────●
         ↑     ↑     ↑     ↑     ↑     ↑
      Snapshot cada 1 segundo (interval_ms=1000)
      
      La conexión permanece abierta todo el tiempo
```

## Tipos de Streaming en Este Proyecto

### 1. StreamMetrics (Métricas)

```python
# Intervalo configurable por cliente
request = StreamRequest(interval_ms=1000)  # Cliente elige

# Stream continuo
while True:
    yield MetricsResponse(snapshot=...)
    await asyncio.sleep(1.0)  # Espera 1 segundo
```

**Características**:
- ✅ Stream continuo (conexión abierta)
- ✅ Intervalo configurable (250ms - 60s)
- ✅ El cliente puede cambiar el intervalo
- ✅ Se cierra solo cuando el cliente desconecta

### 2. StreamLogs (Logs)

```python
# Polling cada 0.3 segundos (optimizado)
while True:
    logs = get_system_logs(...)
    for log in new_logs:
        yield LogEntry(...)
    await asyncio.sleep(0.3)  # 300ms entre checks
```

**Características**:
- ✅ Stream continuo
- ✅ Intervalo fijo de 0.3s (optimizado para logs)
- ✅ Solo envía logs nuevos (no duplicados)

## Comparación: Stream vs Polling

### ❌ NO es Polling (lo que NO es):

```
Cliente → Request → Respuesta → Cierra conexión
Cliente → Request → Respuesta → Cierra conexión  (nueva conexión)
Cliente → Request → Respuesta → Cierra conexión  (nueva conexión)
```

### ✅ SÍ es Streaming (lo que SÍ es):

```
Cliente → Conecta → Stream abierto
         ↓
    Mensaje 1 (t=0s)
    Mensaje 2 (t=1s)
    Mensaje 3 (t=2s)
    Mensaje 4 (t=3s)
    ... (conexión permanece abierta)
```

## Ventajas del Streaming

1. **Eficiencia**: Una sola conexión vs múltiples requests
2. **Bajo overhead**: HTTP/2 multiplexing
3. **Tiempo real**: Datos llegan tan pronto como están disponibles
4. **Escalable**: Múltiples streams simultáneos
5. **Bidireccional**: El servidor puede enviar cuando quiera

## Configuración del Intervalo

### Cliente Controla el Intervalo

```typescript
// Frontend puede elegir:
streamMetrics(250)   // Cada 250ms (muy rápido)
streamMetrics(1000)  // Cada 1 segundo (normal)
streamMetrics(5000)  // Cada 5 segundos (lento)
```

### Límites de Seguridad

```python
# Backend valida el intervalo
INTERVAL_MIN_MS = 250   # Mínimo: 250ms
INTERVAL_MAX_MS = 60000 # Máximo: 60 segundos
```

## Verificación: ¿Es Realmente un Stream?

### Prueba 1: Conexión Persistente

```bash
# Ver conexiones activas
netstat -an | grep 50051

# Deberías ver una conexión ESTABLISHED que permanece
```

### Prueba 2: Logs del Servidor

```python
# En server.py, línea 83-86
logger.info(f"StreamMetrics started: agent_id={request.agent_id}, interval_ms={interval_ms}")
# Esto se imprime UNA VEZ cuando se abre el stream
# No se imprime en cada mensaje
```

### Prueba 3: Network Tab en DevTools

En el navegador:
1. Abre DevTools → Network
2. Filtra por "StreamMetrics"
3. Verás **UNA conexión** que permanece abierta
4. Los datos llegan continuamente en esa conexión

## Resumen

✅ **SÍ es un stream continuo**: La conexión permanece abierta
✅ **El intervalo es entre mensajes**: No entre conexiones
✅ **Configurable por cliente**: Cada cliente elige su intervalo
✅ **Eficiente**: Una conexión para múltiples mensajes
✅ **Tiempo real**: Datos llegan tan pronto como están disponibles

**El 0.3 segundos que mencionas es probablemente del polling de logs, no de métricas. Las métricas usan el intervalo que el cliente configure (por defecto 1 segundo).**

---

¿Quieres que ajuste algo del streaming o tienes alguna duda específica? 🤔

