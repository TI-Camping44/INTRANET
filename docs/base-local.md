# Una copia de la base en su máquina, sin Supabase ni Docker

Para probar contra datos parecidos a los reales sin tocar producción, y
para sacar capturas del sistema sin exponer el legajo de nadie.

Levanta PostgreSQL con **las 111 migraciones y el seed de
demostración**, y lo publica por PostgREST con las políticas RLS
activas. No hace falta Docker ni la CLI de Supabase.

> Lo que **no** resuelve: el ingreso. La aplicación entra con Google y
> eso no se puede imitar de este lado. Ver «Lo que falta» al final.

---

## Lo que hace falta

```bash
apt-get install -y postgresql-16          # trae unaccent, pg_trgm y pgcrypto
curl -L -o postgrest.tar.xz \
  https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz
tar -xJf postgrest.tar.xz
```

## Los cuatro pasos

```bash
# 1 · el servidor
initdb -D ./pgdata -U postgres --encoding=UTF8 --locale=C.UTF-8
pg_ctl -D ./pgdata -o '-p 5433' start
psql "postgresql://postgres@localhost:5433/postgres" -c "create database intranet"

# 2 · el andamio: lo que Supabase pone de fábrica y PostgreSQL no
psql "postgresql://postgres@localhost:5433/intranet" -f docs/base-local/01-andamio.sql

# 3 · poner el seed al día y cargar todo
python3 docs/base-local/02-poner-al-dia-el-seed.py
python3 docs/base-local/03-cargar.py

# 4 · publicarlo
./postgrest docs/base-local/postgrest.conf
```

Al terminar: 57 tablas, 129 políticas RLS y 38 tablas con datos.

Se comprueba que RLS está viva pidiendo lo mismo con credencial y sin
ella:

```bash
curl -H "Authorization: Bearer $JWT" "localhost:3001/documentos?select=codigo"
# [{"codigo":"MP-SOP-01"}, …]

curl "localhost:3001/documentos?select=codigo"
# {"code":"42501","message":"permission denied for table documentos"}
```

---

## El andamio

`01-andamio.sql` crea lo que las migraciones dan por sentado porque en
Supabase viene puesto:

| Qué | Para qué |
| --- | --- |
| Roles `anon`, `authenticated`, `service_role`, `authenticator` | Los `grant` de las migraciones nombran `authenticated` |
| `auth.uid()`, `auth.role()`, `auth.email()` | Las usan 93 políticas. Leen el reclamo del JWT, igual que en Supabase |
| `auth.users`, `auth.sessions`, `auth.audit_log_entries` | `usuarios.id` es clave foránea de `auth.users`, y el disparador de ingresos mira `auth.sessions` |
| `storage.buckets`, `storage.objects` | Los adjuntos |

Son tablas mínimas: **las columnas que el proyecto toca y nada más**. No
es Supabase, es lo justo para que las migraciones encuentren lo que
esperan.

## Las dos diferencias con producción

Las dos son por la versión de PostgreSQL, no por el proyecto:

1. **`alter column … set expression` es del 17** y Supabase corre 17.
   Las dos migraciones que la usan se traducen, al cargar, a soltar y
   recrear la columna generada. **Las migraciones del repositorio no se
   tocan**: la traducción vive en `03-cargar.py`.
2. **Las empresas se cargan apenas existe la tabla.** Dos migraciones
   insertan filas que cuelgan de `empresas`, que en producción ya tenía
   datos porque el seed había corrido antes.

Si alguna vez se puede instalar PostgreSQL 17, la primera desaparece.

---

## El seed del repositorio quedó desactualizado

**`supabase/seed.sql` ya no aplica contra el esquema de hoy.** Se
escribió en agosto y desde entonces seis cosas cambiaron. No rompe nada
en producción —el seed está retirado— pero cualquiera que intente
levantar un entorno de prueba se va a estrellar.

`02-poner-al-dia-el-seed.py` escribe una copia corregida y **no toca el
original**. Lo que corrige:

| En el seed | Hoy |
| --- | --- |
| `riesgos.impacto` | `riesgos.severidad` |
| `riesgos.impacto_residual` | `riesgos.severidad_residual` |
| `riesgo_evaluaciones.impacto` | `riesgo_evaluaciones.severidad` |
| Objetivo en estado `en_curso` | `en_medicion`. Ojo: `en_curso` **sigue siendo válido** para acciones y mantenimientos, así que el cambio va acotado al `insert` de objetivos |
| La oportunidad valorada con probabilidad por severidad | Beneficio por factibilidad, y `riesgos_valoracion_segun_tipo` lo exige |
| Filas propias en `documento_versiones` y `documento_revisores` | Hoy las crea el disparador al aprobar, así que chocan |

Arreglar `seed.sql` en el repositorio es una decisión aparte: hoy no lo
usa nadie.

---

## Lo que falta: el ingreso

`pasarela.js` publica en el puerto 8000 las rutas que la aplicación
espera de Supabase —`/rest/v1` contra PostgREST, `/auth/v1/user` con la
persona de demostración—. Con eso **las consultas andan**.

Lo que no anda es la sesión. La aplicación resuelve quién entró con
`supabase.auth.getUser()`, que sin cookie de sesión devuelve nulo sin
salir a la red, y el middleware manda a `/ingresar`. Para que las
pantallas se dibujen hay que **fabricar una sesión de ingreso**, y eso
—aunque sea contra una base local y descartable— es sintetizar una
credencial de autenticación.

Queda escrito acá y sin hacer, a propósito.
