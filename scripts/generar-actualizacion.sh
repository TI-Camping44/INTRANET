#!/usr/bin/env bash
# =====================================================================
# Intranet SGC - Camping 44 S.A.
# Genera supabase/actualizacion.sql
# =====================================================================
# El instalador completo sirve para una base vacia. Una base que YA esta
# en produccion no se puede reinstalar: `create type` y `create table`
# fallan al segundo intento y la carga se corta a la mitad.
#
# Genera DOS archivos, y son dos por una razon de PostgreSQL, no por
# prolijidad: `alter type ... add value` agrega un valor al enumerado
# pero ese valor no se puede USAR hasta que la transaccion termine. El
# editor SQL de Supabase corre todo lo que se le pega en una sola
# transaccion, asi que agregar el valor "plan" a tipo_documento y cargar
# en la misma pasada un documento de tipo "plan" falla con
# "unsafe use of new value".
#
#   1-esquema  las migraciones
#   2-datos    los datos reales del SGC
#
# Se aplican en ese orden, uno y despues el otro. Los dos son
# idempotentes: correrlos de nuevo no rompe nada ni duplica registros.
#
# Uso:
#   bash scripts/generar-actualizacion.sh
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ESQUEMA="$RAIZ/supabase/actualizacion-1-esquema.sql"
DATOS="$RAIZ/supabase/actualizacion-2-datos.sql"

# Ultima migracion de la instalacion original. Todo lo posterior entra en
# la actualizacion.
#
# El corte va en la instalacion original y no mas adelante a proposito.
# Se intento afinarlo al estado real de produccion y salio mal: esa base
# tenia unas migraciones del 25 aplicadas y otras no, en un estado
# intermedio que desde afuera no se puede adivinar.
#
# La solucion no es adivinar mejor. Todas las migraciones del 25 son
# idempotentes, asi que se incluyen todas y cada una se saltea sola si ya
# esta aplicada. El archivo funciona desde cualquier estado.
CORTE="20260824999999"

{
  echo "-- ====================================================================="
  echo "-- Intranet SGC - Camping 44 S.A."
  echo "-- ACTUALIZACION · 1 de 2 · ESQUEMA"
  echo "-- ====================================================================="
  echo "--"
  echo "-- Generado por scripts/generar-actualizacion.sh. No editar a mano."
  echo "--"
  echo "-- Pegar entero en el editor SQL de Supabase y correr. Despues, y solo"
  echo "-- despues, correr actualizacion-2-datos.sql."
  echo "--"
  echo "-- Van separados porque un valor nuevo de un tipo enumerado no se puede"
  echo "-- usar en la misma transaccion en que se agrega."
  echo "--"
  echo "-- Es idempotente: cada migracion se saltea sola si ya esta aplicada."
  echo "-- ====================================================================="
  echo ""

  for f in "$RAIZ"/supabase/migrations/*.sql; do
    nombre="$(basename "$f")"
    marca="${nombre%%_*}"
    [ "$marca" \> "$CORTE" ] || continue
    echo ""
    echo "-- ====================================================================="
    echo "-- MIGRACION: $nombre"
    echo "-- ====================================================================="
    cat "$f"
    echo ""
  done
} > "$ESQUEMA"

{
  echo "-- ====================================================================="
  echo "-- Intranet SGC - Camping 44 S.A."
  echo "-- ACTUALIZACION · 2 de 2 · DATOS REALES"
  echo "-- ====================================================================="
  echo "--"
  echo "-- Generado por scripts/generar-actualizacion.sh. No editar a mano."
  echo "--"
  echo "-- Correr DESPUES de actualizacion-1-esquema.sql: necesita las columnas"
  echo "-- y los tipos que agrega aquel."
  echo "--"
  echo "-- Trae el mapa de procesos real de Camping 44, los perfiles de puesto"
  echo "-- del formulario R-02-01, el juego documental de la unidad compartida"
  echo "-- del SGC, y retira los procesos que habia inventado el seed."
  echo "--"
  echo "-- Es idempotente: correrlo de nuevo no duplica nada."
  echo "-- ====================================================================="
  echo ""

  for f in "$RAIZ"/supabase/datos-reales/*.sql; do
    [ -e "$f" ] || continue
    echo ""
    echo "-- ====================================================================="
    echo "-- DATOS REALES: $(basename "$f")"
    echo "-- ====================================================================="
    cat "$f"
    echo ""
  done
} > "$DATOS"

echo "Generado: supabase/actualizacion-1-esquema.sql ($(wc -l < "$ESQUEMA") lineas)"
echo "Generado: supabase/actualizacion-2-datos.sql   ($(wc -l < "$DATOS") lineas)"
