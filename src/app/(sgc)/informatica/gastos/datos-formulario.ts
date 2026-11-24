import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { EmpresaDelGrupo } from "@/lib/empresas";
import type { ActivoOpcion } from "@/app/(sgc)/informatica/gastos/formulario-gasto";

/**
 * Lo que necesitan el alta y la edición de un gasto: las dos empresas,
 * las licencias y activos tecnológicos, y los proveedores ya usados.
 * Va aparte para que las dos pantallas pidan exactamente lo mismo.
 */
export async function datosDelFormularioDeGasto() {
  const supabase = crearClienteServidor();
  const [{ data: empresas }, { data: activos }, { data: proveedores }] = await Promise.all([
    supabase.rpc("empresas_del_grupo"),
    supabase
      .from("activos")
      .select("id, codigo, nombre")
      .eq("clase", "tecnologico")
      .neq("estado", "dado_de_baja")
      .order("codigo"),
    supabase.from("gastos_ti").select("proveedor"),
  ]);

  const listaEmpresas = (empresas as EmpresaDelGrupo[] | null) ?? [];
  return {
    empresas: listaEmpresas,
    activos: (activos ?? []) as ActivoOpcion[],
    proveedores: Array.from(
      new Set(((proveedores ?? []) as { proveedor: string }[]).map((fila) => fila.proveedor)),
    ).sort((a, b) => a.localeCompare(b, "es")),
  };
}
