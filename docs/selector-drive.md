# Selector de archivos de Google Drive

Cómo habilitar el botón **«Desde Drive»** de la ficha de un documento.

Mientras no esté configurado, ese botón simplemente no aparece y la
subida desde la computadora funciona igual. No hay nada roto que arreglar
si se decide dejarlo para más adelante.

---

## Qué hace

En la ficha de cualquier documento, la tarjeta **Archivos** ofrece dos
botones:

| Botón | Qué abre |
| --- | --- |
| **Desde Drive** | El Drive de quien está usando la intranet: Mi unidad, las unidades compartidas, y una pestaña «Subir» de la propia ventana de Google. |
| **Desde la computadora** | El explorador de archivos de siempre. |

Los dos terminan en el mismo lugar. El archivo se guarda en la intranet
con las mismas validaciones: la regla de formato según el tipo de
documento, el tope de 20 MB y el registro en la bitácora.

**El archivo se copia, no se enlaza.** Es a propósito: un enlace apunta a
un archivo vivo, y si alguien lo edita, lo mueve o lo borra, el documento
aprobado del SGC cambia o desaparece sin que el sistema se entere. La
copia es lo que hace que la versión aprobada sea la que rige.

**Los Documentos y las Hojas de cálculo de Google se convierten al
elegirlos.** No son archivos: no tienen contenido descargable hasta que
se los exporta. La conversión sigue la misma regla que todo lo demás —a
PDF si el tipo de documento exige PDF, a Word o Excel si admite formato
editable—, así que no hay forma de meter por esta puerta algo que la otra
rechazaría.

---

## Qué permisos pide, y a quién

El permiso **no** se pide al ingresar a la intranet. Se le pide a la
persona que aprieta «Desde Drive», en el momento de apretarlo. Quien
nunca use el botón nunca ve un pedido de permiso.

El alcance es `drive.file`, que es el más acotado que ofrece Google: da
acceso **únicamente a los archivos que la persona elige a mano** en el
selector. La intranet no puede ver el resto de su Drive ni listarlo.

El token que devuelve Google vive en la memoria del navegador, dura una
hora y **nunca llega al servidor de la intranet**: el archivo lo descarga
el propio navegador y lo entrega ya bajado.

---

## Paso a paso en Google Cloud

Todo se hace en el mismo proyecto donde ya está el cliente de OAuth que
usa el ingreso con Google. No hace falta crear un proyecto nuevo.

### 1 · Habilitar la Picker API

1. Entre a <https://console.cloud.google.com/> con la cuenta de
   administración y **elija el proyecto** en el selector de arriba.
2. Menú → **APIs y servicios** → **Biblioteca**.
3. Busque **Google Picker API**.
4. **Habilitar**.

> Si además aparece «Google Drive API» sin habilitar, habilítela también.
> La exportación de Documentos y Hojas de cálculo la usa.

### 2 · Autorizar la dirección de la intranet en el cliente de OAuth

1. **APIs y servicios** → **Credenciales**.
2. En «ID de cliente de OAuth 2.0», abra el cliente que ya usa la
   intranet (es de tipo *Aplicación web*).
3. En **Orígenes de JavaScript autorizados**, agregue la dirección de la
   intranet, sin barra final:

   ```
   https://intranet-sgc-camping44.vercel.app
   ```

   Si más adelante la intranet tiene dominio propio, agregue también ese.
4. **Guardar**. Copie el **ID de cliente** (termina en
   `.apps.googleusercontent.com`): es el valor de
   `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

> El **secreto** del cliente no se usa acá y no va al repositorio ni a
> ninguna variable con prefijo `NEXT_PUBLIC_`.

### 3 · Crear la clave de API del navegador

1. **APIs y servicios** → **Credenciales** → **Crear credenciales** →
   **Clave de API**.
2. Cuando aparezca la clave, **Editar clave**.
3. Póngale un nombre reconocible: `Intranet SGC · Picker`.
4. En **Restricciones de aplicación**, elija **Sitios web** y agregue:

   ```
   https://intranet-sgc-camping44.vercel.app/*
   ```

5. En **Restricciones de API**, elija **Restringir clave** y marque
   únicamente **Google Picker API**.
6. **Guardar**. Esa clave es el valor de `NEXT_PUBLIC_GOOGLE_API_KEY`.

> Las dos restricciones importan. Una clave de API sin restringir la
> puede usar cualquiera que la lea del código del navegador, y esta viaja
> al navegador por diseño.

### 4 · Cargar las variables en Vercel

Proyecto **intranet-sgc-camping44** → **Settings** → **Environment
Variables** → **Add**:

| Nombre | Valor | Entornos |
| --- | --- | --- |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | el ID del paso 2 | Production y Preview |
| `NEXT_PUBLIC_GOOGLE_API_KEY` | la clave del paso 3 | Production y Preview |

**No marque «Sensitive».** Las variables `NEXT_PUBLIC_` se incrustan en
el código al compilar, así que tienen que estar disponibles durante la
compilación.

### 5 · Volver a desplegar

Vercel congela las variables en el momento de compilar: agregarlas no
alcanza. **Deployments** → en el último, menú **⋯** → **Redeploy**.

### 6 · Probar

1. Entre a cualquier documento en **Documentación**.
2. En la tarjeta **Archivos** tiene que aparecer el botón **Desde Drive**.
   Si no aparece, las variables no llegaron a la compilación: revise el
   paso 5.
3. Apriételo. La primera vez Google va a pedir autorización — una sola
   vez por persona.
4. Elija un archivo y confirme que queda listado en la tarjeta y que se
   puede volver a abrir.

---

## Si algo falla

| Síntoma | Causa más probable |
| --- | --- |
| El botón no aparece | Las variables no estaban al compilar. Redesplegar. |
| «No se pudo cargar el selector de Google» | La Picker API no está habilitada (paso 1). |
| La ventana se abre vacía o en blanco | La clave de API no tiene habilitada la Picker API, o el sitio no está en sus restricciones (paso 3). |
| «Hace falta autorizar el acceso…» | La persona cerró el pedido de permiso. Vuelva a intentar. |
| Error 403 al elegir un archivo | La dirección de la intranet no está en los orígenes autorizados del cliente de OAuth (paso 2). |
| «Ese archivo de Google no se puede convertir…» | Se eligió una Presentación para un tipo de documento que solo admite PDF o formato editable de texto. Exportarla a mano y subirla desde la computadora. |
