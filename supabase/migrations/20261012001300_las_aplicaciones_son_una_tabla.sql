-- ---------------------------------------------------------------------
-- Las aplicaciones pasan a ser una tabla, con quien las ve adentro
--
-- HASTA HOY ERAN TODAS O NINGUNA. `aplicaciones` es un modulo de la
-- matriz de permisos, asi que apagarle «ver» a un rol le saca la
-- pantalla entera; pero quien entra ve las quince tarjetas. Un vendedor
-- veia el Tablero comercial, el Informe de Vitalica, Gestion
-- regulatoria y los Objetivos mensuales igual que Direccion.
--
-- La lista estaba escrita en `lib/aplicaciones.ts`. El propio archivo
-- decia cuando tenia que dejar de estarlo: «cuando se vuelvan muchas o
-- las tenga que cambiar alguien que no toca codigo, pasa a una tabla».
-- Las dos cosas pasaron a la vez: hace falta decidir quien ve cada una,
-- y esa decision no puede exigir un cambio de codigo y un despliegue.
--
-- QUIEN VE QUE VIVE EN LA FILA, no en el codigo: `roles_visibles` es un
-- arreglo de roles y la politica de lectura lo consulta. Es la misma
-- doctrina que `permisos`, con la diferencia de que aca la unidad es la
-- aplicacion y no el modulo, asi que una fila por aplicacion alcanza y
-- no hace falta una tabla hija con una fila por rol.
--
-- OJO CON LO QUE ESTO NO HACE. Esconder la tarjeta no cierra la
-- aplicacion: los catalogos y tableros viven en GitHub Pages, que son
-- paginas publicas en Internet, y entra cualquiera que tenga el enlace
-- aunque no tenga sesion. Los de Apps Script si exigen cuenta del
-- dominio. Esto ordena la pantalla y evita que alguien se entere de que
-- algo existe; el control de esos tableros esta del otro lado.
-- ---------------------------------------------------------------------

create table if not exists public.aplicaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nombre text not null,
  descripcion text not null,
  url text not null,
  publico text not null,
  orden integer not null default 0,
  -- A QUE ROLES SE LES MUESTRA. Vacio significa que no la ve nadie mas
  -- que quien administra la lista, que es como se oculta una
  -- aplicacion sin perder su direccion.
  --
  -- El Administrador SGC no se carga aca: la politica de lectura lo
  -- deja pasar por `puede_editar`, igual que el piso de `puede_ver()`.
  roles_visibles public.rol_usuario[] not null default '{}',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references public.usuarios (id)
);

-- Las restricciones van fuera del `create table`: con `if not exists`,
-- una tabla que ya existe saltea el bloque entero y nunca se aplicarian.
alter table public.aplicaciones drop constraint if exists aplicaciones_publico_valido;
alter table public.aplicaciones add constraint aplicaciones_publico_valido check (publico in (
  'solicitudes', 'general', 'comercial', 'operaciones', 'tecnologia', 'direccion'
));

-- LA DIRECCION TIENE QUE SER HTTPS, y es un control de seguridad y no
-- una formalidad: la tarjeta es un enlace que la pantalla dibuja tal
-- cual, asi que sin esto quien administre la lista podria pegar un
-- `javascript:` y el resto lo abriria desde su propia sesion.
alter table public.aplicaciones drop constraint if exists aplicaciones_url_https;
alter table public.aplicaciones add constraint aplicaciones_url_https
  check (url like 'https://%' and length(url) <= 2048);

alter table public.aplicaciones drop constraint if exists aplicaciones_textos_con_largo;
alter table public.aplicaciones add constraint aplicaciones_textos_con_largo check (
  length(trim(nombre)) between 1 and 80
  and length(trim(descripcion)) between 1 and 300
);

-- Dos tarjetas con el mismo nombre son un error de carga, no un caso.
create unique index if not exists aplicaciones_empresa_nombre
  on public.aplicaciones (empresa_id, nombre);

comment on table public.aplicaciones is
  'Los catalogos, tableros y formularios que la empresa ya tiene '
  'publicados. La intranet no los reemplaza: los reune y decide quien '
  've cada uno.';

