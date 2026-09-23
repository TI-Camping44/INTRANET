-- ---------------------------------------------------------------------
-- Control documental segun la revision de Calidad del 23 de septiembre
--
-- Cuatro cambios pedidos por el Coordinador de Calidad:
--
-- 1 · VALIDADOR ADEMAS DE APROBADOR. El borrador se manda a dos
--     personas: una valida y otra aprueba, y pueden ser la misma sin
--     ninguna traba. Hasta ahora habia «uno o mas revisores» y un
--     aprobador, que no es lo mismo: revisar era una lista, validar es
--     un cargo. La columna vieja `aprobador_id` se conserva.
--
-- 2 · CATEGORIAS LIBRES. Calidad agrupa los documentos como le sirve al
--     auditor, y esa agrupacion no coincide con el proceso ni con el
--     tipo. Es texto libre a proposito: una lista cerrada obligaria a
--     pedirle a TI cada vez que aparece una categoria nueva, que es
--     justamente lo que se quiere evitar.
--
-- 3 · ORDEN MANUAL. Dentro de cada categoria el orden lo decide quien
--     arma la carpeta, no el codigo. `orden` es un entero con hueco de a
--     diez —10, 20, 30— para poder intercalar sin renumerar todo.
--
-- 4 · EL CODIGO PUEDE SER «No aplica». La columna ya admitia vacio para
--     los documentos de contexto y las politicas; lo que faltaba era
--     poder decirlo en la interfaz en vez de dejarlo en blanco y que
--     pareciera un olvido.
-- ---------------------------------------------------------------------

alter table public.documentos
  add column if not exists validador_id uuid references public.usuarios (id) on delete set null,
  add column if not exists fecha_validacion date,
  add column if not exists categoria text,
  add column if not exists orden integer;

comment on column public.documentos.validador_id is
  'Quien valida el contenido antes de la aprobacion. Puede ser la misma persona que aprueba.';
comment on column public.documentos.fecha_validacion is
  'Cuando se registro la validacion.';
comment on column public.documentos.categoria is
  'Agrupacion libre que define Calidad. No es el proceso ni el tipo: es como se ordena la '
  'carpeta para el auditor.';
comment on column public.documentos.orden is
  'Orden manual dentro de la categoria. De a diez, para intercalar sin renumerar.';

create index if not exists documentos_categoria_idx
  on public.documentos (empresa_id, categoria, orden);

-- ---------------------------------------------------------------------
-- El orden inicial: el que hoy tiene el listado, que es por codigo
-- ---------------------------------------------------------------------
-- Sin esto todos arrancan en nulo y el primer «subir» de un documento lo
-- dejaria arriba de todo sin relacion con lo que se veia antes.
with numerados as (
  select id,
         row_number() over (
           partition by empresa_id, coalesce(categoria, '')
           order by codigo nulls last, titulo
         ) * 10 as posicion
    from public.documentos
)
update public.documentos d
   set orden = n.posicion
  from numerados n
 where d.id = n.id
   and d.orden is null;
