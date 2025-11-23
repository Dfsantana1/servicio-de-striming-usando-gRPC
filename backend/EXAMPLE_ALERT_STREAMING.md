# 🔔 Ejemplo: Streaming Bidireccional de Alertas

## 📋 Descripción

Esta funcionalidad permite que los clientes se suscriban a alertas en tiempo real usando gRPC streaming. Cuando una métrica cruza un umbral, el servidor envía automáticamente una alerta al cliente.

## 🔧 Implementación en Proto

```proto
// Agregar al metrics.proto

// Suscripción a alertas
message AlertSubscription {
  repeated string agent_ids = 1;  // Agentes a monitorear (vacío = todos)
  repeated string severities = 2;  // info, warning, critical (vacío = todos)
  bool only_active = 3;  // Solo alertas activas (no resueltas)
}

// Stream de alertas
message AlertStream {
  Alert alert = 1;
  string event_type = 2;  // "triggered", "resolved", "updated"
}

service MetricsService {
  // ... servicios existentes ...
  
  // Nuevo: Streaming de alertas en tiempo real
  rpc StreamAlerts(AlertSubscription) returns (stream AlertStream);
  
  // Nuevo: Configurar reglas de alerta
  rpc CreateAlertRule(AlertRule) returns (AlertRule);
  rpc UpdateAlertRule(AlertRule) returns (AlertRule);
  rpc DeleteAlertRule(AlertRuleId) returns (Empty);
  rpc ListAlertRules(Empty) returns (AlertRuleList);
}
```

## 💻 Implementación en Python

```python
# app/alerts.py

import asyncio
from typing import Dict, List, Set
from dataclasses import dataclass
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

@dataclass
class AlertState:
    """Estado de una alerta activa"""
    rule_id: str
    agent_id: str
    metric: str
    value: float
    threshold: float
    severity: str
    triggered_at: datetime
    subscribers: Set  # Clientes suscritos a esta alerta

class AlertManager:
    """Gestiona reglas de alerta y notificaciones"""
    
    def __init__(self):
        self.rules: Dict[str, AlertRule] = {}
        self.active_alerts: Dict[str, AlertState] = {}
        self.subscribers: List = []  # Clientes suscritos al stream
        self.metric_history: Dict[str, List] = {}  # Historial para duración
    
    def add_rule(self, rule: AlertRule):
        """Agregar nueva regla de alerta"""
        self.rules[rule.id] = rule
        logger.info(f"Alert rule added: {rule.name} ({rule.id})")
    
    def check_metrics(self, snapshot: MetricsSnapshot):
        """Verificar métricas contra reglas"""
        agent_id = snapshot.agent_id
        
        for rule_id, rule in self.rules.items():
            if not rule.enabled:
                continue
            
            # Obtener valor de métrica
            metric_value = self._get_metric_value(snapshot, rule.metric)
            if metric_value is None:
                continue
            
            # Verificar condición
            triggered = self._check_condition(
                metric_value, 
                rule.operator, 
                rule.threshold
            )
            
            alert_key = f"{agent_id}:{rule_id}"
            
            if triggered:
                # Verificar duración
                if alert_key not in self.metric_history:
                    self.metric_history[alert_key] = []
                
                self.metric_history[alert_key].append({
                    'timestamp': snapshot.timestamp_unix_ms,
                    'value': metric_value
                })
                
                # Filtrar por duración
                duration_ms = rule.duration_seconds * 1000
                cutoff = snapshot.timestamp_unix_ms - duration_ms
                self.metric_history[alert_key] = [
                    m for m in self.metric_history[alert_key]
                    if m['timestamp'] > cutoff
                ]
                
                # Si cumple duración, activar alerta
                if len(self.metric_history[alert_key]) >= rule.duration_seconds:
                    if alert_key not in self.active_alerts:
                        self._trigger_alert(agent_id, rule, metric_value, snapshot)
                    else:
                        self._update_alert(alert_key, metric_value, snapshot)
            else:
                # Resolver alerta si existe
                if alert_key in self.active_alerts:
                    self._resolve_alert(alert_key, snapshot)
    
    def _trigger_alert(self, agent_id: str, rule: AlertRule, 
                       value: float, snapshot: MetricsSnapshot):
        """Activar nueva alerta"""
        alert = Alert(
            id=f"{agent_id}:{rule.id}:{snapshot.timestamp_unix_ms}",
            rule_id=rule.id,
            agent_id=agent_id,
            metric=rule.metric,
            value=value,
            threshold=rule.threshold,
            timestamp_unix_ms=snapshot.timestamp_unix_ms,
            severity=rule.severity,
            message=f"{rule.name}: {rule.metric} = {value} {rule.operator} {rule.threshold}",
            resolved=False
        )
        
        self.active_alerts[f"{agent_id}:{rule.id}"] = AlertState(
            rule_id=rule.id,
            agent_id=agent_id,
            metric=rule.metric,
            value=value,
            threshold=rule.threshold,
            severity=rule.severity,
            triggered_at=datetime.now(),
            subscribers=set()
        )
        
        # Notificar a suscriptores
        self._notify_subscribers(alert, "triggered")
        logger.warning(f"Alert triggered: {alert.message}")
    
    def _resolve_alert(self, alert_key: str, snapshot: MetricsSnapshot):
        """Resolver alerta"""
        if alert_key in self.active_alerts:
            alert_state = self.active_alerts[alert_key]
            
            alert = Alert(
                id=alert_key,
                rule_id=alert_state.rule_id,
                agent_id=alert_state.agent_id,
                metric=alert_state.metric,
                value=0,  # Ya no está activa
                threshold=alert_state.threshold,
                timestamp_unix_ms=snapshot.timestamp_unix_ms,
                severity=alert_state.severity,
                message=f"Alert resolved: {alert_state.metric}",
                resolved=True,
                resolved_at_unix_ms=snapshot.timestamp_unix_ms
            )
            
            del self.active_alerts[alert_key]
            self._notify_subscribers(alert, "resolved")
            logger.info(f"Alert resolved: {alert_key}")
    
    def _notify_subscribers(self, alert: Alert, event_type: str):
        """Notificar a todos los suscriptores"""
        for subscriber in self.subscribers:
            try:
                alert_stream = AlertStream(
                    alert=alert,
                    event_type=event_type
                )
                # Enviar a través del stream (implementación específica)
                asyncio.create_task(subscriber.send(alert_stream))
            except Exception as e:
                logger.error(f"Error notifying subscriber: {e}")
    
    def _get_metric_value(self, snapshot: MetricsSnapshot, metric: str) -> float:
        """Extraer valor de métrica del snapshot"""
        metric_map = {
            "cpu_percent": snapshot.cpu_percent,
            "memory_percent": snapshot.memory_percent,
            "load_1m": snapshot.load_1m,
            "disk_usage": snapshot.disks[0].percent if snapshot.disks else 0,
            # ... más métricas
        }
        return metric_map.get(metric)
    
    def _check_condition(self, value: float, operator: str, threshold: float) -> bool:
        """Verificar condición de alerta"""
        ops = {
            "gt": lambda v, t: v > t,
            "gte": lambda v, t: v >= t,
            "lt": lambda v, t: v < t,
            "lte": lambda v, t: v <= t,
            "eq": lambda v, t: v == t,
        }
        return ops.get(operator, lambda v, t: False)(value, threshold)
```

