-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- Distinguir al cliente del proveedor en la cartera de Odoo
-- =====================================================================
-- La exportacion de Odoo son CONTACTOS, no clientes: de los 8.551, hay
-- 816 que solo nos venden. Un reclamo de cliente abierto a nombre de un
-- proveedor es un caso mal abierto desde el titulo, y el modulo de
-- Asociados de Negocio es el otro lado de la misma moneda.
--
-- Odoo lo dice en dos columnas de la exportacion, «Rango del cliente» y
-- «Rango de proveedor», que cuentan los movimientos de cada lado. Se
-- guardan tal cual vienen, sin interpretar:
--
--   solo clientes      6.832
--   solo proveedores     816
--   los dos              157
--   sin movimientos      746
--
-- LOS 746 SIN MOVIMIENTOS QUEDAN DISPONIBLES PARA UN RECLAMO. No
-- haberle comprado todavia a alguien no lo convierte en proveedor, y un
-- contacto de menos es un reclamo que no se puede registrar. La
-- distincion que importa es sacar a los que SOLO venden.
--
-- `clientes` NO se parte en dos tablas. Es una sola cartera de
-- contactos con dos marcas, porque 157 son las dos cosas a la vez y
-- duplicarlos seria tener el mismo RUC en dos lugares.
--
-- Y NO SE VUELCA EN `proveedores`: ese modulo es curado —rubro,
-- criticidad, evaluacion del F-SOP-08-01, periodicidad— y el Asociado
-- de Negocio entra cuando Calidad lo evalua, no porque Odoo le haya
-- registrado una compra.
-- =====================================================================

alter table public.clientes
  add column if not exists es_cliente   boolean not null default true,
  add column if not exists es_proveedor boolean not null default false;

comment on column public.clientes.es_cliente is
  'Odoo le registra compras: «Rango del cliente» mayor que cero.';
comment on column public.clientes.es_proveedor is
  'Odoo le registra ventas hacia nosotros: «Rango de proveedor» mayor que cero.';

-- ---------------------------------------------------------------------
-- El buscador, ahora con el rol que se esta buscando
-- ---------------------------------------------------------------------
-- `p_rol` tiene valor por omision, asi que conviven esta version y la
-- anterior de dos argumentos. QUIEN LLAME TIENE QUE MANDAR LOS TRES:
-- PostgREST elige la funcion por el nombre de los argumentos, y con dos
-- la llamada es ambigua.
drop function if exists public.buscar_clientes(text, integer);

create or replace function public.buscar_clientes(
  p_texto  text,
  p_limite integer default 8,
  p_rol    text default 'cliente'
)
returns table (id uuid, razon_social text, ruc text, es_cliente boolean, es_proveedor boolean)
language sql
stable
security invoker
set search_path = public
as $$
  select c.id, c.razon_social, c.ruc, c.es_cliente, c.es_proveedor
    from public.clientes c
   where c.activo
     and case p_rol
           when 'cliente'   then not (c.es_proveedor and not c.es_cliente)
           when 'proveedor' then c.es_proveedor
           else true
         end
     and coalesce(
       (
         select bool_and(
           lower(public.unaccent(coalesce(c.razon_social, '') || ' ' || coalesce(c.ruc, '')))
             like '%' || lower(public.unaccent(parte)) || '%'
         )
         from unnest(string_to_array(btrim(coalesce(p_texto, '')), ' ')) as parte
         where btrim(parte) <> ''
       ),
       true
     )
   order by c.razon_social
   limit greatest(1, least(coalesce(p_limite, 8), 20));
$$;

comment on function public.buscar_clientes(text, integer, text) is
  'Contactos que coinciden con el texto, por nombre o RUC, sin tildes y por partes. p_rol acota a cliente o proveedor.';

grant execute on function public.buscar_clientes(text, integer, text) to authenticated;
