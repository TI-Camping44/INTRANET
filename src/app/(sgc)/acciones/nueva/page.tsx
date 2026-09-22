import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import {
  FormularioAccion,
  type OpcionNoConformidad,
} from "@/app/(sgc)/acciones/formulario-accion";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { esSoloLectura, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { ESTADOS_NC_ABIERTOS } from "@/lib/constantes";

export const metadata: Metadata = { title: "Nueva acción correctiva" };
export const dynamic = "force-dynamic";

export default async function PaginaNuevaAccion({
  searchParams,
}: {
  searchParams: { nc?: string };
}) {
  const usuario = await requerirUsuario();
  if (esSoloLectura(usuario)) redirect("/sin-acceso?motivo=permisos");

  const supabase = crearClienteServidor();

  // Solo las que siguen abiertas: cargar una acción sobre una no
  // conformidad ya cerrada no tiene sentido, y la lista se vuelve
  // impracticable si arrastra el histórico.
  const [{ data: noConformidades }, { data: personas }] = await Promise.all([
    supabase
      .from("no_conformidades")
      .select("id, codigo, titulo")
      .in("estado", ESTADOS_NC_ABIERTOS)
      .order("codigo", { ascending: true }),
    supabase
      .from("usuarios")
      .select("id, nombre_completo")
      .eq("activo", true)
      .order("nombre_completo"),
  ]);

  const opciones = (noConformidades as OpcionNoConformidad[] | null) ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <EncabezadoPagina
        titulo="Nueva acción correctiva"
        descripcion="Elija la no conformidad por su código y cargue la acción. Puede hacerlo también sobre una desviación que no esté a su nombre."
      />

      {opciones.length === 0 ? (
        <EstadoVacio
          titulo="No hay no conformidades abiertas"
          descripcion="Una acción correctiva se carga sobre una desviación abierta o en tratamiento, y en este momento no hay ninguna."
        />
      ) : (
        <FormularioAccion
          noConformidades={opciones}
          personas={(personas as { id: string; nombre_completo: string }[] | null) ?? []}
          usuarioActual={usuario.id}
          noConformidadInicial={searchParams.nc}
        />
      )}
    </div>
  );
}
