# 🔧 Registro de Agentes en el Backend

## Problema Resuelto ✅

Ahora el backend puede **registrar y conocer múltiples agentes**, no solo su propio `AGENT_ID`. Esto permite que:

1. El backend conozca agentes remotos
2. `ListAgents` devuelva todos los agentes conocidos (local + remotos)
3. El frontend pueda descubrir todos los agentes desde el backend

---

## 📋 Configuración

### Método 1: Variable de Entorno (Recomendado)

Al ejecutar `./run_local.sh`, puedes configurar agentes conocidos:

```bash
export KNOWN_AGENTS="ngrok-1:https://98cf7bfce07a.ngrok-free.app/grpc,ngrok-2:https://f72a9450f815.ngrok-free.app/grpc"
./run_local.sh
```

**O en una sola línea**:
```bash
KNOWN_AGENTS="ngrok-1:https://98cf7bfce07a.ngrok-free.app/grpc,ngrok-2:https://f72a9450f815.ngrok-free.app/grpc" ./run_local.sh
```

### Método 2: Editar `run_local.sh`

Edita el archivo `backend/run_local.sh` y descomenta/agrega:

```bash
export KNOWN_AGENTS="ngrok-1:https://98cf7bfce07a.ngrok-free.app/grpc,ngrok-2:https://f72a9450f815.ngrok-free.app/grpc"
```

---

## 📝 Formato

### Sintaxis

```
KNOWN_AGENTS="agent_id1:endpoint1,agent_id2:endpoint2,agent_id3:endpoint3"
```

### Ejemplos

**Un agente remoto**:
```bash
export KNOWN_AGENTS="servidor-remoto:http://192.168.1.100:8000/grpc"
```

**Múltiples agentes remotos**:
```bash
export KNOWN_AGENTS="ngrok-1:https://98cf7bfce07a.ngrok-free.app/grpc,ngrok-2:https://f72a9450f815.ngrok-free.app/grpc,servidor-1:http://192.168.1.50:8000/grpc"
```

**Con espacios (se ignoran automáticamente)**:
```bash
export KNOWN_AGENTS="ngrok-1:https://98cf7bfce07a.ngrok-free.app/grpc, ngrok-2:https://f72a9450f815.ngrok-free.app/grpc"
```

---

## ✅ Verificación

### 1. Verificar que el Backend Conoce los Agentes

**Desde la terminal**:
```bash
curl http://localhost:8000/metrics.MetricsService/ListAgents \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Respuesta esperada**:
```json
{
  "agents": [
    {
      "agent_id": "local-machine",
      "hostname": "tu-maquina"
    },
    {
      "agent_id": "ngrok-1",
      "hostname": "98cf7bfce07a.ngrok-free.app"
    },
    {
      "agent_id": "ngrok-2",
      "hostname": "f72a9450f815.ngrok-free.app"
    }
  ]
}
```

### 2. Verificar en el Frontend

1. **Abre el frontend** en el navegador
2. **Abre el dropdown de agentes**
3. **Deberías ver**:
   - `local-machine (local-machine)` ← Agente local
   - `ngrok-1 (ngrok-1)` ← Agente remoto registrado
   - `ngrok-2 (ngrok-2)` ← Agente remoto registrado

**Nota**: Los agentes registrados en el backend aparecen **sin** `[Remoto]` porque el backend los conoce directamente.

---

## 🔄 Flujo Completo

### Antes (Solo Frontend):

1. Frontend guarda agentes en `localStorage`
2. Backend solo conoce su propio `AGENT_ID`
3. `ListAgents` solo devuelve 1 agente

### Ahora (Backend + Frontend):

1. **Backend registra agentes** mediante `KNOWN_AGENTS`
2. **Backend conoce múltiples agentes** (local + remotos)
3. **`ListAgents` devuelve todos** los agentes conocidos
4. **Frontend descubre automáticamente** todos los agentes desde el backend
5. **Frontend puede agregar más** agentes manualmente (se guardan en `localStorage`)

---

## 🎯 Ejemplo Completo

### Configurar los 3 Agentes

**En el backend** (`run_local.sh` o variable de entorno):
```bash
export KNOWN_AGENTS="ngrok-1:https://98cf7bfce07a.ngrok-free.app/grpc,ngrok-2:https://f72a9450f815.ngrok-free.app/grpc"
export AGENT_ID="local-machine"
./run_local.sh
```

**Resultado**:
- ✅ Backend conoce 3 agentes: `local-machine`, `ngrok-1`, `ngrok-2`
- ✅ `ListAgents` devuelve los 3 agentes
- ✅ Frontend los descubre automáticamente
- ✅ No necesitas configurarlos manualmente en el frontend

---

## 🔍 Diferencias: Backend vs Frontend

### Agentes Registrados en el Backend (`KNOWN_AGENTS`):
- ✅ Se descubren automáticamente en el frontend
- ✅ Aparecen en `ListAgents`
- ✅ Disponibles para todos los clientes
- ✅ Persisten mientras el backend esté corriendo

### Agentes Registrados en el Frontend (`localStorage`):
- ✅ Específicos del navegador/usuario
- ✅ Persisten entre sesiones del navegador
- ✅ No aparecen en `ListAgents` del backend
- ✅ Útiles para agentes temporales o específicos del usuario

---

## 💡 Recomendación

**Para agentes compartidos/estables**: Usa `KNOWN_AGENTS` en el backend
**Para agentes temporales/personales**: Usa el registro manual en el frontend

---

## 🐛 Troubleshooting

### Problema: Los agentes no aparecen en `ListAgents`

**Solución**:
1. Verifica el formato de `KNOWN_AGENTS` (debe ser `agent_id:endpoint`)
2. Verifica que no haya espacios extra o caracteres especiales
3. Reinicia el backend después de cambiar `KNOWN_AGENTS`

### Problema: El formato es incorrecto

**Formato correcto**:
```
agent_id:endpoint
```

**Ejemplos correctos**:
- ✅ `ngrok-1:https://abc.ngrok-free.app/grpc`
- ✅ `servidor:http://192.168.1.100:8000/grpc`
- ❌ `ngrok-1=https://abc.ngrok-free.app/grpc` (usa `:` no `=`)
- ❌ `ngrok-1 https://abc.ngrok-free.app/grpc` (falta `:`)

---

¡Ahora el backend puede registrar y conocer múltiples agentes! 🎉

