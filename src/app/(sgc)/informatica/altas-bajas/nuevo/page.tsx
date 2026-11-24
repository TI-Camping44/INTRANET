import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import {
  FormularioMovimiento,
  type PersonaDelDirectorio,
  type PuestoOpcion,
} from "@/app/(sgc)/informatica/altas-bajas/formulario-movimiento";
import { requerirModuloEditable } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { hoyEnAsuncion } from "@/lib/formato";
import { PATRON_TICKET, normalizarTicket } from "@/lib/avances-ti";
import type { EmpresaDelGrupo } from "@/lib/empresas";

export const metadata: Metadata = { title: "Registrar alta o baja" };
export const dynamic = "force-dynamic";

/**
 * Alta de un ingreso o una desvinculación. Desde la ficha de un ticket
 * se llega con `?ticket=TI-0140&tipo=alta`.
 */
export default async function PaginaNuevoMovimiento({
  searchParams,
}: {
  searchParams: { ticket?: string; tipo?: string };
}) {
  await requerirModuloEditable("informatica");
  const supabase = crearClienteServidor();

  const [{ data: personas }, { data: puestos }, { data: matriz }, { data: empresas }] =
    await Promise.all([
      supabase
        .from("vista_directorio")
        .select("clave, nombre_completo, correo, puesto_id, empresa_del_puesto")
        .order("nombre_completo"),
      supabase.from("puestos").select("id, nombre").eq("activo", true).order("nombre"),
      supabase.from("accesos_por_puesto").select("puesto_id"),
      supabase.rpc("empresas_del_grupo"),
    ]);

  const conMatriz = new Set(((matriz ?? []) as { puesto_id: string }[]).map((f) => f.puesto_id));
  const ticket = normalizarTicket(searchParams.ticket ?? "");

  return (
    <div className="mx-auto max-w-3xl">
      <EncabezadoPagina
        titulo="Registrar alta o baja"
        descripcion="Los pasos de cada sistema salen de la matriz de accesos del puesto."
      />
      <FormularioMovimiento
        personas={(personas ?? []) as PersonaDelDirectorio[]}
        puestos={((puestos ?? []) as { id: string; nombre: string }[]).map((puesto) => ({
          ...puesto,
          tieneMatriz: conMatriz.has(puesto.id),
        })) as PuestoOpcion[]}
        empresas={(empresas as EmpresaDelGrupo[] | null) ?? []}
        hoy={hoyEnAsuncion()}
        inicial={{
          tipo: searchParams.tipo === "baja" ? "baja" : "alta",
          ticket: ticket && PATRON_TICKET.test(ticket) ? ticket : undefined,
        }}
      />
    </div>
  );
}