comment on column public.aplicaciones.roles_visibles is
  'A que roles se les muestra la tarjeta. Vacio: solo quien administra '
  'la lista. El Administrador SGC siempre las ve.';

comment on column public.aplicaciones.orden is
  'Orden dentro de su grupo. Entre iguales ordena el nombre.';

drop trigger if exists aplicaciones_actualizacion on public.aplicaciones;
create trigger aplicaciones_actualizacion
  before update on public.aplicaciones
  for each row execute function public.marcar_actualizacion();

-- QUIEN CAMBIO UN ENLACE Y CUANDO ES DATO DE AUDITORIA: la tarjeta la
-- abre gente desde su sesion de trabajo, asi que cambiar una direccion
-- es cambiar adonde va a parar la empresa.
drop trigger if exists bitacora_aplicaciones on public.aplicaciones;
create trigger bitacora_aplicaciones
  after insert or update or delete on public.aplicaciones
  for each row execute function public.registrar_bitacora();

-- ---------------------------------------------------------------------
-- RLS. La tabla esta fuera del bucle de `..._politicas_rls.sql`, asi
-- que necesita su grant explicito: sin el, PostgreSQL corta antes de
-- evaluar las politicas y la pantalla queda vacia sin decir por que.
-- ---------------------------------------------------------------------

alter table public.aplicaciones enable row level security;
revoke all on public.aplicaciones from anon;
grant select, insert, update, delete on public.aplicaciones to authenticated;

-- LA LECTURA ES LA QUE APLICA EL PERMISO. No se filtra en la pantalla:
-- quien no tiene el rol no recibe la fila, asi que no se entera ni de
-- que la aplicacion existe. Quien administra la lista las ve todas,
-- porque si no, no podria volver a habilitar lo que oculto.
drop policy if exists aplicaciones_lectura on public.aplicaciones;
create policy aplicaciones_lectura on public.aplicaciones
  for select to authenticated
  using (
    public.misma_empresa(empresa_id)
    and (
      public.puede_editar('aplicaciones')
      or public.rol_actual() = any (roles_visibles)
    )
  );

-- La escritura sale del mismo lugar que todo lo demas: «editar» del
-- modulo `aplicaciones` en la matriz de permisos.
drop policy if exists aplicaciones_administracion on public.aplicaciones;
create policy aplicaciones_administracion on public.aplicaciones
  for all to authenticated
  using (public.misma_empresa(empresa_id) and public.puede_editar('aplicaciones'))
  with check (public.misma_empresa(empresa_id) and public.puede_editar('aplicaciones'));

-- ---------------------------------------------------------------------
-- Valores iniciales
-- ---------------------------------------------------------------------

-- Las quince aplicaciones que estaban escritas en `lib/aplicaciones.ts`.
-- Se cargan VISIBLES PARA TODOS LOS ROLES, que es como estaban hasta
-- hoy: esta migracion trae la herramienta, no decide quien ve que.
-- Eso se define desde la pantalla, que es el punto del cambio.
insert into public.aplicaciones
  (empresa_id, nombre, descripcion, url, publico, orden, roles_visibles)
select
  e.id, v.nombre, v.descripcion, v.url, v.publico, v.orden,
  array['direccion', 'responsable_proceso', 'auditor', 'vendedor', 'colaborador']::public.rol_usuario[]
