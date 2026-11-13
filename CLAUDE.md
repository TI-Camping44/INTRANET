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
| Logotipo | **Va el oficial en todas partes.** `logotipo-oficial.tsx` muestra los **dos** —Camping 44 y Vitálica, `public/logotipo-camping44.png` y `logotipo-vitalica.png`— en el ingreso y en completar el perfil: el grupo son dos empresas y por la intranet entran las dos. En la barra va el de Camping 44 a 32 px, por `Marca` de `logotipo.tsx`. **El «C44» tipográfico salió de la barra el 12 de octubre**: se había puesto porque en chico se lee mejor, pero lo inventó el proyecto y no es el logotipo de la empresa. Queda como `Logotipo` y solo se usa si el archivo no carga. El **ícono del navegador** —`src/app/icon.png`— es el logotipo con la flor de Vitálica en una esquina; antes no había ninguno. **Recuadro blanco solo en modo oscuro**: el logotipo tiene las dos armas en negro y desaparecerían |

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
| `empresa_id` | Acota el registro a la empresa: es el predicado de `misma_empresa()`. **Nunca lleva «de qué empresa del grupo habla el registro»**; para eso va una columna aparte, como `no_conformidades.empresa_afectada_id` o `puestos.empresa_del_puesto_id`. |
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
| **Semáforo: 1-3 bajo, 4-9 moderado, 10-14 alto, 15-25 crítico.** Es la tabla que pasó Calidad el 10 de octubre. **El 9 pasó de alto a moderado**, y no es un retoque de etiquetas: antes «alto» arrancaba en 9 y `requiere_accion` en 10, así que un riesgo de nivel 9 se mostraba alto y al lado decía que no requería acciones. Ahora el corte del semáforo y el de la exigencia de tratamiento son el mismo número, que es lo único que se puede explicar en una auditoría. El valor del enumerado sigue siendo `medio`; la etiqueta que se lee es «Moderado» | `etiqueta_nivel_riesgo()` en SQL y `etiquetaNivelRiesgo()` |
| **La valoración muestra qué exige, no solo el nivel.** Al elegir la probabilidad y la severidad el panel dice el puntaje, el nivel, si requiere acciones, **la acción requerida y los plazos y el seguimiento**, con las palabras de la tabla de Calidad. Quien clasifica tiene que ver la consecuencia de clasificar, igual que en la gravedad del reclamo | `ACCION_POR_NIVEL` y `PLAZOS_POR_NIVEL` |
| **Solo el riesgo alto o crítico exige acción de tratamiento.** El moderado y el bajo se aceptan sin acción inmediata y se reevalúan en cada Revisión por la Dirección. Antes el corte estaba en 5 | `requiereAcciones()` y la columna generada `riesgos.requiere_accion`, las dos en `>= 10` |
| **El riesgo se identifica contra Información Documentada, no contra una lista de procesos**, y admite uno o varios: no siempre es un proceso, puede ser una política o un instructivo. Y admite **acciones ilimitadas**, cada una con acción, responsable y plazo | `riesgo_documentos`, `riesgo_accion_documentos` y `selector-documentos.tsx` |
| **La oportunidad usa el mismo modelo que el riesgo, y la misma tabla.** Vive en `riesgos` con `tipo = 'oportunidad'`, así que comparte `riesgo_documentos`, `riesgo_acciones` y `riesgo_accion_documentos`: se identifica contra Información Documentada y admite acciones ilimitadas, que se exigen cuando se decide abordarla —el equivalente del riesgo alto o crítico—. Lo único que no se comparte es la valoración: Beneficio × Factibilidad, nunca P × I | `formulario-oportunidad.tsx` y `revisarCamposDeOportunidad()` |
| **Las dos tablas, la de riesgos y la de oportunidades, muestran lo mismo**: sin Proceso, sin Acción planificada, sin Proceso de la acción, sin Estado y sin **Responsable** —que salió de las dos el 10 de octubre, junto con **Disrupción** en riesgos—, y el pie dice solo cuántos hay en el listado, y sin los gráficos de barras: en riesgos quedan **solo las dos tortas**, por nivel y por estado —«Por proceso», «Por origen» y «Por opción de tratamiento» salieron, porque decían en porcentaje lo que la tabla ya muestra en su columna—. Si se agrega una columna a una, va en la otra. De riesgos salieron además **Opción de tratamiento** y **¿Acción eficaz?** —la eficacia se ve por acción en la ficha—, y el **Plazo** sale del más lejano de `riesgo_acciones`, no de `riesgos.plazo_accion`, que quedó sin usar cuando las acciones pasaron a ser ilimitadas | `riesgos/page.tsx` y `oportunidades/page.tsx` |
| Reevaluación: crítico 30 días, alto 90, medio 180, bajo anual | `dias_reevaluacion_riesgo()` y `lib/riesgos.ts` |
| Escalamiento de acciones: 10 días al líder inmediato, 20 al nivel siguiente | `lib/constantes.ts` y `api/cron/alertas` |
| Aviso de revisión de documentos: 30 días antes | `DIAS_AVISO_REVISION_DOCUMENTO` |
| Versionado: Ver.00 inicial, sube en cada aprobación. Se escribe **`Ver.00`**, no `v00` | `sincronizar_documento_al_aprobar()` |
| **Un documento que deja de regir se declara obsoleto, y la revisión nueva se carga desde cero.** «Actualizar a la siguiente versión» salió de la ficha el 10 de octubre: pedía la cabecera entera en un diálogo de catorce controles —cada campo con su «Se mantiene igual / Cambiar»— y abría un segundo camino para lo mismo. Hoy «Marcar obsoleto» es un paso solo: el documento sale de Todos, Vigentes y las tres pestañas del circuito, y pasa a Obsoletos con su historial. `actualizarALaSiguienteVersion()` queda escrita en `acciones.ts` y hoy no la llama nada, como `hoja.ts` y `campo-propuestas.tsx` | `marcarObsoleto()` y `acciones-documento.tsx` |
| **La versión se escribe, no se calcula, y se muestra tal cual.** Va al lado del código en el alta y en la edición, con su propio «No aplica» debajo: es el otro dato que se copia del documento original, no uno que el sistema decida. Es **texto**, no un entero, por la misma razón por la que el código es libre —la codificación real de Calidad no es necesariamente `00`, `01`—. **El listado y la ficha la escriben como se cargó, sin anteponerle «Ver.»**: si alguien escribió `100`, dice `100`. Vive en `documentos.version_documento`; **no se toca `version_actual`**, que cuenta cuántas veces el documento pasó por el circuito de validación y aprobación y es otra pregunta. La ficha muestra la declarada cuando la hay, y si no la calculada: las dos a la vez harían que la pantalla se contradiga | `leerVersionDeclarada()` y `formulario-documento.tsx` |
| **La categoría es una fila, no el texto de sus documentos.** Vivía solo en `documentos.categoria`, así que una carpeta sin documentos no existía en ningún lado: se creaba, la pantalla se recargaba y no estaba. Ahora la lista sale de `documento_categorias` y la columna sigue diciendo en cuál está cada documento. Las carpetas vacías se dibujan igual, con «Sin documentos todavía», y con carpetas creadas y ningún documento la pantalla ya no muestra el estado vacío. Se comparan **sin tildes ni mayúsculas** para no terminar con «Políticas» y «politicas»; el índice único solo cubre las mayúsculas, porque `unaccent` no es `IMMUTABLE` y PostgreSQL no la acepta en una expresión de índice, así que la comparación sin tildes la hace `guardarCategoria()` | `documento_categorias` y `sinTildes()` |
| **El circuito documental es lineal y de dos personas**: sin validación no hay aprobación, y quien valida no aprueba. Vale también para el Administrador SGC: su atajo sirve para destrabar un documento cuyo validador no está, no para firmar los dos pasos | `enviarAValidacion()`, `validarDocumento()` y `aprobarYPublicar()` |
| **El código del documento es libre**, se escribe conforme al documento original. El formato impuesto salió el 8 de octubre: la codificación real de Calidad no lo seguía. Los de contexto y las políticas siguen pudiendo ir sin código | `LARGO_MAXIMO_CODIGO` en `documentos/acciones.ts` y `sugerirCodigoDocumento()` |
| **Un documento cuelga del proceso que declaró**, no del que diga su código: `proceso_documento_id` apunta al manual de proceso y manda sobre `claveDeProceso()`. Hizo falta porque la Política de Garantía depende de Servicio Técnico y va sin código | `armarJerarquia()` en `lib/documentos.ts` |
| Perfil de puesto: formulario `R-02-01`, con revisión | Columnas de `puestos` y `datos-reales/20-perfiles-de-puesto.sql` |
| **El Perfil de Resultados de Puesto lo suben Calidad y Capital Humano, y se mira el PROCESO de la persona, no su rol.** Jorge Pineda, Jefe de Capital Humano, no podía subirlo, y el motivo era el error inverso al habitual: la acción admitía `puedeGestionar()` —Calidad y los cuatro Jefes de área— y la pantalla dibujaba el formulario solo con `esAdministrador()`, así que **había un permiso concedido que ningún botón dejaba usar**. Habilitarlo por rol tampoco servía: `responsable_proceso` lo comparten los cuatro jefes, y el R-02-01 lo custodia Capital Humano para **toda la empresa**, no Logística ni Comercial. Por eso cuelga de `usuarios.proceso_id`, comparado **por código y no por id** contra `CODIGO_PROCESO_CAPITAL_HUMANO`, que es el de la versión 01 del mapa —la ficha de la persona solo ofrece esa versión—. **CORREGIDO EL 4 DE NOVIEMBRE**: esto miraba `usuarios.proceso_id`, que **ninguna política consulta**, así que asignar el proceso desde la ficha no arrastraba ningún permiso —al contrario de lo que decía este archivo—. Hoy mira `procesos.responsable_id`, que es lo que lee `es_responsable_de_proceso()`, y **ahí sí arrastra**: siete políticas, así que quien responde un proceso gana además editar los documentos, las no conformidades, los riesgos, los cambios, las acciones de NC y las mediciones de indicadores **de ese proceso**. Es deliberado, pero no es solo «puede subir el PRP». Y **la pregunta es si Capital Humano está entre los que responde**, no si es el único. **El puesto en sí no se tocó**: crearlo, editarlo, eliminarlo y asignarle personas siguen siendo solo de Calidad. Y **borrar el archivo no lleva control de rol a propósito**: lo resuelve `adjuntos_baja`, que deja borrar solo lo que uno subió, o cualquiera al Administrador SGC | `puedeSubirPerfilDePuesto()` y `CODIGO_PROCESO_CAPITAL_HUMANO` |
| Adjuntos: 20 MB máximo | `CHECK` en `adjuntos`, bucket y `TAMANO_MAXIMO_ADJUNTO` |
| Hallazgo de NC genera no conformidad; sin eso la auditoría no cierra | `generar_no_conformidad_desde_hallazgo()` y `cambiarEstadoAuditoria()` |
| **El listado de auditorías muestra inicio y fin, en dos columnas, y cae a lo planificado.** Había una sola columna «Fecha» que mostraba el inicio, así que el cierre —lo que dice si la auditoría se hizo dentro de la ventana que se planificó— no estaba en ninguna parte del listado. Cada columna muestra la fecha real y, cuando todavía no se cargó, **la planificada diciendo que lo es**: una fecha de plan puesta como si fuera un hecho es lo último que conviene en una auditoría  **El respaldo son los dos campos del alta** —«Planificada: inicio», obligatorio, y «Planificada: fin», opcional— que es lo que confirmó Carlos: «esto es lo que debe estirar». Con «Planificada: fin» vacía la columna Fin queda en «—», que es correcto: una auditoría de un día no tiene último día previsto. **Y las dos tarjetas de hallazgos de arriba salieron con la columna**: «Hallazgos registrados» y «NC por generar» quedaban en cero para siempre, así que la grilla pasó de cuatro a dos| `auditorias/page.tsx` y `fecha_planificada_fin` |
| **La auditoría declara su alcance por documento, no por proceso.** «Procesos auditados» salió del alta el 6 de octubre: Calidad definió que son lo mismo y que el alcance se declara contra la información documentada. `auditoria_procesos` queda para las auditorías cargadas antes | `auditoria_documentos` y `formulario-auditoria.tsx` |
| **La NC se registra en su propio módulo, no en la auditoría.** «Registrar hallazgo» abre `/no-conformidades/nueva?auditoria=<id>`, con el origen y el proceso ya puestos. Decisión de Dirección del 6 de octubre, tomada sabiendo que la auditoría deja de tener hallazgos propios y que no queda dónde anotar una observación, una oportunidad de mejora ni una fortaleza  **Y el 3 de noviembre salieron los dos restos que quedaban**, a pedido de Carlos: la tarjeta «Hallazgos» de la ficha y la columna «Hallazgos» del listado. Las dos mostraban cero y no podían mostrar otra cosa —no había **un solo** hallazgo cargado en todo el sistema, se verificó antes de sacarlas—. **Lo que NO salió es el botón**: «Registrar no conformidad» subió al encabezado de la ficha y sigue abriendo `/no-conformidades/nueva?auditoria=<id>` con el origen y el proceso puestos; sacarlo con la tarjeta habría obligado a cargar los dos a mano. `panel-hallazgos.tsx` queda sin usar, como `hoja.ts` y `campo-propuestas.tsx`| `panel-hallazgos.tsx` y `no-conformidades/nueva/page.tsx` |
| Evaluación del Asociado de Negocio: los 4 criterios del F-SOP-08-01 —calidad, logística, legal, servicio— de 1 a 5, **cada uno con su propia escala**. El resultado sale del **promedio**: 4,0-5,0 aprobado preferente · 3,0-3,9 aprobado · 2,0-2,9 condicionado · menos de 2,0 no aprobado | `ESCALAS_EVALUACION` y `resultadoSugerido()` en `lib/proveedores.ts`; `puntaje` generado en SQL es el promedio × 20 |
| Un condicionado se reevalúa a los 3 meses, no según la periodicidad del Asociado de Negocio | `MESES_HASTA_REEVALUAR` y `registrarEvaluacion()` |
| Ejecutar un mantenimiento reagenda el siguiente según la frecuencia del activo | `sincronizar_activo_al_mantener()` |
| **El activo es edilicio o tecnológico, y se llevan por separado.** Son dos cortes del mismo inventario, no dos tablas: comparten calendario de mantenimientos e historial. Y tiene **criticidad** —alta, media, baja— y **seis estados**: operativo, operativo con observación, en mantenimiento, fuera de servicio, en reserva, dado de baja. Un activo real que se retira se pasa a «Dado de baja», no se borra | `clase`, `criticidad` y `estado_activo` en SQL; `ESTADOS_ACTIVO`, `CLASES_ACTIVO` y `SIGNIFICADO_ESTADO_ACTIVO` en `lib/constantes.ts` |
| Competencias: escala 1 a 5; la brecha es exigido menos alcanzado | `brecha` generada en SQL y `NIVELES_COMPETENCIA` |
| El nivel exigido sale de la matriz del puesto de la persona, no se escribe a mano | `evaluarCompetencia()` |
| Solo el líder inmediato o Calidad evalúan a una persona | `evaluarCompetencia()` |
| La eficacia de una capacitación se verifica por persona, no por curso, y el resultado de cada persona es binario: eficaz o no eficaz | `verificarEficacia()` y `capacitacion_participantes.eficacia` |
| Eficacia de la acción formativa, deducida de la de su gente: 1 participante, el suyo; 2 a 4, eficaz si todos, parcialmente con uno no eficaz, no eficaz con dos o más; 5 o más, por porcentaje —80 % o más eficaz, 60 a 79 parcialmente, menos de 60 no eficaz—. No se guarda: se calcula al leer | `eficacia_de_la_accion()` en SQL y `eficaciaDeLaAccion()` en `lib/formacion.ts` |
| Con un solo participante, un «no eficaz» exige declarar la causa —la formación o el participante— y admite **una** reevaluación. Si tras el refuerzo resulta eficaz, la acción cierra como «eficaz tras refuerzo» y el primer resultado queda en `eficacia_inicial` | `verificarEficacia()` y `CAUSAS_NO_EFICACIA` |
| NPS = % promotores (9-10) menos % detractores (0-6); los pasivos cuentan en el denominador | `resumirNps()` y `categoria_nps` generada en SQL |
| Solo un detractor con comentario genera no conformidad, de origen `reclamo_cliente` | `generar_no_conformidad_desde_respuesta()` |
| Un mes con menos de 5 respuestas no se grafica: el índice deja de significar algo | `RESPUESTAS_MINIMAS_NPS` |
| Solo puede haber una publicación fijada a la vez | `fijarPublicacion()` |
| **El muro saluda solo el día que alguien cumple años o cumple años en la empresa, Y LA TARJETA QUEDA.** Lo pidió Facundo el 5 de noviembre, y las dos cosas juntas: la tarjeta mira **treinta días hacia adelante** y sirve para agendar —«cumple en cuatro días»—; el saludo es **del día** y ocupa el muro, que es donde la gente comenta. Sin la tarjeta nadie se entera con tiempo; sin el saludo hay que acordarse de escribirlo a mano, que es justo lo que no pasa. **Una publicación por persona**, no una del día con todos: cada uno con su nombre, su foto y su hilo. **Dos tipos nuevos del enumerado, `cumpleanos` y `aniversario`**, que quedan **fuera del desplegable del alta manual** por `TIPOS_PUBLICACION_VIGENTES` —como `ESTADOS_PLAN_VIGENTES`—: los escribe el trabajo programado, y ofrecerlos invitaría a que el mismo día haya dos saludos para la misma persona. No se reusó `reconocimiento`, que en un SGC significa reconocer un mérito. **Vence el mismo día**: el muro filtra por `fecha_vencimiento >= hoy`, así que se va solo y nadie archiva nada. **Y es idempotente**: antes de escribir mira qué saludos ya existen para hoy por persona y motivo, porque la corrida se puede disparar dos veces. **Va dentro del cron de las 11:00 y no en uno propio** —el plan de Vercel cuenta los trabajos programados— al final y en su propio `try`, para que un cumpleaños no se lleve puestas las alertas que ya salieron. **El texto dice «en la empresa» y no nombra a Camping 44**, por lo mismo que el resto: `empresa_id` es el inquilino y vale siempre Camping 44, también para los once de Vitalica. **OJO CON EL ALCANCE**: `vista_efemerides` lee `usuarios`, así que solo saluda a quien ya ingresó —12 de 55 al 5 de noviembre, y de esos solo 6 tienen fecha de ingreso cargada—; crece solo a medida que la gente entra. Ampliarlo al padrón se evaluó y se descartó: publicaría el cumpleaños de alguien que todavía no usó el sistema | `publicarEfemeridesDelDia()` y `TIPOS_PUBLICACION_VIGENTES` |
| **Los cumpleaños y aniversarios van a la derecha en pantalla grande y arriba en el celular, con un solo bloque.** Estaban en el tercio derecho de una grilla de tres, y en el celular eso los dejaba **debajo de todas las publicaciones**: para ver quién cumple había que bajar el muro entero. El 3 de noviembre se los subió a una franja arriba, y eso arregló el celular pero **dejó vacío el tercio derecho de la pantalla grande**, que es justo donde sobraba lugar —lo marcó Dirección el mismo día—. La solución no es repetir el bloque ni esconder una copia con CSS: la tarjeta va **primera en el HTML**, así en el celular —una sola columna— queda arriba, y de `lg` para arriba un `order` la manda a la columna derecha y el muro recupera sus dos tercios. **La ventana es de 30 días corridos, no «lo que queda del mes»**: con el mes como techo la tarjeta se vaciaba sola —el 28 decía «no quedan cumpleaños en noviembre» aunque alguien cumpliera el 2 de diciembre—, y en diciembre un cumpleaños de enero daba negativo. El piso sigue siendo hoy, que eso estaba bien: un cumpleaños de hace dos semanas ya no sirve para saludar. **Hoy va en el rojo de la marca y con anillo en el avatar**, porque es la única fila que pide hacer algo. La cuenta de días se hace en UTC sobre `AAAA-MM-DD` para que no la corra el huso  **Y cada fila lleva el día en un recuadro.** Era una lista de renglones grises iguales con la fecha escrita adentro del texto, así que había que leer la frase entera para saber cuándo era cada cosa —Dirección lo rebotó dos veces—. Con el día y el mes en un recuadro a la derecha la columna de fechas se escanea sola, el nombre queda como lo primero que se lee, y **vuelve el día del mes**, que es el dato que sirve para agendar y que se había perdido al pasar todo a «en N días». Hoy no grita: el recuadro pasa a relleno y el renglón toma un fondo apenas teñido| `lib/efemerides.ts` y `tarjeta-efemerides.tsx` |
| Plazo para responder una NC: **15 días corridos desde la detección, siempre**. Pasó de 5 a 15 el 6 de noviembre, por pedido de Dirección: es el plazo máximo del proceso. No se escribe a mano. **El escalamiento al líder sigue en 10 días**, así que hoy escala antes de que venza el plazo: si tiene que acompañar, lo decide Calidad | Disparador `completar_no_conformidad()` y `DIAS_LIMITE_CIERRE_NC` |
| **El correo caído se ve en pantalla, porque el aviso no puede ir por correo.** El SMTP se cayó el **10 de octubre** —se revocó la contraseña de aplicación de Google, y eso pasa solo cuando se cambia la contraseña de la casilla o se apaga la verificación en dos pasos— y **nadie se enteró hasta el 3 de noviembre**, de casualidad, porque alguien preguntó por qué no le había llegado el aviso de una no conformidad. Veinte notificaciones habían quedado con `correo_enviado = false` sin que el sistema dijera nada. Ahora la pantalla de Usuarios lo avisa. **Se avisa por las ATRASADAS, no por las pendientes**: el envío dentro de la petición casi nunca llega —tope de 6 segundos— así que prácticamente todo correo sale recién en el reenvío de las 11:00, y una notificación de hace tres horas sin enviar es lo normal; lo que no es normal es que haya pasado una corrida entera, de ahí `HORAS_SIN_ENVIAR_PARA_AVISAR = 26`, con margen porque en el plan de Vercel la corrida cae en cualquier momento dentro de la hora. **El conteo va por una función `SECURITY DEFINER` y no por una consulta**: la política de `notificaciones` es `usuario_id = auth.uid()`, así que el Administrador SGC solo ve las propias —y está bien que así sea, el texto de una notificación es personal—; `correos_pendientes()` devuelve **el agregado y nada más**, y lleva el corte de rol adentro, no en la pantalla. **Y el aviso dice cuándo deja de ser recuperable**: el reenvío solo mira `DIAS_DE_REENVIO_DE_CORREO` hacia atrás, así que lo más viejo que eso no sale nunca aunque se arregle el SMTP | `correos_pendientes()`, `HORAS_SIN_ENVIAR_PARA_AVISAR` y `DIAS_DE_REENVIO_DE_CORREO` |
| **«Mis ventas» son cuatro tarjetas y una serie**: vendido, objetivo, cuánto va contra lo que tocaba a hoy, y a cuánto por día hábil tiene que ir hasta el cierre. La tercera es la que importa a mitad de mes: un 50 % el día 10 está bien y el día 25 está mal, y el alcance solo no distingue los dos casos. Abajo, el mes a mes con `GraficoTendencia` —en millones, porque en guaraníes el eje son nueve dígitos— y su tabla con el monto exacto. **No hay comparación contra el año anterior**: `ventas_mensuales` solo tiene 2026, porque la hoja `DATA` del informe trae el año en curso | `mis-ventas/page.tsx` y `avance-del-mes.tsx` |
| **El alta de una publicación son cinco campos.** «Sobre quién» y «Proceso» salieron del formulario el 9 de octubre: cuanto menos pregunta la portada, más gente publica. Las dos columnas siguen en la tabla y el muro las muestra en las publicaciones viejas que las tengan; lo que no puede pasar es que **editar una publicación vieja las borre**, así que `actualizarPublicacion()` directamente no las toca | `muro-publicaciones.tsx` e `inicio/acciones.ts` |
| **El organigrama volvió al directorio, como segunda pestaña.** Se había retirado el 5 de octubre y Dirección lo pidió de vuelta el 9. Es un árbol de cajas unidas por líneas, en CSS y no en SVG: el navegador ya sabe repartir el ancho de los hermanos y con SVG habría que recalcular 55 posiciones cada vez que alguien cambia de jefe. **La línea de reporte sale de `vista_directorio.lider_clave`**, que prefiere `usuarios.superior_id` —cargado a mano— y si no hay, el `gerente_nombre` del padrón. Quien no tiene jefe queda como raíz y se muestra aparte: un dato que falta tiene que verse, no esconderse. El armado corta ciclos, porque Odoo llegó a declarar a alguien como su propio gerente y un recorrido ingenuo se cuelga | `organigrama.tsx` y `vista_directorio` |
| **El directorio sale del padrón, no de quién se conectó.** Leía `usuarios` —solo quien entró alguna vez con Google— así que «Quién es quién en Camping 44» mostraba dos personas. Ahora `vista_directorio` une las dos fuentes: para quien ingresó manda su perfil, que el Administrador SGC pudo haber ajustado; para el resto, el padrón. La vista deja afuera la cédula, la fecha de ingreso y el teléfono del padrón —el directorio lo abre cualquiera— y corre con los permisos de su dueño, así `personas_nomina` sigue siendo solo del Administrador SGC | `vista_directorio` y `directorio/page.tsx` |
| **Dos pantallas nuevas en Administración, las dos de solo lectura.** **Padrón de la nómina** muestra las 55 personas, quién ingresó y a quién le va a faltar puesto o líder cuando entre; corregirlo a mano no sirve, se corrige en Odoo y se vuelve a cargar. **Ingresos al sistema** separa dos preguntas distintas: el estado por persona sale de `usuarios.ultimo_ingreso`, que se pisa, y el historial de `ingresos`, que no se pisa nunca y lo escribe un disparador sobre `auth.sessions` —la aplicación no puede evadirlo, igual que la bitácora—. El historial arranca el 9 de octubre: lo anterior no se puede reconstruir porque Supabase purga su propio registro | `administracion/padron`, `administracion/accesos` e `ingresos` |
| **La tabla del equipo se filtra y se ordena, y todo va en la dirección.** Lo pidió Diego el 15 de octubre: «estaría bueno poder filtrar también por nombre, canal, venta, meta». Se busca por **vendedor** —sin tildes y por partes—, se acota por **canal** y se elige el **orden**: alcance, vendido, objetivo o vendedor. Va con `FiltrosListado`, el mismo de riesgos y reclamos, así el jefe comparte el enlace de lo que está mirando y el botón de atrás funciona. **«Limpiar» conserva `?vendedor=`**, que no es un filtro de la tabla sino de quién se está mirando el detalle más arriba: sin eso, limpiar los filtros del equipo le cambiaba además la persona. **El orden por omisión sigue siendo el alcance y no el monto**, que es la decisión vieja y vale la pena no perderla: quien mira esta tabla lo hace para saber a quién hay que ayudar, y el que está más lejos de su meta puede ser el que más factura. **Quien no tiene el dato cargado queda último en todos los órdenes**: un nulo no es un cero, y ponerlo entre los ceros lo haría parecer uno. **Y el total es de lo que se está viendo**, con el pie diciendo sobre cuántos está hecho: una suma que no corresponde a las filas de arriba es peor que no poner suma | `tabla-equipo.tsx` y `mis-ventas/page.tsx` |
| **El jefe elige de quién ve el detalle en Mis ventas.** El `?vendedor=` de la dirección manda, no un estado del navegador: así el enlace se comparte y el botón de atrás funciona. **Y el permiso se valida en el servidor**: si el código pedido no está entre los canales que supervisa, se ignora y cae a lo suyo. Sin eso, cambiar la dirección a mano dejaba ver las ventas de cualquiera | `selector-vendedor.tsx` y `mis-ventas/page.tsx` |
| **El perfil no se precarga: se precarga el padrón.** `usuarios.id` es clave foránea de `auth.users(id)`, así que la fila no puede existir antes del primer ingreso con Google. `personas_nomina` guarda la nómina exportada de Odoo y `crear_perfil_usuario()` la consulta por correo: el perfil nace con nombre, puesto y fecha de ingreso en vez de nacer vacío. El líder inmediato se resuelve aparte, con `vincular_lideres_de_nomina()`, porque el jefe puede entrar después que su gente. **Las filas no se versionan**: el repositorio es público y son datos personales; se cargan contra la base y se vuelven a cargar cuando Odoo cambie | `personas_nomina` y `20261009000300_padron_de_la_nomina.sql` |
| **Definir el plan del reclamo es cargar sus acciones**: el paso pide acción, responsable y plazo, y admite las que hagan falta. Antes el paso solo pedía la fecha y después rechazaba el cambio pidiendo cargarlas en otra tarjeta, que es una vuelta que nadie adivina | `cambiarEstadoReclamo()` y `panel-caso.tsx` |
| **«Propuestas de mejora» salió del alta de la no conformidad** el 9 de octubre. Era obligatorio y pedía ideas en el momento de levantar la desviación, que es cuando menos se saben: lo que corresponde sale después, del análisis de causa raíz y de la acción correctiva. La columna `propuestas_mejora` queda con sus datos y la ficha los sigue mostrando, así que **editar una NC vieja no los puede borrar**: `actualizarNoConformidad()` directamente no toca esa columna. `campo-propuestas.tsx` queda armado por si Calidad lo vuelve a pedir | `formulario-no-conformidad.tsx` y `no-conformidades/acciones.ts` |
| Origen de la NC: los seis del formulario de Calidad. Los valores del enumerado conservan su nombre viejo; lo que cambió es la etiqueta | `ETIQUETAS_ORIGEN_NC` y `ORIGENES_NC_VIGENTES` |
| Severidad de la NC: Menor, Mayor, Observación/Recomendación. «Crítica» no existe en Camping 44 | `ETIQUETAS_SEVERIDAD_NC` y el enumerado `severidad_no_conformidad` |
| Ciclo de la NC en tres estados: abierta, en tratamiento, cerrada | `ESTADOS_NC_VIGENTES` |
| Cerrar una NC es atribución de Calidad, y solo con la eficacia verificada | Disparador `controlar_cierre_nc()` y `cambiarEstadoNoConformidad()` |
| La NC dice a qué **área** de las trece corresponde, y a qué **empresa** del grupo | `AREAS_ORGANIZACIONALES` y el `CHECK` de `no_conformidades.area` |
| **El grupo son dos empresas: Camping 44 S.A. y Vitalica E.A.S. Una sola gente las administra, pero cada registro es de una.** Sí hay usuarios de Vitalica —el supuesto contrario cayó el 9 de octubre, cuando la exportación de Odoo mostró 11 empleados suyos—, y entran con su propio dominio. Aun así `empresa_id` **siempre** vale Camping 44, porque es el inquilino —el predicado de `misma_empresa()`—, no «de qué empresa habla el registro»: ponerle Vitalica a esa gente la dejaría sin ver nada. Para eso va una columna propia —para eso va una columna propia, como `proveedores.empresa_compradora_id`, `auditorias.empresa_auditada_id`, `puestos.empresa_del_puesto_id` o `no_conformidades.empresa_afectada_id`—. Toda pantalla que pregunte por la empresa ofrece las dos, y todo documento que sale para afuera lleva el logotipo y la razón social de la que firma, no los de Camping 44 por omisión. La lista va por `empresas_del_grupo()`, nunca por un `select` a `empresas`: esa tabla la acota RLS a la propia, así que un registro de la otra empresa vuelve vacío | `empresas_del_grupo()` y `lib/membrete.ts` |
| **El objetivo es la unidad del módulo, no el indicador.** Arriba van tres tortas y nada más: objetivos por estado, **acciones abiertas** y **acciones cerradas**. Las barras por empresa, frecuencia y tipo y las cuatro tarjetas de arriba salieron el 8 de octubre: repetían lo que ya está en la tabla. Qué estado cae de cada lado lo deciden `ESTADOS_PLAN_ABIERTOS` y `ESTADOS_PLAN_CERRADOS`, no la pantalla | `indicadores/page.tsx` y `lib/objetivos.ts` |
| **«Cancelado» salió de los estados de la acción del plan**: una acción o se cumple o no se cumple. El valor sigue en `ESTADOS_PLAN` y en el `CHECK` de la base para que una fila vieja se siga leyendo; lo que se elige hoy es `ESTADOS_PLAN_VIGENTES` | `lib/objetivos.ts` y `esEstadoDePlan()` |
| **El alta de un documento se carga completa**: tipo, empresa, código, categoría, título y archivo. El **proceso al que pertenece** también, salvo que el documento sea un manual —un manual ES el proceso, no cuelga de otro— o que todavía no haya ningún manual cargado | `formulario-documento.tsx` y `crearDocumento()` |
| **«Todos» es lo que está en uso: no lleva obsoletos ni anulados.** Un documento retirado mezclado con los vigentes es justo lo que hace que alguien trabaje con la versión equivocada. El obsoleto vive en su pestaña, que es donde la norma pide conservarlo | `VISTAS` en `documentos/page.tsx` |
| **Obsoleto es uno solo.** Si un documento se reemplaza o deja de existir, queda obsoleto: la pestaña los muestra en **una sola lista** —el retirado entero y la versión reemplazada— y el número entre paréntesis los cuenta juntos. Cada fila dice su versión y por qué está ahí | `documentos/page.tsx` |
| **Retirar un documento son tres pasos**: obsoleto → anular con su motivo → eliminar, y **cada estado ofrece uno solo**. Un **obsoleto** muestra únicamente «Anular»; recién un **anulado** muestra «Eliminar». Así el motivo por el que el documento ya no está queda escrito antes de que el documento desaparezca. **Un documento retirado no se edita ni vuelve al circuito**: obsoleto y anulado son el registro de algo que dejó de regir, así que no tienen «Editar», ni «Enviar a revisión», ni «Validar», ni «Aprobar», ni «Marcar obsoleto». Todo esto, solo el Administrador SGC. Después de anular se **queda en la ficha**: un anulado no sale en ninguna lista y volver al listado lo dejaba sin forma de llegar | `anularDocumentos()`, `eliminarDocumento()` y `acciones-documento.tsx` |
| **Una categoría de la lista maestra puede crearse vacía, y se ve.** Lo único obligatorio es el nombre: Calidad arma la carpeta antes de tener los documentos adentro. Hasta el 10 de octubre la acción lo aceptaba y no tenía dónde guardarlo; ahora la carpeta es una fila de `documento_categorias` | `guardarCategoria()` |
| **El visor del documento se desplaza por dentro**, no la página: el encabezado con el título y los botones queda siempre a la vista. El alto se descuenta de la ventana, nunca se fija en píxeles | `visor-pdf.tsx` y `visor-word.tsx` |
| **Un campo `required` nunca se esconde con CSS.** Un bloque que no corresponde se desmonta, no se tapa con `display:none`: el navegador se niega a enviar el formulario por un campo que no se ve y el botón queda muerto sin decir por qué. Pasó el 9 de octubre con el tratamiento del riesgo, y dejó sin poder guardarse todo riesgo bajo o moderado | `formulario-riesgo.tsx` |
| **La pantalla principal del módulo es un calendario: el objetivo y sus doce meses, nada más.** El F-EST-01-05 salió de ahí el 8 de octubre —repetía lo mismo con treinta columnas—; `hoja.ts` y `tabla-hoja.tsx` quedan armados por si Calidad lo vuelve a pedir en su propia pantalla. En cada celda se registra el resultado de ese mes, y el color sale del tipo del objetivo —dentro del mínimo y el máximo, igual al Sí/No esperado— nunca solo del color: la celda lleva el valor y el estado en palabras. Un mes fuera del período declarado no se puede cargar. Al lado del objetivo van su **estado** y su **responsable** | `objetivo_mediciones`, `estadoDelMes()` y `calendario-objetivos.tsx` |
| **La acción del plan se sigue como una acción correctiva**: evidencia adjunta —`adjuntos` con `entidad = 'objetivo_planes'`, sin esquema nuevo—, estado que se mueve, y al final la eficacia. La eficacia se declara **solo con la acción cumplida**, y un «no eficaz» exige explicación | `seguimiento-de-la-accion.tsx` y `objetivo_planes_eficacia_tras_cumplir` |
| **Los indicadores salieron de la ficha del objetivo** el 8 de octubre, igual que de la pantalla principal y del menú. El objetivo se mide por su calendario mensual. Las pantallas de indicador siguen en el código y hoy no las enlaza nada | `indicadores/[id]` y `formulario-indicador.tsx` |
| **El alta de la acción del plan no lleva seguimiento.** La fecha real, el resultado de la evaluación, el avance, el estado y las observaciones salieron del formulario el 8 de octubre: el alta declara qué se va a hacer y el seguimiento cuenta qué pasó. Los incisos van **sin su letra** —«a)», «b)»…—, y cuando se entra desde la ficha de un objetivo el objetivo viene dado, no se elige | `acciones-del-plan.tsx` y `plan/acciones.ts` |
| **Del alta del riesgo salieron tres campos** el 10 de octubre: **dónde se identifica**, **¿está asociado a una disrupción?** y **los controles existentes**. Queda la descripción, la causa, la consecuencia, el origen, la valoración y el responsable. Las tres columnas **siguen en la base** y la ficha las muestra en los riesgos que las tengan; lo que no puede pasar es que **editar un riesgo viejo las borre**, así que `actualizarRiesgo()` directamente no toca `controles_existentes` ni `asociado_disrupcion`. Con la disrupción salió también su validación: el formulario ya no la pregunta, así que exigirla dejaba el alta sin poder enviarse | `OBLIGATORIOS` en `riesgos/acciones.ts` y `formulario-riesgo.tsx` |
| **Los plazos de la acción de tratamiento se escriben.** «Plazo desde» y «Plazo hasta» venían con hoy y hoy más treinta días puestos: una fecha ya cargada se acepta sin mirarla, y el plazo de una acción es justamente lo que hay que decidir. **Lo único que se calcula solo en el módulo es el nivel del riesgo**, que sale de la probabilidad y la severidad | `acciones-tratamiento.tsx` |
| **La evidencia de una acción admite hasta cinco archivos**, contando los que ya tiene: es un tope por acción, no por subida. Alcanza para el acta, la foto, el correo y el comprobante; más que eso deja de ser evidencia de una acción y pasa a ser un archivo | `MAXIMO_EVIDENCIAS_ACCION` y `revisarCupoDeEvidencia()` |
| **La ficha del riesgo quedó con el estado y nada más de seguimiento.** El bloque «Reevaluar» salió el 10 de octubre: corregía la probabilidad y la severidad desde la ficha y era un tercer lugar donde se tocaba la valoración —el alta, la edición y ahí—. La valoración se carga una vez; el riesgo residual tiene su propia tarjeta, «Medición del riesgo», que se habilita recién cuando llega la fecha en que se acordó medirlo. Salió también la tarjeta «Ficha», que repetía datos que ya están arriba. `reevaluarRiesgo()` queda y hoy no la llama nada | `panel-reevaluacion.tsx` y `riesgos/[id]/page.tsx` |
| **El objetivo y la acción del plan se cargan completos.** Todo obligatorio, con una sola excepción: el **puesto del responsable** de la acción, que es el nombre que le da la planilla y no siempre coincide con un cargo del organigrama | `revisarObjetivo()` y `revisarCampos()` del plan |
| **El objetivo se edita y se elimina desde su ficha**, con el mismo formulario del alta. No tenía ninguno de los dos: las acciones de servidor existían y no las llamaba nada. **Un formulario, no dos**: con uno propio, el de edición termina pidiendo menos campos que el alta y guardar le borra al objetivo lo que no le preguntó —pasó: `actualizarObjetivo()` escribía cinco campos de los catorce—. **El código y el año no se editan**: el código identifica al objetivo en la hoja de Calidad y en los informes ya emitidos, y el año es el de su línea base, así que moverlo haría aparecer y desaparecer objetivos de la hoja de un año para otro. Eliminar **se lleva el plan de acciones y el calendario de mediciones** —no existen fuera del objetivo— y el aviso lo dice con números, porque «¿Está seguro?» a secas no frena a nadie. **Un indicador colgando lo impide**: primero se lo reasigna | `actualizarObjetivo()`, `eliminarObjetivo()` y `eliminar-objetivo.tsx` |
| **La no conformidad declara su causa raíz, y el método para llegar a ella no se impone.** El **análisis de los cinco porqués salió del módulo el 4 de noviembre**, a pedido de Calidad. Lo que queda es la conclusión —obligatoria, mínimo 10 caracteres—: la norma pide determinar la causa, no la técnica con la que se la determina, y sin causa declarada la acción correctiva no tiene contra qué medirse. **Nunca hubo Ishikawa.** La cadena **sigue en `nc_porques` y la ficha de la acción correctiva la sigue mostrando** donde exista —seis no conformidades la tienen—, bajo la causa raíz y dicha como lo que es: un registro de cómo se llegó a ella. **OJO CON EL `delete`**: `actualizarRespuesta()` borraba la cadena y la reinsertaba, así que dejar solo el borrado habría hecho que editar una respuesta vieja le perdiera el análisis; hoy esa función no escribe ni borra `nc_porques`. Y de paso se corrigió que escribía `porques[4]` en `conclusion_causa_raiz` —la quinta respuesta— pisando la conclusión que el alta se cuidaba de no pisar: ahora las dos vías leen el campo `causa_raiz`. **El cierre de la base también cambió**: `cerrar_no_conformidad_por_respuesta()` exigía cinco filas en `nc_porques`, lo que habría dejado sin poder cerrarse a toda NC nueva; hoy exige la causa raíz. Esa función **no la llama nada** —el cierre en uso es `cerrarNoConformidad()`—, se arregló para que no sea una trampa. `guardarPorques()` y `PREGUNTAS_CINCO_PORQUES` quedan escritas y sin uso, como `hoja.ts` y `campo-propuestas.tsx` | `responderNoConformidad()`, `actualizarRespuesta()` y `formulario-accion.tsx` |
| **Cada acción correctiva puede informar hasta a dos personas más, y es opcional.** Lo pidió Carlos el 5 de noviembre: la acción tenía un solo responsable y no había dónde anotar a quién mantener al tanto. **INFORMAR NO ES RESPONDER, y de ahí sale todo**: el responsable ejecuta y es contra quien corren el plazo y el escalamiento; el informado se entera. Por eso `informados_ids` **no entra en ninguna política** —`nc_acciones_responsable` sigue siendo `responsable_id = auth.uid()`—, así que estar informado **no habilita a cerrar la tarea de otro**. **Y el aviso es otro mensaje, no el mismo con otra lista**: al responsable se le dice «tiene a su cargo», que es una obligación con plazo, y al informado «lo pusieron como informado… no queda a su cargo». Con el texto del responsable creería que la tarea es suya. **Es un arreglo con `CHECK` de tope, no dos columnas**, siguiendo `aplicaciones.usuarios_visibles`: con `informado_1_id` e `informado_2_id` habría que decidir qué pasa al borrar el primero, y el tope quedaría en el nombre de las columnas. PostgreSQL no admite clave foránea sobre un arreglo, así que la acción comprueba cada id contra `usuarios` antes de escribir. **`depurarInformados()` saca tres cosas**: los vacíos —son opcionales—, los repetidos —los dos desplegables ofrecen la misma lista— y **al responsable**, que ya recibe el aviso de asignación: sumarle el de informado sería mandarle dos correos sobre lo mismo, el segundo más débil que el primero. **En el formulario los dos van con nombres distintos** —`accion_informado_1` y `accion_informado_2`— y no con el mismo repetido: la regla del módulo es «una entrada por bloque y por posición», y con un solo nombre habría que agrupar de a pares. **Y en la ficha los nombres se buscan aparte**, en una sola consulta para todo el plan: PostgREST no sabe unir un arreglo de uuid con `usuarios`. Un id que ya no resuelve se saltea, porque un uuid crudo en pantalla no le dice nada a nadie | `depurarInformados()`, `MAXIMO_INFORMADOS` y `nc_acciones.informados_ids` |
| **La desviación ya respondida sale del alta de la acción correctiva.** Lo pidió Carlos el 4 de noviembre. El desplegable de «Nueva acción correctiva» filtraba **por estado**, y responder una desviación la deja en «En tratamiento», que es un estado abierto: las 9 ya respondidas seguían eligiéndose entre las 27. **Y elegir una de esas no editaba su respuesta: cargaba una SEGUNDA en paralelo** —otro descargo, otras acciones— sobre la misma desviación, porque `responderNoConformidad()` inserta sin mirar si ya hay. El corte es **«¿tiene alguna acción cargada?»**, el mismo que usa la tarjeta «No conformidades sin plan de acción» del listado, para que las dos pantallas no puedan decir cosas distintas. **Quien llega con `?nc=` de una ya respondida va a su acción correctiva**, no al selector vacío: es lo mismo que decide la ficha de la desviación, que ofrece «Ver la acción correctiva» en lugar de «Cargar» cuando ya existe. Corregir una respuesta cargada se hace desde ahí | `acciones/nueva/page.tsx` y `sinPlan` en `acciones/page.tsx` |
| **La responsabilidad de un proceso vive del lado del proceso, y admite varios por persona.** Lo preguntó Facundo el 4 de noviembre mirando el desplegable «Proceso» de la ficha de usuario, que es uno solo. **Son dos campos distintos y se confundían**: `usuarios.proceso_id` dice a qué proceso PERTENECE la persona —uno, y está bien que sea uno— y `procesos.responsable_id` dice quién lo responde; como la columna está del lado del proceso, **N procesos pueden apuntar a la misma persona**, así que lo de «varios procesos» ya estaba soportado. **Cuatro pantallas preguntaban el campo equivocado**: comparaban `registro.proceso_id === usuario.proceso_id` mientras las 7 políticas RLS miran `es_responsable_de_proceso()`, que lee `procesos.responsable_id`. Con los dos campos desalineados la pantalla dibujaba «Editar» y la base rechazaba la escritura, que es la peor de las dos equivocaciones: un botón que promete algo que no va a pasar. Hoy las cuatro llaman a `esResponsableDelProceso()`, **espejo exacto de la función de SQL**, y tiene que seguir siéndolo. **Y SE ASIGNA DESDE LA FICHA DE LA PERSONA, de a varios**: el campo era un desplegable de uno solo llamado «Proceso a cargo» que escribía `usuarios.proceso_id` —el campo que no concede nada—, así que la etiqueta prometía una responsabilidad que el dato no daba. Hoy es una lista de casillas, «Procesos que responde», y escribe `procesos.responsable_id`. **Guardar suelta los destildados y toma los marcados, en ese orden**: si solo tomara, destildar uno no lo soltaría nunca. **Y lo que suelta se acota a lo que la pantalla ofreció**, por un campo oculto con esa lista: el formulario muestra solo los activos de la **versión 01** del mapa, así que soltar «todos los de esta persona» le borraría sin aviso una responsabilidad de la versión 00 —que existe, hay dos cargadas— con solo tocar cualquier otro campo de la ficha. `usuarios.proceso_id` **no se borra**: sigue diciendo a qué proceso pertenece la persona, que es de a uno y es otra pregunta, y se guarda con el primero de los que responde | `esResponsableDelProceso()`, `procesos.responsable_id` y `formulario-usuario.tsx` |
| **Cada solicitud dice qué área la resuelve.** En «Solicitudes y pedidos» la mayoría lleva el área en el nombre —«para Logística»— pero **no todas**: «Nota de Retiro de Equipos» es de Informática y no había forma de saberlo sin abrirla. Lo marcó Facundo el 4 de noviembre. **Se resuelve con el dato y no con un caso especial para Informática**: la tarjeta dice a qué área va el pedido, las dos de TI quedan marcadas igual que las demás y una solicitud nueva se ubica sola. **Usa la lista de departamentos que ya existe** —la misma del `CHECK` de `no_conformidades.area`— para no abrir una segunda taxonomía que haya que mantener en dos lados. **Nulo es un valor** y quiere decir «no corresponde o no se sabe»: lo llevan los catálogos y los tableros, que no son pedidos de nadie, y **dos solicitudes que no se pueden mapear sin inventar** —«Comercial» no es ninguno de los catorce departamentos, Consumidor Final y Mayorista son sus dos canales, y de «Compra Interna» no está confirmado quién la resuelve—. **Y el `orden` tenía repetidos**: Logística y Nota de Retiro valían los dos 1, así que el desempate lo decidía PostgreSQL; ahora las dos de Informática quedan juntas | `aplicaciones.departamento_que_resuelve` y `lista-aplicaciones.tsx` |
| **Lo que Dirección puede editar lo dice la matriz, y hubo que mirarla política por política.** A `direccion` le figuraba `editar = true` en 16 de los 21 módulos y el 4 de noviembre se revisó qué concedía eso **de verdad**, porque «el código lo niega todo» resultó ser falso. En **9 módulos la política lleva un segundo predicado** que acota la escritura a lo asignado —`responsable_id = auth.uid()`, `gestor_id`, `elaborador_id`, `superior_id`—: ahí `editar = true` **no es un agujero, es lo que hace que «si te lo asignaron, lo podés trabajar» valga también para Dirección**, y se conserva —no conformidades, acciones, cambios, documentos, riesgos, reclamos, objetivos, activos y personas—; `cambios_edicion` además nombra `es_direccion()` explícitamente. En **6 la política exige `puede_gestionar()`, `es_admin_sgc()` o `es_auditor()`**, que Dirección no es, así que no concedían nada: se apagan igual, porque la matriz se lee en pantalla para gobernar permisos y decir que Dirección edita Auditorías cuando no puede es desinformación. **Y en 1 sí era un permiso real concedido sin querer: APLICACIONES.** `aplicaciones_administracion` es `misma_empresa and puede_editar('aplicaciones')` **sin ningún otro predicado**, y `/aplicaciones/administrar` cuelga de `requerirModuloEditable('aplicaciones')`, que lee esta matriz y **no mira `esSoloLectura`**: Dirección podía agregar, editar y borrar las tarjetas de toda la empresa. **DOS CORRECCIONES A LO QUE ESTE ARCHIVO DECÍA ANTES**: `usuarios` **nunca** estuvo en riesgo —sus políticas no consultan `puede_editar()` en ningún momento, escribir exige `es_admin_sgc()`— y el único freno **no** era el código, porque en Aplicaciones no había freno ninguno. **La lección es el método**: un `editar = true` no se lee solo, se lee contra el resto del predicado de su política | `20261104000200_la_matriz_dice_lo_que_direccion_puede.sql` y `requerirModuloEditable()` |
| **Dirección responde la desviación que tiene a su cargo, y eso es todo lo que escribe en el módulo.** Calidad le asignó NC-2026-010 a Ariel Kemper con el correo que le pide analizar la causa raíz y definir el plan, y el sistema lo mandaba a «Sin acceso»: `/acciones/nueva` rebotaba a todo perfil de solo lectura. **Un tratamiento asignado a alguien que no puede cargarlo es una desviación que no se cierra nunca.** La excepción se escribe como una pregunta concreta —`puedeResponderLaDesviacion()`, ¿es el responsable de ESTA desviación?— y **no sacando el control de solo lectura**, que es lo que le habría abierto de una todos los módulos que la matriz ya le concedía. **Editar la no conformidad sigue siendo de Calidad**: el título, el área y la severidad no los toca. **Y el botón ahora se dibuja según la desviación, no según el rol**: «Cargar la acción correctiva» se mostraba siempre, así que Dirección lo veía, lo apretaba y recién ahí lo rebotaba —un botón que lleva a un cartel de permisos es peor que no tenerlo—; «Ver la acción correctiva» sigue para todos, que es lectura. **`responderNoConformidad()` no tenía ningún control de solo lectura**, a diferencia de las otras seis escrituras del archivo: no era un agujero —RLS exige ser el responsable, el detector, el responsable del proceso o Calidad— pero la regla no estaba dicha en ninguna parte. | `puedeResponderLaDesviacion()`, `acciones/nueva/page.tsx` y `no-conformidades/[id]/page.tsx` |
| **El organigrama se corrige arrastrando, y lo mueven Calidad y Dirección.** La línea de reporte sale de Odoo y no siempre es la real: a alguien le falta el gerente, a otro Odoo lo declara su propio jefe. Se arrastra una caja sobre otra y el cambio se guarda en `personas_nomina.lider_manual_id`, que la próxima carga del padrón no pisa. Hacen falta **dos** columnas, no una: `lider_manual_fijado` distingue «todavía nadie lo movió» de «se decidió que no cuelga de nadie», que con un solo nulo se verían igual. Precedencia, de más fuerte a más débil: el ajuste a mano, `usuarios.superior_id`, el gerente de Odoo. **Mover fija la jerarquía, no el dibujo**: la misma operación sincroniza `usuarios.superior_id`, que es lo que lee el escalamiento de acciones vencidas —si no, quedan dos jerarquías, la que se ve y la que manda el correo—. **Era la única escritura de Dirección en todo el sistema y desde el 4 de noviembre son dos** —la otra es responder la desviación que tiene a su cargo—; las dos son deliberadas y las dos están escritas: la línea de reporte la conoce Dirección. Va por `mover_en_organigrama()`, `SECURITY DEFINER`, porque `personas_nomina` es solo del Administrador SGC —ahí están la cédula y el teléfono— y la función escribe **únicamente** esas dos columnas. Recibe la **clave** (`usuario:<uuid>` / `nomina:<uuid>`), no el id: traducirla exige leer el padrón, y Dirección no puede. **Los ciclos se cortan en la base antes de escribir**: colgar a un jefe de su propio subordinado vuelve el árbol infinito y la pantalla deja de dibujarse; el `CHECK` solo alcanza para el caso de uno. Quien no cuelga de nadie va al panel «Sin líder declarado», que es también zona de descarga: soltar una caja ahí la desprende | `mover_en_organigrama()`, `puedeEditarElOrganigrama()` y `organigrama.tsx` |
| **Vitalica se distingue por color, no por una pantalla aparte, y en todas las pantallas.** Lo pidió Dirección el 13 de octubre —«todo lo que sea Vitalica que tenga un colorcito distintivo»— y vale donde un registro declara de qué empresa del grupo es. **Dos formas, según dónde**: el **nombre de la empresa en naranja** cuando es una columna de la tabla o un dato de la ficha —Asociados de Negocio, puestos, usuarios, auditorías, no conformidades—, y **franja naranja arriba más la palabra «Vitalica»** cuando el registro es una caja o una tarjeta y el nombre de la empresa no se escribe —el organigrama, el directorio, Aplicaciones—. Las dos salen de `marca-empresa.tsx`, así que el día que cambie el naranja cambia en un archivo y no en nueve pantallas. **Se mira la columna que dice de qué empresa habla el registro —`empresa_del_puesto`, `empresa_auditada_id`, `empresa_compradora_id`, `empresa_afectada_id`, `empresa_de_la_aplicacion_id`—, nunca `empresa_id`**: ese siempre vale Camping 44 porque es el inquilino de RLS, así que marcando por ahí no se marcaría nunca nada. **Y la comparación va por nombre, no por id**: el id no puede salir de un `select` a `empresas` porque RLS acota esa tabla a la propia y la fila de Vitalica vuelve vacía; la lista llega por `empresas_del_grupo()`. El naranja es `--vitalica`, un color propio y no `--semaforo-alto`, que es del mismo tono: un semáforo dice «cuidado», y acá el color solo dice de qué empresa es el registro. **Información Documentada es la excepción y es deliberada**: sus dos botones de empresa usan los colores fijos de los logotipos, `#E01E37` y `#F47B20`, porque ahí el color identifica a la empresa y no al tema | `marca-empresa.tsx`, `lib/empresas.ts` y `--vitalica` en `globals.css` |
| **El menú se llama «Configuraciones», no «Administración».** Administración es además un área de la empresa —y tiene su propio formulario de tickets—, así que el menú se leía como «las pantallas del área de Administración». Lo que hay adentro es la configuración del sistema: usuarios y roles, padrón, ingresos y bitácora | `navegacion.ts` |
| **La gravedad del reclamo lleva su definición en cada opción**, con las palabras de Calidad: Leve es molestia o fricción menor sin impacto económico ni operativo; Real, incumplimiento comprobable que requiere gestión y solución; Grave, falla crítica de alto impacto que exige escalamiento urgente. Estaba en un recuadro debajo del desplegable, que obligaba a elegir primero para después leer qué significaba lo elegido: la definición hace falta **mientras** se compara una opción con la otra. Con el recuadro salieron los plazos del plan previsto; el plan lo sigue calculando el servidor —puede subir un nivel por reincidencia— y se ve en la ficha, que es donde se ejecuta | `DEFINICION_GRAVEDAD_RECLAMO` y `formulario-reclamo.tsx` |
| **El cliente del reclamo se busca escribiendo, y es un solo campo.** Eran dos —una lista desplegable y el nombre a mano— y el de la derecha ganaba siempre: el reclamo quedaba sin cliente identificado, y **sin cliente no hay forma de detectar la reincidencia**, que es lo que sube el plan de nivel. Ahora se escribe y filtra, **por nombre y por RUC o cédula**, porque en el mostrador el dato a mano es el documento y no la razón social como la escribió Odoo. La comparación va sin tildes y **por partes**: «carlos lopez» encuentra «LÓPEZ, Carlos Alberto». **La búsqueda corre en la base, no en el navegador**: son 8.551 contactos y mandarlos todos es casi un mega de JSON por apertura del formulario, en un celular de piso de venta. Y el filtro vive en `buscar_clientes()` y no en la consulta de PostgREST porque **`ilike` no ignora las tildes** —«lopez» no encuentra «LÓPEZ», que en una cartera paraguaya es la mitad de los apellidos—; `unaccent` solo se puede usar en SQL y no se puede indexar, pero sobre ocho mil filas el recorrido entero son milisegundos. El id y el nombre viajan juntos: el nombre queda escrito como estaba el día del reclamo, aunque después el cliente se renombre. **`clientes` se carga desde la exportación de Odoo**, como el padrón: el ERP sigue fuera de alcance. La carga la hace `npm run importar-clientes -- --archivo=<csv>`, **en la máquina de quien importa y no en el servidor**: el archivo tiene la cartera entera y no pasa por ningún otro lado. `clientes.codigo` guarda el **id del contacto en Odoo**, que es lo único que no cambia cuando se corrige la razón social o el RUC: con eso la segunda carga actualiza en vez de duplicar. La exportación trae **dos columnas «RUC»** —una sin dígito verificador y otra con él—: la que sirve es la segunda | `scripts/importar-clientes.ts` y `selector-cliente.tsx` |
| **Del alta del reclamo salieron tres campos** el 9 de octubre: el gestor del caso, «Involucra material controlado» y los otros departamentos intervinientes. Las tres columnas **quedan** en la base y la ficha las sigue mostrando —hay casos cargados con el dato, y la política `reclamos_edicion` usa `gestor_id`—; lo que se saca es la pregunta al registrar, que es cuando todavía no se sabe la respuesta. **«Material controlado» volvió y se fue de nuevo, las dos veces el 12 de octubre**: entró como casilla opcional y Calidad decidió en el día que tampoco corresponde preguntarla al registrar. Los tres campos quedan fuera del alta. La columna sigue en la base y la ficha la sigue mostrando, así que `actualizarReclamo()` vuelve a **no tocarla**: si la escribiera, editar un reclamo viejo le borraría el dato. El aviso de asignación pasó a ir al **responsable del área**, que es el único asignado al registrar: atado al gestor, nadie se enteraba de que tenía un reclamo con el plazo corriendo. La regla de imparcialidad —el gestor no puede ser quien originó la falla— queda en el `CHECK` de la base | `formulario-reclamo.tsx` y `avisarAlAsignado()` |
| **Compensación del reclamo: el monto y el porcentaje son dos candados simultáneos, y vale el que se alcance primero.** Los tramos de autorización son por monto —hasta Gs. 2.000.000, hasta Gs. 6.000.000, por encima con cofirma— y cada uno lleva su tope sobre la factura afectada: 50 %, 100 %, sin tope. **El tope porcentual pasó de avisar a bloquear el 12 de octubre**, con el ejemplo que lo pidió: Gs. 2.000.000 de compensación sobre una factura de Gs. 2.500.000 están dentro del primer tramo por monto y son el 80 %, así que no corresponde. Y **exige el monto de la factura**: sin el divisor no hay porcentaje que calcular, y dejar pasar la compensación porque falta el dato es lo contrario de un candado. Ojo con una consecuencia: **el tope viaja con el tramo y el tramo lo decide el monto**, así que el caso del ejemplo no se destraba subiendo el monto ni escalándolo —se baja la compensación o se asume sin compensar—. **Quién firma todavía no se verifica**: la pantalla dice qué nivel corresponde y guarda a quién se eligió. **OJO: el 12 de octubre, más tarde, Calidad definió que la compensación del cierre es un campo de TEXTO.** Los tramos, el tope porcentual y el bloqueo de la tercera compensación anual siguen escritos acá y en el `CHECK` de la base, pero **sin un monto que mirar no tienen qué controlar**: hoy no se aplican al camino de cierre. Si se quiere recuperarlos hay que volver a pedir el monto | `excedeTopePorcentual()` y el `CHECK` `reclamos_tope_porcentual` |
| La tercera compensación económica del mismo cliente en el año **bloquea**, no avisa | `MAXIMO_COMPENSACIONES_ANUALES` y `cambiarEstadoReclamo()` |
| **La invitación a ingresar sale del padrón, y no es un enlace mágico.** De las 55 personas del padrón entraron 2, y hasta que entren no se les puede asignar nada: avisarle a cada una era trabajo por fuera del sistema. Ahora cada fila pendiente tiene su botón, y hay uno que manda **de a diez** —cincuenta envíos seguidos en una acción de servidor se quedan sin tiempo a la mitad, y nadie sabría cuáles salieron—, priorizando a quien nunca recibió ninguno. El correo lleva a `/ingresar` y la persona entra con Google: **un enlace de acceso directo crearía el usuario sin pasar por Google y tiraría abajo la primera de las tres capas de validación de dominio**. Se guarda cuándo, quién y **cuántas veces**, porque la pregunta de la puesta en marcha es a quién ya se le insistió tres veces y sigue sin entrar. **La recarga del padrón desde Odoo no toca esas tres columnas**: son historia de la intranet, no datos del ERP | `invitarAlSistema()` y `MAXIMO_POR_TANDA` |
| **Toda la gente vive en una sola pantalla, «Usuarios».** Eran dos entradas del menú con la misma gente —«Padrón de la nómina» las 55 que pueden entrar, «Usuarios y roles» las que ya entraron— así que para configurar a alguien había que saber de antemano en cuál de las dos caía esa persona, que es justo lo que no se sabe. Ahora es una lista con las 55 y lo que cambia es la columna de la derecha: quien no ingresó lleva el botón que lo invita, quien ingresó lleva a su ficha. **La ruta `/administracion/padron` se deja y redirige**, no se borra: está en el historial, en la bitácora y en enlaces guardados, y un 404 no explica nada. **La lista arranca del padrón pero no se queda ahí**: quien ingresó con una cuenta del dominio y no figura en la exportación de Odoo aparece igual, marcado «fuera del padrón» —si no, alguien real quedaría sin fila por un dato que falta en el ERP—. **Más unificado que esto no se puede, y la pantalla lo dice**: el perfil no existe hasta el primer ingreso con Google, así que a quien está Pendiente no hay rol ni permiso que asignarle. El buscador corre **en el navegador** —son 55— y filtra **por partes** sobre nombre, correo, cédula, puesto y rol. **La edición en la fila salió**: con 55 filas y 53 sin nada que editar, un formulario por fila era incoherente; todo se edita en la ficha, con el mismo formulario y la misma acción. **Los permisos son del rol, no de la persona, y la ficha lo dice**: arriba de la matriz figura a cuánta gente más le cambia, y si hace falta que alguien vea algo distinto del resto de su rol, lo que corresponde es cambiarle el rol | `administracion/usuarios/page.tsx`, `lista-usuarios.tsx` y `usuarios/[id]` |
| **El correo lleva el logotipo oficial y un pie que dice la verdad sobre la respuesta.** La plantilla usaba el «C44» tipográfico —el mismo que salió de la barra el 12 de octubre por no ser el logotipo de la empresa— y queda solo de respaldo para cuando no hay dirección pública desde donde servir la imagen, porque un encabezado vacío es peor. Va **sobre recuadro blanco**, por la misma razón que en la aplicación. La imagen **se enlaza, no se adjunta**: un adjunto en línea deja el correo con clip en la bandeja, como si trajera un archivo, y en una invitación eso invita a desconfiar. Y el pie decía «No responda a esta dirección» **también en los correos que van de parte de una persona y llevan su casilla en `replyTo`**: quien respondía llegaba igual, y quien leía el pie no respondía cuando convenía que lo hiciera | `construirHtml()` en `lib/correo.ts` |
| **El tutorial de ingreso es una página pública que se mira, no un archivo que se descarga.** Vive en `/ayuda/ingresar`, con los tres pasos escritos, el video reproduciéndose en la página y los tres errores que generan la llamada a TI. **Tiene que ser pública y por eso `/ayuda` está en `RUTAS_PUBLICAS`**: la lee quien todavía no tiene sesión. Enlazar el PDF y el video sueltos desde `public/` no alcanzaba —el middleware los mandaba a `/ingresar`, así que los enlaces del correo de invitación no funcionaban justamente para las 53 personas a las que iban dirigidos—. Y pedirle a alguien que descargue un PDF desde un correo que todavía no sabe si es legítimo es pedirle demasiado. El PDF queda abajo y dicho como lo que es: para imprimir y pegar en depósito y piso de venta. **Nada privado puede vivir bajo `/ayuda`**: la comparación es por prefijo y todo lo que se ponga ahí queda abierto a Internet | `app/ayuda/ingresar` y `RUTAS_PUBLICAS` en `lib/supabase/middleware.ts` |
| **El tutorial se vuelve a generar con un comando, y las fuentes están completas.** El cuadro del celular salió mal la primera vez: la captura era más ancha que el marco del teléfono, así que `overflow:hidden` le cortaba el borde derecho —el botón «Continuar con Google» partido al medio y dos líneas de texto sin su final—, y encima mostraba la pantalla de ingreso vieja, la de antes de que entrara el logotipo de Vitálica. **No se podía rehacer**: `generar.py` y `armar.py` estaban versionados pero `img/`, la tipografía y el renderizador no, así que el video era un binario que nadie podía reconstruir. Ahora las capturas se toman de la pantalla real con `capturar`, los cuadros se dibujan con `render.mjs` y el video se arma con `armar.py`; lo generado —`f??.html`, `cuadros/`— se ignora y las fuentes se versionan. **Lo que señala el anillo se calcula, no se pone a ojo**: sale de medir el botón en la pantalla real y pasarlo a la escala de la captura, así una pantalla que cambia no deja la marca señalando el lugar equivocado. **Y el `poster` del video es su primer cuadro**, no la hoja para imprimir: eran 2160 × 4776 px dentro de un reproductor apaisado, y 800 KB para mostrar una imagen fija | `docs/tutorial/fuentes` y `ayuda/ingresar/page.tsx` |
| **El puesto se corrige desde la intranet, no esperando a Odoo.** La regla era «se corrige en Odoo y se vuelve a cargar el padrón» y no servía: el ERP tiene cargos desactualizados —gente que cambió de puesto y nadie lo actualizó— y el dato correcto hace falta hoy. Se toca el cargo en la lista de Usuarios y se elige el que corresponde. **Se resuelve igual que la línea de reporte**: una columna de ajuste a mano que la carga del padrón no pisa, y **dos columnas y no una** —`puesto_manual_fijado` distingue «nadie lo corrigió» de «se decidió que no tiene cargo equivalente»—. Guarda un **id**, no un texto: lo que se corrige es contra qué cargo cargado resuelve esa persona. Precedencia: el ajuste a mano, `usuarios.puesto_id`, el cargo de Odoo por nombre. **Escribe en dos lugares según el caso** —quien ya ingresó tiene perfil y va a `usuarios.puesto_id`; quien no, a `personas_nomina`— y `crear_perfil_usuario()` traslada la corrección al perfil en el primer ingreso: sin eso se perdería justo el día en que la persona entra. Cuando el cargo corregido difiere del de Odoo, la fila **muestra los dos**: si no, nadie puede saber si la diferencia es una corrección a conciencia o un dato que quedó mal **Y el cargo asignado es el que se lee en el organigrama y el directorio**, no el texto de Odoo: `vista_directorio` prefiere el ajuste a mano en su rama del padrón —lo pidió Carlos, porque los 43 de «Perfil de Resultados de Puesto» son la lista buena—. **Un puesto lo ocupan varias personas**: no hay unicidad por `puesto_id` en ningún lado, y la pantalla de puestos cuenta personas por cargo **Y el líder inmediato se corrige en la misma lista, por el mismo motivo.** Hasta el 24 de octubre solo se podía arrastrando en el organigrama, que sirve para ver el árbol y no para repasar 55 filas de a una. El selector **no escribe: llama a `moverEnOrganigrama()`**, la misma acción del organigrama, y es lo único que hay que respetar si esto se toca: esa acción resuelve en cuál de las dos tablas cae la persona, sincroniza `usuarios.superior_id` —lo que lee el escalamiento de acciones vencidas— y corta los ciclos antes de escribir; con un camino de escritura propio quedarían dos jerarquías. **Y lo que se muestra sale de `vista_directorio.lider_clave`**, no de una cuenta nueva en la pantalla: recalcular la precedencia acá permitiría que la lista y el organigrama digan cosas distintas. **Quien no está en el padrón no se puede colgar de nadie** —el ajuste vive en `personas_nomina` y esa persona no tiene fila ahí—, así que esa fila va sin lápiz en vez de con un desplegable que la base va a rechazar. **Y ojo con el `select`**: `puesto_manual_id` y `puesto_manual_fijado` se usaban en `page.tsx` y no estaban pedidos en la consulta, así que llegaban `undefined` y la corrección de puesto de un pendiente se guardaba y no se veía | `definirPuesto()`, `selector-puesto.tsx`, `puesto_manual_id` y `vista_directorio` |
| **El caso del reclamo es una sola línea de bloques, y cada uno habilita el siguiente.** Lo definió Calidad el 12 de octubre: se carga el reclamo → se declara la **fecha de contacto** → recién ahí se **planifican** las acciones con responsable y plazo y se **guardan** → recién ahí se **mide** cada una con su fecha real y se le adjunta evidencia → con todas ejecutadas se **cierra**. **No hay «Siguiente paso»**: era una tarjeta de botones que repetía lo que la persona acababa de hacer —se cargaban las acciones y había que apretar «Definir el plan de acción» para decir que se habían cargado—. **Guardar el plan ES definir el plan**, y el estado avanza solo. **Lo planificado queda de solo lectura**: si el plazo se pudiera corregir después, el «en plazo» mediría contra un plazo movido a conveniencia. Se pueden agregar acciones más adelante; las guardadas no se tocan. **Planificar y medir son dos formularios y dos acciones de servidor distintas**, por lo mismo: con uno solo, cargar la fecha real podría estar corrigiendo el plazo prometido. **La fecha decide sola si fue en plazo**: declararlo a mano sería pedirle a la persona que se califique a sí misma | `guardarAccionesDelPlan()`, `guardarEjecucionDeAcciones()` y `cerrarCaso()` |
| **La pantalla de reclamos es una sola vista con barra de filtros.** Las cuatro pestañas —«Abiertos», «Fuera de plazo», «Cerrados» y «Todos»— salieron el 12 de octubre: la pantalla arrancaba en «Abiertos», así que para saber cuántos reclamos hay en el sistema había que cambiar de vista y un caso cerrado no aparecía en la principal. Ahora el listado trae todo y lo que acota es `FiltrosListado`, la misma barra de riesgos y activos, que **escribe en la dirección**: el filtro se comparte y sobrevive a una recarga. **«Fuera de plazo» no se perdió**: es una opción de **Situación**, junto con Abiertos y Cerrados, que es la que trae lo que antes eran vistas. **El filtrado corre en el servidor y no en la consulta**, por dos razones: «fuera de plazo» es una regla de TypeScript —compara plazos y mira el trámite ante la DIGEMABEL— que no existe en SQL, y la búsqueda va **sin tildes y por partes** sobre código, caso y cliente, que es justo lo que `ilike` no hace. **El pie dice cuántos hay y, con filtros puestos, sobre cuántos**: sin el total, un listado acotado se lee como si fuera todo lo que existe | `FiltrosListado` y `reclamos/page.tsx` |
| **El cierre tiene dos salidas: Resuelto y No resuelto.** Las dos piden el comentario —qué pasó, que es el registro de la gestión— y **solo «Resuelto» pide la compensación otorgada**, porque un caso que no se resolvió no compensó nada; el campo se **desmonta**, no se esconde con CSS. «No resuelto» escribe `no_conciliado`, que es el estado que el circuito ya tenía, y el mismo comentario va al motivo que la base exige. **Se habilita recién con todas las acciones ejecutadas**, en plazo o fuera: lo que decide que se puede cerrar es que el plan esté hecho, no que haya salido bien | `cerrarCaso()` y `CierreDelCaso` |
| **Cada acción del plan lleva su evidencia —hasta cinco archivos— y dice si va en plazo.** La evidencia va sobre `adjuntos` con `entidad = 'reclamo_acciones'`, sin esquema nuevo, y el tope es **por acción contando lo ya cargado**, no por subida. **Solo en las acciones ya guardadas**: un archivo necesita una fila a la que colgarse. **Lo cargado se ve y se abre**: el nombre es un enlace a `/adjuntos/<id>`, que firma la dirección recién en el clic y por cinco minutos —el bucket es privado y una URL firmada pegada en el HTML quedaría válida para cualquiera que la copie—. Una evidencia que no se puede abrir no sirve como evidencia. **El caso cerrado la sigue mostrando**, en el bloque de solo lectura de la ficha: el panel deja de dibujar la ejecución al cerrar, así que sin eso el plan y su prueba desaparecían justo en el estado en que alguien los va a revisar. La leyenda «En plazo» / «Fuera de plazo» sale de **una sola función para los dos casos** —abierta compara contra hoy, ejecutada contra la fecha en que se ejecutó—: con dos cuentas distintas la misma acción podría decir una cosa abierta y otra cerrada | `MAXIMO_EVIDENCIAS_ACCION` y `estadoDePlazoDeAccion()` |
| **«Resolución del caso» es distinta de la compensación**: la compensación es lo que se le dio al cliente, la resolución es lo que se hizo para que el problema deje de existir. Un caso puede resolverse sin compensación ninguna, y antes quedaba sin registro de nada. Va en `resolucion_detalle` —el comentario del cierre—, es obligatoria y tiene su propia tarjeta en la ficha. La compensación va en `compensacion_detalle`, como texto | `resolucion_detalle` y `cerrarCaso()` |
| **La pantalla de reclamos lleva dos tortas: por gravedad y por estado**, armadas sobre lo que quedó filtrado y no sobre el total. El **total va en el agujero de la torta**, no en una tarjeta aparte que repita el número. La gravedad usa los colores del semáforo: leve, real y grave son tres niveles de lo mismo y el ojo ya los lee así en el resto del sistema | `reclamos/page.tsx` y `Torta` |
| **En el celular las tarjetas de número van de a dos y las columnas de contexto se esconden.** Las tarjetas de resumen son `grid-cols-2` desde el ancho más chico —una por fila gastaba cuatrocientos píxeles de pantalla para cuatro números—; la convención ya estaba en nueve pantallas y tres se habían desviado. En las tablas con acción al final, las columnas de contexto llevan `hidden md:table-cell` o `lg:` **y el dato que se esconde reaparece bajo el nombre**: esconderlo del todo sería perderlo, no ordenarlo. **Y donde esconder columnas no alcanza, cambia el formato**: las matrices de diez a dieciséis columnas —riesgos, oportunidades, activos— se dibujan como **tarjetas abajo de `md`** y como tabla de `md` para arriba, con `ListaEnTarjetas`. Las dos salen de los mismos datos y viven en el mismo archivo, así que si se agrega una columna se ve ahí mismo que la tarjeta también la necesita. La tabla completa sigue a una rotación de pantalla, con su primera columna fija. **Medido, no estimado**: el cuerpo de la página no se desplaza en horizontal en ninguna pantalla (`scrollWidth == clientWidth` a 360 y 390 px) | `lista-usuarios.tsx`, `puestos/page.tsx` y las grillas `grid-cols-2` |
| **`--primario`, `--destructivo` y `--semaforo-critico` valen los tres `352 76% 50%`.** Son el mismo rojo: usar dos de ellos en el mismo gráfico da dos porciones idénticas que nadie puede separar. Pasó en la torta «Por estado» de reclamos. Los colores de ese módulo viven en `COLOR_ESTADO_RECLAMO` y `COLOR_GRAVEDAD_RECLAMO`, con seis estados sobre cinco tonos: dos se distinguen por intensidad y no por tono, porque son dos grados de lo mismo. Es la misma trampa que `--semaforo-alto` y `--vitalica` | `COLOR_ESTADO_RECLAMO` y `globals.css` |
| **Cada aplicación declara qué roles la ven, y la lista vive en la base.** Hasta el 12 de octubre era todo o nada: `aplicaciones` es un módulo de la matriz de permisos, así que apagarle «ver» a un rol le saca la pantalla entera, pero quien entraba veía las quince tarjetas —un vendedor veía el Tablero comercial, el Informe de Vitalica y Gestión regulatoria igual que Dirección—. La lista estaba escrita en `lib/aplicaciones.ts`, y el propio archivo decía cuándo tenía que dejar de estarlo: «cuando se vuelvan muchas o las tenga que cambiar alguien que no toca código, pasa a una tabla». **Quién la ve es una columna de la fila**, `roles_visibles`, y **el control lo aplica la política de lectura**: a quien no tiene el rol la base directamente no le devuelve la fila. **Sin ningún rol ni persona la aplicación se oculta sin perder su dirección**, que es la única parte difícil de recuperar; quien administra la lista las recibe todas —si no, no podría volver a habilitar lo que ocultó— y la pantalla se las marca. **Y además de roles, puede nombrar personas.** El 13 de octubre llegó el primer pedido de un tablero propio —«que lo vea solo yo»— y no entraba: quien lo pidió es `direccion` y ese rol lo comparte otra persona, así que lo más cerrado posible era «lo ve Dirección», dos personas en vez de una. `usuarios_visibles` **se suma** a `roles_visibles`, no lo reemplaza: la tarjeta le llega a quien tenga uno de esos roles **o** a quien esté nombrado; sin roles y con una sola persona, «solo yo» es literal. **Esto no sube la matriz de permisos a la persona** —ahí la regla de que el permiso es del rol sigue en pie, porque lo que se configura son módulos del sistema—: un enlace a un tablero es otra cosa. **Solo se puede nombrar a quien ya ingresó**: la política compara `auth.uid()` y la fila de `usuarios` no existe antes del primer ingreso con Google. La columna es un arreglo y PostgreSQL no admite clave foránea sobre un arreglo, así que la acción comprueba cada id contra `usuarios` antes de escribir. **La aplicación también dice de qué empresa del grupo es**, en `empresa_de_la_aplicacion_id`, y lo de Vitalica sale con su franja naranja: llegaron el tablero de rotación ABC de Vitalica y el de Camping 44 y, uno al lado del otro, había que abrir el enlace para saber cuál era cuál. **Nulo es un valor**: quiere decir que es del grupo, que es el caso de casi todas —los tickets, los catálogos, el panel de NPS—; marcarlas todas llenaría la pantalla de etiquetas que no distinguen nada. **El mismo informe se llama igual en las dos empresas, y lo que cambia es el sufijo.** Lo pidió Diego el 15 de octubre: «hoy los mismos informes tenés con nombres diferentes». Eran «Tablero comercial» y «Informe de ventas · Vitalica» —el mismo informe— y «Stock y rotación» y «Rotación ABC · Vitalica» —lo mismo—, así que en la pantalla no se leían como un par sino como cuatro cosas distintas. Hoy son **«Informe de ventas · Camping 44»** y **«· Vitalica»**, y **«Reporte de Stock y Rotación · Camping 44»** y **«· Vitalica»**, con la misma descripción y **seguidos en el orden**: un par que se lee junto es lo que hace evidente que son el mismo informe de dos operaciones. **EL NOMBRE SALE DEL PRODUCTO, NO DEL REPOSITORIO**, y se verifica abriéndolo. El 15 de octubre los bauticé «Rotación ABC» por el repositorio `ROTACIONABC`, y el tablero se llama **«Reporte de Stock y Rotación»** en su propio título: el nombre viejo de la intranet, «Stock y rotación», era el correcto y lo cambié por uno peor. Los de GitHub Pages se comprueban clonando el repositorio y leyendo el `<title>`; **los de Apps Script y los Google Sheets no se pueden comprobar desde acá** —exigen cuenta del dominio—, así que de esos el nombre lo confirma quien los pasó. **Queda uno sin confirmar**: «Rotación ABC · planilla (sin confirmar)», la que pasó Diego, cuya dirección no figura en ningún repositorio de la organización. Puede ser la carga de datos del propio reporte —el Apps Script que lee Odoo y publica el tablero, como el `reporte-stock-stk.gs` de Vitalica— y en ese caso no corresponde como tarjeta aparte. **Los nombres van en mayúscula en las palabras con peso**: son nombres propios de aplicaciones de la empresa, no etiquetas del menú, así que se escriben «Tickets de Solicitud para Logística» y no «de solicitud». En minúscula quedan solo los enlaces —de, y, para— y las siglas conservan su forma: TI, NPS, ABC, DIGEMABEL. Estaba mezclado y se notaba, que es justamente lo que pasa cuando una lista la fue cargando gente distinta en días distintos. **El permiso para administrarla es «editar» del módulo `aplicaciones`**, no un módulo nuevo, y la pantalla cuelga de `/aplicaciones/administrar`. **La dirección tiene que ser `https://`**, con `CHECK` en la base y comprobación en la acción: la tarjeta es un enlace que la pantalla dibuja tal cual, así que un `javascript:` lo abriría el resto de la empresa desde su propia sesión. **OJO CON LO QUE ESTO NO HACE**: esconder la tarjeta no cierra la aplicación —los catálogos y tableros de GitHub Pages son páginas públicas en Internet y entra cualquiera que tenga el enlace; los de Apps Script sí exigen cuenta del dominio—, **Un público que no es un rol se sirve nombrando gente, y mientras no haya gente no se sirve.** El 23 de octubre Ariel pasó tres reportes declarando el público de cada uno —el EBITDA para el Directorio, el Reporte de Cobranzas para Cobranzas y el Directorio, la Planilla Financiera para Tesorería y el Directorio— y **Cobranzas y Tesorería no son roles**: los roles son los seis de la matriz de permisos. Tampoco había ingresado nadie de esas dos áreas, así que no había a quién nombrar en `usuarios_visibles`: las tarjetas quedan con el público que sí se puede expresar y se les suma gente a medida que entre. **Y el rol cargado puede no decir lo que dice el cargo**: Eduardo Kemper es el Presidente, del área Directorio, y su perfil tiene rol `colaborador`, así que «lo ve Dirección» lo dejaba afuera justamente de los reportes del Directorio. Queda nombrado en `usuarios_visibles`, que lo resuelve sin tocarle el rol —el rol gobierna todo el sistema, no tres tarjetas—, pero **lo que corresponde revisar es el rol**. **Y ojo con el seed de la tabla**: `las_aplicaciones_son_una_tabla.sql` insertó las 15 aplicaciones recorriendo `empresas`, así que quedaron 15 filas con `empresa_id` de Vitalica que no ve nadie —`empresa_id` es el inquilino y vale siempre Camping 44—. **Se borraron el 11 de noviembre**, con `20261023000200_limpiar_filas_muertas_de_aplicaciones.sql`, que estuvo escrita y sin aplicar dieciocho días: el `delete` volvía atrás sin avisar y se le echó la culpa al MCP, pero **el `project_id` estaba equivocado** —apuntaba a un proyecto que no existe— y todo fallaba igual, lectura incluida. Con el id bueno, `list_projects` lo dice en una llamada. Quedaron 30 filas y 30 nombres distintos, y se verificó antes de borrar que las 16 tenían su copia viva en Camping 44. Con ellas se fue `prueba_borrado_temporal`, una tabla creada en producción para diagnosticar ese mismo falso problema **El CRM Neural es la excepción consciente a la regla del nombre**: por dentro el producto se llama **NeuralOS**, y la tarjeta dice «CRM Neural» porque es el nombre con el que lo pide y lo busca la empresa. Se decidió sabiendo la diferencia. Tampoco se pudo comprobar abriéndolo: el proxy de salida del contenedor bloquea `neuralgenius.tech`, así que lo que se vio fue su pantalla en una captura y la pantalla de administración lo dice | `aplicaciones.roles_visibles` y `aplicaciones/administrar` |
| **La lista de aplicaciones se lee en dos niveles: el área y qué es cada cosa.** Agrupaba por `publico` —el área— y dentro ordenaba por un entero `orden` cargado a mano, y las dos cosas mezclaban criterios. «Solicitudes y pedidos» es un grupo de `publico`, pero **ser una solicitud no es un área: es qué ES la aplicación**, así que el mismo vocabulario respondía dos preguntas distintas y «Comercial y marketing» juntaba sin ningún corte dos catálogos, tres herramientas y tres tableros. Y el `orden` había quedado sin sentido: sus valores son restos de cuando la lista era una sola —`comercial` arrancaba en 7, `general` en 12— y encima tenía repetidos, así que el desempate lo decidía PostgreSQL. **Hoy el grupo sigue siendo el área**, que es como la gente busca —«lo mío»—, y adentro entra `tipo` —solicitud, catálogo, herramienta, tablero— **en orden alfabético**. **La clasificación sale de la descripción y no del nombre**: «Objetivos Mensuales · Comercial» se llama como un tablero y es una herramienta —«para cargar las metas del mes»— y el «Canal de denuncias» no es algo que se mira sino un formulario que se completa. **El subtítulo por tipo solo se dibuja donde hace falta** —el grupo mezcla tipos y tiene al menos `MINIMO_PARA_SUBTITULAR` tarjetas—: un grupo de un solo tipo subtitulado diría dos veces lo mismo, y hoy el único que lo lleva es Comercial. **La tarjeta se dibuja una sola vez**, en un `dibujarTarjeta` del alcance de la página y no en dos ramas copiadas: con dos copias, una columna agregada aparecería en un grupo y no en el otro. `orden` queda en la tabla, salió del formulario y guardar no la toca. **Y de paso se arregló un `select` incompleto**: el formulario de administración lee `departamento_que_resuelve` y la consulta no lo pedía, así que llegaba `undefined`, el `defaultValue` caía en «No corresponde» y **editar cualquier tarjeta le borraba el área** —el mismo descuido que tuvo `puesto_manual_id` en la lista de usuarios—. Cada campo nuevo del formulario se agrega **en los dos lados** | `aplicaciones.tipo`, `agruparAplicaciones()` y `MINIMO_PARA_SUBTITULAR` |
| Archivo del documento: PDF para manual, procedimiento, instructivo, política y plan; formato editable para formulario y registro | `FORMATO_POR_TIPO` en `lib/adjuntos.ts` |
| **La accesibilidad se resuelve en las primitivas, no formulario por formulario.** Una auditoría del 13 de noviembre contra las pautas de interfaz de Vercel encontró tres cosas que se repetían en todo el sistema, y las tres se arreglaron en un solo lugar. **El mensaje de error de una acción de servidor era un `<p>` suelto en quince formularios**: no se anunciaba —quien usa lector de pantalla apretaba «Guardar» y no se enteraba de que el servidor había rechazado— y en un formulario largo quedaba fuera de la pantalla. Hoy es `ErrorDeFormulario`, con `role="alert"` y foco al aparecer; **se enfoca al cambiar el texto y no en cada dibujo**, si no le robaría el foco a quien ya volvió a editar. **`GrupoCampo` ata el mensaje al control**: deriva un `id` de `htmlFor` y clona el control para ponerle `aria-describedby` y, si es error, `aria-invalid` —antes el `prop` `error` existía y **no lo usaba nadie**, y `aria-describedby` no aparecía ni una vez en el proyecto—. Se clona en vez de pedirle los tres atributos a cada campo porque son 122: repetirlos a mano garantiza que falten en la mitad. **El asterisco de obligatorio es decoración** —`aria-hidden` más un «(obligatorio)» para lector de pantalla—; lo que marca el campo es el `required` del control. **`autocomplete="off"` por omisión en `Entrada`**, porque casi todos los campos son de negocio y lo único que lograba el autocompletado era despertar al gestor de contraseñas sobre una no conformidad; los pocos personales declaran el suyo y gana por orden. **`outline-none` nunca va solo**: la barra de navegación lo tenía sin anillo de reemplazo, así que el menú principal de las 77 pantallas no mostraba el foco del teclado. **Y el movimiento se reduce globalmente** con `prefers-reduced-motion` en `globals.css`, con una excepción escrita: **el giro del indicador de carga se conserva**, más lento, porque es la única señal de que la acción sigue en curso —la misma razón por la que el sistema usa `cargando` y no `disabled`—. **Lo que NO se tocó y queda dicho**: las imágenes del muro siguen con `alt=""` y las nombra el botón que las envuelve, que es ARIA correcto, pero **describir lo que la imagen muestra lo tiene que escribir quien publica** —media publicación es una captura de texto— y el alta no lo pide; y `AvisoDeCambiosSinGuardar` **no cubre la navegación interna**, porque `beforeunload` no se despierta con un `<Link>` del App Router | `ErrorDeFormulario`, `GrupoCampo` y `AvisoDeCambiosSinGuardar` |
| **El marcador de posición es una indicación o un ejemplo, y solo la indicación lleva «…».** Una indicación dice qué escribir y queda abierta —«Qué se hizo y con qué resultado…»—, así que termina en puntos suspensivos y **no en punto**: no es una oración. Un ejemplo muestra el valor tal como va —`0981 123 456`, `80012345-6`, `Asunción`, `(1 − diferencias / unidades contadas) × 100`— y **no lleva nada al final**: unos puntos suspensivos ahí dirían que al teléfono le faltan dígitos. Los buscadores son indicaciones y ya terminaban bien. Se revisó el 13 de noviembre: de los 49 marcadores del sistema, 11 eran indicaciones terminadas en punto o sin cierre y se corrigieron; el resto ya estaba como corresponde. **La auditoría de interfaz había marcado esto como un defecto general y era falso**: el sistema ya usaba ejemplos concretos, que es la mitad que de verdad ayuda a quien carga | `selector-cliente.tsx` y `panel-acciones.tsx` |
| **La imagen de una publicación puede decir qué muestra, y es opcional.** Las imágenes del muro iban con `alt=""` —declaradas como decoración— y el propio código decía por qué importa: «la mitad de lo que se publica son capturas de texto, una circular, una pauta». Una circular fotografiada y marcada como decorativa, para quien usa lector de pantalla, no existe. **Eso no se podía arreglar desde el código**: describir una imagen solo lo puede hacer quien la sube, y por eso el 13 de noviembre entró el campo. **Es opcional y tiene que serlo**: la regla del módulo es que cuanto menos pregunta la portada, más gente publica —es la que sacó «Sobre quién» y «Proceso» del alta el 9 de octubre—, y obligarlo haría que se escriba cualquier cosa para pasar el control; un texto alternativo con basura es ruido, no accesibilidad. **Vive en `publicaciones` y no en `adjuntos`** porque describe LA imagen de la tarjeta, que es `url_imagen`, una columna y no una lista: las demás van en galería y las nombra el botón que las envuelve, con su posición y el título. **El campo se desmonta cuando no va a haber imagen** —ni elegida ni ya cargada— en vez de esconderse. **Y cuando no se preguntó, no se escribe**: `editarPublicacion()` solo toca la columna si el formulario la mandó, porque si no, entrar a corregir una coma del cuerpo le borraría la descripción; quitar la imagen sí la borra, que una descripción huérfana reaparece pegada a la próxima imagen. **Con descripción, el nombre del botón es la descripción**: un `aria-label` en el botón tapa el `alt` de la imagen que envuelve, así que ponerla solo en el `alt` no la haría leer nunca. **Y ojo con el `select`**: la columna nueva no estaba pedida en la consulta de `inicio/page.tsx` y llegaba `undefined` —el mismo descuido que tuvieron `puesto_manual_id` y `departamento_que_resuelve` | `publicaciones.descripcion_imagen` y `LARGO_MAXIMO_DESCRIPCION_IMAGEN` |

