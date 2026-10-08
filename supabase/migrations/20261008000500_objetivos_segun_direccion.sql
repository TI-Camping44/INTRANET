-- ---------------------------------------------------------------------
-- El objetivo de la calidad, rehecho segun Direccion (8 de octubre).
--
-- QUE PEDIA ANTES: codigo escrito a mano, año, meta en texto libre y un
-- porcentaje de avance. Con eso no se puede decir que se mide, en que
-- periodo, con que frecuencia ni contra que resultado esperado, que es
-- justo lo que hace falta para la Revision por la Direccion.
--
-- QUE PIDE AHORA: denominacion, empresa del grupo, periodo de medicion,
-- tipo de resultado —Si/No, texto o valor numerico con minimo, maximo y
-- unidad—, frecuencia, responsable, fuente de datos, recursos y quien
-- los provee.
--
-- LAS COLUMNAS VIEJAS QUEDAN. `anio` se deriva de la fecha de inicio,
-- `meta` y `avance_porcentaje` los sigue usando la hoja del plan, y
-- `proceso_id` los registros ya cargados. No habia ninguno: la tabla
-- estaba vacia, asi que no hubo que convertir nada.
--
-- EL CODIGO SE GENERA: `OBJ-001` en adelante. Nadie quiere inventarlo al
-- dar de alta, y a mano se repite o se saltea.
--
-- EL CICLO SON CUATRO ESTADOS: identificado, a medir proximamente, en
-- medicion y cerrado. Cerrar exige declarar si se alcanzo o no —lo
-- controla `objetivos_cierre_declarado`—, porque un objetivo cerrado sin
-- resultado no dice nada.
--
-- Van como CHECK y no como enumerado a proposito: en PostgreSQL un valor
-- de enumerado no se puede quitar nunca, y estos cuatro estados los
-- acaba de definir Direccion.
-- ---------------------------------------------------------------------

alter table public.objetivos
  add column if not exists empresa_objetivo_id uuid references public.empresas (id),
  add column if not exists fecha_inicio_medicion date,
  add column if not exists fecha_fin_medicion date,
  add column if not exists tipo_resultado text,
  add column if not exists resultado_esperado_si_no boolean,
  add column if not exists resultado_esperado_texto text,
  add column if not exists valor_minimo numeric,
  add column if not exists valor_maximo numeric,
  add column if not exists unidad_valor text,
  add column if not exists frecuencia_medicion text,
  add column if not exists fuente_datos text,
  add column if not exists recursos_requeridos text,
  add column if not exists proveedor_recursos text,
  add column if not exists objetivo_alcanzado boolean,
  add column if not exists comentario_cierre text;

alter table public.objetivos
  drop constraint if exists objetivos_tipo_resultado_valido,
  drop constraint if exists objetivos_frecuencia_valida,
  drop constraint if exists objetivos_estado_valido,
  drop constraint if exists objetivos_cierre_declarado,
  drop constraint if exists objetivos_periodo_valido;

alter table public.objetivos
  add constraint objetivos_tipo_resultado_valido
    check (tipo_resultado is null or tipo_resultado in ('si_no', 'texto', 'numerico')),
  add constraint objetivos_frecuencia_valida
    check (frecuencia_medicion is null or frecuencia_medicion in
      ('semanal', 'mensual', 'trimestral', 'semestral', 'anual')),
  add constraint objetivos_estado_valido
    check (estado in ('identificado', 'a_medir', 'en_medicion', 'cerrado')),
  add constraint objetivos_periodo_valido
    check (fecha_fin_medicion is null or fecha_inicio_medicion is null
           or fecha_fin_medicion >= fecha_inicio_medicion),
  add constraint objetivos_cierre_declarado
    check (estado <> 'cerrado' or objetivo_alcanzado is not null);

alter table public.objetivos alter column estado set default 'identificado';
