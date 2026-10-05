# -*- coding: utf-8 -*-
"""Carga de las cuatro hojas del F-EST-01/07, con los datos en JSON."""
import openpyxl, datetime, json, re, pathlib

wb = openpyxl.load_workbook("matriz.xlsx", data_only=True)

def txt(v):
    if v is None: return None
    if isinstance(v, datetime.datetime): return v.date().isoformat()
    if isinstance(v, datetime.date): return v.isoformat()
    if isinstance(v, float) and v == int(v): return str(int(v))
    return str(v).strip() or None

def num(v):
    s = txt(v)
    if s is None: return None
    try: return float(s) if float(s) != int(float(s)) else int(float(s))
    except ValueError: return None

def fecha(v):
    s = txt(v)
    if s and re.match(r"^\d{4}-\d{2}-\d{2}$", s): return s, False
    return None, s is not None   # «Permanente» o cualquier otro texto

def boo(v):
    s = (txt(v) or "").lower()
    return True if s.startswith("s") else (False if s.startswith("n") else None)

ORIGEN_R = {"Contexto (4.1)": "Contexto de la Organización",
            "Partes interesadas (4.2)": "Partes Interesadas",
            "Análisis de proceso": "Análisis de proceso"}
ORIGEN_O = {"Contexto (4.1)": "Contexto de la Organización",
            "Partes interesadas (4.2)": "Partes Interesadas",
            "Condiciones del mercado": "Condiciones del mercado",
            "Tecnología emergente": "Tecnología emergente",
            "Requisito reglamentario": "Requisito reglamentario",
            "Nueva asociación": "Nueva Alianza/Asociación",
            "Sugerencia del personal": "Sugerencia de un Colaborador"}
TRAT = {"Evitar el riesgo": "evitar",
        "Asumir el riesgo por una oportunidad": "asumir",
        "Eliminar la fuente del riesgo": "eliminar_fuente",
        "Cambiar la probabilidad": "cambiar_probabilidad",
        "Cambiar la consecuencia": "cambiar_consecuencia",
        "Compartir el riesgo": "compartir",
        "Mantener el riesgo por información documentada": "aceptar"}
EST = {"Pendiente": "identificado", "En curso": "en_tratamiento"}
ALIN = {"Alta": "alta", "Media": "media", "Baja": "baja"}
NIV = {"Estratégico": "estrategico", "Táctico": "tactico", "Operativo": "operativo"}
SENT = {"Mayor es mejor": "mayor_mejor", "Menor es mejor": "menor_mejor"}
CONS = {"Suma": "suma", "Promedio": "promedio", "Último valor": "ultimo"}
FREQ = {"Mensual": "mensual", "Trimestral": "trimestral",
        "Semestral": "semestral", "Anual": "anual"}
EST_PLAN = {"Pendiente": "pendiente", "En curso": "en_curso"}

def filas(hoja, primera=8):
    ws = wb[hoja]
    for f in ws.iter_rows(min_row=primera, max_row=ws.max_row):
        if any(c.value is not None for c in f[1:]):
            yield {c.column_letter: c.value for c in f}

def recorte(s, n=120):
    """La misma regla que `tituloDesdeLaDescripcion` de la aplicacion:
    la primera oracion de la descripcion, recortada."""
    limpia = re.sub(r"\s+", " ", (s or "").strip())
    corte = next((i for i, ch in enumerate(limpia) if ch in ".;\n"), -1)
    primera = limpia[:corte] if corte > 10 else limpia
    return primera if len(primera) <= n else primera[: n - 3] + "…"

def volcar(datos):
    """JSON compacto, escapado para una cadena SQL."""
    j = json.dumps(datos, ensure_ascii=False, separators=(",", ":"))
    return "'" + j.replace("'", "''") + "'"

