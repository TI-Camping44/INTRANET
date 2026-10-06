-- ---------------------------------------------------------------------
-- El programa y el plan se solicitan para aprobacion, y la auditoria
-- puede auditar documentos ademas de procesos
--
-- Tres cosas que pidio Direccion el 6 de octubre.
--
-- 1 · SOLICITAR APROBACION, Y NO APROBAR A MANO.
--
--     El boton decia «Aprobar programa» y lo apretaba quien lo estaba
--     mirando. Un programa de auditorias que se aprueba solo no es una
--     aprobacion: es un cambio de estado. Ahora se elige a quien tiene
--     que aprobarlo, le llega la notificacion, y el boton de aprobar
--     aparece recien para esa persona.
--
--     Lo mismo con el plan de cada auditoria, que hasta ahora no tenia
--     aprobacion de ninguna clase.
--
--     Se guarda a quien se le pidio y cuando. No se guarda un «estado de
--     la solicitud»: con la fecha de pedido y la de aprobacion alcanza
--     para saber en que punto esta, y un estado mas seria un dato que
--     puede contradecir a los otros dos.
--
-- 2 · NO SOLO SE AUDITAN PROCESOS.
--
--     Una auditoria tambien se hace contra la informacion documentada:
--     un procedimiento, un instructivo, un registro. Se agrega la tabla
--     de union, con la misma forma y las mismas politicas que
--     `auditoria_procesos`.
--
--     NO REEMPLAZA a los procesos auditados: los suma. La auditoria
--     cargada ya tiene ocho procesos elegidos y quitarlos seria perder
--     lo que Calidad definio.
-- ---------------------------------------------------------------------

alter table public.programas_auditoria
  add column if not exists aprobacion_solicitada_a uuid references public.usuarios (id),
  add column if not exists aprobacion_solicitada_en timestamptz;

comment on column public.programas_auditoria.aprobacion_solicitada_a is
  'A quien se le pidio aprobar el programa. Mientras este sin aprobar, es la unica '
  'persona —ademas del Administrador SGC— que puede aprobarlo.';
comment on column public.programas_auditoria.aprobacion_solicitada_en is
  'Cuando se pidio. Con `fecha_aprobacion` alcanza para saber en que punto esta la '
  'aprobacion, sin un estado aparte que pueda contradecirlas.';

alter table public.auditorias
  add column if not exists plan_aprobacion_solicitada_a uuid references public.usuarios (id),
  add column if not exists plan_aprobacion_solicitada_en timestamptz,
  add column if not exists plan_aprobado_por uuid references public.usuarios (id),
  add column if not exists plan_fecha_aprobacion date;

comment on column public.auditorias.plan_aprobacion_solicitada_a is
  'A quien se le pidio aprobar el plan de esta auditoria.';
comment on column public.auditorias.plan_fecha_aprobacion is
  'Cuando quedo aprobado el plan. Nulo mientras no lo este.';

-- ---------------------------------------------------------------------

create table if not exists public.auditoria_documentos (
  auditoria_id uuid not null references public.auditorias (id) on delete cascade,
  documento_id uuid not null references public.documentos (id) on delete cascade,
  creado_en timestamptz not null default now(),
  primary key (auditoria_id, documento_id)
);

comment on table public.auditoria_documentos is
  'Documentos de la informacion documentada que abarca una auditoria. No reemplaza a '
  '`auditoria_procesos`: una auditoria puede abarcar procesos, documentos o los dos.';

-- RLS Y SU GRANT. Sin el grant, PostgreSQL corta antes de evaluar las
-- politicas y la pantalla queda vacia sin decir por que. Esta tabla no
-- entra en el bucle de `..._politicas_rls.sql`, asi que va explicito.
alter table public.auditoria_documentos enable row level security;

grant select, insert, update, delete on public.auditoria_documentos to authenticated;

drop policy if exists auditoria_documentos_lectura on public.auditoria_documentos;
create policy auditoria_documentos_lectura
  on public.auditoria_documentos for select
  using (
    exists (select 1 from public.auditorias a where a.id = auditoria_id)
  );

drop policy if exists auditoria_documentos_gestion on public.auditoria_documentos;
create policy auditoria_documentos_gestion
  on public.auditoria_documentos for all
  using (
    exists (
      select 1 from public.auditorias a
       where a.id = auditoria_id
         and public.misma_empresa(a.empresa_id)
         and (public.es_admin_sgc() or public.es_auditor() or a.auditor_lider_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.auditorias a
       where a.id = auditoria_id
         and public.misma_empresa(a.empresa_id)
         and (public.es_admin_sgc() or public.es_auditor() or a.auditor_lider_id = auth.uid())
    )
  );