### Decisiones tomadas por defecto

Quedaron así por falta de definición explícita. Son reversibles:

- **Sin acuse de lectura** de documentos: la difusión notifica, pero no
  exige confirmación.
- **Flujo documental**: un elaborador, un validador y un aprobador, en
  ese orden y nunca la misma persona en dos de los tres.
- **Alta de usuarios**: el perfil se crea en el primer ingreso con rol
  Colaborador; el Administrador SGC ajusta rol y líder inmediato.
- **Adjuntos**: 20 MB, PDF, Office e imágenes.
- **Logotipo**: el oficial llegó como PNG de 740 × 679 con fondo
  transparente. Va en el ingreso, sobre recuadro blanco **solo en modo
  oscuro**: tiene las dos armas en negro y sin el recuadro
  desaparecerían. Queda pendiente el `.svg` del diseñador; cuando
  llegue se sube a `public/` y se cambia una línea en
  `logotipo-oficial.tsx`.
- **NotebookLM salió de Aplicaciones** el 9 de octubre. El cuaderno no se entera de que la
  intranet aprobó una versión nueva, así que listarlo al lado de la documentación vigente
  invitaba a confundir cuál rige. El **Panel de NPS** salió de «Comercial y marketing» al
  grupo «Para toda la empresa»: lo lleva Marketing, pero mide a toda la empresa y lo
  consulta cualquiera.
