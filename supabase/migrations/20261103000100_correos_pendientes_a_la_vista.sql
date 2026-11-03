-- Cuántas notificaciones quedaron sin salir por correo, para avisarlo
-- en pantalla.
--
-- POR QUE HACE FALTA: el SMTP se cayó el 10 de octubre —se revocó la
-- contraseña de aplicación de Google— y nadie se enteró hasta el 3 de
-- noviembre, de casualidad, cuando alguien preguntó por qué no le había
-- llegado el aviso de una no conformidad. Veinte notificaciones
-- quedaron con `correo_enviado = false` y el sistema no dijo nada.
--
-- EL AVISO NO PUEDE IR POR CORREO, que es justamente lo que está caído.
-- Va en la pantalla de Usuarios, que es donde mira el Administrador SGC.
--
-- Y POR QUE UNA FUNCION Y NO UNA CONSULTA: la política de lectura de
-- `notificaciones` es `usuario_id = auth.uid()`, así que el
-- Administrador SGC solo ve las propias —y está bien que así sea, una
-- notificación es personal y su texto no le corresponde a nadie más—.
-- Lo que hace falta es el AGREGADO, no el contenido: cuántas hay, cuántas
-- están atrasadas y de cuándo es la más vieja. Esta función devuelve
-- exactamente eso y nada más.
--
-- El corte de «atrasada» llega por parámetro, no escrito acá: lo decide
-- `HORAS_SIN_ENVIAR_PARA_AVISAR` en `lib/constantes.ts`, así el número
-- vive en un solo lado.

create or replace function public.correos_pendientes(p_horas integer)
returns table (pendientes integer, atrasadas integer, mas_vieja timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::int as pendientes,
    count(*) filter (
      where n.creado_en < now() - make_interval(hours => p_horas)
    )::int as atrasadas,
    min(n.creado_en) as mas_vieja
  from public.notificaciones n
  where n.requiere_correo
    and not n.correo_enviado
    -- EL CONTROL ESTA ACA, no en la pantalla: para cualquier otro rol la
    -- condicion no se cumple y la funcion devuelve ceros.
    and public.es_admin_sgc();
$$;

comment on function public.correos_pendientes(integer) is
  'Agregado de notificaciones sin enviar por correo, solo para el Administrador SGC. No devuelve contenido.';
