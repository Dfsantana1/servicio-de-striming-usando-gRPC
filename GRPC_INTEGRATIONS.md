# 🔌 Guía Completa de Integraciones gRPC

Este documento explica las diferentes formas de integrar y usar gRPC en este proyecto de monitoreo.

## 📋 Tabla de Contenidos

1. [¿Qué es gRPC?](#qué-es-grpc)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Tipos de Integración](#tipos-de-integración)
4. [Integración 1: gRPC Nativo (Python)](#integración-1-grpc-nativo-python)
5. [Integración 2: HTTP Bridge (Web)](#integración-2-http-bridge-web)
6. [Integración 3: gRPC-Web (Browser)](#integración-3-grpc-web-browser)
7. [Integración 4: gRPC desde Otros Lenguajes](#integración-4-grpc-desde-otros-lenguajes)
8. [Comparación de Métodos](#comparación-de-métodos)
9. [Ejemplos Prácticos](#ejemplos-prácticos)

---

## ¿Qué es gRPC?

**gRPC** (gRPC Remote Procedure Calls) es un framework de comunicación RPC de alto rendimiento desarrollado por Google. Utiliza **Protocol Buffers** (protobuf) como formato de serialización y **HTTP/2** como protocolo de transporte.

### Ventajas de gRPC

- ✅ **Alto rendimiento**: Más rápido que REST/JSON
- ✅ **Streaming bidireccional**: Comunicación en tiempo real
- ✅ **Tipado fuerte**: Definido en archivos `.proto`
- ✅ **Multiplataforma**: Soporta muchos lenguajes
- ✅ **Compresión**: Reduce ancho de banda
- ✅ **Streaming**: Perfecto para datos en tiempo real

### Desventajas

- ⚠️ **No funciona directamente en navegadores**: Requiere proxy o gRPC-Web
- ⚠️ **Curva de aprendizaje**: Más complejo que REST
- ⚠️ **Debugging**: Menos herramientas que REST

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    Cliente (Frontend/App)                    │
└───────────────┬─────────────────────────────────────────────┘
                │
                │ HTTP/2 gRPC o HTTP Bridge
                │
┌───────────────▼─────────────────────────────────────────────┐
│              Servidor gRPC (Backend Python)                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  MetricsService (gRPC)                               │   │
│  │  - StreamMetrics()                                   │   │
│  │  - StreamLogs()                                      │   │
│  │  - ListAgents()                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  HTTP Bridge (Opcional)                              │   │
│  │  - Convierte gRPC a HTTP/JSON                       │   │
│  │  - Para compatibilidad con navegadores              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Tipos de Integración

Este proyecto soporta **4 formas principales** de integrar gRPC:

1. **gRPC Nativo (Python)** - Cliente Python directo
2. **HTTP Bridge** - Conversión gRPC → HTTP/JSON para navegadores
3. **gRPC-Web** - Extensión de gRPC para navegadores (futuro)
4. **gRPC desde Otros Lenguajes** - Java, Go, Node.js, etc.

---

## Integración 1: gRPC Nativo (Python)

### ¿Qué es?

Conexión directa usando la librería `grpcio` de Python. Es la forma más eficiente y nativa.

### Cuándo Usar

- ✅ Cliente Python
- ✅ Scripts de automatización
- ✅ Servicios backend
- ✅ Testing y debugging
- ✅ Máxima performance necesaria

### Cómo Funciona

```python
import grpc
from app import metrics_pb2, metrics_pb2_grpc

# 1. Crear canal de comunicación
channel = grpc.insecure_channel('localhost:50051')

# 2. Crear stub (cliente)
stub = metrics_pb2_grpc.MetricsServiceStub(channel)

# 3. Llamar métodos gRPC
agents = stub.ListAgents(metrics_pb2.Empty())
print(f"Agentes: {agents}")

# 4. Streaming
request = metrics_pb2.StreamRequest(interval_ms=1000)
for response in stub.StreamMetrics(request):
    print(f"CPU: {response.snapshot.cpu_percent}%")
```

### Ejemplo Completo

```python
#!/usr/bin/env python3
"""Cliente gRPC Python para monitoreo"""

import grpc
import time
from app import metrics_pb2, metrics_pb2_grpc

def monitor_agent(agent_id: str, endpoint: str = "localhost:50051"):
    """Monitorear un agente usando gRPC nativo"""
    
    # Crear canal
    channel = grpc.insecure_channel(endpoint)
    stub = metrics_pb2_grpc.MetricsServiceStub(channel)
    
    try:
        # Listar agentes
        agents = stub.ListAgents(metrics_pb2.Empty())
        print(f"Agentes disponibles: {[a.agent_id for a in agents.agents]}")
        
        # Stream de métricas
        request = metrics_pb2.StreamRequest(
            interval_ms=1000,
            agent_id=agent_id
        )
        
        print(f"Monitoreando {agent_id}...")
        for response in stub.StreamMetrics(request):
            snapshot = response.snapshot
            print(f"[{time.strftime('%H:%M:%S')}] "
                  f"CPU: {snapshot.cpu_percent:.1f}% | "
                  f"RAM: {snapshot.memory_percent:.1f}% | "
                  f"Load: {snapshot.load_1m:.2f}")
    
    except grpc.RpcError as e:
        print(f"Error gRPC: {e.code()} - {e.details()}")
    finally:
        channel.close()

if __name__ == "__main__":
    monitor_agent("local-machine")
```

### Con Autenticación

```python
# Crear metadata con token
metadata = [('authorization', 'Bearer mi-token-secreto')]

# Usar en llamadas
agents = stub.ListAgents(metrics_pb2.Empty(), metadata=metadata)
```

### Con TLS/SSL (Producción)

```python
import grpc

# Cargar certificados
with open('ca.pem', 'rb') as f:
    root_cert = f.read()

credentials = grpc.ssl_channel_credentials(root_cert)
channel = grpc.secure_channel('servidor.com:50051', credentials)
```

---

## Integración 2: HTTP Bridge (Web)

### ¿Qué es?

Un puente HTTP que convierte llamadas gRPC a HTTP/JSON. Permite que navegadores y aplicaciones web se comuniquen con el servidor gRPC.

### Cuándo Usar

- ✅ Frontend web (React, Vue, Angular)
- ✅ Aplicaciones que no soportan gRPC nativo
- ✅ Testing con herramientas HTTP (curl, Postman)
- ✅ Integración con sistemas existentes

### Cómo Funciona

El servidor Python incluye un **HTTP Bridge** que:

1. Recibe peticiones HTTP/JSON
2. Las convierte a llamadas gRPC
3. Ejecuta la llamada gRPC
4. Convierte la respuesta a JSON
5. Retorna HTTP/JSON

### Endpoints HTTP

El bridge expone los mismos métodos gRPC como endpoints HTTP:

```
POST /metrics.MetricsService/ListAgents
POST /metrics.MetricsService/StreamMetrics
POST /metrics.MetricsService/StreamLogs
```

### Ejemplo con Fetch API (JavaScript)

```javascript
// Listar agentes
async function listAgents() {
  const response = await fetch('http://localhost:8000/metrics.MetricsService/ListAgents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer mi-token' // Opcional
    },
    body: JSON.stringify({})
  });
  
  const data = await response.json();
  console.log('Agentes:', data.agents);
}

// Stream de métricas (NDJSON)
async function* streamMetrics(intervalMs = 1000) {
  const response = await fetch('http://localhost:8000/metrics.MetricsService/StreamMetrics', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/x-ndjson'
    },
    body: JSON.stringify({
      interval_ms: intervalMs,
      agent_id: 'local-machine'
    })
  });
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.trim()) {
        const snapshot = JSON.parse(line);
        yield snapshot;
      }
    }
  }
}

// Uso
(async () => {
  for await (const snapshot of streamMetrics(1000)) {
    console.log(`CPU: ${snapshot.snapshot.cpu_percent}%`);
  }
})();
```

### Ejemplo con cURL

```bash
# Listar agentes
curl -X POST http://localhost:8000/metrics.MetricsService/ListAgents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mi-token" \
  -d '{}'

# Stream de métricas (NDJSON)
curl -X POST http://localhost:8000/metrics.MetricsService/StreamMetrics \
  -H "Content-Type: application/json" \
  -H "Accept: application/x-ndjson" \
  -d '{"interval_ms": 1000, "agent_id": "local-machine"}'
```

### Formato NDJSON

El streaming retorna **NDJSON** (Newline Delimited JSON):

```
{"snapshot": {"agent_id": "local", "cpu_percent": 25.5, ...}}
{"snapshot": {"agent_id": "local", "cpu_percent": 26.1, ...}}
{"snapshot": {"agent_id": "local", "cpu_percent": 24.8, ...}}
```

Cada línea es un JSON válido independiente.

---

## Integración 3: gRPC-Web (Browser)

### ¿Qué es?

gRPC-Web es una especificación que permite usar gRPC directamente desde navegadores. Requiere un proxy especial.

### Estado Actual

⚠️ **No implementado aún** en este proyecto, pero es posible agregarlo.

### Cómo Funcionaría

```
Browser → gRPC-Web Proxy → gRPC Server
```

### Implementación Futura

```typescript
// Con @bufbuild/connect-web
import { createPromiseClient } from '@bufbuild/connect-web';
import { MetricsService } from './gen/metrics_connect';

const client = createPromiseClient(
  MetricsService,
  createConnectTransport({
    baseUrl: 'http://localhost:8080',
  })
);

// Usar como cliente normal
const agents = await client.listAgents({});
```

---

## Integración 4: gRPC desde Otros Lenguajes

### Node.js

```javascript
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

// Cargar proto
const packageDefinition = protoLoader.loadSync('proto/metrics.proto', {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const metricsProto = grpc.loadPackageDefinition(packageDefinition).metrics;

// Crear cliente
const client = new metricsProto.MetricsService(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

// Llamar métodos
client.ListAgents({}, (error, response) => {
  if (error) {
    console.error(error);
    return;
  }
  console.log('Agentes:', response.agents);
});

// Streaming
const call = client.StreamMetrics({
  interval_ms: 1000,
  agent_id: 'local-machine'
});

call.on('data', (response) => {
  console.log('CPU:', response.snapshot.cpu_percent);
});

call.on('error', (error) => {
  console.error('Error:', error);
});
```

### Go

```go
package main

import (
    "context"
    "log"
    "google.golang.org/grpc"
    pb "path/to/generated/proto"
)

func main() {
    // Conectar
    conn, err := grpc.Dial("localhost:50051", grpc.WithInsecure())
    if err != nil {
        log.Fatal(err)
    }
    defer conn.Close()
    
    // Crear cliente
    client := pb.NewMetricsServiceClient(conn)
    
    // Listar agentes
    agents, err := client.ListAgents(context.Background(), &pb.Empty{})
    if err != nil {
        log.Fatal(err)
    }
    log.Printf("Agentes: %v", agents.Agents)
    
    // Streaming
    stream, err := client.StreamMetrics(context.Background(), &pb.StreamRequest{
        IntervalMs: 1000,
        AgentId:    "local-machine",
    })
    if err != nil {
        log.Fatal(err)
    }
    
    for {
        response, err := stream.Recv()
        if err != nil {
            break
        }
        log.Printf("CPU: %.1f%%", response.Snapshot.CpuPercent)
    }
}
```

### Java

```java
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import com.example.metrics.MetricsServiceGrpc;
import com.example.metrics.MetricsProto;

public class MetricsClient {
    public static void main(String[] args) {
        // Crear canal
        ManagedChannel channel = ManagedChannelBuilder
            .forAddress("localhost", 50051)
            .usePlaintext()
            .build();
        
        // Crear stub
        MetricsServiceGrpc.MetricsServiceBlockingStub stub = 
            MetricsServiceGrpc.newBlockingStub(channel);
        
        // Listar agentes
        MetricsProto.AgentsList agents = stub.listAgents(
            MetricsProto.Empty.getDefaultInstance()
        );
        System.out.println("Agentes: " + agents);
        
        // Streaming
        MetricsProto.StreamRequest request = MetricsProto.StreamRequest.newBuilder()
            .setIntervalMs(1000)
            .setAgentId("local-machine")
            .build();
        
        Iterator<MetricsProto.MetricsResponse> responses = 
            stub.streamMetrics(request);
        
        while (responses.hasNext()) {
            MetricsProto.MetricsResponse response = responses.next();
            System.out.println("CPU: " + response.getSnapshot().getCpuPercent() + "%");
        }
        
        channel.shutdown();
    }
}
```

---

## Comparación de Métodos

| Característica | gRPC Nativo | HTTP Bridge | gRPC-Web | Otros Lenguajes |
|---------------|-------------|-------------|----------|-----------------|
| **Performance** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Facilidad** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **Navegadores** | ❌ | ✅ | ✅ | ❌ |
| **Streaming** | ✅ Completo | ✅ NDJSON | ✅ Completo | ✅ Completo |
| **Tipado** | ✅ Fuerte | ⚠️ JSON | ✅ Fuerte | ✅ Fuerte |
| **Debugging** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **Uso Actual** | ✅ Backend | ✅ Frontend | ⏳ Futuro | ✅ Posible |

---

## Ejemplos Prácticos

### Ejemplo 1: Cliente Python Simple

```python
# client_simple.py
import grpc
from app import metrics_pb2, metrics_pb2_grpc

channel = grpc.insecure_channel('localhost:50051')
stub = metrics_pb2_grpc.MetricsServiceStub(channel)

# Una llamada simple
agents = stub.ListAgents(metrics_pb2.Empty())
print(agents)
```

### Ejemplo 2: Monitoreo Continuo

```python
# monitor.py
import grpc
import time
from app import metrics_pb2, metrics_pb2_grpc

def monitor():
    channel = grpc.insecure_channel('localhost:50051')
    stub = metrics_pb2_grpc.MetricsServiceStub(channel)
    
    request = metrics_pb2.StreamRequest(interval_ms=1000)
    
    try:
        for response in stub.StreamMetrics(request):
            s = response.snapshot
            print(f"{time.strftime('%H:%M:%S')} | "
                  f"CPU: {s.cpu_percent:5.1f}% | "
                  f"RAM: {s.memory_percent:5.1f}%")
    except KeyboardInterrupt:
        print("\nDeteniendo...")
    finally:
        channel.close()

if __name__ == "__main__":
    monitor()
```

### Ejemplo 3: Frontend React

```typescript
// hooks/useMetrics.ts
import { useEffect, useState } from 'react';
import { streamMetrics } from '../lib/grpc';

export function useMetrics(agentId: string, interval: number) {
  const [snapshot, setSnapshot] = useState(null);
  
  useEffect(() => {
    const generator = streamMetrics(interval, agentId);
    
    (async () => {
      for await (const snap of generator) {
        setSnapshot(snap);
      }
    })();
  }, [agentId, interval]);
  
  return snapshot;
}
```

### Ejemplo 4: Script de Monitoreo

```python
# check_health.py
import grpc
import sys
from app import metrics_pb2, metrics_pb2_grpc

def check_health(endpoint: str):
    try:
        channel = grpc.insecure_channel(endpoint)
        stub = metrics_pb2_grpc.MetricsServiceStub(channel)
        
        # Timeout de 5 segundos
        agents = stub.ListAgents(
            metrics_pb2.Empty(),
            timeout=5
        )
        
        print(f"✅ {endpoint} está saludable")
        print(f"   Agentes: {[a.agent_id for a in agents.agents]}")
        return True
        
    except grpc.RpcError as e:
        print(f"❌ {endpoint} no responde: {e.code()}")
        return False
    finally:
        channel.close()

if __name__ == "__main__":
    endpoints = sys.argv[1:] or ["localhost:50051"]
    for endpoint in endpoints:
        check_health(endpoint)
```

---

## Configuración

### Variables de Entorno

```bash
# Backend
GRPC_PORT=50051              # Puerto gRPC nativo
HTTP_BRIDGE_PORT=8000       # Puerto HTTP Bridge
ENABLE_HTTP_BRIDGE=1        # Habilitar bridge
API_TOKEN=mi-token-secreto   # Autenticación (opcional)
```

### Endpoints

- **gRPC Nativo**: `localhost:50051`
- **HTTP Bridge**: `http://localhost:8000/grpc`
- **gRPC-Web** (futuro): `http://localhost:8080`

---

## Troubleshooting

### Error: "Connection refused"

```bash
# Verificar que el servidor esté corriendo
netstat -an | grep 50051

# Verificar firewall
sudo ufw status
```

### Error: "Failed to connect"

```bash
# Probar conexión
grpcurl -plaintext localhost:50051 list

# O con curl (HTTP Bridge)
curl http://localhost:8000/metrics.MetricsService/ListAgents \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Error: "UNAUTHENTICATED"

```bash
# Verificar token
export API_TOKEN="tu-token"

# O deshabilitar auth (solo desarrollo)
# En el servidor: no configurar API_TOKEN
```

---

## Recursos Adicionales

- [Documentación oficial de gRPC](https://grpc.io/docs/)
- [Protocol Buffers Guide](https://developers.google.com/protocol-buffers)
- [gRPC Python Examples](https://github.com/grpc/grpc/tree/master/examples/python)

---

**¡Listo!** Ahora conoces todas las formas de integrar gRPC en este proyecto. 🚀

