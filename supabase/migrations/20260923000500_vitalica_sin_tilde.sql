-- ---------------------------------------------------------------------
-- «Vitalica» se escribe sin tilde
--
-- Lo corrigio Calidad. Es el nombre propio de la empresa del grupo, y un
-- nombre propio se escribe como lo escribe su dueno.
--
-- Se corrigen las dos columnas: `nombre`, que es como se la nombra
-- adentro, y `razon_social`, que es lo que aparece en el selector de la
-- no conformidad y en cualquier documento.
-- ---------------------------------------------------------------------

update public.empresas
   set nombre = 'Vitalica',
       razon_social = 'Vitalica E.A.S.'
 where nombre = 'Vitálica'
    or razon_social = 'Vitálica E.A.S.';
