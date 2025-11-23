# 🎨 Actualizaciones del Frontend

## ✅ Cambios Implementados

### 1. **Streaming de Logs en Tiempo Real** 📝

- ✅ Nuevo componente `LogsViewer.tsx`
- ✅ Función `streamLogs()` en `grpc.ts`
- ✅ Estado de logs en `store.ts`
- ✅ Filtros por nivel (ERROR, WARNING, INFO, DEBUG)
- ✅ Búsqueda por patrón en mensajes
- ✅ Auto-scroll a nuevos logs
- ✅ Colores por nivel de log

**Ubicación**: Sección de logs al final del dashboard

### 2. **Soporte Multi-Agente** 🌐

- ✅ Campo `endpoint` en `Agent` para agentes remotos
- ✅ `agentEndpoints` en el store para mapear agentes a URLs
- ✅ Función `getAgentBaseUrl()` para seleccionar endpoint correcto
- ✅ `AgentSelector` mejorado con botón para agregar agentes remotos
- ✅ `streamMetrics()` y `streamLogs()` usan endpoints personalizados

**Cómo usar**:
1. Click en el botón `+` en el selector de agentes
2. Ingresa Agent ID (ej: "servidor-1")
3. Ingresa Endpoint (ej: "http://192.168.1.100:8000/grpc")
4. Click en "Agregar"
5. Selecciona el agente de la lista

### 3. **Mejoras en el Store** 📦

Nuevos campos:
- `logs: LogEntry[]` - Array de logs recibidos
- `addLog()` - Agregar log al array
- `clearLogs()` - Limpiar logs
- `logFilter` - Filtros de nivel y patrón
- `setLogFilter()` - Actualizar filtros
- `agentEndpoints` - Mapeo de agentes a endpoints
- `setAgentEndpoint()` - Agregar/actualizar endpoint

## 🎯 Funcionalidades Nuevas

### Visor de Logs

```tsx
<LogsViewer />
```

Características:
- Streaming en tiempo real
- Filtro por nivel (ERROR, WARNING, INFO, DEBUG)
- Búsqueda por texto
- Auto-scroll
- Colores por nivel
- Timestamps formateados

### Agregar Agentes Remotos

```tsx
// En AgentSelector
<button onClick={() => setShowAddAgent(true)}>+</button>
```

Permite agregar agentes que no están en la lista automática, especificando su endpoint manualmente.

## 📝 Ejemplo de Uso

### Conectar a Agente Remoto

1. **En el servidor remoto**:
```bash
export AGENT_ID="servidor-prod"
python -m app.server
```

2. **En el frontend**:
   - Click en `+` en el selector de agentes
   - Agent ID: `servidor-prod`
   - Endpoint: `http://IP-SERVIDOR:8000/grpc`
   - Click "Agregar"

3. **Seleccionar el agente** y ver métricas/logs en tiempo real

### Ver Logs Filtrados

1. Selecciona un agente
2. En el visor de logs:
   - Selecciona nivel (ej: "ERROR")
   - Escribe patrón de búsqueda (ej: "database")
3. Los logs se filtran automáticamente

## 🔧 Configuración Avanzada

### Endpoints por Defecto

Puedes configurar endpoints por defecto en el código:

```typescript
// frontend/src/lib/config.ts (crear si no existe)
export const DEFAULT_AGENT_ENDPOINTS: Record<string, string> = {
  'servidor-1': 'http://192.168.1.100:8000/grpc',
  'servidor-2': 'http://192.168.1.101:8000/grpc',
};
```

Y cargarlos al inicio:

```typescript
// En App.tsx
useEffect(() => {
  Object.entries(DEFAULT_AGENT_ENDPOINTS).forEach(([id, endpoint]) => {
    setAgentEndpoint(id, endpoint);
  });
}, []);
```

## 🐛 Troubleshooting

### Los logs no aparecen

- Verifica que el agente esté corriendo
- Verifica que el endpoint sea correcto
- Abre la consola del navegador para ver errores
- Verifica que el servidor tenga `ENABLE_HTTP_BRIDGE=1`

### No puedo agregar agente remoto

- Verifica que el endpoint tenga el formato correcto: `http://IP:PUERTO/grpc`
- Verifica que el servidor remoto esté accesible
- Verifica firewall/red

### Los logs se ven lentos

- Ajusta el intervalo en el backend
- Verifica la conexión de red
- Considera aumentar el buffer de logs

## 📊 Estructura de Datos

### LogEntry

```typescript
interface LogEntry {
  agent_id: string;
  timestamp_unix_ms: number;
  level: 'ERROR' | 'WARNING' | 'INFO' | 'DEBUG';
  source: string;
  message: string;
  metadata?: Record<string, string>;
}
```

### Agent con Endpoint

```typescript
interface Agent {
  agent_id: string;
  hostname: string;
  endpoint?: string;  // URL del endpoint (opcional)
}
```

---

**¡Listo!** El frontend ahora soporta logs en tiempo real y múltiples agentes remotos. 🎉

