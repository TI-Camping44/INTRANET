# CLAUDE.md · Convenciones del proyecto

Intranet del Sistema de Gestión de Calidad de **Camping 44 S.A.**
(Asunción, Paraguay). Retail regulado de armas y equipamiento outdoor,
49 usuarios. Reemplaza a Sofidya (USD 250 por mes).

Este archivo fija las convenciones del proyecto para sesiones futuras.
Léalo antes de escribir código.

---

## 1. Idioma

**Todo en español.** Sin excepción y sin mezclar:

- Interfaz, mensajes de error y textos de ayuda.
- Comentarios de código.
- Nombres de tablas, columnas, tipos y funciones de PostgreSQL.
- Nombres de variables, funciones, componentes y archivos.
- Mensajes de commit.

**Registro neutro, sin voseo rioplatense.** Se escribe «use», «ingrese»,
«complete»; nunca «usá», «ingresá», «completá». El sistema lo va a leer
Dirección.

Los términos técnicos del ecosistema se dejan como están cuando no tienen
traducción establecida (`middleware`, `commit`, `bucket`, `hook`).

### Nomenclatura habitual

| Concepto | Se escribe |
| --- | --- |
| Componente de React | `PascalCase` en español: `TarjetaIndicador` |
| Función o variable | `camelCase` en español: `formatearGuaranies` |
| Archivo | `kebab-case` en español: `insignias-estado.tsx` |
| Tabla y columna SQL | `snake_case` sin tildes: `no_conformidades`, `fecha_limite` |
| Tipo enumerado SQL | `snake_case` singular: `estado_documento` |
| Constante exportada | `MAYUSCULAS_CON_GUION`: `DIAS_ESCALAMIENTO_NC` |

> Los identificadores de SQL van **sin tildes ni eñes** para evitar tener
> que entrecomillarlos. El texto que ve el usuario sí las lleva.

---

## 2. Stack y restricciones

- **Next.js 14** con App Router y TypeScript en modo estricto.
- **Tailwind CSS.** Los componentes de interfaz son propios, escritos a
  mano sobre primitivas de Radix, con la nomenclatura en español del
  proyecto. No se agrega la CLI de shadcn.
- **Supabase** para base de datos, autenticación y archivos, mediante
  `@supabase/supabase-js` y `@supabase/ssr`.
- **SQL directo en las migraciones.** No se agregan ORM ni capas extra.
- **npm** como gestor de paquetes.
- Despliegue en **Vercel**.

**No tocar Odoo.** El ERP (Odoo 17 Enterprise) está fuera de alcance. Si
un módulo necesitara datos del ERP, se resuelve más adelante con un
endpoint intermedio de solo lectura.

---

## 3. Marca y formato

| Elemento | Valor |
| --- | --- |
| Rojo institucional | `#E01E37` → `352 76% 50%` |
| Gris tinta | `#14161B` → `223 15% 9%` |
| Tipografía | Inter, mediante `next/font/google` |
| Logotipo | Siglas `C44`, en `src/components/comunes/logotipo.tsx` |

Los colores se declaran como variables CSS en `src/app/globals.css` y se
exponen en Tailwind con nombres en español: `bg-fondo`, `text-texto`,
`bg-primario`, `border-borde`, `text-semaforo-alto`.

**Interfaz sobria y densa en información.** Dirección la mira en pantalla
grande: el dato pesa más que la decoración. Tipografía chica
(`text-xs` en tablas), espaciado ajustado, sin ilustraciones.

**Responsive obligatorio.** Se usa desde el celular en piso de venta y
depósito. Toda tabla va dentro de un contenedor con desplazamiento
horizontal propio; el cuerpo de la página nunca se desplaza en horizontal.

**Modo claro y oscuro** en todas las pantallas, mediante `next-themes`.

### Formatos

Están centralizados en `src/lib/formato.ts`. **No se formatea a mano en
ningún componente.**

| Dato | Formato | Función |
| --- | --- | --- |
| Fecha | `31/08/2026` | `formatearFecha` |
| Fecha y hora | `31/08/2026 14:30` | `formatearFechaHora` |
| Moneda | `Gs. 3.711.850` | `formatearGuaranies` |
| Zona horaria | `America/Asuncion` | `ZONA_HORARIA` |

