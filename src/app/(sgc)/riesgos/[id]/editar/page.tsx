import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { Boton } from "@/components/ui/boton";
import {
  FormularioRiesgo,
  type RiesgoInicial,
} from "@/app/(sgc)/riesgos/formulario-riesgo";
import { esSoloLectura, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { procesosDocumentados } from "@/lib/procesos-documentados";

export const metadata: Metadata = { title: "Editar riesgo" };
export const dynamic = "force-dynamic";

/**
 * Correccion de los datos con los que se registro el riesgo.
 *
 * La valoracion no se toca acá: cambiarla es reevaluar, y eso se hace
 * desde la ficha para que quede con fecha, autor y comentario. El
 * formulario lo explica en su lugar.
 *
 * Una oportunidad no entra por esta pantalla: no se valora igual y tiene
 * su propio formulario.
 */
export default async function PaginaEditarRiesgo({ params }: { params: { id: string } }) {
  const usuario = await requerirUsuario();
  if (esSoloLectura(usuario)) redirect("/sin-acceso?motivo=permisos");

  const supabase = crearClienteServidor();

  const [
    { data: consulta },
    procesos,
    { data: usuarios },
    { data: documentos },
    { data: vinculados },
    { data: accionesCargadas },
  ] = await Promise.all([
    supabase
      .from("riesgos")
      .select(
        "id, codigo, tipo, titulo, descripcion, origen, proceso_id, responsable_id, " +
          "causas, consecuencias, controles_existentes, asociado_disrupcion, tratamiento, " +
          "fundamento_decision, accion_planificada, plazo_accion, proceso_accion_id, " +
          "probabilidad, severidad",
      )
      .eq("id", params.id)
      .maybeSingle(),
    procesosDocumentados(supabase),
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

  const riesgo = consulta as (RiesgoInicial & { codigo: string; tipo: string }) | null;
  if (!riesgo) notFound();
  if (riesgo.tipo === "oportunidad") redirect(`/riesgos/${params.id}`);

  return (
    <div className="mx-auto max-w-3xl">
      <Boton variante="fantasma" tamano="pequeno" comoHijo className="mb-3 -ml-2">
        <Link href={`/riesgos/${params.id}`}>
          <ArrowLeft /> Volver a la ficha
        </Link>
      </Boton>

      <EncabezadoPagina
        titulo={`Editar ${riesgo.codigo}`}
        descripcion="Se corrigen los datos con los que se registró el riesgo. El código y la valoración no se tocan desde acá."
      />

      <FormularioRiesgo
        documentos={
          (documentos as { id: string; codigo: string | null; titulo: string }[] | null) ?? []
        }
        procesos={procesos}
        usuarios={usuarios ?? []}
        usuarioActual={usuario.id}
        inicial={{
          ...riesgo,
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
