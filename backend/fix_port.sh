#!/bin/bash
# Script para liberar el puerto 8000 o cambiar a otro puerto

PORT=${1:-8000}

echo "🔍 Buscando procesos usando el puerto $PORT..."

PROCESSES=$(lsof -ti :$PORT)

if [ -z "$PROCESSES" ]; then
    echo "✅ El puerto $PORT está libre"
    exit 0
fi

echo "⚠️  Procesos usando el puerto $PORT:"
lsof -i :$PORT

echo ""
read -p "¿Quieres matar estos procesos? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🛑 Matando procesos..."
    kill -9 $PROCESSES
    sleep 1
    if lsof -ti :$PORT > /dev/null 2>&1; then
        echo "❌ Algunos procesos no se pudieron matar"
    else
        echo "✅ Puerto $PORT liberado"
    fi
else
    echo "💡 Alternativa: Usa otro puerto para HTTP bridge:"
    echo "   export HTTP_BRIDGE_PORT=8001"
    echo "   ./run_local.sh"
fi

