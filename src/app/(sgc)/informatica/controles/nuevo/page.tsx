import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FormularioControl } from "@/app/(sgc)/informatica/controles/formulario-control";
import { requerirModuloEditable } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Nuevo control de TI" };
export const dynamic = "force-dynamic";

/**
 * Alta de un control periódico.
 *
 * El código se sugiere con la secuencia `CTI-NN`; se puede cambiar, como
 * el de los activos. El responsable sugerido es quien lo carga: en un
 * área de una sola persona es casi siempre el mismo.
 */
export default async function PaginaNuevoControl() {
  const usuario = await requerirModuloEditable("informatica");
  const supabase = crearClienteServidor();

  const [{ data: personas }, { data: existentes }] = await Promise.all([
    supabase.from("usuarios").select("id, nombre_completo").eq("activo", true).order("nombre_completo"),
    supabase.from("controles_ti").select("codigo").ilike("codigo", "CTI-%"),
  ]);

  const secuencias = ((existentes ?? []) as { codigo: string }[])
    .map((fila) => Number.parseInt(fila.codigo.split("-")[1] ?? "", 10))
    .filter((numero) => !Number.isNaN(numero));
  const siguiente = (secuencias.length ? Math.max(...secuencias) : 0) + 1;

  return (
    <div className="mx-auto max-w-3xl">
      <EncabezadoPagina
        titulo="Nuevo control de TI"
        descripcion="El control entra en el cronograma desde el primer mes del ciclo, con la frecuencia elegida."
      />
      <FormularioControl
        personas={(personas ?? []) as { id: string; nombre_completo: string }[]}
        codigoSugerido={`CTI-${String(siguiente).padStart(2, "0")}`}
        responsableSugerido={usuario.id}
      />
    </div>
  );
}
