-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- Amplia los formatos que acepta el deposito de adjuntos
-- =====================================================================
-- Calidad pidio poder subir cualquier archivo y no solo PDF, y la
-- aplicacion se cambio para permitirlo. El deposito no: seguia con la
-- lista de doce formatos de la migracion 016.
--
-- El resultado era el peor de los dos mundos. La pantalla dejaba elegir
-- un .zip o un .odt, la persona apretaba guardar y el deposito lo
-- rechazaba con un error que no explicaba nada. Nadie lo reporto todavia
-- porque hasta ahora solo se subieron PDF, pero iba a pasar.
--
-- Se agregan los formatos que esta empresa usa de verdad: comprimidos
-- para mandar un juego de planos o de fotos, planos de AutoCAD para
-- infraestructura, OpenDocument y RTF porque no todas las maquinas
-- tienen Office, y GIF y SVG que faltaban al lado de PNG y JPEG.
--
-- NO se quita la restriccion del todo, que era la otra opcion. La lista
-- es la unica barrera que impide que alguien suba un ejecutable a un
-- deposito que despues descargan las 49 personas de la empresa. Un .exe
-- o un .bat no tiene nada que hacer en un sistema de gestion de calidad,
-- y el costo de mantener esta lista es agregar una linea el dia que
-- aparezca un formato nuevo.
--
-- El limite de 20 MB por archivo no cambia.

update storage.buckets
set allowed_mime_types = array[
  -- Los que ya estaban
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
  'text/csv',

  -- Imagenes que faltaban
  'image/gif',
  'image/svg+xml',
  'image/bmp',
  'image/tiff',

  -- Comprimidos. Hay navegadores que mandan el .zip con otro nombre, asi
  -- que van los tres que se ven en la practica.
  'application/zip',
  'application/x-zip-compressed',
  'multipart/x-zip',
  'application/vnd.rar',
  'application/x-rar-compressed',
  'application/x-7z-compressed',

  -- Planos, para infraestructura y activos
  'image/vnd.dwg',
  'application/acad',
  'image/vnd.dxf',
  'application/dxf',

  -- OpenDocument y RTF: no todas las maquinas tienen Office
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'application/rtf',
  'text/rtf'
]
where id = 'adjuntos-sgc';
