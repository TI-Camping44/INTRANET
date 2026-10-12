-- El organigrama muestra el puesto asignado, no el texto de Odoo
--
-- Lo pidio Carlos: los 43 puestos de «Perfil de Resultados de Puesto»
-- son la lista buena, y el cargo que se le asigna a una persona desde la
-- intranet tiene que ser el que se lea despues en el organigrama y en el
-- directorio.
--
-- `vista_directorio` ya resolvia el puesto, pero la rama del padron lo
-- hacia SOLO por coincidencia de nombre contra el texto que trae Odoo.
-- Con el cargo corregido a mano —`puesto_manual_id`, de la migracion
-- anterior— esa coincidencia deja de ser la verdad: justamente se
-- corrigio porque el texto de Odoo esta desactualizado.
--
-- Precedencia en la rama del padron, de mas fuerte a mas debil:
--   1. el cargo asignado a mano
--   2. el cargo de Odoo resuelto por nombre
--
-- La rama de quien YA INGRESO no cambia: su puesto vive en
-- `usuarios.puesto_id`, que es lo que se edita en su ficha.
--
-- Lo demas de la vista queda igual: se reescribe entera porque
-- `create or replace view` no admite cambiar una sola rama.

create or replace view public.vista_directorio
with (security_invoker = false) as
  select
    'usuario:'::text || u.id::text as clave,
    u.id as usuario_id,
    u.nombre_completo,
    u.correo,
    u.telefono,
    u.url_avatar,
    u.puesto_id,
    u.puesto_secundario_id,
    pr.nombre as proceso_nombre,
    n.departamento,
    n.empresa_del_puesto,
    true as ingreso,
    case
      when coalesce(n.lider_manual_fijado, false) then (
        select case
                 when m.usuario_id is not null then 'usuario:'::text || m.usuario_id::text
                 else 'nomina:'::text || m.id::text
               end
          from personas_nomina m
         where m.id = n.lider_manual_id and m.activo)
      else coalesce(
        (select 'usuario:'::text || su.id::text
           from usuarios su
          where su.id = u.superior_id and su.activo),
        (select case
                  when j.usuario_id is not null then 'usuario:'::text || j.usuario_id::text
                  else 'nomina:'::text || j.id::text
                end
           from personas_nomina j
          where j.activo
            and lower(unaccent(j.nombre_completo)) = lower(unaccent(n.gerente_nombre))
          limit 1))
    end as lider_clave,
    coalesce(n.lider_manual_fijado, false) as lider_manual
  from usuarios u
  left join procesos pr on pr.id = u.proceso_id
  left join personas_nomina n on n.usuario_id = u.id
  where u.activo and misma_empresa(u.empresa_id)

  union all

  select
    'nomina:'::text || n.id::text as clave,
    null::uuid as usuario_id,
    n.nombre_completo,
    n.correo,
    null::text as telefono,
    null::text as url_avatar,

    -- EL CARGO ASIGNADO A MANO MANDA. Si alguien lo corrigio desde la
    -- intranet, es ese: el texto de Odoo es justamente lo que estaba mal.
    case
      when n.puesto_manual_fijado then n.puesto_manual_id
      else (
        select q.id
          from puestos q
          left join empresas e on e.id = q.empresa_del_puesto_id
         where q.empresa_id = n.empresa_id
           and q.activo
           and lower(unaccent(q.nombre)) = lower(unaccent(n.puesto_nombre))
         order by
           ((coalesce(n.empresa_del_puesto, '') ilike 'VITALICA%')
            = (coalesce(e.nombre, '') ilike 'Vitalica%')) desc,
           q.creado_en
         limit 1)
    end as puesto_id,

    null::uuid as puesto_secundario_id,
    null::text as proceso_nombre,
    n.departamento,
    n.empresa_del_puesto,
    false as ingreso,
    case
      when n.lider_manual_fijado then (
        select case
                 when m.usuario_id is not null then 'usuario:'::text || m.usuario_id::text
                 else 'nomina:'::text || m.id::text
               end
          from personas_nomina m
         where m.id = n.lider_manual_id and m.activo)
      else (
        select case
                 when j.usuario_id is not null then 'usuario:'::text || j.usuario_id::text
                 else 'nomina:'::text || j.id::text
               end
          from personas_nomina j
         where j.activo
           and lower(unaccent(j.nombre_completo)) = lower(unaccent(n.gerente_nombre))
         limit 1)
    end as lider_clave,
    n.lider_manual_fijado as lider_manual
  from personas_nomina n
  where n.activo and n.usuario_id is null and misma_empresa(n.empresa_id);

grant select on public.vista_directorio to authenticated;
