import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList, Plus } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import {
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaTitulo,
} from "@/components/ui/tarjeta";
import { obtenerPermisos, requerirModulo } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatearFecha, formatearFechaHora, hoyEnAsuncion } from "@/lib/formato";
import {
  ETIQUETAS_SISTEMA_AVANCE,
  ETIQUETAS_TIPO_AVANCE,
  esSistemaAvance,
  esTipoAvance,
} from "@/lib/avances-ti";
import {
  nombreDeCorreo,
  ticketAbierto,
  varianteEstadoTicket,
  variantePrioridad,
} from "@/lib/tickets-ti";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { numero: string } }): Metadata {
  return { title: decodeURIComponent(params.numero) };
}

interface Ticket {
  numero: string;
  fecha_solicitud: string | null;
  solicitante_correo: string | null;
  area: string | null;
  tipo_solicitud: string | null;
  categoria: string | null;
  prioridad: string | null;
  descripcion: string | null;
  adjunto: string | null;
  impacto: string | null;
  estado: string | null;
  responsable_correo: string | null;
  fecha_inicio: string | null;
  fecha_cierre: string | null;
  fecha_comprometida: string | null;
  observaciones: string | null;
  avance: number | null;
  actualizado_en: string;
}

interface Comentario {
  id: string;
  fecha: string | null;
  autor_correo: string | null;
  mensaje: string;
}