> Las columnas `date` de PostgreSQL llegan como `"2026-08-31"`. Si se las
> pasa a `new Date()` se interpretan como UTC y en Asunción se muestran un
> día antes. `formato.ts` las ancla al mediodía antes de formatear: use
> siempre esas funciones.

---

## 4. Base de datos

### Migraciones

Van en `supabase/migrations/`, con el nombre
`AAAAMMDDHHMMSS_descripcion_en_espanol.sql`. **Se aplican en orden
alfabético y nunca se editan una vez aplicadas en producción**: los
cambios van en una migración nueva.

Cada archivo abre con un encabezado que explica qué agrega y por qué.

### RLS

**RLS activo en todas las tablas, sin excepción.** Una tabla nueva sin
políticas es un error, no un pendiente.

**Y con su `grant`.** Las políticas no alcanzan: sin
`grant select, insert, update, delete … to authenticated`, PostgreSQL
corta antes de evaluarlas y la pantalla queda vacía sin decir por qué.
Las tablas del SGC lo reciben por el bucle de `..._politicas_rls.sql`;
una tabla o vista nueva fuera de esa lista lo necesita explícito.

Las funciones de apoyo están en `..._funciones_rls.sql`:

```
rol_actual()                    empresa_actual()
es_admin_sgc()                  es_auditor()
es_direccion()                  puede_gestionar()
es_responsable_de_proceso(id)   misma_empresa(id)
```

Todas son `SECURITY DEFINER` con `search_path = public`. Es necesario: sin
eso, consultar `usuarios` dentro de la política de `usuarios` provoca una
recursión infinita.

> **Cuidado con la recursión entre tablas.** Si la política de A consulta B
> y la de B consulta A, PostgreSQL falla. Cuando pase, encapsule la
> condición en una función `SECURITY DEFINER`, como se hizo con
> `puede_ver_documento()` y `puede_gestionar_documento()` para el módulo de
> documentos.

### Trazabilidad

La tabla `bitacora` se alimenta por disparador (`registrar_bitacora()`),
no desde la aplicación. Así ningún camino de escritura puede evadirla:
ni la interfaz, ni un script, ni el panel de Supabase. Es requisito de
auditoría ISO, no es opcional.

Al crear una tabla con valor de auditoría, agregue su disparador en una
migración nueva.

### Columnas convencionales

| Columna | Para qué |
| --- | --- |
| `empresa_id` | Acota el registro a la empresa. Camping 44 y Vitálica comparten el espacio de trabajo de Google; hoy solo opera Camping 44. |
| `es_demostracion` | Marca los registros cargados por el seed. |
| `creado_en` / `actualizado_en` | `actualizado_en` lo mantiene el disparador `marcar_actualizacion()`. |
| `creado_por` | Referencia a `usuarios`. |

---

## 5. Estructura del código

```
src/app/(sgc)/<modulo>/
  page.tsx                 Listado (componente de servidor)
  acciones.ts              Acciones de servidor del módulo
  formulario-<x>.tsx       Formularios (componentes de cliente)
  nuevo/page.tsx           Alta
  [id]/page.tsx            Ficha del registro
  [id]/<panel>.tsx         Paneles interactivos de la ficha
```

> Un archivo `"use server"` **solo puede exportar funciones asíncronas**.
> Las constantes y las reglas sincronas que comparten servidor y cliente
> van en `src/lib/`, como se hizo con `lib/proveedores.ts`.

### Servidor y cliente

- Los **componentes de servidor** consultan datos. Es el modo por defecto.
- Los **componentes de cliente** (`"use client"`) manejan interacción y
  estado. Reciben los datos por propiedades; no consultan Supabase.
- Las **acciones de servidor** (`"use server"`) hacen las escrituras.
  Siempre devuelven `ResultadoAccion`:

```ts
export type ResultadoAccion =
  | { exito: true; mensaje?: string; id?: string }
  | { exito: false; error: string };
```

El mensaje de error es el que ve la persona: escríbalo en español claro y
explicando qué hacer, no el error crudo de PostgreSQL.

### Clientes de Supabase

| Archivo | Cuándo se usa |
| --- | --- |
| `lib/supabase/servidor.ts` | Componentes y acciones de servidor. Opera con la sesión de la persona: **RLS se aplica**. |
| `lib/supabase/navegador.ts` | Componentes de cliente. Solo para autenticación. |
| `lib/supabase/administrador.ts` | **Únicamente** el trabajo programado y el script de importación. Ignora RLS. |

