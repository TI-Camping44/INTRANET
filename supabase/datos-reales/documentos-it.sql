-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- DATOS REALES · Juego documental de TI
-- =====================================================================
-- Los diez documentos de Tecnologia de la Informacion vigentes de
-- Camping 44, con su codigo real y el enlace al archivo en Drive.
--
-- No se copia el contenido: la intranet indexa y enlaza. El archivo
-- vigente sigue siendo el del Drive, y cuando Calidad lo actualiza ahi,
-- la ficha muestra lo nuevo sin intervencion.
--
-- La codificacion es la de Camping 44: <TIPO>-<AREA>-<NN>, donde el
-- correlativo es unico dentro del area sin importar el tipo.
--
-- Se aplica DESPUES del seed (necesita empresa y un usuario responsable).
-- Es idempotente.

do $$
declare
  v_empresa uuid;
  v_responsable uuid;
  v_proceso uuid;
  v_norma uuid;
  -- Fecha de la ultima actualizacion de los archivos en Drive.
  v_vigencia constant date := date '2026-03-31';
begin
  select id into v_empresa from public.empresas order by creado_en limit 1;
  if v_empresa is null then
    raise exception 'No hay ninguna empresa cargada. Aplique el seed primero.';
  end if;

  -- El responsable definitivo es el Responsable IT. Mientras su legajo no
  -- exista, queda a cargo del Administrador SGC: la columna no admite
  -- nulos, y dejar el documento sin dueno seria peor que asignarlo
  -- provisoriamente a Calidad.
  select id into v_responsable from public.usuarios
   where empresa_id = v_empresa and rol = 'administrador_sgc' and activo
   order by creado_en limit 1;

  if v_responsable is null then
    select id into v_responsable from public.usuarios
     where empresa_id = v_empresa and activo order by creado_en limit 1;
  end if;

  if v_responsable is null then
    raise exception 'No hay usuarios cargados: no se puede asignar responsable.';
  end if;

  select id into v_proceso from public.procesos
   where empresa_id = v_empresa and nombre ilike '%tecnolog%' limit 1;
  select id into v_norma from public.normas limit 1;

  insert into public.documentos (
    empresa_id, codigo, titulo, tipo, estado, proceso_id, norma_id,
    responsable_id, elaborador_id, version_actual,
    fecha_aprobacion, fecha_vigencia, fecha_proxima_revision,
    periodicidad_revision_meses, url_documento
  ) values
  (v_empresa, 'POL-IT-01', 'Política de Seguridad Informática', 'politica', 'vigente',
   v_proceso, v_norma, v_responsable, v_responsable, 1,
   v_vigencia, v_vigencia, v_vigencia + interval '12 months', 12,
   'https://docs.google.com/document/d/1U-Z1D9Nv_VaJLgGB8sVgAyopkQhPfxsl40ePIOyYVw4/edit'),

  (v_empresa, 'PROC-IT-02', 'Procedimiento de Gestión de Accesos y Usuarios', 'procedimiento', 'vigente',
   v_proceso, v_norma, v_responsable, v_responsable, 1,
   v_vigencia, v_vigencia, v_vigencia + interval '12 months', 12,
   'https://docs.google.com/document/d/1bQvc64iL-9YZfmao6tgwgMh0PoNpZQ9EQVmmF7V3sfM/edit'),

  (v_empresa, 'PROC-IT-03', 'Procedimiento de Respaldo y Recuperación de Datos', 'procedimiento', 'vigente',
   v_proceso, v_norma, v_responsable, v_responsable, 1,
   v_vigencia, v_vigencia, v_vigencia + interval '12 months', 12,
   'https://docs.google.com/document/d/1m2qqbWr7W5cdNTTN7wUU_WPAY5TDANMQpseuAak3Pzs/edit'),

  (v_empresa, 'PLAN-IT-04', 'Plan de Contingencia Informática', 'plan', 'vigente',
   v_proceso, v_norma, v_responsable, v_responsable, 1,
   v_vigencia, v_vigencia, v_vigencia + interval '12 months', 12,
   'https://docs.google.com/document/d/1TPMUhU9QUKNCH6PTfn9cE2pyOzWbNoSxe91QZMn673M/edit'),

  (v_empresa, 'POL-IT-05', 'Política de Uso de Equipos y Celulares Corporativos', 'politica', 'vigente',
   v_proceso, v_norma, v_responsable, v_responsable, 1,
   v_vigencia, v_vigencia, v_vigencia + interval '12 months', 12,
   'https://docs.google.com/document/d/1lfbghseL9gbMIAyP5U5rlMxZVdL5wFmZ-32E6xBxePU/edit'),

  (v_empresa, 'PROC-IT-06', 'Procedimiento de Gestión de Incidentes Informáticos', 'procedimiento', 'vigente',
   v_proceso, v_norma, v_responsable, v_responsable, 1,
   v_vigencia, v_vigencia, v_vigencia + interval '12 months', 12,
   'https://docs.google.com/document/d/11sSsZlns7W_sZ2GtM3s1-ExQBhW8eTeozFYcQc4JZI8/edit'),

  (v_empresa, 'PROC-IT-07', 'Procedimiento de Control de Accesos Físicos', 'procedimiento', 'vigente',
   v_proceso, v_norma, v_responsable, v_responsable, 1,
   v_vigencia, v_vigencia, v_vigencia + interval '12 months', 12,
   'https://docs.google.com/document/d/1jlpebNqN8m6K-CTD06tPCZ6iXEzMbRiziywNgSFn7Ao/edit'),

  (v_empresa, 'PROC-IT-08', 'Procedimiento de Gestión Documental', 'procedimiento', 'vigente',
   v_proceso, v_norma, v_responsable, v_responsable, 1,
   v_vigencia, v_vigencia, v_vigencia + interval '12 months', 12,
   'https://docs.google.com/document/d/1Lez3_80a4hrXsJFunuwWITZVxU09KJMTioPkCWmRM14/edit'),

  (v_empresa, 'PROC-IT-09', 'Procedimiento de Protección de la Información', 'procedimiento', 'vigente',
   v_proceso, v_norma, v_responsable, v_responsable, 1,
   v_vigencia, v_vigencia, v_vigencia + interval '12 months', 12,
   'https://docs.google.com/document/d/1QCTX52Myxu1dDRnHbiwRE1W9TgEyxiBjvASvXI5g_Qg/edit'),

  (v_empresa, 'PROC-IT-10', 'Procedimiento de Comunicación de Incidentes', 'procedimiento', 'vigente',
   v_proceso, v_norma, v_responsable, v_responsable, 1,
   v_vigencia, v_vigencia, v_vigencia + interval '12 months', 12,
   'https://docs.google.com/document/d/1Ll3srt-bilpF2o9efdCc1nyMaGnrdldNEKzr7nZSkRA/edit')

  on conflict (empresa_id, upper(codigo)) do update set
    titulo = excluded.titulo,
    tipo = excluded.tipo,
    estado = excluded.estado,
    fecha_vigencia = excluded.fecha_vigencia,
    fecha_proxima_revision = excluded.fecha_proxima_revision,
    url_documento = excluded.url_documento;
end;
$$;
