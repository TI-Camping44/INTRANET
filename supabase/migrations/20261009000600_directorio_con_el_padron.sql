-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- El directorio muestra a toda la nomina, no solo a quien ya ingreso
-- =====================================================================
-- El directorio leia `usuarios`, y `usuarios` solo tiene a quien entro
-- alguna vez con Google. Con dos cuentas creadas, «Quien es quien en
-- Camping 44» mostraba dos personas. No sirve para nada.
--
-- El dato ya esta: el padron tiene las 55 con su nombre, su puesto y su
-- area. Que la pantalla no las muestre porque todavia no se conectaron
-- es un detalle de implementacion, no algo que a nadie le importe.
--
-- QUE EXPONE Y QUE NO. La vista deja afuera la cedula, la fecha de
-- ingreso y el telefono del padron: el directorio lo abre cualquiera, y
-- esos tres no son para cualquiera. Solo salen nombre, correo, puesto,
-- area y empresa, que es lo que un directorio necesita.
--
-- POR QUE UNA VISTA Y NO ABRIR LA TABLA. `personas_nomina` la ve solo el
-- Administrador SGC, y tiene que seguir siendo asi. La vista corre con
-- los permisos de su dueno —no es `security_invoker`—, de modo que puede
-- leer el padron sin que nadie mas gane acceso a la tabla. El recorte de
-- columnas es parte del contrato de la vista, no una promesa.
--
-- El filtro por empresa se mantiene igual que en el resto del sistema.
-- =====================================================================

create view public.vista_directorio as
-- Quien ya ingreso: manda su perfil, que es el que puede haber ajustado
-- el Administrador SGC.
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
  true                              as ingreso
from public.usuarios u
left join public.procesos pr on pr.id = u.proceso_id
left join public.personas_nomina n on n.usuario_id = u.id
where u.activo
  and public.misma_empresa(u.empresa_id)

union all

-- Quien todavia no ingreso: sale del padron. El puesto se resuelve con
-- la misma regla que usa el alta del perfil, incluido el desempate por
-- empresa del grupo.
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
  false
from public.personas_nomina n
where n.activo
  and n.usuario_id is null
  and public.misma_empresa(n.empresa_id);

comment on view public.vista_directorio is
  'Directorio: quien ingreso (usuarios) y quien todavia no (padron), sin datos sensibles.';

-- Sin el `grant`, PostgreSQL corta antes de evaluar nada y la pantalla
-- queda vacia sin decir por que.
grant select on public.vista_directorio to authenticated;
