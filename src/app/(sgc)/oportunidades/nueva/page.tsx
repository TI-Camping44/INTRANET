import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FormularioOportunidad } from "@/app/(sgc)/oportunidades/formulario-oportunidad";
import { esSoloLectura, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Nueva oportunidad" };
export const dynamic = "force-dynamic";

export default async function PaginaNuevaOportunidad() {
  const usuario = await requerirUsuario();
  if (esSoloLectura(usuario)) redirect("/sin-acceso?motivo=permisos");

  const supabase = crearClienteServidor();

  const [{ data: procesos }, { data: usuarios }] = await Promise.all([
    supabase.from("procesos").select("id, nombre, codigo").eq("activo", true).order("codigo"),
    supabase
      .from("usuarios")
      .select("id, nombre_completo")
      .eq("activo", true)
      .order("nombre_completo"),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <EncabezadoPagina
        titulo="Nueva oportunidad"
        descripcion="Una oportunidad no se valora con probabilidad y severidad: se valora por el beneficio que podría aportar y por la facilidad real de concretarla."
      />
      <FormularioOportunidad
        procesos={procesos ?? []}
        usuarios={usuarios ?? []}
        usuarioActual={usuario.id}
      />
    </div>
  );
}
