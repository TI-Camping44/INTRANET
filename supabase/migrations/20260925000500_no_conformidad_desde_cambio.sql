-- =====================================================================
-- Intranet - Camping 44 S.A.
-- Un cambio que fallo y se decide corregir abre su no conformidad
-- =====================================================================
-- El procedimiento dice que si el cambio no fue eficaz hay que decidir
-- entre ajuste, reversion o accion correctiva. Hasta ahora la tercera
-- quedaba anotada y nada mas, y una accion correctiva que existe solo
-- como palabra en un campo no tiene numero, ni plazo, ni responsable, ni
-- aparece en el listado donde Calidad mira lo que esta abierto.
--
-- SE RESUELVE EN LA BASE Y NO EN LA APLICACION, igual que con el hallazgo
-- de auditoria y por los mismos dos motivos: el correlativo y el vinculo
-- tienen que quedar consistentes aunque falle algo en el medio, y asi la
-- regla vale tambien si alguien cierra el cambio desde un script o desde
-- el panel de Supabase.
--
-- ES IDEMPOTENTE: si el cambio ya genero su no conformidad, devuelve la
-- que ya existe en vez de abrir una segunda. Cerrar dos veces por un
-- doble clic no puede terminar en dos NC con el mismo motivo.

create or replace function public.generar_no_conformidad_desde_cambio(
  p_cambio_id uuid,
  p_responsable_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cambio public.cambios%rowtype;
  v_codigo text;
  v_nc_id uuid;
  v_origen origen_no_conformidad;
  v_severidad severidad_no_conformidad;
begin
  select * into v_cambio from public.cambios where id = p_cambio_id;
  if not found then
    raise exception 'El cambio no existe';
  end if;

  -- Ya la genero: se devuelve la misma. No es un error.
  if v_cambio.no_conformidad_id is not null then
    return v_cambio.no_conformidad_id;
  end if;

  if v_cambio.resultado <> 'no_eficaz' or v_cambio.decision <> 'accion_correctiva' then
    raise exception 'Solo un cambio no eficaz cuya decision sea accion correctiva genera una NC';
  end if;

  -- La funcion ignora RLS por ser SECURITY DEFINER, asi que el control de
  -- quien puede va adentro. Cerrar el seguimiento es atribucion de
  -- Calidad, y esto es parte de cerrarlo.
  if not public.es_admin_sgc() then
    raise exception 'Generar la no conformidad de un cambio es atribución del Administrador SGC';
  end if;

  -- El origen se deriva del tipo de cambio: un cambio normativo que sale
  -- mal es un incumplimiento de requisitos legales, y el resto cae en
  -- incumplimiento de procesos. Calidad lo puede corregir despues; lo que
  -- no puede es quedar sin clasificar.
  v_origen := case
    when v_cambio.tipo = 'cambio_normativo' then 'requisito_legal'::origen_no_conformidad
    else 'proceso_interno'::origen_no_conformidad
  end;

  -- Un cambio fallido que tocaba material controlado expone la
  -- trazabilidad de la Ley 7411/2024: nace mayor. El resto nace menor y
  -- Calidad ajusta.
  v_severidad := case
    when v_cambio.afecta_material_controlado then 'mayor'::severidad_no_conformidad
    else 'menor'::severidad_no_conformidad
  end;

  v_codigo := public.siguiente_codigo_no_conformidad(v_cambio.empresa_id);

  -- El plazo de cierre NO se pasa: lo fija el disparador
  -- completar_no_conformidad() en cinco dias corridos desde la deteccion,
  -- que es la regla de Calidad y no se escribe a mano en ningun lado.
  insert into public.no_conformidades (
    empresa_id, codigo, titulo, descripcion, consecuencias, origen, severidad, estado,
    proceso_id, detectado_por, responsable_id, fecha_deteccion, creado_por
  ) values (
    v_cambio.empresa_id,
    v_codigo,
    left(v_cambio.codigo || ' · Cambio no eficaz: ' || v_cambio.titulo, 150),
    'El cambio ' || v_cambio.codigo || ' («' || v_cambio.titulo ||
      '») se implementó y su seguimiento dio NO EFICAZ. Calidad decidió abrir una acción correctiva.'
      || E'\n\nPropósito del cambio: ' || v_cambio.proposito
      || E'\n\nIndicador y criterio de éxito: ' || v_cambio.indicador_exito
      || ' / ' || v_cambio.criterio_exito
      || E'\n\nObservación del seguimiento: '
      || coalesce(v_cambio.seguimiento_observacion, 'sin observación registrada.'),
    -- Las consecuencias que se habian previsto son, justamente, las que
    -- hay que mirar ahora que el cambio fallo.
    v_cambio.consecuencias_potenciales,
    v_origen,
    v_severidad,
    'abierta',
    v_cambio.proceso_id,
    v_cambio.seguido_por,
    coalesce(p_responsable_id, v_cambio.responsable_id),
    coalesce(v_cambio.fecha_seguimiento, current_date),
    auth.uid()
  )
  returning id into v_nc_id;

  update public.cambios set no_conformidad_id = v_nc_id where id = p_cambio_id;

  return v_nc_id;
end;
$$;

comment on function public.generar_no_conformidad_desde_cambio is
  'Abre la no conformidad de un cambio cuyo seguimiento dio no eficaz y '
  'cuya decision fue accion correctiva, y la deja vinculada. Idempotente.';

grant execute on function public.generar_no_conformidad_desde_cambio(uuid, uuid) to authenticated;
