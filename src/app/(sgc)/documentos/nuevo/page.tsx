import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FormularioDocumento } from "@/app/(sgc)/documentos/formulario-documento";
import { requerirRol } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { ROLES_GESTION } from "@/lib/constantes";

export const metadata: Metadata = { title: "Nuevo documento" };
export const dynamic = "force-dynamic";

export default async function PaginaNuevoDocumento() {
  const usuario = await requerirRol(ROLES_GESTION);
  const supabase = crearClienteServidor();

  const [{ data: procesos }, { data: normas }, { data: usuarios }] = await Promise.all([
    supabase.from("procesos").select("id, nombre, codigo").eq("activo", true).order("nombre"),
    supabase.from("normas").select("id, codigo, nombre").eq("vigente", true).order("codigo"),
    supabase
      .from("usuarios")
      .select("id, nombre_completo")
      .eq("activo", true)
      .order("nombre_completo"),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <EncabezadoPagina
        titulo="Nuevo documento"
        descripcion="El documento se crea en borrador con su versión v00. Luego se envía a revisión y se aprueba para dejarlo vigente."
      />
      <FormularioDocumento
        procesos={procesos ?? []}
        normas={normas ?? []}
        usuarios={usuarios ?? []}
        usuarioActual={usuario.id}
      />
    </div>
  );
}
