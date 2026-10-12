# -*- coding: utf-8 -*-
"""Levanta la base de demostracion: andamio + migraciones + seed.

Dos ajustes, y los dos son por correr contra PostgreSQL 16 en vez del 17
de Supabase, no por un problema del proyecto:

  1. `alter column ... set expression` es sintaxis del 17. Se traduce a
     soltar y volver a crear la columna generada. Local y nada mas: las
     migraciones del repositorio no se tocan.
  2. Dos migraciones insertan filas que cuelgan de `empresas`, que en
     produccion ya existia porque el seed corrio antes. Se insertan las
     dos empresas en cuanto la tabla existe.
"""
import os, re, subprocess, sys

RAIZ = "/home/user/INTRANET"
MIGRACIONES = os.path.join(RAIZ, "supabase", "migrations")
URL = "postgresql://postgres@localhost:5433/intranet"
AQUI = os.path.dirname(os.path.abspath(__file__))
SEED = os.path.join(AQUI, "seed-al-dia.sql")

EMPRESAS = """
insert into public.empresas (id, nombre, razon_social, ruc, activa) values
  ('11111111-1111-4111-8111-111111111111', 'Camping 44', 'Camping 44 S.A.', '80012345-6', true),
  ('22222222-2222-4222-8222-222222222222', 'Vitálica', 'Vitálica E.A.S.', '80098765-4', false)
on conflict (id) do nothing;
"""

PATRON = re.compile(
    r"alter\s+table\s+(?P<tabla>[\w.]+)\s+"
    r"alter\s+column\s+(?P<col>\w+)\s+"
    r"set\s+expression\s+as\s*\((?P<expr>.*?)\)\s*;",
    re.IGNORECASE | re.DOTALL,
)


def traducir(sql):
    """`set expression` del 17 -> soltar y recrear la columna generada."""
    def cambio(m):
        return (
            "alter table {t} drop column if exists {c};\n"
            "alter table {t} add column {c} boolean\n"
            "  generated always as ({e}) stored;"
        ).format(t=m.group("tabla"), c=m.group("col"), e=m.group("expr").strip())
    return PATRON.sub(cambio, sql)


def psql(sql, etiqueta):
    ruta = os.path.join(AQUI, "paso.sql")
    with open(ruta, "w", encoding="utf-8") as f:
        f.write(sql)
    r = subprocess.run(
        ["psql", URL, "-v", "ON_ERROR_STOP=1", "-q", "-f", ruta],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        errores = [l for l in r.stderr.splitlines() if "ERROR" in l or "DETAIL" in l]
        print("  FALLO %s" % etiqueta)
        for l in errores[:4]:
            print("    " + l.strip())
        return False
    return True


CAMPING44 = "11111111-1111-4111-8111-111111111111"

# El seed se escribio contra un esquema anterior: migraciones posteriores
# agregaron columnas de empresa obligatorias que el seed no conoce (en
# produccion las relleno el backfill de cada migracion). Se les pone un
# valor por omision mientras carga y se les saca despues, para que la
# columna siga siendo obligatoria y sin default, igual que en produccion.
SQL_COLUMNAS = """
select c.table_name, c.column_name
from information_schema.columns c
join information_schema.tables t
  on t.table_schema = c.table_schema and t.table_name = c.table_name
 and t.table_type = 'BASE TABLE'
where c.table_schema = 'public' and c.is_nullable = 'NO'
  and c.column_default is null and c.column_name like '%empresa%'
"""


def columnas_de_empresa():
    r = subprocess.run(["psql", URL, "-tAF", "|", "-c", SQL_COLUMNAS],
                       capture_output=True, text=True)
    return [l.split("|") for l in r.stdout.strip().splitlines() if "|" in l]


def defecto(columnas, poner):
    partes = []
    for tabla, col in columnas:
        if poner:
            partes.append("alter table public.%s alter column %s set default '%s'::uuid;"
                          % (tabla, col, CAMPING44))
        else:
            partes.append("alter table public.%s alter column %s drop default;" % (tabla, col))
    return psql("\n".join(partes), "defaults de empresa")


def main():
    archivos = sorted(f for f in os.listdir(MIGRACIONES) if f.endswith(".sql"))
    print("migraciones: %d" % len(archivos))
    empresas_puestas = False
    fallos = []

    for nombre in archivos:
        with open(os.path.join(MIGRACIONES, nombre), encoding="utf-8") as f:
            sql = f.read()

        traducido = traducir(sql)
        if traducido != sql:
            print("  (traducido set expression) %s" % nombre)
            sql = traducido

        if not psql(sql, nombre):
            fallos.append(nombre)

        # En cuanto `empresas` existe, se cargan las dos filas.
        if not empresas_puestas:
            r = subprocess.run(["psql", URL, "-tAc", "select to_regclass('public.empresas')"],
                               capture_output=True, text=True)
            if r.stdout.strip() == "empresas":
                if psql(EMPRESAS, "empresas"):
                    print("  empresas cargadas tras %s" % nombre)
                    empresas_puestas = True

    print("\nmigraciones con fallo: %d" % len(fallos))
    for f in fallos:
        print("  - " + f)

    print("\n--- seed de demostracion ---")
    columnas = columnas_de_empresa()
    print("columnas de empresa con valor por omision temporal: %d" % len(columnas))
    defecto(columnas, True)
    with open(SEED, encoding="utf-8") as f:
        ok = psql(f.read(), "seed.sql")
    defecto(columnas, False)
    print("seed:", "OK" if ok else "FALLO")
    return 0 if not fallos and ok else 1


sys.exit(main())