## 🎯 Uso en el Servidor

```python
# app/server.py

class MetricsServicer(metrics_pb2_grpc.MetricsServiceServicer):
    def __init__(self):
        self.collector = MetricsCollector()
        self.alert_manager = AlertManager()  # Nuevo
    
    async def StreamAlerts(
        self,
        request: metrics_pb2.AlertSubscription,
        context: grpc.aio.ServicerContext
    ) -> AsyncGenerator[metrics_pb2.AlertStream, None]:
        """Stream de alertas en tiempo real"""
        # Validar autenticación
        if not validate_token(context.invocation_metadata()):
            await context.abort(grpc.StatusCode.UNAUTHENTICATED, "Invalid token")
        
        # Crear queue para este cliente
        alert_queue = asyncio.Queue()
        
        # Función para enviar alertas a este cliente
        async def send_alert(alert_stream):
            await alert_queue.put(alert_stream)
        
        # Registrar este cliente
        self.alert_manager.subscribers.append(send_alert)
        
        try:
            # Enviar alertas activas existentes
            for alert_key, alert_state in self.alert_manager.active_alerts.items():
                if self._matches_subscription(alert_state, request):
                    alert = self._create_alert_from_state(alert_state)
                    yield metrics_pb2.AlertStream(
                        alert=alert,
                        event_type="triggered"
                    )
            
            # Stream nuevas alertas
            while True:
                if context.cancelled():
                    break
                
                try:
                    alert_stream = await asyncio.wait_for(
                        alert_queue.get(),
                        timeout=1.0
                    )
                    yield alert_stream
                except asyncio.TimeoutError:
                    # Enviar heartbeat para mantener conexión
                    continue
                    
        finally:
            # Desregistrar cliente
            if send_alert in self.alert_manager.subscribers:
                self.alert_manager.subscribers.remove(send_alert)
    
    async def StreamMetrics(self, request, context):
        """Stream de métricas (modificado para verificar alertas)"""
        # ... código existente ...
        
        while True:
            snapshot_dict = self.collector.get_full_snapshot(...)
            response = self._dict_to_response(snapshot_dict)
            
            # ✅ NUEVO: Verificar alertas
            self.alert_manager.check_metrics(response.snapshot)
            
            yield response
            await asyncio.sleep(interval_sec)
```

## 📱 Uso desde el Cliente (Frontend)

```typescript
// frontend/src/lib/alerts.ts

export async function* streamAlerts(
  subscription: AlertSubscription,
  token?: string
): AsyncGenerator<AlertStream> {
  const client = createMetricsServiceClient(token);
  
  const stream = client.streamAlerts(subscription);
  
  for await (const alertStream of stream) {
    yield alertStream;
  }
}

// En React component
useEffect(() => {
  const subscription = {
    agent_ids: [selectedAgent],
    severities: ['warning', 'critical'],
    only_active: true
  };
  
  const stream = streamAlerts(subscription, authToken);
  
  for await (const alert of stream) {
    if (alert.event_type === 'triggered') {
      // Mostrar notificación
      showNotification(alert.alert);
    } else if (alert.event_type === 'resolved') {
      // Ocultar notificación
      hideNotification(alert.alert.id);
    }
  }
}, [selectedAgent]);
```

## 🎨 Beneficios

1. **Tiempo Real**: Alertas instantáneas sin polling
2. **Eficiente**: Solo envía cuando hay cambios
3. **Escalable**: Múltiples clientes pueden suscribirse
4. **Flexible**: Filtros por agente, severidad, etc.
5. **Bidireccional**: Cliente puede enviar comandos (pausar, resolver)

## 🚀 Próximos Pasos

1. Implementar `AlertManager` completo
2. Agregar persistencia de reglas (SQLite/PostgreSQL)
3. Crear UI para configurar reglas
4. Agregar notificaciones visuales en frontend
5. Integrar con webhooks (Slack, email, etc.)

