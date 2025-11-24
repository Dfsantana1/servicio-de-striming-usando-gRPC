# 🌐 Configuración con ngrok

Guía para exponer tu backend gRPC a internet usando ngrok.

## 📋 Requisitos Previos

1. **Cuenta de ngrok**: Regístrate en [ngrok.com](https://ngrok.com) (gratis)
2. **ngrok instalado**: `brew install ngrok` (macOS) o descarga desde [ngrok.com/download](https://ngrok.com/download)

## 🚀 Pasos Rápidos

### 1. Iniciar el Backend

En la máquina donde quieres exponer el backend:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Regenerar protobuf
python -m grpc_tools.protoc -I proto --python_out=app --grpc_python_out=app proto/metrics.proto

# Configurar y ejecutar
export AGENT_ID="remote-server"
export HTTP_BRIDGE_PORT=8000
export ENABLE_HTTP_BRIDGE=1
python -m app.server
```

El backend debería estar corriendo en `http://localhost:8000`.

### 2. Iniciar ngrok

En otra terminal (o en la misma máquina):

```bash
# Autenticarse (solo la primera vez)
ngrok config add-authtoken <tu-token-de-ngrok>

# Exponer el puerto 8000
ngrok http 8000
```

Verás algo como:

```
Forwarding    https://abc123.ngrok-free.app -> http://localhost:8000
```

**Copia la URL HTTPS** (ej: `https://abc123.ngrok-free.app`)

### 3. Configurar el Frontend

En tu máquina local (donde está el frontend):

```bash
cd frontend

# Crear archivo .env con la URL de ngrok
echo "VITE_GRPC_BASE=https://abc123.ngrok-free.app" > .env

# Reiniciar el servidor de desarrollo
npm run dev
```

**Reemplaza `abc123.ngrok-free.app` con tu URL de ngrok.**

### 4. Verificar Conexión

Prueba desde tu máquina local:

```bash
# Probar ListAgents
curl https://abc123.ngrok-free.app/metrics.MetricsService/ListAgents \
  -H "Content-Type: application/json" \
  -d '{}'

# Deberías recibir:
# {"agents": [{"agent_id": "remote-server", "hostname": "..."}]}
```

## 🔧 Configuración Avanzada

### Usar Dominio Personalizado (ngrok Pro)

Si tienes ngrok Pro, puedes usar un dominio personalizado:

```bash
ngrok http 8000 --domain=monitor.miempresa.com
```

### Configurar Autenticación

Si tu backend requiere autenticación:

```bash
# En el backend
export API_TOKEN="mi-token-secreto"

# En el frontend, edita src/lib/grpc.ts para pasar el token
```

### Usar ngrok con Configuración Personalizada

Crea un archivo `ngrok.yml`:

```yaml
version: "2"
authtoken: <tu-token>
tunnels:
  metrics:
    addr: 8000
    proto: http
    hostname: monitor.miempresa.com  # Solo si tienes Pro
```

Ejecuta:
```bash
ngrok start metrics
```

## 🐛 Troubleshooting

### Error 404 en las rutas

**Problema**: Las rutas `/grpc/metrics.MetricsService/...` devuelven 404.

**Solución**: El backend ahora soporta ambas rutas (con y sin `/grpc`). Asegúrate de usar la versión actualizada del código.

### Error: "ngrok free account limitations"

**Problema**: ngrok Free tiene limitaciones:
- URLs temporales (cambian cada vez)
- Límite de conexiones
- Banner de advertencia

**Solución**: 
- Usa ngrok Pro para URLs estables
- O configura un dominio propio con reverse proxy

### Error: "Connection refused"

**Problema**: ngrok no puede conectar al puerto 8000.

**Solución**:
1. Verifica que el backend esté corriendo: `curl http://localhost:8000/metrics.MetricsService/ListAgents -H "Content-Type: application/json" -d '{}'`
2. Verifica que el puerto sea correcto: `netstat -an | grep 8000`

### Error CORS

**Problema**: El navegador bloquea las peticiones por CORS.

**Solución**: El backend ahora incluye headers CORS automáticamente. Si persiste, verifica que estés usando HTTPS (ngrok usa HTTPS por defecto).

### Banner de ngrok en el navegador

**Problema**: ngrok muestra un banner de advertencia en el navegador.

**Solución**: 
- Usa ngrok Pro para remover el banner
- O configura un dominio personalizado

## 📝 Ejemplo Completo

### Terminal 1 (Backend):
```bash
cd backend
source venv/bin/activate
export HTTP_BRIDGE_PORT=8000
export ENABLE_HTTP_BRIDGE=1
python -m app.server
```

### Terminal 2 (ngrok):
```bash
ngrok http 8000
# Copia la URL: https://abc123.ngrok-free.app
```

### Terminal 3 (Frontend):
```bash
cd frontend
echo "VITE_GRPC_BASE=https://abc123.ngrok-free.app" > .env
npm run dev
```

### Navegador:
```
http://localhost:5173
```

## 🔐 Seguridad

⚠️ **Importante**: ngrok expone tu backend a internet. Considera:

1. **Habilitar autenticación**:
   ```bash
   export API_TOKEN="token-seguro"
   ```

2. **Usar HTTPS**: ngrok ya lo proporciona automáticamente

3. **Limitar acceso**: Usa ngrok con autenticación básica:
   ```bash
   ngrok http 8000 --basic-auth="usuario:password"
   ```

4. **Firewall**: Asegúrate de que solo ngrok pueda acceder al puerto 8000 localmente

## 🎯 Alternativas a ngrok

Si ngrok no te funciona, considera:

- **Cloudflare Tunnel**: Gratis, sin límites
- **localtunnel**: Alternativa open source
- **serveo**: SSH-based tunneling
- **Reverse proxy propio**: Nginx + dominio propio

---

¡Listo! Tu backend ahora está accesible desde internet. 🚀

