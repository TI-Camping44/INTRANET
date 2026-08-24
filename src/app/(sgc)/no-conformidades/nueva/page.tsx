import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FormularioNoConformidad } from "@/app/(sgc)/no-conformidades/formulario-no-conformidad";
import { esSoloLectura, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Registrar desviación" };
export const dynamic = "force-dynamic";

export default async function PaginaNuevaNoConformidad() {
  const usuario = await requerirUsuario();
  if (esSoloLectura(usuario)) redirect("/sin-acceso?motivo=permisos");

  const supabase = crearClienteServidor();

  const [{ data: procesos }, { data: sedes }, { data: normas }, { data: usuarios }, { data: clientes }] =
    await Promise.all([
      supabase.from("procesos").select("id, nombre, codigo").eq("activo", true).order("nombre"),
      supabase.from("sedes").select("id, nombre").eq("activa", true).order("nombre"),
      supabase.from("normas").select("id, codigo").eq("vigente", true).order("codigo"),
      supabase
        .from("usuarios")
        .select("id, nombre_completo")
        .eq("activo", true)
        .order("nombre_completo"),
      supabase.from("clientes").select("id, razon_social").eq("activo", true).order("razon_social"),
    ]);

  return (
    <div className="mx-auto max-w-3xl">
      <EncabezadoPagina
        titulo="Registrar desviación"
        descripcion="La no conformidad se numera automáticamente y queda abierta. El análisis de causa raíz y el plan de acción se cargan luego, en la ficha del registro."
      />
      <FormularioNoConformidad
        procesos={procesos ?? []}
        sedes={sedes ?? []}
        normas={normas ?? []}
        usuarios={usuarios ?? []}
        clientes={clientes ?? []}
      />
    </div>
  );
}
