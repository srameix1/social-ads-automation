---
description: Verifica workflows de n8n contra la arquitectura aprobada
---

## Arquitectura aprobada
!`cat progreso.md 2>/dev/null || echo "No existe progreso.md - no hay arquitectura de referencia"`

## Instrucciones
Usa n8n_list_workflows para listar todos los workflows del proyecto. Luego para cada workflow relevante usa n8n_get_workflow para verificar la estructura de nodos. Reporta: nodos faltantes, conexiones rotas, credenciales sin asignar, y diferencias vs la arquitectura aprobada mostrada arriba.
