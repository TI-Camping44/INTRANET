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
