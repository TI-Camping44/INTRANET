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

  const [{ data: programas }, { data: procesos }, { data: normas }, { data: sedes }, { data: usuarios }] =
    await Promise.all([
      supabase
        .from("programas_auditoria")
        .select("id, nombre, anio")
        .order("anio", { ascending: false }),
      supabase.from("procesos").select("id, nombre, codigo").eq("activo", true).order("nombre"),
      supabase.from("normas").select("id, codigo").eq("vigente", true).order("codigo"),
      supabase.from("sedes").select("id, nombre").eq("activa", true).order("nombre"),
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
        programas={programas ?? []}
        procesos={procesos ?? []}
        normas={normas ?? []}
        sedes={sedes ?? []}
        usuarios={usuarios ?? []}
        usuarioActual={usuario.id}
      />
    </div>
  );
}
