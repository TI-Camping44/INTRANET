import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltrosListado } from "@/components/comunes/filtros-listado";
import { TarjetaIndicador } from "@/components/comunes/tarjeta-indicador";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia } from "@/components/ui/insignia";
import { Tarjeta } from "@/components/ui/tarjeta";
import { requerirModulo } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatearFecha, formatearFechaHora, hoyEnAsuncion } from "@/lib/formato";
import {
  ESTADOS_TICKET,
  coincideBusqueda,
  nombreDeCorreo,
  ticketAbierto,
  varianteEstadoTicket,
  variantePrioridad,
} from "@/lib/tickets-ti";
import { cn } from "@/lib/utilidades";

export const metadata: Metadata = { title: "Seguimiento de tickets de TI" };
export const dynamic = "force-dynamic";

interface FilaTicket {
  numero: string;
  fecha_solicitud: string | null;
  solicitante_correo: string | null;
  area: string | null;
  tipo_solicitud: string | null;
  categoria: string | null;
  prioridad: string | null;
  descripcion: string | null;
  estado: string | null;
  fecha_comprometida: string | null;
  fecha_cierre: string | null;
  avance: number | null;
}

/** «TI-0041» → 41, para ordenar por número y no alfabéticamente. */
function numeroDeOrden(numero: string): number {
  return Number.parseInt(numero.replace(/\D/g, ""), 10) || 0;
}

/**
 * Seguimiento de los tickets de TI.
 *
 * ES UN ESPEJO DE LA TICKETERA, NO OTRA TICKETERA. Los pedidos se siguen
 * haciendo por el formulario de siempre y el Responsable de TI trabaja en
 * la planilla «TICKETS - BASE»; un Apps Script de la planilla la manda a
 * la intranet cada hora. Por eso la pantalla no tiene «Nuevo» ni
 * «Editar»: dice de cuándo es la copia y lleva a la ficha, donde está
 * todo lo que se hizo en cada ticket.
 */
