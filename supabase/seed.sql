-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- Datos de demostracion
-- =====================================================================
-- Todos los registros llevan es_demostracion = true y los usuarios usan
-- el prefijo "demo." en su correo, de modo que se distingan a simple
-- vista de los datos reales y se puedan eliminar de una sola pasada.
--
-- Para borrar toda la demostracion:
--   delete from auth.users where email like 'demo.%@camping44.com.py';
--   delete from public.documentos where es_demostracion;
--   delete from public.no_conformidades where es_demostracion;
--   delete from public.riesgos where es_demostracion;
--   ... (ver README.md)

-- ---------------------------------------------------------------------
-- Empresas
-- ---------------------------------------------------------------------
insert into public.empresas (id, nombre, razon_social, ruc, activa) values
  ('11111111-1111-4111-8111-111111111111', 'Camping 44', 'Camping 44 S.A.', '80012345-6', true),
  ('22222222-2222-4222-8222-222222222222', 'Vitálica', 'Vitálica E.A.S.', '80098765-4', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Sedes
-- ---------------------------------------------------------------------
insert into public.sedes (id, empresa_id, nombre, direccion, ciudad, telefono) values
  ('a1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'Casa Central', 'Av. Eusebio Ayala 2540', 'Asunción', '021 555 4400'),
  ('a1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'Sucursal Shopping', 'Shopping del Sol, local 118', 'Asunción', '021 555 4410'),
  ('a1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'Depósito Central', 'Ruta Transchaco km 14', 'Mariano Roque Alonso', '021 555 4420')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Normas de referencia
-- ---------------------------------------------------------------------
insert into public.normas (id, codigo, nombre, version, descripcion, vigente) values
  ('b1000000-0000-4000-8000-000000000001', 'ISO 9001:2015',
   'Sistemas de gestión de la calidad — Requisitos', '2015',
   'Norma de referencia del sistema de gestión.', true),
  ('b1000000-0000-4000-8000-000000000002', 'Ley 4036/2010',
   'Ley de armas de fuego, municiones y explosivos', '2010',
   'Marco legal aplicable a la comercialización de armas en Paraguay.', true),
  ('b1000000-0000-4000-8000-000000000003', 'Res. DIMABEL 112/2019',
   'Registro y control de existencias de material controlado', '2019',
   'Obligaciones de registro ante la Dirección de Material Bélico.', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Procesos (mapa de procesos de Camping 44)
-- ---------------------------------------------------------------------
insert into public.procesos (id, empresa_id, codigo, nombre, tipo, descripcion) values
  ('c1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'EST-01', 'Dirección y planificación estratégica', 'estrategico',
   'Definición de objetivos, revisión por la dirección y asignación de recursos.'),
  ('c1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'EST-02', 'Gestión de la calidad', 'estrategico',
   'Mantenimiento del sistema de gestión, auditorías internas y mejora continua.'),
  ('c1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'COM', 'Comercial y ventas', 'operativo',
   'Atención en salón, asesoramiento técnico y cierre de ventas.'),
  ('c1000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   'CMP', 'Compras e importaciones', 'operativo',
   'Selección de proveedores, importación y nacionalización de mercadería.'),
  ('c1000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111',
   'DEP', 'Depósito y logística', 'operativo',
   'Recepción, almacenamiento, control de existencias y despacho.'),
  ('c1000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111',
   'REG', 'Cumplimiento regulatorio', 'operativo',
   'Registro de material controlado y reportes ante DIMABEL.'),
  ('c1000000-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111',
   'COB', 'Cobranzas', 'apoyo',
   'Gestión de cuentas por cobrar y recuperación de créditos.'),
  ('c1000000-0000-4000-8000-000000000008', '11111111-1111-4111-8111-111111111111',
   'TI', 'Tecnología de la información', 'apoyo',
   'Infraestructura, sistemas y soporte a los usuarios.'),
  ('c1000000-0000-4000-8000-000000000009', '11111111-1111-4111-8111-111111111111',
   'RRHH', 'Recursos humanos', 'apoyo',
   'Selección, capacitación y evaluación del personal.')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Puestos
-- ---------------------------------------------------------------------
insert into public.puestos (id, empresa_id, codigo, nombre, area, proceso_id, mision) values
  ('d1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'P-001', 'Gerente general', 'Dirección', 'c1000000-0000-4000-8000-000000000001',
   'Conducir la operación y asegurar el cumplimiento de los objetivos.'),
  ('d1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'P-002', 'Responsable de calidad', 'Calidad', 'c1000000-0000-4000-8000-000000000002',
   'Mantener y mejorar el sistema de gestión de la calidad.'),
  ('d1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'P-003', 'Jefe comercial', 'Comercial', 'c1000000-0000-4000-8000-000000000003',
   'Alcanzar las metas de venta con el nivel de servicio comprometido.'),
  ('d1000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   'P-004', 'Vendedor de salón', 'Comercial', 'c1000000-0000-4000-8000-000000000003',
   'Asesorar al cliente y concretar la venta cumpliendo la normativa vigente.'),
  ('d1000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111',
   'P-005', 'Encargado de depósito', 'Logística', 'c1000000-0000-4000-8000-000000000005',
   'Garantizar la exactitud del inventario y la trazabilidad del material.'),
  ('d1000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111',
   'P-006', 'Analista de compras', 'Compras', 'c1000000-0000-4000-8000-000000000004',
   'Asegurar el abastecimiento en tiempo, costo y calidad.'),
  ('d1000000-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111',
   'P-007', 'Analista de cobranzas', 'Administración', 'c1000000-0000-4000-8000-000000000007',
   'Reducir la morosidad y sostener el flujo de cobranzas.'),
  ('d1000000-0000-4000-8000-000000000008', '11111111-1111-4111-8111-111111111111',
   'P-008', 'Responsable de TI', 'TI', 'c1000000-0000-4000-8000-000000000008',
   'Sostener la infraestructura y los sistemas de la operación.')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Usuarios de demostracion
-- ---------------------------------------------------------------------
-- Se crean en auth.users; el disparador public.crear_perfil_usuario
-- genera el perfil en public.usuarios con rol Colaborador, y luego se
-- ajustan rol, jerarquia y proceso a cargo.
--
-- Los correos llevan el prefijo "demo." a proposito: asi nunca colisionan
-- con las cuentas reales del espacio de trabajo de Google.
insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('e1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'demo.direccion@camping44.com.py', now(),
   '{"provider":"google","providers":["google"]}',
   '{"full_name":"Rodrigo Fernández"}', now(), now()),
  ('e1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'demo.calidad@camping44.com.py', now(),
   '{"provider":"google","providers":["google"]}',
   '{"full_name":"María Benítez"}', now(), now()),
  ('e1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'demo.comercial@camping44.com.py', now(),
   '{"provider":"google","providers":["google"]}',
   '{"full_name":"Lucía Ayala"}', now(), now()),
  ('e1000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'demo.deposito@camping44.com.py', now(),
   '{"provider":"google","providers":["google"]}',
   '{"full_name":"Marcos Duarte"}', now(), now()),
  ('e1000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'demo.compras@camping44.com.py', now(),
   '{"provider":"google","providers":["google"]}',
   '{"full_name":"Silvia Rojas"}', now(), now()),
  ('e1000000-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'demo.cobranzas@camping44.com.py', now(),
   '{"provider":"google","providers":["google"]}',
   '{"full_name":"Patricia Cabral"}', now(), now()),
  ('e1000000-0000-4000-8000-000000000007', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'demo.ti@camping44.com.py', now(),
   '{"provider":"google","providers":["google"]}',
   '{"full_name":"Andrés Villalba"}', now(), now()),
  ('e1000000-0000-4000-8000-000000000008', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'demo.auditor@camping44.com.py', now(),
   '{"provider":"google","providers":["google"]}',
   '{"full_name":"Gustavo Meza"}', now(), now()),
  ('e1000000-0000-4000-8000-000000000009', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'demo.vendedor@camping44.com.py', now(),
   '{"provider":"google","providers":["google"]}',
   '{"full_name":"Nicolás Giménez"}', now(), now())
on conflict (id) do nothing;

-- Rol, jerarquia y proceso a cargo.
update public.usuarios set
  rol = 'direccion', puesto_id = 'd1000000-0000-4000-8000-000000000001',
  proceso_id = 'c1000000-0000-4000-8000-000000000001'
where id = 'e1000000-0000-4000-8000-000000000001';

update public.usuarios set
  rol = 'administrador_sgc', puesto_id = 'd1000000-0000-4000-8000-000000000002',
  proceso_id = 'c1000000-0000-4000-8000-000000000002',
  superior_id = 'e1000000-0000-4000-8000-000000000001'
where id = 'e1000000-0000-4000-8000-000000000002';

update public.usuarios set
  rol = 'responsable_proceso', puesto_id = 'd1000000-0000-4000-8000-000000000003',
  proceso_id = 'c1000000-0000-4000-8000-000000000003',
  superior_id = 'e1000000-0000-4000-8000-000000000001'
where id = 'e1000000-0000-4000-8000-000000000003';

update public.usuarios set
  rol = 'responsable_proceso', puesto_id = 'd1000000-0000-4000-8000-000000000005',
  proceso_id = 'c1000000-0000-4000-8000-000000000005',
  superior_id = 'e1000000-0000-4000-8000-000000000001'
where id = 'e1000000-0000-4000-8000-000000000004';

update public.usuarios set
  rol = 'responsable_proceso', puesto_id = 'd1000000-0000-4000-8000-000000000006',
  proceso_id = 'c1000000-0000-4000-8000-000000000004',
  superior_id = 'e1000000-0000-4000-8000-000000000001'
where id = 'e1000000-0000-4000-8000-000000000005';

update public.usuarios set
  rol = 'responsable_proceso', puesto_id = 'd1000000-0000-4000-8000-000000000007',
  proceso_id = 'c1000000-0000-4000-8000-000000000007',
  superior_id = 'e1000000-0000-4000-8000-000000000001'
where id = 'e1000000-0000-4000-8000-000000000006';

update public.usuarios set
  rol = 'responsable_proceso', puesto_id = 'd1000000-0000-4000-8000-000000000008',
  proceso_id = 'c1000000-0000-4000-8000-000000000008',
  superior_id = 'e1000000-0000-4000-8000-000000000001'
where id = 'e1000000-0000-4000-8000-000000000007';

update public.usuarios set
  rol = 'auditor', superior_id = 'e1000000-0000-4000-8000-000000000002'
where id = 'e1000000-0000-4000-8000-000000000008';

update public.usuarios set
  rol = 'colaborador', puesto_id = 'd1000000-0000-4000-8000-000000000004',
  proceso_id = 'c1000000-0000-4000-8000-000000000003',
  superior_id = 'e1000000-0000-4000-8000-000000000003'
where id = 'e1000000-0000-4000-8000-000000000009';

-- Responsables de proceso.
update public.procesos set responsable_id = 'e1000000-0000-4000-8000-000000000001'
  where id = 'c1000000-0000-4000-8000-000000000001';
update public.procesos set responsable_id = 'e1000000-0000-4000-8000-000000000002'
  where id in ('c1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000006');
update public.procesos set responsable_id = 'e1000000-0000-4000-8000-000000000003'
  where id = 'c1000000-0000-4000-8000-000000000003';
update public.procesos set responsable_id = 'e1000000-0000-4000-8000-000000000005'
  where id = 'c1000000-0000-4000-8000-000000000004';
update public.procesos set responsable_id = 'e1000000-0000-4000-8000-000000000004'
  where id = 'c1000000-0000-4000-8000-000000000005';
update public.procesos set responsable_id = 'e1000000-0000-4000-8000-000000000006'
  where id = 'c1000000-0000-4000-8000-000000000007';
update public.procesos set responsable_id = 'e1000000-0000-4000-8000-000000000007'
  where id in ('c1000000-0000-4000-8000-000000000008', 'c1000000-0000-4000-8000-000000000009');

-- A partir de aqui la bitacora atribuye los movimientos a Calidad, que es
-- quien cargaria estos datos en la operacion real.
select set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000002', false);

-- ---------------------------------------------------------------------
-- Clientes y proveedores
-- ---------------------------------------------------------------------
insert into public.clientes (id, empresa_id, codigo, razon_social, ruc, correo, ciudad, es_demostracion) values
  ('f1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'CLI-001', 'Estancia Santa Rosa S.A.', '80025874-1', 'compras@santarosa.demo.py', 'Concepción', true),
  ('f1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'CLI-002', 'Club de Caza y Pesca Asunción', '80031122-3', 'secretaria@clubcaza.demo.py', 'Asunción', true),
  ('f1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'CLI-003', 'Seguridad Integral Guaraní S.R.L.', '80044455-7', 'admin@sig.demo.py', 'Luque', true),
  ('f1000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   'CLI-004', 'Agroganadera del Chaco S.A.', '80055566-8', 'compras@agrochaco.demo.py', 'Filadelfia', true)
on conflict (id) do nothing;

insert into public.proveedores (
  id, empresa_id, codigo, razon_social, nombre_comercial, ruc, rubro, critico,
  correo, telefono, ciudad, pais, estado, periodicidad_evaluacion_meses, es_demostracion
) values
  ('f2000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'PRV-001', 'Importadora Andina de Equipamiento S.A.', 'Andina Outdoor', '80077788-9',
   'Equipamiento outdoor', true, 'ventas@andina.demo.py', '+54 11 4000 0000',
   'Buenos Aires', 'Argentina', 'aprobado', 12, true),
  ('f2000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'PRV-002', 'Distribuidora de Municiones del Sur Ltda.', 'DMS', '80088899-0',
   'Municiones y accesorios', true, 'contacto@dms.demo.py', '+55 41 3000 0000',
   'Curitiba', 'Brasil', 'aprobado', 6, true),
  ('f2000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'PRV-003', 'Transportes Ñemity S.R.L.', 'Ñemity Logística', '80099900-1',
   'Transporte y logística', false, 'operaciones@nemity.demo.py', '021 555 7788',
   'Asunción', 'Paraguay', 'condicional', 12, true),
  ('f2000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   'PRV-004', 'Insumos Gráficos Paraguay S.A.', 'Ingrapar', '80011122-4',
   'Insumos de oficina', false, 'ventas@ingrapar.demo.py', '021 555 3322',
   'Asunción', 'Paraguay', 'aprobado', 24, true),
  ('f2000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111',
   'PRV-005', 'Servicios Informáticos Aguará S.R.L.', 'Aguará TI', '80022233-5',
   'Servicios de TI', true, 'soporte@aguara.demo.py', '021 555 9911',
   'Asunción', 'Paraguay', 'en_evaluacion', 12, true)
on conflict (id) do nothing;

-- Evaluaciones (el disparador actualiza calificacion y fechas del proveedor).
insert into public.proveedor_evaluaciones (
  proveedor_id, fecha, periodo, calidad, plazo_entrega, precio,
  servicio_posventa, documentacion, resultado, comentario, evaluado_por
) values
  ('f2000000-0000-4000-8000-000000000001', current_date - 120, 'Semestre 1',
   5, 4, 4, 5, 5, 'aprobado', 'Cumplimiento sostenido en calidad y documentación.',
   'e1000000-0000-4000-8000-000000000005'),
  ('f2000000-0000-4000-8000-000000000002', current_date - 60, 'Semestre 1',
   5, 3, 4, 4, 5, 'aprobado', 'Demoras puntuales por trámites de importación.',
   'e1000000-0000-4000-8000-000000000005'),
  ('f2000000-0000-4000-8000-000000000003', current_date - 200, 'Anual',
   3, 2, 4, 3, 3, 'condicional', 'Reiteradas demoras en la entrega al depósito.',
   'e1000000-0000-4000-8000-000000000005'),
  ('f2000000-0000-4000-8000-000000000004', current_date - 300, 'Anual',
   4, 5, 5, 4, 4, 'aprobado', 'Sin observaciones en el período.',
   'e1000000-0000-4000-8000-000000000005');

-- ---------------------------------------------------------------------
-- Documentos
-- ---------------------------------------------------------------------
insert into public.documentos (
  id, empresa_id, codigo, titulo, descripcion, tipo, estado, proceso_id, norma_id,
  responsable_id, elaborador_id, aprobador_id, version_actual, fecha_aprobacion,
  fecha_vigencia, fecha_proxima_revision, periodicidad_revision_meses,
  es_demostracion, creado_por
) values
  ('01000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'MP-SOP-01', 'Manual del Sistema de Gestión de Calidad',
   'Describe el alcance del sistema, el mapa de procesos y la política de calidad de Camping 44.',
   'manual', 'vigente', 'c1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001',
   'e1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000002',
   'e1000000-0000-4000-8000-000000000001', 1, current_date - 200, current_date - 200,
   current_date + 165, 12, true, 'e1000000-0000-4000-8000-000000000002'),

  ('01000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'MP-SOP-02', 'Procedimiento de control de información documentada',
   'Reglas de codificación, elaboración, revisión, aprobación y baja de documentos.',
   'procedimiento', 'vigente', 'c1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001',
   'e1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000002',
   'e1000000-0000-4000-8000-000000000001', 2, current_date - 90, current_date - 90,
   current_date + 275, 12, true, 'e1000000-0000-4000-8000-000000000002'),

  ('01000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'MP-SOP-03', 'Procedimiento de no conformidades y acciones correctivas',
   'Tratamiento de desviaciones, análisis de causa raíz y verificación de eficacia.',
   'procedimiento', 'vigente', 'c1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001',
   'e1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000002',
   'e1000000-0000-4000-8000-000000000001', 1, current_date - 150, current_date - 150,
   current_date + 215, 12, true, 'e1000000-0000-4000-8000-000000000002'),

  ('01000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   'MP-SOP-04', 'Procedimiento de recepción y almacenamiento de mercadería',
   'Controles de recepción, verificación documental y ubicación en depósito.',
   'procedimiento', 'vigente', 'c1000000-0000-4000-8000-000000000005', 'b1000000-0000-4000-8000-000000000001',
   'e1000000-0000-4000-8000-000000000004', 'e1000000-0000-4000-8000-000000000004',
   'e1000000-0000-4000-8000-000000000002', 1, current_date - 340, current_date - 340,
   current_date + 12, 12, true, 'e1000000-0000-4000-8000-000000000004'),

  ('01000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111',
   'MP-SOP-05', 'Procedimiento de registro y control de material ante DIMABEL',
   'Registro de ingresos y egresos de material controlado y reportes obligatorios.',
   'procedimiento', 'vigente', 'c1000000-0000-4000-8000-000000000006', 'b1000000-0000-4000-8000-000000000002',
   'e1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000002',
   'e1000000-0000-4000-8000-000000000001', 1, current_date - 355, current_date - 355,
   current_date - 5, 12, true, 'e1000000-0000-4000-8000-000000000002'),

  ('01000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111',
   'POL-01', 'Política de calidad',
   'Compromiso de la dirección con la satisfacción del cliente y la mejora continua.',
   'politica', 'vigente', 'c1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001',
   'e1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000002',
   'e1000000-0000-4000-8000-000000000001', 0, current_date - 400, current_date - 400,
   current_date + 330, 24, true, 'e1000000-0000-4000-8000-000000000002'),

  ('01000000-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111',
   'F-DEP-01-01', 'Formulario de conteo cíclico de inventario',
   'Planilla de registro del conteo cíclico semanal en depósito.',
   'formulario', 'vigente', 'c1000000-0000-4000-8000-000000000005', null,
   'e1000000-0000-4000-8000-000000000004', 'e1000000-0000-4000-8000-000000000004',
   'e1000000-0000-4000-8000-000000000002', 0, current_date - 120, current_date - 120,
   current_date + 245, 12, true, 'e1000000-0000-4000-8000-000000000004'),

  ('01000000-0000-4000-8000-000000000008', '11111111-1111-4111-8111-111111111111',
   'F-COM-01-01', 'Formulario de evaluación de satisfacción del cliente',
   'Encuesta breve entregada al cliente luego de la compra.',
   'formulario', 'en_revision', 'c1000000-0000-4000-8000-000000000003', null,
   'e1000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000003',
   null, 0, null, null, null, 12, true, 'e1000000-0000-4000-8000-000000000003'),

  ('01000000-0000-4000-8000-000000000009', '11111111-1111-4111-8111-111111111111',
   'IT-01', 'Instructivo de arqueo diario de caja',
   'Pasos del arqueo de caja al cierre de cada jornada.',
   'instructivo', 'borrador', 'c1000000-0000-4000-8000-000000000007', null,
   'e1000000-0000-4000-8000-000000000006', 'e1000000-0000-4000-8000-000000000006',
   null, 0, null, null, null, 12, true, 'e1000000-0000-4000-8000-000000000006')
on conflict (id) do nothing;

-- Versiones de cada documento.
insert into public.documento_versiones (
  documento_id, version, estado, resumen_cambios, elaborado_por, aprobado_por, fecha_aprobacion
) values
  ('01000000-0000-4000-8000-000000000001', 0, 'obsoleto', 'Versión inicial del manual.',
   'e1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', now() - interval '500 days'),
  ('01000000-0000-4000-8000-000000000001', 1, 'vigente',
   'Se incorpora el proceso de cumplimiento regulatorio al mapa de procesos.',
   'e1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', now() - interval '200 days'),

  ('01000000-0000-4000-8000-000000000002', 0, 'obsoleto', 'Versión inicial.',
   'e1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', now() - interval '480 days'),
  ('01000000-0000-4000-8000-000000000002', 1, 'obsoleto', 'Se agrega la codificación de formularios.',
   'e1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', now() - interval '300 days'),
  ('01000000-0000-4000-8000-000000000002', 2, 'vigente',
   'Se define la lista de difusión obligatoria y el acuse de publicación.',
   'e1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', now() - interval '90 days'),

  ('01000000-0000-4000-8000-000000000003', 0, 'obsoleto', 'Versión inicial.',
   'e1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', now() - interval '420 days'),
  ('01000000-0000-4000-8000-000000000003', 1, 'vigente',
   'Se incorpora el escalamiento al jefe inmediato a los diez días.',
   'e1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', now() - interval '150 days'),

  ('01000000-0000-4000-8000-000000000004', 0, 'obsoleto', 'Versión inicial.',
   'e1000000-0000-4000-8000-000000000004', 'e1000000-0000-4000-8000-000000000002', now() - interval '700 days'),
  ('01000000-0000-4000-8000-000000000004', 1, 'vigente', 'Se agrega el control de temperatura del depósito.',
   'e1000000-0000-4000-8000-000000000004', 'e1000000-0000-4000-8000-000000000002', now() - interval '340 days'),

  ('01000000-0000-4000-8000-000000000005', 0, 'obsoleto', 'Versión inicial.',
   'e1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', now() - interval '720 days'),
  ('01000000-0000-4000-8000-000000000005', 1, 'vigente',
   'Actualización por la Resolución DIMABEL 112/2019.',
   'e1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', now() - interval '355 days'),

  ('01000000-0000-4000-8000-000000000006', 0, 'vigente', 'Versión inicial de la política.',
   'e1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', now() - interval '400 days'),

  ('01000000-0000-4000-8000-000000000007', 0, 'vigente', 'Versión inicial del formulario.',
   'e1000000-0000-4000-8000-000000000004', 'e1000000-0000-4000-8000-000000000002', now() - interval '120 days'),

  ('01000000-0000-4000-8000-000000000008', 0, 'en_revision',
   'Primera propuesta de encuesta posventa.', 'e1000000-0000-4000-8000-000000000003', null, null),

  ('01000000-0000-4000-8000-000000000009', 0, 'borrador',
   'Borrador inicial del instructivo de arqueo.', 'e1000000-0000-4000-8000-000000000006', null, null);

-- Revisores pendientes de la version en revision.
insert into public.documento_revisores (version_id, usuario_id, estado)
select v.id, 'e1000000-0000-4000-8000-000000000002', 'pendiente'
  from public.documento_versiones v
 where v.documento_id = '01000000-0000-4000-8000-000000000008' and v.version = 0;

insert into public.documento_revisores (version_id, usuario_id, estado)
select v.id, 'e1000000-0000-4000-8000-000000000001', 'pendiente'
  from public.documento_versiones v
 where v.documento_id = '01000000-0000-4000-8000-000000000008' and v.version = 0;

-- Listas de difusion.
insert into public.documento_difusion (documento_id, proceso_id) values
  ('01000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000003'),
  ('01000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000005'),
  ('01000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000005'),
  ('01000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000006'),
  ('01000000-0000-4000-8000-000000000007', 'c1000000-0000-4000-8000-000000000005')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Riesgos y oportunidades
-- ---------------------------------------------------------------------
insert into public.riesgos (
  id, empresa_id, codigo, titulo, descripcion, tipo, categoria, proceso_id,
  responsable_id, estado, causas, consecuencias, controles_existentes, tratamiento,
  probabilidad, impacto, fecha_identificacion, es_demostracion, creado_por
) values
  ('02000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'R-2026-001', 'Diferencias entre el stock físico y el registro ante DIMABEL',
   'El material controlado podría no coincidir con lo declarado en el registro obligatorio.',
   'riesgo', 'Regulatorio', 'c1000000-0000-4000-8000-000000000006',
   'e1000000-0000-4000-8000-000000000002', 'en_tratamiento',
   'Conteos cíclicos sin frecuencia definida y carga manual de movimientos.',
   'Sanción administrativa, suspensión de la licencia comercial y daño reputacional.',
   'Conteo mensual del material controlado y doble firma en cada egreso.',
   'mitigar', 4, 5, current_date - 180, true, 'e1000000-0000-4000-8000-000000000002'),

  ('02000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'R-2026-002', 'Quiebre de stock en temporada alta de pesca',
   'La demanda de equipamiento se concentra entre septiembre y diciembre.',
   'riesgo', 'Operativo', 'c1000000-0000-4000-8000-000000000004',
   'e1000000-0000-4000-8000-000000000005', 'en_tratamiento',
   'Plazos de importación de hasta noventa días y previsión basada solo en el año anterior.',
   'Pérdida de ventas y migración de clientes a la competencia.',
   'Punto de reposición definido para los veinte artículos de mayor rotación.',
   'mitigar', 4, 3, current_date - 150, true, 'e1000000-0000-4000-8000-000000000002'),

  ('02000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'R-2026-003', 'Morosidad creciente en ventas a crédito corporativo',
   'Clientes institucionales con plazos de pago superiores a los acordados.',
   'riesgo', 'Financiero', 'c1000000-0000-4000-8000-000000000007',
   'e1000000-0000-4000-8000-000000000006', 'en_tratamiento',
   'Aprobación de crédito sin análisis formal y seguimiento manual de vencimientos.',
   'Deterioro del flujo de caja y necesidad de financiamiento externo.',
   'Informe semanal de cuentas por cobrar y llamado a los treinta días.',
   'mitigar', 3, 4, current_date - 100, true, 'e1000000-0000-4000-8000-000000000002'),

  ('02000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   'R-2026-004', 'Pérdida de información por falta de respaldo verificado',
   'Los respaldos se generan pero no se verifica su restauración.',
   'riesgo', 'Tecnológico', 'c1000000-0000-4000-8000-000000000008',
   'e1000000-0000-4000-8000-000000000007', 'identificado',
   'No existe una prueba periódica de restauración documentada.',
   'Interrupción de la operación e imposibilidad de reconstruir registros contables.',
   'Respaldo automático diario en la nube.',
   'mitigar', 2, 5, current_date - 60, true, 'e1000000-0000-4000-8000-000000000002'),

  ('02000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111',
   'R-2026-005', 'Venta sin verificación completa de la documentación del comprador',
   'Riesgo de concretar una venta de material controlado sin la habilitación vigente.',
   'riesgo', 'Regulatorio', 'c1000000-0000-4000-8000-000000000003',
   'e1000000-0000-4000-8000-000000000003', 'en_tratamiento',
   'Alta rotación de vendedores y verificación apoyada en la memoria del personal.',
   'Responsabilidad penal y administrativa para la empresa y el vendedor.',
   'Lista de verificación obligatoria antes de la facturación.',
   'evitar', 2, 5, current_date - 220, true, 'e1000000-0000-4000-8000-000000000002'),

  ('02000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111',
   'R-2026-006', 'Deterioro de mercadería por humedad en el depósito',
   'El sector de carpas y bolsas de dormir presenta humedad en época de lluvias.',
   'riesgo', 'Operativo', 'c1000000-0000-4000-8000-000000000005',
   'e1000000-0000-4000-8000-000000000004', 'controlado',
   'Falta de aislamiento en el sector oeste del depósito.',
   'Pérdida de mercadería y reclamos por calidad del producto.',
   'Deshumidificadores instalados y control diario de temperatura.',
   'mitigar', 2, 3, current_date - 300, true, 'e1000000-0000-4000-8000-000000000002'),

  ('02000000-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111',
   'R-2026-007', 'Dependencia de un único proveedor de municiones',
   'El 80 % del abastecimiento de municiones proviene de un solo proveedor.',
   'riesgo', 'Cadena de suministro', 'c1000000-0000-4000-8000-000000000004',
   'e1000000-0000-4000-8000-000000000005', 'identificado',
   'Ausencia de proveedores alternativos homologados.',
   'Interrupción del abastecimiento ante cualquier contingencia del proveedor.',
   'Contrato anual con volumen comprometido.',
   'mitigar', 3, 3, current_date - 45, true, 'e1000000-0000-4000-8000-000000000002'),

  ('02000000-0000-4000-8000-000000000008', '11111111-1111-4111-8111-111111111111',
   'R-2026-008', 'Apertura del canal de venta en línea para equipamiento outdoor',
   'La demanda de equipamiento de campamento crece fuera del área metropolitana.',
   'oportunidad', 'Comercial', 'c1000000-0000-4000-8000-000000000003',
   'e1000000-0000-4000-8000-000000000003', 'identificado',
   'Consultas recurrentes de clientes del interior por redes sociales.',
   'Ampliación del alcance comercial sin abrir una sucursal física.',
   'Catálogo digital publicado y despacho por encomienda.',
   'explotar', 4, 4, current_date - 30, true, 'e1000000-0000-4000-8000-000000000002')
on conflict (id) do nothing;

-- Evaluacion residual de los riesgos ya tratados.
update public.riesgos set probabilidad_residual = 2, impacto_residual = 5
  where id = '02000000-0000-4000-8000-000000000001';
update public.riesgos set probabilidad_residual = 1, impacto_residual = 3
  where id = '02000000-0000-4000-8000-000000000006';

-- Algunas fechas de reevaluacion ya vencidas, para que el tablero y el
-- trabajo programado tengan casos reales que mostrar.
update public.riesgos set fecha_proxima_revision = current_date - 3
  where id = '02000000-0000-4000-8000-000000000005';
update public.riesgos set fecha_proxima_revision = current_date + 5
  where id = '02000000-0000-4000-8000-000000000003';

insert into public.riesgo_evaluaciones (riesgo_id, fecha, probabilidad, impacto, comentario, evaluado_por) values
  ('02000000-0000-4000-8000-000000000001', current_date - 180, 4, 5, 'Evaluación inicial.', 'e1000000-0000-4000-8000-000000000002'),
  ('02000000-0000-4000-8000-000000000001', current_date - 30, 2, 5, 'Riesgo residual tras implantar el conteo mensual.', 'e1000000-0000-4000-8000-000000000002'),
  ('02000000-0000-4000-8000-000000000002', current_date - 150, 4, 3, 'Evaluación inicial.', 'e1000000-0000-4000-8000-000000000005'),
  ('02000000-0000-4000-8000-000000000003', current_date - 100, 3, 4, 'Evaluación inicial.', 'e1000000-0000-4000-8000-000000000006'),
  ('02000000-0000-4000-8000-000000000005', current_date - 220, 3, 5, 'Evaluación inicial.', 'e1000000-0000-4000-8000-000000000003'),
  ('02000000-0000-4000-8000-000000000005', current_date - 90, 2, 5, 'Baja de probabilidad por la lista de verificación obligatoria.', 'e1000000-0000-4000-8000-000000000003'),
  ('02000000-0000-4000-8000-000000000006', current_date - 300, 3, 3, 'Evaluación inicial.', 'e1000000-0000-4000-8000-000000000004'),
  ('02000000-0000-4000-8000-000000000006', current_date - 40, 1, 3, 'Riesgo residual tras instalar los deshumidificadores.', 'e1000000-0000-4000-8000-000000000004');

insert into public.riesgo_acciones (riesgo_id, descripcion, tratamiento, responsable_id, fecha_limite, estado, fecha_ejecucion) values
  ('02000000-0000-4000-8000-000000000001',
   'Definir la frecuencia del conteo cíclico de material controlado en el procedimiento MP-SOP-04.',
   'mitigar', 'e1000000-0000-4000-8000-000000000004', current_date - 20, 'ejecutada', current_date - 25),
  ('02000000-0000-4000-8000-000000000001',
   'Conciliar mensualmente el stock físico contra el registro presentado ante DIMABEL.',
   'mitigar', 'e1000000-0000-4000-8000-000000000002', current_date + 25, 'en_curso', null),
  ('02000000-0000-4000-8000-000000000002',
   'Adelantar la orden de compra de temporada a julio de cada año.',
   'mitigar', 'e1000000-0000-4000-8000-000000000005', current_date + 40, 'pendiente', null),
  ('02000000-0000-4000-8000-000000000003',
   'Implantar el análisis formal de crédito previo a la aprobación de ventas a plazo.',
   'mitigar', 'e1000000-0000-4000-8000-000000000006', current_date + 15, 'en_curso', null),
  ('02000000-0000-4000-8000-000000000004',
   'Realizar una prueba de restauración trimestral y dejar constancia del resultado.',
   'mitigar', 'e1000000-0000-4000-8000-000000000007', current_date + 30, 'pendiente', null),
  ('02000000-0000-4000-8000-000000000007',
   'Homologar un segundo proveedor de municiones antes del cierre del ejercicio.',
   'mitigar', 'e1000000-0000-4000-8000-000000000005', current_date + 90, 'pendiente', null),
  ('02000000-0000-4000-8000-000000000008',
   'Definir el alcance y la logística de despacho del canal en línea.',
   'explotar', 'e1000000-0000-4000-8000-000000000003', current_date + 60, 'en_curso', null);

-- ---------------------------------------------------------------------
-- No conformidades
-- ---------------------------------------------------------------------
insert into public.no_conformidades (
  id, empresa_id, codigo, titulo, descripcion, origen, severidad, estado,
  proceso_id, sede_id, norma_id, cliente_id, requisito_incumplido,
  correccion_inmediata, conclusion_causa_raiz, detectado_por, responsable_id,
  fecha_deteccion, fecha_limite_cierre, fecha_cierre, cerrado_por, eficacia,
  observacion_eficacia, riesgo_id, es_demostracion, creado_por
) values
  ('03000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'NC-2026-001', 'Diferencia de 3 unidades en el conteo cíclico de material controlado',
   'Durante el conteo cíclico del 12 del mes se detectó una diferencia de tres unidades entre el stock físico y el sistema, en el sector de material controlado del Depósito Central.',
   'proceso_interno', 'critica', 'en_tratamiento',
   'c1000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000003',
   'b1000000-0000-4000-8000-000000000002', null,
   'Ley 4036/2010 · Art. 27 — Registro de existencias',
   'Se bloqueó el egreso del sector y se recontó con doble verificación.',
   'El procedimiento de recepción no define la frecuencia del conteo cíclico ni exige la doble firma en el ingreso de material controlado, por lo que las diferencias se detectan tarde.',
   'e1000000-0000-4000-8000-000000000004', 'e1000000-0000-4000-8000-000000000002',
   current_date - 22, current_date - 2, null, null, 'pendiente', null,
   '02000000-0000-4000-8000-000000000001', true, 'e1000000-0000-4000-8000-000000000004'),

  ('03000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'NC-2026-002', 'Entrega fuera de plazo del proveedor Transportes Ñemity',
   'Tres despachos consecutivos del proveedor PRV-003 llegaron con más de cinco días de atraso respecto de lo comprometido.',
   'proveedor', 'mayor', 'en_verificacion',
   'c1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000003',
   'b1000000-0000-4000-8000-000000000001', null,
   'ISO 9001:2015 · 8.4.1 — Control de proveedores externos',
   'Se recurrió a un transportista alternativo para el despacho urgente.',
   'La evaluación del proveedor se realiza una vez al año y no contempla un umbral de atrasos que active la reevaluación anticipada.',
   'e1000000-0000-4000-8000-000000000005', 'e1000000-0000-4000-8000-000000000005',
   current_date - 45, current_date + 8, null, null, 'pendiente', null,
   null, true, 'e1000000-0000-4000-8000-000000000005'),

  ('03000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'NC-2026-003', 'Reclamo de cliente por asesoramiento incorrecto sobre calibre',
   'El Club de Caza y Pesca reclamó que se le vendió munición de calibre distinto al solicitado, detectado por el cliente al retirar la mercadería.',
   'reclamo_cliente', 'menor', 'cerrada',
   'c1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001',
   'b1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002',
   'ISO 9001:2015 · 8.2.1 — Comunicación con el cliente',
   'Se realizó el cambio en el momento y se dejó constancia en la nota de crédito.',
   'El vendedor no contaba con la capacitación técnica sobre calibres, porque la inducción no incluye ese contenido para el personal nuevo.',
   'e1000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000003',
   current_date - 120, current_date - 90, current_date - 85,
   'e1000000-0000-4000-8000-000000000002', 'eficaz',
   'Se verificaron dos meses posteriores sin reclamos del mismo tipo.',
   null, true, 'e1000000-0000-4000-8000-000000000003'),

  ('03000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   'NC-2026-004', 'Facturación sin verificación de la habilitación del comprador',
   'En una venta del mes anterior se emitió la factura antes de completar la lista de verificación documental obligatoria.',
   'auditoria_interna', 'critica', 'en_analisis',
   'c1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000002',
   'b1000000-0000-4000-8000-000000000002', null,
   'Ley 4036/2010 · Art. 31 — Verificación del adquirente',
   'Se retuvo la entrega hasta completar la verificación documental.',
   null,
   'e1000000-0000-4000-8000-000000000008', 'e1000000-0000-4000-8000-000000000003',
   current_date - 12, current_date + 18, null, null, 'pendiente', null,
   '02000000-0000-4000-8000-000000000005', true, 'e1000000-0000-4000-8000-000000000008'),

  ('03000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111',
   'NC-2026-005', 'Documento MP-SOP-05 vencido en su fecha de revisión',
   'El procedimiento de registro ante DIMABEL superó su fecha de próxima revisión sin que se confirmara la vigencia de su contenido.',
   'auditoria_interna', 'menor', 'abierta',
   'c1000000-0000-4000-8000-000000000002', null,
   'b1000000-0000-4000-8000-000000000001', null,
   'ISO 9001:2015 · 7.5.3 — Control de la información documentada',
   null, null,
   'e1000000-0000-4000-8000-000000000008', 'e1000000-0000-4000-8000-000000000002',
   current_date - 5, current_date + 25, null, null, 'pendiente', null,
   null, true, 'e1000000-0000-4000-8000-000000000008'),

  ('03000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111',
   'NC-2026-006', 'Caja con faltante de Gs. 185.000 en el arqueo del cierre',
   'El arqueo de caja de la Sucursal Shopping arrojó un faltante de Gs. 185.000 respecto del total facturado del día.',
   'proceso_interno', 'menor', 'en_tratamiento',
   'c1000000-0000-4000-8000-000000000007', 'a1000000-0000-4000-8000-000000000002',
   null, null,
   'ISO 9001:2015 · 8.5.1 — Control de la producción y provisión del servicio',
   'Se reconstruyó el movimiento del día con los comprobantes y se ajustó el registro.',
   'El arqueo se realiza sin un instructivo escrito, por lo que cada cajero aplica un criterio distinto para los vales internos.',
   'e1000000-0000-4000-8000-000000000006', 'e1000000-0000-4000-8000-000000000006',
   current_date - 30, current_date + 5, null, null, 'pendiente', null,
   null, true, 'e1000000-0000-4000-8000-000000000006')
on conflict (id) do nothing;

-- Cinco porques de la NC-2026-001.
insert into public.nc_porques (no_conformidad_id, orden, pregunta, respuesta) values
  ('03000000-0000-4000-8000-000000000001', 1, '¿Por qué ocurrió la desviación?',
   'Porque el stock físico no coincidía con el registrado en el sistema.'),
  ('03000000-0000-4000-8000-000000000001', 2, '¿Por qué?',
   'Porque hubo egresos de material que no se cargaron en el momento.'),
  ('03000000-0000-4000-8000-000000000001', 3, '¿Por qué?',
   'Porque el operario carga los movimientos al final del turno, de memoria.'),
  ('03000000-0000-4000-8000-000000000001', 4, '¿Por qué?',
   'Porque el procedimiento no exige la carga inmediata ni la doble firma en el egreso.'),
  ('03000000-0000-4000-8000-000000000001', 5, '¿Por qué?',
   'Porque el procedimiento MP-SOP-04 se redactó antes de que el depósito manejara material controlado y nunca se actualizó.');

-- Ishikawa de la NC-2026-001.
insert into public.nc_ishikawa (no_conformidad_id, categoria, causa, es_causa_raiz) values
  ('03000000-0000-4000-8000-000000000001', 'metodo',
   'El procedimiento no define la frecuencia del conteo cíclico.', true),
  ('03000000-0000-4000-8000-000000000001', 'metodo',
   'No se exige doble firma en el egreso de material controlado.', true),
  ('03000000-0000-4000-8000-000000000001', 'mano_de_obra',
   'La carga de movimientos se hace de memoria al cierre del turno.', false),
  ('03000000-0000-4000-8000-000000000001', 'medicion',
   'No hay indicador de exactitud de inventario que anticipe la diferencia.', false),
  ('03000000-0000-4000-8000-000000000001', 'maquina',
   'El lector de código de barras del sector falla de forma intermitente.', false),
  ('03000000-0000-4000-8000-000000000001', 'medio_ambiente',
   'El sector de material controlado tiene iluminación deficiente.', false);

-- Ishikawa de la NC-2026-003.
insert into public.nc_ishikawa (no_conformidad_id, categoria, causa, es_causa_raiz) values
  ('03000000-0000-4000-8000-000000000003', 'mano_de_obra',
   'El vendedor no recibió capacitación técnica sobre calibres.', true),
  ('03000000-0000-4000-8000-000000000003', 'metodo',
   'La inducción del personal nuevo no incluye contenido técnico de producto.', true);

-- Planes de accion.
insert into public.nc_acciones (
  no_conformidad_id, tipo, descripcion, responsable_id, fecha_limite, estado,
  fecha_ejecucion, evidencia, verificado_por, fecha_verificacion, nivel_escalamiento
) values
  ('03000000-0000-4000-8000-000000000001', 'correccion',
   'Recontar la totalidad del sector de material controlado y ajustar el registro.',
   'e1000000-0000-4000-8000-000000000004', current_date - 18, 'verificada',
   current_date - 19, 'Acta de conteo del sector firmada por depósito y calidad.',
   'e1000000-0000-4000-8000-000000000002', current_date - 15, 0),
  ('03000000-0000-4000-8000-000000000001', 'accion_correctiva',
   'Actualizar el procedimiento MP-SOP-04 incorporando la frecuencia de conteo y la doble firma en el egreso.',
   'e1000000-0000-4000-8000-000000000004', current_date - 14, 'pendiente', null, null, null, null, 1),
  ('03000000-0000-4000-8000-000000000001', 'accion_correctiva',
   'Capacitar al personal de depósito en el procedimiento actualizado.',
   'e1000000-0000-4000-8000-000000000004', current_date + 12, 'pendiente', null, null, null, null, 0),

  ('03000000-0000-4000-8000-000000000002', 'accion_correctiva',
   'Incorporar al procedimiento de compras un umbral de atrasos que active la reevaluación anticipada del proveedor.',
   'e1000000-0000-4000-8000-000000000005', current_date - 5, 'ejecutada',
   current_date - 6, 'Procedimiento actualizado y comunicado a compras.', null, null, 0),
  ('03000000-0000-4000-8000-000000000002', 'accion_correctiva',
   'Reevaluar a Transportes Ñemity fuera del calendario anual.',
   'e1000000-0000-4000-8000-000000000005', current_date + 8, 'en_curso', null, null, null, null, 0),

  ('03000000-0000-4000-8000-000000000003', 'accion_correctiva',
   'Incorporar el módulo técnico de producto a la inducción del personal de salón.',
   'e1000000-0000-4000-8000-000000000003', current_date - 100, 'verificada',
   current_date - 105, 'Plan de inducción actualizado y dictado a tres vendedores.',
   'e1000000-0000-4000-8000-000000000002', current_date - 88, 0),

  ('03000000-0000-4000-8000-000000000004', 'correccion',
   'Completar la verificación documental de la venta observada antes de la entrega.',
   'e1000000-0000-4000-8000-000000000003', current_date - 10, 'ejecutada',
   current_date - 11, 'Lista de verificación completa archivada con la factura.', null, null, 0),
  ('03000000-0000-4000-8000-000000000004', 'accion_correctiva',
   'Bloquear la emisión de la factura en el punto de venta hasta completar la lista de verificación.',
   'e1000000-0000-4000-8000-000000000007', current_date + 18, 'en_curso', null, null, null, null, 0),

  ('03000000-0000-4000-8000-000000000005', 'accion_correctiva',
   'Revisar el contenido del MP-SOP-05 y publicar la versión que corresponda.',
   'e1000000-0000-4000-8000-000000000002', current_date + 20, 'pendiente', null, null, null, null, 0),

  ('03000000-0000-4000-8000-000000000006', 'accion_correctiva',
   'Redactar y aprobar el instructivo de arqueo diario de caja (IT-01).',
   'e1000000-0000-4000-8000-000000000006', current_date + 5, 'en_curso', null, null, null, null, 0);

-- ---------------------------------------------------------------------
-- Auditorias internas
-- ---------------------------------------------------------------------
insert into public.programas_auditoria (id, empresa_id, anio, nombre, objetivo, estado, aprobado_por, fecha_aprobacion, es_demostracion) values
  ('04000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   extract(year from current_date)::int,
   'Programa anual de auditorías internas',
   'Verificar la conformidad del sistema de gestión con la norma ISO 9001:2015 y con la normativa aplicable al material controlado.',
   'en_ejecucion', 'e1000000-0000-4000-8000-000000000001', current_date - 220, true)
on conflict (id) do nothing;

insert into public.auditorias (
  id, empresa_id, programa_id, codigo, tipo, proceso_id, norma_id, sede_id,
  auditor_lider_id, objetivo, alcance, criterios, fecha_planificada, fecha_inicio,
  fecha_fin, estado, conclusiones, es_demostracion
) values
  ('05000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   '04000000-0000-4000-8000-000000000001', 'AUD-2026-01', 'interna',
   'c1000000-0000-4000-8000-000000000005', 'b1000000-0000-4000-8000-000000000001',
   'a1000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000008',
   'Verificar el control de existencias y la trazabilidad del material en depósito.',
   'Recepción, almacenamiento y despacho del Depósito Central.',
   'ISO 9001:2015 y MP-SOP-04.', current_date - 200, current_date - 200,
   current_date - 198, 'cerrada',
   'Se detectaron dos hallazgos, uno de ellos derivado a no conformidad.', true),

  ('05000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   '04000000-0000-4000-8000-000000000001', 'AUD-2026-02', 'interna',
   'c1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000002',
   'a1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000008',
   'Verificar el cumplimiento de la verificación documental previa a la venta.',
   'Proceso comercial de la Sucursal Shopping.',
   'Ley 4036/2010 y MP-SOP-05.', current_date - 15, current_date - 14,
   current_date - 13, 'informe_pendiente', null, true),

  ('05000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   '04000000-0000-4000-8000-000000000001', 'AUD-2026-03', 'interna',
   'c1000000-0000-4000-8000-000000000007', 'b1000000-0000-4000-8000-000000000001',
   'a1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000008',
   'Verificar la gestión de cuentas por cobrar y el arqueo de caja.',
   'Proceso de cobranzas de Casa Central.',
   'ISO 9001:2015.', current_date + 35, null, null, 'planificada', null, true),

  ('05000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   '04000000-0000-4000-8000-000000000001', 'AUD-2026-04', 'interna',
   'c1000000-0000-4000-8000-000000000008', 'b1000000-0000-4000-8000-000000000001',
   'a1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000008',
   'Verificar la gestión de respaldos y la continuidad de los sistemas.',
   'Infraestructura y sistemas de TI.',
   'ISO 9001:2015 · 7.1.3.', current_date + 80, null, null, 'planificada', null, true)
on conflict (id) do nothing;

insert into public.auditoria_equipo (auditoria_id, usuario_id, rol_equipo) values
  ('05000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000008', 'auditor líder'),
  ('05000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000002', 'auditor'),
  ('05000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000008', 'auditor líder')
on conflict do nothing;

insert into public.auditoria_hallazgos (
  auditoria_id, codigo, tipo, requisito, descripcion, evidencia, proceso_id,
  no_conformidad_id, registrado_por
) values
  ('05000000-0000-4000-8000-000000000001', 'H-01', 'no_conformidad_menor',
   'ISO 9001:2015 · 7.5.3',
   'El procedimiento MP-SOP-04 no define la frecuencia del conteo cíclico.',
   'Lectura del procedimiento vigente y entrevista al encargado de depósito.',
   'c1000000-0000-4000-8000-000000000005', '03000000-0000-4000-8000-000000000001',
   'e1000000-0000-4000-8000-000000000008'),
  ('05000000-0000-4000-8000-000000000001', 'H-02', 'observacion',
   'ISO 9001:2015 · 7.1.3',
   'La iluminación del sector de material controlado dificulta la lectura de las etiquetas.',
   'Verificación en el lugar durante la auditoría.',
   'c1000000-0000-4000-8000-000000000005', null, 'e1000000-0000-4000-8000-000000000008'),
  ('05000000-0000-4000-8000-000000000002', 'H-03', 'no_conformidad_mayor',
   'Ley 4036/2010 · Art. 31',
   'Se emitió una factura de material controlado sin completar la verificación documental del comprador.',
   'Muestreo de diez ventas del período; una sin lista de verificación.',
   'c1000000-0000-4000-8000-000000000003', '03000000-0000-4000-8000-000000000004',
   'e1000000-0000-4000-8000-000000000008'),
  ('05000000-0000-4000-8000-000000000002', 'H-04', 'oportunidad_mejora',
   'ISO 9001:2015 · 7.2',
   'Conviene incorporar la verificación documental como paso bloqueante del punto de venta.',
   'Sugerencia surgida de la entrevista con el jefe comercial.',
   'c1000000-0000-4000-8000-000000000003', null, 'e1000000-0000-4000-8000-000000000008');

-- ---------------------------------------------------------------------
-- Indicadores y objetivos
-- ---------------------------------------------------------------------
insert into public.indicadores (
  id, empresa_id, codigo, nombre, descripcion, proceso_id, responsable_id,
  formula, unidad, frecuencia, sentido, meta, activo, es_demostracion
) values
  ('06000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'KPI-01', 'Exactitud de inventario',
   'Coincidencia entre el stock físico y el registrado en el sistema.',
   'c1000000-0000-4000-8000-000000000005', 'e1000000-0000-4000-8000-000000000004',
   '(1 − diferencias / unidades contadas) × 100', '%', 'mensual', 'mayor_mejor', 98, true, true),
  ('06000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'KPI-02', 'Reclamos de clientes',
   'Cantidad de reclamos formales recibidos en el período.',
   'c1000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000003',
   'Suma de reclamos registrados', 'reclamos', 'mensual', 'menor_mejor', 2, true, true),
  ('06000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'KPI-03', 'Morosidad de la cartera',
   'Proporción de la cartera con más de treinta días de atraso.',
   'c1000000-0000-4000-8000-000000000007', 'e1000000-0000-4000-8000-000000000006',
   'Cartera vencida / cartera total × 100', '%', 'mensual', 'menor_mejor', 8, true, true),
  ('06000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   'KPI-04', 'Cumplimiento del plan de auditorías',
   'Auditorías cerradas sobre auditorías planificadas del año.',
   'c1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000002',
   'Auditorías cerradas / planificadas × 100', '%', 'trimestral', 'mayor_mejor', 100, true, true),
  ('06000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111',
   'KPI-05', 'Cierre de no conformidades en plazo',
   'No conformidades cerradas dentro de la fecha límite comprometida.',
   'c1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000002',
   'NC cerradas en plazo / NC cerradas × 100', '%', 'mensual', 'mayor_mejor', 90, true, true),
  ('06000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111',
   'KPI-06', 'Entregas de proveedores en plazo',
   'Despachos recibidos dentro del plazo comprometido.',
   'c1000000-0000-4000-8000-000000000004', 'e1000000-0000-4000-8000-000000000005',
   'Entregas en plazo / entregas totales × 100', '%', 'mensual', 'mayor_mejor', 95, true, true)
on conflict (id) do nothing;

-- Mediciones de los ultimos seis meses.
insert into public.indicador_mediciones (indicador_id, periodo, valor_real, meta_periodo, cargado_por)
select
  i.id,
  (date_trunc('month', current_date) - (mes || ' months')::interval)::date,
  case i.codigo
    when 'KPI-01' then (96.4 + mes * 0.3)::numeric(14,2)
    when 'KPI-02' then greatest(0, 4 - mes)::numeric(14,2)
    when 'KPI-03' then (11.5 - mes * 0.6)::numeric(14,2)
    when 'KPI-04' then (50 + mes * 5)::numeric(14,2)
    when 'KPI-05' then (84 + mes * 1.5)::numeric(14,2)
    else (92.5 + mes * 0.4)::numeric(14,2)
  end,
  i.meta,
  'e1000000-0000-4000-8000-000000000002'
from public.indicadores i
cross join generate_series(0, 5) as mes
where i.es_demostracion
  and (i.frecuencia = 'mensual' or mes % 3 = 0)
on conflict (indicador_id, periodo) do nothing;

insert into public.objetivos (
  id, empresa_id, codigo, nombre, descripcion, proceso_id, responsable_id,
  anio, meta, avance_porcentaje, estado, es_demostracion
) values
  ('07000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'OBJ-01', 'Elevar la exactitud de inventario al 99 %',
   'Reducir las diferencias de inventario mediante el conteo cíclico y la doble firma.',
   'c1000000-0000-4000-8000-000000000005', 'e1000000-0000-4000-8000-000000000004',
   extract(year from current_date)::int, '99 % de exactitud sostenida', 65, 'en_curso', true),
  ('07000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'OBJ-02', 'Reducir la morosidad por debajo del 8 %',
   'Implantar el análisis de crédito previo y el seguimiento semanal de la cartera.',
   'c1000000-0000-4000-8000-000000000007', 'e1000000-0000-4000-8000-000000000006',
   extract(year from current_date)::int, 'Morosidad menor al 8 %', 45, 'en_curso', true),
  ('07000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'OBJ-03', 'Cerrar el 100 % del programa anual de auditorías',
   'Ejecutar las cuatro auditorías internas planificadas para el ejercicio.',
   'c1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000002',
   extract(year from current_date)::int, '4 de 4 auditorías cerradas', 25, 'en_curso', true)
on conflict (id) do nothing;

insert into public.objetivo_indicadores (objetivo_id, indicador_id) values
  ('07000000-0000-4000-8000-000000000001', '06000000-0000-4000-8000-000000000001'),
  ('07000000-0000-4000-8000-000000000002', '06000000-0000-4000-8000-000000000003'),
  ('07000000-0000-4000-8000-000000000003', '06000000-0000-4000-8000-000000000004')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Satisfaccion del cliente
-- ---------------------------------------------------------------------
-- Nota: el panel de NPS de Camping 44 sigue siendo la fuente real. Estos
-- registros solo ilustran la estructura preparada para ingerirlos.
insert into public.encuestas (
  id, empresa_id, codigo, nombre, tipo, descripcion, fecha_inicio, fecha_fin,
  activa, fuente_externa, es_demostracion
) values
  ('08000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'ENC-01', 'NPS posventa', 'nps',
   'Encuesta breve enviada al cliente luego de la compra.',
   current_date - 180, null, true, 'panel-nps-apps-script', true)
on conflict (id) do nothing;

insert into public.encuesta_respuestas (encuesta_id, cliente_id, fecha, puntaje, comentario, canal, sede_id, referencia_externa) values
  ('08000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', current_date - 5, 10,
   'Excelente asesoramiento técnico en el mostrador.', 'correo', 'a1000000-0000-4000-8000-000000000001', 'demo-001'),
  ('08000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002', current_date - 9, 6,
   'Me entregaron un calibre distinto al pedido; se resolvió, pero perdí el viaje.', 'correo', 'a1000000-0000-4000-8000-000000000001', 'demo-002'),
  ('08000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000003', current_date - 14, 9,
   'Muy buena atención y stock disponible.', 'whatsapp', 'a1000000-0000-4000-8000-000000000002', 'demo-003'),
  ('08000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000004', current_date - 20, 8,
   'Buen producto, la entrega demoró más de lo previsto.', 'correo', 'a1000000-0000-4000-8000-000000000003', 'demo-004'),
  ('08000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', current_date - 32, 9,
   'Cumplieron con el plazo comprometido.', 'correo', 'a1000000-0000-4000-8000-000000000001', 'demo-005'),
  ('08000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000003', current_date - 41, 4,
   'Demora de dos semanas en la entrega de un pedido ya pagado.', 'telefono', 'a1000000-0000-4000-8000-000000000003', 'demo-006'),
  ('08000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002', current_date - 55, 10,
   'El personal conoce el producto, se nota la capacitación.', 'correo', 'a1000000-0000-4000-8000-000000000002', 'demo-007'),
  ('08000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000004', current_date - 70, 7,
   'Todo correcto, sin observaciones.', 'correo', 'a1000000-0000-4000-8000-000000000001', 'demo-008')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Recursos humanos
-- ---------------------------------------------------------------------
insert into public.competencias (id, empresa_id, codigo, nombre, descripcion, tipo) values
  ('09000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'CMP-01', 'Conocimiento técnico de producto',
   'Calibres, munición, compatibilidad y uso del equipamiento comercializado.', 'tecnica'),
  ('09000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'CMP-02', 'Normativa de material controlado',
   'Ley 4036/2010 y resoluciones de DIMABEL aplicables a la venta.', 'legal'),
  ('09000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'CMP-03', 'Atención al cliente',
   'Escucha, asesoramiento y manejo de reclamos.', 'conductual'),
  ('09000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   'CMP-04', 'Gestión de inventarios',
   'Conteo cíclico, trazabilidad y control de existencias.', 'tecnica'),
  ('09000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111',
   'CMP-05', 'Sistema de gestión de la calidad',
   'Norma ISO 9001:2015 y procedimientos internos del SGC.', 'tecnica')
on conflict (id) do nothing;

insert into public.puesto_competencias (puesto_id, competencia_id, nivel_requerido, critica) values
  ('d1000000-0000-4000-8000-000000000004', '09000000-0000-4000-8000-000000000001', 4, true),
  ('d1000000-0000-4000-8000-000000000004', '09000000-0000-4000-8000-000000000002', 5, true),
  ('d1000000-0000-4000-8000-000000000004', '09000000-0000-4000-8000-000000000003', 4, false),
  ('d1000000-0000-4000-8000-000000000005', '09000000-0000-4000-8000-000000000004', 5, true),
  ('d1000000-0000-4000-8000-000000000005', '09000000-0000-4000-8000-000000000002', 4, true),
  ('d1000000-0000-4000-8000-000000000002', '09000000-0000-4000-8000-000000000005', 5, true),
  ('d1000000-0000-4000-8000-000000000003', '09000000-0000-4000-8000-000000000001', 5, true)
on conflict do nothing;

insert into public.evaluaciones_competencia (usuario_id, competencia_id, nivel_actual, nivel_requerido, fecha, evaluado_por, observacion) values
  ('e1000000-0000-4000-8000-000000000009', '09000000-0000-4000-8000-000000000001', 2, 4, current_date - 110,
   'e1000000-0000-4000-8000-000000000003', 'Brecha detectada a raíz del reclamo NC-2026-003.'),
  ('e1000000-0000-4000-8000-000000000009', '09000000-0000-4000-8000-000000000002', 4, 5, current_date - 110,
   'e1000000-0000-4000-8000-000000000003', 'Conoce la normativa; falta profundizar en resoluciones recientes.'),
  ('e1000000-0000-4000-8000-000000000009', '09000000-0000-4000-8000-000000000003', 4, 4, current_date - 110,
   'e1000000-0000-4000-8000-000000000003', 'Sin brecha.'),
  ('e1000000-0000-4000-8000-000000000004', '09000000-0000-4000-8000-000000000004', 4, 5, current_date - 60,
   'e1000000-0000-4000-8000-000000000001', 'Brecha a cubrir con la capacitación de inventarios.');

insert into public.capacitaciones (
  id, empresa_id, codigo, nombre, descripcion, tipo, proveedor_nombre, instructor,
  fecha_inicio, fecha_fin, horas, costo_gs, estado, competencia_id, es_demostracion
) values
  ('0a000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'CAP-01', 'Inducción técnica de producto para personal de salón',
   'Calibres, munición y compatibilidad del equipamiento comercializado.',
   'interna', null, 'Lucía Ayala', current_date - 100, current_date - 99, 8, 0,
   'finalizada', '09000000-0000-4000-8000-000000000001', true),
  ('0a000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'CAP-02', 'Actualización normativa Ley 4036/2010 y resoluciones DIMABEL',
   'Obligaciones de registro, verificación del adquirente y reportes.',
   'externa', 'Consultora Legal Guaraní', 'Abg. R. Espínola',
   current_date - 45, current_date - 45, 6, 3711850, 'finalizada',
   '09000000-0000-4000-8000-000000000002', true),
  ('0a000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'CAP-03', 'Conteo cíclico y trazabilidad de inventario',
   'Metodología de conteo, ajustes y control de material controlado.',
   'interna', null, 'Marcos Duarte', current_date + 20, current_date + 20, 4, 0,
   'planificada', '09000000-0000-4000-8000-000000000004', true),
  ('0a000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   'CAP-04', 'Formación de auditores internos ISO 9001:2015',
   'Planificación, ejecución e informe de auditorías internas.',
   'externa', 'Instituto de Calidad del Paraguay', 'Ing. M. Sanabria',
   current_date + 55, current_date + 57, 16, 12500000, 'planificada',
   '09000000-0000-4000-8000-000000000005', true)
on conflict (id) do nothing;

insert into public.capacitacion_participantes (capacitacion_id, usuario_id, asistio, calificacion, eficacia, fecha_evaluacion_eficacia, observacion) values
  ('0a000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000009', true, 88, 'eficaz',
   current_date - 70, 'Sin reclamos por asesoramiento desde la capacitación.'),
  ('0a000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000003', true, 95, 'eficaz',
   current_date - 70, 'Replicó el contenido al resto del equipo.'),
  ('0a000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000003', true, 90, 'pendiente', null, null),
  ('0a000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000002', true, 92, 'pendiente', null, null),
  ('0a000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000009', false, null, 'no_eficaz',
   current_date - 20, 'No asistió; se reprograma su participación.'),
  ('0a000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000004', false, null, 'pendiente', null, null)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Infraestructura y activos
-- ---------------------------------------------------------------------
insert into public.activos (
  id, empresa_id, codigo, nombre, categoria, descripcion, sede_id, ubicacion,
  responsable_id, proveedor_id, numero_serie, marca, modelo, estado,
  fecha_adquisicion, valor_gs, requiere_mantenimiento,
  frecuencia_mantenimiento_dias, fecha_ultimo_mantenimiento,
  fecha_proximo_mantenimiento, es_demostracion
) values
  ('0b000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'ACT-001', 'Servidor de aplicaciones', 'Equipamiento informático',
   'Servidor local de respaldo y sistemas administrativos.',
   'a1000000-0000-4000-8000-000000000001', 'Sala de servidores',
   'e1000000-0000-4000-8000-000000000007', 'f2000000-0000-4000-8000-000000000005',
   'SRV-2023-118', 'Dell', 'PowerEdge T350', 'operativo',
   current_date - 800, 48500000, true, 180, current_date - 150, current_date + 30, true),

  ('0b000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'ACT-002', 'Caja fuerte de material controlado', 'Seguridad',
   'Resguardo del material controlado fuera del horario comercial.',
   'a1000000-0000-4000-8000-000000000003', 'Sector A, depósito',
   'e1000000-0000-4000-8000-000000000004', null,
   'CF-9912', 'Bulldog', 'BD-450', 'operativo',
   current_date - 1200, 22000000, true, 365, current_date - 340, current_date + 25, true),

  ('0b000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'ACT-003', 'Autoelevador manual', 'Logística',
   'Movimiento de pallets en el depósito central.',
   'a1000000-0000-4000-8000-000000000003', 'Playa de recepción',
   'e1000000-0000-4000-8000-000000000004', null,
   'AE-2201', 'Toyota', 'HW-25', 'en_mantenimiento',
   current_date - 500, 15750000, true, 90, current_date - 95, current_date - 5, true),

  ('0b000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   'ACT-004', 'Sistema de videovigilancia', 'Seguridad',
   'Doce cámaras distribuidas entre Casa Central y depósito.',
   'a1000000-0000-4000-8000-000000000001', 'Perimetral',
   'e1000000-0000-4000-8000-000000000007', 'f2000000-0000-4000-8000-000000000005',
   'CCTV-4412', 'Hikvision', 'DS-7616', 'operativo',
   current_date - 600, 31200000, true, 120, current_date - 40, current_date + 80, true),

  ('0b000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111',
   'ACT-005', 'Deshumidificador industrial', 'Acondicionamiento',
   'Control de humedad del sector de carpas y bolsas de dormir.',
   'a1000000-0000-4000-8000-000000000003', 'Sector oeste',
   'e1000000-0000-4000-8000-000000000004', null,
   'DH-7781', 'Trotec', 'TTK-175', 'operativo',
   current_date - 280, 8900000, true, 60, current_date - 20, current_date + 40, true),

  ('0b000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111',
   'ACT-006', 'Punto de venta Sucursal Shopping', 'Equipamiento informático',
   'Terminal, impresora fiscal y lector de código de barras.',
   'a1000000-0000-4000-8000-000000000002', 'Mostrador',
   'e1000000-0000-4000-8000-000000000007', 'f2000000-0000-4000-8000-000000000005',
   'PDV-3310', 'HP', 'RP5800', 'operativo',
   current_date - 400, 12300000, false, null, null, null, true)
on conflict (id) do nothing;

insert into public.mantenimientos (
  activo_id, tipo, descripcion, fecha_programada, fecha_ejecucion, responsable_id,
  proveedor_id, estado, costo_gs, observacion
) values
  ('0b000000-0000-4000-8000-000000000001', 'preventivo',
   'Limpieza interna, verificación de discos y prueba de restauración de respaldos.',
   current_date + 30, null, 'e1000000-0000-4000-8000-000000000007',
   'f2000000-0000-4000-8000-000000000005', 'programado', 1850000, null),
  ('0b000000-0000-4000-8000-000000000002', 'verificacion',
   'Verificación anual del mecanismo de cierre y cambio de combinación.',
   current_date + 25, null, 'e1000000-0000-4000-8000-000000000004', null,
   'programado', 950000, null),
  ('0b000000-0000-4000-8000-000000000003', 'correctivo',
   'Reparación del sistema hidráulico.', current_date - 5, null,
   'e1000000-0000-4000-8000-000000000004', null, 'en_curso', 2400000,
   'Equipo fuera de servicio hasta la reparación.'),
  ('0b000000-0000-4000-8000-000000000005', 'preventivo',
   'Limpieza de filtros y control de la descarga de condensado.',
   current_date + 40, null, 'e1000000-0000-4000-8000-000000000004', null,
   'programado', 350000, null),
  ('0b000000-0000-4000-8000-000000000004', 'preventivo',
   'Limpieza de lentes y verificación de grabación de las doce cámaras.',
   current_date - 40, current_date - 40, 'e1000000-0000-4000-8000-000000000007',
   'f2000000-0000-4000-8000-000000000005', 'ejecutado', 1200000,
   'Sin observaciones.');

-- ---------------------------------------------------------------------
-- Cierre
-- ---------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '', false);

do $$
declare
  v_documentos integer;
  v_nc integer;
  v_riesgos integer;
  v_bitacora integer;
begin
  select count(*) into v_documentos from public.documentos;
  select count(*) into v_nc from public.no_conformidades;
  select count(*) into v_riesgos from public.riesgos;
  select count(*) into v_bitacora from public.bitacora;

  raise notice 'Datos de demostración cargados: % documentos, % no conformidades, % riesgos, % movimientos de bitácora.',
    v_documentos, v_nc, v_riesgos, v_bitacora;
end;
$$;
