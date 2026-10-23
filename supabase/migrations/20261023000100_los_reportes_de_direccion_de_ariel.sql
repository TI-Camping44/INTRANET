-- Los tres reportes que pasó Ariel Kemper para el Directorio.
--
-- Son tres enlaces de Apps Script, y Ariel declaró el público de cada
-- uno: el EBITDA para el Directorio, el Reporte de Cobranzas para
-- Cobranzas y el Directorio, y la Planilla Financiera para Tesorería y
-- el Directorio.
--
-- HOY SOLO SE PUEDE SERVIR LA PARTE DE DIRECTORIO, y conviene que quede
-- escrito por qué: no existe un rol `cobranzas` ni un rol `tesoreria`
-- —los roles son los seis de la matriz de permisos— y tampoco ingresó
-- al sistema nadie de esas dos áreas, así que no hay a quién nombrar en
-- `usuarios_visibles`. Las dos tarjetas se cargan con el público que sí
-- se puede expresar y se les suma gente a medida que entre.
--
-- Y VAN CON EDUARDO KEMPER NOMBRADO A MANO. Es el Presidente, del área
-- Directorio, pero su perfil tiene rol `colaborador`, así que
-- `roles_visibles = {direccion}` —que son Diego Kemper y Ariel— lo
-- dejaría justamente afuera de los reportes del Directorio.
-- `usuarios_visibles` lo arregla sin tocarle el rol, que es una decisión
-- aparte y de más alcance: el rol gobierna todo el sistema, no estas
-- tres tarjetas.
--
-- Las tres son de Apps Script, así que NO SE PUEDEN ABRIR PARA
-- VERIFICARLAS: exigen cuenta del dominio. El nombre y la descripción
-- son los que declaró quien las pasó, igual que con los otros tableros
-- de Workspace.

insert into public.aplicaciones
  (empresa_id, nombre, descripcion, url, publico, orden, roles_visibles, usuarios_visibles)
select
  (select id from public.empresas where nombre = 'Camping 44'),
  entrada.nombre,
  entrada.descripcion,
  entrada.url,
  'direccion',
  entrada.orden,
  array['direccion']::public.rol_usuario[],
  array(select id from public.usuarios where correo = 'eduardokemper@camping44.com.py')
from (values
  (
    'EBITDA',
    'El EBITDA del grupo. Lo pasó Ariel Kemper para el Directorio.',
    'https://script.google.com/a/macros/camping44.com.py/s/AKfycbzq0TsgohYOldTvEzBfdp_PM417glb_jVNGf7MsKxXgpCgZdPsh9OjwUSKDK-PG6LnU/exec',
    1
  ),
  (
    'Reporte de Cobranzas',
    'El estado de la cobranza. Lo pasó Ariel Kemper para Cobranzas y el Directorio.',
    'https://script.google.com/a/macros/camping44.com.py/s/AKfycbxOLEt2mSm03v4YY_sP0t2QBrrY2ZGXwcQ_8FOmfbnTMIpJzHJweQLmvypsXQw1XFsxfA/exec',
    2
  ),
  (
    'Planilla Financiera',
    'La planilla financiera. Lo pasó Ariel Kemper para Tesorería y el Directorio.',
    'https://script.google.com/a/macros/camping44.com.py/s/AKfycbw9zLbJh6vwX82aw_zw_6rRuX8tG0o-deSibjd_avdbJ87fIyYPyBBVne52aZNyff3R_w/exec',
    3
  )
) as entrada(nombre, descripcion, url, orden)
on conflict (empresa_id, nombre) do nothing;
