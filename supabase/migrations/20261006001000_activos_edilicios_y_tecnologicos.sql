-- ---------------------------------------------------------------------
-- Infraestructura y Tecnologia: dos clases de activo y mas datos de
-- control.
--
-- Direccion decidio el 6 de octubre llevar por separado los activos
-- edilicios y los tecnologicos. Los 84 cargados son todos tecnologicos
-- —celulares, notebooks, CPU, tablets y POS—, asi que el valor por
-- defecto los deja donde corresponde sin tocarlos.
--
-- LOS ESTADOS SON LOS SEIS DE LA TABLA DE DIRECCION. Ya estaban cuatro;
-- se agregan «operativo con observacion» —funciona pero tiene una falla
-- menor o algo pendiente— y «en reserva» —funciona pero no esta
-- asignado—. Los valores del enumerado no se pueden quitar nunca, por
-- eso van en su propia migracion y antes de usarse.
--
-- La criticidad y el vencimiento de la garantia o licencia son columnas
-- nuevas: sin ellas, el listado que pidio Direccion no se puede armar.
-- La criticidad nace en «media» porque es el unico valor que no afirma
-- nada que nadie haya revisado.
-- ---------------------------------------------------------------------

-- Los dos estados que faltaban. Van aparte: PostgreSQL no deja usar un
-- valor de enumerado en la misma transaccion en que se lo agrega.
alter type public.estado_activo add value if not exists 'operativo_con_observacion' after 'operativo';
alter type public.estado_activo add value if not exists 'en_reserva' after 'fuera_de_servicio';

do $$
begin
  if not exists (select 1 from pg_type where typname = 'clase_activo') then
    create type public.clase_activo as enum ('edilicio', 'tecnologico');
  end if;
  if not exists (select 1 from pg_type where typname = 'criticidad_activo') then
    create type public.criticidad_activo as enum ('alta', 'media', 'baja');
  end if;
end $$;

alter table public.activos
  add column if not exists clase public.clase_activo not null default 'tecnologico',
  add column if not exists criticidad public.criticidad_activo not null default 'media',
  add column if not exists vencimiento_garantia date,
  add column if not exists observaciones text;

comment on column public.activos.clase is
  'Edilicio o tecnologico. Direccion los lleva por separado desde el 6 de octubre.';
comment on column public.activos.vencimiento_garantia is
  'Vencimiento de la garantia o de la licencia, lo que corresponda al activo.';
