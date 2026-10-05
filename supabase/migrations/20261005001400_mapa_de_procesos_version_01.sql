-- ---------------------------------------------------------------------
-- El mapa de procesos pasa a tener version, y conviven dos
--
-- Calidad aprobo un mapa nuevo —la version 01, de veintiun procesos— y
-- la intranet tenia cargado el anterior —la 00, de diecinueve—. No es
-- un renombre: los codigos no significan lo mismo en los dos.
-- `EST-01` es «Informacion Documentada» en la 00, y en la 01 ese mismo
-- proceso es `MP-SOP-01`, mientras que `MP-EST-01` pasa a ser
-- «Planificacion y Control del SGC».
--
-- CARLOS PIDIO EXPRESAMENTE MANTENER LA 00 INTACTA E INDEPENDIENTE. Los
-- veintiun documentos de la Lista Maestra cuelgan de ella, y
-- recodificarlos es una decision aparte que se toma documento por
-- documento. Las dos versiones conviven: lo nuevo se carga contra la 01
-- y los documentos siguen contra la 00. Cuando la migracion termine, se
-- da de baja la 00.
--
-- NO HAY CHOQUE DE CODIGOS: los de la 00 son `EST-01`, `MIS-01`,
-- `SOP-01` y los de la 01 llevan el prefijo `MP-`. El indice unico sobre
-- (empresa, codigo) sigue sirviendo sin tocarlo.
--
-- DOS PROCESOS DE LA 01 NO SE CARGAN: «MP-EST-05 Marketing» y
-- «MP-SOP-05 Cobranzas» venian marcados en amarillo —en elaboracion— y
-- Calidad indico ignorarlos. Los dos indicadores que hoy los nombran
-- quedan con el texto y sin vinculo, a proposito: cuando esos procesos
-- se aprueben, se agregan y el vinculo se completa con la misma
-- consulta de abajo.
-- ---------------------------------------------------------------------

alter table public.procesos
  add column if not exists version text not null default '00';

comment on column public.procesos.version is
  'Version del mapa de procesos. La 00 es la que la intranet tenia cargada; la 01 '
  'es la que Calidad aprobo el 5 de octubre de 2026 y a la que se esta migrando. '
  'Conviven: la 00 no se toca porque los veintiun documentos de la Lista Maestra '
  'cuelgan de ella.';

alter table public.procesos drop constraint if exists procesos_version_valida;
alter table public.procesos
  add constraint procesos_version_valida check (version in ('00', '01'));

create index if not exists procesos_version_idx
  on public.procesos (version) where activo;

-- ---------------------------------------------------------------------
-- Los veintiun procesos de la version 01
-- ---------------------------------------------------------------------

do $carga$
declare v_empresa uuid; f jsonb;
begin
  select id into v_empresa from public.empresas order by creado_en limit 1;

  for f in select * from jsonb_array_elements('[
    {"c":"MP-EST-01","n":"Planificación y Control del SGC","t":"estrategico"},
    {"c":"MP-EST-02","n":"Auditoría y Control de Procesos","t":"estrategico"},
    {"c":"MP-EST-03","n":"No Conformidades y Acciones Correctivas","t":"estrategico"},
    {"c":"MP-EST-04","n":"Experiencia y Fidelización de Clientes","t":"estrategico"},
    {"c":"MP-MIS-01","n":"Categorización y Control de Inventario","t":"operativo"},
    {"c":"MP-MIS-02","n":"Importaciones","t":"operativo"},
    {"c":"MP-MIS-03","n":"Recepción, Control y Almacenamiento de Inventario","t":"operativo"},
    {"c":"MP-MIS-04","n":"Gestión Regulatoria","t":"operativo"},
    {"c":"MP-MIS-05","n":"Ventas Multicanal","t":"operativo"},
    {"c":"MP-MIS-06","n":"Despacho y Entrega de Mercadería","t":"operativo"},
    {"c":"MP-MIS-07","n":"Servicio Técnico y Taller de Armería","t":"operativo"},
    {"c":"MP-MIS-08","n":"Operación del Stand de Tiro","t":"operativo"},
    {"c":"MP-MIS-09","n":"Gestión del Centro de Instrucción y del Carnet de Habilitación","t":"operativo"},
    {"c":"MP-SOP-01","n":"Información Documentada del SGC","t":"apoyo"},
    {"c":"MP-SOP-02","n":"Gestión del Capital Humano","t":"apoyo"},
    {"c":"MP-SOP-03","n":"Infraestructura y Tecnología","t":"apoyo"},
    {"c":"MP-SOP-04","n":"Análisis de Créditos","t":"apoyo"},
    {"c":"MP-SOP-06","n":"Procesamiento de Notas de Crédito","t":"apoyo"},
    {"c":"MP-SOP-07","n":"Seguridad Informática","t":"apoyo"},
    {"c":"MP-SOP-08","n":"Compras Locales y Evaluación de Terceros","t":"apoyo"},
    {"c":"MP-SOP-09","n":"Gestión de Caja y Tesorería","t":"apoyo"}
  ]'::jsonb) loop
    insert into public.procesos (empresa_id, codigo, nombre, tipo, version, activo)
    values (v_empresa, f->>'c', f->>'n', (f->>'t')::public.tipo_proceso, '01', true)
    on conflict do nothing;
  end loop;
end $carga$;

-- ---------------------------------------------------------------------
-- Vincular lo cargado desde la planilla al mapa 01
--
-- `proceso_declarado` guarda el texto de la planilla, que empieza con el
-- codigo: «MP-MIS-04 Gestion Regulatoria». De ahi sale el vinculo.
--
-- DOS PASES, porque la planilla no es uniforme: unas filas traen codigo
-- y nombre y otras solo el codigo.
--
-- Las cuatro oportunidades que nombran dos procesos —«MP-MIS-09 /
-- MP-MIS-05»— se vinculan al primero, que es el principal. El texto
-- completo con los dos queda en `proceso_declarado` y no se pierde.
-- ---------------------------------------------------------------------

update public.riesgos r set proceso_id = p.id
from public.procesos p
where p.version = '01' and p.activo
  and r.proceso_declarado like p.codigo || ' %'
  and r.proceso_id is null;

update public.riesgos r set proceso_accion_id = p.id
from public.procesos p
where p.version = '01' and p.activo
  and r.proceso_accion_declarado like p.codigo || ' %'
  and r.proceso_accion_id is null;

update public.riesgos r set proceso_accion_id = p.id
from public.procesos p
where p.version = '01' and p.activo
  and btrim(r.proceso_accion_declarado) = p.codigo
  and r.proceso_accion_id is null;

update public.indicadores i set proceso_id = p.id
from public.procesos p
where p.version = '01' and p.activo
  and i.proceso_declarado like p.codigo || ' %'
  and i.proceso_id is null;