- **Las solicitudes por área NO se absorben**: los ocho formularios de
  Apps Script —TI, Logística, Marketing, Administración, Calidad,
  Capital Humano, Comercial y compra interna— se enlazan desde
  Aplicaciones y siguen viviendo en Workspace. **El de Capital Humano
  entró el 11 de noviembre** y se cargó igual que sus hermanas, con su
  `departamento_que_resuelve`. Su dirección tiene otra forma
  —`/a/camping44.com.py/macros/s/…` en vez de
  `/a/macros/camping44.com.py/s/…`—: las dos son formas válidas de
  publicar un Apps Script, así que se guarda como vino y no se
  «corrige». **El de Comercial estuvo mal descrito hasta el
  15 de octubre**: decía que era la solicitud de crédito por QR que el
  asesor le comparte al cliente, que es otra cosa y además contradecía a
  su propio nombre —un tablero de pedidos AL área Comercial—. Lo escribí
  así el 9 de octubre y no está verificado de ninguna de las dos formas:
  es una aplicación de Apps Script y exige cuenta del dominio, así que
  desde acá no se puede abrir. Quedó con la descripción de sus seis
  hermanos y **falta que lo confirme quien lo usa**.
  Se evaluó traerlos adentro y se decidió que no: funcionan, están en uso
  y reemplazarlos era mucho trabajo para no cambiar nada que la gente
  note. La razón está escrita en `lib/aplicaciones.ts`.

