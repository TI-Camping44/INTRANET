-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 013 · Politicas RLS por rol
-- =====================================================================
-- RLS activo en TODAS las tablas, sin excepcion.
-- Criterio general:
--   · Todo registro esta acotado a la empresa del usuario.
--   · Administrador SGC   -> control total.
--   · Responsable Proceso -> escribe sobre lo suyo, lee todo.
--   · Colaborador         -> lee documentacion vigente, registra desviaciones.
--   · Auditor             -> lectura amplia, escritura en auditorias.
--   · Direccion           -> solo lectura.

-- ---------------------------------------------------------------------
-- Habilitacion de RLS
-- ---------------------------------------------------------------------
do $$
declare
  v_tabla text;
begin
  for v_tabla in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', v_tabla);
  end loop;
end;
$$;

-- La aplicacion solo opera con el rol "authenticated"; "anon" no lee nada.
do $$
declare
  v_tabla text;
begin
  for v_tabla in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('revoke all on public.%I from anon', v_tabla);
    execute format('grant select, insert, update, delete on public.%I to authenticated', v_tabla);
  end loop;
end;
$$;

revoke all on public.vista_indicadores_looker from anon;
grant select on public.vista_indicadores_looker to authenticated;

-- ---------------------------------------------------------------------
-- Tablas de configuracion general
-- ---------------------------------------------------------------------
create policy "empresas_lectura" on public.empresas
  for select to authenticated
  using (id = public.empresa_actual());

create policy "empresas_administracion" on public.empresas
  for all to authenticated
  using (public.es_admin_sgc() and id = public.empresa_actual())
  with check (public.es_admin_sgc() and id = public.empresa_actual());

create policy "sedes_lectura" on public.sedes
  for select to authenticated using (public.misma_empresa(empresa_id));
create policy "sedes_administracion" on public.sedes
  for all to authenticated
  using (public.es_admin_sgc() and public.misma_empresa(empresa_id))
  with check (public.es_admin_sgc() and public.misma_empresa(empresa_id));

create policy "normas_lectura" on public.normas
  for select to authenticated using (true);
create policy "normas_administracion" on public.normas
  for all to authenticated
  using (public.es_admin_sgc()) with check (public.es_admin_sgc());

create policy "procesos_lectura" on public.procesos
  for select to authenticated using (public.misma_empresa(empresa_id));
create policy "procesos_administracion" on public.procesos
  for all to authenticated
  using (public.es_admin_sgc() and public.misma_empresa(empresa_id))
  with check (public.es_admin_sgc() and public.misma_empresa(empresa_id));

create policy "puestos_lectura" on public.puestos
  for select to authenticated using (public.misma_empresa(empresa_id));
create policy "puestos_administracion" on public.puestos
  for all to authenticated
  using (public.es_admin_sgc() and public.misma_empresa(empresa_id))
  with check (public.es_admin_sgc() and public.misma_empresa(empresa_id));

-- ---------------------------------------------------------------------
-- Usuarios
-- ---------------------------------------------------------------------
create policy "usuarios_lectura" on public.usuarios
  for select to authenticated
  using (public.misma_empresa(empresa_id) or id = auth.uid());

create policy "usuarios_actualiza_propio" on public.usuarios
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "usuarios_administracion" on public.usuarios
  for all to authenticated
  using (public.es_admin_sgc() and public.misma_empresa(empresa_id))
  with check (public.es_admin_sgc() and public.misma_empresa(empresa_id));

-- Un usuario puede editar su perfil, pero no su propio rol ni su empresa:
-- eso queda reservado al Administrador SGC.
create or replace function public.proteger_campos_criticos_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sin sesion de usuario (clave de servicio, migraciones, seed o el
  -- trabajo programado) la operacion ya es de confianza. Este control
  -- existe para impedir que una persona se eleve el rol editando su
  -- propio perfil desde la aplicacion.
  if auth.uid() is null or public.es_admin_sgc() then
    return new;
  end if;

  if new.rol is distinct from old.rol
     or new.empresa_id is distinct from old.empresa_id
     or new.superior_id is distinct from old.superior_id
     or new.activo is distinct from old.activo then
    raise exception 'Solo el Administrador SGC puede modificar rol, empresa, superior o estado'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger usuarios_proteger_campos
  before update on public.usuarios
  for each row execute function public.proteger_campos_criticos_usuario();

-- ---------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------
create policy "clientes_lectura" on public.clientes
  for select to authenticated using (public.misma_empresa(empresa_id));
create policy "clientes_gestion" on public.clientes
  for all to authenticated
  using (public.puede_gestionar() and public.misma_empresa(empresa_id))
  with check (public.puede_gestionar() and public.misma_empresa(empresa_id));

