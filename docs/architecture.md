# Arquitectura de VITEG

## Contexto

VITEG es un producto independiente orientado inicialmente a purificadoras, pero modelado para soportar distribución de gas, alimentos, bebidas, farmacia, refacciones o paquetería local sin condicionar el código a un producto específico.

```text
App móvil Expo (Android)
        │
        ├── REST ───────────── Express API ───────── MongoDB
        │
        └── WebSocket ──────── Socket.IO
                                      │
                         Chat, tracking y eventos
```

## Límites de módulos

| Módulo | Responsabilidad |
|---|---|
| Auth | Sesión, identidad y permisos |
| Usuarios | Administradores, repartidores y estado de cuenta |
| Clientes | Persona o empresa receptora |
| Domicilios | Puntos de entrega de cada cliente |
| Productos | Catálogo, unidad, precio y prioridad logística |
| Zonas | Agrupación geográfica |
| Distribución | Rutas, paradas, agenda y plantillas |
| Entregas | Resultado real, cantidades, evidencia e incidencias |
| Tracking | Ubicación durante rutas activas |
| Mensajería | Conversaciones directas o contextuales |
| Notificaciones | Eventos dirigidos a usuarios |
| Reportes | Indicadores calculados desde datos operativos |

## Reglas de negocio implementadas

### Ruta

```text
DRAFT → SCHEDULED → ASSIGNED → IN_PROGRESS → COMPLETED
                                      ↕
                                   PAUSED
```

`CANCELLED` es una salida permitida antes del cierre. Las rutas completadas o canceladas no se reabren.

### Entrega

- `COMPLETED`: todo lo esperado fue entregado.
- `PARTIAL`: solo una parte fue entregada.
- `FAILED`: nada pudo entregarse y se exige motivo operativo.
- La parada se cierra con el estado equivalente y conserva las cantidades reales.

### Solicitud de domicilio

```text
DRIVER crea solicitud PENDING
           │
           ├── ADMIN aprueba → Customer + CustomerAddress
           └── ADMIN rechaza → motivo + notificación
```

### Tracking

- Solo `DRIVER` puede emitir su ubicación.
- La ruta debe pertenecerle y estar `IN_PROGRESS` o `PAUSED`.
- Los puntos históricos expiran automáticamente después de 30 días.
- El administrador recibe actualizaciones mediante Socket.IO.

## Seguridad

- Contraseñas con bcrypt (12 rondas).
- JWT de 12 horas.
- Autorización en servidor; la interfaz nunca es la única barrera.
- Helmet, CORS restringido y límite de cuerpo JSON.
- Consultas separadas por `tenantId`, preparadas para multitenencia futura.
- El proveedor de archivos deberá usar URLs firmadas y validar tipo/tamaño.

## Siguientes fases

1. Formularios administrativos completos y reordenamiento visual de paradas.
2. Integración de mapas (Mapbox, Google Maps u OpenStreetMap) mediante adaptador.
3. Carga de imágenes con S3, Cloudinary, Supabase Storage o Azure Blob.
4. Push notifications y ejecución de tracking en segundo plano.
5. Plantillas recurrentes y generación automática de agenda.
6. Optimización de ruta que combine prioridad, ventana horaria, distancia y zona.
7. Vehículos, inventario cargado, cobros y conciliación.
8. Reportes exportables y políticas de auditoría/retención.

