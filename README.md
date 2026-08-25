# Intranet SGC · Camping 44 S.A.

Sistema de Gestión de Calidad propio de Camping 44 S.A., construido para
reemplazar la suscripción a Sofidya (USD 250 por mes).

Cubre nueve módulos del SGC. Tres están completos y operativos; los otros
seis tienen su estructura de datos creada y una pantalla de consulta
navegable, y se completan en fases posteriores.

| Módulo | Estado |
| --- | --- |
| 1 · Control de información documentada | Operativo |
| 2 · No conformidades y acciones correctivas | Operativo |
| 3 · Riesgos y oportunidades | Operativo |
| 4 · Auditorías internas | Operativo |
| 5 · Indicadores y objetivos | Operativo |
| 6 · Satisfacción del cliente | Esquema y consulta |
| 7 · Recursos humanos | Esquema y consulta |
| 8 · Proveedores | Operativo |
| 9 · Infraestructura y activos | Esquema y consulta |

## Tecnología

- **Next.js 14** con App Router y TypeScript
- **Tailwind CSS** con componentes propios de interfaz
- **Supabase**: PostgreSQL, autenticación y almacenamiento de archivos
- **Autenticación con Google**, restringida al dominio `camping44.com.py`
- **RLS activo en todas las tablas**, sin excepción
- Despliegue en **Vercel**, con Vercel Cron para las alertas por vencimiento
- Gestor de paquetes: **npm**

## Instalación paso a paso

### 1. Requisitos previos

