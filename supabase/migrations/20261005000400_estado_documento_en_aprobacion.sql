-- =====================================================================
-- Intranet - Camping 44 S.A.
-- El paso «En aprobacion» del circuito documental
-- =====================================================================
-- El circuito que fijo Calidad es elaboracion → revision → aprobacion →
-- vigente. El estado del medio no existia: un documento cuyos revisores
-- ya habian aprobado seguia diciendo «En revision» hasta que alguien lo
-- publicaba.
--
-- Dos consecuencias, las dos malas: el aprobador no tenia donde ver que
-- le tocaba firmar, y un documento ya revisado se veia igual que uno que
-- nadie habia mirado todavia.
--
-- Cuando no queda ninguna revision pendiente, el documento pasa solo a
-- este estado y se le avisa al aprobador designado. La version vigente,
-- si la hay, no se toca: sigue siendo la aplicable hasta que la nueva se
-- apruebe.
-- ---------------------------------------------------------------------

alter type public.estado_documento add value if not exists 'en_aprobacion';
