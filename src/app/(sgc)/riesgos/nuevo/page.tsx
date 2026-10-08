import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FormularioRiesgo } from "@/app/(sgc)/riesgos/formulario-riesgo";
import { requerirRol } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { ROLES_GESTION } from "@/lib/constantes";
import { procesosDocumentados } from "@/lib/procesos-documentados";

export const metadata: Metadata = { title: "Nuevo riesgo" };
export const dynamic = "force-dynamic";

export default async function PaginaNuevoRiesgo() {
  const usuario = await requerirRol(ROLES_GESTION);
  const supabase = crearClienteServidor();

  // Los procesos salen de los manuales cargados en Informacion
  // Documentada, no de una lista propia. Ver `lib/procesos-documentados.ts`.
  const [procesos, { data: usuarios }, { data: documentos }] = await Promise.all([
    procesosDocumentados(supabase),
    supabase
      .from("usuarios")
      .select("id, nombre_completo")
      .eq("activo", true)
      .order("nombre_completo"),
    // La informacion documentada contra la que se identifica el riesgo.
    // Hoy la tabla esta vacia y el selector lo dice; a medida que Calidad
    // cargue documentos aparecen solos.
    supabase.from("documentos").select("id, codigo, titulo").order("codigo"),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <EncabezadoPagina
        titulo="Nuevo Riesgo"
      />
      <FormularioRiesgo
        documentos={
          (documentos as { id: string; codigo: string | null; titulo: string }[] | null) ?? []
        }
        procesos={procesos}
        usuarios={usuarios ?? []}
        usuarioActual={usuario.id}
      />
    </div>
  );
}
