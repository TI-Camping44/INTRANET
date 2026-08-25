-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 018 · Numeracion correlativa de auditorias y hallazgos
-- =====================================================================
-- Mismo criterio que ya usan no conformidades (NC-AAAA-NNN) y riesgos
-- (R-AAAA-NNN): el correlativo lo resuelve la base de datos, para que dos
-- personas que dan de alta a la vez no reciban el mismo codigo.

create or replace function public.siguiente_codigo_auditoria(p_empresa_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anio text := to_char(now() at time zone 'America/Asuncion', 'YYYY');
  v_secuencia integer;
begin
  select coalesce(max(split_part(codigo, '-', 3)::integer), 0) + 1
    into v_secuencia
    from public.auditorias
   where empresa_id = p_empresa_id
     and codigo like 'AUD-' || v_anio || '-%'
     and split_part(codigo, '-', 3) ~ '^[0-9]+$';

  return 'AUD-' || v_anio || '-' || lpad(v_secuencia::text, 2, '0');
end;
$$;

grant execute on function public.siguiente_codigo_auditoria(uuid) to authenticated;

-- Hallazgos numerados dentro de cada auditoria: H-01, H-02, ...
create or replace function public.siguiente_codigo_hallazgo(p_auditoria_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secuencia integer;
begin
  select coalesce(max(substring(codigo from 3)::integer), 0) + 1
    into v_secuencia
    from public.auditoria_hallazgos
   where auditoria_id = p_auditoria_id
     and codigo ~ '^H-[0-9]+$';

  return 'H-' || lpad(v_secuencia::text, 2, '0');
end;
$$;

grant execute on function public.siguiente_codigo_hallazgo(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Un hallazgo genera su no conformidad en una sola operacion.
--
-- Se resuelve en la base y no en la aplicacion por dos motivos: el
-- correlativo y el vinculo tienen que quedar consistentes aunque falle
-- algo en el medio, y asi la regla vale tambien si la NC se genera desde
-- un script o desde el panel de Supabase.
-- ---------------------------------------------------------------------
create or replace function public.generar_no_conformidad_desde_hallazgo(
  p_hallazgo_id uuid,
  p_responsable_id uuid default null,
  p_fecha_limite date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hallazgo public.auditoria_hallazgos%rowtype;
  v_auditoria public.auditorias%rowtype;
  v_codigo text;
  v_nc_id uuid;
  v_severidad severidad_no_conformidad;
  v_titulo text;
begin
  select * into v_hallazgo from public.auditoria_hallazgos where id = p_hallazgo_id;
  if not found then
    raise exception 'El hallazgo no existe';
  end if;

  if v_hallazgo.no_conformidad_id is not null then
    raise exception 'El hallazgo ya generó la no conformidad %',
      (select codigo from public.no_conformidades where id = v_hallazgo.no_conformidad_id);
  end if;

  if v_hallazgo.tipo not in ('no_conformidad_mayor', 'no_conformidad_menor', 'observacion') then
    raise exception 'Solo los hallazgos de tipo no conformidad u observación generan una NC';
  end if;

  select * into v_auditoria from public.auditorias where id = v_hallazgo.auditoria_id;

  -- La severidad de la NC se deriva del tipo de hallazgo.
  v_severidad := case v_hallazgo.tipo
    when 'no_conformidad_mayor' then 'mayor'::severidad_no_conformidad
    when 'no_conformidad_menor' then 'menor'::severidad_no_conformidad
    else 'menor'::severidad_no_conformidad
  end;

  v_codigo := public.siguiente_codigo_no_conformidad(v_auditoria.empresa_id);

  -- El titulo se recorta: la descripcion completa del hallazgo va al
  -- cuerpo de la no conformidad.
  v_titulo := coalesce(v_hallazgo.codigo || ' · ', '') ||
              left(v_hallazgo.descripcion, 120) ||
              case when length(v_hallazgo.descripcion) > 120 then '…' else '' end;

  insert into public.no_conformidades (
    empresa_id, codigo, titulo, descripcion, origen, severidad, estado,
    proceso_id, sede_id, norma_id, requisito_incumplido, detectado_por,
    responsable_id, fecha_deteccion, fecha_limite_cierre, creado_por
  ) values (
    v_auditoria.empresa_id,
    v_codigo,
    v_titulo,
    v_hallazgo.descripcion ||
      case when v_hallazgo.evidencia is not null
           then E'\n\nEvidencia objetiva: ' || v_hallazgo.evidencia else '' end ||
      E'\n\nOrigen: auditoría ' || v_auditoria.codigo || '.',
    'auditoria_interna',
    v_severidad,
    'abierta',
    coalesce(v_hallazgo.proceso_id, v_auditoria.proceso_id),
    v_auditoria.sede_id,
    v_auditoria.norma_id,
    v_hallazgo.requisito,
    coalesce(v_hallazgo.registrado_por, v_auditoria.auditor_lider_id),
    p_responsable_id,
    coalesce(v_auditoria.fecha_fin, current_date),
    coalesce(p_fecha_limite, current_date + 30),
    auth.uid()
  )
  returning id into v_nc_id;

  update public.auditoria_hallazgos
     set no_conformidad_id = v_nc_id
   where id = p_hallazgo_id;

  return v_nc_id;
end;
$$;

grant execute on function public.generar_no_conformidad_desde_hallazgo(uuid, uuid, date)
  to authenticated;
