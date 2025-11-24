# 🔧 Solución: Se Queda en "Conectando..."

## Problema

La aplicación se queda en estado "Conectando..." y no se conecta al servidor.

## Posibles Causas y Soluciones

### 1. URL del Servidor Incorrecta ✅

**Síntoma**: No hay actividad en Network tab, o errores de conexión.

**Solución**:
1. Abre la consola del navegador (F12 → Console)
2. Busca mensajes que empiecen con `[streamMetrics]`
3. Verifica la URL que se está usando

**Verificar configuración**:
```bash
# En el frontend, verifica el .env
cat frontend/.env

# Debería tener algo como:
# VITE_GRPC_BASE=http://IP_SERVIDOR:8000
# O para ngrok:
# VITE_GRPC_BASE=https://abc123.ngrok-free.app
```

### 2. Servidor No Está Accesible ✅

**Síntoma**: Timeout o "Failed to fetch" en la consola.

**Verificación**:
```bash
# Desde tu máquina local, prueba:
curl http://IP_SERVIDOR:8000/metrics.MetricsService/ListAgents \
  -H "Content-Type: application/json" \
  -d '{}'

# Si no funciona, el servidor no está accesible
```

**Soluciones**:
- Verificar que el servidor esté corriendo
- Verificar firewall (puerto 8000 abierto)
- Verificar que el servidor escuche en `0.0.0.0`, no solo `127.0.0.1`

### 3. CORS o Problemas de Red ✅

**Síntoma**: Error de CORS en la consola.

**Solución**: El backend ya incluye headers CORS, pero verifica que:
- El servidor esté corriendo
- No haya un proxy bloqueando

### 4. URL del Agente Remoto Mal Configurada ✅

**Síntoma**: Agente remoto configurado pero no conecta.

**Verificar**:
1. Abre la consola (F12)
2. Busca `[streamMetrics] Agent Endpoints:`
3. Verifica que el endpoint del agente esté correcto

**Formato correcto**:
- ✅ `http://192.168.1.100:8000`
- ✅ `http://192.168.1.100:8000/grpc`
- ✅ `https://abc123.ngrok-free.app`
- ❌ `192.168.1.100:8000` (falta http://)
- ❌ `http://192.168.1.100` (falta puerto)

### 5. Timeout de Conexión ✅

**Síntoma**: Se queda cargando y luego muestra timeout.

**Solución**: Se agregó timeout de 10 segundos. Si el servidor tarda más, puede ser:
- Servidor muy lento
- Problemas de red
- Firewall bloqueando

## Debugging

### Paso 1: Abrir Consola del Navegador

1. Presiona `F12` o `Cmd+Option+I` (Mac)
2. Ve a la pestaña **Console**
3. Busca errores en rojo

### Paso 2: Verificar Network Tab

1. Ve a la pestaña **Network**
2. Filtra por "StreamMetrics" o "XHR"
3. Busca la petición que falla
4. Haz clic y revisa:
   - **Status**: ¿200, 404, timeout?
   - **Headers**: ¿URL correcta?
   - **Response**: ¿Qué dice el error?

### Paso 3: Verificar URL Construida

En la consola deberías ver:
```
[streamMetrics] Agent ID: aa
[streamMetrics] Base URL: http://...
[streamMetrics] Final URL: http://.../grpc/metrics.MetricsService/StreamMetrics
```

Si la URL está mal, corrige la configuración del agente.

## Soluciones Rápidas

### Si usas Agente Remoto:

1. **Verifica el endpoint**:
   - Debe empezar con `http://` o `https://`
   - Debe incluir el puerto: `:8000`
   - Ejemplo correcto: `http://192.168.1.100:8000`

2. **Prueba la conexión manualmente**:
   ```bash
   curl http://IP_SERVIDOR:8000/metrics.MetricsService/ListAgents \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

3. **Verifica en la consola**:
   - Abre F12 → Console
   - Busca errores
   - Revisa la URL que se está usando

### Si usas ngrok:

1. **Verifica que ngrok esté corriendo** en el servidor
2. **Usa la URL HTTPS** de ngrok (no HTTP)
3. **Configura en frontend**:
   ```bash
   echo "VITE_GRPC_BASE=https://abc123.ngrok-free.app" > frontend/.env
   ```

## Mejoras Implementadas

✅ **Timeout de 10 segundos**: Evita que se quede cargando indefinidamente
✅ **Mejor manejo de errores**: Muestra mensajes más claros
✅ **Logging de debug**: Muestra URLs en la consola
✅ **Mensajes de error descriptivos**: Indica qué está mal

## Próximos Pasos

1. **Abre la consola del navegador** (F12)
2. **Revisa los mensajes** que empiezan con `[streamMetrics]`
3. **Copia el error** que aparece
4. **Verifica la URL** que se está usando
5. **Prueba la conexión** con curl desde tu máquina

---

**Con estos cambios, deberías ver mensajes más claros en la consola que te indican exactamente qué está fallando.** 🔍

