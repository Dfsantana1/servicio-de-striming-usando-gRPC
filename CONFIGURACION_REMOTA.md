# 🌐 Guía: Ejecutar Backend en Máquina Remota

Esta guía explica cómo ejecutar el backend en otra máquina y conectarlo desde tu frontend local.

## 📋 Escenario

- **Máquina Remota (Backend)**: Ejecuta el servidor gRPC (ej: `192.168.1.100`)
- **Tu Máquina (Frontend)**: Ejecuta el frontend React que se conecta al backend remoto

---

## 🖥️ Parte 1: Configurar Backend en Máquina Remota

### Opción A: Ejecutar con Docker (Recomendado)

En la **máquina remota**, clona el repositorio y ejecuta solo el backend:

```bash
# 1. Clonar el repositorio
git clone <tu-repo-url>
cd servicio-de-striming-usando-gRPC

# 2. Ejecutar solo el backend con Docker
docker compose up backend1 --build

# O si quieres exponer el puerto directamente:
docker run -d \
  --name rpc-monitor-backend \
  -p 50051:50051 \
  -p 8000:8000 \
  -e AGENT_ID=remote-machine \
  -e HOSTNAME=$(hostname) \
  -e GRPC_PORT=50051 \
  -e ENABLE_HTTP_BRIDGE=1 \
  -e HTTP_BRIDGE_PORT=8000 \
  rpc-monitor-backend1
```

### Opción B: Ejecutar Localmente (Sin Docker)

En la **máquina remota**:

```bash
# 1. Clonar el repositorio
git clone <tu-repo-url>
cd servicio-de-striming-usando-gRPC/backend

# 2. Crear entorno virtual
python3 -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate

# 3. Instalar dependencias
pip install -r requirements.txt

# 4. Regenerar stubs de protobuf
python -m grpc_tools.protoc -I proto --python_out=app --grpc_python_out=app proto/metrics.proto

# 5. Configurar variables de entorno
export AGENT_ID="remote-machine"
export HOSTNAME=$(hostname)
export GRPC_PORT=50051
export HTTP_BRIDGE_PORT=8000
export ENABLE_HTTP_BRIDGE=1

# 6. Ejecutar el servidor
python -m app.server
```

### Verificar que el Backend Funciona

En la **máquina remota**, verifica que los puertos estén abiertos:

```bash
# Verificar que el servidor está escuchando
netstat -an | grep 50051
netstat -an | grep 8000

# O con ss (Linux moderno)
ss -tlnp | grep 50051
ss -tlnp | grep 8000

# Probar el endpoint HTTP Bridge
curl http://localhost:8000/metrics.MetricsService/ListAgents \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Configurar Firewall (Importante!)

En la **máquina remota**, abre los puertos necesarios:

**Linux (ufw):**
```bash
sudo ufw allow 50051/tcp
sudo ufw allow 8000/tcp
sudo ufw status
```

**Linux (firewalld):**
```bash
sudo firewall-cmd --permanent --add-port=50051/tcp
sudo firewall-cmd --permanent --add-port=8000/tcp
sudo firewall-cmd --reload
```

**macOS:**
```bash
# macOS generalmente no bloquea puertos, pero verifica en:
# System Preferences > Security & Privacy > Firewall
```

**Windows:**
- Abre "Windows Defender Firewall"
- Agrega reglas de entrada para puertos 50051 y 8000

---

## 💻 Parte 2: Configurar Frontend en Tu Máquina

### Opción 1: Usar Variable de Entorno (Recomendado)

Crea un archivo `.env` en la carpeta `frontend/`:

```bash
cd frontend
```

Crea el archivo `.env`:

```env
# .env
VITE_GRPC_BASE=http://192.168.1.100:8000
```

**Reemplaza `192.168.1.100` con la IP de tu máquina remota.**

### Opción 2: Modificar vite.config.ts

Edita `frontend/vite.config.ts` y cambia el proxy:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/grpc': {
        target: 'http://192.168.1.100:8000',  // ← IP de la máquina remota
        changeOrigin: true,
        ws: false,
        rewrite: (path) => path.replace(/^\/grpc/, ''),
      }
    }
  }
})
```

### Opción 3: Modificar grpc.ts Directamente

Si no quieres usar variables de entorno, edita `frontend/src/lib/grpc.ts`:

