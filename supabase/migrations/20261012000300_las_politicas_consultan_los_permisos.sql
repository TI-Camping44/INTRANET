-- ---------------------------------------------------------------------
-- Las politicas RLS pasan a consultar la matriz de permisos
--
-- La migracion anterior trajo la tabla y las funciones. Esta las
-- enchufa: cada politica de una tabla que pertenece a un modulo queda
-- con un `and puede_ver(...)` o `and puede_editar(...)` encima de lo
-- que ya exigia.
--
-- SE SUMA, NO REEMPLAZA. La condicion vieja queda intacta: el
-- responsable de proceso sigue viendo las filas de sus procesos y
-- `misma_empresa()` sigue acotando por empresa. El modulo es una
-- condicion mas, necesaria y no suficiente.
--
-- Se aplica con un bucle sobre `pg_policies` y no reescribiendo las 129
-- politicas a mano. Reescribirlas serian mil quinientas lineas copiadas
-- con el riesgo de que una quede distinta de la original por un error
-- de tipeo, y esa una seria un agujero. El bucle no puede equivocarse
-- en la condicion vieja porque no la escribe: la lee y le agrega algo.
--
-- Lo que SI se escribe a mano, porque es la decision y no la mecanica,
-- es el mapa de abajo: que tabla pertenece a que modulo.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- Las tablas que NO se acotan, y por que
--
--   usuarios      Lo lee todo el sistema para mostrar un nombre. Si se
--                 acotara, cualquier pantalla que diga quien cargo algo
--                 quedaria rota para medio padron. El modulo «usuarios»
--                 gobierna la PANTALLA de Configuraciones; la escritura
--                 ya es del Administrador SGC en su propia politica.
--   empresas      Tablas de referencia: las lee cualquier pantalla para
--   sedes         llenar un desplegable o resolver un nombre. Acotarlas
--   procesos      por un modulo romperia los demas.
--   normas
--   adjuntos      Una sola tabla para todos los modulos, distinguidos
--                 por la columna `entidad`. Un solo modulo no la
--                 describe; acotarla por uno cerraria los otros.
--   notificaciones  Son de cada persona, no de un modulo.
--   permisos      No puede depender de si misma para decidir quien la
--                 lee.
--   personas_sofidya        Restos de la migracion desde Sofidya, ya
--   importaciones_sofidya   restringidos al Administrador SGC.
--
-- De estas, «usuarios» es la unica cuyo permiso queda SOLO en la
-- pantalla. Esta dicho aca para que nadie lo lea como un control de
-- acceso que no es.
-- ---------------------------------------------------------------------

do $enchufar$
declare
  v record;
  v_gate text;
  v_qual text;
  v_check text;
  v_tocadas int := 0;
  v_salteadas int := 0;
