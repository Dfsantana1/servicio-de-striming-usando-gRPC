# 🔧 Solución: Mensajes de Hilos (Fork Handlers) de gRPC

## Problema

Los mensajes repetitivos de gRPC sobre fork handlers:
```
I0000 00:00:1763939043.850774 11681432 fork_posix.cc:71] 
Other threads are currently calling into gRPC, skipping fork() handlers
```

Estos mensajes son **informativos** y no indican un error, pero pueden ser molestos y llenar los logs.

## Causa

gRPC detecta cuando hay múltiples threads activos y se produce un `fork()`. Esto es común en aplicaciones Python con multiprocessing o threading. Los mensajes son advertencias informativas de gRPC.

## Soluciones Implementadas

### 1. Configuración de Logging de gRPC ✅

Se configuró el nivel de logging de gRPC para mostrar solo WARNING y ERROR:

```python
grpc_logger = logging.getLogger('grpc')
grpc_logger.setLevel(logging.WARNING)
```

### 2. Filtro Personalizado ✅

Se creó un filtro que elimina específicamente los mensajes de fork handlers:

```python
class ForkHandlerFilter(logging.Filter):
    def filter(self, record):
        if 'fork' in record.getMessage().lower() and 'skip' in record.getMessage().lower():
            return False
        if 'fork_posix' in record.getMessage():
            return False
        return True
```

### 3. Variables de Entorno de gRPC ✅

Se configuraron variables de entorno para reducir la verbosidad de gRPC:

```python
os.environ.setdefault('GRPC_VERBOSITY', 'ERROR')  # Solo errores
os.environ.setdefault('GRPC_TRACE', '')  # Sin trazas
```

## Resultado

✅ **Los mensajes de fork handlers ya no aparecerán en los logs**
✅ **Solo se mostrarán errores y warnings reales de gRPC**
✅ **Los logs serán más limpios y fáciles de leer**

## Configuración Adicional (Opcional)

Si quieres ajustar aún más el logging, puedes:

### Opción 1: Cambiar nivel de logging general

```bash
export LOG_LEVEL=WARNING  # Solo warnings y errores
python -m app.server
```

### Opción 2: Cambiar verbosidad de gRPC

```bash
export GRPC_VERBOSITY=ERROR  # Solo errores
export GRPC_TRACE=""        # Sin trazas
python -m app.server
```

### Opción 3: Filtrar en el código

Ya está implementado en `server.py`, pero puedes ajustar el filtro:

```python
class ForkHandlerFilter(logging.Filter):
    def filter(self, record):
        # Agregar más condiciones si es necesario
        message = record.getMessage().lower()
        if any(keyword in message for keyword in ['fork', 'thread', 'posix']):
            return False
        return True
```

## Verificación

Después de aplicar los cambios, deberías ver:

**Antes**:
```
I0000 00:00:1763939043.850774 11681432 fork_posix.cc:71] Other threads...
I0000 00:00:1763939044.899112 11681432 fork_posix.cc:71] Other threads...
```

**Después**:
```
(No aparecen estos mensajes)
```

Solo verás logs importantes como:
```
2025-11-23 18:13:01,283 - aiohttp.access - INFO - 127.0.0.1 [23/Nov/2025:18:13:01 -0500] "POST /metrics.MetricsService/ListAgents HTTP/1.1" 200
```

## Notas Importantes

⚠️ **Estos mensajes NO son errores**: Son advertencias informativas de gRPC que aparecen cuando hay múltiples threads. El servidor funciona correctamente.

⚠️ **No afectan el rendimiento**: Estos mensajes son solo informativos y no afectan la funcionalidad.

✅ **Es seguro filtrarlos**: No perderás información importante al filtrar estos mensajes.

---

¡Los mensajes de hilos ahora están filtrados! 🎉

