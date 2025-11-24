# 📝 Guía: Cómo Registrar Agentes

Esta guía explica cómo registrar y configurar agentes (locales y remotos) en el sistema de monitoreo.

---

## 🔍 Tipos de Agentes

### 1. **Agentes Locales** (Auto-descubiertos)
- Se detectan automáticamente cuando el backend responde
- No requieren configuración manual
- Aparecen en el dropdown automáticamente

### 2. **Agentes Remotos** (Configuración manual)
- Requieren configuración manual desde el frontend
- Permiten conectarse a servidores externos
- Se guardan en `localStorage` y persisten entre sesiones

---

## 🖥️ Agentes Locales (Auto-descubiertos)

### Configuración en el Backend

Los agentes locales se registran automáticamente cuando el backend responde a `ListAgents`. El backend usa su `AGENT_ID` configurado.

**Ejemplo de configuración**:

```bash
# En el servidor backend
export AGENT_ID="servidor-produccion"
export HOSTNAME="servidor-01"
export HTTP_BRIDGE_PORT=8000
export ENABLE_HTTP_BRIDGE=1

# Ejecutar el servidor
python -m app.server
```

**El frontend automáticamente**:
- Llama a `ListAgents` cada 30 segundos
- Descubre el agente con `agent_id: "servidor-produccion"`
- Lo muestra en el dropdown sin configuración adicional

---

## 🌐 Agentes Remotos (Configuración Manual)

### Método 1: Desde la Interfaz Web

1. **Abre la aplicación** en el navegador
2. **Haz clic en el botón "+"** junto al label "Agente"
3. **Completa el formulario**:
   - **Agent ID**: Un identificador único (ej: `servidor-1`, `produccion`, `aaa`)
   - **Endpoint**: La URL completa del servidor (ej: `http://192.168.1.100:8000/grpc`)
4. **Haz clic en "Agregar"**

**Ejemplo**:
```
Agent ID: servidor-remoto
Endpoint: http://192.168.1.100:8000/grpc
```

**O con ngrok**:
```
Agent ID: servidor-ngrok
Endpoint: https://abc123.ngrok-free.app/grpc
```

### Método 2: Desde localStorage (Avanzado)

Puedes agregar agentes directamente editando `localStorage`:

1. **Abre DevTools** (F12)
2. **Ve a Application → Local Storage**
3. **Busca la clave `AGENT_ENDPOINTS`**
4. **Edita el valor JSON**:

```json
{
  "servidor-1": "http://192.168.1.100:8000/grpc",
  "servidor-2": "http://192.168.1.101:8000/grpc",
  "ngrok": "https://abc123.ngrok-free.app/grpc"
}
```

5. **Recarga la página** (F5)

---

## 📋 Formato de Endpoints

### URLs Correctas ✅

```
http://192.168.1.100:8000/grpc
http://192.168.1.100:8000
https://abc123.ngrok-free.app/grpc
https://abc123.ngrok-free.app
http://monitor.miempresa.com/grpc
```

### URLs Incorrectas ❌

```
192.168.1.100:8000          (falta http://)
http://192.168.1.100        (falta puerto)
http://192.168.1.100:8000/  (trailing slash puede causar problemas)
```

**Nota**: El sistema automáticamente agrega `/grpc` si falta, pero es mejor incluirlo explícitamente.

---

## 🔧 Configuración de Múltiples Agentes

### Escenario 1: Múltiples Servidores Locales

Cada servidor debe tener un `AGENT_ID` único:

**Servidor 1**:
```bash
export AGENT_ID="servidor-1"
export HTTP_BRIDGE_PORT=8000
python -m app.server
```

**Servidor 2**:
```bash
export AGENT_ID="servidor-2"
export HTTP_BRIDGE_PORT=8001
python -m app.server
```

**Frontend**: Se conecta a cada servidor según el `AGENT_ID` seleccionado.

### Escenario 2: Servidor Local + Servidor Remoto

