# WhatsApp Business - Gestión de Cuentas Corrientes

Una aplicación completa para el manejo de cuentas corrientes de empleados a través de WhatsApp Business Cloud API.

## 🎯 Objetivo

Automatizar por WhatsApp Business la atención de empleados que consultan su cuenta corriente (consumos internos de panadería, carnicería, proveedores de la empresa y adelantos de sueldo).

## ✨ Características Implementadas

- ✅ **Integración WhatsApp Business Cloud API** - Mensajes interactivos, botones, listas
- ✅ **Identificación por número** - Mapeo automático phone_number → empleado
- ✅ **Menú interactivo** - Ver resumen, detalle por categoría, PDF, disputas
- ✅ **Cierre mensual automatizado** - Jobs programables con BullMQ
- ✅ **Generación de PDFs** - Extractos automáticos con PDFKit
- ✅ **Importación CSV** - Empleados y movimientos masivos
- ✅ **Sistema de tickets** - Derivación a RR. HH.
- ✅ **Rate limiting y seguridad** - Protección contra abuso
- ✅ **Tests completos** - Unitarios y E2E con Jest
- ✅ **Dockerizado** - Fácil despliegue con docker-compose

## 🏗️ Arquitectura

```
/src
  /config          # Configuraciones
  /db             # Cliente Prisma
  /domain         # Servicios de dominio
    /employees    # Gestión de empleados
    /accounts     # Cuentas corrientes
    /transactions # Transacciones
    /statements   # Extractos/cierres
    /tickets      # Sistema de tickets
    /whatsapp     # Textos y copys
  /jobs           # BullMQ jobs
  /routes         # API endpoints
  /services       # Servicios externos
  /utils          # Utilidades
/tests           # Tests unitarios y E2E
/prisma          # Esquema de base de datos
/samples         # Archivos CSV de ejemplo
```

## 🛠️ Tecnologías

- **Backend**: Node.js 20, TypeScript, Express
- **Base de datos**: PostgreSQL 15 con Prisma ORM
- **Cache/Jobs**: Redis + BullMQ
- **WhatsApp**: Business Cloud API (Graph)
- **PDFs**: PDFKit
- **Tests**: Jest + Supertest
- **Linting**: ESLint + Prettier
- **Contenedores**: Docker + docker-compose

## 🚀 Instalación Rápida

### 1. Clonar y configurar

```bash
git clone <url-del-repositorio>
cd whatsapp-accounts
cp env.example .env
```

### 2. Configurar variables de entorno

Editar `.env` con tus credenciales:

```env
# Base de datos
DATABASE_URL="postgresql://postgres:password@localhost:5432/whatsapp_accounts"

# Redis
REDIS_URL="redis://localhost:6379"

# WhatsApp Business Cloud API
WHATSAPP_TOKEN="tu_token_de_whatsapp"
WHATSAPP_PHONE_NUMBER_ID="tu_phone_number_id"
VERIFY_TOKEN="tu_verify_token"

# Admin
ADMIN_TOKEN="tu_admin_token"

# Empresa
COMPANY_NAME="Tu Empresa"
```

### 3. Levantar servicios

```bash
# Opción 1: Docker (recomendado)
docker-compose up -d

# Opción 2: Local
npm install
npm run db:push
npm run db:seed
npm run dev
```

### 4. Configurar WhatsApp Business

1. **Crear app en Meta for Developers**
2. **Agregar producto WhatsApp Business**
3. **Configurar webhook**: `https://tu-dominio.com/webhook/whatsapp`
4. **Verificar con ngrok** (desarrollo):
   ```bash
   ngrok http 3000
   ```

## 📱 Flujos de Usuario

### Empleado Nuevo
1. Envía mensaje → Bot pide DNI
2. Confirma identidad → Queda registrado
3. Recibe menú principal

### Empleado Existente
1. Envía "Hola" → Menú interactivo
2. **Ver resumen** → Saldo actual + totales por rubro
3. **Detalle por categoría** → Últimos movimientos
4. **Recibir PDF** → Extracto del último cierre
5. **Disputar cargo** → Crea ticket para RR. HH.
6. **Hablar con RR. HH.** → Derivación directa

