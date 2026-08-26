-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- ACTUALIZACION · 2 de 2 · DATOS REALES
-- =====================================================================
--
-- Generado por scripts/generar-actualizacion.sh. No editar a mano.
--
-- Correr DESPUES de actualizacion-1-esquema.sql: necesita las columnas
-- y los tipos que agrega aquel.
--
-- Trae el mapa de procesos real de Camping 44, los perfiles de puesto
-- del formulario R-02-01, el juego documental de la unidad compartida
-- del SGC, y retira los procesos que habia inventado el seed.
--
-- Es idempotente: correrlo de nuevo no duplica nada.
-- =====================================================================


-- =====================================================================
-- DATOS REALES: 10-mapa-de-procesos.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- DATOS REALES · Mapa de procesos y manuales de proceso
-- =====================================================================
-- Los diecinueve procesos del mapa de Camping 44, con su manual. Salen
-- de la unidad compartida del SGC, carpeta "04 Manuales de Proceso", que
-- ya esta dividida por tipo: estrategicos, misionales y de soporte.
--
-- Esa division coincide con el enum "tipo_proceso" del sistema:
--   MP-EST → estrategico     MP-MIS → operativo     MP-SOP → apoyo
-- ("misional" y "operativo" son el mismo concepto con distinto nombre;
-- se respeta el del enum para no tocar el esquema por una palabra.)
--
-- Cada proceso queda con su manual cargado en "documentos", enlazado al
-- PDF vigente. No se copia el contenido: la intranet indexa y enlaza.
--
-- Los procesos y documentos de demostracion que compartan codigo quedan
-- reemplazados por el real: el codigo es la identidad, y el documento
-- verdadero es el que debe quedarse con el suyo.
--
-- Se aplica DESPUES del seed. Es idempotente.

do $$
declare
  v_empresa uuid;
  v_responsable uuid;
  v_norma uuid;
  -- Los manuales llevan "Vigencia: 25/05/2026" en su propio encabezado.
  v_vigencia constant date := date '2026-05-25';
  r record;
  v_proceso uuid;
begin
  select id into v_empresa from public.empresas order by creado_en limit 1;
  if v_empresa is null then
    raise exception 'No hay ninguna empresa cargada. Aplique el seed primero.';
  end if;

  select id into v_responsable from public.usuarios
   where empresa_id = v_empresa and rol = 'administrador_sgc' and activo
   order by creado_en limit 1;
  if v_responsable is null then
    select id into v_responsable from public.usuarios
     where empresa_id = v_empresa and activo order by creado_en limit 1;
  end if;
  if v_responsable is null then
    raise exception 'No hay usuarios cargados: no se puede asignar responsable.';
  end if;

  select id into v_norma from public.normas limit 1;

  for r in
    select * from (values
      -- codigo,       tipo,           nombre,                                       id de Drive
      ('MP-EST-01', 'estrategico', 'Información Documentada',                      '1_cG6iIUl61FLdFCon3GEgb3maDCZD7aD'),
      ('MP-EST-02', 'estrategico', 'Planificación Estratégica del SGC',            '1wtuLruEKy8qfUQjKjUfNYkArUvFhUGLT'),
      ('MP-EST-03', 'estrategico', 'Auditoría Interna del SGC',                    '1pX4FwLS9_Kx_baBc1v_JNPLTmSh5qHSJ'),
      ('MP-EST-04', 'estrategico', 'No Conformidades y Acciones Correctivas',      '1JrWpsTWYUTyLUpX_pvyB4skr2kVZLrX8'),
      ('MP-MIS-01', 'operativo',   'Importación',                                  '1uK6ogBarCoj6mFdXSenyzqSI_ze1l3VK'),
      ('MP-MIS-02', 'operativo',   'Almacenamiento',                               '1w9Q9OCwbj9vTrbWa2uMpwkx2sGA_aiHU'),
      ('MP-MIS-03', 'operativo',   'Ventas',                                       '1o_N5HGeBtm0TGz658cVSt-E5QGYp8vEQ'),
      ('MP-MIS-04', 'operativo',   'Despacho de Mercadería',                       '1NmOdaeAPNHp_BDuzO01x3PQ9sREj3PUd'),
      ('MP-MIS-05', 'operativo',   'Servicio Técnico',                             '1MBKJ0cZmOtVxdzy9HcRDXzP8igCiaCca'),
      ('MP-MIS-06', 'operativo',   'Operación del Stand de Tiro',                  '1Zq1dLhcwf0RJZ-pwNkgw3WlgpL4bFUJb'),
      ('MP-MIS-07', 'operativo',   'Gestión del Centro de Instrucción',            '1a2YRd85GynWbAIVt9GcvAl1VyShKwqgT'),
      ('MP-SOP-01', 'apoyo',       'Gestión del Capital Humano',                   '1bsNBt42lKECeizR2Lfa-ILdrU99P-V0O'),
      ('MP-SOP-02', 'apoyo',       'Infraestructura y Tecnología',                 '1T4Yh401khasW6X4iMvx4Vg8r9u4HKZ8j'),
      ('MP-SOP-03', 'apoyo',       'Gestión de Créditos',                          '1hvLfW03V2R7DBztNezqIBXrLyIsS1p57'),
      ('MP-SOP-04', 'apoyo',       'Gestión de Cobranzas',                         '1g-sv1TZxViVkOVHfSPtoNqQ6D8FbDSpc'),
      ('MP-SOP-05', 'apoyo',       'Inventario de Existencias',                    '1Cp3fmOd_czf9SBhedN-WZyffJ5CkT6sh'),
      ('MP-SOP-06', 'apoyo',       'Facturación y Notas de Crédito',               '17pLevHQJZM8ihtQGaHmOuZbPJelpZ5Y-'),
      ('MP-SOP-07', 'apoyo',       'Seguridad Informática',                        '1S4nXqhUevm6y2AuReHmzpci1Pcc1m7h_'),
      ('MP-SOP-08', 'apoyo',       'Compras locales y Evaluación a Proveedores',   '15lT-5jfwblLJh9HwJ-SejK5ytmo9nFIG')
    ) as t(codigo, tipo, nombre, drive_id)
  loop
    -- El proceso lleva el codigo del manual sin el prefijo "MP-": el
    -- manual documenta al proceso, no es el proceso.
    insert into public.procesos (empresa_id, codigo, nombre, tipo, descripcion)
    values (
      v_empresa,
      replace(r.codigo, 'MP-', ''),
      r.nombre,
      r.tipo::public.tipo_proceso,
      'Documentado en el manual ' || r.codigo || '.'
    )
    on conflict (empresa_id, lower(codigo)) do update set
      nombre = excluded.nombre, tipo = excluded.tipo,
      descripcion = excluded.descripcion
    returning id into v_proceso;

    insert into public.documentos (
      empresa_id, codigo, titulo, tipo, estado, proceso_id, norma_id,
      responsable_id, elaborador_id, version_actual,
      fecha_aprobacion, fecha_vigencia, fecha_proxima_revision,
      periodicidad_revision_meses, es_demostracion, url_documento
    ) values (
      v_empresa, r.codigo, r.nombre, 'manual', 'vigente', v_proceso, v_norma,
      v_responsable, v_responsable, 0,
      v_vigencia, v_vigencia, v_vigencia + interval '12 months', 12, false,
      'https://drive.google.com/file/d/' || r.drive_id || '/view'
    )
    on conflict (empresa_id, upper(codigo)) do update set
      titulo = excluded.titulo,
      tipo = excluded.tipo,
      estado = excluded.estado,
      proceso_id = excluded.proceso_id,
      version_actual = excluded.version_actual,
      fecha_vigencia = excluded.fecha_vigencia,
      fecha_proxima_revision = excluded.fecha_proxima_revision,
      es_demostracion = false,
      url_documento = excluded.url_documento;
  end loop;
end;
$$;


-- =====================================================================
-- DATOS REALES: 20-perfiles-de-puesto.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- DATOS REALES · Perfiles de puesto (formulario R-02-01)
-- =====================================================================
-- Estos NO son datos de demostracion: son los nueve perfiles R-02-01
-- vigentes de Camping 44, transcriptos de los documentos del Drive.
-- Por eso van fuera del seed y no llevan "es_demostracion".
--
-- Se aplica DESPUES del seed, porque necesita que exista la empresa.
--   psql "<cadena de conexion>" -f supabase/datos-reales/perfiles-de-puesto.sql
--
-- Es idempotente: se puede volver a correr y actualiza en lugar de
-- duplicar.
--
-- PENDIENTE DE CALIDAD: el formulario R-02-01 no lleva codigo de puesto,
-- asi que se asignaron correlativos provisionales P-101 en adelante. Si
-- Calidad ya tiene una codificacion, se reemplaza aca.

do $$
declare
  v_empresa uuid;
  v_logistica uuid;
  v_jefe_logistica uuid;
