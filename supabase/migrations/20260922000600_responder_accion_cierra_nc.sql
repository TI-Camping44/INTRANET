-- ---------------------------------------------------------------------
-- Responder la accion correctiva cierra la no conformidad
--
-- Cambia el modelo de cierre que quedo de la revision del 1 de
-- septiembre. Hasta ahora la no conformidad la cerraba Calidad y solo con
-- la eficacia verificada. Calidad pidio invertirlo:
--
--   * La no conformidad se cierra sola cuando el responsable responde:
--     presenta su descargo y completa los cinco porques.
--   * La accion correctiva QUEDA ABIERTA. Es la que hay que controlar:
--     que se ejecute, y despues que haya sido eficaz.
--
-- La logica es que la desviacion deja de estar «suelta» en cuanto tiene
-- analisis y plan; lo que sigue vivo es el compromiso de ejecutar ese
-- plan, y eso es la accion, no la no conformidad.
--
-- El control no desaparece, se mueve. Para cerrar hacen falta las dos
-- cosas: un descargo escrito y la cadena de cinco porques. Calidad sigue
-- pudiendo cerrar a mano cuando corresponda —una desviacion anulada, una
-- cerrada por otra via—, y para eso conserva la excepcion.
--
-- Se agrega `descargo` a la accion: el texto donde quien responde explica
-- que paso y por que. No es la descripcion de la accion —que es lo que se
-- va a hacer— sino el descargo de la persona.
-- ---------------------------------------------------------------------

alter table public.nc_acciones
  add column if not exists descargo text;

comment on column public.nc_acciones.descargo is
  'Descargo de quien responde la no conformidad: que paso y por que. Distinto de '
  'descripcion, que es lo que se va a hacer.';

-- ---------------------------------------------------------------------
-- El control de cierre, con la regla nueva
-- ---------------------------------------------------------------------

create or replace function public.controlar_cierre_nc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hay_descargo boolean;
  porques integer;
begin
  if new.estado = 'cerrada' and old.estado is distinct from 'cerrada' then
    -- Calidad cierra siempre: le quedan los casos que no pasan por el
    -- camino normal.
    if public.es_admin_sgc() then
      return new;
    end if;

    select exists (
      select 1
        from public.nc_acciones a
       where a.no_conformidad_id = new.id
         and a.descargo is not null
         and length(btrim(a.descargo)) > 0
    ) into hay_descargo;

    if not hay_descargo then
      raise exception
        'Para cerrar la no conformidad hace falta la accion correctiva con su descargo.'
        using errcode = '23514';
    end if;

    select count(*) into porques
      from public.nc_porques p
     where p.no_conformidad_id = new.id;

    if porques < 5 then
      raise exception
        'Complete los cinco porques: la cadena tiene que llegar hasta la causa raiz.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.controlar_cierre_nc is
  'La no conformidad se cierra al responder la accion correctiva: hace falta el descargo '
  'y los cinco porques. La accion queda abierta, que es lo que se controla. Calidad '
  'puede cerrar a mano sin esos requisitos.';

-- ---------------------------------------------------------------------
-- El analisis lo carga quien responde, sea o no el asignado
-- ---------------------------------------------------------------------
-- Si cualquiera puede proponer una accion correctiva —lo abrio la
-- migracion 20260922000500— tambien tiene que poder cargar el analisis
-- que la sostiene. Sin esto, alguien puede cargar la accion y no los
-- cinco porques, y la no conformidad no cierra nunca.
--
-- Direccion queda afuera, como siempre, y sigue valiendo misma_empresa.
-- Cada escritura la registra el disparador de bitacora, asi que se sabe
-- quien escribio el analisis y quien lo cambio.

drop policy if exists nc_porques_gestion on public.nc_porques;

create policy nc_porques_gestion on public.nc_porques
  for all to authenticated
  using (
    not es_direccion()
    and exists (
      select 1
        from public.no_conformidades n
       where n.id = nc_porques.no_conformidad_id
         and misma_empresa(n.empresa_id)
    )
  )
  with check (
    not es_direccion()
    and exists (
      select 1
        from public.no_conformidades n
       where n.id = nc_porques.no_conformidad_id
         and misma_empresa(n.empresa_id)
    )
  );
