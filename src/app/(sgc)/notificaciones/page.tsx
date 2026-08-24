import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia } from "@/components/ui/insignia";
import { Tarjeta } from "@/components/ui/tarjeta";
import { BotonMarcarTodas } from "@/app/(sgc)/notificaciones/boton-marcar-todas";
import { requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatearFechaHora } from "@/lib/formato";
import { humanizar } from "@/lib/utilidades";
import type { Notificacion } from "@/lib/tipos";

export const metadata: Metadata = { title: "Notificaciones" };
export const dynamic = "force-dynamic";

export default async function PaginaNotificaciones() {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data } = await supabase
    .from("notificaciones")
    .select("*")
    .eq("usuario_id", usuario.id)
    .order("creado_en", { ascending: false })
    .limit(100);

  const notificaciones = (data as Notificacion[] | null) ?? [];
  const sinLeer = notificaciones.filter((notificacion) => !notificacion.leida).length;

  return (
    <div className="mx-auto max-w-3xl">
      <EncabezadoPagina
        titulo="Centro de notificaciones"
        descripcion={
          sinLeer > 0
            ? `${sinLeer} notificación${sinLeer === 1 ? "" : "es"} sin leer.`
            : "No tiene notificaciones pendientes."
        }
        acciones={sinLeer > 0 ? <BotonMarcarTodas /> : null}
      />

      {notificaciones.length === 0 ? (
        <EstadoVacio
          icono={<Bell className="size-6" />}
          titulo="Sin notificaciones"
          descripcion="Aquí llegan los avisos de documentos publicados, acciones asignadas, vencimientos y escalamientos."
        />
      ) : (
        <Tarjeta className="divide-y divide-borde">
          {notificaciones.map((notificacion) => {
            const contenido = (
              <div className="flex items-start gap-3 p-3">
                <span
                  className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                    notificacion.leida ? "bg-transparent" : "bg-primario"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">{notificacion.titulo}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-atenuado-contraste">
                    {notificacion.mensaje}
                  </p>
                  <p className="mt-1 text-[10px] text-atenuado-contraste">
                    {formatearFechaHora(notificacion.creado_en)}
                  </p>
                </div>
                <Insignia variante="contorno">{humanizar(notificacion.tipo)}</Insignia>
              </div>
            );

            return notificacion.enlace ? (
              <Link
                key={notificacion.id}
                href={notificacion.enlace}
                className="block transition-colors hover:bg-acento/50"
              >
                {contenido}
              </Link>
            ) : (
              <div key={notificacion.id}>{contenido}</div>
            );
          })}
        </Tarjeta>
      )}
    </div>
  );
}
