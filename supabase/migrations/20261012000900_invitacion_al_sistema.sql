-- Invitacion al sistema desde el padron de la nomina
--
-- El perfil no se puede precargar: `usuarios.id` es clave foranea de
-- `auth.users(id)`, asi que la fila no existe hasta el primer ingreso con
-- Google. De las 55 personas del padron entraron 2, y la unica forma de
-- destrabar eso es avisarle a cada una, una por una, por fuera del
-- sistema. Esta migracion le da al padron la columna que le faltaba para
-- que ese aviso salga desde adentro y quede registrado.
--
-- NO ES UN ENLACE MAGICO, y es deliberado. El correo lleva a /ingresar y
-- la persona entra con su cuenta de Google del Workspace. Un enlace de
-- acceso directo crearia el usuario sin pasar por Google, y con eso se
-- cae la primera de las tres capas de validacion de dominio que el
-- sistema tiene —el parametro `hd`, el servidor y el disparador de la
-- base—. La invitacion avisa; quien autoriza sigue siendo Google.
--
-- QUE SE GUARDA: cuando se le aviso por ultima vez, quien le aviso y
-- cuantas veces. Las tres juntas contestan la pregunta que importa
-- durante la puesta en marcha: a quien ya se le insistio tres veces y
-- sigue sin entrar. Con una sola fecha eso no se ve.
--
-- OJO AL RECARGAR EL PADRON desde la exportacion de Odoo: la carga
-- actualiza por correo y NO debe tocar estas tres columnas. Son historia
-- de lo que hizo la intranet, no datos del ERP.

alter table public.personas_nomina
  add column if not exists invitado_en timestamptz,
  add column if not exists invitado_por uuid references public.usuarios (id) on delete set null,
  add column if not exists invitaciones_enviadas integer not null default 0;

comment on column public.personas_nomina.invitado_en is
  'Cuando se le envio por ultima vez la invitacion a ingresar. La escribe '
  'la intranet, no la carga del padron desde Odoo.';

comment on column public.personas_nomina.invitado_por is
  'Quien envio la ultima invitacion.';

comment on column public.personas_nomina.invitaciones_enviadas is
  'Cuantas veces se le envio. Sirve para ver a quien ya se le insistio y '
  'sigue sin entrar.';
