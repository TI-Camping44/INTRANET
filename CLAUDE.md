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
| Logotipo | Oficial en `public/logotipo-camping44.png`, mostrado por `logotipo-oficial.tsx` en el ingreso. En la barra va el `C44` de `logotipo.tsx`: a 32 px el detalle del oficial se convierte en manchas |

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
| Adjuntos: 20 MB máximo | `CHECK` en `adjuntos`, bucket y `TAMANO_MAXIMO_ADJUNTO` |
| Hallazgo de NC genera no conformidad; sin eso la auditoría no cierra | `generar_no_conformidad_desde_hallazgo()` y `cambiarEstadoAuditoria()` |
| **La auditoría declara su alcance por documento, no por proceso.** «Procesos auditados» salió del alta el 6 de octubre: Calidad definió que son lo mismo y que el alcance se declara contra la información documentada. `auditoria_procesos` queda para las auditorías cargadas antes | `auditoria_documentos` y `formulario-auditoria.tsx` |
| **La NC se registra en su propio módulo, no en la auditoría.** «Registrar hallazgo» abre `/no-conformidades/nueva?auditoria=<id>`, con el origen y el proceso ya puestos. Decisión de Dirección del 6 de octubre, tomada sabiendo que la auditoría deja de tener hallazgos propios y que no queda dónde anotar una observación, una oportunidad de mejora ni una fortaleza | `panel-hallazgos.tsx` y `no-conformidades/nueva/page.tsx` |
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
| Plazo para cerrar una NC: **5 días corridos desde la detección, siempre**. No se escribe a mano | Disparador `completar_no_conformidad()` y `DIAS_LIMITE_CIERRE_NC` |
| **«Mis ventas» son cuatro tarjetas y una serie**: vendido, objetivo, cuánto va contra lo que tocaba a hoy, y a cuánto por día hábil tiene que ir hasta el cierre. La tercera es la que importa a mitad de mes: un 50 % el día 10 está bien y el día 25 está mal, y el alcance solo no distingue los dos casos. Abajo, el mes a mes con `GraficoTendencia` —en millones, porque en guaraníes el eje son nueve dígitos— y su tabla con el monto exacto. **No hay comparación contra el año anterior**: `ventas_mensuales` solo tiene 2026, porque la hoja `DATA` del informe trae el año en curso | `mis-ventas/page.tsx` y `avance-del-mes.tsx` |
| **El alta de una publicación son cinco campos.** «Sobre quién» y «Proceso» salieron del formulario el 9 de octubre: cuanto menos pregunta la portada, más gente publica. Las dos columnas siguen en la tabla y el muro las muestra en las publicaciones viejas que las tengan; lo que no puede pasar es que **editar una publicación vieja las borre**, así que `actualizarPublicacion()` directamente no las toca | `muro-publicaciones.tsx` e `inicio/acciones.ts` |
| **El organigrama volvió al directorio, como segunda pestaña.** Se había retirado el 5 de octubre y Dirección lo pidió de vuelta el 9. Es un árbol de cajas unidas por líneas, en CSS y no en SVG: el navegador ya sabe repartir el ancho de los hermanos y con SVG habría que recalcular 55 posiciones cada vez que alguien cambia de jefe. **La línea de reporte sale de `vista_directorio.lider_clave`**, que prefiere `usuarios.superior_id` —cargado a mano— y si no hay, el `gerente_nombre` del padrón. Quien no tiene jefe queda como raíz y se muestra aparte: un dato que falta tiene que verse, no esconderse. El armado corta ciclos, porque Odoo llegó a declarar a alguien como su propio gerente y un recorrido ingenuo se cuelga | `organigrama.tsx` y `vista_directorio` |
| **El directorio sale del padrón, no de quién se conectó.** Leía `usuarios` —solo quien entró alguna vez con Google— así que «Quién es quién en Camping 44» mostraba dos personas. Ahora `vista_directorio` une las dos fuentes: para quien ingresó manda su perfil, que el Administrador SGC pudo haber ajustado; para el resto, el padrón. La vista deja afuera la cédula, la fecha de ingreso y el teléfono del padrón —el directorio lo abre cualquiera— y corre con los permisos de su dueño, así `personas_nomina` sigue siendo solo del Administrador SGC | `vista_directorio` y `directorio/page.tsx` |
| **Dos pantallas nuevas en Administración, las dos de solo lectura.** **Padrón de la nómina** muestra las 55 personas, quién ingresó y a quién le va a faltar puesto o líder cuando entre; corregirlo a mano no sirve, se corrige en Odoo y se vuelve a cargar. **Ingresos al sistema** separa dos preguntas distintas: el estado por persona sale de `usuarios.ultimo_ingreso`, que se pisa, y el historial de `ingresos`, que no se pisa nunca y lo escribe un disparador sobre `auth.sessions` —la aplicación no puede evadirlo, igual que la bitácora—. El historial arranca el 9 de octubre: lo anterior no se puede reconstruir porque Supabase purga su propio registro | `administracion/padron`, `administracion/accesos` e `ingresos` |
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
| Causa raíz: los cinco porqués, los cinco obligatorios. Sin Ishikawa | `guardarPorques()` y `analisis-causa-raiz.tsx` |
| **El organigrama se corrige arrastrando, y lo mueven Calidad y Dirección.** La línea de reporte sale de Odoo y no siempre es la real: a alguien le falta el gerente, a otro Odoo lo declara su propio jefe. Se arrastra una caja sobre otra y el cambio se guarda en `personas_nomina.lider_manual_id`, que la próxima carga del padrón no pisa. Hacen falta **dos** columnas, no una: `lider_manual_fijado` distingue «todavía nadie lo movió» de «se decidió que no cuelga de nadie», que con un solo nulo se verían igual. Precedencia, de más fuerte a más débil: el ajuste a mano, `usuarios.superior_id`, el gerente de Odoo. **Mover fija la jerarquía, no el dibujo**: la misma operación sincroniza `usuarios.superior_id`, que es lo que lee el escalamiento de acciones vencidas —si no, quedan dos jerarquías, la que se ve y la que manda el correo—. **Es la única escritura de Dirección en todo el sistema**, y es deliberada: la línea de reporte la conoce Dirección. Va por `mover_en_organigrama()`, `SECURITY DEFINER`, porque `personas_nomina` es solo del Administrador SGC —ahí están la cédula y el teléfono— y la función escribe **únicamente** esas dos columnas. Recibe la **clave** (`usuario:<uuid>` / `nomina:<uuid>`), no el id: traducirla exige leer el padrón, y Dirección no puede. **Los ciclos se cortan en la base antes de escribir**: colgar a un jefe de su propio subordinado vuelve el árbol infinito y la pantalla deja de dibujarse; el `CHECK` solo alcanza para el caso de uno. Quien no cuelga de nadie va al panel «Sin líder declarado», que es también zona de descarga: soltar una caja ahí la desprende | `mover_en_organigrama()`, `puedeEditarElOrganigrama()` y `organigrama.tsx` |
| **Vitalica se distingue por color, no por una pantalla aparte.** En el organigrama la caja de quien ocupa un puesto de Vitalica lleva una franja naranja arriba y la palabra «Vitalica», con su referencia en la barra. **Se mira `empresa_del_puesto`, nunca `empresa_id`**: `empresa_id` siempre vale Camping 44 porque es el inquilino de RLS, así que marcando por ahí no se marcaría nunca a nadie. El naranja es `--vitalica`, un color propio y no `--semaforo-alto`, que es del mismo tono: un semáforo dice «cuidado», y acá el color solo dice de qué empresa es el puesto | `esDeVitalica()` y `--vitalica` en `globals.css` |
| **El menú se llama «Configuraciones», no «Administración».** Administración es además un área de la empresa —y tiene su propio formulario de tickets—, así que el menú se leía como «las pantallas del área de Administración». Lo que hay adentro es la configuración del sistema: usuarios y roles, padrón, ingresos y bitácora | `navegacion.ts` |
| **El cliente del reclamo se busca escribiendo, y es un solo campo.** Eran dos —una lista desplegable y el nombre a mano— y el de la derecha ganaba siempre: el reclamo quedaba sin cliente identificado, y **sin cliente no hay forma de detectar la reincidencia**, que es lo que sube el plan de nivel. Ahora se escribe y filtra, **por nombre y por RUC o cédula**, porque en el mostrador el dato a mano es el documento y no la razón social como la escribió Odoo. La comparación va sin tildes y **por partes**: «carlos lopez» encuentra «LÓPEZ, Carlos Alberto». El id y el nombre viajan juntos: el nombre queda escrito como estaba el día del reclamo, aunque después el cliente se renombre. **`clientes` se carga desde la exportación de Odoo**, como el padrón: el ERP sigue fuera de alcance | `selector-cliente.tsx` y la tabla `clientes` |
| **Del alta del reclamo salieron tres campos** el 9 de octubre: el gestor del caso, «Involucra material controlado» y los otros departamentos intervinientes. Las tres columnas **quedan** en la base y la ficha las sigue mostrando —hay casos cargados con el dato, y la política `reclamos_edicion` usa `gestor_id`—; lo que se saca es la pregunta al registrar, que es cuando todavía no se sabe la respuesta. El aviso de asignación pasó a ir al **responsable del área**, que es el único asignado al registrar: atado al gestor, nadie se enteraba de que tenía un reclamo con el plazo corriendo. La regla de imparcialidad —el gestor no puede ser quien originó la falla— queda en el `CHECK` de la base | `formulario-reclamo.tsx` y `avisarAlAsignado()` |
| Archivo del documento: PDF para manual, procedimiento, instructivo, política y plan; formato editable para formulario y registro | `FORMATO_POR_TIPO` en `lib/adjuntos.ts` |

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
- **Las solicitudes por área NO se absorben**: los siete formularios de
  Apps Script —TI, Logística, Marketing, Administración, Calidad,
  Comercial y compra interna— se enlazan desde Aplicaciones y siguen
  viviendo en Workspace. El de Comercial es la solicitud de crédito por
  QR: el asesor comparte el enlace con el cliente y la solicitud entra a
  la base que revisa Créditos y Cobranzas.
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
conocer de memoria. No los reemplaza: los enlaza. La lista está en
`lib/aplicaciones.ts`.

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