> **Los códigos de documento del proyecto están sin confirmar.** `MP-SOP-XX`
> y `F-XXX-XX-XX` los definí yo a falta de dato. El Drive muestra que la
> codificación real usa otra forma (`R-02-01` para el perfil de puesto),
> así que la de Calidad es la que debe quedar.

### El mapa de procesos tiene dos versiones conviviendo

La tabla `procesos` lleva una columna `version`:

| Versión | Qué es | Quién la usa |
| --- | --- | --- |
| `00` | 19 procesos, `EST-01`, `MIS-01`, `SOP-01` | Información Documentada: sus 21 documentos cuelgan de ella |
| `01` | 21 procesos, `MP-EST-01` en adelante | Todo lo demás: riesgos, oportunidades, NC, auditorías, indicadores, cambios, publicaciones, alta de usuarios |

**Los códigos no significan lo mismo en las dos.** `EST-01` es
«Información Documentada» en la 00; en la 01 ese proceso es `MP-SOP-01`,
y `MP-EST-01` pasa a ser «Planificación y Control del SGC».

**La 01 todavía está en proceso de aprobación.** Carlos la pasó el 5 de
octubre para tener base cargada en el sistema, no como definitiva. Hasta
que se apruebe, la 00 no se toca: recodificar los 21 documentos es una
decisión aparte que se toma documento por documento.

