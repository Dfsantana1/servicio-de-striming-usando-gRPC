# RPC Stream Monitor

**Sistema de monitoreo remoto en tiempo real vía gRPC streaming** - Similar a htop pero en la web.

Clientes web visualizan métricas del sistema (CPU, RAM, Load, procesos, disco, red) en tiempo real desde múltiples agentes, con balanceo automático mediante Nginx.

```
┌─────────────────┐
│  Web Browser    │
│  React + Vite   │
└────────┬────────┘
         │ HTTP/2 gRPC streaming
         │
┌────────▼────────────────────┐
│  Nginx (Load Balancer)       │
│  - grpc_pass                 │
│  - least_conn strategy       │
│  - Static SPA hosting        │
└────────┬──────────┬──────────┘
         │          │
    ┌────▼──┐   ┌───▼──┐
    │Backend│   │Backend│
    │gRPC 1 │   │gRPC 2 │
    │50051  │   │50051  │
    └───────┘   └───────┘
```

## Quick Start

### Requisitos

- Docker & Docker Compose
- (Opcional: Python 3.11+, Node.js 20+ para desarrollo local)

### Ejecución

```bash
# Build y levanta todo
docker compose up --build

# Abre en el navegador
# http://localhost:8080
```

Primera vez: espera ~2-3 minutos a que el frontend compile.

### Uso

1. **Selecciona un agente** (agent-1, agent-2)
2. **Elige intervalo** (250ms a 5s)
3. Visualiza métricas en tiempo real

## Estructura del Proyecto

```
rpc-stream-monitor/
├── backend/                      # Server gRPC en Python
│   ├── proto/metrics.proto       # Definición protobuf
│   ├── app/
│   │   ├── server.py            # Servidor async gRPC
│   │   ├── metrics.py           # Colección de métricas (psutil)
│   │   ├── auth.py              # Validación de tokens
│   │   ├── config.py            # Configuración
│   │   └── utils.py
│   ├── tests/test_metrics.py     # Tests unitarios
│   ├── requirements.txt
│   ├── Dockerfile
│   └── README.md
│
├── frontend/                     # UI en React + Vite + TypeScript
│   ├── src/
│   │   ├── components/           # Componentes React
│   │   │   ├── Header.tsx
│   │   │   ├── MetricsCards.tsx
│   │   │   ├── CpuChart.tsx, MemoryChart.tsx, NetChart.tsx
│   │   │   ├── ProcessTable.tsx
│   │   │   ├── AgentSelector.tsx, IntervalSelector.tsx
│   │   │   └── ConnectStatus.tsx
│   │   ├── lib/
│   │   │   ├── grpc.ts          # Cliente gRPC (@bufbuild/connect-web)
│   │   │   ├── store.ts         # Estado global (Zustand)
│   │   │   └── formatters.ts    # Utilidades
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── styles/globals.css
│   ├── tailwind.config.ts
│   ├── vite.config.ts
│   ├── package.json
│   ├── Dockerfile
│   └── README.md
│
├── nginx/                        # Reverse proxy + load balancer
│   ├── nginx.conf
│   ├── Dockerfile
│   └── README.md
│
├── docker-compose.yml            # Orquestación multi-servicio
├── .pre-commit-config.yaml       # Linters y formatters
├── .gitignore
└── README.md
```

## Stack Técnico

| Componente | Tecnología |
|-----------|-----------|
| **Backend** | Python 3.11, grpcio, psutil, asyncio |
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, Recharts, Zustand |
| **gRPC Web** | @bufbuild/connect-web (HTTP/2 compatible) |
| **Proxy** | Nginx 1.27 (gRPC load balancing) |
| **Orquestación** | Docker Compose |

## Características Principales

### Backend
- ✅ Server gRPC async con streaming de métricas
- ✅ Colección con psutil (CPU, memoria, discos, procesos, red)
- ✅ Autenticación opcional con tokens Bearer
- ✅ Tests unitarios
- ✅ Dockerizado (multi-stage build)

### Frontend
- ✅ React SPA con historial API
- ✅ Gráficos en tiempo real (Recharts)
- ✅ Tabla interactiva de procesos top
- ✅ Selector de agentes y intervalos
- ✅ Indicador de estado de conexión
- ✅ UI moderna con Tailwind + shadcn patterns
- ✅ Estado global con Zustand

### Infraestructura
- ✅ Nginx como reverse proxy + load balancer
- ✅ Balanceo least_conn para gRPC
- ✅ Hosting de frontend estático
- ✅ Compresión gzip
- ✅ Health checks

