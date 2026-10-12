-- ---------------------------------------------------------------------
-- A que departamento pertenece cada puesto
--
-- Es el cimiento para acotar por area lo que ve cada persona: hoy el
-- permiso dice QUE MODULOS ve un rol, y falta decir QUE FILAS ve dentro
-- de cada modulo.
--
-- HACIA FALTA UNA COLUMNA NUEVA, y no alcanzaba con la que ya estaba.
-- `puestos.area` tiene siete valores de texto libre —«Comercial y
-- Marketing», «Administracion y Finanzas»…— mientras que las no
-- conformidades, los reclamos y los objetivos se atribuyen a una de
-- CATORCE: las de `DEPARTAMENTOS` en `lib/constantes.ts`. Las dos listas
-- no coinciden, y la diferencia importa: «Consumidor Final» y
-- «Mayorista» son departamentos distintos para una no conformidad, pero
-- en `puestos.area` los dos caen dentro de «Comercial y Marketing». Sin
-- esta columna, el jefe del canal Consumidor Final veria tambien las
-- desviaciones de Mayorista.
--
-- `puestos.area` NO se toca ni se borra: es lo que muestra el perfil de
-- puesto R-02-01 y lo que vino del legajo.
--
-- La carga de abajo es UNA PROPUESTA, no un dato de Calidad. Sale de
-- leer el nombre de cada puesto. Se corrige desde la ficha del puesto,
-- que es donde tiene que poder corregirse, y por eso la columna admite
-- nulo: un puesto sin departamento declarado es visible, no un error.
-- ---------------------------------------------------------------------

alter table public.puestos
  add column if not exists departamento text;

-- Las mismas catorce que `DEPARTAMENTOS_VIGENTES` en `lib/constantes.ts`
-- y que el CHECK de `no_conformidades.area`. Si cambia, cambia en todos.
alter table public.puestos drop constraint if exists puestos_departamento_valido;
alter table public.puestos add constraint puestos_departamento_valido check (
  departamento is null or departamento in (
    'administracion', 'tesoreria_caja', 'creditos_cobranzas', 'contabilidad',
    'recepcion', 'consumidor_final', 'mayorista', 'marketing',
    'operaciones_logistica', 'informatica', 'capital_humano',
    'gestion_calidad', 'gestion_regulatoria', 'directorio'
  )
);

comment on column public.puestos.departamento is
  'A cual de los catorce departamentos pertenece el puesto. Es con lo '
  'que se acota por area lo que ve cada persona. Distinto de `area`, '
  'que son las siete del legajo y se muestra en el perfil R-02-01.';

create index if not exists puestos_departamento_idx
  on public.puestos (empresa_id, departamento);

-- ---------------------------------------------------------------------
-- La propuesta inicial, por nombre de puesto
--
-- `on conflict` no aplica: se escribe solo donde todavia no hay nada,
-- para que volver a correrla no pise una correccion de Calidad.
-- ---------------------------------------------------------------------

update public.puestos p set departamento = v.departamento
from (values
  -- Administracion y Finanzas
  ('Analista de Administración',                        'administracion'),
  ('Asistente de Administración y Archivo',             'administracion'),
  ('Asistente de Administración y Sistemas',            'administracion'),
  ('Asistente de Administración y Stock',               'administracion'),
  ('Gerente de Administración y Finanzas',              'administracion'),
  ('Jefe de Administración',                            'administracion'),
  ('Analista de Créditos y Cobranzas',                  'creditos_cobranzas'),
  ('Asistente de Créditos y Cobranzas',                 'creditos_cobranzas'),
  ('Analista de Tesorería',                             'tesoreria_caja'),
  ('Cajero',                                            'tesoreria_caja'),
  ('Recepcionista',                                     'recepcion'),

  -- Capital Humano
  ('Asistente de Capital Humano',                       'capital_humano'),
  ('Jefe de Capital Humano',                            'capital_humano'),

  -- Comercial: el canal decide, no el area del legajo
  ('Asesor Comercial Consumidor Final',                 'consumidor_final'),
  ('Asesor Comercial Ventas Externas',                  'consumidor_final'),
  ('Asistente Comercial',                               'consumidor_final'),
  ('Asistente de Comercio Electrónico',                 'consumidor_final'),
  ('Jefe del Canal Consumidor Final',                   'consumidor_final'),
  ('Supervisor del Canal Consumidor Final',             'consumidor_final'),
  ('Instructor de Tiro',                                'consumidor_final'),
  ('Asesor Comercial Mayorista',                        'mayorista'),
  ('Supervisor del Canal Mayorista',                    'mayorista'),
  ('Supervisor de Desarrollo del Canal Mayorista',      'mayorista'),
  ('Analista de Marketing',                             'marketing'),
  ('Creador de Contenido y Redes Sociales',             'marketing'),
  ('Diseñador Gráfico',                                 'marketing'),
  ('Jefe de Marketing',                                 'marketing'),
  -- Abarca los tres departamentos comerciales. Queda en el mas grande
  -- y es de los primeros que Calidad tiene que mirar.
  ('Gerente Comercial y de Marketing',                  'consumidor_final'),

  -- Operaciones y Logistica
  ('Asistente de Logística Administrativo',             'operaciones_logistica'),
  ('Asistente de Logística y Gestiones',                'operaciones_logistica'),
  ('Asistente de Logística y Stock',                    'operaciones_logistica'),
  ('Asistente de Servicio Técnico',                     'operaciones_logistica'),
  ('Jefe de Operaciones y Logística',                   'operaciones_logistica'),
  ('Supervisor de Depósito e Infraestructura',          'operaciones_logistica'),
  ('ATC Posventa',                                      'operaciones_logistica'),

  -- Gestion Regulatoria: es su propio departamento aunque en el legajo
  -- cuelgue de Operaciones.
  ('Asistente de Gestión Regulatoria',                  'gestion_regulatoria'),
  ('ATC de Gestión Regulatoria',                        'gestion_regulatoria'),
  ('Gestor',                                            'gestion_regulatoria'),

  -- El resto
  ('Responsable de TI',                                 'informatica'),
  ('Coordinador de Auditoría, Calidad y Mejora Continua', 'gestion_calidad'),
  ('Director',                                          'directorio'),
  ('Gerente General',                                   'directorio'),
  ('Presidente',                                        'directorio')
) as v(nombre, departamento)
where p.nombre = v.nombre
  and p.departamento is null;
