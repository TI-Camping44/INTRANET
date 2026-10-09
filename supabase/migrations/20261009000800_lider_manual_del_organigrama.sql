-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- Poder corregir la linea de reporte desde el organigrama
-- =====================================================================
-- El organigrama ya se dibuja, pero no se podia tocar. Y hace falta:
-- Odoo declara a alguien como su propio gerente, a otros les falta el
-- dato, y la jerarquia real no siempre es la que figura en el ERP.
--
-- DONDE SE GUARDA EL CAMBIO. No en `usuarios.superior_id`: esa fila solo
-- existe para quien ya ingreso con Google, y hoy son dos personas de
-- cincuenta y cinco. Tampoco en `gerente_nombre`, que se pisa entero en
-- la proxima carga del padron.
--
-- Va en dos columnas nuevas del padron, que la recarga desde Odoo no
-- toca:
--
--   · `lider_manual_id`      a quien se le colgo, o nulo
--   · `lider_manual_fijado`  si la decision se tomo a mano
--
-- Hacen falta las dos. Con una sola no se puede distinguir «todavia
-- nadie lo movio» de «alguien decidio que no cuelga de nadie»: las dos
-- se verian como un nulo, y la segunda volveria a caer en el gerente de
-- Odoo que justamente se quiso corregir.
--
-- EL ORDEN DE PRECEDENCIA queda asi, de mas fuerte a mas debil:
--   1. `lider_manual_fijado`, que es una decision tomada en el sistema
--   2. `usuarios.superior_id`, cargado a mano en Usuarios y roles
--   3. `personas_nomina.gerente_nombre`, lo que dice Odoo
-- =====================================================================

alter table public.personas_nomina
  add column lider_manual_id uuid references public.personas_nomina (id) on delete set null,
  add column lider_manual_fijado boolean not null default false;

comment on column public.personas_nomina.lider_manual_id is
  'Lider corregido a mano desde el organigrama. Manda sobre el gerente de Odoo.';
comment on column public.personas_nomina.lider_manual_fijado is
  'Si esta en true vale lider_manual_id, incluso cuando es nulo (nadie arriba).';

-- Nadie puede ser su propio lider. Es la unica forma de ciclo que se
-- puede impedir con una restriccion; los ciclos de dos o mas los corta
-- la accion de servidor antes de escribir.
alter table public.personas_nomina
  add constraint personas_nomina_lider_no_es_uno_mismo
  check (lider_manual_id is null or lider_manual_id <> id);

-- ---------------------------------------------------------------------
-- La vista, con el nuevo orden de precedencia.
-- ---------------------------------------------------------------------
create or replace view public.vista_directorio as
select
  'usuario:' || u.id::text          as clave,
  u.id                              as usuario_id,
  u.nombre_completo,
  u.correo,
  u.telefono,
  u.url_avatar,
  u.puesto_id,
  u.puesto_secundario_id,
  pr.nombre                         as proceso_nombre,
  n.departamento,
  n.empresa_del_puesto,
  true                              as ingreso,
  case
    when coalesce(n.lider_manual_fijado, false) then
      (select case when m.usuario_id is not null
                   then 'usuario:' || m.usuario_id::text
                   else 'nomina:' || m.id::text end
         from public.personas_nomina m
        where m.id = n.lider_manual_id and m.activo)
    else coalesce(
      (select 'usuario:' || su.id::text
         from public.usuarios su
        where su.id = u.superior_id and su.activo),
      (select case when j.usuario_id is not null
                   then 'usuario:' || j.usuario_id::text
                   else 'nomina:' || j.id::text end
         from public.personas_nomina j
        where j.activo
          and lower(public.unaccent(j.nombre_completo))
              = lower(public.unaccent(n.gerente_nombre))
        limit 1)
    )
  end                               as lider_clave
from public.usuarios u
left join public.procesos pr on pr.id = u.proceso_id
left join public.personas_nomina n on n.usuario_id = u.id
where u.activo
  and public.misma_empresa(u.empresa_id)

union all

select
  'nomina:' || n.id::text,
  null::uuid,
  n.nombre_completo,
  n.correo,
  null::text,
  null::text,
  (
    select q.id
      from public.puestos q
      left join public.empresas e on e.id = q.empresa_del_puesto_id
     where q.empresa_id = n.empresa_id
       and q.activo
       and lower(public.unaccent(q.nombre)) = lower(public.unaccent(n.puesto_nombre))
     order by ((coalesce(n.empresa_del_puesto, '') ilike 'VITALICA%')
               = (coalesce(e.nombre, '') ilike 'Vitalica%')) desc,
              q.creado_en
     limit 1
  ),
  null::uuid,
  null::text,
  n.departamento,
  n.empresa_del_puesto,
  false,
  case
    when n.lider_manual_fijado then
      (select case when m.usuario_id is not null
                   then 'usuario:' || m.usuario_id::text
                   else 'nomina:' || m.id::text end
         from public.personas_nomina m
        where m.id = n.lider_manual_id and m.activo)
    else
      (select case when j.usuario_id is not null
                   then 'usuario:' || j.usuario_id::text
                   else 'nomina:' || j.id::text end
         from public.personas_nomina j
        where j.activo
          and lower(public.unaccent(j.nombre_completo))
              = lower(public.unaccent(n.gerente_nombre))
        limit 1)
  end
from public.personas_nomina n
where n.activo
  and n.usuario_id is null
  and public.misma_empresa(n.empresa_id);

grant select on public.vista_directorio to authenticated;

-- ---------------------------------------------------------------------
-- La linea de reporte de `usuarios` tambien respeta la correccion.
-- ---------------------------------------------------------------------
create or replace function public.vincular_lideres_de_nomina()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vinculados integer;
begin
  if not public.es_admin_sgc() then
    raise exception 'Solo el Administrador SGC puede vincular la linea de reporte'
      using errcode = '42501';
  end if;

  with pares as (
    select
      persona.usuario_id as usuario_id,
      case
        when persona.lider_manual_fijado then
          (select m.usuario_id from public.personas_nomina m
            where m.id = persona.lider_manual_id and m.activo)
        else
          (select jefe.usuario_id
             from public.personas_nomina jefe
            where jefe.empresa_id = persona.empresa_id
              and jefe.usuario_id is not null
              and lower(public.unaccent(jefe.nombre_completo))
                  = lower(public.unaccent(persona.gerente_nombre))
            limit 1)
      end as jefe_id
    from public.personas_nomina persona
    where persona.usuario_id is not null
  )
  update public.usuarios u
     set superior_id = pares.jefe_id
    from pares
   where u.id = pares.usuario_id
     and pares.jefe_id is not null
     and pares.jefe_id <> u.id
     and u.superior_id is null;

  get diagnostics v_vinculados = row_count;
  return v_vinculados;
end;
$$;
