import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FormularioAuditoria } from "@/app/(sgc)/auditorias/formulario-auditoria";
import { puedeGestionarAuditorias, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Nueva auditoría" };
export const dynamic = "force-dynamic";

export default async function PaginaNuevaAuditoria() {
  const usuario = await requerirUsuario();
  if (!puedeGestionarAuditorias(usuario)) redirect("/sin-acceso?motivo=permisos");

  const supabase = crearClienteServidor();

  // Calidad saco del alta el programa anual, la sede y la norma de
  // referencia: los tres se completaban siempre igual o se dejaban
  // vacios. Las columnas siguen en la tabla y se editan en la ficha.
  const [{ data: procesos }, { data: usuarios }] = await Promise.all([
    supabase.from("procesos").select("id, nombre, codigo").eq("activo", true).order("codigo"),
    supabase
      .from("usuarios")
      .select("id, nombre_completo")
      .eq("activo", true)
      .order("nombre_completo"),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <EncabezadoPagina
        titulo="Nueva auditoría interna"
        descripcion="La auditoría se numera automáticamente y queda planificada. Los hallazgos se cargan durante la ejecución."
      />
      <FormularioAuditoria
        procesos={procesos ?? []}
        usuarios={usuarios ?? []}
        usuarioActual={usuario.id}
      />
    </div>
  );
}
