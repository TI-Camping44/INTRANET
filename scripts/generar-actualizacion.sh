#!/usr/bin/env bash
# =====================================================================
# Intranet SGC - Camping 44 S.A.
# Genera supabase/actualizacion.sql
# =====================================================================
# El instalador completo sirve para una base vacia. Una base que YA esta
# en produccion no se puede reinstalar: `create type` y `create table`
# fallan al segundo intento y la carga se corta a la mitad.
#
# Este archivo junta lo que vino despues de la primera instalacion: las
# migraciones del 25 de agosto y los datos reales. Se puede aplicar sobre
# una base que tenga solo la instalacion original, y tambien sobre una
# que ya este al dia: todo lo que incluye es idempotente.
#
# Uso:
#   bash scripts/generar-actualizacion.sh
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SALIDA="$RAIZ/supabase/actualizacion.sql"

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
  echo "-- ACTUALIZACION sobre una base ya instalada"
  echo "-- ====================================================================="
  echo "--"
  echo "-- Generado por scripts/generar-actualizacion.sh. No editar a mano."
  echo "--"
  echo "-- Aplicar en el editor SQL de Supabase, de una sola vez, sobre una"
  echo "-- base que ya tenga la instalacion original."
  echo "--"
  echo "-- Es idempotente: si se corre dos veces, la segunda no rompe nada"
  echo "-- ni duplica registros."
  echo "--"
  echo "-- Incluye:"
  echo "--   · Las migraciones posteriores a la instalacion original"
  echo "--   · Los datos reales del SGC (mapa de procesos, perfiles de"
  echo "--     puesto, juego documental) y el retiro de lo inventado"
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

  for f in "$RAIZ"/supabase/datos-reales/*.sql; do
    [ -e "$f" ] || continue
    echo ""
    echo "-- ====================================================================="
    echo "-- DATOS REALES: $(basename "$f")"
    echo "-- ====================================================================="
    cat "$f"
    echo ""
  done
} > "$SALIDA"

echo "Generado: supabase/actualizacion.sql ($(wc -l < "$SALIDA") lineas)"
