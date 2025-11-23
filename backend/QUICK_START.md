# ⚡ Inicio Rápido - Monitoreo Local

## 🚀 Ejecutar en 1 comando

```bash
cd backend
./run_local.sh
```

¡Eso es todo! El servidor estará corriendo en:
- **gRPC**: `localhost:50051`
- **HTTP Bridge**: `http://localhost:8000`

## 📋 Qué hace el script

1. Crea/activa entorno virtual
2. Instala dependencias (`psutil`, `grpcio`, etc.)
3. Regenera stubs de protobuf
4. Inicia el servidor

## 🎯 Personalizar

Antes de ejecutar, puedes configurar variables:

```bash
export AGENT_ID="mi-pc"
export GRPC_PORT=50051
export LOG_LEVEL=DEBUG
./run_local.sh
```

## 📊 Métricas que monitorea

- ✅ CPU (total, por núcleo, frecuencia)
- ✅ Memoria (RAM, swap, caché, buffers)
- ✅ Disco (uso, I/O por partición)
- ✅ Red (bytes, paquetes, errores, por interfaz)
- ✅ Procesos (top N con detalles)
- ✅ Sistema (uptime, boot time, hostname)
- ✅ Sensores (temperatura, batería si disponible)

## 🔗 Conectar desde frontend

Si tienes el frontend, apunta a:
```
http://localhost:8000/grpc
```

## 🛑 Detener

Presiona `Ctrl+C`

---

**¿Problemas?** Ver `RUN_LOCAL.md` para más detalles.