- Node.js 20 o superior (`node -v`)
- npm 10 o superior (`npm -v`)
- Una cuenta de Supabase y un proyecto creado
- Opcional, para trabajar sin conexión: la [CLI de Supabase](https://supabase.com/docs/guides/cli)

### 2. Clonar e instalar

```bash
git clone https://github.com/TI-Camping44/INTRANET.git
cd INTRANET
npm install
```

### 3. Variables de entorno

```bash
cp .env.example .env.local
```

Complete `.env.local` con los valores de su proyecto. El detalle de dónde
sale cada valor está en `docs/despliegue.md`.

Como mínimo, para levantar la aplicación se necesita:

```
NEXT_PUBLIC_SUPABASE_URL="https://xxxxxxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."
NEXT_PUBLIC_SITIO_URL="http://localhost:3000"
```

> **Nunca** suba `.env.local` al repositorio. Ya está en `.gitignore`.

### 4. Base de datos

Las migraciones están en `supabase/migrations/`, numeradas y en orden.

**Opción A · Con la CLI de Supabase (recomendada):**

```bash
supabase link --project-ref <referencia-del-proyecto>
supabase db push          # aplica las migraciones
psql "$DATABASE_URL" -f supabase/seed.sql   # datos de demostración
```

**Opción B · Desde el panel de Supabase:**

Abra *SQL Editor* y ejecute los archivos de `supabase/migrations/` **en
orden alfabético**, uno por uno. Después, `supabase/seed.sql`.

### 5. Autenticación con Google

En el panel de Supabase, *Authentication → Providers → Google*, active el
proveedor y cargue el `Client ID` y el `Client Secret` de Google Cloud.
Los pasos completos están en `docs/despliegue.md`.

### 6. Levantar la aplicación

```bash
npm run dev
```

La aplicación queda en <http://localhost:3000>.

### 7. Primer ingreso y asignación del rol

Cualquier cuenta del dominio `camping44.com.py` puede ingresar. El sistema
crea su perfil automáticamente con rol **Colaborador**.

Para que la primera persona pueda administrar el sistema, hay que elevarla
a Administrador SGC. Desde el *SQL Editor* de Supabase:

```sql
update public.usuarios
   set rol = 'administrador_sgc'
 where correo = 'facundocolman@camping44.com.py';
```

A partir de ahí, el resto de los roles se asigna desde la propia
aplicación, en **Administración → Usuarios y roles**.

## Comandos disponibles

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Levanta el servidor de desarrollo |
| `npm run build` | Compila para producción |
| `npm run start` | Sirve la compilación de producción |
| `npm run lint` | Revisa el código con ESLint |
| `npm run tipos` | Verifica los tipos de TypeScript |
| `npm run migrar-sofidya` | Importa los datos desde Sofidya |
| `npm run migrar-sofidya -- --ensayo` | Muestra qué importaría, sin escribir |

## Datos de demostración

`supabase/seed.sql` carga un conjunto de datos coherente con la operación
de Camping 44: nueve procesos, nueve documentos con su historial de
versiones, seis no conformidades con análisis de causa raíz, ocho riesgos
distribuidos en la matriz, cuatro auditorías, seis indicadores con seis
meses de mediciones, proveedores, activos y capacitaciones.

Todos los registros llevan `es_demostracion = true` y los usuarios usan el
prefijo `demo.` en su correo, de modo que nunca se confundan con los datos
reales ni colisionen con las cuentas de Google Workspace.

Para eliminar la demostración por completo:

```sql
delete from public.no_conformidades where es_demostracion;
delete from public.riesgos           where es_demostracion;
delete from public.documentos        where es_demostracion;
delete from public.auditorias        where es_demostracion;
delete from public.programas_auditoria where es_demostracion;
delete from public.indicadores       where es_demostracion;
delete from public.objetivos         where es_demostracion;
delete from public.encuestas         where es_demostracion;
delete from public.capacitaciones    where es_demostracion;
delete from public.activos           where es_demostracion;
delete from public.proveedores       where es_demostracion;
delete from public.clientes          where es_demostracion;
delete from auth.users where email like 'demo.%@camping44.com.py';
```

## Importación desde Sofidya

`scripts/migrar-sofidya.ts` recorre los diez comandos de listado del API
de Sofidya y carga las tablas equivalentes. Es idempotente: se puede
volver a ejecutar sin duplicar registros.

```bash
# Ensayo: muestra qué haría, sin escribir nada
npm run migrar-sofidya -- --ensayo

# Importación real
npm run migrar-sofidya
```

La `SecretKey` va en `.env.local`, nunca en el repositorio. Si no está
definida, el script corre contra `scripts/datos-ejemplo-sofidya.json`, de
modo que la importación se pueda probar de extremo a extremo antes de
tener la clave real.

Dos comandos no tienen tabla equivalente y se tratan aparte:

- `get_personas`: las personas no pueden cargarse directamente en
  `usuarios`, porque ese identificador nace en el primer ingreso con
  Google. Quedan en `personas_sofidya` y se vinculan por correo cuando la
  persona ingresa.
- `get_inf_listados_predef`: son listados propios de Sofidya sin
  equivalente. Se conservan en crudo en `importaciones_sofidya`.

## Estructura del proyecto

```
src/
  app/
    (sgc)/               Pantallas con sesión iniciada
      panel/             Tablero de inicio
      documentos/        Módulo 1
      no-conformidades/  Módulo 2
      riesgos/           Módulo 3
      auditorias/        Módulo 4
      indicadores/       Módulo 5
      proveedores/       Módulo 8
      satisfaccion/
      recursos-humanos/  activos/
      buscar/  notificaciones/  bitacora/  perfil/
      administracion/    Usuarios y roles
    api/cron/alertas/    Trabajo programado de vencimientos
    auth/                Retorno de Google y cierre de sesión
    ingresar/            Pantalla de ingreso
  components/
    ui/                  Componentes de interfaz
    comunes/             Componentes del dominio
  lib/                   Utilidades, formatos, sesión, correo
supabase/
  migrations/            Migraciones SQL versionadas
  seed.sql               Datos de demostración
scripts/
  migrar-sofidya.ts      Importación única desde Sofidya
docs/
  despliegue.md          Puesta en marcha en Supabase y Vercel
```

## Seguridad

- **Dominio validado en tres capas**: el parámetro `hd` del proveedor de
  Google, la comprobación del servidor en el middleware y en el retorno de
  autenticación, y un disparador en la base de datos que rechaza el alta de
  cualquier perfil fuera de `camping44.com.py`.
- **RLS activo en todas las tablas.** Los permisos por rol se resuelven en
  la base de datos, no en la interfaz.
- **Bitácora por disparador.** Toda creación, edición y cambio de estado
  queda registrada con usuario, fecha y valores anterior y nuevo. Al
  escribirse desde la base de datos, ningún camino de la aplicación puede
  evadirla. Es requisito de auditoría ISO.
- **Ninguna credencial en el repositorio.** Todo pasa por `.env.local`.
- La clave de servicio de Supabase se usa únicamente en el trabajo
  programado de alertas y en el script de importación, nunca para atender
  una petición de la interfaz.

## Fuera de alcance

- **Odoo 17 Enterprise** queda fuera de este proyecto. Si algún módulo
  necesitara datos del ERP, se resolverá más adelante mediante un endpoint
  intermedio de solo lectura.
- El **panel de NPS** existente (Apps Script y GitHub Pages) sigue siendo
  la fuente de la medición de satisfacción. El módulo 6 está preparado para
  ingerir esos datos más adelante, no para reemplazarlos.
