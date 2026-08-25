import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FormularioIndicador } from "@/app/(sgc)/indicadores/formulario-indicador";
import { requerirRol } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { ROLES_GESTION } from "@/lib/constantes";

export const metadata: Metadata = { title: "Nuevo indicador" };
export const dynamic = "force-dynamic";

export default async function PaginaNuevoIndicador() {
  const usuario = await requerirRol(ROLES_GESTION);
  const supabase = crearClienteServidor();

  const [{ data: procesos }, { data: usuarios }, { data: existentes }] = await Promise.all([
    supabase.from("procesos").select("id, nombre, codigo").eq("activo", true).order("nombre"),
    supabase
      .from("usuarios")
      .select("id, nombre_completo")
      .eq("activo", true)
      .order("nombre_completo"),
    supabase.from("indicadores").select("codigo").ilike("codigo", "KPI-%"),
  ]);

  // Se propone el siguiente correlativo disponible.
  const secuencias = ((existentes ?? []) as { codigo: string }[])
    .map((fila) => Number.parseInt(fila.codigo.split("-")[1] ?? "", 10))
    .filter((numero) => !Number.isNaN(numero));
  const siguiente = (secuencias.length ? Math.max(...secuencias) : 0) + 1;

  return (
    <div className="mx-auto max-w-3xl">
      <EncabezadoPagina
        titulo="Nuevo indicador"
        descripcion="El sentido define cuándo se considera cumplida la meta; el sistema calcula el cumplimiento con esa misma regla en la base de datos."
      />
      <FormularioIndicador
        procesos={procesos ?? []}
        usuarios={usuarios ?? []}
        usuarioActual={usuario.id}
        codigoSugerido={`KPI-${String(siguiente).padStart(2, "0")}`}
      />
    </div>
  );
}
