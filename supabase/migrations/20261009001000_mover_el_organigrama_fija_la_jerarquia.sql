-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- Mover el organigrama lo puede hacer Direccion, y fija la jerarquia
-- =====================================================================
-- DOS CAMBIOS, y los dos vienen del mismo pedido: que mover una caja
-- sea definir la jerarquia, no acomodar un dibujo.
--
-- 1. QUIEN PUEDE MOVER. Hasta ahora solo el Administrador SGC, porque
--    `personas_nomina` es suya entera: ahi estan la cedula, el telefono
--    y la fecha de ingreso, y eso no se abre. Direccion tiene que poder
--    mover el organigrama sin que se le abra el resto del padron.
--
--    Por eso no se toca la politica de la tabla: van funciones
--    `security definer` que escriben UNICAMENTE las dos columnas del
--    organigrama. Es la misma salida que se uso para
--    `crear_notificacion()`, y la que corresponde cuando hace falta
--    mas permiso del que da la fila.
--
--    Es la unica escritura que Direccion puede hacer en el sistema. El
--    rol es de solo lectura en todos los demas modulos y sigue
--    siendolo; esta es la excepcion, y es deliberada: la linea de
--    reporte la conoce Direccion, no Calidad.
--
-- 2. MOVER FIJA LA JERARQUIA DE VERDAD. Antes el arrastre solo cambiaba
--    `personas_nomina.lider_manual_id`, que es lo que se dibuja. Pero
--    el escalamiento de acciones vencidas no lee eso: lee
--    `usuarios.superior_id`. Quedaban dos jerarquias, la de la pantalla
--    y la que de verdad manda el correo al jefe.
--
--    Ahora el mismo movimiento escribe las dos. Cuando la persona o su
--    nuevo lider todavia no ingresaron no hay fila en `usuarios` a la
--    que apuntar, asi que `superior_id` queda nulo: es correcto, y
--    `vincular_lideres_de_nomina()` lo completa cuando entren.
--
-- LAS FUNCIONES RECIBEN LA CLAVE, NO EL ID. La pantalla trabaja con
-- `usuario:<uuid>` y `nomina:<uuid>`, que es lo que devuelve
-- `vista_directorio`. Traducir eso a la fila del padron requiere leer
-- `personas_nomina`, y Direccion no puede: por eso la traduccion vive
-- adentro, en `persona_del_padron()`.
--
-- EL CICLO SE CORTA ACA, no solo en la accion de servidor. Colgar a un
-- jefe de su propio subordinado vuelve el arbol infinito y la pantalla
-- deja de dibujarse. El `CHECK` de la tabla solo alcanza para el caso
-- de uno; el de dos o mas necesita recorrer la cadena.
-- =====================================================================

-- Una version anterior de esta migracion tomaba los ids ya resueltos.
-- No servia: resolverlos requiere leer `personas_nomina`, que Direccion
-- no puede. Se quitan para que no queden dos sobrecargas del mismo
-- nombre.
drop function if exists public.mover_en_organigrama(uuid, uuid);
drop function if exists public.restaurar_lider_de_odoo(uuid);

create or replace function public.persona_del_padron(p_clave text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select n.id
    from public.personas_nomina n
   where n.activo
     and public.misma_empresa(n.empresa_id)
     and (
       (p_clave like 'nomina:%'  and n.id         = nullif(split_part(p_clave, ':', 2), '')::uuid)
       or
       (p_clave like 'usuario:%' and n.usuario_id = nullif(split_part(p_clave, ':', 2), '')::uuid)
     )
   limit 1;
$$;

comment on function public.persona_del_padron(text) is
  'Traduce la clave de vista_directorio a la fila del padron. Interna: no se expone a la interfaz.';

create or replace function public.mover_en_organigrama(
  p_clave_persona text,
  p_clave_jefe    text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_persona         uuid;
  v_jefe            uuid;
  v_usuario_persona uuid;
  v_usuario_jefe    uuid;
  v_actual          uuid;
  v_pasos           integer := 0;
begin
  if not (public.es_admin_sgc() or public.es_direccion()) then
    raise exception 'Solo Calidad o Direccion pueden mover el organigrama'
      using errcode = '42501';
  end if;

  v_persona := public.persona_del_padron(p_clave_persona);
  if v_persona is null then
    raise exception 'Esa persona no esta en el padron de la nomina' using errcode = 'P0002';
  end if;

  select n.usuario_id into v_usuario_persona
    from public.personas_nomina n where n.id = v_persona;

  if p_clave_jefe is not null then
    v_jefe := public.persona_del_padron(p_clave_jefe);
    if v_jefe is null then
      raise exception 'Ese lider no esta en el padron de la nomina' using errcode = 'P0002';
    end if;
    if v_jefe = v_persona then
      raise exception 'Nadie puede ser su propio lider' using errcode = '23514';
    end if;

    select n.usuario_id into v_usuario_jefe
      from public.personas_nomina n where n.id = v_jefe;

    -- Se sube por la cadena del nuevo lider SIMULANDO el cambio. Si en
    -- el camino aparece quien se esta moviendo, se cerraria un circulo.
    v_actual := v_jefe;
    while v_actual is not null and v_pasos < 500 loop
      if v_actual = v_persona then
        raise exception 'El cambio cerraria un circulo de reporte' using errcode = '23514';
      end if;

      select case
               when n.id = v_persona      then v_jefe
               when n.lider_manual_fijado then n.lider_manual_id
               else (select j.id
                       from public.personas_nomina j
                      where j.activo
                        and lower(public.unaccent(j.nombre_completo))
                            = lower(public.unaccent(n.gerente_nombre))
                      limit 1)
             end
        into v_actual
        from public.personas_nomina n
       where n.id = v_actual;

      v_pasos := v_pasos + 1;
    end loop;
  end if;

  update public.personas_nomina
     set lider_manual_id = v_jefe, lider_manual_fijado = true
   where id = v_persona;

  -- La jerarquia que usa el escalamiento, no solo la que se dibuja.
  if v_usuario_persona is not null then
    update public.usuarios
       set superior_id = v_usuario_jefe
     where id = v_usuario_persona
       and superior_id is distinct from v_usuario_jefe;
  end if;
end;
$$;

comment on function public.mover_en_organigrama(text, text) is
  'Cuelga a una persona de otra en el organigrama. Calidad y Direccion. Corta los ciclos y sincroniza usuarios.superior_id.';

create or replace function public.restaurar_lider_de_odoo(p_clave_persona text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_persona uuid;
begin
  if not (public.es_admin_sgc() or public.es_direccion()) then
    raise exception 'Solo Calidad o Direccion pueden mover el organigrama'
      using errcode = '42501';
  end if;

  v_persona := public.persona_del_padron(p_clave_persona);
  if v_persona is null then
    raise exception 'Esa persona no esta en el padron de la nomina' using errcode = 'P0002';
  end if;

  update public.personas_nomina
     set lider_manual_id = null, lider_manual_fijado = false
   where id = v_persona;
end;
$$;

comment on function public.restaurar_lider_de_odoo(text) is
  'Quita la correccion manual: la persona vuelve a colgar del gerente que declara Odoo.';

-- La traduccion de la clave es interna: la interfaz llama a las dos de
-- arriba, que ya comprueban quien es quien.
revoke execute on function public.persona_del_padron(text) from public, anon, authenticated;
grant execute on function public.mover_en_organigrama(text, text) to authenticated;
grant execute on function public.restaurar_lider_de_odoo(text) to authenticated;
