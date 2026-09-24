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

  const [{ data: consulta }, { data: procesos }, { data: usuarios }] = await Promise.all([
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
    supabase.from("procesos").select("id, nombre, codigo").eq("activo", true).order("nombre"),
    supabase
      .from("usuarios")
      .select("id, nombre_completo")
      .eq("activo", true)
      .order("nombre_completo"),
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
        procesos={procesos ?? []}
        usuarios={usuarios ?? []}
        usuarioActual={usuario.id}
        inicial={riesgo}
      />
    </div>
  );
}
