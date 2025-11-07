# Nginx - Reverse Proxy & Load Balancer

Nginx actúa como:
1. **Reverse proxy** para el frontend estático (SPA)
2. **Load balancer** para backends gRPC con `least_conn`
3. **HTTP/2 gateway** para gRPC

## Configuración

### Frontend Estático

```nginx
root /usr/share/nginx/html;
location / {
  try_files $uri $uri/ /index.html;
}
```

Sirve React app con soporte para history API.

### gRPC Balancing

```nginx
upstream grpc_backends {
  least_conn;
  server backend1:50051;
  server backend2:50051;
}

location /grpc {
  grpc_pass grpc://grpc_backends;
}
```

Distribuye conexiones gRPC entre instancias backend.

### Health Checks

- Retry automático si un backend falla (`max_fails=3, fail_timeout=10s`)
- Endpoint `/health` para verificación externa

### Características

- **gzip** para compresión de estáticos
- **Cache headers** para assets (JS, CSS, imágenes)
- **Timeouts** configurados para streaming gRPC
- **CORS** headers automáticos

## Docker

```bash
docker build -t rpc-stream-monitor-nginx .
```

Los estáticos se montan como volumen desde el contenedor `frontend`.

## Escalado

Para añadir más backends:

```nginx
upstream grpc_backends {
  least_conn;
  server backend1:50051;
  server backend2:50051;
  server backend3:50051;  # Nuevo
}
```

Nginx distribuirá automáticamente.

## Monitoreo

```bash
# Ver logs de Nginx
docker logs nginx

# Test de conexión
curl http://localhost:8080/health
```

## Extensiones Futuras

- [ ] TLS/HTTPS con certificados autofirmados
- [ ] Rate limiting
- [ ] Autenticación OAuth en reverse proxy
- [ ] Métricas Prometheus
