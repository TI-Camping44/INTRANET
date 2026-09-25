import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FormularioCambio } from "@/app/(sgc)/cambios/formulario-cambio";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Nuevo cambio" };
export const dynamic = "force-dynamic";

export default async function PaginaNuevoCambio() {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) redirect("/sin-acceso?motivo=permisos");

  const supabase = crearClienteServidor();
  const [{ data: procesos }, { data: personas }] = await Promise.all([
    supabase.from("procesos").select("id, nombre, codigo").eq("activo", true).order("nombre"),
    supabase.from("usuarios").select("id, nombre_completo").eq("activo", true).order("nombre_completo"),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <EncabezadoPagina
        titulo="Nuevo cambio significativo"
        descripcion="Queda en borrador. Para que avance hay que enviarlo a aprobación, y aprobarlo es atribución de Dirección o del Administrador SGC."
      />
      <FormularioCambio
        procesos={(procesos as { id: string; nombre: string; codigo: string }[] | null) ?? []}
        personas={(personas as { id: string; nombre_completo: string }[] | null) ?? []}
      />
    </div>
  );
}
