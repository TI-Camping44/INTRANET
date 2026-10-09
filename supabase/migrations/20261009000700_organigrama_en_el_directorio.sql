-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- La vista del directorio dice de quien depende cada persona
-- =====================================================================
-- El organigrama se habia retirado el 5 de octubre y vuelve por pedido
-- de Direccion. Para dibujarlo hace falta la linea de reporte de las 55
-- personas, no solo la de las dos que ya ingresaron.
--
-- DE DONDE SALE EL JEFE. De dos lugares, en este orden:
--
--   1. `usuarios.superior_id`, cuando la persona ya ingreso y el
--      Administrador SGC se lo cargo a mano. Manda, porque es una
--      decision tomada dentro del sistema.
--   2. `personas_nomina.gerente_nombre`, que es lo que declara Odoo.
--
-- Se agrega una sola columna al final, `lider_clave`, que apunta a la
-- `clave` de otra fila de esta misma vista. Con eso la pantalla arma el
-- arbol sin consultar nada mas: quien no tiene lider es raiz.
--
-- El `nombre_completo` del jefe se compara sin tildes ni mayusculas:
-- Odoo no siempre lo escribe igual que el nombre de la persona.
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
  coalesce(
    -- El superior cargado a mano gana.
    (select 'usuario:' || su.id::text
       from public.usuarios su
      where su.id = u.superior_id and su.activo),
    -- Si no hay, el gerente que declara Odoo.
    (select case when j.usuario_id is not null
                 then 'usuario:' || j.usuario_id::text
                 else 'nomina:' || j.id::text end
       from public.personas_nomina j
      where j.activo
        and lower(public.unaccent(j.nombre_completo))
            = lower(public.unaccent(n.gerente_nombre))
      limit 1)
  )                                 as lider_clave
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
  (select case when j.usuario_id is not null
               then 'usuario:' || j.usuario_id::text
               else 'nomina:' || j.id::text end
     from public.personas_nomina j
    where j.activo
      and lower(public.unaccent(j.nombre_completo))
          = lower(public.unaccent(n.gerente_nombre))
    limit 1)
from public.personas_nomina n
where n.activo
  and n.usuario_id is null
  and public.misma_empresa(n.empresa_id);

comment on view public.vista_directorio is
  'Directorio y organigrama: quien ingreso (usuarios) y quien no (padron), con su linea de reporte.';

grant select on public.vista_directorio to authenticated;
