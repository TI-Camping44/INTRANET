# Puesta en marcha · Intranet SGC Camping 44 S.A.

Guía completa para dejar el sistema funcionando en producción, sobre
Supabase y Vercel. Está escrita para que la pueda seguir alguien que no
participó del desarrollo.

Tiempo estimado: entre 60 y 90 minutos la primera vez.

---

## Índice

1. [Qué se necesita antes de empezar](#1-qué-se-necesita-antes-de-empezar)
2. [Crear el proyecto de Supabase](#2-crear-el-proyecto-de-supabase)
3. [Aplicar el esquema de base de datos](#3-aplicar-el-esquema-de-base-de-datos)
4. [Configurar el ingreso con Google](#4-configurar-el-ingreso-con-google)
5. [Configurar el almacenamiento de archivos](#5-configurar-el-almacenamiento-de-archivos)
6. [Configurar el correo](#6-configurar-el-correo)
7. [Desplegar en Vercel](#7-desplegar-en-vercel)
8. [Activar las alertas programadas](#8-activar-las-alertas-programadas)
9. [Primer ingreso y asignación de roles](#9-primer-ingreso-y-asignación-de-roles)
10. [Conectar Looker Studio](#10-conectar-looker-studio)
11. [Importar los datos de Sofidya](#11-importar-los-datos-de-sofidya)
12. [Verificación final](#12-verificación-final)
13. [Mantenimiento](#13-mantenimiento)
14. [Problemas frecuentes](#14-problemas-frecuentes)

---

## 1. Qué se necesita antes de empezar

| Recurso | Para qué |
| --- | --- |
| Cuenta de Supabase | Base de datos, autenticación y archivos |
| Cuenta de Vercel | Alojamiento de la aplicación |
| Acceso de administrador a Google Workspace | Crear las credenciales de OAuth |
| Una cuenta de correo del dominio, por ejemplo `sgc@camping44.com.py` | Envío de notificaciones |
| Acceso al repositorio en GitHub | Despliegue automático |

Anote a medida que avance los valores que le va a pedir el paso 7.

---

## 2. Crear el proyecto de Supabase

1. Entre a <https://supabase.com/dashboard> y elija **New project**.
2. Complete:
   - **Name**: `intranet-sgc-camping44`
   - **Database password**: genere una larga y guárdela en el gestor de
     contraseñas de la empresa. Se necesita para conectarse por SQL.
   - **Region**: `South America (São Paulo)`, que es la más cercana a
     Asunción y la que da menor latencia.
3. Espere a que el proyecto termine de aprovisionarse (unos dos minutos).

### Anotar las claves

Vaya a **Project Settings → API** y copie:

| Valor en Supabase | Variable de entorno |
| --- | --- |
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` `secret` | `SUPABASE_SERVICE_ROLE_KEY` |

> La clave `service_role` **ignora todas las políticas de seguridad**. No
> debe compartirse por correo ni por chat, ni cargarse en ninguna variable
> que empiece con `NEXT_PUBLIC_`. En este proyecto se usa solamente en el
> trabajo programado de alertas y en el script de importación.

---

## 3. Aplicar el esquema de base de datos

El esquema son veinte archivos SQL en `supabase/migrations/`, que deben
aplicarse **en orden alfabético**.

### Opción A · Un solo archivo, pegado en el panel (la más rápida)

`supabase/instalacion-completa.sql` reúne todas las migraciones en orden
más el seed de demostración. No requiere instalar nada:

1. Panel de Supabase → **SQL Editor → New query**.
2. Pegue el archivo entero y ejecute (**Run**).
3. Termina con el aviso `Datos de demostración cargados`.

Es la vía indicada para montar la instancia de demostración. Si quiere
una instancia **sin datos de ejemplo**, corte el archivo antes del bloque
`SEED · datos de demostracion`.

> El archivo se genera, no se edita: `bash scripts/generar-instalacion.sh`
> lo rehace a partir de `supabase/migrations/` y `supabase/seed.sql`. Si
> agrega una migración, vuelva a generarlo.

### Opción B · Con la CLI de Supabase (para el día a día)

```bash
npm install -g supabase
supabase login
supabase link --project-ref <referencia-del-proyecto>
supabase db push
```

La referencia del proyecto es la parte del medio de la URL del panel:
`https://supabase.com/dashboard/project/<referencia-del-proyecto>`.

### Opción C · Archivo por archivo desde el panel

1. Abra **SQL Editor → New query**.
2. Copie el contenido de cada archivo de `supabase/migrations/`, en orden,
   y ejecútelo. Espere el `Success` de cada uno antes de seguir.

El orden es este:

```
20260824000100_extensiones_y_tipos.sql
20260824000200_tablas_base.sql
20260824000300_documentos.sql
20260824000400_no_conformidades.sql
20260824000500_riesgos.sql
20260824000600_auditorias.sql
20260824000700_indicadores.sql
20260824000800_satisfaccion.sql
20260824000900_recursos_humanos.sql
20260824001000_proveedores_activos.sql
20260824001100_transversales.sql
20260824001200_funciones_rls.sql
20260824001300_politicas_rls.sql
20260824001400_bitacora_y_notificaciones.sql
20260824001500_busqueda_global.sql
20260824001600_almacenamiento.sql
20260824001700_importacion_sofidya.sql
20260824001800_correlativo_auditorias.sql
20260824001900_mantenimientos.sql
20260825000100_reclamos_desde_satisfaccion.sql
```

### Cargar los datos de demostración

Solamente si va a mostrar el sistema antes de tener datos reales:

```bash
psql "postgresql://postgres:<contraseña>@db.<referencia>.supabase.co:5432/postgres" \
  -f supabase/seed.sql
```

O pegue el contenido de `supabase/seed.sql` en el **SQL Editor**.

### Verificar que quedó bien

Ejecute esta consulta. Debe devolver **cero filas**: si aparece alguna,
hay una tabla sin protección.

```sql
select tablename
  from pg_tables
 where schemaname = 'public'
   and not rowsecurity;
```

---

## 4. Configurar el ingreso con Google

### 4.1 · Crear las credenciales en Google Cloud

1. Entre a <https://console.cloud.google.com/> con una cuenta de
   administrador del dominio.
2. Cree un proyecto nuevo: `Intranet SGC Camping 44`.
3. Vaya a **APIs y servicios → Pantalla de consentimiento de OAuth**:
   - Tipo de usuario: **Interno** (así solo lo ven las cuentas del dominio).
   - Nombre de la aplicación: `Intranet SGC`.
   - Correo de asistencia: `ti@camping44.com.py`.
   - Dominio autorizado: `camping44.com.py`.
4. Vaya a **Credenciales → Crear credenciales → ID de cliente de OAuth**:
   - Tipo: **Aplicación web**.
   - Nombre: `Intranet SGC · Supabase`.
   - **URI de redireccionamiento autorizado**:
     `https://<referencia>.supabase.co/auth/v1/callback`

     La URL exacta la muestra Supabase en el paso siguiente; cópiela de
     allí para no equivocarse.
5. Guarde el **Client ID** y el **Client Secret**.

### 4.2 · Activar el proveedor en Supabase

1. **Authentication → Providers → Google**: active el interruptor.
2. Pegue el `Client ID` y el `Client Secret`.
3. Guarde.

### 4.3 · Definir las URL de la aplicación

En **Authentication → URL Configuration**:

- **Site URL**: `https://intranet.camping44.com.py`
  (o la URL que asigne Vercel, mientras no haya dominio propio).
- **Redirect URLs**, una por línea:
  ```
  https://intranet.camping44.com.py/auth/callback
  http://localhost:3000/auth/callback
  ```

> La restricción de dominio no depende de esta configuración. El sistema
> la valida en tres capas independientes: el parámetro `hd` que se envía a
> Google, la comprobación del servidor en el middleware y en el retorno de
> autenticación, y un disparador en la base de datos que rechaza el alta de
> cualquier perfil cuyo correo no sea `@camping44.com.py`.

---

## 5. Configurar el almacenamiento de archivos

El *bucket* `adjuntos-sgc` lo crea la migración `..._almacenamiento.sql`,
junto con sus políticas de acceso. No hay que hacer nada a mano.

Para verificarlo, vaya a **Storage**. Debe aparecer `adjuntos-sgc`,
marcado como **privado**, con un límite de 20 MB por archivo.

Los archivos nunca son públicos: la aplicación entrega enlaces firmados de
duración corta, generados en el servidor.

---

## 6. Configurar el correo

Las notificaciones salen por el **SMTP de Google Workspace**, usando una
cuenta del propio dominio.

### 6.1 · Preparar la cuenta remitente

1. Cree o elija una cuenta, por ejemplo `sgc@camping44.com.py`.
2. Active la **verificación en dos pasos** en esa cuenta.
3. Entre a <https://myaccount.google.com/apppasswords> con esa cuenta y
   genere una **contraseña de aplicación**. Google entrega dieciséis
   caracteres: esa es la que va en `SMTP_CLAVE`, no la contraseña normal.

### 6.2 · Variables

```
SMTP_HOST="smtp.gmail.com"
SMTP_PUERTO="465"
SMTP_USUARIO="sgc@camping44.com.py"
SMTP_CLAVE="<los dieciséis caracteres>"
SMTP_REMITENTE="Intranet SGC <sgc@camping44.com.py>"
```

Límite de Google Workspace: 2.000 envíos por día, muy por encima de lo que
necesitan 49 usuarios.

> Si el correo no está configurado, el sistema **sigue funcionando**: las
> notificaciones aparecen igual en la campana dentro de la aplicación y el
> envío se omite dejando aviso en el registro del servidor.

---

## 7. Desplegar en Vercel

1. Entre a <https://vercel.com/new> e importe el repositorio
   `TI-Camping44/INTRANET`.
2. Vercel detecta Next.js solo. No cambie la configuración de compilación.
3. En **Environment Variables**, cargue todas las variables. Marque los
   tres entornos (Production, Preview, Development):

   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   NEXT_PUBLIC_SITIO_URL
   SMTP_HOST
   SMTP_PUERTO
   SMTP_USUARIO
   SMTP_CLAVE
   SMTP_REMITENTE
   CRON_SECRET
   ```

   Para `CRON_SECRET` genere una cadena larga y aleatoria:

   ```bash
   openssl rand -base64 32
   ```

4. **Deploy**.
5. Cuando termine, copie la URL que asignó Vercel y:
   - actualice `NEXT_PUBLIC_SITIO_URL` con esa URL;
   - agréguela a las **Redirect URLs** de Supabase (paso 4.3);
   - vuelva a desplegar para que tome el valor nuevo.

### Dominio propio (opcional)

En **Settings → Domains** agregue `intranet.camping44.com.py` y cargue en
el DNS el registro `CNAME` que indique Vercel. Después actualice
`NEXT_PUBLIC_SITIO_URL` y las Redirect URLs de Supabase.

---

## 8. Activar las alertas programadas

El archivo `vercel.json` ya deja programado el trabajo:

```json
{ "path": "/api/cron/alertas", "schedule": "0 11 * * *" }
```

Vercel Cron trabaja en **UTC**. Las 11:00 UTC son las 07:00 en Asunción
durante el horario estándar y las 08:00 durante el horario de verano. Si
prefiere otra hora, ajuste el valor y vuelva a desplegar.

Cada corrida revisa cinco frentes:

1. Acciones correctivas próximas a vencer (aviso tres días antes).
2. Acciones vencidas: aviso al responsable, **escalamiento al jefe
   inmediato a los diez días** y al nivel siguiente a los veinte.
3. Documentos vigentes que se acercan a su fecha de revisión (treinta días).
4. Riesgos que llegaron a su fecha de reevaluación.
5. Mantenimientos preventivos programados para la semana.

### Probarlo a mano

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" \
     https://intranet.camping44.com.py/api/cron/alertas
```

Debe responder un JSON con el resumen de lo que hizo. Sin la cabecera
correcta responde `401`, que es lo esperado.

> El escalamiento necesita que cada usuario tenga cargado su **jefe
> inmediato**. Se asigna en **Administración → Usuarios y roles**. Sin ese
> dato, la acción vencida notifica al responsable pero no escala.

---

## 9. Primer ingreso y asignación de roles

1. Entre a la URL del sistema y elija **Continuar con Google**.
2. Ingrese con su cuenta `@camping44.com.py`. El perfil se crea solo, con
   rol **Colaborador**.
3. Para elevar a la primera persona a administrador, en el **SQL Editor**
   de Supabase:

   ```sql
   update public.usuarios
      set rol = 'administrador_sgc'
    where correo = 'facundocolman@camping44.com.py';
   ```

4. Vuelva a entrar. Ya aparece **Administración → Usuarios y roles**, y
   desde ahí se asignan los demás roles sin volver a tocar SQL.

### Los cinco roles

| Rol | Qué puede hacer |
| --- | --- |
| Administrador SGC | Control total del sistema |
| Responsable de proceso | Gestiona la documentación y los registros de sus procesos |
| Colaborador | Consulta documentación vigente y registra desviaciones |
| Auditor | Lectura amplia y gestión de auditorías internas |
| Dirección | Solo lectura, orientado a indicadores y tableros |

Los permisos se aplican en la base de datos mediante RLS. Cambiar el rol
en la interfaz no alcanza para saltarse ninguna restricción, porque la
verificación ocurre en cada consulta.

---

## 10. Conectar Looker Studio

Las mediciones de indicadores se exponen en la vista
`vista_indicadores_looker`, que ya entrega el valor real, la meta del
período y si se cumplió.

1. En Supabase, **Project Settings → Database → Connection string**, tome
   los datos de conexión.
2. Cree un usuario de solo lectura para el informe:

   ```sql
   create role looker_lectura login password '<contraseña-larga>';
   grant usage on schema public to looker_lectura;
   grant select on public.vista_indicadores_looker to looker_lectura;
   ```

3. En Looker Studio, agregue un origen de datos **PostgreSQL** con:
   - Host: `db.<referencia>.supabase.co`
   - Puerto: `5432`
   - Base de datos: `postgres`
   - Usuario: `looker_lectura`
   - Habilite **Enable SSL**.
4. Elija **Custom query**:

   ```sql
   select * from public.vista_indicadores_looker;
   ```

> Este usuario solo puede leer esa vista. No tiene acceso a documentos, no
> conformidades, riesgos ni a ninguna otra tabla.

---

## 11. Importar los datos de Sofidya

Mientras la suscripción a Sofidya siga activa, conviene traer los datos
maestros. La importación es única y se puede repetir sin duplicar nada.

1. Agregue a `.env.local` (en su máquina, no en Vercel):

   ```
   SOFIDYA_API_URL="<URL base del API>"
   SOFIDYA_SECRET_KEY="<clave entregada por Sofidya>"
   ```

2. Pruebe primero sin escribir nada:

   ```bash
   npm run migrar-sofidya -- --ensayo
   ```

3. Si el resumen se ve bien, importe de verdad:

   ```bash
   npm run migrar-sofidya
   ```

4. Cuando termine, **borre la `SOFIDYA_SECRET_KEY` de `.env.local`**. No
   se necesita más.

Cada corrida deja registro en la tabla `importaciones_sofidya`, con
cuántos registros llegaron y cuántos se cargaron por comando.

Si todavía no tiene la clave, el script corre igual contra
`scripts/datos-ejemplo-sofidya.json` y permite verificar el circuito
completo.

---

## 12. Verificación final

Recorra esta lista antes de dar el sistema por entregado:

- [ ] Ingreso con una cuenta `@camping44.com.py` funciona.
- [ ] Ingreso con una cuenta de otro dominio es rechazado y muestra la
      pantalla *Sin acceso*.
- [ ] El tablero de inicio muestra los contadores.
- [ ] Se puede crear un documento, enviarlo a revisión y aprobarlo; la
      versión sube de v00 a v01 y la anterior queda obsoleta.
- [ ] Se puede registrar una no conformidad, cargar los cinco porqués y
      crear una acción con responsable y fecha límite.
- [ ] Se puede crear un riesgo y el nivel se calcula solo, con su color.
- [ ] La matriz de riesgos ubica cada riesgo en la celda correcta.
- [ ] La búsqueda global encuentra por código y por título.
- [ ] La campana de notificaciones muestra los avisos.
- [ ] La bitácora registra los movimientos con usuario y fecha.
- [ ] La consulta de `pg_tables` del paso 3 devuelve cero filas.
- [ ] El trabajo programado responde correctamente con el secreto y
      responde `401` sin él.
- [ ] La aplicación se ve bien en un celular.
- [ ] El modo oscuro funciona.

---

## 13. Mantenimiento

### Respaldos

Supabase respalda a diario en los planes pagos. En el plan gratuito, saque
un respaldo manual cada mes:

```bash
supabase db dump -f respaldo-$(date +%Y-%m-%d).sql
```

### Actualizar el sistema

Cada `git push` a la rama principal dispara un despliegue en Vercel. Si el
cambio incluye migraciones nuevas, hay que aplicarlas **antes** de que el
despliegue quede activo:

```bash
supabase db push
```

### Costo

| Concepto | Costo mensual |
| --- | --- |
| Supabase (plan Free hasta 500 MB; Pro si se supera) | USD 0 a 25 |
| Vercel (plan Hobby o Pro) | USD 0 a 20 |
| Correo por Google Workspace | Ya incluido |
| **Sofidya (se da de baja)** | **−USD 250** |

---

## 14. Problemas frecuentes

**«Dominio de correo no autorizado» al ingresar**
La cuenta no pertenece a `camping44.com.py`. Cierre la sesión de Google en
el navegador y vuelva a entrar con la cuenta corporativa.

**Después de ingresar, la pantalla queda en blanco o vuelve al ingreso**
Las Redirect URLs de Supabase no coinciden con la URL real. Revise el paso
4.3; la URL debe terminar exactamente en `/auth/callback`.

**No llegan los correos**
Verifique que `SMTP_CLAVE` sea la contraseña **de aplicación** de dieciséis
caracteres y no la contraseña normal de la cuenta. Revise el registro de
la función en Vercel: si el SMTP no está configurado, deja el aviso
`[correo] SMTP no configurado`.

**El trabajo programado no se ejecuta**
En Vercel, **Settings → Cron Jobs**, confirme que aparece la tarea. Los
crons no corren en los despliegues de vista previa, solo en producción.

**«row violates row-level security policy»**
El rol de esa persona no la habilita para esa operación. Revísela en
**Administración → Usuarios y roles**. No es un error del sistema: es la
protección funcionando.

**Un usuario no ve un documento**
Los colaboradores solo ven documentos **vigentes**. Los borradores y las
versiones en revisión los ven Calidad, el responsable, el elaborador y los
revisores asignados.