-- ---------------------------------------------------------------------
-- Modulo 1 · Documentos
-- ---------------------------------------------------------------------
-- El colaborador solo ve documentacion vigente; quienes intervienen en el
-- flujo ven tambien los borradores y las versiones en revision.
-- La condicion vive en public.puede_ver_documento (migracion 012) para
-- evitar la recursion entre las politicas de las tablas del modulo.
create policy "documentos_lectura" on public.documentos
  for select to authenticated
  using (
    public.misma_empresa(empresa_id)
    and (
      estado = 'vigente'
      or public.es_admin_sgc()
      or public.es_auditor()
      or public.es_direccion()
      or responsable_id = auth.uid()
      or elaborador_id = auth.uid()
      or aprobador_id = auth.uid()
      or creado_por = auth.uid()
      or public.es_responsable_de_proceso(proceso_id)
      or public.es_revisor_de_documento(id)
    )
  );

create policy "documentos_alta" on public.documentos
  for insert to authenticated
  with check (public.puede_gestionar() and public.misma_empresa(empresa_id));

create policy "documentos_edicion" on public.documentos
  for update to authenticated
  using (
    public.misma_empresa(empresa_id)
    and (public.es_admin_sgc()
         or responsable_id = auth.uid()
         or elaborador_id = auth.uid()
         or public.es_responsable_de_proceso(proceso_id))
  )
  with check (public.misma_empresa(empresa_id));

create policy "documentos_baja" on public.documentos
  for delete to authenticated
  using (public.es_admin_sgc() and public.misma_empresa(empresa_id));

-- Las tablas hijas heredan la visibilidad del documento.
create policy "documento_versiones_lectura" on public.documento_versiones
  for select to authenticated
  using (public.puede_ver_documento(documento_id));

create policy "documento_versiones_gestion" on public.documento_versiones
  for all to authenticated
  using (public.puede_gestionar_documento(documento_id))
  with check (public.puede_gestionar_documento(documento_id));

create policy "documento_revisores_lectura" on public.documento_revisores
  for select to authenticated
  using (
    usuario_id = auth.uid()
    or public.puede_ver_documento(public.documento_de_version(version_id))
  );

-- El revisor responde su propia revision; Calidad administra la asignacion.
create policy "documento_revisores_responde" on public.documento_revisores
  for update to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

create policy "documento_revisores_gestion" on public.documento_revisores
  for all to authenticated
  using (public.puede_gestionar_documento(public.documento_de_version(version_id)))
  with check (public.puede_gestionar_documento(public.documento_de_version(version_id)));

create policy "documento_difusion_lectura" on public.documento_difusion
  for select to authenticated
  using (public.puede_ver_documento(documento_id));

create policy "documento_difusion_gestion" on public.documento_difusion
  for all to authenticated
  using (public.puede_gestionar_documento(documento_id))
  with check (public.puede_gestionar_documento(documento_id));

-- ---------------------------------------------------------------------
-- Modulo 2 · No conformidades
-- ---------------------------------------------------------------------
-- Cualquier colaborador puede registrar una desviacion: es el mecanismo
-- de deteccion del sistema y restringirlo lo dejaria sin uso real.
create policy "no_conformidades_lectura" on public.no_conformidades
  for select to authenticated using (public.misma_empresa(empresa_id));

create policy "no_conformidades_alta" on public.no_conformidades
  for insert to authenticated
  with check (public.misma_empresa(empresa_id) and not public.es_direccion());

create policy "no_conformidades_edicion" on public.no_conformidades
  for update to authenticated
  using (
    public.misma_empresa(empresa_id)
    and (public.es_admin_sgc()
         or responsable_id = auth.uid()
         or detectado_por = auth.uid()
         or public.es_responsable_de_proceso(proceso_id))
  )
  with check (public.misma_empresa(empresa_id));

create policy "no_conformidades_baja" on public.no_conformidades
  for delete to authenticated
  using (public.es_admin_sgc() and public.misma_empresa(empresa_id));

create policy "nc_porques_lectura" on public.nc_porques
  for select to authenticated
  using (exists (select 1 from public.no_conformidades n where n.id = no_conformidad_id));
create policy "nc_porques_gestion" on public.nc_porques
  for all to authenticated
  using (exists (
    select 1 from public.no_conformidades n
     where n.id = no_conformidad_id
       and (public.es_admin_sgc() or n.responsable_id = auth.uid()
            or n.detectado_por = auth.uid()
            or public.es_responsable_de_proceso(n.proceso_id))))
  with check (exists (
    select 1 from public.no_conformidades n
     where n.id = no_conformidad_id
       and (public.es_admin_sgc() or n.responsable_id = auth.uid()
            or n.detectado_por = auth.uid()
            or public.es_responsable_de_proceso(n.proceso_id))));