begin
  select id into v_empresa from public.empresas order by creado_en limit 1;
  if v_empresa is null then
    raise exception 'No hay ninguna empresa cargada. Aplique el seed primero.';
  end if;

  -- El proceso de logistica puede no existir todavia; si falta, los
  -- puestos quedan sin proceso en vez de fallar.
  select id into v_logistica from public.procesos
   where empresa_id = v_empresa and nombre ilike '%log%stica%' limit 1;

  -- -------------------------------------------------------------------
  -- Jefe de Logistica. Va primero porque los demas le reportan.
  -- -------------------------------------------------------------------
  insert into public.puestos (
    empresa_id, codigo, nombre, area, proceso_id, mision,
    codigo_formulario, revision, supervisado_por, reemplazado_por,
    responsabilidades_generales, funciones,
    formacion_academica, formacion_complementaria, experiencia,
    requiere_registro_conducir, requiere_movilidad_propia,
    requiere_viajes_interior, requiere_viajes_exterior, requiere_horario_extendido
  ) values (
    v_empresa, 'P-101', 'Jefe de Logística', 'Logística y Operaciones', v_logistica,
    'Gestiona el área Logística y de distribución, liderando a su equipo de trabajo con la finalidad de garantizar el cumplimiento de las metas, objetivos y valores de la Empresa.',
    'R-02-01', 0,
    'Gerente de Operaciones y Relaciones Corporativas',
    'Gerente de Operaciones y Relaciones Corporativas',
    'Planificar, coordinar y supervisar integralmente las actividades logísticas de la organización, garantizando la eficiencia operativa en el almacenamiento, mantenimiento, transporte y distribución de mercaderías. Asegura el funcionamiento óptimo de los recursos físicos (vehículos, maquinarias, instalaciones y depósitos), gestiona la logística de importaciones y controla el stock.',
    array[
      'Organizar y dirigir las actividades diarias de su equipo.',
      'Mantener en condiciones óptimas los móviles y maquinarias.',
      'Dirigir y controlar el mantenimiento edilicio.',
      'Coordinar y dirigir el envío de mercaderías para los clientes mayoristas.',
      'Gestionar con la aseguradora de rodados las coberturas de reparaciones en caso de siniestros.',
      'Control y actualización del stock de mercaderías.',
      'Organizar y coordinar la logística de las importaciones en los procesos de compra de mercadería.',
      'Mantener en condiciones óptimas el depósito.',
      'Colabora en los procesos de cambio planeados para el mejoramiento continuo de la organización.',
      'Promueve un clima apropiado para el desarrollo del trabajo en equipo, con calidad y productividad.',
      'Realiza las tareas de acuerdo a lo establecido en los procedimientos.',
      'Ejecuta otras tareas relacionadas a sus funciones que le sean encomendadas.'
    ],
    'Bachiller concluido.',
    'Manejo de herramientas informáticas. Curso de Excel Intermedio.',
    'Experiencia previa mínima de 1 año en cargos similares.',
    true, false, false, false, true
  )
  on conflict (empresa_id, lower(codigo)) do update set
    nombre = excluded.nombre, mision = excluded.mision,
    supervisado_por = excluded.supervisado_por, funciones = excluded.funciones,
    responsabilidades_generales = excluded.responsabilidades_generales;

  select id into v_jefe_logistica from public.puestos
   where empresa_id = v_empresa and codigo = 'P-101';

  -- -------------------------------------------------------------------
  -- Responsable IT. Depende de Administracion y Finanzas, no de Logistica.
  -- -------------------------------------------------------------------
  insert into public.puestos (
    empresa_id, codigo, nombre, area, mision,
    codigo_formulario, revision, supervisado_por,
    responsabilidades_generales, funciones,
    formacion_academica, experiencia,
    requiere_registro_conducir, requiere_movilidad_propia,
    requiere_viajes_interior, requiere_viajes_exterior, requiere_horario_extendido
  ) values (
    v_empresa, 'P-102', 'Responsable IT', 'Administración y Finanzas',
    'Administrar, mantener y desarrollar la infraestructura tecnológica de la empresa, incluyendo hardware, software, servidores, red, celulares corporativos y seguridad de la información. Brindar soporte técnico a los usuarios y colaborar en la implementación, mantenimiento y personalización del sistema Odoo, garantizando el funcionamiento estable y seguro de los recursos informáticos.',
    'R-02-01', 0,
    'Gerente Administrativo y Financiero',
    'Asegurar la disponibilidad, seguridad y eficiencia de los sistemas informáticos y de comunicación de la empresa, garantizando la continuidad operativa de las áreas.',
    array[
      'Administrar y mantener el hardware de la empresa: montaje, instalación, configuración y mantenimiento preventivo y correctivo de equipos informáticos, impresoras y periféricos.',
      'Administrar y mantener el software utilizado por la empresa: instalación, actualización, configuración y control de licencias.',
      'Controlar y ejecutar respaldos de seguridad de todos los sistemas informáticos y garantizar su resguardo.',
      'Monitorear el correcto funcionamiento de servidores, redes internas, conexiones de internet, puntos de acceso y sistemas de seguridad.',
      'Administrar los accesos, perfiles y contraseñas de los usuarios en los distintos sistemas y plataformas.',
      'Implementar y supervisar las políticas de seguridad informática y protección de datos.',
      'Configurar, mantener y controlar los celulares corporativos, planes de datos, líneas y cuentas de Google.',
      'Participar en el mantenimiento y desarrollo básico de Odoo ERP.',
      'Colaborar en el mantenimiento de la página web y herramientas de análisis.',
      'Documentar configuraciones, procedimientos técnicos y protocolos de soporte.',
      'Brindar soporte técnico a usuarios: hardware, software, conectividad, correo e impresoras.',
      'Supervisar la contratación de servicios externos verificando su cumplimiento.',
      'Mantener actualizado el inventario de hardware, licencias, líneas y equipos corporativos.',
      'Capacitar e instruir a los usuarios en el uso seguro de los sistemas y equipos.',
      'Reportar al superior inmediato las necesidades de actualización tecnológica, reemplazo de equipos o riesgos detectados.'
    ],
    'Estudiante de la carrera de informática o afines.',
    '2 años en cargo con responsabilidades similares.',
    false, false, false, false, false
  )
  on conflict (empresa_id, lower(codigo)) do update set
    nombre = excluded.nombre, mision = excluded.mision,
    supervisado_por = excluded.supervisado_por, funciones = excluded.funciones,
    responsabilidades_generales = excluded.responsabilidades_generales;
end;
$$;

-- ---------------------------------------------------------------------
-- Los siete puestos que reportan al Jefe de Logistica.
-- Comparten supervisor, formulario y revision; cambia la mision, las
-- funciones y los requisitos.
-- ---------------------------------------------------------------------
do $$
declare
  v_empresa uuid;
  v_logistica uuid;
  v_jefe uuid;
