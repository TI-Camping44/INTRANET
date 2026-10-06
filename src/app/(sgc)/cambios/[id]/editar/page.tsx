import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { Boton } from "@/components/ui/boton";
import {
  FormularioCambio,
  type CambioInicial,
} from "@/app/(sgc)/cambios/formulario-cambio";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Editar cambio" };
export const dynamic = "force-dynamic";

/**
 * Edición de un cambio ya registrado.
 *
 * `actualizarCambio` y el modo de edición del formulario existían desde
 * el principio, y ninguna pantalla los usaba: un cambio cargado con un
 * dato mal escrito solo se podía corregir desde el panel de Supabase.
 * Esta página es la que faltaba.
 *
 * UN CAMBIO CERRADO NO SE EDITA. Lo que se cerró quedó con su resultado
 * y su observación de seguimiento: corregir el plan después de saber si
 * funcionó deja el registro diciendo que se planificó algo que en
 * realidad se escribió al final.
 */
export default async function PaginaEditarCambio({
  params,
}: {
  params: { id: string };
}) {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) redirect("/sin-acceso?motivo=permisos");

  const supabase = crearClienteServidor();

  const { data: consulta } = await supabase
    .from("cambios")
    .select(
      "id, codigo, titulo, tipo, estado, proceso_id, responsable_id, proposito," +
        " consecuencias_potenciales, impacto_integridad_sgc, recursos_necesarios," +
        " responsabilidades, comunicacion_a_quien, comunicacion_cuando, comunicacion_canal," +
        " afecta_material_controlado, impacto_trazabilidad, indicador_exito, criterio_exito," +
        " fecha_revision",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!consulta) notFound();
  const cambio = consulta as unknown as CambioInicial & { codigo: string; estado: string };

  if (cambio.estado === "cerrado") redirect(`/cambios/${params.id}`);

  const [{ data: procesos }, { data: personas }] = await Promise.all([
    supabase
      .from("procesos")
      .select("id, nombre, codigo")
      .eq("activo", true)
      .eq("version", "01")
      .order("nombre"),
    supabase
      .from("usuarios")
      .select("id, nombre_completo")
      .eq("activo", true)
      .order("nombre_completo"),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <Boton variante="fantasma" tamano="pequeno" comoHijo className="mb-3 -ml-2">
        <Link href={`/cambios/${cambio.id}`}>
          <ArrowLeft /> Volver al cambio
        </Link>
      </Boton>

      <EncabezadoPagina
        titulo={`Editar ${cambio.codigo}`}
        descripcion="El código y el estado no se editan: el código identifica al cambio y el estado se mueve desde la ficha."
      />

      <FormularioCambio
        procesos={(procesos as { id: string; nombre: string; codigo: string }[] | null) ?? []}
        personas={(personas as { id: string; nombre_completo: string }[] | null) ?? []}
        inicial={cambio}
      />
    </div>
  );
}
