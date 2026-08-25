# Publicar la demostración

Guía corta para dejar el sistema andando en internet, con los datos de
demostración, para que Calidad y Dirección lo naveguen desde su propia
computadora.

**Toma unos 40 minutos** y no cuesta nada: Supabase y Vercel tienen plan
gratuito de sobra para esto.

> Esta guía cubre **solo la demostración**. Para producción —correo,
> alertas programadas, Looker Studio, importación desde Sofidya— siga
> `docs/despliegue.md`, que es la versión completa.

---

## Lo que hay que crear

| Servicio | Para qué | Costo |
| --- | --- | --- |
| Supabase | Base de datos, autenticación y archivos | Gratuito |
| Google Cloud | El cliente de OAuth para entrar con la cuenta de Camping 44 | Gratuito |
| Vercel | Donde vive la aplicación | Gratuito |

Conviene crear las tres **con una cuenta de `@camping44.com.py`**, no con
una personal: el día que la persona que las creó no esté, la empresa
sigue siendo dueña de los proyectos.

---

## 1 · Supabase (15 minutos)

1. Entre a <https://supabase.com> → **Start your project**. Elija
   **Continue with GitHub** o cree la cuenta con el correo de la empresa.
2. **New project**:
   - **Name**: `intranet-sgc-camping44`
   - **Database password**: generar una larga y guardarla en el gestor de
     contraseñas de la empresa. **No se puede recuperar después.**
   - **Region**: `South America (São Paulo)` — la más cercana a Asunción.
3. Espere los dos minutos que tarda en aprovisionarse.

### Cargar el esquema y los datos

1. **SQL Editor → New query**.
2. Pegue el contenido completo de `supabase/instalacion-completa.sql`
   (son 4.500 líneas; péguelo entero de una vez) y presione **Run**.
3. Al terminar debe aparecer:
   `Datos de demostración cargados: 9 documentos, 6 no conformidades…`

### Comprobar que quedó bien

En el mismo editor, ejecute esto. **Debe devolver cero filas.** Si
aparece alguna, hay una tabla sin protección y no se sigue adelante:

```sql
select tablename from pg_tables
 where schemaname = 'public' and not rowsecurity;
```

### Anotar las tres claves

**Project Settings → API**:

| En Supabase | Se llama | Dónde va |
| --- | --- | --- |
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` | Vercel |
| `anon` `public` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel |
| `service_role` `secret` | `SUPABASE_SERVICE_ROLE_KEY` | Vercel |

> La clave `service_role` **ignora todas las políticas de seguridad**:
> quien la tiene lee y escribe cualquier registro de cualquier empresa.
> No se manda por correo ni por chat, no se pega en un documento
> compartido, y nunca en una variable que empiece con `NEXT_PUBLIC_`.

---

## 2 · Ingreso con Google (15 minutos)

El sistema solo deja entrar a cuentas `@camping44.com.py`. Eso se valida
en tres capas y la primera se configura acá.

1. Entre a <https://console.cloud.google.com> con la cuenta de
   administrador de Workspace.
2. Cree un proyecto: `intranet-sgc-camping44`.
3. **APIs y servicios → Pantalla de consentimiento de OAuth**:
   - Tipo de usuario: **Interno**. Es lo que impide que alguien de afuera
     del dominio siquiera intente entrar.
   - Nombre de la aplicación: `Intranet SGC`.
4. **Credenciales → Crear credenciales → ID de cliente de OAuth**:
   - Tipo: **Aplicación web**.
   - **URI de redirección autorizado**:
     `https://<referencia>.supabase.co/auth/v1/callback`

     La `<referencia>` es la parte del medio de la URL del panel de
     Supabase: `https://supabase.com/dashboard/project/<referencia>`.
5. Copie el **ID de cliente** y el **Secreto**.

### Cargarlos en Supabase

**Authentication → Providers → Google**:

- Actíve el proveedor.
- Pegue **Client ID** y **Client Secret**.
- En **Additional Scopes** no hace falta nada.

Y en **Authentication → URL Configuration**:

- **Site URL**: la URL de Vercel del paso 3 (se puede volver a editar).
- **Redirect URLs**: agregue `https://<su-dominio-de-vercel>/auth/callback`.

---

## 3 · Vercel (10 minutos)

1. Entre a <https://vercel.com> → **Continue with GitHub**.
2. **Add New… → Project** → importe `TI-Camping44/INTRANET`.
3. **Importante**: en **Settings → Git → Production Branch**, ponga
   `claude/camping44-sgc-intranet-plan-fas5xo`. Vercel por defecto
   publica `main`, y el sistema todavía no está ahí.
4. En **Environment Variables**, cargue:

   ```
   NEXT_PUBLIC_SUPABASE_URL        https://<referencia>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY   <clave anon>
   SUPABASE_SERVICE_ROLE_KEY       <clave service_role>
   NEXT_PUBLIC_SITIO_URL           https://<su-proyecto>.vercel.app
   CRON_SECRET                     <cadena larga y aleatoria>
   ```

   Las de correo (`SMTP_*`) se pueden dejar vacías para la demostración:
   el sistema guarda la notificación igual y la muestra en la campana; lo
   único que no pasa es el envío del correo.

5. **Deploy**. Tarda unos tres minutos.
6. Vuelva a Supabase → **Authentication → URL Configuration** y ponga la
   URL definitiva de Vercel en **Site URL** y en **Redirect URLs**.

---

## 4 · Primer ingreso

1. Entre a `https://<su-proyecto>.vercel.app` con su cuenta
   `@camping44.com.py`.
2. El perfil se crea solo, con rol **Colaborador**.
3. Para darse el rol de Administrador SGC, en el **SQL Editor** de
   Supabase:

   ```sql
   update public.usuarios
      set rol = 'administrador_sgc'
    where correo = 'facundocolman@camping44.com.py';
   ```

4. Recargue la página. Ya ve todo y puede asignar los roles del resto
   desde **Usuarios y roles**.

### Qué darle a Calidad

Que entre con su cuenta de Camping 44 y avise; usted le asigna el rol
desde la pantalla de **Usuarios y roles**. Para que vea todo sin poder
romper nada, el rol **Auditor** es de solo lectura sobre todos los
módulos. Para que además cargue y apruebe, **Administrador SGC**.

---

## Antes de mostrarlo

- [ ] La consulta de tablas sin RLS devuelve cero filas.
- [ ] Entra con Google y **no** entra con una cuenta de otro dominio.
- [ ] En **Storage** figura el bucket `adjuntos-sgc` como **privado**.
- [ ] Los nueve módulos del menú abren sin error.
- [ ] Se ve bien en el celular.

---

## Cuando pasen los datos reales

Los registros de demostración están marcados con `es_demostracion = true`
y se borran todos juntos. El SQL está en el README, sección **Datos de
demostración**. Conviene hacerlo recién cuando estén cargados los datos
verdaderos, no antes.
