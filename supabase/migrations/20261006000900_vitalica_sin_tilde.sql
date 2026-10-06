-- ---------------------------------------------------------------------
-- Vitalica va sin tilde: asi se llama.
--
-- La migracion 20261006000600 le habia puesto «Vitálica» dando por
-- sentado que faltaba la tilde en un texto que ve la persona. No
-- faltaba: la razon social es «VITALICA EAS», sin tilde, como la paso
-- Facundo junto con el RUC.
--
-- El membrete no se entera: `logotipoDeEmpresa()` compara ignorando
-- tildes, asi que el logotipo sigue resolviendose igual.
-- ---------------------------------------------------------------------

update public.empresas
set nombre = 'Vitalica',
    razon_social = 'Vitalica E.A.S.'
where id = '22222222-2222-4222-8222-222222222222';
