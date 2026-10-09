-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- La vista dice si la linea de reporte se corrigio a mano
-- =====================================================================
-- La migracion anterior agrego `lider_manual_fijado` al padron y la
-- vista empezo a respetarla, pero no la exponia. Hace falta: sin ese
-- dato el organigrama no puede avisar cuales lineas ya no dependen de
-- Odoo, y quien recarga el padron no sabe cuales va a pisar y cuales no.
--
-- Se agrega una sola columna al final, `lider_manual`. Al final porque
-- `create or replace view` solo deja agregar ahi: una columna en el
-- medio obliga a borrar la vista y volver a crearla, y eso se lleva los
-- permisos puestos.
-- =====================================================================

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
  end                               as lider_clave,
  coalesce(n.lider_manual_fijado, false) as lider_manual
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
  end,
  n.lider_manual_fijado
from public.personas_nomina n
where n.activo
  and n.usuario_id is null
  and public.misma_empresa(n.empresa_id);

comment on view public.vista_directorio is
  'Directorio y organigrama: quien ingreso (usuarios) y quien no (padron), con su linea de reporte.';

grant select on public.vista_directorio to authenticated;
