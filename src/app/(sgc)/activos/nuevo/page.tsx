import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FormularioActivo } from "@/app/(sgc)/activos/formulario-activo";
import { requerirRol } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { ROLES_GESTION } from "@/lib/constantes";

export const metadata: Metadata = { title: "Nuevo activo" };
export const dynamic = "force-dynamic";

export default async function PaginaNuevoActivo() {
  await requerirRol(ROLES_GESTION);
  const supabase = crearClienteServidor();

  const [{ data: sedes }, { data: personas }, { data: proveedores }, { data: existentes }] =
    await Promise.all([
      supabase.from("sedes").select("id, nombre").eq("activa", true).order("nombre"),
      supabase
        .from("usuarios")
        .select("id, nombre_completo")
        .eq("activo", true)
        .order("nombre_completo"),
      supabase
        .from("proveedores")
        .select("id, razon_social")
        .neq("estado", "inactivo")
        .order("razon_social"),
      supabase.from("activos").select("codigo").ilike("codigo", "ACT-%"),
    ]);

  const secuencias = ((existentes ?? []) as { codigo: string }[])
    .map((fila) => Number.parseInt(fila.codigo.split("-")[1] ?? "", 10))
    .filter((numero) => !Number.isNaN(numero));
  const siguiente = (secuencias.length ? Math.max(...secuencias) : 0) + 1;

  return (
    <div className="mx-auto max-w-3xl">
      <EncabezadoPagina
        titulo="Nuevo activo"
        descripcion="Si el activo requiere mantenimiento preventivo, el sistema agenda el primero según la frecuencia indicada."
      />
      <FormularioActivo
        sedes={sedes ?? []}
        personas={personas ?? []}
        proveedores={proveedores ?? []}
        codigoSugerido={`ACT-${String(siguiente).padStart(3, "0")}`}
      />
    </div>
  );
}
