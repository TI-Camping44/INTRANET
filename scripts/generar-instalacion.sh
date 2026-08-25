#!/usr/bin/env bash
# Genera supabase/instalacion-completa.sql: todas las migraciones en
# orden alfabetico, mas el seed de demostracion, en un solo archivo.
#
# Sirve para montar una instancia de Supabase de una sola pegada en el
# editor SQL del panel, sin instalar la CLI ni tener acceso directo a la
# base de datos.
#
# Se ejecuta desde la raiz del repositorio:
#     bash scripts/generar-instalacion.sh
#
# Vuelva a ejecutarlo cada vez que agregue una migracion.
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
SALIDA="$RAIZ/supabase/instalacion-completa.sql"

{
  cat <<'ENC'
-- =====================================================================
-- Intranet SGC · Camping 44 S.A.
-- INSTALACION COMPLETA EN UN SOLO ARCHIVO
-- =====================================================================
-- Este archivo se genera con scripts/generar-instalacion.sh y reune, en
-- orden, todas las migraciones de supabase/migrations/ mas el seed de
-- datos de demostracion.
--
-- Para que sirve: montar una instancia nueva de Supabase de una sola
-- pegada en el editor SQL, sin instalar la CLI ni tener acceso directo a
-- la base. Es lo que se usa para la demostracion.
--
-- COMO SE USA
--   1. Panel de Supabase → SQL Editor → New query.
--   2. Pegue TODO este archivo y ejecute (Run).
--   3. Deberia terminar con el aviso "Datos de demostracion cargados".
--
-- ADVERTENCIA
--   Carga datos de demostracion, marcados con es_demostracion = true.
--   Para borrarlos mas adelante, vea la seccion correspondiente del
--   README. Para una instancia de produccion sin datos de ejemplo,
--   corte este archivo antes del bloque "SEED".
--
-- El archivo NO se edita a mano: se regenera.
-- =====================================================================

ENC

  for f in "$RAIZ"/supabase/migrations/*.sql; do
    echo ""
    echo "-- ====================================================================="
    echo "-- MIGRACION: $(basename "$f")"
    echo "-- ====================================================================="
    cat "$f"
    echo ""
  done

  echo ""
  echo "-- ====================================================================="
  echo "-- SEED · datos de demostracion"
  echo "-- ====================================================================="
  cat "$RAIZ/supabase/seed.sql"

  # Los datos reales van al final: necesitan que exista la empresa, que la
  # crea el seed.
  for f in "$RAIZ"/supabase/datos-reales/*.sql; do
    [ -e "$f" ] || continue
    echo ""
    echo "-- ====================================================================="
    echo "-- DATOS REALES: $(basename "$f")"
    echo "-- ====================================================================="
    cat "$f"
  done
} > "$SALIDA"

echo "Generado: supabase/instalacion-completa.sql ($(wc -l < "$SALIDA") lineas)"