```typescript
// Cambiar esta línea (línea 15):
const GRPC_BASE_URL: string = ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_GRPC_BASE) || "/grpc";

// Por:
const GRPC_BASE_URL: string = "http://192.168.1.100:8000";  // ← IP de la máquina remota
```

---

## 🚀 Parte 3: Ejecutar Frontend

En **tu máquina local**:

```bash
cd frontend

# Si usaste .env, reinicia el servidor de desarrollo
npm run dev

# O si modificaste vite.config.ts directamente
npm run dev
```

El frontend debería conectarse automáticamente a `http://192.168.1.100:8000`.

---

## 🔍 Verificar Conexión

### Desde tu máquina local, prueba:

```bash
# Probar el endpoint HTTP Bridge
curl http://192.168.1.100:8000/metrics.MetricsService/ListAgents \
  -H "Content-Type: application/json" \
  -d '{}'

# Deberías recibir algo como:
# {"agents": [{"agent_id": "remote-machine", "hostname": "..."}]}
```

### En el navegador:

1. Abre `http://localhost:5173` (o el puerto que use Vite)
2. Deberías ver el frontend
3. Haz clic en "Conectar" o selecciona un agente
4. Las métricas deberían aparecer desde la máquina remota

---

## 🔐 Autenticación (Opcional)

Si configuraste autenticación en el backend:

### En la máquina remota:
```bash
export API_TOKEN="mi-token-secreto"
```

### En el frontend, edita `frontend/src/lib/grpc.ts`:

```typescript
export async function* streamMetrics(
  intervalMs: number,
  agentId?: string,
  authToken?: string,  // ← Pasar el token aquí
  agentEndpoints?: Record<string, string>
) {
  // ... código existente ...
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  // ...
}
```

Y en tu componente React:
```typescript
const token = "mi-token-secreto";
for await (const snapshot of streamMetrics(1000, "remote-machine", token)) {
  // ...
}
```

---

## 🌍 Conectar desde Internet (Producción)

Si quieres conectarte desde internet (no solo LAN):

### 1. Configurar DNS o IP Pública

- Usa la IP pública de la máquina remota
- O configura un dominio (ej: `monitor.miempresa.com`)

### 2. Usar HTTPS (Recomendado)

```bash
# En la máquina remota, usa un reverse proxy con SSL (Nginx, Caddy, etc.)
# Ejemplo con Caddy:
monitor.miempresa.com {
    reverse_proxy localhost:8000
}
```

### 3. Actualizar Frontend

```env
# .env
VITE_GRPC_BASE=https://monitor.miempresa.com
```

---

## 🐛 Troubleshooting

### Error: "Connection refused"

**Causa**: El puerto no está abierto o el firewall bloquea.

**Solución**:
```bash
# En la máquina remota, verifica:
netstat -an | grep 8000

# Si no aparece, el servidor no está corriendo
# Si aparece pero solo 127.0.0.1, el servidor solo escucha localmente
```

**Solución**: Asegúrate de que el servidor escuche en `0.0.0.0`:
```python
# En server.py, línea 363:
port = f"[::]:{config.GRPC_PORT}"  # ← Esto escucha en todas las interfaces
```

### Error: "CORS policy"

**Causa**: El backend no permite CORS desde tu origen.

**Solución**: El HTTP Bridge ya incluye headers CORS, pero si usas el backend directamente, agrega:

```python
# En server.py, en la función run_http_bridge():
add_header Access-Control-Allow-Origin *;
```

### Error: "Network Error" o "Failed to fetch"

**Causa**: La IP o puerto son incorrectos.

**Solución**:
1. Verifica la IP de la máquina remota: `ip addr` (Linux) o `ifconfig` (macOS)
2. Verifica que el puerto sea correcto: `netstat -an | grep 8000`
3. Prueba con curl desde tu máquina local

### Error: "UNAUTHENTICATED"

**Causa**: El backend requiere autenticación pero no enviaste token.

**Solución**: 
- Deshabilita auth en el backend: `unset API_TOKEN`
- O envía el token en el frontend

---

## 📝 Resumen Rápido

### Máquina Remota:
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
export AGENT_ID=remote-machine
export HTTP_BRIDGE_PORT=8000
export ENABLE_HTTP_BRIDGE=1
python -m app.server
```

### Tu Máquina:
```bash
cd frontend
echo "VITE_GRPC_BASE=http://<IP_REMOTA>:8000" > .env
npm run dev
```

---

¡Listo! Ahora tu frontend se conecta al backend remoto. 🎉

