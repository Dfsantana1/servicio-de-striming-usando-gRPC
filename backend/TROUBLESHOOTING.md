# 🔧 Troubleshooting - Problemas Comunes

## ❌ Error: Failed building wheel for grpcio

**Problema**: `grpcio` está intentando compilar desde el código fuente y falla.

### Solución 1: Usar Python 3.11 o 3.12 (Recomendado)

Python 3.14 es muy reciente y puede no tener wheels precompilados para todas las librerías.

```bash
# Instalar Python 3.12 con Homebrew
brew install python@3.12

# Crear nuevo entorno virtual con Python 3.12
cd backend
python3.12 -m venv venv
source venv/bin/activate
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
```

### Solución 2: Actualizar grpcio a versión más reciente

```bash
# En el entorno virtual
pip install --upgrade grpcio grpcio-tools
```

### Solución 3: Instalar dependencias del sistema (macOS)

Si necesitas compilar desde el código fuente:

```bash
# Instalar herramientas de compilación
xcode-select --install

# Instalar dependencias adicionales
brew install cmake
```

### Solución 4: Usar versión específica compatible

Si ninguna de las anteriores funciona, prueba con versiones específicas:

```bash
pip install grpcio==1.63.0 grpcio-tools==1.63.0
```

## ❌ Error: ModuleNotFoundError

**Problema**: Faltan módulos después de instalar.

**Solución**:
```bash
# Asegúrate de estar en el entorno virtual
source venv/bin/activate

# Reinstalar todas las dependencias
pip install -r requirements.txt --force-reinstall
```

## ❌ Error: Permission denied

**Problema**: No puedes leer ciertos procesos del sistema.

**Solución**: Esto es normal. Algunos procesos requieren permisos root. El servidor continuará funcionando y monitoreará los procesos accesibles.

## ❌ Error: Port already in use

**Problema**: El puerto 50051 o 8000 ya está en uso.

**Solución**:
```bash
# Ver qué proceso está usando el puerto
lsof -i :50051
lsof -i :8000

# Matar el proceso o cambiar el puerto
export GRPC_PORT=50052
export HTTP_BRIDGE_PORT=8001
```

## ❌ Error: No se muestran temperaturas

**Problema**: Las temperaturas aparecen como 0 o no se muestran.

**Solución**: 
- En macOS, las temperaturas pueden requerir permisos adicionales
- Algunos sistemas no exponen sensores de temperatura vía psutil
- Esto es normal y no afecta otras métricas

## ❌ Error: protoc not found

**Problema**: No se puede generar código desde .proto

**Solución**:
```bash
# Instalar protobuf compiler
brew install protobuf

# O usar grpc_tools que incluye protoc
pip install grpcio-tools
```

## 💡 Recomendación General

Para evitar problemas de compatibilidad, usa **Python 3.11 o 3.12** en lugar de 3.14:

```bash
# Verificar versión de Python
python3 --version

# Si es 3.14, instalar 3.12
brew install python@3.12

# Crear venv con 3.12
python3.12 -m venv venv
source venv/bin/activate
```

## 🔍 Verificar Instalación

Después de instalar, verifica que todo funciona:

```bash
python -c "import grpc; print('gRPC OK')"
python -c "import psutil; print('psutil OK')"
python -c "from app import metrics_pb2; print('protobuf OK')"
```

Si todos pasan, puedes ejecutar el servidor:

```bash
python -m app.server
```

