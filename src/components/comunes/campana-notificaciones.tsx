"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import {
  Menu,
  MenuContenido,
  MenuDisparador,
  MenuSeparador,
} from "@/components/ui/menu";
import { formatearFechaHora } from "@/lib/formato";
import { marcarNotificacionLeida, marcarTodasLeidas } from "@/app/(sgc)/acciones-notificaciones";
import type { Notificacion } from "@/lib/tipos";

export function CampanaNotificaciones({
  notificaciones,
  sinLeer,
}: {
  notificaciones: Notificacion[];
  sinLeer: number;
}) {
  const router = useRouter();
  const [enProceso, definirEnProceso] = React.useTransition();

  function abrir(notificacion: Notificacion) {
    definirEnProceso(async () => {
      if (!notificacion.leida) await marcarNotificacionLeida(notificacion.id);
      if (notificacion.enlace) router.push(notificacion.enlace);
      router.refresh();
    });
  }

  return (
    <Menu>
      <MenuDisparador asChild>
        <Boton
          variante="fantasma"
          tamano="icono"
          className="relative"
          aria-label={
            sinLeer > 0 ? `Notificaciones: ${sinLeer} sin leer` : "Notificaciones"
          }
        >
          <Bell />
          {sinLeer > 0 ? (
            <span
              className="absolute right-1 top-1 flex size-4 items-center justify-center
                         rounded-full bg-primario text-[9px] font-bold text-primario-contraste"
            >
              {sinLeer > 9 ? "9+" : sinLeer}
            </span>
          ) : null}
        </Boton>
      </MenuDisparador>

      <MenuContenido align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs font-semibold">Notificaciones</span>
          {sinLeer > 0 ? (
            <button
              type="button"
              disabled={enProceso}
              onClick={() =>
                definirEnProceso(async () => {
                  await marcarTodasLeidas();
                  router.refresh();
                })
              }
              className="flex items-center gap-1 text-[11px] text-primario hover:underline
                         disabled:opacity-50"
            >
              <CheckCheck className="size-3" /> Marcar todas
            </button>
          ) : null}
        </div>
        <MenuSeparador className="m-0" />

        <div className="max-h-[24rem] overflow-y-auto">
          {notificaciones.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-atenuado-contraste">
              No hay notificaciones.
            </p>
          ) : (
            notificaciones.map((notificacion) => (
              <button
                key={notificacion.id}
                type="button"
                onClick={() => abrir(notificacion)}
                className="flex w-full flex-col items-start gap-0.5 border-b border-borde px-3
                           py-2.5 text-left transition-colors last:border-0 hover:bg-acento"
              >
                <div className="flex w-full items-start gap-2">
                  {!notificacion.leida ? (
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primario" />
                  ) : (
                    <span className="mt-1.5 size-1.5 shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="text-xs font-medium leading-snug">{notificacion.titulo}</p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-atenuado-contraste">
                      {notificacion.mensaje}
                    </p>
                    <p className="mt-1 text-[10px] text-atenuado-contraste">
                      {formatearFechaHora(notificacion.creado_en)}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        <MenuSeparador className="m-0" />
        <Link
          href="/notificaciones"
          className="block px-3 py-2 text-center text-xs text-primario hover:underline"
        >
          Ver todas las notificaciones
        </Link>
      </MenuContenido>
    </Menu>
  );
}