begin
  select id into v_empresa from public.empresas order by creado_en limit 1;
  select id into v_logistica from public.procesos
   where empresa_id = v_empresa and nombre ilike '%log%stica%' limit 1;
  select id into v_jefe from public.puestos
   where empresa_id = v_empresa and codigo = 'P-101';

  insert into public.puestos (
    empresa_id, codigo, nombre, area, proceso_id, reporta_a_puesto_id, mision,
    codigo_formulario, revision, supervisado_por, reemplazado_por,
    responsabilidades_generales, funciones,
    formacion_academica, formacion_complementaria, experiencia,
    requiere_registro_conducir, requiere_movilidad_propia,
    requiere_viajes_interior, requiere_viajes_exterior, requiere_horario_extendido
  ) values

  (v_empresa, 'P-103', 'Asistente de Logística Mayorista', 'Logística y Operaciones', v_logistica, v_jefe,
   'Coordina y ejecuta de manera eficiente los procesos logísticos y administrativos relacionados con la preparación, facturación y envío de pedidos mayoristas, garantizando el cumplimiento de los plazos establecidos y la correcta documentación, en colaboración con el área comercial y otras áreas involucradas.',
   'R-02-01', 0, 'Jefe de Logística', null, null,
   array[
     'Procesar y facturar las Notas de Pedido generadas por el área Comercial, considerando los detalles inherentes a cada pedido, tipo de mercadería y cliente.',
     'Realizar la preparación física de los pedidos.',
     'Monitorear el estado de cada pedido, manteniendo actualizada la planilla de Ventas Mayoristas.',
     'Colaborar según necesidad en la verificación de mercaderías que se reciben por importación, en DIGEMABEL o en Aduanas.',
     'Colaborar con la atención a personas de otros departamentos que precisen productos o asistencia de Logística.',
     'Actualizar el registro de todos los pedidos enviados, sea por transportadora, móvil de C44, retiro por vendedores o delivery.',
     'Entregar las Notas de Pedido, Guía de Envío y duplicados de facturas a los departamentos correspondientes.',
     'Colaborar en los procesos de cambio planificados para el mejoramiento continuo de la Organización.',
     'Promover el desarrollo de la cultura organizacional.',
     'Realizar las tareas de acuerdo a lo establecido en los procedimientos.',
     'Ejecutar otras tareas relacionadas a sus funciones que le sean encomendadas.'
   ],
   'Bachiller concluido.', 'Curso de Excel Básico.',
   'Experiencia previa mínima 1 año en cargos similares.',
   true, false, false, false, true),

  (v_empresa, 'P-104', 'Asistente de Gestiones', 'Logística y Operaciones', v_logistica, v_jefe,
   'Coordina y ejecuta las gestiones administrativas y operativas solicitadas por el área administrativa. Asegura una eficiente entrega de pedidos a clientes en el área metropolitana y la correcta preparación, control y envío de pedidos mayoristas.',
   'R-02-01', 0, 'Jefe de Logística', null, null,
   array[
     'Preparar físicamente los pedidos mayoristas.',
     'Realizar entrega de pedidos en la zona metropolitana.',
     'Controlar y trasladar los pedidos del interior del país a la transportadora.',
     'Colaborar en los procesos de cambio planificados para el mejoramiento continuo de la Organización.',
     'Promover el desarrollo de la cultura organizacional.',
     'Realizar las tareas de acuerdo a lo establecido en los procedimientos.',
     'Ejecutar otras tareas relacionadas a sus funciones que le sean encomendadas.'
   ],
   'Bachiller concluido.', 'Curso de Excel básico.',
   'Experiencia previa mínima de 1 año en cargos similares.',
   true, false, false, false, true),

  (v_empresa, 'P-105', 'Gestor de Cobranzas y Entregas', 'Logística y Operaciones', v_logistica, v_jefe,
   'Es responsable de realizar las gestiones de documentos necesarios para los trámites ante la DIGEMABEL. Realizar entrega de pedidos, gestiones de cobranza y otras tareas relacionadas al área de logística.',
   'R-02-01', 0, 'Jefe de Logística', 'Asistente de logística',
   'Apoyar operativamente al área de Logística.',
   array[
     'Coordinar con la Asistente DIMABEL los documentos a ser gestionados.',
     'Coordinar con la Analista de Créditos y Cobranzas la hoja de ruta para los cobros a clientes.',
     'Controlar los recibos y pagarés previa entrega al cliente.',
     'Rendir en caja el efectivo cobrado con la documentación pertinente.',
     'Coordinar con el Jefe de Logística la hoja de ruta u otras tareas para la jornada.',
     'Controlar antes de salir de C44 la factura y mercadería a ser entregada al cliente.',
     'Cuidar y velar por el correcto manejo de la motocicleta y otros móviles de la empresa que le fueran asignados.',
     'Colaborar en los procesos de cambio planificados para el mejoramiento continuo de la Organización.',
     'Promover un clima apropiado para el desarrollo del trabajo en equipo, con calidad y productividad.',
     'Realizar las tareas de acuerdo a lo establecido en los procedimientos.',
     'Ejecutar otras tareas relacionadas a sus funciones que le sean encomendadas.'
   ],
   'Bachiller concluido.', null,
   'Experiencia previa mínima de 1 año en cargos similares.',
   true, true, false, false, false),

  (v_empresa, 'P-106', 'Asistente Técnico', 'Logística y Operaciones', v_logistica, v_jefe,
   'Garantiza la adecuada recepción, registro, reparación y mantenimiento de productos averiados o en garantía, trabajando en coordinación con el área comercial y administrativa, además de realizar tareas básicas de mantenimiento del edificio.',
   'R-02-01', 0, 'Jefe de Logística', 'Asistente de Control de Stock 2', null,
   array[
     'Recibir y registrar los artículos averiados o para mantenimiento.',
     'Realizar la reparación o mantenimiento de los artículos averiados.',
     'Coordinar con el Departamento Comercial las acciones a tomar en relación al artículo.',
     'Colaborar con las tareas de mantenimiento edilicio.',
     'Colaborar en los procesos de cambio planificados para el mejoramiento continuo de la Organización.',
     'Promover el desarrollo de la cultura organizacional.',
     'Realizar las tareas de acuerdo a lo establecido en los procedimientos.',
     'Ejecutar otras tareas relacionadas a sus funciones que le sean encomendadas.'
   ],
   'Bachiller concluido.', 'Curso de Excel Básico. Curso de Electricidad. Curso de Plomería.',
   'Experiencia previa mínima 1 año en cargos similares.',
   true, false, false, false, true),

  (v_empresa, 'P-107', 'Asistente de Control de Stock 1', 'Logística y Operaciones', v_logistica, v_jefe,
   'Coordina y ejecuta las actividades de recepción, verificación, acondicionamiento y organización de mercaderías, colaborando en la gestión de pedidos mayoristas, la reposición de productos y las tareas administrativas, con el fin de asegurar un flujo logístico eficiente y el mantenimiento del depósito.',
   'R-02-01', 0, 'Jefe de Logística', null, null,
   array[
     'Recibir y controlar las mercaderías que ingresan por compras locales e internacionales.',
     'Etiquetar y rotular las mercaderías recibidas para su almacenamiento.',
     'Mantener el depósito ordenado, con la mercadería ubicada de forma idónea.',
     'Realizar gestiones para el Departamento Administrativo.',
     'Dar soporte al proceso de Reposición de Stock o preparación de mercaderías para el envío.',
     'Realizar entrega de pedidos en la zona metropolitana.',
     'Dar soporte en lo relacionado al mantenimiento edilicio.',
     'Dar soporte según necesidad al Delivery.',
     'Apoyar en la realización de inventarios.',
     'Colaborar en los procesos de cambio planificados para el mejoramiento continuo de la Organización.',
     'Promover el desarrollo de la cultura organizacional.',
     'Realizar las tareas de acuerdo a lo establecido en los procedimientos.'
   ],
   'Egresado de Administración, Lic. en Psicología Laboral o afines.',
   'Manejo de herramientas informáticas.',
   'Experiencia previa en el cargo mínima 3 años.',
   true, true, true, false, false),

  (v_empresa, 'P-108', 'Asistente de Control de Stock 2', 'Logística y Operaciones', v_logistica, v_jefe,
   'Gestiona la recepción, verificación, acondicionamiento y almacenamiento eficiente de mercaderías, colaborando en la gestión de pedidos, control de inventarios y mantenimiento del depósito, así como en tareas de entrega y reemplazo de personal.',
   'R-02-01', 0, 'Jefe de Logística', null, null,
   array[
     'Realizar entrega de pedidos en la zona metropolitana.',
     'Apoyar en las tareas de verificación física de mercaderías recibidas.',
     'Apoyar en el etiquetado y rotulado de mercaderías recibidas.',
     'Apoyar en el mantenimiento del orden y la limpieza del depósito.',
     'Dar soporte según necesidad al Delivery.',
     'Dar soporte en lo relacionado al mantenimiento edilicio.',
     'Dar soporte al proceso de Reposición de Stock o preparación de mercaderías para el envío.',
     'Dar soporte en el área de Asistencia Técnica, según necesidad.',
     'Colaborar en los procesos de cambio planificados para el mejoramiento continuo de la Organización.',
     'Promover el desarrollo de la cultura organizacional.',
     'Realizar las tareas de acuerdo a lo establecido en los procedimientos.',
     'Ejecutar otras tareas relacionadas a sus funciones que le sean encomendadas.'
   ],
   'Bachiller concluido.', 'Curso de Excel Básico.',
   'Experiencia previa mínima de 1 año en cargos similares.',
   true, false, false, false, false),

  (v_empresa, 'P-109', 'Asistente de Reposición de Stock', 'Logística y Operaciones', v_logistica, v_jefe,
   'Gestiona de manera eficiente la reposición, registro y control de mercaderías en el salón de ventas y el depósito, asegurando un flujo continuo de productos, la correcta documentación de los movimientos y la colaboración con otros departamentos.',
   'R-02-01', 0, 'Jefe de Logística', null, null,
   array[
     'Realizar la reposición de productos en el Salón de Ventas.',
     'Registrar en el sistema informático todos los movimientos de mercaderías realizados.',
     'Mantener actualizados los registros físicos de movimientos internos de mercadería.',
     'Colaborar según necesidad en el control de embalajes de los productos que serán enviados a los clientes.',
     'Mantener actualizada la planilla Reposición de Mercaderías.',
     'Comunicarse con el Departamento Administrativo sobre problemas relacionados al stock.',
     'Colaborar en los procesos de cambio planificados para el mejoramiento continuo de la Organización.',
     'Promover el desarrollo de la cultura organizacional.',
     'Realizar las tareas de acuerdo a lo establecido en los procedimientos.',
     'Ejecutar otras tareas relacionadas a sus funciones que le sean encomendadas.',
     'Colaborar con la atención a personas de otros departamentos que precisen productos o asistencia de Logística.'
   ],
   'Bachiller concluido.', 'Manejo de herramientas informáticas. Curso de Excel Básico.',
   'Experiencia previa mínima de 1 año en cargos similares.',
   true, false, false, false, true)

  on conflict (empresa_id, lower(codigo)) do update set
    nombre = excluded.nombre, mision = excluded.mision,
    supervisado_por = excluded.supervisado_por,
    reporta_a_puesto_id = excluded.reporta_a_puesto_id,
    funciones = excluded.funciones;
end;
$$;


-- =====================================================================
-- DATOS REALES: 30-documentos-it.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- DATOS REALES · Juego documental de TI
-- =====================================================================
-- Los diez documentos de Tecnologia de la Informacion vigentes de
-- Camping 44, con su codigo real y el enlace al archivo en Drive.
--
-- No se copia el contenido: la intranet indexa y enlaza. El archivo
-- vigente sigue siendo el del Drive, y cuando Calidad lo actualiza ahi,
-- la ficha muestra lo nuevo sin intervencion.
--
-- La codificacion es la de Camping 44: <TIPO>-<AREA>-<NN>, donde el
-- correlativo es unico dentro del area sin importar el tipo.
--
-- Se aplica DESPUES del seed (necesita empresa y un usuario responsable).
-- Es idempotente.

do $$
declare
  v_empresa uuid;
  v_responsable uuid;
  v_proceso uuid;
  v_norma uuid;
  -- Fecha de la ultima actualizacion de los archivos en Drive.
  v_vigencia constant date := date '2026-03-31';