# ------------------------------------------------------------- riesgos
riesgos = []
for c in filas("6.1.2 Riesgos"):
    plazo, perm = fecha(c.get("Q"))
    riesgos.append({
        "descripcion": txt(c.get("E")), "fecha": txt(c.get("B")),
        "proceso": txt(c.get("C")), "origen": ORIGEN_R.get(txt(c.get("D"))),
        "causas": txt(c.get("F")), "consecuencias": txt(c.get("G")),
        "disrupcion": boo(c.get("H")), "probabilidad": num(c.get("I")),
        "severidad": num(c.get("J")), "tratamiento": TRAT.get(txt(c.get("N"))),
        "accion": txt(c.get("O")), "responsable": txt(c.get("P")),
        "plazo": plazo, "permanente": perm, "proceso_accion": txt(c.get("R")),
        "prob_residual": num(c.get("S")), "sev_residual": num(c.get("T")),
        "fecha_medicion": txt(c.get("V")),
        "estado": EST.get(txt(c.get("X")), "identificado"),
    })
for r in riesgos: r["titulo"] = recorte(r["descripcion"])

# -------------------------------------------------------- oportunidades
oportunidades = []
for c in filas("6.1.3 Oportunidades"):
    plazo, perm = fecha(c.get("P"))
    decision = txt(c.get("L"))
    oportunidades.append({
        "descripcion": txt(c.get("E")), "fecha": txt(c.get("B")),
        "proceso": txt(c.get("C")), "origen": ORIGEN_O.get(txt(c.get("D"))),
        "efecto": txt(c.get("F")), "beneficio": num(c.get("G")),
        "factibilidad": num(c.get("H")), "alineacion": ALIN.get(txt(c.get("K"))),
        "abordar": True if decision == "Sí" else (False if decision == "No" else None),
        "decision": decision, "accion": txt(c.get("M")),
        "recursos": txt(c.get("N")), "responsable": txt(c.get("O")),
        "plazo": plazo, "permanente": perm, "proceso_accion": txt(c.get("Q")),
        "resultado": txt(c.get("R")), "fecha_medicion": txt(c.get("S")),
        "estado": EST.get(txt(c.get("U")), "identificado"),
    })
for o in oportunidades: o["titulo"] = recorte(o["descripcion"])

# ---------------------------------------------- objetivos e indicadores
objetivos, vistos = [], set()
for c in filas("6.2 Objetivos e Indicadores"):
    m = re.match(r"^(O\d+)\s+(.*)$", txt(c.get("B")) or "")
    if m and m.group(1) not in vistos:
        vistos.add(m.group(1))
        objetivos.append({"clave": m.group(1), "nombre": m.group(2),
                          "nivel": NIV.get(txt(c.get("C"))),
                          "proceso": txt(c.get("D"))})
for i, o in enumerate(objetivos, start=1):
    o["codigo"] = "OBJ-2027-%02d" % i
CODIGO = {o["clave"]: o["codigo"] for o in objetivos}

indicadores = []
for i, c in enumerate(filas("6.2 Objetivos e Indicadores"), start=1):
    b = txt(c.get("B")) or ""
    m = re.match(r"^(O\d+)\s", b)
    indicadores.append({
        "codigo": "IND-%03d" % i, "nombre": txt(c.get("E")), "objetivo": b,
        "codigo_objetivo": CODIGO.get(m.group(1)) if m else None,
        "nivel": NIV.get(txt(c.get("C"))), "proceso": txt(c.get("D")),
        "formula": txt(c.get("F")), "unidad": txt(c.get("G")),
        "linea_base": num(c.get("H")), "meta": num(c.get("I")),
        "sentido": SENT.get(txt(c.get("J"))),
        "consolidacion": CONS.get(txt(c.get("K"))),
        "frecuencia": FREQ.get(txt(c.get("L"))), "fuente": txt(c.get("M")),
        "responsable": txt(c.get("N")), "observaciones": txt(c.get("AD")),
    })

planes = []
for c in filas("6.2.2 Plan Objetivos"):
    clave = txt(c.get("B"))
    planes.append({
        "objetivo": clave, "codigo_objetivo": CODIGO.get(clave),
        "que": txt(c.get("C")), "recursos": txt(c.get("D")),
        "responsable": txt(c.get("E")), "fecha_fin": txt(c.get("F")),
        "como": txt(c.get("G")), "fecha_real": txt(c.get("H")),
        "resultado": txt(c.get("I")), "avance": num(c.get("J")) or 0,
        "estado": EST_PLAN.get(txt(c.get("K")), "pendiente"),
        "observaciones": txt(c.get("L")),
    })