create policy "nc_ishikawa_lectura" on public.nc_ishikawa
  for select to authenticated
  using (exists (select 1 from public.no_conformidades n where n.id = no_conformidad_id));
create policy "nc_ishikawa_gestion" on public.nc_ishikawa
  for all to authenticated
  using (exists (
    select 1 from public.no_conformidades n
     where n.id = no_conformidad_id
       and (public.es_admin_sgc() or n.responsable_id = auth.uid()
            or n.detectado_por = auth.uid()
            or public.es_responsable_de_proceso(n.proceso_id))))
  with check (exists (
    select 1 from public.no_conformidades n
     where n.id = no_conformidad_id
       and (public.es_admin_sgc() or n.responsable_id = auth.uid()
            or n.detectado_por = auth.uid()
            or public.es_responsable_de_proceso(n.proceso_id))));

create policy "nc_acciones_lectura" on public.nc_acciones
  for select to authenticated
  using (exists (select 1 from public.no_conformidades n where n.id = no_conformidad_id));

-- El responsable de una accion puede actualizar su avance.
create policy "nc_acciones_responsable" on public.nc_acciones
  for update to authenticated
  using (responsable_id = auth.uid())
  with check (responsable_id = auth.uid());

create policy "nc_acciones_gestion" on public.nc_acciones
  for all to authenticated
  using (exists (
    select 1 from public.no_conformidades n
     where n.id = no_conformidad_id
       and (public.es_admin_sgc() or n.responsable_id = auth.uid()
            or public.es_responsable_de_proceso(n.proceso_id))))
  with check (exists (
    select 1 from public.no_conformidades n
     where n.id = no_conformidad_id
       and (public.es_admin_sgc() or n.responsable_id = auth.uid()
            or public.es_responsable_de_proceso(n.proceso_id))));

-- ---------------------------------------------------------------------
-- Modulo 3 · Riesgos
-- ---------------------------------------------------------------------
create policy "riesgos_lectura" on public.riesgos
  for select to authenticated using (public.misma_empresa(empresa_id));
create policy "riesgos_alta" on public.riesgos
  for insert to authenticated
  with check (public.puede_gestionar() and public.misma_empresa(empresa_id));
create policy "riesgos_edicion" on public.riesgos
  for update to authenticated
  using (
    public.misma_empresa(empresa_id)
    and (public.es_admin_sgc()
         or responsable_id = auth.uid()
         or public.es_responsable_de_proceso(proceso_id))
  )
  with check (public.misma_empresa(empresa_id));
create policy "riesgos_baja" on public.riesgos
  for delete to authenticated
  using (public.es_admin_sgc() and public.misma_empresa(empresa_id));

create policy "riesgo_acciones_lectura" on public.riesgo_acciones
  for select to authenticated
  using (exists (select 1 from public.riesgos r where r.id = riesgo_id));
create policy "riesgo_acciones_gestion" on public.riesgo_acciones
  for all to authenticated
  using (public.puede_gestionar() or responsable_id = auth.uid())
  with check (public.puede_gestionar() or responsable_id = auth.uid());

create policy "riesgo_evaluaciones_lectura" on public.riesgo_evaluaciones
  for select to authenticated
  using (exists (select 1 from public.riesgos r where r.id = riesgo_id));
create policy "riesgo_evaluaciones_gestion" on public.riesgo_evaluaciones
  for all to authenticated
  using (public.puede_gestionar()) with check (public.puede_gestionar());

-- ---------------------------------------------------------------------
-- Modulo 4 · Auditorias
-- ---------------------------------------------------------------------
create policy "programas_auditoria_lectura" on public.programas_auditoria
  for select to authenticated using (public.misma_empresa(empresa_id));
create policy "programas_auditoria_gestion" on public.programas_auditoria
  for all to authenticated
  using ((public.es_admin_sgc() or public.es_auditor()) and public.misma_empresa(empresa_id))
  with check ((public.es_admin_sgc() or public.es_auditor()) and public.misma_empresa(empresa_id));

create policy "auditorias_lectura" on public.auditorias
  for select to authenticated using (public.misma_empresa(empresa_id));
create policy "auditorias_gestion" on public.auditorias
  for all to authenticated
  using ((public.es_admin_sgc() or public.es_auditor()) and public.misma_empresa(empresa_id))
  with check ((public.es_admin_sgc() or public.es_auditor()) and public.misma_empresa(empresa_id));

