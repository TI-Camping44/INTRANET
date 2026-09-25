-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- Vincula a cada persona con su fila del tablero comercial
-- =====================================================================
-- Diego pidio que cada comercial vea como va contra su objetivo, dentro
-- de la intranet. Ese calculo YA EXISTE: el tablero comercial lo hace
-- desde una planilla de Google publicada, con la meta y lo vendido por
-- vendedor. La intranet lee esa misma planilla; no calcula nada propio ni
-- toca Odoo.
--
-- Lo unico que falta es saber que fila le corresponde a cada persona. La
-- planilla identifica al vendedor por la columna `Cod`, que no es un
-- codigo sino el nombre completo tal como figura en Odoo
-- —«Antonio De Jesus Fernandez Benitez»—, y la intranet identifica por el
-- correo de Google. No hay forma automatica de unirlos: los nombres no
-- coinciden con los correos y adivinar por parecido es como se terminan
-- mostrando las ventas de otra persona.
--
-- Asi que se carga a mano, una vez por comercial, desde Usuarios y roles.
-- Son unos pocos vendedores y cambia cuando entra o sale alguien.
--
-- Vacio significa «no es comercial»: la pantalla no aparece en el menu.

alter table public.usuarios
  add column if not exists vendedor_planilla text;

comment on column public.usuarios.vendedor_planilla is
  'Valor exacto de la columna «Cod» del tablero comercial, que identifica '
  'al vendedor en la planilla. Vacio = la persona no es comercial.';

-- Dos personas no pueden apuntar a la misma fila: seria una de las dos
-- viendo las ventas de la otra. El indice es parcial para no chocar entre
-- todos los que lo tienen vacio.
create unique index if not exists usuarios_vendedor_planilla_unico
  on public.usuarios (empresa_id, vendedor_planilla)
  where vendedor_planilla is not null;
