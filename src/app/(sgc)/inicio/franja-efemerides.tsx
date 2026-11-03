import { Cake, PartyPopper } from "lucide-react";

import { Avatar, AvatarImagen, AvatarRespaldo } from "@/components/ui/avatar";
import { Tarjeta } from "@/components/ui/tarjeta";
import { iniciales } from "@/lib/utilidades";
import { cuandoEs, motivoEnPalabras, type EfemerideProxima } from "@/lib/efemerides";

/**
 * Los cumpleaños y aniversarios, arriba del muro.
 *
 * ESTABA EN LA COLUMNA DE LA DERECHA Y EN EL CELULAR NO LA VEIA NADIE:
 * la grilla era de tres columnas con el muro ocupando dos, así que en
 * pantalla chica la tarjeta caía debajo de todas las publicaciones. Para
 * ver quién cumple había que bajar el muro entero, que es justo lo
 * contrario de lo que sirve. Arriba y en una franja se ve primero, y
 * ocupa poco alto en cualquier ancho.
 *
 * HOY VA APARTE Y EN COLOR. Es la única fila que pide hacer algo
 * —saludar— y antes se leía igual que una de dentro de dos semanas. El
 * resto va en gris con «en N días»: la fecha exacta importa menos que
 * cuánto falta.
 *
 * SIN NADIE EN LA VENTANA NO SE DIBUJA. Una franja vacía arriba de todo
 * es peor que no tener franja: ocupa el mejor lugar de la pantalla para
 * decir que no hay nada.
 */
export function FranjaEfemerides({ proximas }: { proximas: EfemerideProxima[] }) {
  if (proximas.length === 0) return null;

  const hoy = proximas.filter((efemeride) => efemeride.faltan === 0);
  const siguen = proximas.filter((efemeride) => efemeride.faltan > 0);

  return (
    <Tarjeta className="mb-4 p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        {hoy.length > 0 ? (
          <div className="shrink-0 lg:max-w-[22rem]">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-primario">
              Hoy
            </p>
            <ul className="flex flex-wrap gap-x-4 gap-y-2">
              {hoy.map((efemeride) => (
                <li
                  key={`${efemeride.id}-${efemeride.motivo}`}
                  className="flex items-center gap-2"
                >
                  <Avatar className="size-9 shrink-0 ring-2 ring-primario">
                    {efemeride.url_avatar ? (
                      <AvatarImagen
                        src={efemeride.url_avatar}
                        alt={efemeride.nombre_completo}
                      />
                    ) : null}
                    <AvatarRespaldo className="text-[10px]">
                      {iniciales(efemeride.nombre_completo)}
                    </AvatarRespaldo>
                  </Avatar>

                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">
                      {efemeride.nombre_completo}
                    </p>
                    <p className="flex items-center gap-1 text-[11px] font-medium text-primario">
                      {efemeride.motivo === "cumpleanos" ? (
                        <Cake className="size-3 shrink-0" />
                      ) : (
                        <PartyPopper className="size-3 shrink-0" />
                      )}
                      {motivoEnPalabras(efemeride)} hoy
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* La separación vertical solo cuando hay las dos columnas. */}
        {hoy.length > 0 && siguen.length > 0 ? (
          <div className="hidden w-px shrink-0 bg-borde lg:block" aria-hidden="true" />
        ) : null}

        {siguen.length > 0 ? (
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-atenuado-contraste">
              {hoy.length > 0 ? "Próximos" : "Próximos cumpleaños y aniversarios"}
            </p>

            {/* LA FILA SE DESPLAZA POR DENTRO, no la página: es la misma
                regla que las tablas anchas del resto del sistema. */}
            <ul className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-1">
              {siguen.map((efemeride) => (
                <li
                  key={`${efemeride.id}-${efemeride.motivo}`}
                  className="flex min-w-0 shrink-0 items-center gap-2"
                >
                  <Avatar className="size-8 shrink-0">
                    {efemeride.url_avatar ? (
                      <AvatarImagen
                        src={efemeride.url_avatar}
                        alt={efemeride.nombre_completo}
                      />
                    ) : null}
                    <AvatarRespaldo className="text-[10px]">
                      {iniciales(efemeride.nombre_completo)}
                    </AvatarRespaldo>
                  </Avatar>

                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">
                      {efemeride.nombre_completo}
                    </p>
                    <p className="flex items-center gap-1 whitespace-nowrap text-[11px] text-atenuado-contraste">
                      {efemeride.motivo === "cumpleanos" ? (
                        <Cake className="size-3 shrink-0" />
                      ) : (
                        <PartyPopper className="size-3 shrink-0" />
                      )}
                      {motivoEnPalabras(efemeride)} {cuandoEs(efemeride.faltan)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Tarjeta>
  );
}
