-- ---------------------------------------------------------------------
-- Matriz de accesos por puesto: la propuesta inicial de TI
--
-- La armó el Responsable de TI el 17 de noviembre de 2026 a partir de
-- los puestos del Perfil de Resultados y del relevamiento de los 43
-- usuarios internos de Odoo, con el criterio de mínimo privilegio del
-- MP-SOP-07 (actividad 2). TODAS LAS FILAS ENTRAN COMO PROPUESTA: quién
-- necesita qué lo confirma el jefe de cada área, y recién ahí la fila
-- pasa a validada.
--
-- Lo que cambia contra lo que hay hoy en Odoo, en una línea: Nómina y
-- Empleados quedan solo para Capital Humano, la Gerencia General, la
-- Gerencia de Administración y Finanzas, la Presidencia y TI.
--
-- Idempotente: un puesto que ya tiene fila no se pisa.
-- ---------------------------------------------------------------------

insert into public.accesos_por_puesto (
  empresa_id, puesto_id, google_workspace, intranet_rol, odoo_empresas,
  odoo_ventas, odoo_inventario, odoo_compras, odoo_contabilidad,
  odoo_empleados, odoo_nomina, odoo_flota, odoo_reparaciones,
  observaciones, estado
)
select
  p.empresa_id,
  p.id,
  true,
  m.rol::public.rol_usuario,
  case
    when m.empresas is null then null
    when p.empresa_del_puesto_id = '22222222-2222-4222-8222-222222222222' then 'vitalica'
    else m.empresas
  end,
  case when m.empresas is null then 'sin_acceso' else m.ventas end,
  case when m.empresas is null then 'sin_acceso' else m.inventario end,
  case when m.empresas is null then 'sin_acceso' else m.compras end,
  case when m.empresas is null then 'sin_acceso' else m.contabilidad end,
  case when m.empresas is null then 'sin_acceso' else m.empleados end,
  case when m.empresas is null then 'sin_acceso' else m.nomina end,
  case when m.empresas is null then 'sin_acceso' else m.flota end,
  case when m.empresas is null then 'sin_acceso' else m.reparaciones end,
  'Propuesta de TI del 17/11/2026 a partir del relevamiento de Odoo. Falta validarla con el jefe del área.'
    || coalesce(' ' || m.nota, ''),
  'propuesta'