## 🔧 API de Administración

### Importar datos

```bash
# Empleados
curl -X POST \
  -H "X-Admin-Token: tu_admin_token" \
  -F "file=@samples/empleados.csv" \
  -F "fileType=employees" \
  http://localhost:3000/admin/import/csv

# Movimientos
curl -X POST \
  -H "X-Admin-Token: tu_admin_token" \
  -F "file=@samples/movimientos.csv" \
  -F "fileType=transactions" \
  http://localhost:3000/admin/import/csv
```

### Cerrar período

```bash
# Todas las cuentas
curl -X POST \
  -H "X-Admin-Token: tu_admin_token" \
  -H "Content-Type: application/json" \
  -d '{"date": "2025-01-31", "sendNotifications": true}' \
  http://localhost:3000/admin/close-period/all
```

### Ver estadísticas

```bash
curl -H "X-Admin-Token: tu_admin_token" \
  http://localhost:3000/admin/stats
```

## 📊 Modelo de Datos

### Empleados
- Identificación única por DNI y teléfono
- Código de empleado para importación
- Estado (ACTIVO/INACTIVO/SUSPENDIDO)

### Cuentas Corrientes
- Vinculadas a empleados
- Día de cierre configurable (default: 20)
- Historial de cierres

### Transacciones
- Tipos: PANADERÍA, CARNICERÍA, PROVEEDORES, ADELANTO
- Montos en centavos (precisión)
- Fechas de contabilización

### Extractos
- Períodos de cierre
- PDFs generados automáticamente
- Saldos de cierre

## 🧪 Testing

```bash
# Tests unitarios
npm test

# Tests con coverage
npm run test:coverage

# Tests en modo watch
npm run test:watch
```

## 📝 Scripts Disponibles

```bash
# Desarrollo
npm run dev              # Servidor con hot reload
npm run build            # Compilar TypeScript
npm start               # Servidor de producción

# Base de datos
npm run db:push         # Sincronizar esquema
npm run db:migrate      # Crear migración
npm run db:seed         # Poblar con datos de prueba
npm run db:studio        # Abrir Prisma Studio

# Calidad de código
npm run lint            # Verificar ESLint
npm run lint:fix        # Corregir automáticamente
npm run format          # Formatear con Prettier
npm run format:check    # Verificar formato

# Docker
npm run docker:up       # Levantar servicios
npm run docker:down     # Detener servicios
npm run docker:logs     # Ver logs
```

## 🔒 Seguridad

- **Rate limiting**: 30 req/min por IP y número
- **Autenticación admin**: Token X-Admin-Token
- **Validación**: Zod schemas en todos los endpoints
- **Logs sanitizados**: DNI y teléfonos anonimizados
- **Variables de entorno**: Credenciales seguras

## 📈 Monitoreo

- **Health check**: `GET /health`
- **Estadísticas**: `GET /admin/stats`
- **Estado de colas**: `GET /admin/queues/status`
- **Logs estructurados**: Winston con niveles configurables

## 🚀 Despliegue

### Docker Compose (Recomendado)

```bash
docker-compose up -d
```

### Manual

```bash
npm run build
npm start
```

### Variables de entorno de producción

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379
WHATSAPP_TOKEN=tu_token_produccion
# ... resto de variables
```

## 📋 Criterios de Aceptación ✅

- [x] Número nuevo se registra con DNI y nombre
- [x] Empleado existente recibe menú interactivo
- [x] "Ver resumen" muestra saldo y totales por rubro
- [x] "Detalle por categoría" lista últimos movimientos
- [x] "Recibir PDF" envía documento del último Statement
- [x] "Hablar con RR. HH." crea ticket y silencia bot
- [x] Importar CSV crea/actualiza empleados y movimientos
- [x] Cierre mensual genera Statement y notifica (opcional)

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.

## 🆘 Soporte

Para soporte técnico o consultas:
- Crear issue en GitHub
- Contactar al equipo de desarrollo
- Revisar documentación de WhatsApp Business API
