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

  const [{ data: consulta }, { data: procesos }, { data: usuarios }] = await Promise.all([
    supabase
      .from("riesgos")
      .select(
        "id, codigo, tipo, titulo, descripcion, origen, efecto_deseado, proceso_id, " +
          "responsable_id, beneficio, factibilidad, alineacion_estrategica, " +
          "se_decide_abordar, fundamento_decision, accion_planificada, " +
          "recursos_necesarios, plazo_accion, proceso_accion_id",
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
        procesos={procesos ?? []}
        usuarios={usuarios ?? []}
        usuarioActual={usuario.id}
        inicial={oportunidad}
      />
    </div>
  );
}