begin
  select id into v_empresa from public.empresas order by creado_en limit 1;
  if v_empresa is null then
    raise exception 'No hay ninguna empresa cargada. Aplique el seed primero.';
  end if;

  -- El responsable definitivo es el Responsable IT. Mientras su legajo no
  -- exista, queda a cargo del Administrador SGC: la columna no admite
  -- nulos, y dejar el documento sin dueno seria peor que asignarlo
  -- provisoriamente a Calidad.
  select id into v_responsable from public.usuarios
   where empresa_id = v_empresa and rol = 'administrador_sgc' and activo
   order by creado_en limit 1;

  if v_responsable is null then
    select id into v_responsable from public.usuarios
     where empresa_id = v_empresa and activo order by creado_en limit 1;
  end if;

  if v_responsable is null then
    raise exception 'No hay usuarios cargados: no se puede asignar responsable.';
  end if;

  select id into v_proceso from public.procesos
   where empresa_id = v_empresa and nombre ilike '%tecnolog%' limit 1;
  select id into v_norma from public.normas limit 1;

  insert into public.documentos (
    empresa_id, codigo, titulo, tipo, estado, proceso_id, norma_id,
    responsable_id, elaborador_id, version_actual,
    fecha_aprobacion, fecha_vigencia, fecha_proxima_revision,
    periodicidad_revision_meses, url_documento
  ) values
  (v_empresa, 'POL-IT-01', 'Política de Seguridad Informática', 'politica', 'vigente',
   v_proceso, v_norma, v_responsable, v_responsable, 1,
   v_vigencia, v_vigencia, v_vigencia + interval '12 months', 12,
   'https://docs.google.com/document/d/1U-Z1D9Nv_VaJLgGB8sVgAyopkQhPfxsl40ePIOyYVw4/edit'),

  (v_empresa, 'PROC-IT-02', 'Procedimiento de Gestión de Accesos y Usuarios', 'procedimiento', 'vigente',
   v_proceso, v_norma, v_responsable, v_responsable, 1,
   v_vigencia, v_vigencia, v_vigencia + interval '12 months', 12,
   'https://docs.google.com/document/d/1bQvc64iL-9YZfmao6tgwgMh0PoNpZQ9EQVmmF7V3sfM/edit'),

  (v_empresa, 'PROC-IT-03', 'Procedimiento de Respaldo y Recuperación de Datos', 'procedimiento', 'vigente',
   v_proceso, v_norma, v_responsable, v_responsable, 1,
   v_vigencia, v_vigencia, v_vigencia + interval '12 months', 12,
   'https://docs.google.com/document/d/1m2qqbWr7W5cdNTTN7wUU_WPAY5TDANMQpseuAak3Pzs/edit'),

  (v_empresa, 'PLAN-IT-04', 'Plan de Contingencia Informática', 'plan', 'vigente',
   v_proceso, v_norma, v_responsable, v_responsable, 1,
   v_vigencia, v_vigencia, v_vigencia + interval '12 months', 12,
   'https://docs.google.com/document/d/1TPMUhU9QUKNCH6PTfn9cE2pyOzWbNoSxe91QZMn673M/edit'),

  (v_empresa, 'POL-IT-05', 'Política de Uso de Equipos y Celulares Corporativos', 'politica', 'vigente',
   v_proceso, v_norma, v_responsable, v_responsable, 1,
   v_vigencia, v_vigencia, v_vigencia + interval '12 months', 12,
   'https://docs.google.com/document/d/1lfbghseL9gbMIAyP5U5rlMxZVdL5wFmZ-32E6xBxePU/edit'),

  (v_empresa, 'PROC-IT-06', 'Procedimiento de Gestión de Incidentes Informáticos', 'procedimiento', 'vigente',
   v_proceso, v_norma, v_responsable, v_responsable, 1,
   v_vigencia, v_vigencia, v_vigencia + interval '12 months', 12,
   'https://docs.google.com/document/d/11sSsZlns7W_sZ2GtM3s1-ExQBhW8eTeozFYcQc4JZI8/edit'),

  (v_empresa, 'PROC-IT-07', 'Procedimiento de Control de Accesos Físicos', 'procedimiento', 'vigente',
   v_proceso, v_norma, v_responsable, v_responsable, 1,
   v_vigencia, v_vigencia, v_vigencia + interval '12 months', 12,
   'https://docs.google.com/document/d/1jlpebNqN8m6K-CTD06tPCZ6iXEzMbRiziywNgSFn7Ao/edit'),

  (v_empresa, 'PROC-IT-08', 'Procedimiento de Gestión Documental', 'procedimiento', 'vigente',
   v_proceso, v_norma, v_responsable, v_responsable, 1,
   v_vigencia, v_vigencia, v_vigencia + interval '12 months', 12,
   'https://docs.google.com/document/d/1Lez3_80a4hrXsJFunuwWITZVxU09KJMTioPkCWmRM14/edit'),

  (v_empresa, 'PROC-IT-09', 'Procedimiento de Protección de la Información', 'procedimiento', 'vigente',
   v_proceso, v_norma, v_responsable, v_responsable, 1,
   v_vigencia, v_vigencia, v_vigencia + interval '12 months', 12,
   'https://docs.google.com/document/d/1QCTX52Myxu1dDRnHbiwRE1W9TgEyxiBjvASvXI5g_Qg/edit'),

  (v_empresa, 'PROC-IT-10', 'Procedimiento de Comunicación de Incidentes', 'procedimiento', 'vigente',
   v_proceso, v_norma, v_responsable, v_responsable, 1,
   v_vigencia, v_vigencia, v_vigencia + interval '12 months', 12,
   'https://docs.google.com/document/d/1Ll3srt-bilpF2o9efdCc1nyMaGnrdldNEKzr7nZSkRA/edit')

  on conflict (empresa_id, upper(codigo)) do update set
    titulo = excluded.titulo,
    tipo = excluded.tipo,
    estado = excluded.estado,
    fecha_vigencia = excluded.fecha_vigencia,
    fecha_proxima_revision = excluded.fecha_proxima_revision,
    url_documento = excluded.url_documento;
end;
$$;


-- =====================================================================
-- DATOS REALES: 40-documentos-del-sgc.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- DATOS REALES · Documentos de la unidad compartida del SGC
-- =====================================================================
-- El resto del juego documental vigente: contexto organizacional,
-- politicas, estructura, formularios y el protocolo de orden y limpieza.
-- Los manuales de proceso ya se cargaron en 10-mapa-de-procesos.sql.
--
-- Codigo, version y vigencia salen del encabezado de cada archivo, no
-- del nombre del archivo ni de la fecha de modificacion en Drive: se
-- abrieron para leerlos. Casi todo el juego se lanzo el 25/05/2026 en
-- version 00; el protocolo de orden y limpieza es posterior
-- (11/08/2026) y el contrato de compraventa ya va por la version 01.
--
-- Ocho documentos NO tienen codigo. No es un olvido de esta carga: el
-- documento mismo no lo lleva, se identifica por titulo, version y
-- vigencia. Se dejan sin codigo antes que inventarles uno. Cuando
-- Calidad los codifique, se completa la columna.
--
-- La Matriz de Comunicaciones si lo tiene, aunque el nombre del archivo
-- no lo diga: el manual MP-SOP-01 la cita como F-SOP-01-01.
--
-- Como con los manuales, se enlaza el archivo vigente en lugar de
-- copiar su contenido.
--
-- Se aplica DESPUES de 10-mapa-de-procesos.sql. Es idempotente.

do $$
declare
  v_empresa uuid;
  v_responsable uuid;
  v_norma uuid;
  r record;
  v_proceso uuid;