> La clave de servicio **nunca** se usa para atender una petición de la
> interfaz. Si aparece esa necesidad, la solución correcta es una función
> `SECURITY DEFINER` en la base de datos, como `crear_notificacion()`.

### Validación

Se valida en la acción de servidor antes de escribir, y además con
restricciones `CHECK` en la base de datos. La validación del navegador es
comodidad, no control.

### Gráficos

Se dibujan en SVG a mano, sin librería. Reglas que se respetan en todos:

- **Un solo eje.** Nunca dos escalas en el mismo gráfico.
- La **meta es un umbral, no una serie**: va en gris neutro y trazo
  discontinuo, y el color queda reservado para el dato.
- Trazo de 2 px, puntos de 8 px con anillo del color de la superficie.
- Se rotula **solo el último punto**; el resto lo cubren el eje y el
  detalle al señalar.
- Los colores salen de las variables del tema, así el gráfico funciona
  igual en modo claro y oscuro.
- Toda serie dibujada tiene su **tabla de datos** al lado.

### El correo nunca bloquea la interfaz

El envío tiene un tope de espera de 6 segundos dentro de la petición
(`ESPERA_MAXIMA_CORREO` en `lib/notificaciones.ts`) y el transporte usa
tiempos de espera cortos. Si el SMTP no responde, la notificación queda
con `correo_enviado = false` y el trabajo programado la reintenta.

Se llegó a esto por un caso real: una acción de servidor tardó 45 segundos
esperando a un SMTP inalcanzable. **Nada que dependa de un servicio externo
debe demorar la respuesta que ve la persona.**

Aun con el tope, la persona puede esperar hasta seis segundos. Por eso
todo botón que dispara una acción de servidor va con `cargando`, no con
`disabled`: un botón apagado y sin señal de avance se lee como roto.

```tsx
<Boton type="submit" cargando={procesando}>Guardar</Boton>
```

---

## 6. Reglas de negocio a respetar

Están acordadas con Calidad. Si cambian, cambian **en los dos lados**:
en la base de datos y en `src/lib/`.

| Regla | Dónde vive |
| --- | --- |
| Matriz de riesgos 5×5, nivel = P × I | `etiqueta_nivel_riesgo()` en SQL y `lib/riesgos.ts` |
| Semáforo: 1-4 bajo, 5-9 medio, 10-14 alto, 15-25 crítico | Los mismos dos lugares |
| Reevaluación: crítico 30 días, alto 90, medio 180, bajo anual | `dias_reevaluacion_riesgo()` y `lib/riesgos.ts` |
| Escalamiento de acciones: 10 días al jefe, 20 al nivel siguiente | `lib/constantes.ts` y `api/cron/alertas` |
| Aviso de revisión de documentos: 30 días antes | `DIAS_AVISO_REVISION_DOCUMENTO` |
| Versionado: v00 inicial, sube en cada aprobación | `sincronizar_documento_al_aprobar()` |
| Código de documento: `MP-SOP-XX`, `F-XXX-XX-XX` | `CHECK` en `documentos` y `sugerirCodigoDocumento()` |
| Adjuntos: 20 MB máximo | `CHECK` en `adjuntos`, bucket y `TAMANO_MAXIMO_ADJUNTO` |
| Hallazgo de NC genera no conformidad; sin eso la auditoría no cierra | `generar_no_conformidad_desde_hallazgo()` y `cambiarEstadoAuditoria()` |
| Evaluación de proveedores: 5 criterios de 1 a 5, nota 0-100; 80+ aprobado, 60-79 condicional | `puntaje` generado en SQL y `lib/proveedores.ts` |
| Ejecutar un mantenimiento reagenda el siguiente según la frecuencia del activo | `sincronizar_activo_al_mantener()` |
| Competencias: escala 1 a 5; la brecha es exigido menos alcanzado | `brecha` generada en SQL y `NIVELES_COMPETENCIA` |
| El nivel exigido sale de la matriz del puesto de la persona, no se escribe a mano | `evaluarCompetencia()` |
| Solo el jefe inmediato o Calidad evalúan a una persona | `evaluarCompetencia()` |
| La eficacia de una capacitación se verifica por persona, no por curso | `verificarEficacia()` y `capacitacion_participantes.eficacia` |
| NPS = % promotores (9-10) menos % detractores (0-6); los pasivos cuentan en el denominador | `resumirNps()` y `categoria_nps` generada en SQL |
| Solo un detractor con comentario genera no conformidad, de origen `reclamo_cliente` | `generar_no_conformidad_desde_respuesta()` |
| Un mes con menos de 5 respuestas no se grafica: el índice deja de significar algo | `RESPUESTAS_MINIMAS_NPS` |
| Solo puede haber una publicación fijada a la vez | `fijarPublicacion()` |
| Plazo por defecto para cerrar una NC recién abierta: 30 días | `DIAS_LIMITE_CIERRE_NC` y las funciones que generan NC |

