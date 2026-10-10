-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- Buscar un cliente por nombre, RUC o cedula
-- =====================================================================
-- La cartera son 8.551 contactos. El buscador del alta de un reclamo los
-- traia todos al navegador para filtrarlos con JavaScript: casi un mega
-- de JSON cada vez que se abre el formulario, y esto se usa desde el
-- celular en piso de venta.
--
-- EL FILTRO VIVE ACA Y NO EN LA APLICACION, por una razon concreta:
-- `ilike` NO ignora las tildes. «lopez» no encuentra «LOPEZ» escrito con
-- acento, y en una cartera paraguaya eso es la mitad de los apellidos.
-- `unaccent` resuelve eso, pero solo se puede usar en SQL.
--
-- NO SE PUEDE INDEXAR: `unaccent` no esta marcada IMMUTABLE y PostgreSQL
-- no la acepta en una expresion de indice. Sobre ocho mil filas el
-- recorrido entero es cuestion de milisegundos; si la cartera creciera
-- un orden de magnitud habria que guardar una columna ya normalizada y
-- mantenerla con un disparador.
--
-- BUSCA POR PARTES Y EN CUALQUIER ORDEN: «carlos lopez» encuentra
-- «LOPEZ, Carlos Alberto». Buscar la cadena entera obligaria a escribir
-- el nombre en el orden en que Odoo lo guardo, que es justo lo que no se
-- sabe.
--
-- `security invoker`, asi que la politica de `clientes` se aplica igual
-- que en cualquier consulta: la funcion no abre una puerta aparte.
-- =====================================================================

create or replace function public.buscar_clientes(p_texto text, p_limite integer default 8)
returns table (id uuid, razon_social text, ruc text)
language sql
stable
security invoker
set search_path = public
as $$
  select c.id, c.razon_social, c.ruc
    from public.clientes c
   where c.activo
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

comment on function public.buscar_clientes(text, integer) is
  'Clientes que coinciden con el texto, por nombre o por RUC, sin tildes y por partes.';

grant execute on function public.buscar_clientes(text, integer) to authenticated;