begin
  select id into v_empresa from public.empresas order by creado_en limit 1;
  if v_empresa is null then
    raise exception 'No hay ninguna empresa cargada. Aplique el seed primero.';
  end if;

  select id into v_responsable from public.usuarios
   where empresa_id = v_empresa and rol = 'administrador_sgc' and activo
   order by creado_en limit 1;
  if v_responsable is null then
    select id into v_responsable from public.usuarios
     where empresa_id = v_empresa and activo order by creado_en limit 1;
  end if;

  select id into v_norma from public.normas limit 1;

  for r in
    select * from (values
      -- codigo,      titulo,                                              tipo,           proceso,  version, vigencia,     id de Drive

      -- 01 Contexto Organizacional (sin codigo)
      (null,          'Matriz FODA',                                       'registro',     'EST-02', 0, '2026-05-25', '1QRkwdEIgUaPiTBqnsld6-OBfUIVw9iWL'),
      (null,          'Matriz de Partes Interesadas',                      'registro',     'EST-02', 0, '2026-05-25', '11PyqNND_ToYrO3kpe49sWz1WHnOK5CaG'),
      (null,          'Alcance del Sistema de Gestión de Calidad',         'manual',       'EST-02', 0, '2026-05-25', '1OVed4zXHF1WmgtKugcFr-T2FyYns6DTu'),
      (null,          'Mapa de Procesos',                                  'manual',       'EST-02', 0, '2026-05-25', '1ANscWXVEBdPAYj1YC3d2pfptGN07Hc4D'),

      -- 02 Politicas y Otros (sin codigo)
      (null,          'Política de Calidad',                               'politica',     'EST-02', 0, '2026-05-25', '1Syb_5BDVc1ASGfazIU6Txj6nnXKrxfSZ'),
      (null,          'Propósito, Misión y Visión',                        'politica',     'EST-02', 0, '2026-05-25', '1tJlSPwB9whDwbQTNQHxStAj7Dib2_5ZM'),
      (null,          'Valores Institucionales',                           'politica',     'EST-02', 0, '2026-05-25', '1djuLhyp0FBGN8GoGxK36ovbDIWQUg8qQ'),
      (null,          'Política de Garantía',                              'politica',     'MIS-05', 0, '2026-05-25', '1NUSS9-qPk27RgAs7NANdE2Tjd62Qck8N'),

      -- 03 Estructura Organizacional (sin codigo)
      (null,          'Estructura Organizacional',                         'registro',     'SOP-01', 0, '2026-05-25', '1_u6Cti8qRdMZkgVfvWcZ89-jXqbkTPrz'),

      -- 05 Formularios y Otros
      ('F-EST-02-01', 'Minuta de Reunión',                                 'formulario',   'EST-02', 0, '2026-05-25', '1lqtRdof6j7MWDw-Fx_oV1ZUHK8ZeTXvX'),
      ('F-MIS-04-01', 'Carta de Responsabilidad',                          'formulario',   'MIS-04', 0, '2026-05-25', '1UD0zKZX8ct4B1NJk92w2oPWAsLDwkQZR'),
      ('F-MIS-05-01', 'Orden de Trabajo',                                  'formulario',   'MIS-05', 0, '2026-05-25', '1Ghxkkoh1GsUxQadsLWygiLj0eKuwJtK5'),
      ('F-MIS-06-01', 'Autorización y Deslinde de Responsabilidad',        'formulario',   'MIS-06', 0, '2026-05-25', '14iMxwKNOF66xVa8RuTNtVF8V-gz7Rorq'),
      ('F-MIS-06-02', 'Reglamento del Stand de Tiro',                      'formulario',   'MIS-06', 0, '2026-05-25', '1Dd7HefGI72o5wNY82HgY2Wn2YrZr5dWs'),
      ('F-MIS-07-01', 'Guía de Corrección',                                'formulario',   'MIS-07', 0, '2026-05-25', '1kKRf-Lsaaj0JnE9_f-AdjjQ9mlnaEqg-'),
      ('F-SOP-01-01', 'Matriz de Comunicaciones',                          'registro',     'SOP-01', 0, '2026-05-25', '1Qj1g7hABvumJa6dnjIcX1mjJuZs9dz6r'),
      ('F-SOP-02-01', 'Verificación de Activos Edilicios',                 'formulario',   'SOP-02', 0, '2026-05-25', '1hhJiRuYkY0wmJGOEM2WYYm36p1K6hK-i'),
      ('F-SOP-02-02', 'Verificación de Activos Tecnológicos',              'formulario',   'SOP-02', 0, '2026-05-25', '1I3HyCAje0Ke_houGXiYVW4xbmGFENV5m'),
      ('F-SOP-03-01', 'Solicitud de Cliente · B2C',                        'formulario',   'SOP-03', 0, '2026-05-25', '1F7ICUHsHPcKwRAoeOV214XgF5HSgXDCw'),
      ('F-SOP-05-01', 'Informe de Inventario',                             'formulario',   'SOP-05', 0, '2026-05-25', '1glJwXow6Sv6z-YGT7pj7e0RFXltEZmfJ'),
      ('F-SOP-06-01', 'Contrato de Compromiso de Compraventa de Material Controlado, Declaración Jurada y Anexos',
                                                                           'formulario',   'SOP-06', 1, '2026-07-17', '1dfIR8mFzOamADtNvSlkyHR5xXuCS1S4R'),
      ('F-SOP-07-01', 'Alta y Baja de Credenciales de Acceso',             'formulario',   'SOP-07', 0, '2026-05-25', '1ccgI3HP0mffF8uAByIPBT9hXWLUpidiU'),
      ('F-SOP-07-02', 'Compromiso de Uso Responsable',                     'formulario',   'SOP-07', 0, '2026-05-25', '1jm9WrzIY09F_tecBxiQVxDhlxFjwNGOw'),
      ('F-SOP-07-03', 'Retiro de Equipos Informáticos',                    'formulario',   'SOP-07', 0, '2026-05-25', '1KcVcvGCPCu_7u7tkHLeUDXaCDOt-Brin'),
      ('F-SOP-08-01', 'Evaluación de Asociados de Negocio y Proveedores',  'formulario',   'SOP-08', 0, '2026-05-25', '1bnJv5w1CxBZv9gY1O42uu-Y1FAPIppcf'),
      (null,          'Registro de Participación',                         'formulario',   'SOP-01', 0, '2026-05-25', '1vs3tk9oc1zVXKhXs3SpjGKchtlVUVa4S'),
      (null,          'Solicitud de Cliente · B2B',                        'formulario',   'SOP-03', 0, '2026-05-25', '1Q4R9TWbdwrfJl3SiQLhWAlvGuz4l8mM5'),

      -- 07 Protocolo Orden y Limpieza
      ('P-SOP-01-01', 'Orden y Limpieza en Espacios de Trabajo',           'instructivo',  'SOP-01', 0, '2026-08-11', '18u2iMjfQPFEtTpl6QMZDf7toKfNqoaPK'),
      (null,          'Preguntas Frecuentes · Protocolo de Orden y Limpieza',
                                                                           'instructivo',  'SOP-01', 0, '2026-08-11', '1FQeLyX20UI26c_HeDk124zThaL90vHHF')
    ) as t(codigo, titulo, tipo, proceso, version, vigencia, drive_id)
  loop
    select id into v_proceso from public.procesos
     where empresa_id = v_empresa and lower(codigo) = lower(r.proceso);
    if v_proceso is null then
      raise exception 'Falta el proceso % del mapa real. Aplique antes 10-mapa-de-procesos.sql.', r.proceso;
    end if;

    if r.codigo is null then
      -- Sin codigo no hay clave por la cual reconocerlo: se identifica
      -- por titulo dentro de la empresa.
      update public.documentos set
        tipo = r.tipo::public.tipo_documento,
        estado = 'vigente',
        proceso_id = v_proceso,
        norma_id = v_norma,
        responsable_id = v_responsable,
        elaborador_id = v_responsable,
        version_actual = r.version,
        fecha_aprobacion = r.vigencia::date,
        fecha_vigencia = r.vigencia::date,
        fecha_proxima_revision = r.vigencia::date + interval '12 months',
        periodicidad_revision_meses = 12,
        es_demostracion = false,
        url_documento = 'https://drive.google.com/file/d/' || r.drive_id || '/view'
       where empresa_id = v_empresa and codigo is null and titulo = r.titulo;

      if not found then
        insert into public.documentos (
          empresa_id, codigo, titulo, tipo, estado, proceso_id, norma_id,
          responsable_id, elaborador_id, version_actual,
          fecha_aprobacion, fecha_vigencia, fecha_proxima_revision,
          periodicidad_revision_meses, es_demostracion, url_documento
        ) values (
          v_empresa, null, r.titulo, r.tipo::public.tipo_documento, 'vigente',
          v_proceso, v_norma, v_responsable, v_responsable, r.version,
          r.vigencia::date, r.vigencia::date, r.vigencia::date + interval '12 months',
          12, false, 'https://drive.google.com/file/d/' || r.drive_id || '/view'
        );
      end if;
    else
      insert into public.documentos (
        empresa_id, codigo, titulo, tipo, estado, proceso_id, norma_id,
        responsable_id, elaborador_id, version_actual,
        fecha_aprobacion, fecha_vigencia, fecha_proxima_revision,
        periodicidad_revision_meses, es_demostracion, url_documento
      ) values (
        v_empresa, r.codigo, r.titulo, r.tipo::public.tipo_documento, 'vigente',
        v_proceso, v_norma, v_responsable, v_responsable, r.version,
        r.vigencia::date, r.vigencia::date, r.vigencia::date + interval '12 months',
        12, false, 'https://drive.google.com/file/d/' || r.drive_id || '/view'
      )
      on conflict (empresa_id, upper(codigo)) do update set
        titulo = excluded.titulo,
        tipo = excluded.tipo,
        estado = excluded.estado,
        proceso_id = excluded.proceso_id,
        version_actual = excluded.version_actual,
        fecha_aprobacion = excluded.fecha_aprobacion,
        fecha_vigencia = excluded.fecha_vigencia,
        fecha_proxima_revision = excluded.fecha_proxima_revision,
        es_demostracion = false,
        url_documento = excluded.url_documento;
    end if;
  end loop;
end;
$$;


-- =====================================================================
-- DATOS REALES: 50-inventario-tecnologico.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- DATOS REALES · Inventario de activos tecnologicos
-- =====================================================================
-- Las ochenta y cuatro filas cargadas de la planilla "INVENTARIO
-- TECNOLOGICO" de la unidad compartida de TI, ultima actualizacion del
-- 2 de junio de 2026, responsable Facundo Colman.
--
-- Sofidya no los tiene: `get_assets` devuelve cero para las dos sedes.
-- Este es el inventario que se lleva de verdad.
--
-- La planilla tiene ademas seis hojas por area (ADM, CHUM, MAY, MKT,
-- REU, REC/REG, CAJ, DEP, SAL) que son plantillas a medio llenar: casi
-- todas las celdas dicen "[Completar]" y repiten equipos que ya estan
-- en la primera hoja. NO se cargan. Volcarlas seria meter relleno con
-- forma de dato, y ademas duplicaria activos.
--
-- Una fila de la planilla no tiene codigo -- la notebook HP Victus de
-- Martin Benitez, Jefe de Marketing -- y el esquema lo exige. Queda
-- afuera hasta que TI le asigne uno.
--
-- El encabezado de la planilla dice "Proceso: MP-APY-02 Infraestructura
-- y Tecnologia". Esa codificacion es anterior: en el mapa vigente ese
-- proceso es MP-SOP-02. Los activos se cuelgan del proceso por su
-- codigo actual.
--
-- Equivalencia de estados:
--   Operativo   -> operativo
--   Reparacion  -> en_mantenimiento
--   Baja        -> dado_de_baja
--   Libre       -> operativo, y "Sin asignar" en la descripcion, porque
--                  el equipo anda: lo que no tiene es a quien
--
-- A quien esta asignado cada equipo va en la descripcion y no en
-- `responsable_id`: la mayoria de esas personas todavia no tiene cuenta
-- en la intranet, y no se les inventa una.
--
-- Se aplica DESPUES del seed. Es idempotente.

do $$
declare
  v_empresa uuid;
  r record;
