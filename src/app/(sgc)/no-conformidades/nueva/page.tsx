import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FormularioNoConformidad } from "@/app/(sgc)/no-conformidades/formulario-no-conformidad";
import { esSoloLectura, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Nueva No Conformidad" };
export const dynamic = "force-dynamic";

export default async function PaginaNuevaNoConformidad() {
  const usuario = await requerirUsuario();
  if (esSoloLectura(usuario)) redirect("/sin-acceso?motivo=permisos");

  const supabase = crearClienteServidor();

  // Las dos empresas del grupo se ofrecen aunque una este inactiva:
  // Calidad lleva el sistema de las dos y una desviacion de Vitalica
  // E.A.S. se registra igual.
  //
  // Va por `empresas_del_grupo()` y no por un select a `empresas`: la
  // politica RLS de esa tabla solo deja ver la empresa propia, asi que el
  // selector mostraba Camping 44 y nada mas. La funcion devuelve id y
  // razon social, sin RUC ni el resto de la ficha.
  const [{ data: procesos }, { data: empresas }, { data: usuarios }] = await Promise.all([
    supabase.from("procesos").select("id, nombre, codigo").eq("activo", true).order("nombre"),
    supabase.rpc("empresas_del_grupo"),
    supabase
      .from("usuarios")
      .select("id, nombre_completo")
      .eq("activo", true)
      .order("nombre_completo"),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <EncabezadoPagina
        titulo="Nueva No Conformidad"
        descripcion="La no conformidad se numera automáticamente y queda abierta. El descargo, el análisis de causa raíz y la acción correctiva se cargan después, desde «Acciones correctivas»."
      />
      <FormularioNoConformidad
        procesos={procesos ?? []}
        empresas={empresas ?? []}
        usuarios={usuarios ?? []}
      />
    </div>
  );
}