from public.empresas e
cross join (values
  ('Tickets de solicitud para TI', 'Para pedir asistencia a Informática y seguir el pedido.', 'https://script.google.com/a/macros/camping44.com.py/s/AKfycbz-hpHVtLbQgn0hHvQQd-BZymgT40l-kyGqdXDaJ4L0ydThZJLowx031Uzu7-ti-SqtAg/exec', 'solicitudes', 0),
  ('Tickets de solicitud para Logística', 'Para pedir movimientos, retiros y entregas al departamento de Logística.', 'https://script.google.com/a/macros/camping44.com.py/s/AKfycbyJHegM7gNFwSqrK2X8wVJwtF9f0tyfS1PLMVJMA4z4q3bT2DLD9-UOsFv-Z2REyYyI/exec', 'solicitudes', 1),
  ('Tickets de solicitud para Marketing', 'Para pedir piezas, publicaciones y material de comunicación.', 'https://script.google.com/a/macros/camping44.com.py/s/AKfycbwFbrMH9e09811aXm1K46GDSON1sNbUdddW21P8A4cSv7AzjKq3Ly04QnILaYnQ1Iewvw/exec', 'solicitudes', 2),
  ('Tickets de solicitud para Administración', 'Para los pedidos que resuelve Administración.', 'https://script.google.com/a/macros/camping44.com.py/s/AKfycbwDT73kTk3SXL_h4Df73t23RjbwtWRUURfXZ5jGQIdX6wZ_zKIh7xDB4IM3A8DKdMEH/exec', 'solicitudes', 3),
  ('Tickets de solicitud para Calidad', 'Para los pedidos que resuelve Gestión de Calidad.', 'https://script.google.com/a/macros/camping44.com.py/s/AKfycbxzX4_hbpdVGkQy5--kOWm_CrAsh67GOpcVQqccbb5T64iGWRT9VG8dz-jiK0yHlT2C/exec', 'solicitudes', 4),
  ('Tickets de solicitud para Comercial', 'La solicitud de crédito por QR: el asesor comparte el enlace con el cliente y la solicitud entra a la base que revisa Créditos y Cobranzas.', 'https://script.google.com/a/macros/camping44.com.py/s/AKfycbxx2Onr73QveCXss_qmyzTu6qd2GQe6g5j6ki2wzbphqWbKo9o50FbwRyEu4tq9cy_vJQ/exec', 'solicitudes', 5),
  ('Tickets de solicitud de compra interna', 'Para pedir la compra de insumos o equipamiento del departamento.', 'https://docs.google.com/forms/d/e/1FAIpQLSfiaCoYHde68BDDM8KEiVmoP9WmV9nm2M_e-fZbu1CgapUDPQ/viewform', 'solicitudes', 6),
  ('Catálogo mayorista', 'El catálogo para clientes mayoristas, con precios y disponibilidad.', 'https://ti-camping44.github.io/CATALOGO-ODOO/', 'comercial', 7),
  ('Catálogo de salón', 'El catálogo para la venta en salón y consumidor final.', 'https://ti-camping44.github.io/CATALOGO-MINORISTA/', 'comercial', 8),
  ('Tablero comercial', 'Ventas del año contra el anterior, por línea y por vendedor.', 'https://ti-camping44.github.io/INFORMEVENTASC44/', 'comercial', 9),
  ('Objetivos mensuales · Comercial', 'Para cargar las metas del mes que después mide el tablero comercial.', 'https://script.google.com/a/macros/camping44.com.py/s/AKfycbyUoNwIWp_-99WlUZZpEwNrGdoosOa-VN45VnbglcfQUtDLJsDNoYJiQGFyr2a10f_jsw/exec', 'comercial', 10),
  ('Informe de ventas · Vitalica', 'El mismo informe, para la operación de Vitalica.', 'https://ti-camping44.github.io/INFORMEVENTASVITALICA/', 'comercial', 11),
  ('Panel de NPS', 'La medición de satisfacción que lleva Marketing. Es la fuente de Satisfacción del cliente en esta intranet.', 'https://ti-camping44.github.io/NPS-REPORTE/', 'general', 12),
  ('Stock y rotación', 'Clasificación ABC de productos por rotación. Es el objetivo de Gestión de demanda del Plan Estratégico 2026.', 'https://ti-camping44.github.io/ROTACIONABC/', 'operaciones', 13),
  ('Gestión regulatoria', 'Seguimiento de las gestiones ante DIGEMABEL.', 'https://ti-camping44.github.io/GESTIONREGULATORIA/', 'operaciones', 14)
) as v (nombre, descripcion, url, publico, orden)
on conflict (empresa_id, nombre) do nothing;
