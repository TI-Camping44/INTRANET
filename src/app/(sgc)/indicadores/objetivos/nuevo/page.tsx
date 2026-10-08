import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { Boton } from "@/components/ui/boton";
import { FormularioObjetivo } from "@/app/(sgc)/indicadores/formulario-objetivo";
import { requerirRol } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { ROLES_GESTION } from "@/lib/constantes";

export const metadata: Metadata = { title: "Nuevo objetivo" };
export const dynamic = "force-dynamic";

export default async function PaginaNuevoObjetivo() {
  const usuario = await requerirRol(ROLES_GESTION);
  const supabase = crearClienteServidor();

  const [{ data: datosEmpresas }, { data: usuarios }] = await Promise.all([
    // Por `empresas_del_grupo()`: `empresas` la acota RLS a la propia y
    // Vitalica no aparecería en el desplegable.
    supabase.rpc("empresas_del_grupo"),
    supabase
      .from("usuarios")
      .select("id, nombre_completo")
      .eq("activo", true)
      .order("nombre_completo"),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <Boton variante="fantasma" tamano="pequeno" comoHijo className="mb-3 -ml-2">
        <Link href="/indicadores">
          <ArrowLeft /> Volver al listado
        </Link>
      </Boton>

      <EncabezadoPagina titulo="Nuevo objetivo de la calidad" />

      <FormularioObjetivo
        empresas={(datosEmpresas as { id: string; nombre: string }[] | null) ?? []}
        usuarios={(usuarios as { id: string; nombre_completo: string }[] | null) ?? []}
        usuarioActual={usuario.id}
      />
    </div>
  );
}