**Faltan dos procesos de la 01**: `MP-EST-05 Marketing` y
`MP-SOP-05 Cobranzas` venían marcados en amarillo —en elaboración— y
Calidad indicó ignorarlos. Dos indicadores los nombran en texto y quedan
sin vínculo hasta que se aprueben.

> El año del objetivo de la calidad es **el de su línea base**, no el de
> la medición. Los ocho del F-EST-01-05 son de 2026 y se siguen midiendo
> en 2027: `obtenerHoja` muestra los del año más reciente que no pase del
> elegido, para que en enero de 2027 la pantalla no aparezca vacía.

---

## 7. Seguridad

- **Ninguna credencial en el repositorio.** Todo por `.env.local`, con
  `.env.example` documentado.
- **Dominio validado en tres capas**: parámetro `hd` en Google, servidor
  (middleware y retorno de autenticación) y disparador en la base de
  datos. Las tres son necesarias; ninguna sola alcanza.
- **Los dominios que entran son dos**: `camping44.com.py` y
  `vitalica.com.py`, que es un dominio secundario del mismo Google
  Workspace, no una organización aparte. La lista está en tres lugares
  y los tres tienen que coincidir: `DOMINIOS_AUTORIZADOS` en
  `lib/constantes.ts`, su copia en `lib/supabase/middleware.ts` —el
  middleware corre en el borde y no conviene que arrastre todas las
  constantes— y las dos funciones de la base. El `hd` de Google va en
  `*`, no en un dominio: con dos dominios en el mismo Workspace,
  nombrar uno dejaba al otro fuera del selector de cuentas. Sigue
  filtrando las cuentas personales, que es lo que esa capa aporta.