cambios = list(filas("6.3 Gestión del Cambio"))

ENCABEZADO = """-- ---------------------------------------------------------------------
-- Carga de las cuatro hojas del libro F-EST-01/07 de Calidad
--
-- Generado desde la planilla del 2 de octubre de 2026, fila por fila y
-- tal como esta cargada. Las hojas 4.1 Contexto y 4.2 Partes
-- Interesadas quedan afuera, como se indico.
--
-- LOS DATOS VAN EN JSON y se recorren con un bucle, en vez de doscientas
-- lineas de `insert` repetidas. No es por brevedad: asi la lista de
-- columnas se escribe una sola vez, y el dia que Calidad agregue una
-- fila a la planilla se agrega un objeto y nada mas.
--
-- CUATRO COSAS QUE LA PLANILLA DICE Y LA BASE NO PODIA REPRESENTAR TAL
-- CUAL, y como se resolvio cada una:
--
--   · EL PROCESO. La planilla usa otro mapa de procesos que la intranet
--     —veintitres contra diecinueve, y los mismos codigos significan
--     cosas distintas: MP-EST-01 es «Informacion Documentada» en la
--     intranet y «Planificacion y Control del SGC» en la planilla— y
--     varias filas nombran dos procesos a la vez
--     («MP-MIS-01 / MP-MIS-03»), que una clave ajena no puede
--     representar. Va en `proceso_declarado`, en texto y sin
--     interpretar; `proceso_id` queda vacio hasta que Calidad confirme
--     el mapa definitivo. Asi los datos entran completos hoy y no se
--     toca ni la Lista Maestra ni los veintiun documentos ya cargados.
--
--   · EL RESPONSABLE. La planilla nombra cargos, no personas:
--     «Asistente de Gestion Regulatoria», «Jefe de Operaciones y
--     Logistica». En la intranet hay dos usuarios, porque el perfil se
--     crea en el primer ingreso. Va en `responsable_declarado` y se
--     vincula cuando esas personas entren.
--
--   · EL PLAZO «PERMANENTE». Varias acciones son controles que no
--     terminan y la columna de plazo dice esa palabra en vez de una
--     fecha. Va como bandera y el plazo queda vacio.
--
--   · «DIFERIDA» en la decision de abordar una oportunidad. La columna
--     admite Si, No y Diferida, y la base tenia un booleano: una
--     oportunidad diferida no es una que se decidio no abordar, es una
--     que espera la Revision por la Direccion. Queda la palabra exacta
--     en `decision_declarada`.
--
-- EL N.º DE LA PLANILLA NO SE CARGA: el codigo lo genera la base,
-- correlativo y por empresa, como pidio Calidad.
--
-- Es idempotente: cada bloque borra lo que cargo antes y vuelve a
-- cargarlo. Y es atomico: si una fila falla, no entra ninguna.
-- ---------------------------------------------------------------------
"""

CABEZA = """do $carga$
declare
  v_empresa uuid;
  v_autor uuid;
  v_codigo text;
  f jsonb;
begin
  select id into v_empresa from public.empresas order by creado_en limit 1;
  select id into v_autor from public.usuarios
   where correo ilike 'carlos%' order by creado_en limit 1;
  if v_autor is null then
    select id into v_autor from public.usuarios order by creado_en limit 1;
  end if;
"""

