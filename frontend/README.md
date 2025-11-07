# Frontend - RPC Stream Monitor

Frontend moderno en React + Vite + TypeScript + Tailwind CSS + shadcn/ui para monitoreo remoto de métricas en tiempo real vía gRPC.

## Características

- 📊 Gráficos en tiempo real (Recharts)
- 🔄 Streaming gRPC con @bufbuild/connect-web
- 🎯 Selección de agentes y intervalos
- 📈 Métricas de CPU, memoria, red, discos y procesos
- 🎨 Interfaz moderna con Tailwind CSS
- ⚡ Rendimiento optimizado con Zustand para estado

## Estructura

- `src/components/` - Componentes React
  - `Header.tsx` - Encabezado con controles
  - `MetricsCards.tsx` - Cards de métricas principales
  - `CpuChart.tsx`, `MemoryChart.tsx`, `NetChart.tsx` - Gráficos
  - `ProcessTable.tsx` - Tabla de procesos
  - `AgentSelector.tsx`, `IntervalSelector.tsx` - Selectores
  - `ConnectStatus.tsx` - Indicador de estado

- `src/lib/`
  - `grpc.ts` - Cliente gRPC (@bufbuild/connect-web)
  - `store.ts` - Estado global con Zustand
  - `formatters.ts` - Utilidades de formateo

- `src/styles/`
  - `globals.css` - Estilos Tailwind y customizaciones

## Instalación y Desarrollo

```bash
# Instalar dependencias
npm ci

# Desarrollo (con proxy a http://localhost:50051)
npm run dev

# Build producción
npm run build

# Lint
npm run lint
```

## Configuración gRPC

El frontend se conecta a `/grpc` (endpoint expuesto por Nginx).

En desarrollo, vite.config.ts redirige a `http://localhost:50051`.

En producción, Nginx sirve el frontend y balancea `/grpc` hacia los backends.

### Con API Token

Si el servidor requiere autenticación, establece el token en la URL o localStorage:

```typescript
// En App.tsx o componente raíz
const authToken = localStorage.getItem('authToken');
```

El cliente envía:

```
Authorization: Bearer <token>
```

## Build para Docker

```bash
# Build producción
npm run build

# Los estáticos van a dist/
```

Docker Compose copia `dist/*` a `/usr/share/nginx/html`.

## Estructura de Datos (Protobuf)

El frontend consume `MetricsResponse` con estructura:

```typescript
interface MetricsSnapshot {
  agent_id: string;
  timestamp_unix_ms: number;
  cpu_percent: number;
  memory_percent: number;
  load_1m, load_5m, load_15m: number;
  disks: DiskUsage[];
  net: { bytes_sent, bytes_recv };
  top_processes: ProcessInfo[];
}
```

Importado desde stubs generados con `buf generate` o `grpc-code-gen`.

## Rendimiento

- Buffer limitado a últimos 60 puntos de métrica
- Re-renderizado optimizado con React 18
- Charts de Recharts son compostables y eficientes
- Zustand para estado sin re-renders innecesarios

## Extensiones Futuras

- [ ] Exportar métricas a CSV
- [ ] Tema oscuro/claro toggle
- [ ] Historial persistente (localStorage/IndexedDB)
- [ ] Alertas personalizables
- [ ] Múltiples agentes en paralelo
