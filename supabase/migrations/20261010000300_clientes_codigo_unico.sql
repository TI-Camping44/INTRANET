-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- El codigo del cliente es su id en Odoo, y no se repite
-- =====================================================================
-- La cartera de clientes se carga desde la exportacion de contactos de
-- Odoo (`res.partner`), igual que el padron de la nomina. Y como el
-- padron, se va a volver a cargar cada vez que Odoo cambie.
--
-- Para que la segunda carga actualice en vez de duplicar hace falta una
-- clave estable, y la unica que hay es el id del contacto en Odoo: la
-- razon social se corrige, el RUC se tipea mal y se arregla, el correo
-- cambia. El id no.
--
-- Va en `clientes.codigo`, que estaba sin uso, con su indice unico.
--
-- PARCIAL, por `codigo is not null`: un cliente cargado a mano desde la
-- intranet no tiene id de Odoo, y varios sin codigo no se pisan entre
-- si. Sin el `where`, PostgreSQL trata los nulos como distintos igual,
-- pero el indice parcial lo deja escrito y ademas no los indexa.
-- =====================================================================

create unique index if not exists clientes_codigo_unico
  on public.clientes (empresa_id, codigo)
  where codigo is not null;

comment on column public.clientes.codigo is
  'El id del contacto en Odoo. Es la clave con la que la importacion vuelve a correr sin duplicar.';
