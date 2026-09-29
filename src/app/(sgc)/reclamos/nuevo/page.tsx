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
  const [{ data: personas }, { data: clientes }] = await Promise.all([
    supabase.from("usuarios").select("id, nombre_completo").eq("activo", true).order("nombre_completo"),
    supabase.from("clientes").select("id, razon_social").eq("activo", true).order("razon_social"),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <EncabezadoPagina
        titulo="Nuevo reclamo de cliente"
        descripcion="El plan y sus plazos salen de la gravedad del hecho. Si es la segunda falla al mismo cliente en seis meses, el plan sube un nivel solo."
      />
      <FormularioReclamo
        personas={(personas as { id: string; nombre_completo: string }[] | null) ?? []}
        clientes={(clientes as { id: string; razon_social: string }[] | null) ?? []}
      />
    </div>
  );
}