interface AvanceDelTicket {
  id: string;
  fecha: string;
  tipo: string;
  sistema: string;
  titulo: string;
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium text-atenuado-contraste">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

/**
 * Ficha de un ticket de TI: el pedido, lo que se hizo y los avances de
 * «Avances y cambios» que llevan su número.
 *
 * Las observaciones y el historial vienen de la ticketera tal como se
 * escribieron allá, con sus saltos de línea: son el registro de lo que
 * se hizo, y reescribirlos acá sería tener dos versiones.
 */
export default async function PaginaTicketTi({ params }: { params: { numero: string } }) {
  await requerirModulo("informatica");
  const permisos = await obtenerPermisos();
  const puedeEditar = permisos.informatica.editar;
  const numero = decodeURIComponent(params.numero);
  const supabase = crearClienteServidor();

  const [{ data: datosTicket }, { data: datosComentarios }, { data: datosAvances }] =
    await Promise.all([
      supabase
        .from("tickets_ti")
        .select(
          "numero, fecha_solicitud, solicitante_correo, area, tipo_solicitud, categoria, prioridad, " +
            "descripcion, adjunto, impacto, estado, responsable_correo, fecha_inicio, fecha_cierre, " +
            "fecha_comprometida, observaciones, avance, actualizado_en",
        )
        .eq("numero", numero)
        .maybeSingle(),
      supabase
        .from("ticket_ti_comentarios")
        .select("id, fecha, autor_correo, mensaje")
        .eq("numero_ticket", numero)
        .order("fecha", { ascending: true }),
      supabase
        .from("avances_ti")
        .select("id, fecha, tipo, sistema, titulo")
        .eq("ticket", numero)
        .order("fecha", { ascending: false }),
    ]);

  const ticket = datosTicket as unknown as Ticket | null;
  if (!ticket) notFound();

  const comentarios = (datosComentarios ?? []) as Comentario[];
  const avances = (datosAvances ?? []) as AvanceDelTicket[];
  const hoy = hoyEnAsuncion();
  const vencido =
    ticketAbierto(ticket.estado) &&
    Boolean(ticket.fecha_comprometida && ticket.fecha_comprometida < hoy);

  return (
    <div className="space-y-5">
      <Link
        href="/informatica/tickets"
        className="inline-flex items-center gap-1 text-xs text-atenuado-contraste hover:underline"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Volver al seguimiento
      </Link>

      <EncabezadoPagina
        titulo={`${ticket.numero} · ${ticket.tipo_solicitud ?? "Pedido a TI"}`}
        descripcion={[ticket.area, ticket.categoria].filter(Boolean).join(" · ") || undefined}
        acciones={
          <div className="flex flex-wrap items-center gap-2">
            {ticket.prioridad ? (
              <Insignia variante={variantePrioridad(ticket.prioridad)}>
                Prioridad {ticket.prioridad.toLowerCase()}
              </Insignia>
            ) : null}
            <Insignia variante={varianteEstadoTicket(ticket.estado)}>
              {ticket.estado ?? "Sin estado"}
            </Insignia>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo className="text-sm">El pedido</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              <p className="whitespace-pre-line text-sm">
                {ticket.descripcion ?? "Sin descripción."}
              </p>
              {ticket.adjunto && /^https:\/\//.test(ticket.adjunto) ? (
                <p className="mt-3 text-xs">
                  <a
                    href={ticket.adjunto}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primario hover:underline"
                  >
                    Ver el adjunto del pedido
                  </a>
                </p>
              ) : null}
            </TarjetaContenido>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo className="text-sm">Qué se hizo</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              {ticket.observaciones ? (
                <p className="whitespace-pre-line text-sm leading-relaxed">{ticket.observaciones}</p>
              ) : (
                <p className="text-sm text-atenuado-contraste">
                  La ticketera todavía no tiene observaciones de TI para este ticket.
                </p>
              )}
            </TarjetaContenido>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo className="text-sm">
                Historial de comentarios ({comentarios.length})
              </TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              {comentarios.length === 0 ? (
                <p className="text-sm text-atenuado-contraste">Sin comentarios en la ticketera.</p>
              ) : (
                <ol className="space-y-4 border-l border-borde pl-4">
                  {comentarios.map((comentario) => (
                    <li key={comentario.id} className="relative">
                      <span
                        aria-hidden
                        className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-primario"
                      />
                      <p className="text-[11px] text-atenuado-contraste">
                        {comentario.fecha ? formatearFechaHora(comentario.fecha) : "Sin fecha"} ·{" "}
                        {nombreDeCorreo(comentario.autor_correo)}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm">{comentario.mensaje}</p>
                    </li>
                  ))}
                </ol>
              )}
            </TarjetaContenido>
          </Tarjeta>
        </div>

        <div className="space-y-5">
          <Tarjeta>
            <TarjetaContenido className="pt-5">
              <dl className="grid grid-cols-2 gap-4">
                <Dato etiqueta="Pedido el">{formatearFecha(ticket.fecha_solicitud)}</Dato>
                <Dato etiqueta="Pedido por">{nombreDeCorreo(ticket.solicitante_correo)}</Dato>
                <Dato etiqueta="Responsable">{nombreDeCorreo(ticket.responsable_correo)}</Dato>
                <Dato etiqueta="Impacto">{ticket.impacto ?? "—"}</Dato>
                <Dato etiqueta="Inicio">{formatearFecha(ticket.fecha_inicio)}</Dato>
                <Dato etiqueta="Comprometido">
                  <span className={vencido ? "font-semibold text-semaforo-critico" : undefined}>
                    {ticket.fecha_comprometida ? formatearFecha(ticket.fecha_comprometida) : "—"}
                    {vencido ? " (vencido)" : ""}
                  </span>
                </Dato>
                <Dato etiqueta="Cierre">{formatearFecha(ticket.fecha_cierre)}</Dato>
                <Dato etiqueta="Avance">
                  {ticket.avance === null ? "—" : `${ticket.avance} %`}
                </Dato>
              </dl>
              {ticket.avance !== null ? (
                <div
                  className="mt-4 h-1.5 overflow-hidden rounded-full bg-atenuado"
                  role="progressbar"
                  aria-valuenow={ticket.avance}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Avance del ticket"
                >
                  <div className="h-full bg-primario" style={{ width: `${ticket.avance}%` }} />
                </div>
              ) : null}
              <p className="mt-4 text-[11px] text-atenuado-contraste">
                Último cambio en la ticketera: {formatearFechaHora(ticket.actualizado_en)}
              </p>
            </TarjetaContenido>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCabecera className="flex-row items-center justify-between gap-2">
              <TarjetaTitulo className="text-sm">Avances registrados</TarjetaTitulo>
              {puedeEditar ? (
                <Boton comoHijo variante="contorno" tamano="pequeno">
                  <Link href={`/informatica/avances/nuevo?ticket=${encodeURIComponent(ticket.numero)}`}>
                    <Plus aria-hidden />
                    Registrar
                  </Link>
                </Boton>
              ) : null}
            </TarjetaCabecera>
            <TarjetaContenido>
              {avances.length === 0 ? (
                <p className="text-xs text-atenuado-contraste">
                  No hay avances registrados con este ticket en «Avances y cambios».
                </p>
              ) : (
                <ul className="space-y-3">
                  {avances.map((avance) => (
                    <li key={avance.id} className="text-xs">
                      <Link
                        href={`/informatica/avances/${avance.id}`}
                        className="flex items-start gap-2 hover:underline"
                      >
                        <ClipboardList className="mt-0.5 size-3.5 shrink-0 text-primario" aria-hidden />
                        <span>
                          {avance.titulo}
                          <span className="block text-[11px] text-atenuado-contraste">
                            {formatearFecha(avance.fecha)} ·{" "}
                            {esTipoAvance(avance.tipo) ? ETIQUETAS_TIPO_AVANCE[avance.tipo] : avance.tipo}{" "}
                            ·{" "}
                            {esSistemaAvance(avance.sistema)
                              ? ETIQUETAS_SISTEMA_AVANCE[avance.sistema]
                              : avance.sistema}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </TarjetaContenido>
          </Tarjeta>
        </div>
      </div>
    </div>
  );
}
