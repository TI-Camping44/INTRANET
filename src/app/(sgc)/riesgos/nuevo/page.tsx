import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FormularioRiesgo } from "@/app/(sgc)/riesgos/formulario-riesgo";
import { requerirRol } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { ROLES_GESTION } from "@/lib/constantes";

export const metadata: Metadata = { title: "Nuevo riesgo" };
export const dynamic = "force-dynamic";

export default async function PaginaNuevoRiesgo() {
  const usuario = await requerirRol(ROLES_GESTION);
  const supabase = crearClienteServidor();

  const [{ data: procesos }, { data: usuarios }] = await Promise.all([
    supabase.from("procesos").select("id, nombre, codigo").eq("activo", true).order("nombre"),
    supabase
      .from("usuarios")
      .select("id, nombre_completo")
      .eq("activo", true)
      .order("nombre_completo"),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <EncabezadoPagina
        titulo="Nuevo riesgo u oportunidad"
        descripcion="El nivel se calcula automáticamente como Probabilidad × Impacto y determina la periodicidad de reevaluación."
      />
      <FormularioRiesgo
        procesos={procesos ?? []}
        usuarios={usuarios ?? []}
        usuarioActual={usuario.id}
      />
    </div>
  );
}