export default async function PaginaTicketsTi({
  searchParams,
}: {
  searchParams: { q?: string; situacion?: string; estado?: string; area?: string };
}) {
  await requerirModulo("informatica");
  const supabase = crearClienteServidor();

  const [{ data: datosTickets }, { data: datosSincronizacion }, { data: datosAvances }] =
    await Promise.all([
      supabase
        .from("tickets_ti")
        .select(
          "numero, fecha_solicitud, solicitante_correo, area, tipo_solicitud, categoria, " +
            "prioridad, descripcion, estado, fecha_comprometida, fecha_cierre, avance",
        ),
      supabase.from("ticketera_sincronizacion").select("actualizado_en").maybeSingle(),
      supabase.from("avances_ti").select("ticket").not("ticket", "is", null),
    ]);

  const todos = ((datosTickets ?? []) as unknown as FilaTicket[]).sort(
    (a, b) => numeroDeOrden(b.numero) - numeroDeOrden(a.numero),
  );
  const sincronizadoEn = (datosSincronizacion as { actualizado_en: string } | null)?.actualizado_en;

  // Cuántos avances de «Avances y cambios» llevan el número de cada
  // ticket: es lo que une lo pedido con lo que quedó hecho.
  const avancesPorTicket = new Map<string, number>();
  for (const fila of (datosAvances ?? []) as { ticket: string }[]) {
    avancesPorTicket.set(fila.ticket, (avancesPorTicket.get(fila.ticket) ?? 0) + 1);
  }

  const hoy = hoyEnAsuncion();
  const mesActual = hoy.slice(0, 7);
  const abiertos = todos.filter((ticket) => ticketAbierto(ticket.estado));
  const vencidos = abiertos.filter(
    (ticket) => ticket.fecha_comprometida && ticket.fecha_comprometida < hoy,
  );
  const enEspera = abiertos.filter((ticket) =>
    (ticket.estado ?? "").toLowerCase().startsWith("en espera"),
  );
  const cerradosDelMes = todos.filter(
    (ticket) => !ticketAbierto(ticket.estado) && ticket.fecha_cierre?.slice(0, 7) === mesActual,
  );

  const areas = Array.from(
    new Set(todos.map((ticket) => ticket.area).filter((area): area is string => Boolean(area))),
  ).sort((a, b) => a.localeCompare(b, "es"));

  const situacion = searchParams.situacion ?? "";
  const filtrados = todos.filter((ticket) => {
    if (situacion === "abiertos" && !ticketAbierto(ticket.estado)) return false;
    if (situacion === "terminados" && ticketAbierto(ticket.estado)) return false;
    if (
      situacion === "vencidos" &&
      !(ticketAbierto(ticket.estado) && ticket.fecha_comprometida && ticket.fecha_comprometida < hoy)
    ) {
      return false;
    }
    if (searchParams.estado && ticket.estado !== searchParams.estado) return false;
    if (searchParams.area && ticket.area !== searchParams.area) return false;
    if (searchParams.q) {
      return coincideBusqueda(
        [ticket.numero, ticket.descripcion, ticket.solicitante_correo, ticket.area, ticket.categoria],
        searchParams.q,
      );
    }
    return true;
  });

  return (
    <div className="space-y-5">
      <EncabezadoPagina
        titulo="Seguimiento de tickets de TI"
        descripcion={
          "Los pedidos al área de TI y lo que se hizo en cada uno. Es una copia de la " +
          "ticketera de TI: los pedidos se siguen haciendo por el formulario de siempre."
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaIndicador
          titulo="Abiertos"
          valor={abiertos.length}
          contexto={`De ${todos.length} tickets en total`}
        />
        <TarjetaIndicador
          titulo="Fecha comprometida vencida"
          valor={vencidos.length}
          tono={vencidos.length > 0 ? "peligro" : "exito"}
          contexto={vencidos.length > 0 ? "Abiertos con el compromiso pasado" : "Nada atrasado"}
        />
        <TarjetaIndicador
          titulo="En espera del usuario"
          valor={enEspera.length}
          tono={enEspera.length > 0 ? "advertencia" : "neutro"}
          contexto="Dependen de quien pidió"
        />
        <TarjetaIndicador
          titulo="Cerrados este mes"
          valor={cerradosDelMes.length}
          tono={cerradosDelMes.length > 0 ? "exito" : "neutro"}
          contexto="Resueltos, cerrados o rechazados"
        />
      </div>

      <p className="text-xs text-atenuado-contraste">
        {sincronizadoEn
          ? `Copia de la ticketera al ${formatearFechaHora(sincronizadoEn)}. Se actualiza sola cada hora.`
          : "Todavía no llegó ninguna copia de la ticketera."}
      </p>

      <FiltrosListado
        marcadorBusqueda="Buscar por número, pedido, área o solicitante…"
        campos={[
          {
            nombre: "situacion",
            etiqueta: "Situación",
            opciones: [
              { valor: "abiertos", etiqueta: "Abiertos" },
              { valor: "vencidos", etiqueta: "Con la fecha comprometida vencida" },
              { valor: "terminados", etiqueta: "Resueltos, cerrados o rechazados" },
            ],
          },
          {
            nombre: "estado",
            etiqueta: "Estado",
            opciones: ESTADOS_TICKET.map((estado) => ({ valor: estado, etiqueta: estado })),
          },
          {
            nombre: "area",
            etiqueta: "Área",
            opciones: areas.map((area) => ({ valor: area, etiqueta: area })),
          },
        ]}
      />

      <Tarjeta className="p-0">
        {filtrados.length === 0 ? (
          <EstadoVacio
            icono={<ListChecks className="size-6" aria-hidden />}
            titulo={todos.length === 0 ? "Todavía no hay tickets" : "Ningún ticket con esos filtros"}
            descripcion={
              todos.length === 0
                ? "Los tickets aparecen cuando la ticketera manda su primera copia."
                : "Pruebe con otros filtros o limpie la búsqueda."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-borde bg-atenuado/50 text-left">
                  <th scope="col" className="px-3 py-2 font-semibold">Ticket</th>
                  <th scope="col" className="hidden px-3 py-2 font-semibold md:table-cell">Fecha</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Pedido</th>
                  <th scope="col" className="hidden px-3 py-2 font-semibold lg:table-cell">Área</th>
                  <th scope="col" className="hidden px-3 py-2 font-semibold lg:table-cell">Prioridad</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Estado</th>
                  <th scope="col" className="hidden px-3 py-2 text-right font-semibold md:table-cell">Avance</th>
                  <th scope="col" className="hidden px-3 py-2 font-semibold md:table-cell">Comprometido</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((ticket) => {
                  const vencido =
                    ticketAbierto(ticket.estado) &&
                    Boolean(ticket.fecha_comprometida && ticket.fecha_comprometida < hoy);
                  const avances = avancesPorTicket.get(ticket.numero) ?? 0;
                  return (
                    <tr key={ticket.numero} className="border-b border-borde align-top last:border-b-0">
                      <td className="whitespace-nowrap px-3 py-2">
                        <Link
                          href={`/informatica/tickets/${encodeURIComponent(ticket.numero)}`}
                          className="tabular font-semibold hover:underline"
                        >
                          {ticket.numero}
                        </Link>
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-2 text-atenuado-contraste md:table-cell">
                        {formatearFecha(ticket.fecha_solicitud)}
                      </td>
                      <td className="min-w-[16rem] px-3 py-2">
                        <Link
                          href={`/informatica/tickets/${encodeURIComponent(ticket.numero)}`}
                          className="line-clamp-2 hover:underline"
                        >
                          {ticket.descripcion ?? "Sin descripción"}
                        </Link>
                        <span className="mt-0.5 block text-[11px] text-atenuado-contraste">
                          {nombreDeCorreo(ticket.solicitante_correo)}
                          <span className="lg:hidden">{ticket.area ? ` · ${ticket.area}` : ""}</span>
                          {avances > 0
                            ? ` · ${avances} ${avances === 1 ? "avance registrado" : "avances registrados"}`
                            : ""}
                        </span>
                      </td>
                      <td className="hidden px-3 py-2 lg:table-cell">{ticket.area ?? "—"}</td>
                      <td className="hidden px-3 py-2 lg:table-cell">
                        {ticket.prioridad ? (
                          <Insignia variante={variantePrioridad(ticket.prioridad)}>
                            {ticket.prioridad}
                          </Insignia>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Insignia variante={varianteEstadoTicket(ticket.estado)}>
                          {ticket.estado ?? "Sin estado"}
                        </Insignia>
                      </td>
                      <td className="tabular hidden px-3 py-2 text-right md:table-cell">
                        {ticket.avance === null ? "—" : `${ticket.avance} %`}
                      </td>
                      <td
                        className={cn(
                          "hidden whitespace-nowrap px-3 py-2 md:table-cell",
                          vencido ? "font-semibold text-semaforo-critico" : "text-atenuado-contraste",
                        )}
                      >
                        {ticket.fecha_comprometida ? formatearFecha(ticket.fecha_comprometida) : "—"}
                        {vencido ? <span className="sr-only"> (vencida)</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>

      <p className="text-xs text-atenuado-contraste">
        {filtrados.length === todos.length
          ? `${todos.length} tickets.`
          : `${filtrados.length} de ${todos.length} tickets.`}
      </p>
    </div>
  );
}
