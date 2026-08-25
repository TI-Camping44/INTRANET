-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 020 · Satisfaccion del cliente: del detractor al reclamo formal
-- =====================================================================
-- Medir el NPS sin actuar sobre los detractores no cierra ningun ciclo.
-- Esta migracion agrega el vinculo entre una respuesta de encuesta y la
-- no conformidad que origina, con la misma logica que ya usa el modulo
-- de auditorias: la regla vive en la base y no en la aplicacion, para
-- que valga tambien si la escritura viene de un script o del panel de
-- Supabase.
--
-- Agrega ademas el correlativo de encuestas, que hasta ahora se cargaba
-- a mano en el seed.

alter table public.encuesta_respuestas
  add column if not exists no_conformidad_id uuid
    references public.no_conformidades (id) on delete set null;

create index if not exists encuesta_respuestas_nc_idx
  on public.encuesta_respuestas (no_conformidad_id)
  where no_conformidad_id is not null;

-- ---------------------------------------------------------------------
-- Correlativo de encuestas: ENC-01, ENC-02, ...
-- ---------------------------------------------------------------------
create or replace function public.siguiente_codigo_encuesta(p_empresa_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select 'ENC-' || lpad((coalesce(max(
           nullif(regexp_replace(codigo, '^ENC-', ''), '')::int
         ), 0) + 1)::text, 2, '0')
    from public.encuestas
   where empresa_id = p_empresa_id
     and codigo ~ '^ENC-[0-9]+$';
$$;

-- ---------------------------------------------------------------------
-- Genera la no conformidad a partir de una respuesta de encuesta.
--
-- Solo se admite para detractores: un puntaje de 7 o mas es una opinion
-- a tener en cuenta, no un incumplimiento. El comentario del cliente se
-- copia literal al cuerpo de la no conformidad, porque es la evidencia
-- objetiva del reclamo y reescribirlo la debilita.
-- ---------------------------------------------------------------------
create or replace function public.generar_no_conformidad_desde_respuesta(
  p_respuesta_id uuid,
  p_responsable_id uuid default null,
  p_fecha_limite date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_respuesta public.encuesta_respuestas%rowtype;
  v_encuesta  public.encuestas%rowtype;
  v_cliente   text;
  v_codigo    text;
  v_titulo    text;
  v_nc_id     uuid;
begin
  select * into v_respuesta from public.encuesta_respuestas where id = p_respuesta_id;
  if not found then
    raise exception 'La respuesta indicada no existe';
  end if;

  if v_respuesta.no_conformidad_id is not null then
    raise exception 'La respuesta ya generó la no conformidad %',
      (select codigo from public.no_conformidades where id = v_respuesta.no_conformidad_id);
  end if;

  if v_respuesta.categoria_nps <> 'detractor' then
    raise exception 'Solo las respuestas de clientes detractores (puntaje 0 a 6) generan una no conformidad';
  end if;

  if coalesce(btrim(v_respuesta.comentario), '') = '' then
    raise exception 'La respuesta no tiene comentario: sin el motivo del cliente no hay reclamo que tratar';
  end if;

  select * into v_encuesta from public.encuestas where id = v_respuesta.encuesta_id;

  select razon_social into v_cliente
    from public.clientes where id = v_respuesta.cliente_id;

  v_codigo := public.siguiente_codigo_no_conformidad(v_encuesta.empresa_id);

  -- El origen y el cliente ya tienen su columna en el listado: el titulo
  -- se reserva para lo unico que no se ve ahi, que es el motivo.
  v_titulo := 'Reclamo de ' || coalesce(v_cliente, 'cliente anónimo') || ': ' ||
              left(v_respuesta.comentario, 80) ||
              case when length(v_respuesta.comentario) > 80 then '…' else '' end;

  insert into public.no_conformidades (
    empresa_id, codigo, titulo, descripcion, origen, severidad, estado,
    sede_id, cliente_id, responsable_id, fecha_deteccion, fecha_limite_cierre,
    creado_por
  ) values (
    v_encuesta.empresa_id,
    v_codigo,
    v_titulo,
    'Comentario del cliente en la encuesta ' || v_encuesta.codigo ||
      ' (' || v_encuesta.nombre || '), puntaje ' || v_respuesta.puntaje || ' de 10:' ||
      E'\n\n«' || v_respuesta.comentario || '»' ||
      case when v_cliente is not null then E'\n\nCliente: ' || v_cliente else '' end ||
      case when v_respuesta.canal is not null then E'\nCanal de respuesta: ' || v_respuesta.canal else '' end,
    'reclamo_cliente',
    -- Un 0 a 3 es un cliente perdido; de 4 a 6, insatisfecho.
    case when v_respuesta.puntaje <= 3 then 'mayor'::severidad_no_conformidad
         else 'menor'::severidad_no_conformidad end,
    'abierta',
    v_respuesta.sede_id,
    v_respuesta.cliente_id,
    p_responsable_id,
    v_respuesta.fecha,
    coalesce(p_fecha_limite, current_date + 30),
    auth.uid()
  )
  returning id into v_nc_id;

  update public.encuesta_respuestas
     set no_conformidad_id = v_nc_id
   where id = p_respuesta_id;

  return v_nc_id;
end;
$$;

comment on function public.generar_no_conformidad_desde_respuesta is
  'Convierte el comentario de un cliente detractor en una no conformidad de origen reclamo_cliente.';
