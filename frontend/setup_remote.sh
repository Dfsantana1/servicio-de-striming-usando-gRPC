#!/bin/bash
# Script para configurar el frontend para conectarse a un backend remoto

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🔧 Configuración de Conexión Remota${NC}"
echo ""

# Solicitar IP o URL del backend remoto
read -p "Ingresa la IP o URL del backend remoto (ej: 192.168.1.100 o http://monitor.com): " REMOTE_URL

# Limpiar la URL (quitar http:// o https:// si está presente)
CLEAN_URL=$(echo "$REMOTE_URL" | sed 's|^https\?://||')

# Solicitar puerto
read -p "Ingresa el puerto del HTTP Bridge (default: 8000): " PORT
PORT=${PORT:-8000}

# Determinar si usar http o https
if [[ "$REMOTE_URL" == https://* ]]; then
    PROTOCOL="https"
else
    PROTOCOL="http"
fi

FULL_URL="${PROTOCOL}://${CLEAN_URL}:${PORT}"

echo ""
echo -e "${GREEN}✅ Configuración:${NC}"
echo -e "   URL del backend: ${FULL_URL}"
echo ""

# Crear archivo .env
ENV_FILE=".env"
echo "VITE_GRPC_BASE=${FULL_URL}" > "$ENV_FILE"

echo -e "${GREEN}✅ Archivo .env creado en: ${ENV_FILE}${NC}"
echo ""
echo -e "${YELLOW}💡 Próximos pasos:${NC}"
echo "   1. Verifica que el backend remoto esté corriendo en ${FULL_URL}"
echo "   2. Ejecuta: npm run dev"
echo "   3. Abre el navegador en http://localhost:5173"
echo ""
echo -e "${BLUE}📝 Para probar la conexión:${NC}"
echo "   curl ${FULL_URL}/metrics.MetricsService/ListAgents \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{}'"
echo ""

