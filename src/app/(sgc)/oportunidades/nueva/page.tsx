import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FormularioOportunidad } from "@/app/(sgc)/oportunidades/formulario-oportunidad";
import { esSoloLectura, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Nueva oportunidad" };
export const dynamic = "force-dynamic";

export default async function PaginaNuevaOportunidad() {
  const usuario = await requerirUsuario();
  if (esSoloLectura(usuario)) redirect("/sin-acceso?motivo=permisos");

  const supabase = crearClienteServidor();

  const [{ data: usuarios }, { data: documentos }] = await Promise.all([
    supabase
      .from("usuarios")
      .select("id, nombre_completo")
      .eq("activo", true)
      .order("nombre_completo"),
    // La informacion documentada contra la que se identifica la
    // oportunidad, igual que en el riesgo. Hoy la tabla puede estar
    // vacia y el selector lo dice.
    supabase.from("documentos").select("id, codigo, titulo").order("codigo"),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <EncabezadoPagina
        titulo="Nueva Oportunidad"
      />
      <FormularioOportunidad
        documentos={
          (documentos as { id: string; codigo: string | null; titulo: string }[] | null) ?? []
        }
        usuarios={usuarios ?? []}
        usuarioActual={usuario.id}
      />
    </div>
  );
}