### Decisiones tomadas por defecto

Quedaron así por falta de definición explícita. Son reversibles:

- **Sin acuse de lectura** de documentos: la difusión notifica, pero no
  exige confirmación.
- **Flujo documental**: un elaborador, uno o más revisores, un aprobador.
- **Alta de usuarios**: el perfil se crea en el primer ingreso con rol
  Colaborador; el Administrador SGC ajusta rol y jefe inmediato.
- **Adjuntos**: 20 MB, PDF, Office e imágenes.
- **Logotipo**: tipográfico en SVG, a la espera del oficial en vectores.

---

## 7. Seguridad

- **Ninguna credencial en el repositorio.** Todo por `.env.local`, con
  `.env.example` documentado.
- **Dominio validado en tres capas**: parámetro `hd` en Google, servidor
  (middleware y retorno de autenticación) y disparador en la base de
  datos. Las tres son necesarias; ninguna sola alcanza.
- **Los permisos se resuelven en RLS**, no en la interfaz. Ocultar un
  botón no es un control de acceso.
- Los archivos del bucket son privados y se entregan con enlaces firmados
  de duración corta.

---

## 8. Forma de trabajo

- **Commits chicos y descriptivos, en español.** Primera línea en
  imperativo, sin punto final; luego un cuerpo que explique el porqué.
- **Al modificar un archivo existente, se entrega el archivo completo**,
  no un parche parcial.
- **No inventar requerimientos.** Si falta información para decidir algo,
  se pregunta antes de asumir.
- **Sin preámbulos largos** en las respuestas: qué se hizo, qué falta, qué
  se necesita del interlocutor.

### Antes de dar algo por terminado

```bash
npm run tipos     # TypeScript sin errores
npm run lint      # ESLint sin errores
npm run build     # Compila
```

Para cambios en el esquema, aplique las migraciones contra una base real
antes de subirlas. No alcanza con que el SQL «se vea bien».

---

## 9. Estado del proyecto

El sistema tiene dos capas.

**Intranet** (la portada, pedida por Dirección): publicaciones internas
—anuncios, novedades de producto, logros, reconocimientos, bienvenidas y
eventos, todos la misma tabla con distinto `tipo`—, cumpleaños y
aniversarios calculados del legajo, y directorio con organigrama.

**Calidad · SGC**, con sus nueve módulos operativos: Control de
información documentada · No conformidades y acciones correctivas ·
Riesgos y oportunidades · Auditorías internas · Indicadores y objetivos ·
Satisfacción del cliente · Recursos humanos · Proveedores ·
Infraestructura y activos.

> La raíz lleva a `/inicio`, no al panel de calidad: el SGC es una
> sección de la intranet, no la portada.

### Lo que falta para poner el sistema en producción

No es trabajo de pantallas, es de puesta en marcha:

1. **Credenciales**: proyecto de Supabase, cliente de OAuth de Google,
   contraseña de aplicación del SMTP de Workspace, proyecto en Vercel.
2. **Ingesta del panel de NPS** (Apps Script y GitHub Pages), que **no se
   reemplaza**: escribe en `encuesta_respuestas` usando `fuente_externa`
   y `referencia_externa`, que es lo que evita duplicar respuestas.
3. **Datos reales en lugar del seed**: mapa de procesos, procedimientos
   vigentes, histórico de no conformidades y matriz de riesgos.
4. **Importación desde Sofidya** con `scripts/migrar-sofidya.ts` y la
   `SecretKey` en variable de entorno.
