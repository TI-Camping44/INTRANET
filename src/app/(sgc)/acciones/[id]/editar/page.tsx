import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { Boton } from "@/components/ui/boton";
import {
  FormularioAccion,
  type OpcionNoConformidad,
} from "@/app/(sgc)/acciones/formulario-accion";
import { esSoloLectura, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { NcPorque } from "@/lib/tipos";

export const metadata: Metadata = { title: "Editar acción correctiva" };
export const dynamic = "force-dynamic";

/**
 * Edicion de la accion correctiva, con el mismo formulario del alta.
 *
 * Las tareas que ya existen viajan con su id y se actualizan; las que se
 * agregan se insertan y las que se sacan se borran. Por eso una tarea ya
 * ejecutada conserva su estado al editar el texto de otra.
 */
export default async function PaginaEditarAccionCorrectiva({
  params,
}: {
  params: { id: string };
}) {
  const usuario = await requerirUsuario();
  if (esSoloLectura(usuario)) redirect("/sin-acceso?motivo=permisos");

  const supabase = crearClienteServidor();

  const [{ data: nc }, { data: porques }, { data: filas }, { data: personas }] =
    await Promise.all([
      supabase
        .from("no_conformidades")
        .select("id, codigo, titulo, hay_nc_similares, analisis_horizontal")
        .eq("id", params.id)
        .maybeSingle(),
      supabase.from("nc_porques").select("*").eq("no_conformidad_id", params.id).order("orden"),
      supabase
        .from("nc_acciones")
        .select("id, descripcion, descargo, responsable_id, fecha_limite")
        .eq("no_conformidad_id", params.id)
        .order("creado_en"),
      supabase
        .from("usuarios")
        .select("id, nombre_completo")
        .eq("activo", true)
        .order("nombre_completo"),
    ]);

  if (!nc) notFound();

  const acciones =
    (filas as
      | {
          id: string;
          descripcion: string;
          descargo: string | null;
          responsable_id: string | null;
          fecha_limite: string;
        }[]
      | null) ?? [];

  if (acciones.length === 0) redirect(`/acciones/nueva?nc=${params.id}`);

  const opcion: OpcionNoConformidad = { id: nc.id, codigo: nc.codigo, titulo: nc.titulo };

  return (
    <div className="mx-auto max-w-3xl">
      <Boton variante="fantasma" tamano="pequeno" comoHijo className="mb-3 -ml-2">
        <Link href={`/acciones/${params.id}`}>
          <ArrowLeft /> Volver a la acción correctiva
        </Link>
      </Boton>

      <EncabezadoPagina
        titulo={`Editar la acción correctiva de ${nc.codigo}`}
        descripcion="Se corrigen el descargo, el análisis y las acciones. El estado de ejecución de cada acción no se toca desde acá."
      />

      <FormularioAccion
        noConformidades={[opcion]}
        personas={(personas as { id: string; nombre_completo: string }[] | null) ?? []}
        usuarioActual={usuario.id}
        inicial={{
          noConformidadId: nc.id,
          descargo: acciones.find((accion) => accion.descargo)?.descargo ?? "",
          porques: ((porques as NcPorque[] | null) ?? []).map((porque) => porque.respuesta),
          hayNcSimilares: (nc as { hay_nc_similares: boolean | null }).hay_nc_similares,
          analisisHorizontal: (nc as { analisis_horizontal: string | null }).analisis_horizontal,
          acciones: acciones.map((accion) => ({
            id: accion.id,
            descripcion: accion.descripcion,
            responsable_id: accion.responsable_id,
            fecha_limite: accion.fecha_limite,
          })),
        }}
      />
    </div>
  );
}
