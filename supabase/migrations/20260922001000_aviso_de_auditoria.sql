-- ---------------------------------------------------------------------
-- Aviso de auditoria a toda la empresa
--
-- Calidad pidio poder fijar una fecha de aviso al planificar la
-- auditoria: llegado ese dia, el sistema avisa por correo a la lista
-- todos@camping44.com.py. Es para que la gente sepa que la auditoria
-- viene, no para asignarle nada: por eso va a la lista y no a personas.
--
-- `aviso_enviado` marca el envio. Sin esa marca el trabajo programado
-- volveria a mandar el mismo correo todos los dias desde la fecha de
-- aviso hasta la de la auditoria.
-- ---------------------------------------------------------------------

alter table public.auditorias
  add column if not exists fecha_aviso date,
  add column if not exists aviso_enviado boolean not null default false;

comment on column public.auditorias.fecha_aviso is
  'Dia en que el trabajo programado avisa por correo a toda la empresa. Nulo: no se avisa.';

comment on column public.auditorias.aviso_enviado is
  'Marca que el aviso ya salio, para que el trabajo diario no lo repita.';

-- El aviso se limpia si la fecha se corre hacia adelante: mover la fecha
-- de aviso es pedir que se avise de nuevo.
create or replace function public.reabrir_aviso_auditoria()
returns trigger
language plpgsql
as $$
begin
  if new.fecha_aviso is distinct from old.fecha_aviso then
    new.aviso_enviado := false;
  end if;
  return new;
end;
$$;

drop trigger if exists auditorias_reabrir_aviso on public.auditorias;
create trigger auditorias_reabrir_aviso
  before update of fecha_aviso on public.auditorias
  for each row execute function public.reabrir_aviso_auditoria();
