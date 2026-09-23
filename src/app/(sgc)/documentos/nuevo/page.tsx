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

  // Las categorías ya usadas, para ofrecerlas en el alta. Sin esto se
  // terminan cargando «Compras» y «compras» como dos carpetas distintas.
  const [{ data: usadas }, { data: procesos }] = await Promise.all([
    supabase.from("documentos").select("categoria").not("categoria", "is", null),
    supabase.from("procesos").select("id, nombre, codigo").eq("activo", true).order("codigo"),
  ]);

  const categorias = Array.from(
    new Set(((usadas as { categoria: string }[] | null) ?? []).map((fila) => fila.categoria)),
  ).sort();

  return (
    <div className="mx-auto max-w-3xl">
      <EncabezadoPagina
        titulo="Nuevo documento"
        descripcion="El documento se crea en borrador con su versión v00. Luego se envía a revisión y se aprueba para dejarlo vigente."
      />
      <FormularioDocumento
        usuarioActual={usuario.id}
        categorias={categorias}
        procesos={procesos ?? []}
      />
    </div>
  );
}