B_RIESGOS = CABEZA + """
  -- Hoja 6.1.2 · Matriz de Riesgos (F-EST-01-03)
  delete from public.riesgos where tipo = 'riesgo' and proceso_declarado is not null;

  for f in select * from jsonb_array_elements(""" + volcar(riesgos) + """::jsonb) loop
    select public.siguiente_codigo_riesgo(v_empresa) into v_codigo;
    insert into public.riesgos (
      empresa_id, codigo, titulo, descripcion, tipo, estado,
      fecha_identificacion, fecha_ultima_evaluacion, proceso_declarado,
      origen, causas, consecuencias, asociado_disrupcion, probabilidad,
      severidad, tratamiento, accion_planificada, responsable_declarado,
      plazo_accion, plazo_accion_permanente, proceso_accion_declarado,
      probabilidad_residual, severidad_residual, fecha_evaluacion_eficacia,
      eficacia_accion, es_demostracion, creado_por
    ) values (
      v_empresa, v_codigo, f->>'titulo', f->>'descripcion', 'riesgo',
      (f->>'estado')::public.estado_riesgo,
      coalesce((f->>'fecha')::date, current_date),
      coalesce((f->>'fecha')::date, current_date), f->>'proceso',
      f->>'origen', f->>'causas', f->>'consecuencias',
      (f->>'disrupcion')::boolean, (f->>'probabilidad')::smallint,
      (f->>'severidad')::smallint,
      (f->>'tratamiento')::public.tratamiento_riesgo, f->>'accion',
      f->>'responsable', (f->>'plazo')::date,
      coalesce((f->>'permanente')::boolean, false), f->>'proceso_accion',
      (f->>'prob_residual')::smallint, (f->>'sev_residual')::smallint,
      (f->>'fecha_medicion')::date, 'pendiente', false, v_autor
    );
  end loop;

  raise notice 'Riesgos cargados: %', (select count(*) from public.riesgos where tipo = 'riesgo');
end $carga$;
"""

B_OPORTUNIDADES = CABEZA + """
  -- Hoja 6.1.3 · Matriz de Oportunidades (F-EST-01-04)
  delete from public.riesgos where tipo = 'oportunidad';

  for f in select * from jsonb_array_elements(""" + volcar(oportunidades) + """::jsonb) loop
    select public.siguiente_codigo_riesgo(v_empresa) into v_codigo;
    insert into public.riesgos (
      empresa_id, codigo, titulo, descripcion, tipo, estado,
      fecha_identificacion, fecha_ultima_evaluacion, proceso_declarado,
      origen, efecto_deseado, beneficio, factibilidad,
      alineacion_estrategica, se_decide_abordar, decision_declarada,
      accion_planificada, recursos_necesarios, responsable_declarado,
      plazo_accion, plazo_accion_permanente, proceso_accion_declarado,
      resultado_obtenido, fecha_evaluacion_eficacia, eficacia_accion,
      es_demostracion, creado_por
    ) values (
      v_empresa, v_codigo, f->>'titulo', f->>'descripcion', 'oportunidad',
      (f->>'estado')::public.estado_riesgo,
      coalesce((f->>'fecha')::date, current_date),
      coalesce((f->>'fecha')::date, current_date), f->>'proceso',
      f->>'origen', f->>'efecto', (f->>'beneficio')::smallint,
      (f->>'factibilidad')::smallint, f->>'alineacion',
      (f->>'abordar')::boolean, f->>'decision', f->>'accion',
      f->>'recursos', f->>'responsable', (f->>'plazo')::date,
      coalesce((f->>'permanente')::boolean, false), f->>'proceso_accion',
      f->>'resultado', (f->>'fecha_medicion')::date, 'pendiente',
      false, v_autor
    );
  end loop;

  raise notice 'Oportunidades cargadas: %', (select count(*) from public.riesgos where tipo = 'oportunidad');
end $carga$;
"""

