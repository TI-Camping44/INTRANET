-- ---------------------------------------------------------------------
-- Los nombres de las dos empresas del grupo, con sus tildes.
--
-- En la base decian «Vitalica» y «Vitalica E.A.S.», sin tilde. Venia del
-- seed, donde los identificadores de SQL se escriben sin tildes para no
-- tener que entrecomillarlos; pero esto no es un identificador, es el
-- texto que ve la persona y el que se imprime en el membrete de la carta
-- de evaluacion que se le entrega a un Asociado de Negocio.
--
-- Un documento que sale de la empresa con la razon social mal escrita es
-- un problema de imagen y, en un sistema de gestion de calidad, un
-- hallazgo.
-- ---------------------------------------------------------------------

update public.empresas
set nombre = 'Vitálica',
    razon_social = 'Vitálica E.A.S.'
where id = '22222222-2222-4222-8222-222222222222';
