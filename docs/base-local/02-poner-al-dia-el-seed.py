# -*- coding: utf-8 -*-
"""Pone al dia una copia del seed contra el esquema de hoy.

El seed del repositorio quedo escrito contra un esquema anterior: el
modulo de riesgos renombro columnas, la oportunidad cambio de valoracion
y los estados del objetivo son otros. Esto NO toca `supabase/seed.sql`:
escribe una copia para la base de demostracion local.
"""
import re

ORIG = "/home/user/INTRANET/supabase/seed.sql"
SP = os.environ.get("BASE_LOCAL", os.path.dirname(os.path.abspath(__file__)))
DEST = SP + "/demo/seed-al-dia.sql"

lineas = open(ORIG, encoding="utf-8").read().splitlines(keepends=True)
notas = []

# 1 · El bloque de objetivos: 'en_curso' salio de los estados; hoy es
#     'en_medicion'. Se cambia SOLO dentro de ese insert, porque el mismo
#     texto es un estado valido para acciones y mantenimientos.
inicio = next(i for i, l in enumerate(lineas) if l.startswith("insert into public.objetivos"))
fin = next(i for i in range(inicio, len(lineas)) if lineas[i].rstrip().endswith(";"))
tocadas = 0
for i in range(inicio, fin + 1):
    if "'en_curso'" in lineas[i]:
        lineas[i] = lineas[i].replace("'en_curso'", "'en_medicion'")
        tocadas += 1
notas.append("objetivos: 'en_curso' -> 'en_medicion' (%d)" % tocadas)

s = "".join(lineas)

# 2 · impacto -> severidad en el modulo de riesgos.
for viejo, nuevo in [
    ("  probabilidad, impacto, fecha_identificacion", "  probabilidad, severidad, fecha_identificacion"),
    ("impacto_residual", "severidad_residual"),
    ("probabilidad, impacto, comentario", "probabilidad, severidad, comentario"),
]:
    n = s.count(viejo)
    if n:
        s = s.replace(viejo, nuevo)
        notas.append("%s -> %s (%d)" % (viejo.strip(), nuevo.strip(), n))

# 3 · Hoy hay disparadores que crean la version y los revisores al
#     aprobar, asi que las filas del seed chocan.
for tabla in ("documento_versiones", "documento_revisores"):
    pat = re.compile(r"(insert into public\.%s[^;]*?)(\n?);" % tabla, re.DOTALL)
    s, n = pat.subn(lambda m: m.group(1) + "\non conflict do nothing;", s)
    if n:
        notas.append("%s: on conflict do nothing (%d)" % (tabla, n))

# 4 · La oportunidad ya no se valora con probabilidad por severidad sino
#     con beneficio por factibilidad, y un CHECK lo exige.
cabeza = """-- Copia del seed puesta al dia para la base de demostracion local.
-- Generada por parchear-seed.py. No es el seed del repositorio.
alter table public.riesgos drop constraint if exists riesgos_valoracion_segun_tipo;

"""
cola = """

update public.riesgos
   set beneficio = probabilidad, factibilidad = severidad,
       probabilidad = null, severidad = null
 where tipo = 'oportunidad' and probabilidad is not null;

alter table public.riesgos add constraint riesgos_valoracion_segun_tipo check (
  case tipo
    when 'riesgo'::tipo_riesgo then (beneficio is null and factibilidad is null)
    when 'oportunidad'::tipo_riesgo then (probabilidad is null and severidad is null)
    else true
  end
);
"""
notas.append("oportunidad: probabilidad/severidad -> beneficio/factibilidad")

open(DEST, "w", encoding="utf-8").write(cabeza + s + cola)
print("escrito:", DEST)
for n in notas:
    print("  -", n)
