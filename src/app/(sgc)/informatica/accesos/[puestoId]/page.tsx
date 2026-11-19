import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { Insignia } from "@/components/ui/insignia";
import {
  FormularioAccesos,
  type AccesosIniciales,
} from "@/app/(sgc)/informatica/accesos/[puestoId]/formulario-accesos";
import { requerirModuloEditable } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatearFecha } from "@/lib/formato";

export const metadata: Metadata = { title: "Accesos del puesto" };
export const dynamic = "force-dynamic";

export default async function PaginaAccesosDelPuesto({
  params,
}: {
  params: { puestoId: string };
}) {
  await requerirModuloEditable("informatica");
  const supabase = crearClienteServidor();

  const [{ data: puesto }, { data: accesos }] = await Promise.all([
    supabase
      .from("puestos")
      .select("id, nombre, departamento, area")
      .eq("id", params.puestoId)
      .maybeSingle(),
    supabase.from("accesos_por_puesto").select("*").eq("puesto_id", params.puestoId).maybeSingle(),
  ]);

  if (!puesto) notFound();
  const datosPuesto = puesto as { id: string; nombre: string; departamento: string | null; area: string | null };
  const inicial = accesos as (AccesosIniciales & { validado_en: string | null }) | null;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link
        href="/informatica/accesos"
        className="inline-flex items-center gap-1 text-xs text-atenuado-contraste hover:text-texto"
      >
        <ArrowLeft className="size-3" aria-hidden /> Accesos por puesto
      </Link>
      <EncabezadoPagina
        titulo={datosPuesto.nombre}
        descripcion={datosPuesto.departamento ?? datosPuesto.area ?? undefined}
        acciones={
          inicial ? (
            <Insignia variante={inicial.estado === "validada" ? "exito" : "advertencia"}>
              {inicial.estado === "validada"
                ? `Validada el ${formatearFecha(inicial.validado_en)}`
                : "Propuesta"}
            </Insignia>
          ) : (
            <Insignia variante="neutra">Sin definir</Insignia>
          )
        }
      />
      <FormularioAccesos puestoId={datosPuesto.id} inicial={inicial} />
    </div>
  );
}
