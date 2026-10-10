import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FormularioReclamo } from "@/app/(sgc)/reclamos/formulario-reclamo";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Nuevo reclamo" };
export const dynamic = "force-dynamic";

export default async function PaginaNuevoReclamo() {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) redirect("/sin-acceso?motivo=permisos");

  const supabase = crearClienteServidor();
  // La cartera NO se trae: son 8.551 contactos y el buscador consulta
  // al servidor a medida que se escribe.
  const { data: personas } = await supabase
    .from("usuarios")
    .select("id, nombre_completo")
    .eq("activo", true)
    .order("nombre_completo");

  return (
    <div className="mx-auto max-w-4xl">
      <EncabezadoPagina
        titulo="Nuevo reclamo de cliente"
        descripcion="El plan y sus plazos salen de la gravedad del hecho. Si es la segunda falla al mismo cliente en seis meses, el plan sube un nivel solo."
      />
      <FormularioReclamo
        personas={(personas as { id: string; nombre_completo: string }[] | null) ?? []}
      />
    </div>
  );
}
