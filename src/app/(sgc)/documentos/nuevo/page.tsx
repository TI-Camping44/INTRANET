import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FormularioDocumento } from "@/app/(sgc)/documentos/formulario-documento";
import { requerirRol } from "@/lib/sesion";
import { ROLES_GESTION } from "@/lib/constantes";

export const metadata: Metadata = { title: "Nuevo documento" };
export const dynamic = "force-dynamic";

export default async function PaginaNuevoDocumento() {
  const usuario = await requerirRol(ROLES_GESTION);

  return (
    <div className="mx-auto max-w-3xl">
      <EncabezadoPagina
        titulo="Nuevo documento"
        descripcion="El documento se crea en borrador con su versión v00. Luego se envía a revisión y se aprueba para dejarlo vigente."
      />
      <FormularioDocumento usuarioActual={usuario.id} />
    </div>
  );
}
