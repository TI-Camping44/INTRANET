import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import {
  FormularioControl,
  type ControlInicial,
} from "@/app/(sgc)/informatica/controles/formulario-control";
import { requerirModuloEditable } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Editar control de TI" };
export const dynamic = "force-dynamic";

export default async function PaginaEditarControl({ params }: { params: { id: string } }) {
  await requerirModuloEditable("informatica");
  const supabase = crearClienteServidor();

  const [{ data: control }, { data: personas }] = await Promise.all([
    supabase
      .from("controles_ti")
      .select(
        "id, codigo, nombre, descripcion, documento_origen, formulario, frecuencia_meses, " +
          "primer_periodo, responsable_id, vigente",
      )
      .eq("id", params.id)
      .maybeSingle(),
    supabase.from("usuarios").select("id, nombre_completo").eq("activo", true).order("nombre_completo"),
  ]);

  if (!control) notFound();
  const inicial = control as unknown as ControlInicial;

  return (
    <div className="mx-auto max-w-3xl">
      <EncabezadoPagina
        titulo={`Editar ${inicial.codigo}`}
        descripcion="Cambiar la frecuencia o el primer mes reprograma el cronograma; las ejecuciones ya registradas no se tocan."
      />
      <FormularioControl
        personas={(personas ?? []) as { id: string; nombre_completo: string }[]}
        inicial={inicial}
      />
    </div>
  );
}
