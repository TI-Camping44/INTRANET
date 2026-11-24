import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import {
  FormularioAutomatismo,
  type AutomatismoInicial,
  type PersonaOpcion,
} from "@/app/(sgc)/informatica/automatismos/formulario-automatismo";
import { requerirModuloEditable } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Editar automatismo" };
export const dynamic = "force-dynamic";

export default async function PaginaEditarAutomatismo({ params }: { params: { id: string } }) {
  await requerirModuloEditable("informatica");
  const supabase = crearClienteServidor();

  // Todo lo que el formulario muestra va en el `select`: un campo que no
  // se pide llega vacío y guardar lo borraría.
  const [{ data }, { data: personas }] = await Promise.all([
    supabase
      .from("automatismos_ti")
      .select("id, clave, nombre, donde_vive, descripcion, frecuencia_horas, vigente, responsable_id")
      .eq("id", params.id)
      .maybeSingle(),
    supabase.from("usuarios").select("id, nombre_completo").eq("activo", true).order("nombre_completo"),
  ]);

  if (!data) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <EncabezadoPagina titulo="Editar automatismo" />
      <FormularioAutomatismo
        personas={(personas ?? []) as PersonaOpcion[]}
        inicial={data as AutomatismoInicial}
      />
    </div>
  );
}