begin
  for v in
    select p.tablename, p.policyname, p.cmd, p.qual, p.with_check, m.modulo
    from pg_policies p
    join (values
      -- Intranet
      ('publicaciones',            'inicio'),
      ('ventas_mensuales',         'mis_ventas'),
      ('ventas_sincronizacion',    'mis_ventas'),
      -- Informacion documentada
      ('documentos',               'documentos'),
      ('documento_categorias',     'documentos'),
      ('documento_difusion',       'documentos'),
      ('documento_revisores',      'documentos'),
      ('documento_texto',          'documentos'),
      ('documento_versiones',      'documentos'),
      -- Riesgos y oportunidades
      ('riesgos',                  'riesgos'),
      ('riesgo_acciones',          'riesgos'),
      ('riesgo_documentos',        'riesgos'),
      ('riesgo_accion_documentos', 'riesgos'),
      ('riesgo_evaluaciones',      'riesgos'),
      -- Objetivos e indicadores
      ('objetivos',                'objetivos'),
      ('objetivo_mediciones',      'objetivos'),
      ('objetivo_planes',          'objetivos'),
      ('objetivo_indicadores',     'objetivos'),
      ('indicadores',              'objetivos'),
      ('indicador_mediciones',     'objetivos'),
      -- Auditorias
      ('auditorias',               'auditorias'),
      ('auditoria_documentos',     'auditorias'),
      ('auditoria_equipo',         'auditorias'),
      ('auditoria_hallazgos',      'auditorias'),
      ('auditoria_procesos',       'auditorias'),
      ('programas_auditoria',      'auditorias'),
      -- Cambios
      ('cambios',                  'cambios'),
      -- No conformidades y acciones correctivas
      ('no_conformidades',         'no_conformidades'),
      ('nc_porques',               'no_conformidades'),
      -- `nc_acciones` va con «acciones correctivas», que es un modulo
      -- propio en el menu. Quien vea no conformidades pero no acciones
      -- va a ver la NC sin sus acciones: por eso los valores iniciales
      -- dan los dos juntos a todos los roles que tienen alguno.
      ('nc_acciones',              'acciones'),
      -- Reclamos de clientes
      ('reclamos',                 'reclamos'),
      ('reclamo_acciones',         'reclamos'),
      -- La cartera sale del formulario de reclamo: son 8.551 contactos
      -- de Odoo con RUC y cedula, no una tabla de referencia.
      ('clientes',                 'reclamos'),
      -- Satisfaccion del cliente
      ('encuestas',                'satisfaccion'),
      ('encuesta_respuestas',      'satisfaccion'),
      -- Infraestructura y activos
      ('activos',                  'activos'),
      ('mantenimientos',           'activos'),
      -- Personas
      ('puestos',                  'personas'),
      ('puesto_competencias',      'personas'),
      ('competencias',             'personas'),
      ('evaluaciones_competencia', 'personas'),
      ('capacitaciones',           'personas'),
      ('capacitacion_participantes', 'personas'),
      -- Asociados de negocio
      ('proveedores',              'proveedores'),
      ('proveedor_evaluaciones',   'proveedores'),
      -- Configuraciones
      ('personas_nomina',          'padron'),
      ('ingresos',                 'ingresos'),
      ('bitacora',                 'bitacora')
    ) as m(tabla, modulo) on m.tabla = p.tablename
    where p.schemaname = 'public'
  loop
    -- Idempotente: si la politica ya quedo acotada, no se la vuelve a
    -- envolver. Correr la migracion dos veces no apila condiciones.
    if coalesce(v.qual, '') like '%puede_ver(%'
       or coalesce(v.qual, '') like '%puede_editar(%'
       or coalesce(v.with_check, '') like '%puede_ver(%'
       or coalesce(v.with_check, '') like '%puede_editar(%' then
      v_salteadas := v_salteadas + 1;
      continue;
    end if;

    -- La lectura se acota con `ver`; todo lo que escribe, con `editar`.
    -- Una politica `for all` gobierna tambien el select, pero como las
    -- politicas se suman, quien solo tiene `ver` igual lee por la
    -- politica de lectura de esa tabla.
    if v.cmd = 'SELECT' then
      v_gate := format('public.puede_ver(%L)', v.modulo);
    else
      v_gate := format('public.puede_editar(%L)', v.modulo);
    end if;

    -- Si la condicion vieja es nula se deja nula: en una politica `for
    -- all` sin `with check` propio, PostgreSQL usa el `using`, y
    -- rellenarlo cambiaria el comportamiento.
    v_qual := case when v.qual is null then null
                   else format('(%s) and %s', v.qual, v_gate) end;
    v_check := case when v.with_check is null then null
                    else format('(%s) and %s', v.with_check, v_gate) end;

    execute format('drop policy %I on public.%I', v.policyname, v.tablename);

    execute format(
      'create policy %I on public.%I for %s to authenticated %s %s',
      v.policyname,
      v.tablename,
      case v.cmd when 'ALL' then 'all' else lower(v.cmd) end,
      case when v_qual is null then '' else 'using (' || v_qual || ')' end,
      case when v_check is null then '' else 'with check (' || v_check || ')' end
    );

    v_tocadas := v_tocadas + 1;
  end loop;

  raise notice 'politicas acotadas por modulo: %, ya acotadas: %', v_tocadas, v_salteadas;
end
$enchufar$;
