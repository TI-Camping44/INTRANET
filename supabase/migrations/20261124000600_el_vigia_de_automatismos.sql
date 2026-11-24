-- ---------------------------------------------------------------------
-- Informática · El vigía de los automatismos
--
-- CONECTAR SCRIPT POR SCRIPT NO ESCALABA. La cuenta del Responsable de
-- TI tiene decenas de activadores en más de veinte proyectos de Apps
-- Script, varios de ellos dentro de planillas, y algunos fallaban en el
-- 100 % de sus corridas sin que nadie se enterara. Pegar el aviso en
-- cada uno era tocar código en producción proyecto por proyecto.
--
-- En lugar de eso, un solo script —«TI · Vigía de automatismos»— lee
-- cada hora las ejecuciones de la cuenta con la API de Apps Script
-- (`processes.list`, lo mismo que la pantalla «Mis ejecuciones») y las
-- manda acá con `registrar_ejecuciones()`. Ningún otro proyecto se toca.
--
-- Cada ejecución trae su hora real y su resultado (terminada, con error,
-- tiempo agotado), así que el latido se guarda con la hora de la
-- ejecución y no con la del envío, y la misma ejecución mandada dos
-- veces no se duplica: hay un índice único por automatismo y hora.
--
-- Un automatismo que no existía se crea solo, con la frecuencia que el
-- vigía deduce del intervalo entre sus corridas y con el responsable que
-- manda el vigía (el dueño de la cuenta). Si ya tiene frecuencia, no se
-- la pisa: puede haberla corregido una persona.
--
-- Lo que la API no da es el mensaje de error: solo el estado. Para el
-- detalle hay que abrir «Mis ejecuciones» en Apps Script.
-- ---------------------------------------------------------------------

create unique index if not exists automatismo_latidos_unico
  on public.automatismo_latidos (automatismo_id, en);

create or replace function public.registrar_ejecuciones(
  p_secreto text,
  p_ejecuciones jsonb,
  p_responsable_correo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_empresa uuid;
  v_responsable uuid;
  v_creados integer := 0;
  v_latidos integer := 0;
  v_fila jsonb;
  v_clave text;
  v_id uuid;
  v_insertadas integer;
begin
  select hash_secreto into v_hash
    from public.secretos_de_integracion
   where nombre = 'automatismos_ti';

  if v_hash is null
     or p_secreto is null
     or encode(sha256(convert_to(p_secreto, 'UTF8')), 'hex') <> v_hash then
    raise exception 'Secreto de integración inválido.' using errcode = '28000';
  end if;

  if jsonb_typeof(p_ejecuciones) <> 'array' then
    raise exception 'Se esperaba una lista de ejecuciones.';
  end if;

  select id into v_empresa from public.empresas order by creado_en limit 1;
  select id into v_responsable from public.usuarios
   where lower(correo) = lower(trim(coalesce(p_responsable_correo, '')));

  for v_fila in select * from jsonb_array_elements(p_ejecuciones) loop
    v_clave := lower(trim(coalesce(v_fila->>'clave', '')));
    continue when v_clave !~ '^[a-z0-9][a-z0-9._-]{2,79}$';

    insert into public.automatismos_ti
      (empresa_id, clave, nombre, donde_vive, descripcion, frecuencia_horas, responsable_id)
    values (
      v_empresa, v_clave,
      left(coalesce(nullif(trim(v_fila->>'nombre'), ''), v_clave), 160),
      nullif(trim(v_fila->>'donde_vive'), ''),
      'Lo controla el vigía de automatismos: el estado sale de «Mis ejecuciones» de Apps Script.',
      case when (v_fila->>'frecuencia_horas') ~ '^[0-9]+$'
           then least(greatest((v_fila->>'frecuencia_horas')::integer, 1), 8784) end,
      v_responsable
    )
    on conflict (empresa_id, clave) do nothing;
    get diagnostics v_insertadas = row_count;
    v_creados := v_creados + v_insertadas;

    select id into v_id from public.automatismos_ti
     where empresa_id = v_empresa and clave = v_clave;

    -- La frecuencia deducida solo completa la que falta.
    if (v_fila->>'frecuencia_horas') ~ '^[0-9]+$' then
      update public.automatismos_ti
         set frecuencia_horas = least(greatest((v_fila->>'frecuencia_horas')::integer, 1), 8784)
       where id = v_id and frecuencia_horas is null;
    end if;

    continue when nullif(v_fila->>'en', '') is null;

    insert into public.automatismo_latidos (automatismo_id, en, resultado, mensaje, duracion_segundos)
    values (
      v_id,
      (v_fila->>'en')::timestamptz,
      case when v_fila->>'resultado' = 'error' then 'error' else 'ok' end,
      left(nullif(trim(v_fila->>'mensaje'), ''), 2000),
      case when (v_fila->>'duracion_segundos') ~ '^[0-9.]+$'
           then (v_fila->>'duracion_segundos')::numeric end
    )
    on conflict (automatismo_id, en) do nothing;
    get diagnostics v_insertadas = row_count;
    v_latidos := v_latidos + v_insertadas;
  end loop;

  delete from public.automatismo_latidos where en < now() - interval '60 days';

  return jsonb_build_object('creados', v_creados, 'latidos', v_latidos, 'en', now());
end;
$$;

revoke all on function public.registrar_ejecuciones(text, jsonb, text) from public;
grant execute on function public.registrar_ejecuciones(text, jsonb, text) to anon, authenticated;

comment on function public.registrar_ejecuciones(text, jsonb, text) is
  'La llama el vigía de automatismos con las ejecuciones de Apps Script de la cuenta de TI. '
  'Protegida por el secreto automatismos_ti.';

-- Los seis que se cargaron el mismo día a partir de un relevamiento de
-- septiembre, con claves inventadas y sin ningún aviso: el vigía los va a
-- crear con su proyecto y su función reales, así que se retiran para que
-- no queden dos filas del mismo script, una de ellas eternamente «sin
-- conectar».
delete from public.automatismos_ti a
 where a.clave in (
   'facturas.problemas-envio-vitalica', 'facturas.problemas-envio-camping44',
   'logistica.tareas-fuera-de-plazo', 'administracion.resumen-semanal',
   'creditos.refresco-motor-b2c', 'cobranzas.reporte'
 )
   and not exists (select 1 from public.automatismo_latidos l where l.automatismo_id = a.id);
