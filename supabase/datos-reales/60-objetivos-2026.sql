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
