import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { Boton } from "@/components/ui/boton";
import {
  FormularioOportunidad,
  type OportunidadInicial,
} from "@/app/(sgc)/oportunidades/formulario-oportunidad";
import { esSoloLectura, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Editar oportunidad" };
export const dynamic = "force-dynamic";

/**
 * Correccion de los datos con los que se registro la oportunidad.
 *
 * La ficha de una oportunidad vive en `/riesgos/<id>`, porque es la misma
 * tabla; la edicion en cambio tiene pantalla propia, porque el formulario
 * es otro: beneficio y factibilidad, no probabilidad y severidad.
 *
 * Un riesgo no entra por acá: tiene su propio formulario.
 */
export default async function PaginaEditarOportunidad({
  params,
}: {
  params: { id: string };
}) {
  const usuario = await requerirUsuario();
  if (esSoloLectura(usuario)) redirect("/sin-acceso?motivo=permisos");

  const supabase = crearClienteServidor();

  const [
    { data: consulta },
    { data: usuarios },
    { data: documentos },
    { data: vinculados },
    { data: accionesCargadas },
  ] = await Promise.all([
    supabase
      .from("riesgos")
      .select(
        "id, codigo, tipo, titulo, descripcion, origen, efecto_deseado, " +
          "responsable_id, beneficio, factibilidad, alineacion_estrategica, " +
          "se_decide_abordar, fundamento_decision, recursos_necesarios",
      )
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("usuarios")
      .select("id, nombre_completo")
      .eq("activo", true)
      .order("nombre_completo"),
    supabase.from("documentos").select("id, codigo, titulo").order("codigo"),
    // Los documentos ya vinculados, para traerlos marcados.
    supabase.from("riesgo_documentos").select("documento_id").eq("riesgo_id", params.id),
    // Las acciones ya cargadas, con los documentos de cada una.
    supabase
      .from("riesgo_acciones")
      .select("id, descripcion, responsable_id, fecha_limite, riesgo_accion_documentos (documento_id)")
      .eq("riesgo_id", params.id)
      .order("creado_en"),
  ]);

  const oportunidad = consulta as (OportunidadInicial & { codigo: string; tipo: string }) | null;
  if (!oportunidad) notFound();
  if (oportunidad.tipo !== "oportunidad") redirect(`/riesgos/${params.id}/editar`);

  return (
    <div className="mx-auto max-w-3xl">
      <Boton variante="fantasma" tamano="pequeno" comoHijo className="mb-3 -ml-2">
        <Link href={`/riesgos/${params.id}`}>
          <ArrowLeft /> Volver a la ficha
        </Link>
      </Boton>

      <EncabezadoPagina
        titulo={`Editar ${oportunidad.codigo}`}
        descripcion="Se corrigen los datos con los que se registró la oportunidad. El código no se toca desde acá."
      />

      <FormularioOportunidad
        documentos={
          (documentos as { id: string; codigo: string | null; titulo: string }[] | null) ?? []
        }
        usuarios={usuarios ?? []}
        usuarioActual={usuario.id}
        inicial={{
          ...oportunidad,
          documentos: ((vinculados as { documento_id: string }[] | null) ?? []).map(
            (fila) => fila.documento_id,
          ),
          acciones: (
            (accionesCargadas as unknown as {
              id: string;
              descripcion: string;
              responsable_id: string | null;
              fecha_limite: string | null;
              riesgo_accion_documentos: { documento_id: string }[];
            }[] | null) ?? []
          ).map((accion) => ({
            clave: accion.id,
            descripcion: accion.descripcion ?? "",
            responsable_id: accion.responsable_id ?? "",
            plazo: accion.fecha_limite ?? "",
            documentos: (accion.riesgo_accion_documentos ?? []).map((fila) => fila.documento_id),
          })),
        }}
      />
    </div>
  );
}