- **Los permisos se resuelven en RLS**, no en la interfaz. Ocultar un
  botón no es un control de acceso.
- **Quién ve qué módulo es una fila de `permisos`, no código.** La matriz
  es rol × módulo, con `ver` y `editar`, y la editan desde
  `/administracion/permisos`. La leen los dos lados: las políticas RLS,
  por `puede_ver()` y `puede_editar()`, y el menú, por
  `MODULO_POR_RUTA`. **Que salgan de la misma tabla es el punto**: antes
  el menú tenía su propia lista de roles y las políticas la suya, y se
  habían separado —de 61 entradas del menú solo 5 declaraban rol, y las
  políticas dejaban leer casi todo a cualquiera, así que un vendedor veía
  las mismas filas que el Administrador SGC en riesgos, auditorías,
  objetivos, proveedores y competencias—.
  El **Administrador SGC tiene piso**: las dos funciones cortan antes de
  mirar la tabla, así que su fila no se consulta nunca y una matriz mal
  cargada no puede dejar al sistema sin nadie que entre a arreglarla.
  Nueve tablas quedan fuera del corte y
  `20261012000300_las_politicas_consultan_los_permisos.sql` dice por qué
  cada una; la que importa es `usuarios`, que la lee todo el sistema para
  mostrar un nombre: su permiso gobierna la pantalla, no la lectura.
  **Un módulo nuevo se agrega en los dos lados**: `CLAVES_MODULO` y
  `MODULOS` en `lib/permisos.ts`, y el `CHECK` de `permisos` en una
  migración nueva.
