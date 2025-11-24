# 🖥️ Despliegue en Servidor Externo

Guía completa para ejecutar el backend en un servidor remoto y conectarlo desde tu máquina local.

## 📋 Requisitos del Servidor

- **OS**: Linux (Ubuntu/Debian recomendado) o macOS
- **Python**: 3.11+ 
- **Memoria**: Mínimo 512MB RAM
- **CPU**: 1 core mínimo
- **Red**: Puerto 8000 (HTTP Bridge) y opcionalmente 50051 (gRPC) abiertos

---

## 🚀 Opción 1: Instalación Directa (Recomendado para Desarrollo)

### Paso 1: Conectar al Servidor

```bash
ssh usuario@servidor-externo.com
```

### Paso 2: Clonar el Repositorio

```bash
# En el servidor
git clone <tu-repo-url>
cd servicio-de-striming-usando-gRPC/backend
```

### Paso 3: Instalar Dependencias

```bash
# Crear entorno virtual
python3 -m venv venv
source venv/bin/activate

# Instalar dependencias
pip install --upgrade pip
pip install -r requirements.txt
```

### Paso 4: Regenerar Protobuf

```bash
python -m grpc_tools.protoc -I proto --python_out=app --grpc_python_out=app proto/metrics.proto

# Corregir importaciones (si es necesario)
sed -i 's/^import metrics_pb2 as metrics__pb2$/from app import metrics_pb2 as metrics__pb2/' app/metrics_pb2_grpc.py
```

### Paso 5: Configurar Variables de Entorno

```bash
# Crear archivo .env o exportar variables
export AGENT_ID="servidor-remoto"
export HOSTNAME=$(hostname)
export GRPC_PORT=50051
export HTTP_BRIDGE_PORT=8000
export ENABLE_HTTP_BRIDGE=1
export LOG_LEVEL=INFO

# Opcional: Autenticación
# export API_TOKEN="tu-token-secreto"
```

### Paso 6: Configurar Firewall

**Ubuntu/Debian (ufw)**:
```bash
sudo ufw allow 8000/tcp
sudo ufw allow 50051/tcp  # Opcional, solo si usas gRPC directo
sudo ufw status
```

**CentOS/RHEL (firewalld)**:
```bash
sudo firewall-cmd --permanent --add-port=8000/tcp
sudo firewall-cmd --permanent --add-port=50051/tcp
sudo firewall-cmd --reload
```

### Paso 7: Ejecutar el Servidor

```bash
# En el servidor, dentro del venv
python -m app.server
```

**Verificar que escucha en todas las interfaces**:
```bash
# Deberías ver algo como:
# Starting gRPC server on [::]:50051
# HTTP bridge started on 0.0.0.0:8000
```

---

## 🐳 Opción 2: Usando Docker (Recomendado para Producción)

### Paso 1: Instalar Docker en el Servidor

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Verificar
docker --version
```

### Paso 2: Clonar y Construir

```bash
# En el servidor
git clone <tu-repo-url>
cd servicio-de-striming-usando-gRPC/backend

# Construir imagen
docker build -t rpc-monitor-backend .
```

### Paso 3: Ejecutar Contenedor

```bash
docker run -d \
  --name rpc-monitor-backend \
  --restart unless-stopped \
  -p 8000:8000 \
  -p 50051:50051 \
  -e AGENT_ID=servidor-remoto \
  -e HOSTNAME=$(hostname) \
  -e GRPC_PORT=50051 \
  -e HTTP_BRIDGE_PORT=8000 \
  -e ENABLE_HTTP_BRIDGE=1 \
  -e LOG_LEVEL=INFO \
  rpc-monitor-backend
```

### Paso 4: Verificar

```bash
# Ver logs
docker logs -f rpc-monitor-backend

