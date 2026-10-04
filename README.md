# VITEG

Sistema independiente de gestión y seguimiento de reparto para purificadoras y negocios de distribución local. Esta primera base implementa la arquitectura definida en el análisis funcional: dos perfiles (`ADMIN` y `DRIVER`), aplicación móvil Expo para Android, API REST, MongoDB y comunicación en tiempo real con Socket.IO.

## Qué incluye esta versión

- Autenticación JWT y control de acceso por rol.
- Administración de usuarios y repartidores.
- Clientes separados de sus múltiples domicilios.
- Productos con prioridad logística y zonas geográficas.
- Rutas, paradas, máquina de estados y asignación de repartidor.
- Entregas completas, parciales o fallidas con cantidades y evidencia referenciada.
- Solicitudes de nuevos domicilios con aprobación del administrador.
- Tracking limitado a rutas activas y retención de puntos por 30 días.
- Conversaciones directas o vinculadas a una ruta.
- Notificaciones operativas.
- Experiencia móvil diferenciada para administrador y repartidor.
- Identidad visual basada en el logotipo oficial de VITEG.

## Estructura

```text
VITEG/
├── apps/
│   ├── api/       API Express + MongoDB + Socket.IO
│   └── app/       Aplicación móvil React Native + Expo para Android
├── packages/
│   └── shared/    Tipos, estados y reglas compartidas
├── docs/
│   └── architecture.md
└── docker-compose.yml
```

## Requisitos

- Node.js 22 o superior.
- npm 11 o superior.
- MongoDB 8 local o Docker.
- Expo Go para probar en un teléfono Android.

## Inicio rápido

```bash
npm install
docker compose up -d
copy .env.example .env
npm run seed
npm run dev
```

En PowerShell también puede copiarse el archivo con:

```powershell
Copy-Item .env.example .env
```

Servicios locales:

- API: `http://localhost:4000`
- Estado de la API: `http://localhost:4000/health`

## Cuentas demo

Después de ejecutar `npm run seed`:

| Perfil | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@viteg.mx` | `Viteg2026!` |
| Repartidor | `repartidor@viteg.mx` | `Viteg2026!` |

Las credenciales son solo para desarrollo. Deben reemplazarse antes de cualquier despliegue.

## Comandos

```bash
npm run dev          # API y app en paralelo
npm run dev:api      # Solo API
npm run dev:app      # Abre Expo para ejecutar la app Android
npm run build        # Compila y valida tipos
npm test             # Pruebas automatizadas
npm run seed         # Datos iniciales
```

## Decisiones importantes

- VITEG no comparte código, base de datos ni módulos con Orbit ERP.
- Cliente y domicilio son entidades diferentes.
- Agua y hielo son registros configurables, no condiciones especiales en código.
- La prioridad de negocio y la optimización geográfica son conceptos separados.
- El tracking se acepta únicamente mientras la ruta esté activa.
- Las fotografías se guardarán en almacenamiento de objetos; MongoDB solo conserva URL y clave.
- Las rutas y paradas usan transiciones controladas para evitar estados ambiguos.

Consulta [docs/architecture.md](docs/architecture.md) para ver módulos, flujos y siguientes fases.

