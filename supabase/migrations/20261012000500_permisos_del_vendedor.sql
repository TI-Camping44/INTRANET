-- ---------------------------------------------------------------------
-- Los permisos iniciales del Vendedor
--
-- Separada de la migracion que crea el valor del enumerado porque
-- PostgreSQL no deja usarlo en la misma transaccion en que se agrego.
--
-- El Vendedor trabaja en el piso de venta: la intranet entera, la
-- documentacion vigente que tiene que conocer, sus ventas, y poder
-- levantar un reclamo del cliente que lo atendio y una no conformidad
-- de lo que vio. No entra a riesgos, auditorias, objetivos, cambios,
-- activos, personas ni asociados de negocio.
--
-- Es lo mismo que ve un Colaborador, con una diferencia: el Colaborador
-- tambien tiene «Mis ventas», porque la pantalla ya se filtra sola por
-- `soloComerciales` —solo aparece a quien esta vinculado al informe—.
-- Para el Vendedor es el centro de su dia, asi que queda explicito.
--
-- Son valores iniciales, no reglas: se corrigen desde Configuraciones.
-- ---------------------------------------------------------------------

do $carga$
declare
  v_empresa uuid;
  v_modulo text;
  v_ver boolean;
  v_editar boolean;
begin
  for v_empresa in select id from public.empresas loop
    foreach v_modulo in array array[
      'inicio', 'directorio', 'aplicaciones', 'mis_ventas',
      'panel', 'documentos', 'riesgos', 'objetivos', 'auditorias', 'cambios',
      'no_conformidades', 'acciones', 'reclamos', 'satisfaccion', 'activos',
      'personas', 'proveedores',
      'usuarios', 'padron', 'ingresos', 'bitacora'
    ] loop

      v_ver := v_modulo in (
        'inicio', 'directorio', 'aplicaciones', 'mis_ventas',
        'documentos', 'no_conformidades', 'acciones', 'reclamos'
      );
      v_editar := v_modulo in ('no_conformidades', 'acciones', 'reclamos');

      insert into public.permisos (empresa_id, rol, modulo, ver, editar)
      values (v_empresa, 'vendedor', v_modulo, v_ver, v_editar)
      on conflict (empresa_id, rol, modulo) do nothing;

    end loop;
  end loop;
end
$carga$;