# Verificar que está corriendo
docker ps | grep rpc-monitor
```

---

## 🔧 Opción 3: Como Servicio Systemd (Producción)

### Paso 1: Crear Archivo de Servicio

```bash
sudo nano /etc/systemd/system/rpc-monitor.service
```

Contenido:
```ini
[Unit]
Description=gRPC Metrics Monitor Server
After=network.target

[Service]
Type=simple
User=tu-usuario
WorkingDirectory=/home/tu-usuario/servicio-de-striming-usando-gRPC/backend
Environment="PATH=/home/tu-usuario/servicio-de-striming-usando-gRPC/backend/venv/bin"
Environment="AGENT_ID=servidor-remoto"
Environment="HOSTNAME=%H"
Environment="GRPC_PORT=50051"
Environment="HTTP_BRIDGE_PORT=8000"
Environment="ENABLE_HTTP_BRIDGE=1"
Environment="LOG_LEVEL=INFO"
ExecStart=/home/tu-usuario/servicio-de-striming-usando-gRPC/backend/venv/bin/python -m app.server
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Ajusta las rutas según tu instalación.**

### Paso 2: Activar y Iniciar

```bash
# Recargar systemd
sudo systemctl daemon-reload

# Habilitar al inicio
sudo systemctl enable rpc-monitor

# Iniciar servicio
sudo systemctl start rpc-monitor

# Verificar estado
sudo systemctl status rpc-monitor

# Ver logs
sudo journalctl -u rpc-monitor -f
```

---

## 🌐 Configurar Frontend Local para Conectarse al Servidor Remoto

### Opción A: Usar IP del Servidor

```bash
cd frontend

# Crear archivo .env
echo "VITE_GRPC_BASE=http://IP_DEL_SERVIDOR:8000" > .env

# Ejemplo:
# echo "VITE_GRPC_BASE=http://192.168.1.100:8000" > .env
# O con dominio:
# echo "VITE_GRPC_BASE=http://monitor.miempresa.com:8000" > .env
```

### Opción B: Usar ngrok en el Servidor Remoto

Si el servidor remoto no tiene IP pública, puedes usar ngrok:

**En el servidor remoto**:
```bash
# Instalar ngrok
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar -xzf ngrok-v3-stable-linux-amd64.tgz
sudo mv ngrok /usr/local/bin/

# Autenticar
ngrok config add-authtoken <tu-token>

# Exponer puerto 8000
ngrok http 8000
```

**En tu máquina local**:
```bash
cd frontend
echo "VITE_GRPC_BASE=https://abc123.ngrok-free.app" > .env
```

### Opción C: Usar Dominio con Reverse Proxy

Si tienes un dominio, configura Nginx:

```nginx
# /etc/nginx/sites-available/rpc-monitor
server {
    listen 80;
    server_name monitor.tudominio.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Luego:
```bash
sudo ln -s /etc/nginx/sites-available/rpc-monitor /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Y en el frontend:
```bash
echo "VITE_GRPC_BASE=http://monitor.tudominio.com" > .env
```

---

## ✅ Verificación

### Desde tu Máquina Local

```bash
# Probar conexión HTTP Bridge
curl http://IP_DEL_SERVIDOR:8000/metrics.MetricsService/ListAgents \
  -H "Content-Type: application/json" \
  -d '{}'

# Deberías recibir:
# {"agents": [{"agent_id": "servidor-remoto", "hostname": "..."}]}
```

### Verificar que el Servidor Escucha Correctamente

**En el servidor remoto**:
```bash
# Verificar puertos
sudo netstat -tlnp | grep -E '8000|50051'

# Deberías ver:
# tcp6  0  0 :::8000   :::*   LISTEN   <pid>/python
# tcp6  0  0 :::50051  :::*   LISTEN   <pid>/python
```

**Importante**: Debe escuchar en `0.0.0.0` o `[::]`, NO solo en `127.0.0.1`.

---

## 🔒 Seguridad (Producción)

### 1. Habilitar Autenticación

```bash
# En el servidor
export API_TOKEN="token-super-seguro-aleatorio"
```

