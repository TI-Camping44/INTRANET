import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FormularioAvance } from "@/app/(sgc)/informatica/avances/formulario-avance";
import { requerirModuloEditable } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { hoyEnAsuncion } from "@/lib/formato";
import type { EmpresaDelGrupo } from "@/lib/empresas";
import { PATRON_TICKET, normalizarTicket } from "@/lib/avances-ti";

export const metadata: Metadata = { title: "Registrar avance de TI" };
export const dynamic = "force-dynamic";

/**
 * Alta de un avance o cambio de TI. La fecha arranca en hoy. Cuando se
 * llega desde la ficha de un ticket (`?ticket=TI-0041`), el ticket viene
 * puesto.
 */
export default async function PaginaNuevoAvance({
  searchParams,
}: {
  searchParams: { ticket?: string };
}) {
  await requerirModuloEditable("informatica");
  const supabase = crearClienteServidor();

  // Las dos del grupo por `empresas_del_grupo()`: un select a `empresas`
  // devolvería solo la propia y el desplegable no ofrecería Vitalica.
  const { data } = await supabase.rpc("empresas_del_grupo");
  const ticket = normalizarTicket(searchParams.ticket ?? "");

  return (
    <div className="mx-auto max-w-3xl">
      <EncabezadoPagina
        titulo="Registrar avance de TI"
        descripcion="Lo que quedó hecho en un sistema: qué se cambió, dónde, para qué empresa y con qué ticket."
      />
      <FormularioAvance
        empresas={(data as EmpresaDelGrupo[] | null) ?? []}
        hoy={hoyEnAsuncion()}
        ticketSugerido={ticket && PATRON_TICKET.test(ticket) ? ticket : undefined}
      />
    </div>
  );
}
