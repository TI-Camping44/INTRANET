-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- DATOS REALES · Retiro de los procesos de demostracion
-- =====================================================================
-- El seed invento siete procesos (COM, CMP, DEP, REG, COB, RRHH, TI)
-- antes de que se conociera el mapa verdadero. Ahora que estan cargados
-- los diecinueve reales, esos siete sobran: dejarlos convertiria el mapa
-- de procesos en una mezcla de lo real y lo inventado, que es justo lo
-- que Direccion no debe ver.
--
-- No se pueden borrar y ya. De ellos cuelgan dos cosas distintas:
--
--   · Registros de demostracion (no conformidades, riesgos, objetivos,
--     indicadores, auditorias, publicaciones). Si se borra el proceso,
--     la clave foranea los deja en null y quedan sin proceso: peor que
--     antes.
--   · Registros REALES. Los nueve perfiles de puesto del formulario
--     R-02-01 se cargaron sobre DEP, y los diez documentos de TI sobre
--     TI, porque en ese momento eran los unicos procesos disponibles.
--
-- Asi que primero se reasigna todo al proceso real que le corresponde y
-- recien despues se borran los siete.
--
-- Donde el mapa real separa lo que el seed juntaba, la reasignacion es
-- por registro y no por proceso. El conteo ciclico no es almacenamiento:
-- es SOP-05 Inventario de Existencias. El respaldo de datos no es
-- infraestructura: es SOP-07 Seguridad Informatica.
--
-- Tambien se corrigen EST-01 y EST-02. El seed los llamaba "Direccion y
-- planificacion estrategica" y "Gestion de la calidad"; el mapa real usa
-- esos mismos codigos para "Informacion Documentada" y "Planificacion
-- Estrategica del SGC". Al cargar el mapa, el nombre cambio pero los
-- registros se quedaron donde estaban, apuntando a un proceso que ya no
-- trata de lo que ellos tratan.
--
-- Se aplica DESPUES de 10-mapa-de-procesos.sql. Es idempotente: una vez
-- retirados los siete procesos, la segunda corrida no encuentra nada que
-- mover y termina sin hacer nada.

do $$
declare
  v_empresa uuid;
  -- Equivalencia de proceso a proceso: a donde va, por defecto, todo lo
  -- que colgaba de cada proceso inventado.
  equivalencias constant text[][] := array[
    ['COM',  'MIS-03'],   -- Comercial y ventas          → Ventas
    ['CMP',  'SOP-08'],   -- Compras e importaciones     → Compras locales y Evaluacion a Proveedores
    ['DEP',  'MIS-02'],   -- Deposito y logistica        → Almacenamiento
    ['REG',  'SOP-05'],   -- Cumplimiento regulatorio    → Inventario de Existencias
    ['COB',  'SOP-04'],   -- Cobranzas                   → Gestion de Cobranzas
    ['RRHH', 'SOP-01'],   -- Recursos humanos            → Gestion del Capital Humano
    ['TI',   'SOP-02']    -- Tecnologia de la informacion → Infraestructura y Tecnologia
  ];
  r record;
  v_origen uuid;
  v_destino uuid;
  v_faltan int;
begin
  select id into v_empresa from public.empresas order by creado_en limit 1;
  if v_empresa is null then
    raise exception 'No hay ninguna empresa cargada. Aplique el seed primero.';
  end if;

  -- Si el mapa real no esta cargado, no hay a donde reasignar. Se corta
  -- antes de tocar nada, en lugar de dejar los registros en el aire.
  select count(*) into v_faltan
    from unnest(array['MIS-02','MIS-03','SOP-01','SOP-02','SOP-04','SOP-05','SOP-08']) c
   where not exists (
     select 1 from public.procesos p
      where p.empresa_id = v_empresa and lower(p.codigo) = lower(c));
  if v_faltan > 0 then
    raise exception 'Falta el mapa de procesos real. Aplique antes 10-mapa-de-procesos.sql.';
  end if;

  -- -------------------------------------------------------------------
  -- 1 · Reasignacion por defecto, proceso a proceso
  -- -------------------------------------------------------------------
  for r in select equivalencias[i][1] as origen, equivalencias[i][2] as destino
             from generate_subscripts(equivalencias, 1) i
  loop
    select id into v_origen from public.procesos
     where empresa_id = v_empresa and lower(codigo) = lower(r.origen);
    continue when v_origen is null;   -- ya retirado en una corrida anterior

    select id into v_destino from public.procesos
     where empresa_id = v_empresa and lower(codigo) = lower(r.destino);

    update public.no_conformidades  set proceso_id = v_destino where proceso_id = v_origen;
    update public.riesgos           set proceso_id = v_destino where proceso_id = v_origen;
    update public.indicadores       set proceso_id = v_destino where proceso_id = v_origen;
    update public.objetivos         set proceso_id = v_destino where proceso_id = v_origen;
    update public.documentos        set proceso_id = v_destino where proceso_id = v_origen;
    update public.documento_difusion set proceso_id = v_destino where proceso_id = v_origen;
    update public.auditorias        set proceso_id = v_destino where proceso_id = v_origen;
    update public.auditoria_hallazgos set proceso_id = v_destino where proceso_id = v_origen;
    update public.publicaciones     set proceso_id = v_destino where proceso_id = v_origen;
    update public.puestos           set proceso_id = v_destino where proceso_id = v_origen;
    update public.usuarios          set proceso_id = v_destino where proceso_id = v_origen;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 2 · Correcciones por registro
-- ---------------------------------------------------------------------
-- El mapa real separa conceptos que el seed trataba como uno solo. Cada
-- registro de esta lista va a un proceso distinto del que le tocaria por
-- la equivalencia de arriba.

