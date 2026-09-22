-- ---------------------------------------------------------------------
-- Las dos empresas del grupo, para el selector de la no conformidad
--
-- El formulario de no conformidad ya pedia las dos empresas, pero la
-- politica `empresas_lectura` solo deja ver la propia (id =
-- empresa_actual()), asi que el selector mostraba una sola opcion:
-- Camping 44. Calidad lleva el SGC de las dos y una desviacion de
-- Vitalica E.A.S. se registra igual.
--
-- No se ensancha la politica. `empresas` tiene RUC y razon social, y
-- abrirla entera a las cuarenta y nueve personas para resolver un
-- desplegable es pagar de mas. Se agrega una funcion SECURITY DEFINER que
-- devuelve lo unico que el selector necesita —id y nombre— y nada mas. Es
-- el mismo criterio que con `crear_notificacion()`: cuando hace falta
-- pasar por encima de RLS, se hace en una funcion acotada de la base y no
-- con la clave de servicio desde la interfaz.
-- ---------------------------------------------------------------------

create or replace function public.empresas_del_grupo()
returns table (id uuid, nombre text)
language sql
security definer
set search_path = public
stable
as $$
  -- Se devuelven tambien las inactivas: Vitalica no opera hoy, pero una
  -- desviacion suya se tiene que poder registrar.
  select e.id, coalesce(e.razon_social, e.nombre)
  from public.empresas e
  order by e.nombre;
$$;

comment on function public.empresas_del_grupo() is
  'Id y razon social de las empresas del grupo, para los selectores de la interfaz. '
  'No expone RUC ni el resto de la ficha.';

revoke all on function public.empresas_del_grupo() from public;
grant execute on function public.empresas_del_grupo() to authenticated;
