-- ---------------------------------------------------------------------
-- El riesgo se identifica contra Informacion Documentada, admite
-- acciones ilimitadas, y solo el alto o critico exige tratamiento.
--
-- DONDE SE IDENTIFICA. Hasta ahora era un desplegable con la lista fija
-- del mapa de procesos. Direccion lo cambio el 8 de octubre: no siempre
-- es un proceso —puede ser una politica, un instructivo o un
-- formulario—, asi que se elige de lo que hay cargado en Informacion
-- Documentada, y se puede elegir mas de uno. De ahi la tabla de vinculo.
--
-- `riesgos.proceso_id` queda: la usan los registros cargados antes y la
-- matriz por proceso. Lo que cambia es que deja de ser obligatoria.
--
-- ACCIONES ILIMITADAS. `riesgo_acciones` ya existia y la ficha la usaba
-- para las acciones que se agregaban despues; lo que faltaba era poder
-- cargar varias desde el alta. Lo esencial de cada una es accion,
-- responsable y plazo. Cada accion declara tambien donde se integra, con
-- la misma logica: uno o varios documentos.
--
-- SOLO ALTO O CRITICO EXIGE ACCION. Antes el corte estaba en 5 y el
-- moderado tambien pedia plan. Ahora el moderado y el bajo se aceptan sin
-- accion inmediata y se reevaluan en cada Revision por la Direccion.
-- La columna generada `requiere_accion` pasa de >= 5 a >= 10, y la misma
-- regla esta en `requiereAcciones()` de `lib/riesgos.ts`.
--
-- «Medio» se muestra como «Moderado». El valor del enumerado sigue
-- siendo `medio` —en PostgreSQL un valor no se quita— y lo que cambia es
-- la etiqueta, como con los origenes de la NC.
-- ---------------------------------------------------------------------

create table if not exists public.riesgo_documentos (
  riesgo_id uuid not null references public.riesgos (id) on delete cascade,
  documento_id uuid not null references public.documentos (id) on delete cascade,
  creado_en timestamptz not null default now(),
  primary key (riesgo_id, documento_id)
);

create table if not exists public.riesgo_accion_documentos (
  accion_id uuid not null references public.riesgo_acciones (id) on delete cascade,
  documento_id uuid not null references public.documentos (id) on delete cascade,
  creado_en timestamptz not null default now(),
  primary key (accion_id, documento_id)
);

alter table public.riesgo_documentos enable row level security;
alter table public.riesgo_accion_documentos enable row level security;

-- El grant es tan necesario como la politica: sin el, PostgreSQL corta
-- antes de evaluarla y la pantalla queda vacia sin decir por que.
grant select, insert, update, delete on public.riesgo_documentos to authenticated;
grant select, insert, update, delete on public.riesgo_accion_documentos to authenticated;

create policy riesgo_documentos_lectura on public.riesgo_documentos
  for select using (
    exists (select 1 from public.riesgos r where r.id = riesgo_id and misma_empresa(r.empresa_id))
  );

create policy riesgo_documentos_escritura on public.riesgo_documentos
  for all using (
    puede_gestionar()
    and exists (select 1 from public.riesgos r where r.id = riesgo_id and misma_empresa(r.empresa_id))
  )
  with check (
    puede_gestionar()
    and exists (select 1 from public.riesgos r where r.id = riesgo_id and misma_empresa(r.empresa_id))
  );

create policy riesgo_accion_documentos_lectura on public.riesgo_accion_documentos
  for select using (
    exists (
      select 1 from public.riesgo_acciones a
      join public.riesgos r on r.id = a.riesgo_id
      where a.id = accion_id and misma_empresa(r.empresa_id)
    )
  );

create policy riesgo_accion_documentos_escritura on public.riesgo_accion_documentos
  for all using (
    puede_gestionar()
    and exists (
      select 1 from public.riesgo_acciones a
      join public.riesgos r on r.id = a.riesgo_id
      where a.id = accion_id and misma_empresa(r.empresa_id)
    )
  )
  with check (
    puede_gestionar()
    and exists (
      select 1 from public.riesgo_acciones a
      join public.riesgos r on r.id = a.riesgo_id
      where a.id = accion_id and misma_empresa(r.empresa_id)
    )
  );

alter table public.riesgos
  alter column requiere_accion
  set expression as (
    probabilidad is not null and severidad is not null and (probabilidad * severidad) >= 10
  );

comment on column public.riesgos.requiere_accion is
  'Solo el riesgo alto o critico exige accion de tratamiento. El moderado y el bajo se aceptan y se reevaluan en la Revision por la Direccion. Lo fijo Direccion el 8 de octubre.';
