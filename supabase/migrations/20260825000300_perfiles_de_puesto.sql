-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 022 · Perfil, competencia y funciones del puesto (formulario R-02-01)
-- =====================================================================
-- La tabla "puestos" nacio con lo minimo: codigo, nombre, area y mision.
-- Alcanzaba para la matriz de competencias, pero no para lo que pidio
-- Direccion: que cada persona pueda leer su perfil y el de los demas.
--
-- Los campos que se agregan no son una invencion: son los del formulario
-- R-02-01 que Camping 44 ya usa, uno por uno. Modelar otra cosa
-- obligaria a Calidad a mantener dos versiones del mismo perfil.
--
-- "url_documento" guarda el enlace al archivo original en Drive. La
-- intranet no reemplaza ese archivo: lo muestra y enlaza. Duplicar el
-- contenido garantiza que en dos meses haya dos versiones y nadie sepa
-- cual rige, que es justamente el problema a resolver.

alter table public.puestos
  -- Identificacion del formulario, para que la ficha se lea igual que el papel.
  add column if not exists codigo_formulario text not null default 'R-02-01',
  add column if not exists revision smallint not null default 0,

  -- Linea de reporte declarada en el perfil. Es texto y no una referencia
  -- a otro puesto a proposito: el documento dice "Gerente Administrativo
  -- y Financiero" aunque ese puesto todavia no este cargado, y perder esa
  -- informacion por no tener a donde apuntarla seria peor.
  add column if not exists supervisado_por text,
  add column if not exists reemplazado_por text,

  add column if not exists responsabilidades_generales text,
  -- Una funcion por elemento: asi se listan, se cuentan y se comparan
  -- entre puestos sin tener que partir un parrafo.
  add column if not exists funciones text[] not null default '{}',

  add column if not exists formacion_academica text,
  add column if not exists formacion_complementaria text,
  add column if not exists experiencia text,

  -- "Otros requerimientos" del formulario. Son casilleros de si o no.
  add column if not exists requiere_registro_conducir boolean not null default false,
  add column if not exists requiere_movilidad_propia boolean not null default false,
  add column if not exists requiere_viajes_interior boolean not null default false,
  add column if not exists requiere_viajes_exterior boolean not null default false,
  add column if not exists requiere_horario_extendido boolean not null default false,

  -- Enlace al documento original. La intranet muestra, no reemplaza.
  add column if not exists url_documento text;

comment on column public.puestos.funciones is
  'Funciones propias del puesto, una por elemento, tal como figuran en el R-02-01.';
comment on column public.puestos.supervisado_por is
  'Puesto del que depende, en el texto del perfil. La jerarquia operativa vive en usuarios.superior_id.';
comment on column public.puestos.url_documento is
  'Enlace al R-02-01 original. La intranet enlaza el archivo vigente en lugar de duplicarlo.';

create index if not exists puestos_area_idx on public.puestos (empresa_id, area);