do $$
declare
  v_empresa uuid;

begin
  select id into v_empresa from public.empresas order by creado_en limit 1;

  -- No conformidades
  update public.no_conformidades n set proceso_id = p.id
    from public.procesos p
   where p.empresa_id = v_empresa and n.empresa_id = v_empresa
     and (n.codigo, lower(p.codigo)) in (
       ('NC-2026-001', 'sop-05'),   -- conteo ciclico → Inventario de Existencias
       ('NC-2026-005', 'est-01')    -- documento vencido → Informacion Documentada
     );

  -- Riesgos
  update public.riesgos g set proceso_id = p.id
    from public.procesos p
   where p.empresa_id = v_empresa and g.empresa_id = v_empresa
     and (g.codigo, lower(p.codigo)) in (
       ('R-2026-002', 'mis-01'),    -- estacionalidad de la demanda → Importacion
       ('R-2026-004', 'sop-07')     -- verificacion de respaldos → Seguridad Informatica
     );

  -- Indicadores
  update public.indicadores i set proceso_id = p.id
    from public.procesos p
   where p.empresa_id = v_empresa and i.empresa_id = v_empresa
     and (i.codigo, lower(p.codigo)) in (
       ('KPI-01', 'sop-05'),        -- exactitud de inventario → Inventario de Existencias
       ('KPI-04', 'est-03'),        -- plan de auditorias → Auditoria Interna del SGC
       ('KPI-05', 'est-04')         -- cierre de NC en plazo → No Conformidades y Acciones Correctivas
     );

  -- Objetivos
  update public.objetivos o set proceso_id = p.id
    from public.procesos p
   where p.empresa_id = v_empresa and o.empresa_id = v_empresa
     and (o.codigo, lower(p.codigo)) in (
       ('OBJ-01', 'sop-05'),        -- diferencias de inventario → Inventario de Existencias
       ('OBJ-03', 'est-03')         -- auditorias internas del ejercicio → Auditoria Interna del SGC
     );

  -- Documentos. El juego documental de TI es, en su mayor parte, del
  -- sistema de seguridad de la informacion: va a SOP-07 y no a SOP-02.
  update public.documentos d set proceso_id = p.id
    from public.procesos p
   where p.empresa_id = v_empresa and d.empresa_id = v_empresa
     and (upper(d.codigo), lower(p.codigo)) in (
       ('POL-01',      'est-02'),   -- politica de calidad → Planificacion Estrategica del SGC
       ('F-DEP-01-01', 'sop-05'),   -- formulario de conteo ciclico → Inventario de Existencias
       ('POL-IT-01',   'sop-07'),
       ('PROC-IT-02',  'sop-07'),
       ('PROC-IT-03',  'sop-07'),
       ('PLAN-IT-04',  'sop-07'),
       ('PROC-IT-06',  'sop-07'),
       ('PROC-IT-07',  'sop-07'),
       ('PROC-IT-09',  'sop-07'),
       ('PROC-IT-10',  'sop-07')
     );

  -- Puestos. Los perfiles reales del R-02-01 se cargaron todos sobre el
  -- proceso de deposito; el mapa real los reparte.
  update public.puestos u set proceso_id = p.id
    from public.procesos p
   where p.empresa_id = v_empresa and u.empresa_id = v_empresa
     and (upper(u.codigo), lower(p.codigo)) in (
       ('P-001', 'est-02'),         -- Gerente general → Planificacion Estrategica del SGC
       ('P-002', 'est-02'),         -- Responsable de calidad → Planificacion Estrategica del SGC
       ('P-102', 'sop-02'),         -- Responsable IT → Infraestructura y Tecnologia
       ('P-105', 'sop-04'),         -- Gestor de Cobranzas y Entregas
       ('P-106', 'mis-05'),         -- Asistente Tecnico → Servicio Tecnico
       ('P-107', 'sop-05'),         -- Control de Stock 1
       ('P-108', 'sop-05'),         -- Control de Stock 2
       ('P-109', 'sop-05')          -- Reposicion de Stock
     );

  -- Cada persona sigue al proceso de su puesto: asi no hay que mantener
  -- dos listas que digan lo mismo.
  update public.usuarios s set proceso_id = u.proceso_id
    from public.puestos u
   where s.puesto_id = u.id and s.empresa_id = v_empresa
     and s.proceso_id is distinct from u.proceso_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 3 · Retiro
-- ---------------------------------------------------------------------
-- Ya nada cuelga de ellos. Se borran, y con ellos la ultima traza del
-- mapa de procesos inventado.

delete from public.procesos p
 where lower(p.codigo) in ('com', 'cmp', 'dep', 'reg', 'cob', 'rrhh', 'ti')
   and exists (select 1 from public.procesos q
                where q.empresa_id = p.empresa_id and lower(q.codigo) = 'mis-03');

-- ---------------------------------------------------------------------
-- 4 · Un documento de demostracion que ya sobra
-- ---------------------------------------------------------------------
-- El seed invento una "Politica de calidad" con codigo POL-01. La real
-- esta cargada desde la unidad compartida y no lleva codigo. Tener dos
-- politicas de calidad en la misma lista, una marcada como demostracion,
-- es justo lo que confunde a quien entra a mirar. Se borra la inventada.
--
-- El resto de los documentos de demostracion se quedan: son formularios
-- e instructivos sin equivalente real, y la insignia "Demostracion" los
-- distingue.

delete from public.documentos d
 where upper(d.codigo) = 'POL-01'
   and d.es_demostracion
   and exists (
     select 1 from public.documentos r
      where r.empresa_id = d.empresa_id
        and r.codigo is null
        and r.titulo = 'Política de Calidad'
        and not r.es_demostracion);
