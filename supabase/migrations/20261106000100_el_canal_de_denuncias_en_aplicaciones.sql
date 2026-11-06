-- El canal de denuncias anónimas y su informe en Aplicaciones (TI-0100).
--
-- Carlos González (Calidad y Auditoría) lo pidió el 28/10: tomar como
-- referencia su formulario «Reporte de Irregularidades - CAMPING 44 S.A.»
-- y llevarlo al módulo de aplicaciones. Diego y Carlos definieron el 06/11
-- que el informe lo ven solo ellos dos.
--
-- SON DOS TARJETAS Y NO UNA, porque tienen públicos opuestos:
--
--  · «Canal de denuncias» es el formulario. Lo tiene que encontrar
--    cualquiera, así que va a todos los roles y a las dos empresas del
--    grupo, igual que los tickets de solicitud. El formulario NO recolecta
--    correos: pide la cuenta del dominio solo para que lo usen
--    colaboradores, pero no guarda quién respondió. Por eso la denuncia se
--    hace en Google Forms y no dentro de la intranet, que sí sabe quién
--    está conectado.
--
--  · «Informe de denuncias» es el tablero del Comité (Apps Script sobre
--    la planilla de respuestas). Va sin roles y con Carlos y Diego
--    nombrados. Los dos son Administrador SGC, que ya ve todas las
--    tarjetas; nombrarlos igual deja escrito para quién es si algún día
--    cambian de rol.
--
-- OJO CON LO QUE ESTO NO HACE: esconder la tarjeta no protege el tablero.
-- Lo protege el propio script, que en cada llamada compara la cuenta
-- contra su lista (USUARIOS_INFORME) y a cualquier otra le muestra
-- «acceso reservado» sin devolver datos. Otro Administrador SGC vería la
-- tarjeta, pero el tablero no le abriría.

insert into public.aplicaciones
  (empresa_id, nombre, descripcion, url, publico, orden, roles_visibles, usuarios_visibles)
select
  e.id,
  'Canal de denuncias',
  'Para reportar de forma anónima fraudes, acoso, incumplimientos o conductas no éticas. No guarda tu correo ni tu usuario.',
  'https://docs.google.com/forms/d/e/1FAIpQLSfmW45XoPH-nFMeZ2KpebJlE6mKEspR72p9l0QILVhJUGALRQ/viewform',
  'general',
  13,
  array['direccion', 'responsable_proceso', 'auditor', 'vendedor', 'colaborador']::public.rol_usuario[],
  '{}'::uuid[]
from public.empresas e
on conflict (empresa_id, nombre) do nothing;

insert into public.aplicaciones
  (empresa_id, nombre, descripcion, url, publico, orden, roles_visibles, usuarios_visibles)
values (
  (select id from public.empresas where nombre = 'Camping 44'),
  'Informe de denuncias',
  'El tablero del Comité de Calidad: denuncias recibidas, gravedad y seguimiento de cada caso. Acceso reservado.',
  'https://script.google.com/a/macros/camping44.com.py/s/AKfycbyRvKqihraCWfGw7CGXuMFw69PNqk-Z8-6zQCeq5heKfmjy5BMdcPjVTdFm2-c7ZiGe/exec',
  'direccion',
  4,
  '{}'::public.rol_usuario[],
  array(
    select id from public.usuarios
    where correo in ('carlosgonzalez@camping44.com.py', 'diegokemper@camping44.com.py')
  )
)
on conflict (empresa_id, nombre) do nothing;