create policy "auditoria_equipo_lectura" on public.auditoria_equipo
  for select to authenticated
  using (exists (select 1 from public.auditorias a where a.id = auditoria_id));
create policy "auditoria_equipo_gestion" on public.auditoria_equipo
  for all to authenticated
  using (public.es_admin_sgc() or public.es_auditor())
  with check (public.es_admin_sgc() or public.es_auditor());

create policy "auditoria_hallazgos_lectura" on public.auditoria_hallazgos
  for select to authenticated
  using (exists (select 1 from public.auditorias a where a.id = auditoria_id));
create policy "auditoria_hallazgos_gestion" on public.auditoria_hallazgos
  for all to authenticated
  using (public.es_admin_sgc() or public.es_auditor())
  with check (public.es_admin_sgc() or public.es_auditor());

-- ---------------------------------------------------------------------
-- Modulo 5 · Indicadores y objetivos
-- ---------------------------------------------------------------------
create policy "indicadores_lectura" on public.indicadores
  for select to authenticated using (public.misma_empresa(empresa_id));
create policy "indicadores_gestion" on public.indicadores
  for all to authenticated
  using (public.puede_gestionar() and public.misma_empresa(empresa_id))
  with check (public.puede_gestionar() and public.misma_empresa(empresa_id));

create policy "indicador_mediciones_lectura" on public.indicador_mediciones
  for select to authenticated
  using (exists (select 1 from public.indicadores i where i.id = indicador_id));
create policy "indicador_mediciones_gestion" on public.indicador_mediciones
  for all to authenticated
  using (exists (
    select 1 from public.indicadores i
     where i.id = indicador_id
       and (public.es_admin_sgc() or i.responsable_id = auth.uid()
            or public.es_responsable_de_proceso(i.proceso_id))))
  with check (exists (
    select 1 from public.indicadores i
     where i.id = indicador_id
       and (public.es_admin_sgc() or i.responsable_id = auth.uid()
            or public.es_responsable_de_proceso(i.proceso_id))));

create policy "objetivos_lectura" on public.objetivos
  for select to authenticated using (public.misma_empresa(empresa_id));
create policy "objetivos_gestion" on public.objetivos
  for all to authenticated
  using (public.puede_gestionar() and public.misma_empresa(empresa_id))
  with check (public.puede_gestionar() and public.misma_empresa(empresa_id));

create policy "objetivo_indicadores_lectura" on public.objetivo_indicadores
  for select to authenticated
  using (exists (select 1 from public.objetivos o where o.id = objetivo_id));
create policy "objetivo_indicadores_gestion" on public.objetivo_indicadores
  for all to authenticated
  using (public.puede_gestionar()) with check (public.puede_gestionar());

-- ---------------------------------------------------------------------
-- Modulo 6 · Satisfaccion del cliente
-- ---------------------------------------------------------------------
create policy "encuestas_lectura" on public.encuestas
  for select to authenticated using (public.misma_empresa(empresa_id));
create policy "encuestas_gestion" on public.encuestas
  for all to authenticated
  using (public.puede_gestionar() and public.misma_empresa(empresa_id))
  with check (public.puede_gestionar() and public.misma_empresa(empresa_id));

create policy "encuesta_respuestas_lectura" on public.encuesta_respuestas
  for select to authenticated
  using (exists (select 1 from public.encuestas e where e.id = encuesta_id));
create policy "encuesta_respuestas_gestion" on public.encuesta_respuestas
  for all to authenticated
  using (public.puede_gestionar()) with check (public.puede_gestionar());

-- ---------------------------------------------------------------------
-- Modulo 7 · Recursos humanos
-- ---------------------------------------------------------------------
create policy "competencias_lectura" on public.competencias
  for select to authenticated using (public.misma_empresa(empresa_id));
create policy "competencias_gestion" on public.competencias
  for all to authenticated
  using (public.es_admin_sgc() and public.misma_empresa(empresa_id))
  with check (public.es_admin_sgc() and public.misma_empresa(empresa_id));

create policy "puesto_competencias_lectura" on public.puesto_competencias
  for select to authenticated
  using (exists (select 1 from public.puestos p where p.id = puesto_id));
create policy "puesto_competencias_gestion" on public.puesto_competencias
  for all to authenticated
  using (public.es_admin_sgc()) with check (public.es_admin_sgc());

