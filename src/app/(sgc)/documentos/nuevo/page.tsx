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
  const [{ data: usadas }, { data: procesos }, { data: manuales }, { data: datosEmpresas }] =
    await Promise.all([
    supabase.from("documentos").select("categoria").not("categoria", "is", null),
    supabase.from("procesos").select("id, nombre, codigo").eq("activo", true).eq("version", "00").order("codigo"),
    // Los manuales de proceso ya cargados: es a lo que se ata un
    // instructivo, un protocolo o un formulario.
    supabase
      .from("documentos")
      .select("id, codigo, titulo")
      .eq("tipo", "manual")
      .order("codigo"),
    supabase.rpc("empresas_del_grupo"),
  ]);

  const categorias = Array.from(
    new Set(((usadas as { categoria: string }[] | null) ?? []).map((fila) => fila.categoria)),
  ).sort();

  return (
    <div className="mx-auto max-w-3xl">
      <EncabezadoPagina
        titulo="Nuevo documento"
        descripcion="El documento se crea en borrador con su versión Ver.00. Luego se envía a revisión y se aprueba para dejarlo vigente."
      />
      <FormularioDocumento
        manuales={
          (manuales as { id: string; codigo: string | null; titulo: string }[] | null) ?? []
        }
        empresas={(datosEmpresas as { id: string; nombre: string }[] | null) ?? []}
        usuarioActual={usuario.id}
        categorias={categorias}
        procesos={procesos ?? []}
      />
    </div>
  );
}