- **El cliente OAuth de Google NO se marca como «agentic».** El 12 de
  octubre de 2026 Google avisó por correo que agrega una marca
  `is_agentic` a los clientes de OAuth, que a partir del 11 de noviembre
  solo los marcados pueden llamar a los servidores MCP de Workspace, y
  que desde el 12 de noviembre la marca de un cliente existente ya no se
  puede cambiar. El correo nombra al proyecto
  **intranet-sgc-camping44**, que es el nuestro, y por eso conviene
  dejar escrito que **no corresponde hacer nada**.

  El cliente de ese proyecto hace dos cosas y ninguna es un agente de
  IA: el **ingreso con Google** de las 55 personas y el **selector de
  Drive**, que llama a la API REST con alcance `drive.file` desde el
  navegador. El propio correo lo dice: una aplicación que no es un
  agente y solo usa las API REST de Workspace no tiene que hacer nada.

  **El riesgo está en marcarlo, no en dejarlo.** Google avisa que a los
  clientes marcados se les aplican controles de seguridad propios —los
  controles de acceso de agente—: ponerle esa marca al cliente del
  ingreso es agregarle una capa nueva a la única puerta por la que
  entran los 55, a cambio de nada.

  **Y la fecha no deja a nadie encerrado**: lo que se vuelve permanente
  es la marca de un cliente ya creado. Si algún día hace falta un agente
  de IA que lea Drive o Gmail por MCP, lo que corresponde es un
  **cliente OAuth nuevo y aparte**, con la marca elegida al crearlo
  —que es además lo que Google recomienda cuando una aplicación mezcla
  tráfico de agente con el que no lo es—. Eso se puede hacer en
  cualquier momento.

