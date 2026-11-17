-- ---------------------------------------------------------------------
-- Controles periódicos de TI, según el MP-SOP-03 y el MP-SOP-07
--
-- Son los controles con frecuencia que los dos procesos ponen a cargo
-- del Responsable de TI, tal como quedaron en la versión auditada del
-- 12 de octubre de 2026. La actividad entre paréntesis es la del
-- proceso, para que quien audite vaya directo a la fuente.
--
-- LOS MESES DE ARRANQUE LOS ELIGIÓ EL PROYECTO, no el proceso: el
-- proceso dice «cada trimestre» o «una vez al año», no en qué mes. Se
-- escalonaron para que no caigan todos juntos y se corrigen desde la
-- ficha de cada control. El checklist mensual arranca en noviembre de
-- 2026, que es cuando se ejecutó el primero.
--
-- Idempotente: se puede volver a correr sin duplicar, porque el código
-- es único por empresa y lo que ya existe no se pisa.
-- ---------------------------------------------------------------------

insert into public.controles_ti (
  empresa_id, codigo, nombre, descripcion, documento_origen, formulario,
  frecuencia_meses, primer_periodo, responsable_id
)
select
  '11111111-1111-4111-8111-111111111111',
  c.codigo, c.nombre, c.descripcion, c.documento_origen, c.formulario,
  c.frecuencia, c.primer_periodo::date,
  (select id from public.usuarios where correo = 'facundocolman@camping44.com.py')
from (values
  ('CTI-01', 'Checklist de Activos Tecnológicos',
   'Recorrida mensual de sala de servidores, energía, servidores, red, respaldos, vencimientos, inventario y una muestra de equipos de usuario, para detectar riesgos visibles.',
   'MP-SOP-03, actividad 2', 'F-SOP-03-03', 1, '2026-11-01'),
  ('CTI-02', 'Auditoría de cuentas activas',
   'Revisión de las cuentas activas de Google Workspace, Odoo, la Intranet y demás sistemas contra la nómina vigente, incluido quién tiene usuario del SID.',
   'MP-SOP-07, actividad 2', 'F-SOP-07-01', 3, '2026-12-01'),
  ('CTI-03', 'Revisión de accesos',
   'Auditoría de los accesos a carpetas, sistemas y equipos: mínimo privilegio según el puesto, doble autenticación y la carpeta de Material Controlado en solo lectura.',
   'MP-SOP-07, actividad 5', null, 6, '2027-01-01'),
  ('CTI-04', 'Prueba de restauración de respaldos',
   'Restauración de prueba desde las copias de Google Workspace, Odoo y los equipos locales, con una muestra de registros de Material Controlado y verificación de que los formatos sigan legibles.',
   'MP-SOP-07, actividad 7', null, 6, '2027-02-01'),
  ('CTI-05', 'Revocación de credenciales de integraciones',
   'Revisión de los usuarios técnicos y las credenciales de API y webhooks; se revocan las que no tienen uso comprobado.',
   'MP-SOP-07, actividad 2', null, 6, '2027-03-01'),
  ('CTI-06', 'Plan anual de mantenimiento preventivo',
   'Carga en el módulo Infraestructura y Tecnología del plan de mantenimiento preventivo de los activos tecnológicos del año, con la fecha de cada intervención.',
   'MP-SOP-03, actividad 2', null, 12, '2027-01-01'),
  ('CTI-07', 'Simulacro de continuidad operativa',
   'Simulacro documentado de caída de telecomunicaciones, del ERP o de la energía, coordinado con el Supervisor de Logística e Infraestructura.',
   'MP-SOP-07, actividad 9', null, 12, '2027-04-01'),
  ('CTI-08', 'Auditoría física de activos tecnológicos',
   'Inventario físico anual de los activos tecnológicos contra el registro de la Intranet, junto con Logística.',
   'MP-SOP-03, actividad 1', null, 12, '2027-06-01'),
  ('CTI-09', 'Revisión del MP-SOP-07 Seguridad Informática',
   'Revisión anual del proceso con el Coordinador de Auditoría, Calidad y Mejora Continua.',
   'MP-SOP-07, actividad 12', null, 12, '2027-10-01')
) as c (codigo, nombre, descripcion, documento_origen, formulario, frecuencia, primer_periodo)
on conflict (empresa_id, upper(codigo)) do nothing;