### 2. Usar HTTPS

Configura SSL/TLS con Let's Encrypt:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d monitor.tudominio.com
```

### 3. Limitar Acceso por IP (Opcional)

```bash
# En el servidor, editar /etc/nginx/sites-available/rpc-monitor
server {
    # ...
    allow TU_IP_LOCAL;
    deny all;
}
```

---

## 📝 Script de Instalación Automática

Crea un script `install_server.sh` en el servidor:

```bash
#!/bin/bash
set -e

echo "🚀 Instalando gRPC Monitor en servidor..."

# Variables
AGENT_ID=${1:-"servidor-remoto"}
INSTALL_DIR="$HOME/rpc-monitor"

# Clonar repositorio
if [ ! -d "$INSTALL_DIR" ]; then
    git clone <tu-repo-url> "$INSTALL_DIR"
fi

cd "$INSTALL_DIR/backend"

# Crear venv
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate

# Instalar dependencias
pip install --upgrade pip
pip install -r requirements.txt

# Regenerar protobuf
python -m grpc_tools.protoc -I proto --python_out=app --grpc_python_out=app proto/metrics.proto

# Configurar
export AGENT_ID="$AGENT_ID"
export HTTP_BRIDGE_PORT=8000
export ENABLE_HTTP_BRIDGE=1

# Abrir firewall
sudo ufw allow 8000/tcp || true

echo "✅ Instalación completa!"
echo ""
echo "Para ejecutar:"
echo "  cd $INSTALL_DIR/backend"
echo "  source venv/bin/activate"
echo "  export AGENT_ID=$AGENT_ID"
echo "  python -m app.server"
```

Uso:
```bash
chmod +x install_server.sh
./install_server.sh mi-servidor-1
```

---

## 🐛 Troubleshooting

### Error: "Connection refused"

**Causa**: El servidor no escucha en todas las interfaces.

**Solución**: Verifica que el servidor muestre:
```
HTTP bridge started on 0.0.0.0:8000
```

Si muestra `127.0.0.1:8000`, el servidor solo acepta conexiones locales.

### Error: "Timeout" o "No response"

**Causa**: Firewall bloquea el puerto.

**Solución**:
```bash
# Verificar firewall
sudo ufw status
sudo firewall-cmd --list-all

# Abrir puerto
sudo ufw allow 8000/tcp
```

### Error: "Permission denied"

**Causa**: Usuario sin permisos.

**Solución**: Ejecutar con sudo o cambiar permisos:
```bash
sudo chown -R $USER:$USER /ruta/del/proyecto
```

---

## 📊 Monitoreo del Servidor

### Ver Logs en Tiempo Real

```bash
# Si usas systemd
sudo journalctl -u rpc-monitor -f

# Si usas Docker
docker logs -f rpc-monitor-backend

# Si ejecutas directamente
# Los logs aparecen en la terminal
```

### Verificar Estado

```bash
# Verificar que el proceso está corriendo
ps aux | grep "app.server"

# Verificar puertos
netstat -tlnp | grep -E '8000|50051'

# Verificar conexiones activas
netstat -an | grep 8000 | grep ESTABLISHED
```

---

## 🎯 Resumen Rápido

### En el Servidor Remoto:

```bash
# 1. Clonar
git clone <repo> && cd servicio-de-striming-usando-gRPC/backend

# 2. Instalar
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# 3. Configurar
export AGENT_ID=servidor-remoto
export HTTP_BRIDGE_PORT=8000
export ENABLE_HTTP_BRIDGE=1

# 4. Abrir firewall
sudo ufw allow 8000/tcp

# 5. Ejecutar
python -m app.server
```

### En tu Máquina Local:

```bash
cd frontend
echo "VITE_GRPC_BASE=http://IP_SERVIDOR:8000" > .env
npm run dev
```

---

¡Listo! Ahora tu backend corre en el servidor externo y tu frontend local se conecta a él. 🎉