- Los archivos del bucket son privados y se entregan con enlaces firmados
  de duración corta.

---

## 8. Forma de trabajo

- **Commits chicos y descriptivos, en español.** Primera línea en
  imperativo, sin punto final; luego un cuerpo que explique el porqué.
- **Se agrupan antes de subir.** Cada `push` a `main` dispara una
  compilación en Vercel, y el plan gratuito permite **100 por día**. El
  24 de septiembre se agotaron: varios arreglos seguidos, cada uno subido
  por separado, y encima empujados a `main` y a la rama de trabajo a la
  vez, que compila las dos. Los dos últimos commits quedaron sin publicar
  hasta el día siguiente.

  Entonces: se juntan los cambios de una tanda y se sube una vez. Y **no
  se empuja a dos ramas**: si el trabajo va a `main`, va solo a `main`.
  Commits chicos en el historial, sí; subidas de a una, no.

  **Y hay un solo proyecto de Vercel: `intranet-sgc-camping44`.** Del
  armado inicial quedaron otros dos —`intranet` e `intranet-aaei`—
  apuntando al mismo repositorio y la misma rama, creados minutos antes
  con el framework sin detectar y sin una sola variable de entorno: los
  dos intentos que fallaron antes de declarar el framework en
  `vercel.json`. Nadie los borró, así que cada `push` disparaba **tres**
  compilaciones del mismo commit, el plan gratuito compila de a una y el
  despliegue bueno esperaba 15-20 minutos detrás de los otros dos,
  gastando tres del cupo diario en vez de uno.

  El 6 de octubre se les puso «Ignored Build Step» en `exit 0`, que hace
  que salten la compilación. Es reversible: se borra ese ajuste y vuelven
  a compilar. Lo definitivo es desvincularlos del repositorio en
  Ajustes → Git → Disconnect, o borrarlos si en un tiempo nadie los
  extrañó.
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
aniversarios calculados del legajo, y directorio de personas.

> El directorio tenía organigrama y lista de perfiles de puesto. Los dos
> se retiraron el 5 de octubre: los perfiles ya viven en Personas y
> tenerlos en dos lados era buscar lo mismo en dos lugares. La línea de
> reporte **no se borró**: `usuarios.superior_id` sigue ahí y la usan el
> escalamiento de acciones y la pantalla de administración. Lo que se
> quitó es el dibujo.

**Calidad · SGC**, con sus nueve módulos operativos: Control de
información documentada · No conformidades y acciones correctivas ·
Riesgos y oportunidades · Auditorías internas · Indicadores y objetivos ·
Satisfacción del cliente · Recursos humanos · Proveedores ·
Infraestructura y activos.

Y **Aplicaciones**, que reúne los catálogos, tableros y formularios de
pedido que la empresa ya tenía publicados y que hasta ahora había que
conocer de memoria. No los reemplaza: los enlaza. La lista vive en la
tabla `aplicaciones`, con los roles que ven cada una; en
`lib/aplicaciones.ts` quedan los grupos y las reglas.

> La raíz lleva a `/inicio`, no al panel de calidad: el SGC es una
> sección de la intranet, no la portada.

### Ya está en producción

- Credenciales cargadas y despliegue andando en Vercel, proyecto
  **intranet-sgc-camping44**. El framework va declarado en `vercel.json`
  y no en los ajustes del panel: sin eso Vercel compila y después trata
  el proyecto como sitio estático, y el despliegue termina en error.
- Datos reales cargados y seed retirado: 19 procesos, 58 documentos,
  84 activos, 30 objetivos del PE 2026, 17 puestos.
- Módulo de no conformidades rehecho según la revisión de Calidad del
  1 de septiembre.

### Lo que falta para terminar la puesta en marcha

1. **Que la gente ingrese.** El perfil se crea en el primer ingreso con
   Google, así que hasta que entren no se les puede asignar nada.
2. **Ingesta del panel de NPS** (Apps Script y GitHub Pages), que **no se
   reemplaza**: escribe en `encuesta_respuestas` usando `fuente_externa`
   y `referencia_externa`, que es lo que evita duplicar respuestas.
3. **Definiciones de Calidad**: los códigos de puesto (`P-101` en
   adelante los definió el proyecto, no Calidad), los doce documentos
   cargados sin código, y si «Gestión Regulatoria» entra al mapa de
   procesos —tiene catorce objetivos y ningún proceso que los sostenga.
4. **Riesgos y oportunidades**, que se rehace con Calidad.
5. **Selector de Drive**: el código está; falta la configuración en
   Google Cloud. Ver `docs/selector-drive.md`.