begin
  select id into v_empresa from public.empresas order by creado_en limit 1;
  if v_empresa is null then
    raise exception 'No hay ninguna empresa cargada. Aplique el seed primero.';
  end if;

  for r in
    select * from (values
  ('C44-NB-000', 'Notebook Dell inspiron', 'Notebook', 'Dell', 'inspiron', '0768567E-1527-4F05-9365-581D1C27D4A8', 'operativo', 'Asignado a: Irene Livieres. Color: Gris oscuro'),
  ('C44-NB-001', 'Notebook HP Precision 7510', 'Notebook', 'HP', 'Precision 7510', '00330-80180-35975-AA577', 'dado_de_baja', 'Color: Rojo'),
  ('C44-NB-002', 'Notebook HP HP Laptop 15-dy1xxx', 'Notebook', 'HP', 'HP Laptop 15-dy1xxx', '00330-80000-00000-AA258', 'operativo', 'Asignado a: OSCAR DAVID NOGUERA. Color: Plateado'),
  ('C44-NB-003', 'Notebook Dell Precision 7510', 'Notebook', 'Dell', 'Precision 7510', '00330-80180-35875-AA652', 'operativo', 'Asignado a: Adan -DIG 2. Color: Negro'),
  ('C44-NB-004', 'Notebook HP 15-dy1xxx', 'Notebook', 'HP', '15-dy1xxx', 'A4112A0C-AE34-4824-9A3E-F60DF07B750E', 'dado_de_baja', 'Color: Plateado'),
  ('C44-NB-005', 'Notebook HP 15-dy2xxx', 'Notebook', 'HP', '15-dy2xxx', '00330-80000-00000-AA665', 'operativo', 'Asignado a: Oscar Zárate. Color: Plateado'),
  ('C44-NB-006', 'Notebook HP HP 250 G5', 'Notebook', 'HP', 'HP 250 G5', '72A804E3-4949-4DD1-B736-888968B26AD2', 'operativo', 'Asignado a: Cesar Aguilera. Color: Negro'),
  ('C44-NB-007', 'Notebook Lenovo 81WE', 'Notebook', 'Lenovo', '81WE', '00330-80000-00000-AA895', 'operativo', 'Asignado a: Salón. Color: Azul'),
  ('C44-NB-008', 'Notebook ASUS X1504ZA-X1504ZA', 'Notebook', 'ASUS', 'X1504ZA-X1504ZA', '0330-80000-00000-AA069', 'en_mantenimiento', 'Asignado a: Hugo González. Color: Azul'),
  ('C44-NB-009', 'Notebook ASUS X1504ZA-X1504ZA', 'Notebook', 'ASUS', 'X1504ZA-X1504ZA', '0330-80000-00000-AA03', 'operativo', 'Asignado a: Carlos Gonzalez. Color: Azul'),
  ('C44-NB-010', 'Notebook HP 15-dy1xxx', 'Notebook', 'HP', '15-dy1xxx', '00330-81814-80131-AA0EM', 'operativo', 'Asignado a: Alicia. Color: Plateado'),
  ('C44-NB-011', 'Notebook Asus VivoBook', 'Notebook', 'Asus', 'VivoBook', '00330-80000-00000-AA653', 'operativo', 'Asignado a: Lucas Álvarez. Color: Negro'),
  ('C44-NB-012', 'Notebook HP 3168NGW', 'Notebook', 'HP', '3168NGW', '00330-80180-35975-AA577', 'operativo', 'Asignado a: Bianca. Color: Gris/Plata'),
  ('C44-NB-017', 'Notebook Dell inspiron 15 3000', 'Notebook', 'Dell', 'inspiron 15 3000', null, 'operativo', 'Asignado a: Sergio Divano'),
  ('C44-NB-019', 'Notebook HP Envy', 'Notebook', 'HP', 'Envy', '0330-80000-00000-AA056', 'operativo', 'Asignado a: Alejandro Rahi. Color: Plateado'),
  ('C44-NB-020', 'Notebook MSI MS-16W2', 'Notebook', 'MSI', 'MS-16W2', 'CD54D0A1-8F3D-4DF2-A1AE-1F172171EE13', 'operativo', 'Asignado a: Marketing'),
  ('C44-NB-021', 'Notebook HP 15-dy2xxx', 'Notebook', 'HP', '15-dy2xxx', '00330-80000-000-AA708', 'dado_de_baja', 'Color: Gris/Plata'),
  ('C44-NB-022', 'Notebook Dell Precision 7510', 'Notebook', 'Dell', 'Precision 7510', '00330-80180-3597-AA577', 'operativo', 'Asignado a: Créditos. Color: Negra'),
  ('C44-NB-023', 'Notebook Lenovo B1WE', 'Notebook', 'Lenovo', 'B1WE', '6C063E9A-64F0-450D-83B2-6BA39BA2B1FF', 'operativo', 'Asignado a: Venta Salón'),
  ('C44-NB-024', 'Notebook HP 15-dy2061la', 'Notebook', 'HP', '15-dy2061la', 'ACC5F835-78AE-442A-B0EE-416F45317645', 'dado_de_baja', 'Color: Gris'),
  ('C44-NB-025', 'Notebook Lenovo IdeaPad 1 15', 'Notebook', 'Lenovo', 'IdeaPad 1 15', 'PF5TK2FN', 'operativo', 'Asignado a: Fabricio. Color: Plateado'),
  ('C44-NB-026', 'Notebook Lenovo IdeaPad 1 15', 'Notebook', 'Lenovo', 'IdeaPad 1 15', null, 'operativo', 'Asignado a: Facundo Colman. Color: Plateado'),
  ('C44-NB-027', 'Notebook Lenovo IdeaPad 1 15', 'Notebook', 'Lenovo', 'IdeaPad 1 15', null, 'operativo', 'Asignado a: Roque. Color: Plateado'),
  ('C44-NB-028', 'Notebook ASUS TUF DASH F15', 'Notebook', 'ASUS', 'TUF DASH F15', 'N5BRCX02Y14920D', 'operativo', 'Asignado a: Derlis. Color: Negro'),
  ('C44-NB-029', 'Notebook Lenovo IdeaPad 1 15', 'Notebook', 'Lenovo', 'IdeaPad 1 15', null, 'operativo', 'Asignado a: Ruth Dige. Color: Plateado'),
  ('C44-NB-030', 'Notebook Lenovo IdeaPad 1 15', 'Notebook', 'Lenovo', 'IdeaPad 1 15', 'PF5SJMJR', 'operativo', 'Color: Plateado. Sin asignar'),
  ('C44-NB-031', 'Notebook Asus Vivobook', 'Notebook', 'Asus', 'Vivobook', 'S6N0CX04W01024A', 'operativo', 'Asignado a: Ruth Aquino. Color: Negro/Azul Oscuro'),
  ('C44-NB-032', 'Notebook Lenovo IdeaPad 1 15', 'Notebook', 'Lenovo', 'IdeaPad 1 15', 'PF5RPXEX', 'operativo', 'Asignado a: Araceli. Color: Plateado'),
  ('C44-PCE-001', 'CPU', 'CPU', null, null, null, 'operativo', 'Sin asignar'),
  ('C44-PCE-002', 'CPU', 'CPU', null, null, null, 'operativo', 'Asignado a: Eugenia Villalba'),
  ('C44-PCE-003', 'CPU', 'CPU', null, null, null, 'operativo', 'Asignado a: Contabilidad'),
  ('C44-PCE-004', 'CPU', 'CPU', null, null, null, 'operativo', 'Asignado a: David Palacio'),
  ('C44-PCE-005', 'CPU', 'CPU', null, null, null, 'operativo', 'Asignado a: Julia Olmedo'),
  ('C44-PCE-006', 'CPU', 'CPU', null, null, null, 'operativo', 'Asignado a: Yasmina Barranco'),
  ('C44-MOV-001', 'Celular Iphone 13 256GB', 'Celular', null, 'Iphone 13 256GB', 'K73052XQYP', 'operativo', 'Asignado a: Hugo González · Vitálica'),
  ('C44-MOV-002', 'Celular Samsung A15', 'Celular', null, 'Samsung A15', 'RF8X60K2XRK', 'operativo', 'Sin asignar'),
  ('C44-MOV-004', 'Tablet Samsung Galaxy TAB A7', 'Tablet', null, 'Samsung Galaxy TAB A7', null, 'dado_de_baja', null),
  ('C44-MOV-005', 'Tablet Samsung Galaxy Tab A7', 'Tablet', null, 'Samsung Galaxy Tab A7', null, 'dado_de_baja', null),
  ('C44-MOV-006', 'Tablet Blackview tab9', 'Tablet', null, 'Blackview tab9', 'Tab9WNEU0000850', 'dado_de_baja', null),
  ('C44-MOV-007', 'Tablet Blackview tab9', 'Tablet', null, 'Blackview tab9', 'tab9WNEU0006243', 'dado_de_baja', null),
  ('C44-MOV-008', 'POS MODEL T6M', 'POS', null, 'MODEL T6M', 'P652000020210', 'operativo', 'Asignado a: Smart Mobile POS · Vitálica. Sin asignar'),
  ('C44-MOV-009', 'POS MODEL T6M', 'POS', null, 'MODEL T6M', 'P652000022168', 'operativo', 'Asignado a: Smart Mobile POS · Vitálica · Caja'),
  ('C44-MOV-010', 'Celular Xiaomi Redmi 9A', 'Celular', null, 'Xiaomi Redmi 9A', '29227/60U878472', 'dado_de_baja', null),
  ('C44-MOV-011', 'Celular Iphone 13 Pro', 'Celular', null, 'Iphone 13 Pro', 'M7H02T7LWC', 'operativo', 'Asignado a: Corporativo de Marketing'),
  ('C44-MOV-012', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61689/R5UC03799', 'operativo', 'Asignado a: Oscar David Maldonado Yudis'),
  ('C44-MOV-013', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61745/R5U501153', 'operativo', 'Asignado a: Jhamyl Daniel Insfrán Núñez'),
  ('C44-MOV-015', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61745/R5U501070', 'operativo', null),
  ('C44-MOV-016', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61689/R5UC03918', 'operativo', 'Asignado a: Oscar Daniel Zárate Villamayor'),
  ('C44-MOV-017', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61686/R5UC03927', 'operativo', 'Asignado a: Marcelo Evaristo Sánchez Rojas'),
  ('C44-MOV-018', 'Celular Samsung M11', 'Celular', null, 'Samsung M11', 'R9JN70W9C0J', 'operativo', 'Asignado a: Logística'),
  ('C44-MOV-019', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61689/R5UC03807', 'operativo', null),
  ('C44-MOV-021', 'Celular Samsung Galaxy A15', 'Celular', null, 'Samsung Galaxy A15', 'RF8X50BTQ5A', 'operativo', 'Asignado a: Jorge Rodríguez'),
  ('C44-MOV-022', 'Celular Samsung A15', 'Celular', null, 'Samsung A15', 'RF8X60K3RDK', 'operativo', 'Asignado a: Capital Humano'),
  ('C44-MOV-023', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61689/R5UC04011', 'operativo', 'Asignado a: Hugo Javier González Arce'),
  ('C44-MOV-024', 'Celular Samsung A14', 'Celular', null, 'Samsung A14', 'R5CWB25JEKK', 'operativo', null),
  ('C44-MOV-025', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61689/R5UC03883', 'dado_de_baja', null),
  ('C44-MOV-026', 'Celular Samsung Galaxy A14', 'Celular', null, 'Samsung Galaxy A14', 'R58W60T09YL', 'operativo', null),
  ('C44-MOV-027', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61689/R5UC01422', 'operativo', null),
  ('C44-MOV-028', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61745/R5U501194', 'operativo', 'Asignado a: Marcelo Evaristo Sánchez Rojas'),
  ('C44-MOV-029', 'Celular Samsung M11', 'Celular', null, 'Samsung M11', 'R9JN716VH9J', 'dado_de_baja', null),
  ('C44-MOV-030', 'Celular Samsung A14', 'Celular', null, 'Samsung A14', 'R58W60SZAQM', 'operativo', 'Asignado a: Juan Severo Del Puerto Prieto'),
  ('C44-MOV-031', 'Celular Samsung A14', 'Celular', null, 'Samsung A14', 'R58W50E9R2F', 'operativo', 'Asignado a: Bernardo Sosa Garay'),
  ('C44-MOV-032', 'Celular Samsung M11', 'Celular', null, 'Samsung M11', 'R9JN716VHCJ', 'operativo', 'Asignado a: Rodolfo Cohene Tabare'),
  ('C44-MOV-033', 'Celular Samsung A15', 'Celular', null, 'Samsung A15', 'RF8X302WPDB', 'operativo', 'Asignado a: Jhamyl Daniel Insfrán Núñez'),
  ('C44-MOV-034', 'Celular Samsung A15', 'Celular', null, 'Samsung A15', 'RF8X60K4GYH', 'operativo', 'Asignado a: Adan Feliciano Candia Aveiro'),
  ('C44-MOV-035', 'Celular Samsung Galaxy A15', 'Celular', null, 'Samsung Galaxy A15', 'RF8X50G8KNK', 'operativo', 'Asignado a: María Julia Olmedo Cuevas'),
  ('C44-MOV-036', 'Celular Xiaomi Redmi 9A', 'Celular', null, 'Xiaomi Redmi 9A', '31271/11TS01634', 'dado_de_baja', null),
  ('C44-MOV-037', 'Celular Samsung A15', 'Celular', null, 'Samsung A15', 'RF8X50G83AL', 'operativo', 'Asignado a: Lucas Álvarez'),
  ('C44-MOV-038', 'Celular Xiaomi Redmi 9A', 'Celular', null, 'Xiaomi Redmi 9A', 'AYLB854H6LCMJF4H', 'dado_de_baja', null),
  ('C44-MOV-040', 'Celular Samsung A15', 'Celular', null, 'Samsung A15', 'RF8X60K2DVX', 'operativo', null),
  ('C44-MOV-041', 'Celular Samsung A15', 'Celular', null, 'Samsung A15', 'RF8X60HWM4D', 'operativo', null),
  ('C44-MOV-042', 'Celular Xiaomi Redmi 9A', 'Celular', null, 'Xiaomi Redmi 9A', '31271/11TS00263', 'operativo', 'Asignado a: Carlos Gustavo Sosa Aranda'),
  ('C44-MOV-043', 'Celular Samsung A15', 'Celular', null, 'Samsung A15', 'RF8X60K2YZH', 'operativo', null),
  ('C44-MOV-044', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61689/R5UC03778', 'operativo', 'Asignado a: Antonio de Jesús Fernández Benítez'),
  ('C44-MOV-045', 'Celular Xiaomi Redmi 9A', 'Celular', null, 'Xiaomi Redmi 9A', '29227/60U878534', 'operativo', 'Asignado a: Cesar Alejandro Rahi Geraghty'),
  ('C44-MOV-046', 'Celular Samsung A15', 'Celular', null, 'Samsung A15', 'RF8X60K2H7V', 'operativo', null),
  ('C44-MOV-047', 'Celular Samsung A15', 'Celular', null, 'Samsung A15', 'RF8X60HWSZT', 'operativo', 'Asignado a: Mario Esteban Penayo Bogado'),
  ('C44-MOV-048', 'Celular Samsung A15', 'Celular', null, 'Samsung A15', 'RF8X50G7HEH', 'operativo', 'Asignado a: Administración'),
  ('C44-MOV-053', 'Tablet Samsung Galaxy Tab A7', 'Tablet', null, 'Samsung Galaxy Tab A7', null, 'operativo', 'Asignado a: Antonio'),
  ('C44-MOV-054', 'Celular Samsung Galaxy A15', 'Celular', null, 'Samsung Galaxy A15', 'RF8X302GRZP', 'operativo', 'Asignado a: Roque Mendez'),
  ('C44-MOV-056', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61689/R5UC04015', 'operativo', null),
  ('C44-MOV-057', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61689/R5UC03717', 'operativo', 'Asignado a: Yasmin Araceli Pereira Ovelar · NPS'),
  ('C44-MOV-058', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61745/R5U500521', 'operativo', 'Sin asignar'),
  ('C44-MOV-059', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61745/R5U501176', 'operativo', 'Sin asignar')
    ) as t(codigo, nombre, tipo, marca, modelo, serie, estado, detalle)
  loop
    insert into public.activos (
      empresa_id, codigo, nombre, categoria, marca, modelo,
      numero_serie, estado, descripcion, es_demostracion
    ) values (
      v_empresa, r.codigo, r.nombre, r.tipo, r.marca, r.modelo,
      r.serie, r.estado::public.estado_activo, r.detalle, false
    )
    on conflict (empresa_id, upper(codigo)) do update set
      nombre = excluded.nombre,
      categoria = excluded.categoria,
      marca = excluded.marca,
      modelo = excluded.modelo,
      numero_serie = excluded.numero_serie,
      estado = excluded.estado,
      descripcion = excluded.descripcion,
      es_demostracion = false;
  end loop;
end;
$$;


-- =====================================================================
-- DATOS REALES: 60-objetivos-2026.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- DATOS REALES · Objetivos del Plan Estrategico 2026
-- =====================================================================
-- Los treinta objetivos de la planilla "INDICADORES PE 2026", de la
-- unidad compartida "Camping 44 - Planificacion Estrategica 2026".
--
-- Sofidya no los expone por su API -- no hay comando de objetivos -- y
-- el modulo de Indicadores y objetivos queda vacio sin esto.
--
-- Decisiones que conviene tener a la vista:
--
-- · El codigo. La planilla no los codifica y el esquema lo exige, asi
--   que se numeran OBJ-2026-01 en adelante, en el orden de la planilla.
--   Es una secuencia, no un codigo de Calidad; si Calidad los codifica,
--   se reemplazan.
--
-- · El proceso. La planilla los agrupa por departamento, y dos de esos
--   departamentos tienen proceso en el mapa real: Logistica es MIS-02
--   Almacenamiento y Compras de Mercaderias es SOP-08 Compras locales y
--   Evaluacion a Proveedores. "Gestion Regulatoria" NO tiene proceso en
--   el mapa vigente, asi que esos catorce quedan sin proceso en lugar de
--   forzarlos a uno que no les corresponde. El departamento igual queda
--   escrito en la descripcion, de modo que no se pierde el dato.
--
-- · El estado. La planilla dice "Realizado" o "No realizado". Se traduce
--   a cumplido con 100 % de avance y a en_curso con 0 %. "No realizado"
--   es un estado del plan, no un veredicto de incumplimiento: el
--   ejercicio esta abierto y quien lo gestiona lo mueve desde la
--   pantalla.
--
-- · El responsable. Son nombres, y varios no tienen todavia cuenta en la
--   intranet. Van en la descripcion y no en `responsable_id`: no se le
--   inventa una cuenta a nadie.
--
-- Se aplica DESPUES del seed. Es idempotente.

do $$
declare
  v_empresa uuid;
  r record;
  v_proceso uuid;
begin
  select id into v_empresa from public.empresas order by creado_en limit 1;
  if v_empresa is null then
    raise exception 'No hay ninguna empresa cargada. Aplique el seed primero.';
  end if;

  for r in
    select * from (values
  ('OBJ-2026-01', 'Diferenciación por inmediatez logística y CX', 'Rediseñar el flujo de gestión centrado en CX y en la «entrega en horas».', 'Gestión Regulatoria · previsto para enero de 2026 · responsable: Belén Rojas', null, 'en_curso', 0),
  ('OBJ-2026-02', 'Estandarización de auditorías en la gestión e inventario', 'Definir un protocolo claro y estandarizado para la auditoría de carga de inventario y de venta de material controlado (registros SID/Odoo) en conjunto con el departamento administrativo.', 'Gestión Regulatoria · previsto para enero de 2026 · responsable: A definir', null, 'en_curso', 0),
  ('OBJ-2026-03', 'Diferenciación por inmediatez logística y CX', 'Contratar a una persona más en ATC GR para mitigar el riesgo de cuello de botella.', 'Gestión Regulatoria · previsto para enero de 2026 · responsable: Irene Livieres', null, 'cumplido', 100),
  ('OBJ-2026-04', 'Identificación de oportunidades de mercado. Sincronización comercial', 'Establecer un flujo de comunicación mensual estructurado y formal entre los equipos de Compras y Comercial para la revisión de tendencias de mercado, análisis de inventario crítico y oportunidades de nuevos productos y marcas.', 'Compras de Mercaderías · previsto para enero de 2026 · responsable: Diego Kemper', 'SOP-08', 'en_curso', 0),
  ('OBJ-2026-05', 'Gestión de relacionamiento con proveedores', 'Optimizar las condiciones comerciales con proveedores para mejorar las condiciones de pago, reducir los costos de adquisición y obtener mejores condiciones de volumen.', 'Compras de Mercaderías · previsto para enero de 2026 · responsable: Diego Kemper', 'SOP-08', 'en_curso', 0),
  ('OBJ-2026-06', 'Gestión de demanda y niveles de stock', 'Categorizar los productos en ABCD para identificar su nivel de rotación, tener informes de inventario, mejorar la rotación y accionar sobre los productos que no rotan como se espera.', 'Compras de Mercaderías · previsto para enero de 2026 · responsable: Ariel Kemper', 'SOP-08', 'cumplido', 100),
  ('OBJ-2026-07', 'Gestión de demanda y niveles de stock', 'Realizar el estudio de productos A y B por marcas para calcular su reposición.', 'Compras de Mercaderías · previsto para enero de 2026 · responsable: Diego Kemper', 'SOP-08', 'en_curso', 0),
  ('OBJ-2026-08', 'Ordenamiento e inventario del depósito', 'Coordinar con Administración un calendario de inventarios físicos rotativos, semanales o mensuales, de material controlado realizados por personal independiente.', 'Logística · previsto para enero de 2026 · responsable: A definir', 'MIS-02', 'en_curso', 0),
  ('OBJ-2026-09', 'Implementación y monitoreo', 'Mientras se implementa la digitalización en Odoo, se utilizarán las planillas existentes, que se pasarán a Google Workspace.', 'Logística · previsto para enero de 2026 · responsable: Bernardo Sosa', 'MIS-02', 'en_curso', 0),
  ('OBJ-2026-10', 'Lobbying proactivo con la institución', 'Lograr que el responsable de COMEX, ATC GR 1 y 2 y el Gestor conozcan al personal de mando medio en DIGEMABEL para gestionar todo tipo de situaciones que les competen.', 'Gestión Regulatoria · previsto para febrero de 2026 · responsable: Diego Kemper', null, 'en_curso', 0),
  ('OBJ-2026-11', 'Gestión de relacionamiento con proveedores', 'Desarrollar un cuadro de mando para medir el desempeño de los proveedores.', 'Compras de Mercaderías · previsto para febrero de 2026 · responsable: Diego Kemper', 'SOP-08', 'en_curso', 0),
  ('OBJ-2026-12', 'Gestión de portafolio', 'Realizar el análisis de portafolio ideal contra el actual para identificar brechas de categorías y precios, y transferir los gaps identificados como mandato.', 'Compras de Mercaderías · previsto para febrero de 2026 · responsable: Sergio Divano', 'SOP-08', 'en_curso', 0),
  ('OBJ-2026-13', 'Ordenamiento e inventario del depósito', 'Implementar un protocolo de control de calidad en la recepción para el 99,9 % de la mercadería importada.', 'Logística · previsto para febrero de 2026 · responsable: A definir', 'MIS-02', 'en_curso', 0),
  ('OBJ-2026-14', 'Ordenamiento e inventario del depósito', 'Establecer categorías de productos de acuerdo al desgaste que pudieran tener.', 'Logística · previsto para febrero de 2026 · responsable: A definir', 'MIS-02', 'en_curso', 0),
  ('OBJ-2026-15', 'Diferenciación por inmediatez logística y CX', 'Rediseñar el lugar de gestión para mayor comodidad del usuario final.', 'Gestión Regulatoria · previsto para marzo de 2026 · responsable: Irene Livieres', null, 'en_curso', 0),
  ('OBJ-2026-16', 'Digitalización y equipo', 'Migrar el 100 % de las planillas de los ejes a módulos nativos de Odoo antes del Q1, con tableros en tiempo real para la gerencia.', 'Logística · previsto para marzo de 2026 · responsable: A definir', 'MIS-02', 'en_curso', 0),
  ('OBJ-2026-17', 'Digitalización y equipo', 'Capacitar al 100 % del equipo logístico en los nuevos procesos de Odoo.', 'Logística · previsto para marzo de 2026 · responsable: A definir', 'MIS-02', 'en_curso', 0),
  ('OBJ-2026-18', 'Ordenamiento e inventario del depósito', 'Alcanzar una precisión de inventario, conteo físico contra Odoo, del 99,9 % para material controlado antes del Q1.', 'Logística · previsto para marzo de 2026 · responsable: A definir', 'MIS-02', 'en_curso', 0),
  ('OBJ-2026-19', 'Envío de mercaderías y reposición', 'Implementar el picking por código de barras de C44 enlazado con el del proveedor para reducir los errores de envío antes del Q1.', 'Logística · previsto para marzo de 2026 · responsable: Bernardo Sosa', 'MIS-02', 'en_curso', 0),
  ('OBJ-2026-20', 'Medición de la experiencia del cliente', 'Realizar entrevistas cualitativas periódicas con clientes mayoristas clave para identificar puntos de dolor y oportunidades de mejora en la gestión.', 'Gestión Regulatoria · previsto para abril de 2026 · responsable: A definir', null, 'en_curso', 0),
  ('OBJ-2026-21', 'Diferenciación por inmediatez logística y CX', 'Capacitar al personal para que sea experto y confiable, mediante Google Classroom.', 'Gestión Regulatoria · previsto para abril de 2026 · responsable: Belén Rojas', null, 'en_curso', 0),
  ('OBJ-2026-22', 'Lobbying proactivo con la institución', 'Liderar en la CICAPY para mitigar la amenaza de circulares, reglamentos o directivas arbitrarias.', 'Gestión Regulatoria · previsto para abril de 2026 · responsable: Diego Kemper', null, 'en_curso', 0),
  ('OBJ-2026-23', 'Medición de la experiencia del cliente', 'Implementar encuestas de satisfacción posservicio, NPS o CSAT, para usuarios finales y clientes mayoristas después de la gestión regulatoria.', 'Gestión Regulatoria · previsto para abril de 2026 · responsable: A definir', null, 'en_curso', 0),
  ('OBJ-2026-24', 'Medición de la experiencia del cliente', 'Crear un informe trimestral de índice de satisfacción y utilizar los hallazgos para ajustar los protocolos de gestión y las estrategias de CX.', 'Gestión Regulatoria · previsto para abril de 2026 · responsable: A definir', null, 'en_curso', 0),
  ('OBJ-2026-25', 'Gestión de relacionamiento con proveedores', 'Optimizar las condiciones comerciales con proveedores para mejorar las condiciones de pago, reducir los costos de adquisición y obtener mejores condiciones de volumen.', 'Compras de Mercaderías · previsto para mayo de 2026 · responsable: Diego Kemper', 'SOP-08', 'en_curso', 0),
  ('OBJ-2026-26', 'Eficiencia en el proceso de compras', 'Implementar la digitalización en Odoo para la gestión de compras y abastecimiento.', 'Compras de Mercaderías · previsto para mayo de 2026 · responsable: A definir', 'SOP-08', 'en_curso', 0),
  ('OBJ-2026-27', 'Digitalización para la transparencia y el CX', 'Implementar en Odoo, junto con IT, un sistema de seguimiento que reemplace la planilla actual.', 'Gestión Regulatoria · previsto para junio de 2026 · responsable: A definir', null, 'en_curso', 0),
  ('OBJ-2026-28', 'Ordenamiento e inventario del depósito', 'Realizar el primer inventario general, el 100 % del depósito, antes del Q2.', 'Logística · previsto para junio de 2026 · responsable: A definir', 'MIS-02', 'en_curso', 0),
  ('OBJ-2026-29', 'Índice de satisfacción del cliente', 'Implementar una encuesta de satisfacción para clientes mayoristas y usuarios finales antes del Q2.', 'Logística · previsto para junio de 2026 · responsable: A definir', 'MIS-02', 'en_curso', 0),
  ('OBJ-2026-30', 'Índice de satisfacción del cliente', 'Analizar los resultados de la encuesta trimestralmente para identificar los principales puntos de fricción del cliente y definir acciones correctivas.', 'Logística · previsto para septiembre de 2026 · responsable: A definir', 'MIS-02', 'en_curso', 0)
    ) as t(codigo, nombre, meta, descripcion, proceso, estado, avance)
  loop
    v_proceso := null;
    if r.proceso is not null then
      select id into v_proceso from public.procesos
       where empresa_id = v_empresa and lower(codigo) = lower(r.proceso);
    end if;

    insert into public.objetivos (
      empresa_id, codigo, nombre, descripcion, meta, proceso_id,
      anio, estado, avance_porcentaje, es_demostracion
    ) values (
      v_empresa, r.codigo, r.nombre, r.descripcion, r.meta, v_proceso,
      2026, r.estado, r.avance, false
    )
    on conflict (empresa_id, upper(codigo)) do update set
      nombre = excluded.nombre,
      descripcion = excluded.descripcion,
      meta = excluded.meta,
      proceso_id = excluded.proceso_id,
      es_demostracion = false;
      -- El estado y el avance NO se pisan: una vez cargados, los mueve
      -- quien gestiona el objetivo desde la pantalla, y volver a correr
      -- este archivo no debe deshacer ese trabajo.
  end loop;
end;
$$;


-- =====================================================================
-- DATOS REALES: 90-retirar-procesos-de-demostracion.sql
-- =====================================================================
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


-- =====================================================================
-- DATOS REALES: 95-reparar-codigos-pisados.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- DATOS REALES · Reparar los codigos que piso la importacion de Sofidya
-- =====================================================================
-- La primera version de la importacion escribia el codigo tambien al
-- actualizar. Cuando un puesto de Sofidya coincidia de nombre con uno ya
-- cargado, le pisaba el codigo real con uno derivado del identificador
-- interno de Sofidya: el perfil P-101 del formulario R-02-01 quedaba
-- como SOF-P-31.
--
-- El codigo de la importacion ya no lo hace: ahora el codigo se escribe
-- solo al crear la fila. Esto repara lo que alcanzo a pisarse antes.
--
-- Es idempotente y no hace nada si no hay nada roto: solo toca filas
-- cuyo codigo empieza con SOF- y cuyo nombre coincide con uno de los
-- registros conocidos, y solo si el codigo verdadero esta libre.

do $$
declare
  v_empresa uuid;
  r record;
  v_id uuid;
begin
  select id into v_empresa from public.empresas order by creado_en limit 1;
  if v_empresa is null then
    return;
  end if;

  -- -------------------------------------------------------------------
  -- Puestos: los nueve perfiles del formulario R-02-01
  -- -------------------------------------------------------------------
  for r in
    select * from (values
      ('P-101', 'Jefe de Logística'),
      ('P-102', 'Responsable IT'),
      ('P-103', 'Asistente de Logística Mayorista'),
      ('P-104', 'Asistente de Gestiones'),
      ('P-105', 'Gestor de Cobranzas y Entregas'),
      ('P-106', 'Asistente Técnico'),
      ('P-107', 'Asistente de Control de Stock 1'),
      ('P-108', 'Asistente de Control de Stock 2'),
      ('P-109', 'Asistente de Reposición de Stock')
    ) as t(codigo, nombre)
  loop
    -- Si el codigo verdadero sigue en su lugar, no hay nada que reparar.
    continue when exists (
      select 1 from public.puestos
       where empresa_id = v_empresa and lower(codigo) = lower(r.codigo));

    select id into v_id from public.puestos
     where empresa_id = v_empresa
       and nombre = r.nombre
       and codigo like 'SOF-%'
     order by creado_en
     limit 1;

    if v_id is not null then
      update public.puestos set codigo = r.codigo where id = v_id;
      raise notice 'Puesto "%" recupero su codigo %.', r.nombre, r.codigo;
    end if;
  end loop;

  -- -------------------------------------------------------------------
  -- Proveedores del seed
  -- -------------------------------------------------------------------
  for r in
    select * from (values
      ('PRV-001', 'Importadora Andina de Equipamiento S.A.'),
      ('PRV-002', 'Distribuidora de Municiones del Sur Ltda.'),
      ('PRV-003', 'Transportes Ñemity S.R.L.'),
      ('PRV-004', 'Insumos Gráficos Paraguay S.A.'),
      ('PRV-005', 'Servicios Informáticos Aguará S.R.L.')
    ) as t(codigo, razon_social)
  loop
    continue when exists (
      select 1 from public.proveedores
       where empresa_id = v_empresa and upper(codigo) = upper(r.codigo));

    select id into v_id from public.proveedores
     where empresa_id = v_empresa
       and razon_social = r.razon_social
       and codigo like 'SOF-%'
     order by creado_en
     limit 1;

    if v_id is not null then
      update public.proveedores set codigo = r.codigo where id = v_id;
      raise notice 'Proveedor "%" recupero su codigo %.', r.razon_social, r.codigo;
    end if;
  end loop;
end;
$$;

