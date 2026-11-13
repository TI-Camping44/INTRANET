-- La imagen de una publicacion puede decir que muestra.
--
-- POR QUE. La auditoria de interfaz del 13 de noviembre encontro que
-- las imagenes del muro iban con `alt=""`, o sea declaradas como
-- decoracion. El propio codigo decia por que importa: «la mitad de lo
-- que se publica son capturas de texto —una circular, una pauta—». Una
-- circular fotografiada y marcada como decorativa, para quien usa
-- lector de pantalla, no existe.
--
-- Eso NO se podia arreglar desde el codigo: describir lo que una imagen
-- muestra solo lo puede hacer quien la sube. Por eso entra el campo.
--
-- ES OPCIONAL Y TIENE QUE SERLO. La regla del modulo es que cuanto
-- menos pregunta la portada, mas gente publica —es lo que saco «Sobre
-- quien» y «Proceso» del alta el 9 de octubre—. Un campo obligatorio
-- aca haria que se escriba cualquier cosa para pasar el control, que es
-- peor que no tenerlo: un `alt` con basura es ruido, no accesibilidad.
--
-- VA EN `publicaciones` Y NO EN `adjuntos` porque describe LA imagen de
-- la tarjeta, que es `url_imagen`: una columna, no una lista. Las demas
-- imagenes de una publicacion se dibujan en galeria y las nombra el
-- boton que las envuelve, con su posicion y el titulo. Si algun dia la
-- tarjeta admite varias, la descripcion se muda a `adjuntos` con ellas.

alter table public.publicaciones
  add column if not exists descripcion_imagen text;

alter table public.publicaciones
  drop constraint if exists publicaciones_descripcion_imagen_largo;

alter table public.publicaciones
  add constraint publicaciones_descripcion_imagen_largo
  check (descripcion_imagen is null or char_length(descripcion_imagen) <= 300);

comment on column public.publicaciones.descripcion_imagen is
  'Que muestra la imagen de la tarjeta, para quien no la puede ver. '
  'Opcional. Se usa como texto alternativo; nulo deja la imagen como '
  'decorativa y la nombra el boton que la envuelve.';