from public.puestos p
join (values
  -- puesto, rol intranet, empresas Odoo, ventas, inventario, compras, contabilidad, empleados, nómina, flota, reparaciones, nota
  ('Analista de Administración', 'colaborador', 'ambas', 'responsable', 'usuario', 'usuario', 'responsable', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', null),
  ('Analista de Créditos y Cobranzas', 'colaborador', 'ambas', 'responsable', 'usuario', 'sin_acceso', 'responsable', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', null),
  ('Analista de Gestión Regulatoria', 'colaborador', 'camping44', 'responsable', 'usuario', 'usuario', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', null),
  ('Analista de Marketing', 'colaborador', null, null, null, null, null, null, null, null, null, 'Hoy no tiene usuario de Odoo.'),
  ('Analista de Tesorería', 'colaborador', 'ambas', 'usuario', 'sin_acceso', 'sin_acceso', 'responsable', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', null),
  ('Asesor Comercial Consumidor Final', 'vendedor', 'camping44', 'usuario', 'usuario', 'sin_acceso', 'facturacion', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', null),
  ('Asesor Comercial Mayorista', 'vendedor', 'camping44', 'usuario', 'usuario', 'sin_acceso', 'facturacion', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'Hoy hay asesores con Administrador en Nómina y Empleados: se quita.'),
  ('Asesor Comercial Ventas Externas', 'vendedor', 'camping44', 'usuario', 'usuario', 'sin_acceso', 'facturacion', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', null),
  ('Asistente Comercial', 'colaborador', 'ambas', 'responsable', 'usuario', 'usuario', 'facturacion', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', null),
  ('Asistente de Administración y Archivo', 'colaborador', null, null, null, null, null, null, null, null, null, 'Hoy no tiene usuario de Odoo.'),
  ('Asistente de Administración y Sistemas', 'colaborador', 'ambas', 'responsable', 'administrador', 'administrador', 'responsable', 'sin_acceso', 'sin_acceso', 'responsable', 'sin_acceso', 'Confirmar si los permisos de administrador en Inventario y Compras siguen siendo necesarios.'),
  ('Asistente de Administración y Stock', 'colaborador', 'ambas', 'usuario', 'administrador', 'usuario', 'facturacion', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', null),
  ('Asistente de Capital Humano', 'colaborador', 'ambas', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'administrador', 'responsable', 'sin_acceso', 'sin_acceso', null),
  ('Asistente de Comercio Electrónico', 'colaborador', 'camping44', 'responsable', 'usuario', 'sin_acceso', 'facturacion', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', null),
  ('Asistente de Créditos y Cobranzas', 'colaborador', 'ambas', 'responsable', 'usuario', 'sin_acceso', 'responsable', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', null),
  ('Asistente de Logística Administrativo', 'colaborador', 'ambas', 'usuario', 'usuario', 'usuario', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', null),
  ('Asistente de Logística y Gestiones', 'colaborador', null, null, null, null, null, null, null, null, null, 'Hoy no tiene usuario de Odoo.'),
  ('Asistente de Logística y Stock', 'colaborador', 'ambas', 'usuario', 'usuario', 'usuario', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'Hoy tienen Administrador en Flota: confirmar si gestionan los vehículos.'),
  ('Asistente de Servicio Técnico', 'colaborador', 'camping44', 'usuario', 'usuario', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'usuario', null),
  ('ATC de Gestión Regulatoria', 'colaborador', 'camping44', 'responsable', 'usuario', 'usuario', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', null),
  ('ATC Posventa', 'colaborador', 'camping44', 'usuario', 'usuario', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'usuario', null),
  ('Cajero', 'colaborador', 'ambas', 'usuario', 'sin_acceso', 'sin_acceso', 'facturacion', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', null),
  ('Coordinador de Auditoría, Calidad y Mejora Continua', 'administrador_sgc', null, null, null, null, null, null, null, null, null, 'Hoy no tiene usuario de Odoo.'),
  ('Creador de Contenido y Redes Sociales', 'colaborador', null, null, null, null, null, null, null, null, null, 'Hoy no tiene usuario de Odoo.'),
  ('Director', 'direccion', null, null, null, null, null, null, null, null, null, null),
  ('Diseñador Gráfico', 'colaborador', null, null, null, null, null, null, null, null, null, 'Hoy no tiene usuario de Odoo.'),
  ('Gerente Comercial y de Marketing', 'responsable_proceso', 'ambas', 'administrador', 'usuario', 'usuario', 'facturacion', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', null),
  ('Gerente de Administración y Finanzas', 'direccion', 'ambas', 'administrador', 'administrador', 'administrador', 'administrador', 'administrador', 'administrador', 'administrador', 'sin_acceso', null),
  ('Gerente General', 'direccion', 'ambas', 'administrador', 'administrador', 'administrador', 'responsable', 'administrador', 'administrador', 'administrador', 'sin_acceso', null),
  ('Gestor de Operaciones y Logística', 'colaborador', 'camping44', 'responsable', 'usuario', 'usuario', 'facturacion', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', null),
  ('Instructor de Tiro', 'colaborador', null, null, null, null, null, null, null, null, null, null),
  ('Jefe de Administración', 'responsable_proceso', 'ambas', 'responsable', 'usuario', 'administrador', 'responsable', 'sin_acceso', 'sin_acceso', 'administrador', 'sin_acceso', null),
  ('Jefe de Capital Humano', 'responsable_proceso', 'ambas', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'administrador', 'administrador', 'sin_acceso', 'sin_acceso', null),
  ('Jefe de Marketing', 'responsable_proceso', 'camping44', 'responsable', 'usuario', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', null),
  ('Jefe de Operaciones y Logística', 'responsable_proceso', 'ambas', 'responsable', 'administrador', 'administrador', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'administrador', 'sin_acceso', 'Hoy hay un jefe con Administrador en Nómina y Empleados: se quita.'),
  ('Jefe del Canal Consumidor Final', 'responsable_proceso', 'ambas', 'responsable', 'usuario', 'sin_acceso', 'facturacion', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', null),
  ('Presidente', 'direccion', 'ambas', 'administrador', 'administrador', 'administrador', 'responsable', 'administrador', 'administrador', 'administrador', 'sin_acceso', null),
  ('Recepcionista', 'colaborador', 'ambas', 'usuario', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'Hoy la cuenta de Recepción tiene Responsable en Contabilidad y Empleados: confirmar qué necesita.'),
  ('Responsable de TI', 'administrador_sgc', 'ambas', 'administrador', 'administrador', 'administrador', 'responsable', 'administrador', 'administrador', 'administrador', 'administrador', 'Administra los usuarios de todos los sistemas (MP-SOP-07, actividad 2).'),
  ('Supervisor de Depósito e Infraestructura', 'responsable_proceso', 'ambas', 'usuario', 'administrador', 'usuario', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'responsable', 'sin_acceso', null),
  ('Supervisor de Desarrollo del Canal Mayorista', 'responsable_proceso', 'vitalica', 'responsable', 'usuario', 'sin_acceso', 'facturacion', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', null),
  ('Supervisor del Canal Consumidor Final', 'responsable_proceso', 'ambas', 'responsable', 'usuario', 'sin_acceso', 'facturacion', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', null),
  ('Supervisor del Canal Mayorista', 'responsable_proceso', 'camping44', 'responsable', 'usuario', 'sin_acceso', 'facturacion', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'sin_acceso', 'Hoy tiene Administrador en Nómina y Empleados: se quita.')
) as m (puesto, rol, empresas, ventas, inventario, compras, contabilidad, empleados, nomina, flota, reparaciones, nota)
  on m.puesto = p.nombre
where p.activo
on conflict (puesto_id) do nothing;