## Configuración Avanzada

### Autenticación (API_TOKEN)

Para activar autenticación en modo producción:

```yaml
# docker-compose.yml
backend1:
  environment:
    - API_TOKEN=tu-secret-token-aqui
```

Frontend añade automáticamente el header:
```
Authorization: Bearer tu-secret-token-aqui
```

### Escalado Horizontal

Añade más backends en `docker-compose.yml`:

```yaml
backend3:
  build: ./backend
  environment:
    - AGENT_ID=agent-3
```

Y actualiza `nginx/nginx.conf`:

```nginx
upstream grpc_backends {
  least_conn;
  server backend1:50051;
  server backend2:50051;
  server backend3:50051;  # ← Nuevo
}
```

### Variables de Entorno

**Backend:**
- `AGENT_ID` - Identificador único del agente
- `GRPC_PORT` - Puerto gRPC (default: 50051)
- `TOP_N_PROCS` - Número de procesos top (default: 10)
- `INTERVAL_MIN_MS` - Intervalo mínimo (default: 250)
- `INTERVAL_MAX_MS` - Intervalo máximo (default: 60000)
- `API_TOKEN` - Token de autenticación (vacío = sin auth)
- `LOG_LEVEL` - DEBUG, INFO, WARNING, ERROR

**Frontend:**
- `VITE_GRPC_BASE` - URL base del endpoint gRPC (default: /grpc)

## Desarrollo Local

### Backend

```bash
cd backend

# Instalar dependencias
pip install -r requirements.txt

# Generar stubs gRPC
python -m grpc_tools.protoc -I proto --python_out=app --grpc_python_out=app proto/metrics.proto

# Ejecutar servidor
python -m app.server

# Tests
pytest tests/
```

### Frontend

```bash
cd frontend

# Instalar dependencias
npm ci

# Dev server (proxy a http://localhost:50051)
npm run dev

# Build
npm run build

# Lint
npm run lint
```

## Testing

```bash
# Backend tests
cd backend && pytest -v tests/

# Frontend lint
cd frontend && npm run lint
```

## Troubleshooting

| Problema | Solución |
|---------|----------|
| `Port 8080 already in use` | `lsof -i :8080` y matar proceso, o cambiar puerto en docker-compose.yml |
| `Frontend no se conecta a gRPC` | Verifica que Nginx esté corriendo y accesible en http://localhost:8080 |
| `Backend crashea` | Ver logs: `docker logs rpc-monitor-backend1` |
| `Nginx 502 bad gateway` | Verifica health checks: `docker ps` y revisa estado de backends |
| `Permisos en Docker` | En Linux: `sudo usermod -aG docker $USER` |

## Monitoreo

```bash
# Ver logs en vivo
docker compose logs -f nginx
docker compose logs -f backend1

# Estadísticas
docker stats

# Health check
curl http://localhost:8080/health
```

## Seguridad

- ✅ Validación de tokens opcional
- ⚠️ No usar en producción sin HTTPS
- ⚠️ Usar certificados TLS reales (no autofirmados)
- ⚠️ Limitar acceso a red interna

## Extensiones Futuras

- [ ] TLS/HTTPS con certificados
- [ ] Rate limiting en Nginx
- [ ] Autenticación OAuth
- [ ] Exportación de métricas (CSV, JSON)
- [ ] Tema oscuro/claro
- [ ] Historial persistente (IndexedDB)
- [ ] Alertas personalizables
- [ ] Métricas Prometheus
- [ ] Dashboard multi-agente

## Documentación por Servicio

- [Backend README](backend/README.md)
- [Frontend README](frontend/README.md)
- [Nginx README](nginx/README.md)

## Guías de Integración

- **[Guía Completa de Integraciones gRPC](GRPC_INTEGRATIONS.md)** - Explica todas las formas de integrar gRPC (Python, HTTP Bridge, otros lenguajes)
- [Configuración Multi-Agente](backend/MULTI_AGENT_SETUP.md) - Monitorear múltiples máquinas
- [Roadmap de Funcionalidades](backend/FEATURES_ROADMAP.md) - Funcionalidades futuras

## Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Fork el repo
2. Crea una rama (`git checkout -b feature/algo`)
3. Commit cambios (`git commit -am 'Add feature'`)
4. Push a la rama (`git push origin feature/algo`)
5. Abre un Pull Request

## Licencia

MIT

---

**¿Necesitas ayuda?** Ver los README individuales de cada servicio o abre un issue.

**Hecho con ❤️ para monitoreo remoto en tiempo real**
