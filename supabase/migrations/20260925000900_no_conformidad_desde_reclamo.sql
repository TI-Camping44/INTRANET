-- =====================================================================
-- Intranet - Camping 44 S.A.
-- Reclamos de Clientes: la no conformidad del Plan C
-- =====================================================================
-- Un reclamo clasificado como FALLA GRAVE abre no conformidad POR
-- DEFINICION, no por decision: lo dice el MP-EST-04. Se hace al definir
-- el plan, que es el momento en que el procedimiento pide el analisis de
-- causa, y queda vinculada al caso en los dos sentidos.
--
-- Va en la base y no en la aplicacion por tres razones:
--
--   1. Es UNA operacion: crear la desviacion con su codigo correlativo y
--      dejar el vinculo. Partida en dos llamadas desde la aplicacion, un
--      corte en el medio deja una no conformidad huerfana.
--   2. Es IDEMPOTENTE: si el reclamo ya tiene su no conformidad,
--      devuelve la que hay. Un doble clic no abre dos desviaciones.
--   3. El disparador de bitacora registra igual la escritura, porque
--      ningun camino la evade.
--
-- Es `security definer` para poder escribir el correlativo, y por eso
-- comprueba `puede_gestionar()` adentro: sin esa linea cualquiera podria
-- abrir una no conformidad llamando a la funcion.
-- ---------------------------------------------------------------------

create or replace function public.generar_no_conformidad_desde_reclamo(p_reclamo_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reclamo public.reclamos%rowtype;
  v_codigo text;
  v_nc_id uuid;
  v_origen origen_no_conformidad;
begin
  select * into v_reclamo from public.reclamos where id = p_reclamo_id;
  if not found then
    raise exception 'El reclamo no existe';
  end if;

  -- Ya la tiene: se devuelve la que hay. Esto es lo que hace que un
  -- segundo intento no abra una desviacion repetida.
  if v_reclamo.no_conformidad_id is not null then
    return v_reclamo.no_conformidad_id;
  end if;

  if v_reclamo.plan <> 'c' then
    raise exception 'Solo un reclamo de Plan C abre no conformidad automatica';
  end if;

  if not public.puede_gestionar() then
    raise exception 'No tiene permiso para abrir la no conformidad de un reclamo';
  end if;

  -- EL ORIGEN NO ES SIEMPRE «reclamo de cliente». Un error en un tramite
  -- ante la DIGEMABEL o en material controlado es un incumplimiento
  -- legal, y un producto defectuoso de origen es del proveedor. Que la
  -- desviacion quede clasificada donde corresponde es lo que permite
  -- despues contar por origen sin tener que releer cada caso.
  v_origen := case
    when v_reclamo.tipo_falla = 'tramite_regulatorio' or v_reclamo.material_controlado
      then 'requisito_legal'::origen_no_conformidad
    when v_reclamo.tipo_falla = 'producto_defectuoso_proveedor'
      then 'proveedor'::origen_no_conformidad
    else 'reclamo_cliente'::origen_no_conformidad
  end;

  v_codigo := public.siguiente_codigo_no_conformidad(v_reclamo.empresa_id);

  insert into public.no_conformidades (
    empresa_id, codigo, titulo, descripcion, consecuencias, origen, severidad, estado,
    detectado_por, responsable_id, fecha_deteccion, creado_por
  ) values (
    v_reclamo.empresa_id,
    v_codigo,
    left(v_reclamo.codigo || ' · Falla grave: ' || v_reclamo.titulo, 150),
    'Abierta automaticamente por el reclamo ' || v_reclamo.codigo ||
      ' («' || v_reclamo.titulo || '»), clasificado como falla GRAVE (Plan C).'
      || E'\n\nCliente: ' || v_reclamo.cliente_nombre
      || E'\n\nQue ocurrio: ' || v_reclamo.descripcion
      || case when v_reclamo.material_controlado
              then E'\n\nInvolucra MATERIAL CONTROLADO: verificar la trazabilidad conforme a la Ley N° 7411/2024.'
              else '' end
      || case when v_reclamo.es_reincidencia
              then E'\n\nEs REINCIDENCIA: segunda falla al mismo cliente en seis meses.'
              else '' end,
    'Perjuicio al cliente por una falla grave. Ver el reclamo ' || v_reclamo.codigo ||
      ' para el detalle del plan de atencion y la compensacion.',
    v_origen,
    -- «Mayor» y no «critica»: esa severidad no existe en Camping 44.
    'mayor'::severidad_no_conformidad,
    'abierta',
    -- Lo detecto quien gestiona el caso; responde el area donde se
    -- origino la falla. Es la misma separacion que pide el procedimiento
    -- para el contacto con el cliente.
    v_reclamo.gestor_id,
    v_reclamo.responsable_area_id,
    v_reclamo.fecha_deteccion,
    auth.uid()
  )
  returning id into v_nc_id;

  update public.reclamos set no_conformidad_id = v_nc_id where id = p_reclamo_id;

  return v_nc_id;
end;
$$;

comment on function public.generar_no_conformidad_desde_reclamo is
  'Abre la no conformidad de un reclamo de Plan C (falla grave) y la deja '
  'vinculada. Idempotente.';

grant execute on function public.generar_no_conformidad_desde_reclamo(uuid) to authenticated;
