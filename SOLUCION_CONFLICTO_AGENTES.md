# 🔧 Solución: Conflicto de Agentes

## Problema Detectado

El frontend tiene `local-machine` configurado con un endpoint remoto en `localStorage`, causando conflictos:

```
Agent Endpoints: {local-machine: 'https://98cf7bfce07a.ngrok-free.app'}
```

**Problemas**:
1. `local-machine` debería usar el endpoint local (`/grpc`), no un endpoint remoto
2. El agente `ngrok-1` no está en `localStorage`, solo en el backend
3. Cuando seleccionas `ngrok-1`, el frontend no encuentra su endpoint

---

## ✅ Solución Rápida

### Paso 1: Limpiar localStorage

Abre la consola del navegador (F12 → Console) y ejecuta:

```javascript
// Limpiar agentes mal configurados
localStorage.removeItem('AGENT_ENDPOINTS');

// O configurar correctamente:
localStorage.setItem('AGENT_ENDPOINTS', JSON.stringify({
  "ngrok-1": "https://f72a9450f815.ngrok-free.app/grpc"
}));

// Recargar
location.reload();
```

### Paso 2: Verificar Backend

El backend debe tener `ngrok-1` registrado en `KNOWN_AGENTS`:

```bash
# En run_local.sh debería estar:
export KNOWN_AGENTS=${KNOWN_AGENTS:-"ngrok-1:https://f72a9450f815.ngrok-free.app/grpc"}
```

### Paso 3: Verificar ListAgents

```bash
curl http://localhost:8000/metrics.MetricsService/ListAgents \
  -H "Content-Type: application/json" \
  -d '{}'
```

Debería devolver:
```json
{
  "agents": [
    {"agent_id": "local-machine", "hostname": "tu-maquina"},
    {"agent_id": "ngrok-1", "hostname": "f72a9450f815.ngrok-free.app"}
  ]
}
```

---

## 🔍 Análisis del Problema

### Estado Actual (Incorrecto):

**localStorage**:
```json
{
  "local-machine": "https://98cf7bfce07a.ngrok-free.app"
}
```

**Backend KNOWN_AGENTS**:
```
ngrok-1:https://f72a9450f815.ngrok-free.app/grpc
```

**Problema**: 
- `local-machine` está usando un endpoint remoto (incorrecto)
- `ngrok-1` no está en `localStorage` (solo en backend)

### Estado Correcto:

**localStorage** (opcional, solo si quieres agregar más):
```json
{
  "ngrok-1": "https://f72a9450f815.ngrok-free.app/grpc"
}
```

**Backend KNOWN_AGENTS**:
```
ngrok-1:https://f72a9450f815.ngrok-free.app/grpc
```

**Resultado**:
- `local-machine` usa endpoint local (automático)
- `ngrok-1` se descubre desde el backend
- Ambos funcionan correctamente

---

## 🎯 Solución Completa

### Opción 1: Solo Backend (Recomendado)

1. **Limpiar localStorage**:
   ```javascript
   localStorage.removeItem('AGENT_ENDPOINTS');
   location.reload();
   ```

2. **El backend ya tiene `ngrok-1` registrado**, así que aparecerá automáticamente

3. **Resultado**: 
   - `local-machine` → endpoint local (`/grpc`)
   - `ngrok-1` → endpoint remoto (desde backend)

### Opción 2: Backend + Frontend

Si quieres tener control desde el frontend también:

1. **Limpiar y configurar localStorage**:
   ```javascript
   localStorage.setItem('AGENT_ENDPOINTS', JSON.stringify({
     "ngrok-1": "https://f72a9450f815.ngrok-free.app/grpc"
   }));
   location.reload();
   ```

2. **El backend también tiene `ngrok-1`**, así que aparecerá dos veces (una del backend, una del frontend)

---

## 🔄 Flujo Correcto

### Agente Local (`local-machine`):
1. Backend responde con `agent_id: local-machine`
2. Frontend NO busca en `agentEndpoints` para agentes del backend
3. Frontend usa `GRPC_BASE_URL` (por defecto `/grpc`)
4. ✅ Funciona correctamente

### Agente Remoto (`ngrok-1`):
1. Backend responde con `agent_id: ngrok-1` (desde `KNOWN_AGENTS`)
2. Frontend busca en `agentEndpoints` para ver si hay configuración personalizada
3. Si no encuentra, usa `GRPC_BASE_URL`
4. ❌ Problema: `ngrok-1` necesita el endpoint remoto

**Solución**: El frontend debería usar el endpoint del backend cuando el agente viene de `ListAgents`.

---

## 🐛 Problema en el Código

El frontend no está usando la información del endpoint que viene del backend. Necesitamos mejorar la lógica para que:

1. Si el agente viene de `ListAgents` y tiene endpoint, usarlo
2. Si el agente está en `agentEndpoints`, usar ese (prioridad)
3. Si no, usar `GRPC_BASE_URL`

---

## ✅ Solución Inmediata

**Ejecuta esto en la consola del navegador**:

```javascript
// Limpiar configuración incorrecta
localStorage.removeItem('AGENT_ENDPOINTS');

// Recargar
location.reload();
```

Luego:
1. El backend devolverá `ngrok-1` en `ListAgents`
2. El frontend lo mostrará en el dropdown
3. Pero necesitarás agregar el endpoint manualmente o mejorar el código

---

## 🔧 Mejora del Código (Opcional)

Para que el frontend use automáticamente los endpoints del backend, necesitaríamos:

1. Guardar los endpoints de los agentes que vienen de `ListAgents`
2. Usar esos endpoints cuando no hay configuración en `localStorage`

¿Quieres que implemente esta mejora?

