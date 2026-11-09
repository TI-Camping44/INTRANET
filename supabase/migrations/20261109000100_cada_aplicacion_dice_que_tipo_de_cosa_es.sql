-- Cada aplicación dice qué tipo de cosa es, para que la lista se lea.
--
-- La pantalla agrupaba por `publico` —el área— y dentro ordenaba por la
-- columna `orden`, un entero que se cargaba a mano. Las dos cosas
-- estaban mezclando criterios:
--
-- · «Solicitudes y pedidos» es un grupo de `publico`, pero ser una
--   solicitud no es un área: es QUÉ ES la aplicación. Así que el mismo
--   vocabulario servía para dos preguntas distintas y «Comercial y
--   marketing» juntaba, sin ningún corte, dos catálogos, tres
--   herramientas y tres tableros.
--
-- · El `orden` había quedado sin sentido: sus valores son restos de
--   cuando la lista era una sola —`comercial` arrancaba en 7, `general`
--   en 12— y encima tenía repetidos, así que el desempate lo decidía
--   PostgreSQL. Nadie podía explicar por qué una tarjeta iba antes que
--   otra.
--
-- Se agrega `tipo` y la pantalla pasa a dos niveles: el área, que es
-- como la gente busca —«lo mío»—, y adentro el tipo, en orden
-- alfabético. El `orden` queda en la tabla y sale del formulario.
--
-- LA CLASIFICACIÓN SALE DE LA DESCRIPCIÓN Y NO DEL NOMBRE: «Objetivos
-- Mensuales · Comercial» se llama como un tablero y es una herramienta
-- —«para cargar las metas del mes»—, y el «Canal de denuncias» no es
-- algo que se mira sino un formulario que se completa.

alter table public.aplicaciones
  add column if not exists tipo text not null default 'tablero';

alter table public.aplicaciones
  drop constraint if exists aplicaciones_tipo_check;

alter table public.aplicaciones
  add constraint aplicaciones_tipo_check
  check (tipo in ('solicitud', 'catalogo', 'herramienta', 'tablero'));

comment on column public.aplicaciones.tipo is
  'Que es la aplicacion: solicitud (se pide algo), catalogo, herramienta (se opera) o tablero (se mira). El grupo sigue siendo el area.';

-- El valor por omisión es `tablero` porque es lo que son la mayoría: lo
-- que no es ninguna de las otras tres es algo que se mira.

update public.aplicaciones set tipo = 'solicitud'
 where nombre like 'Tickets de Solicitud%'
    or nombre = 'Nota de Retiro de Equipos';

update public.aplicaciones set tipo = 'catalogo'
 where nombre in ('Catálogo Mayorista', 'Catálogo de Salón');

update public.aplicaciones set tipo = 'herramienta'
 where nombre in (
   'CRM Neural',
   'Gestor de Visitas y Rutas',
   'Objetivos Mensuales · Comercial',
   'Canal de denuncias'
 );
