-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- Retirar los datos de demostracion
-- =====================================================================
-- Borra todo lo que cargo el seed: las no conformidades, los riesgos,
-- las auditorias, los indicadores, los objetivos, las capacitaciones,
-- la encuesta, las publicaciones y los documentos, activos, clientes y
-- proveedores marcados como demostracion.
--
-- NO forma parte de la instalacion ni de la actualizacion, y es a
-- proposito: el seed existe para que el sistema se pueda mostrar
-- funcionando. Esto es la operacion contraria, y se corre una sola vez,
-- cuando ya no se lo quiere.
--
-- Lo real no se toca: los diecinueve procesos del mapa, los cincuenta y
-- ocho documentos de la unidad compartida, los perfiles del R-02-01, y
-- lo que trajo la importacion de Sofidya.
--
-- IMPORTANTE · Corra antes la importacion de Sofidya. Tres de los cinco
-- proveedores del seed existen tambien en Sofidya; la importacion les
-- quita la marca de demostracion y asi este archivo no se los lleva por
-- delante. Si lo corre al reves, se borran y hay que volver a importar.
--
-- Es idempotente: correrlo dos veces no rompe nada.
--
-- Despues de esto varios modulos quedan VACIOS: riesgos, no
-- conformidades, auditorias, indicadores, satisfaccion y capacitaciones.
-- No es una falla, es que esos datos todavia no se trajeron de Sofidya,
-- que no los expone por su API y hay que exportarlos a mano.

do $$
declare
  v_borradas int;
  v_usuario_real uuid;
begin
  -- -------------------------------------------------------------------
  -- 1 · Contenido de demostracion
  -- -------------------------------------------------------------------
  -- El orden importa poco porque las tablas hijas van con `on delete
  -- cascade`, pero se listan de la mas dependiente a la menos para que
  -- se lea igual que se ejecuta.

  delete from public.encuesta_respuestas
   where encuesta_id in (select id from public.encuestas where es_demostracion);
  delete from public.encuestas where es_demostracion;

  delete from public.capacitaciones where es_demostracion;
  delete from public.auditorias where es_demostracion;
  delete from public.programas_auditoria where es_demostracion;
  delete from public.no_conformidades where es_demostracion;
  delete from public.riesgos where es_demostracion;
  delete from public.indicadores where es_demostracion;
  delete from public.objetivos where es_demostracion;
  delete from public.publicaciones where es_demostracion;
  delete from public.activos where es_demostracion;
  delete from public.clientes where es_demostracion;
  delete from public.proveedores where es_demostracion;
  delete from public.documentos where es_demostracion;

  -- -------------------------------------------------------------------
  -- 2 · Los usuarios de demostracion
  -- -------------------------------------------------------------------
  -- `documentos.responsable_id` es obligatorio y con RESTRICT: mientras
  -- los cincuenta y ocho documentos reales tengan de responsable a un
  -- usuario de demostracion, ese usuario no se puede borrar.
  --
  -- No se inventa un responsable para salir del paso. Si ya entro
  -- alguien de verdad con su cuenta de Google, se le pasan los
  -- documentos y recien ahi se borran los de demostracion. Si todavia no
  -- entro nadie, se dejan y este archivo se vuelve a correr despues del
  -- primer ingreso.

  select id into v_usuario_real
    from public.usuarios
   where correo not like 'demo.%'
     and activo
   order by rol = 'administrador_sgc' desc, creado_en
   limit 1;

  if v_usuario_real is null then
    raise notice 'Todavia no entro ningun usuario real: los de demostracion se dejan.';
    raise notice 'Vuelva a correr este archivo despues del primer ingreso con Google.';
  else
    update public.documentos
       set responsable_id = v_usuario_real
     where responsable_id in (select id from public.usuarios where correo like 'demo.%');

    update public.documentos
       set elaborador_id = v_usuario_real
     where elaborador_id in (select id from public.usuarios where correo like 'demo.%');

    update public.procesos
       set responsable_id = v_usuario_real
     where responsable_id in (select id from public.usuarios where correo like 'demo.%');

    delete from public.usuarios where correo like 'demo.%';
    get diagnostics v_borradas = row_count;
    raise notice 'Se borraron % usuarios de demostracion.', v_borradas;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Que quedo
-- ---------------------------------------------------------------------
select 'procesos' as tabla, count(*) as filas from public.procesos
union all select 'documentos', count(*) from public.documentos
union all select 'puestos', count(*) from public.puestos
union all select 'sedes', count(*) from public.sedes
union all select 'proveedores', count(*) from public.proveedores
union all select 'clientes', count(*) from public.clientes
union all select 'activos', count(*) from public.activos
union all select 'riesgos', count(*) from public.riesgos
union all select 'no_conformidades', count(*) from public.no_conformidades
union all select 'indicadores', count(*) from public.indicadores
union all select 'auditorias', count(*) from public.auditorias
union all select 'usuarios', count(*) from public.usuarios
order by 1;