B_OBJETIVOS = CABEZA + """
  -- Hoja 6.2 · Objetivos de la Calidad e Indicadores (F-EST-01-05)
  --
  -- SE BORRA LO QUE HABIA. Los treinta objetivos del PE 2026 que
  -- estaban cargados se retiran: lo decidio Direccion al pasar esta
  -- planilla, que es la que vale.
  --
  -- Los ocho objetivos salen de la columna B: las filas que empiezan
  -- con «O1» a «O8» los declaran. Las que dicen «Desempeno del proceso»
  -- son indicadores de proceso y no cuelgan de ningun objetivo de
  -- calidad: su `objetivo_id` queda vacio a proposito.
  delete from public.indicadores;
  delete from public.objetivos;

  for f in select * from jsonb_array_elements(""" + volcar(objetivos) + """::jsonb) loop
    insert into public.objetivos (
      empresa_id, codigo, nombre, descripcion, anio, nivel, estado, es_demostracion
    ) values (
      v_empresa, f->>'codigo', f->>'nombre',
      'Objetivo de la calidad ' || (f->>'clave') || ' · ' || coalesce(f->>'proceso', ''),
      2027, f->>'nivel', 'en_curso', false
    );
  end loop;

  for f in select * from jsonb_array_elements(""" + volcar(indicadores) + """::jsonb) loop
    insert into public.indicadores (
      empresa_id, codigo, nombre, descripcion, objetivo_id, nivel,
      proceso_declarado, formula, unidad, linea_base, meta, sentido,
      consolidacion, frecuencia, fuente_dato, responsable_declarado,
      observaciones, activo, es_demostracion
    ) values (
      v_empresa, f->>'codigo', f->>'nombre', f->>'objetivo',
      (select id from public.objetivos
        where empresa_id = v_empresa and codigo = f->>'codigo_objetivo'),
      f->>'nivel', f->>'proceso', f->>'formula', f->>'unidad',
      (f->>'linea_base')::numeric, (f->>'meta')::numeric, f->>'sentido',
      f->>'consolidacion', f->>'frecuencia', f->>'fuente',
      f->>'responsable', f->>'observaciones', true, false
    );
  end loop;

  raise notice 'Objetivos: % · indicadores: %',
    (select count(*) from public.objetivos), (select count(*) from public.indicadores);
end $carga$;
"""

B_PLANES = CABEZA + """
  -- Hoja 6.2.2 · Plan de Accion para el Logro de los Objetivos
  -- (F-EST-01-06) · los cinco incisos del apartado 6.2.2 de la norma.
  --
  -- La ultima fila dice «Todos» en la columna del objetivo: aplica a
  -- los ocho a la vez, asi que su `objetivo_id` queda vacio y la
  -- palabra se conserva en `objetivo_declarado`.
  delete from public.objetivo_planes;

  for f in select * from jsonb_array_elements(""" + volcar(planes) + """::jsonb) loop
    insert into public.objetivo_planes (
      empresa_id, objetivo_id, objetivo_declarado, que_se_va_a_hacer,
      recursos_necesarios, responsable_declarado, fecha_finalizacion,
      como_se_evaluan_resultados, fecha_real_finalizacion,
      resultado_evaluacion, avance_porcentaje, estado, observaciones,
      es_demostracion, creado_por
    ) values (
      v_empresa,
      (select id from public.objetivos
        where empresa_id = v_empresa and codigo = f->>'codigo_objetivo'),
      f->>'objetivo', f->>'que', f->>'recursos', f->>'responsable',
      (f->>'fecha_fin')::date, f->>'como', (f->>'fecha_real')::date,
      f->>'resultado', coalesce((f->>'avance')::numeric, 0),
      f->>'estado', f->>'observaciones', false, v_autor
    );
  end loop;

  raise notice 'Planes de objetivo cargados: %', (select count(*) from public.objetivo_planes);
end $carga$;
"""

B_CAMBIOS = """-- Hoja 6.3 · Registro de Gestion del Cambio (F-EST-01-07)
--
-- LA HOJA NO TIENE NINGUNA FILA CARGADA: solo el encabezado y los N.º
-- del 1 al 30 precargados. No hay nada que traer. Las columnas del
-- formulario si quedaron en la tabla `cambios`, asi que el modulo las
-- pide completas desde el primer registro que se cargue.
"""

for nombre, contenido in [("1-riesgos", B_RIESGOS), ("2-oportunidades", B_OPORTUNIDADES),
                          ("3-objetivos", B_OBJETIVOS), ("4-planes", B_PLANES),
                          ("5-cambios", B_CAMBIOS)]:
    p = pathlib.Path(f"j-{nombre}.sql")
    p.write_text(contenido)
    print(f"{p.name}  {p.stat().st_size} bytes")

pathlib.Path("carga-completa.sql").write_text(
    ENCABEZADO + "\n" + B_RIESGOS + "\n" + B_OPORTUNIDADES + "\n"
    + B_OBJETIVOS + "\n" + B_PLANES + "\n" + B_CAMBIOS)
print("total:", pathlib.Path("carga-completa.sql").stat().st_size, "bytes")
print(f"riesgos={len(riesgos)} oport={len(oportunidades)} obj={len(objetivos)} "
      f"ind={len(indicadores)} planes={len(planes)} cambios={len(cambios)}")
