import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { Boton } from "@/components/ui/boton";
import {
  FormularioNoConformidad,
  type NoConformidadInicial,
} from "@/app/(sgc)/no-conformidades/formulario-no-conformidad";
import { esSoloLectura, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Editar no conformidad" };
export const dynamic = "force-dynamic";

/**
 * Edicion de la desviacion, con el mismo formulario del alta.
 *
 * Quien puede guardar lo decide RLS (`no_conformidades_edicion`):
 * Calidad, el responsable, quien la detecto y el responsable del
 * proceso. La pantalla no lo repite —ocultar el formulario no es un
 * control de acceso— pero el guardado devuelve el error si no
 * corresponde.
 */
export default async function PaginaEditarNoConformidad({
  params,
}: {
  params: { id: string };
}) {
  const usuario = await requerirUsuario();
  if (esSoloLectura(usuario)) redirect("/sin-acceso?motivo=permisos");

  const supabase = crearClienteServidor();

  const [{ data: consulta }, { data: procesos }, { data: empresas }, { data: usuarios }] =
    await Promise.all([
      supabase
        .from("no_conformidades")
        .select(
          "id, codigo, titulo, descripcion, origen, severidad, area, empresa_afectada_id, " +
            "proceso_id, responsable_id, correccion_inmediata, propuestas_mejora, fecha_deteccion",
        )
        .eq("id", params.id)
        .maybeSingle(),
      supabase.from("procesos").select("id, nombre, codigo").eq("activo", true).order("nombre"),
      supabase.rpc("empresas_del_grupo"),
      supabase
        .from("usuarios")
        .select("id, nombre_completo")
        .eq("activo", true)
        .order("nombre_completo"),
    ]);

  const noConformidad = consulta as (NoConformidadInicial & { codigo: string }) | null;
  if (!noConformidad) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Boton variante="fantasma" tamano="pequeno" comoHijo className="mb-3 -ml-2">
        <Link href={`/no-conformidades/${params.id}`}>
          <ArrowLeft /> Volver al resumen
        </Link>
      </Boton>

      <EncabezadoPagina
        titulo={`Editar ${noConformidad.codigo}`}
        descripcion="Se corrigen los datos con los que se registró la desviación. El código, el estado y las fechas de cierre no se tocan desde acá."
      />

      <FormularioNoConformidad
        procesos={procesos ?? []}
        empresas={empresas ?? []}
        usuarios={usuarios ?? []}
        inicial={noConformidad}
      />
    </div>
  );
}
