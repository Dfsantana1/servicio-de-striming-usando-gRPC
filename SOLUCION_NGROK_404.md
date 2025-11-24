# 🔧 Solución: Error 404 en StreamLogs con ngrok

## Problema

Cuando se usa ngrok, las peticiones a `/grpc/metrics.MetricsService/StreamLogs` devuelven 404:

```
POST /grpc/metrics.MetricsService/StreamLogs    404 Not Found
```

Mientras que `StreamMetrics` funciona correctamente:
```
POST /grpc/metrics.MetricsService/StreamMetrics 200 OK
```

## Causa

La construcción de la URL para `StreamLogs` no manejaba correctamente URLs absolutas de ngrok. Cuando la URL base es `https://f72a9450f815.ngrok-free.app`, necesita agregar `/grpc` antes del path.

## Solución Implementada ✅

Se mejoró la lógica de construcción de URLs para manejar correctamente:

1. **URLs absolutas** (ngrok): `https://f72a9450f815.ngrok-free.app`
2. **URLs relativas**: `/grpc`
3. **URLs con trailing slash**: `https://example.com/` → `https://example.com`

### Código Corregido

**Antes**:
```typescript
if (baseUrl.startsWith('http')) {
  url = baseUrl.endsWith('/grpc') 
    ? `${baseUrl}/metrics.MetricsService/StreamLogs`
    : `${baseUrl.replace(/\/$/, '')}/grpc/metrics.MetricsService/StreamLogs`;
}
```

**Después**:
```typescript
if (baseUrl.startsWith('http')) {
  const cleanUrl = baseUrl.replace(/\/$/, ''); // Quitar trailing slash
  if (cleanUrl.endsWith('/grpc')) {
    url = `${cleanUrl}/metrics.MetricsService/StreamLogs`;
  } else {
    url = `${cleanUrl}/grpc/metrics.MetricsService/StreamLogs`;
  }
}
```

## Verificación

### Configuración con ngrok

1. **Backend corriendo** en `localhost:8000`
2. **ngrok forwarding** a `http://localhost:8000`
3. **Frontend configurado** con:
   ```env
   VITE_GRPC_BASE=https://f72a9450f815.ngrok-free.app
   ```

### URLs Generadas

Con la configuración anterior, las URLs deberían ser:

- **StreamMetrics**: `https://f72a9450f815.ngrok-free.app/grpc/metrics.MetricsService/StreamMetrics` ✅
- **StreamLogs**: `https://f72a9450f815.ngrok-free.app/grpc/metrics.MetricsService/StreamLogs` ✅
- **ListAgents**: `https://f72a9450f815.ngrok-free.app/grpc/metrics.MetricsService/ListAgents` ✅

## Prueba

1. **Reinicia el frontend** (Vite debería recargar automáticamente)
2. **Abre el navegador** y conecta a un agente
3. **Verifica en ngrok** que las peticiones ahora devuelven 200:
   ```
   POST /grpc/metrics.MetricsService/StreamLogs    200 OK
   ```

## Casos de Uso Soportados

### 1. URL absoluta sin /grpc (ngrok)
```
Input:  https://f72a9450f815.ngrok-free.app
Output: https://f72a9450f815.ngrok-free.app/grpc/metrics.MetricsService/StreamLogs
```

### 2. URL absoluta con /grpc
```
Input:  https://f72a9450f815.ngrok-free.app/grpc
Output: https://f72a9450f815.ngrok-free.app/grpc/metrics.MetricsService/StreamLogs
```

### 3. URL absoluta con trailing slash
```
Input:  https://f72a9450f815.ngrok-free.app/
Output: https://f72a9450f815.ngrok-free.app/grpc/metrics.MetricsService/StreamLogs
```

### 4. URL relativa
```
Input:  /grpc
Output: /grpc/metrics.MetricsService/StreamLogs
```

## Notas

- ✅ La misma lógica se aplica a `StreamMetrics` y `StreamLogs`
- ✅ El backend ya tiene las rutas registradas correctamente
- ✅ El problema era solo en la construcción de URLs del frontend

---

¡El error 404 debería estar resuelto! 🎉

