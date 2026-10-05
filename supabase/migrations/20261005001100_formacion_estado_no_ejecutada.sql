-- Segundo valor del ciclo nuevo. Va aparte: ver la migracion anterior.
alter type public.estado_capacitacion add value if not exists 'no_ejecutada';
