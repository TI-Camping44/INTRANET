-- ---------------------------------------------------------------------
-- El Asociado de Negocio lleva dos contactos, y deja de tener codigo a mano
--
-- Lo pidio Direccion el 6 de octubre.
--
-- DOS CONTACTOS. El primero es obligatorio; el segundo, opcional. Antes
-- habia uno solo y un `telefono` aparte, que salio: con el contacto
-- escrito alcanza, y el telefono suelto no decia de quien era.
--
-- EL CODIGO YA NO SE ESCRIBE. Nadie quiere inventarlo al dar de alta, y
-- escrito a mano se repite o se saltea. La columna sigue siendo
-- obligatoria y unica por empresa —`proveedores_codigo_unico`—, asi que
-- el alta lo genera: `AN-001` en adelante. Los importados de Sofidya
-- conservan el suyo, `SOF-PR-...`, y por eso el correlativo se calcula
-- solo sobre los que empiezan con `AN-`.
-- ---------------------------------------------------------------------

alter table public.proveedores
  add column if not exists contacto_secundario text;

comment on column public.proveedores.contacto_secundario is
  'Segundo contacto del Asociado de Negocio. Opcional: el primero, `contacto`, '
  'es el obligatorio.';

-- ---------------------------------------------------------------------
-- El periodo evaluado pasa a ser dos fechas
--
-- Era un texto libre —«Semestre 1»— y asi no se puede ordenar, ni saber
-- si dos evaluaciones se pisan, ni calcular cuanto abarco cada una.
-- Pasan a ser dos fechas: desde y hasta. `periodo` queda para lo que ya
-- estuviera escrito.
-- ---------------------------------------------------------------------

alter table public.proveedor_evaluaciones
  add column if not exists periodo_desde date,
  add column if not exists periodo_hasta date;

comment on column public.proveedor_evaluaciones.periodo_desde is
  'Inicio del periodo evaluado.';
comment on column public.proveedor_evaluaciones.periodo_hasta is
  'Fin del periodo evaluado. No puede ser anterior al inicio.';

alter table public.proveedor_evaluaciones
  drop constraint if exists proveedor_evaluaciones_periodo_valido;

alter table public.proveedor_evaluaciones
  add constraint proveedor_evaluaciones_periodo_valido check (
    periodo_desde is null or periodo_hasta is null or periodo_hasta >= periodo_desde
  );
