# 🚀 Configuración de Agentes

## Agentes a Registrar

1. **Agente ngrok 1**: `https://98cf7bfce07a.ngrok-free.app/grpc`
2. **Agente Local**: Se descubre automáticamente
3. **Agente ngrok 2**: `https://f72a9450f815.ngrok-free.app/grpc`

---

## Método 1: Desde la Interfaz Web (Recomendado)

### Paso 1: Agregar Agente ngrok 1

1. Abre la aplicación en el navegador
2. Haz clic en el botón **"+"** junto a "Agente"
3. Completa:
   - **Agent ID**: `ngrok-1` (o el nombre que prefieras)
   - **Endpoint**: `https://98cf7bfce07a.ngrok-free.app/grpc`
4. Haz clic en **"Agregar"**

### Paso 2: Agregar Agente ngrok 2

1. Haz clic en el botón **"+"** nuevamente
2. Completa:
   - **Agent ID**: `ngrok-2` (o el nombre que prefieras)
   - **Endpoint**: `https://f72a9450f815.ngrok-free.app/grpc`
3. Haz clic en **"Agregar"**

### Paso 3: Agente Local

El agente local se descubre automáticamente cuando:
- El backend local está corriendo en `localhost:8000`
- El frontend puede conectarse a él

**No requiere configuración manual** ✅

---

## Método 2: Desde la Consola del Navegador (Rápido)

Abre la consola del navegador (F12 → Console) y ejecuta:

```javascript
// Configurar los 3 agentes
const agentes = {
  "ngrok-1": "https://98cf7bfce07a.ngrok-free.app/grpc",
  "ngrok-2": "https://f72a9450f815.ngrok-free.app/grpc"
};

// Guardar en localStorage
localStorage.setItem('AGENT_ENDPOINTS', JSON.stringify(agentes));

// Recargar la página para ver los cambios
location.reload();
```

**O en una sola línea**:
```javascript
localStorage.setItem('AGENT_ENDPOINTS', JSON.stringify({"ngrok-1":"https://98cf7bfce07a.ngrok-free.app/grpc","ngrok-2":"https://f72a9450f815.ngrok-free.app/grpc"})); location.reload();
```

---

## Método 3: Editar localStorage Directamente

1. Abre DevTools (F12)
2. Ve a **Application → Local Storage → tu-dominio**
3. Busca la clave `AGENT_ENDPOINTS`
4. Edita el valor JSON:

```json
{
  "ngrok-1": "https://98cf7bfce07a.ngrok-free.app/grpc",
  "ngrok-2": "https://f72a9450f815.ngrok-free.app/grpc"
}
```

5. Recarga la página (F5)

---

## Verificación

### Verificar que los Agentes Están Registrados

**Desde la consola**:
```javascript
JSON.parse(localStorage.getItem('AGENT_ENDPOINTS'))
```

**Salida esperada**:
```json
{
  "ngrok-1": "https://98cf7bfce07a.ngrok-free.app/grpc",
  "ngrok-2": "https://f72a9450f815.ngrok-free.app/grpc"
}
```

**Desde la interfaz**:
1. Abre el dropdown de agentes
2. Deberías ver:
   - `ngrok-1 (ngrok-1) [Remoto]`
   - `ngrok-2 (ngrok-2) [Remoto]`
   - `[Agente Local]` (si el backend local está corriendo)

---

## Probar la Conexión

1. **Selecciona cada agente** en el dropdown
2. **Observa el estado**:
   - ✅ "Conectado" = Funcionando
   - ⏳ "Conectando..." = Intentando conectar
   - ❌ "Error de conexión" = Problema de red/servidor

---

## Troubleshooting

### Si el agente no aparece:

1. Verifica que el formato del endpoint sea correcto
2. Recarga la página (F5)
3. Verifica en DevTools → Application → Local Storage

### Si aparece "Error de conexión":

1. Verifica que el servidor ngrok esté corriendo
2. Verifica que la URL sea correcta
3. Prueba la conexión manualmente:
   ```bash
   curl https://98cf7bfce07a.ngrok-free.app/grpc/metrics.MetricsService/ListAgents \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

---

## Resumen Rápido

**Para agregar los 2 agentes ngrok rápidamente**:

```javascript
// Copia y pega en la consola del navegador (F12)
localStorage.setItem('AGENT_ENDPOINTS', JSON.stringify({
  "ngrok-1": "https://98cf7bfce07a.ngrok-free.app/grpc",
  "ngrok-2": "https://f72a9450f815.ngrok-free.app/grpc"
}));
location.reload();
```

**El agente local se descubre automáticamente** cuando el backend está corriendo en `localhost:8000`.

---

¡Listo! 🎉