**Servidor Local** (auto-descubierto):
- `AGENT_ID="local"`
- Puerto: `8000`
- Se descubre automáticamente

**Servidor Remoto** (configuración manual):
- Agent ID: `remoto`
- Endpoint: `http://192.168.1.100:8000/grpc`
- Se agrega desde el frontend

---

## 🗑️ Eliminar Agentes Remotos

### Desde la Interfaz

1. **Selecciona el agente remoto** en el dropdown
2. **Haz clic en el botón "×"** que aparece junto al selector
3. **Confirma la eliminación**

### Desde localStorage

1. **Abre DevTools** (F12)
2. **Ve a Application → Local Storage**
3. **Edita `AGENT_ENDPOINTS`** y elimina la entrada
4. **Recarga la página**

---

## ✅ Verificación

### Verificar que un Agente Está Registrado

1. **Abre el dropdown de agentes** en el frontend
2. **Busca el agente** en la lista
3. **Los agentes remotos** muestran `[Remoto]` junto al nombre

### Verificar la Configuración

**Desde la consola del navegador** (F12 → Console):
```javascript
// Ver agentes guardados
JSON.parse(localStorage.getItem('AGENT_ENDPOINTS'))
```

**Salida esperada**:
```json
{
  "servidor-1": "http://192.168.1.100:8000/grpc",
  "servidor-2": "http://192.168.1.101:8000/grpc"
}
```

### Probar la Conexión

1. **Selecciona el agente** en el dropdown
2. **Observa el estado de conexión**:
   - ✅ "Conectado" = Agente funcionando
   - ⏳ "Conectando..." = Intentando conectar
   - ❌ "Error de conexión" = Problema de red/servidor

---

## 🐛 Troubleshooting

### Problema: El agente no aparece después de agregarlo

**Solución**:
1. Verifica que el formato del endpoint sea correcto
2. Recarga la página (F5)
3. Verifica en DevTools → Application → Local Storage que `AGENT_ENDPOINTS` tenga el agente

### Problema: "Cannot connect to..." error

**Causas posibles**:
- El servidor remoto no está corriendo
- El endpoint está mal configurado
- Problemas de firewall/red
- El servidor no escucha en `0.0.0.0`

**Solución**:
1. Verifica que el servidor esté corriendo: `curl http://IP:8000/metrics.MetricsService/ListAgents`
2. Verifica el endpoint en el frontend
3. Verifica que el firewall permita conexiones al puerto 8000

### Problema: El agente se pierde al recargar

**Solución**: Ya está resuelto - los agentes ahora se guardan en `localStorage` automáticamente. Si aún se pierden:
1. Verifica que `localStorage` esté habilitado en tu navegador
2. Verifica que no estés en modo incógnito (algunos navegadores bloquean localStorage)

---

## 📝 Ejemplos Completos

### Ejemplo 1: Agregar Servidor Remoto con IP

```
Agent ID: produccion
Endpoint: http://192.168.1.50:8000/grpc
```

### Ejemplo 2: Agregar Servidor con ngrok

```
Agent ID: desarrollo-ngrok
Endpoint: https://f72a9450f815.ngrok-free.app/grpc
```

### Ejemplo 3: Agregar Servidor con Dominio

```
Agent ID: servidor-empresa
Endpoint: http://monitor.miempresa.com/grpc
```

---

## 🎯 Resumen Rápido

### Para Agregar un Agente Remoto:

1. **Clic en "+"** junto a "Agente"
2. **Ingresa Agent ID** (ej: `servidor-1`)
3. **Ingresa Endpoint** (ej: `http://192.168.1.100:8000/grpc`)
4. **Clic en "Agregar"**
5. ✅ **Se guarda automáticamente** en `localStorage`

### Para Eliminar un Agente Remoto:

1. **Selecciona el agente** en el dropdown
2. **Clic en "×"** junto al selector
3. **Confirma la eliminación**

---

¡Listo! Ahora sabes cómo registrar y gestionar agentes en el sistema. 🎉

