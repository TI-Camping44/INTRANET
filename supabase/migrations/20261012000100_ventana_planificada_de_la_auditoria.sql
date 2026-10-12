-- ---------------------------------------------------------------------
-- La auditoria se planifica como una ventana, no como un dia
--
-- `fecha_planificada` era una sola fecha, y una auditoria interna del
-- SGC rara vez entra en un dia: recorre cinco o seis procesos y se
-- reparte en varias jornadas. Con un solo dia cargado, el aviso que
-- sale a toda la empresa anuncia una fecha y el auditor aparece tres
-- dias seguidos, que es justo lo que descoordina al area auditada.
--
-- Se agrega el cierre de la ventana y NO se renombra la columna que ya
-- estaba: `fecha_planificada` pasa a leerse como el inicio. Renombrarla
-- obligaria a tocar el listado, la ficha, el programa anual y el panel
-- de indicadores, y sobre todo dejaria las auditorias ya cargadas sin
-- el dato que hoy tienen. El fin queda nulo en esas: una auditoria
-- vieja planificada para un dia sigue significando lo mismo.
--
-- El fin es opcional en la base a proposito. El alta lo exige —ahi se
-- esta decidiendo la ventana— pero la edicion de una auditoria vieja
-- no puede quedar trabada pidiendo una fecha que nadie decidio nunca.
-- Es el mismo criterio que ya rige para `fecha_aviso`.
-- ---------------------------------------------------------------------

alter table public.auditorias
  add column if not exists fecha_planificada_fin date;

-- El fin nunca puede caer antes del inicio. Con cualquiera de las dos
-- nula la condicion no aplica: la auditoria vieja no tiene fin, y la
-- fecha planificada admite nulo desde la migracion original.
alter table public.auditorias
  drop constraint if exists auditorias_ventana_planificada;

alter table public.auditorias
  add constraint auditorias_ventana_planificada check (
    fecha_planificada is null
    or fecha_planificada_fin is null
    or fecha_planificada_fin >= fecha_planificada
  );

comment on column public.auditorias.fecha_planificada is
  'Inicio de la ventana planificada. Define ademas a que programa anual '
  'pertenece la auditoria, por su anio.';

comment on column public.auditorias.fecha_planificada_fin is
  'Cierre de la ventana planificada. Nulo en las auditorias cargadas '
  'antes del 12 de octubre de 2026, que se planificaron para un solo dia.';
