import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { Boton } from "@/components/ui/boton";
import {
  FormularioReclamo,
  type ReclamoInicial,
} from "@/app/(sgc)/reclamos/formulario-reclamo";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Editar reclamo" };
export const dynamic = "force-dynamic";

/**
 * Edición del caso, con el mismo formulario del alta.
 *
 * Se corrige lo que se registró: qué pasó, a quién, la gravedad y quién lo
 * gestiona. Los plazos NO se editan acá: los recalcula el servidor si la
 * gravedad cambia, porque de la gravedad salen.
 */
export default async function PaginaEditarReclamo({ params }: { params: { id: string } }) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const [{ data }, { data: personas }, { data: clientes }] = await Promise.all([
    supabase
      .from("reclamos")
      .select(
        "id, codigo, titulo, descripcion, cliente_id, cliente_nombre, origen, tipo_falla, " +
          "gravedad, gestor_id, responsable_area_id, material_controlado, " +
          "departamentos_intervinientes",
      )
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("usuarios")
      .select("id, nombre_completo")
      .eq("activo", true)
      .order("nombre_completo"),
    supabase.from("clientes").select("id, razon_social").eq("activo", true).order("razon_social"),
  ]);

  const reclamo = data as (ReclamoInicial & { codigo: string }) | null;
  if (!reclamo) notFound();

  // La misma regla que la ficha, que es la de la política
  // `reclamos_edicion`: Calidad, el gestor del caso o el responsable del
  // área. Se comprueba después de leer el caso porque depende de él.
  const puedeEditar =
    puedeGestionar(usuario) ||
    usuario.id === reclamo.gestor_id ||
    usuario.id === reclamo.responsable_area_id;

  if (!puedeEditar) redirect("/sin-acceso?motivo=permisos");

  return (
    <div className="mx-auto max-w-4xl">
      <Boton variante="fantasma" tamano="pequeno" comoHijo className="mb-3 -ml-2">
        <Link href={`/reclamos/${params.id}`}>
          <ArrowLeft /> Volver al caso
        </Link>
      </Boton>

      <EncabezadoPagina
        titulo={`Editar ${reclamo.codigo}`}
        descripcion="Si cambia la gravedad, el plan y los plazos se recalculan. El plan nunca baja de nivel."
      />

      <FormularioReclamo
        personas={(personas as { id: string; nombre_completo: string }[] | null) ?? []}
        clientes={(clientes as { id: string; razon_social: string }[] | null) ?? []}
        inicial={reclamo}
      />
    </div>
  );
}