-- La evaluacion de competencias es informacion sensible: la ve la propia
-- persona, su superior y Calidad.
create policy "evaluaciones_competencia_lectura" on public.evaluaciones_competencia
  for select to authenticated
  using (
    usuario_id = auth.uid()
    or public.es_admin_sgc()
    or exists (select 1 from public.usuarios u
                where u.id = evaluaciones_competencia.usuario_id
                  and u.superior_id = auth.uid())
  );
create policy "evaluaciones_competencia_gestion" on public.evaluaciones_competencia
  for all to authenticated
  using (public.es_admin_sgc()
         or exists (select 1 from public.usuarios u
                     where u.id = evaluaciones_competencia.usuario_id
                       and u.superior_id = auth.uid()))
  with check (public.es_admin_sgc()
         or exists (select 1 from public.usuarios u
                     where u.id = evaluaciones_competencia.usuario_id
                       and u.superior_id = auth.uid()));

create policy "capacitaciones_lectura" on public.capacitaciones
  for select to authenticated using (public.misma_empresa(empresa_id));
create policy "capacitaciones_gestion" on public.capacitaciones
  for all to authenticated
  using (public.puede_gestionar() and public.misma_empresa(empresa_id))
  with check (public.puede_gestionar() and public.misma_empresa(empresa_id));

create policy "capacitacion_participantes_lectura" on public.capacitacion_participantes
  for select to authenticated
  using (usuario_id = auth.uid() or public.puede_gestionar() or public.es_auditor()
         or public.es_direccion());
create policy "capacitacion_participantes_gestion" on public.capacitacion_participantes
  for all to authenticated
  using (public.puede_gestionar()) with check (public.puede_gestionar());

-- ---------------------------------------------------------------------
-- Modulos 8 y 9 · Proveedores, activos y mantenimientos
-- ---------------------------------------------------------------------
create policy "proveedores_lectura" on public.proveedores
  for select to authenticated using (public.misma_empresa(empresa_id));
create policy "proveedores_gestion" on public.proveedores
  for all to authenticated
  using (public.puede_gestionar() and public.misma_empresa(empresa_id))
  with check (public.puede_gestionar() and public.misma_empresa(empresa_id));

create policy "proveedor_evaluaciones_lectura" on public.proveedor_evaluaciones
  for select to authenticated
  using (exists (select 1 from public.proveedores p where p.id = proveedor_id));
create policy "proveedor_evaluaciones_gestion" on public.proveedor_evaluaciones
  for all to authenticated
  using (public.puede_gestionar()) with check (public.puede_gestionar());

create policy "activos_lectura" on public.activos
  for select to authenticated using (public.misma_empresa(empresa_id));
create policy "activos_gestion" on public.activos
  for all to authenticated
  using (public.puede_gestionar() and public.misma_empresa(empresa_id))
  with check (public.puede_gestionar() and public.misma_empresa(empresa_id));

create policy "mantenimientos_lectura" on public.mantenimientos
  for select to authenticated
  using (exists (select 1 from public.activos a where a.id = activo_id));
create policy "mantenimientos_gestion" on public.mantenimientos
  for all to authenticated
  using (public.puede_gestionar() or responsable_id = auth.uid())
  with check (public.puede_gestionar() or responsable_id = auth.uid());

-- ---------------------------------------------------------------------
-- Adjuntos, notificaciones y bitacora
-- ---------------------------------------------------------------------
create policy "adjuntos_lectura" on public.adjuntos
  for select to authenticated using (public.misma_empresa(empresa_id));
create policy "adjuntos_alta" on public.adjuntos
  for insert to authenticated
  with check (public.misma_empresa(empresa_id) and subido_por = auth.uid()
              and not public.es_direccion());
create policy "adjuntos_baja" on public.adjuntos
  for delete to authenticated
  using (public.misma_empresa(empresa_id)
         and (subido_por = auth.uid() or public.es_admin_sgc()));

-- Cada persona ve y marca como leidas unicamente sus notificaciones.
create policy "notificaciones_propias" on public.notificaciones
  for select to authenticated using (usuario_id = auth.uid());
create policy "notificaciones_marcar_leida" on public.notificaciones
  for update to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "notificaciones_borrar_propias" on public.notificaciones
  for delete to authenticated using (usuario_id = auth.uid());
-- El alta se hace mediante la funcion public.crear_notificacion (migracion 014),
-- que valida que emisor y destinatario pertenezcan a la misma empresa.

-- La bitacora es de solo lectura para Calidad, auditores y Direccion.
-- Nadie puede insertar, editar ni borrar: solo la escribe el disparador.
create policy "bitacora_lectura" on public.bitacora
  for select to authenticated
  using (public.es_admin_sgc() or public.es_auditor() or public.es_direccion());

revoke insert, update, delete on public.bitacora from authenticated;
