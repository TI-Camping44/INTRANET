import { Cake, PartyPopper } from "lucide-react";

import { Avatar, AvatarImagen, AvatarRespaldo } from "@/components/ui/avatar";
import {
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaTitulo,
} from "@/components/ui/tarjeta";
import { iniciales } from "@/lib/utilidades";
import { cuandoEs, motivoEnPalabras, type EfemerideProxima } from "@/lib/efemerides";

/**
 * Los cumpleaños y aniversarios que vienen.
 *
 * VA A LA DERECHA EN PANTALLA GRANDE Y ARRIBA EN EL CELULAR, y las dos
 * cosas a la vez. Estaba a la derecha y en el celular caía debajo de
 * todas las publicaciones: para ver quién cumple había que bajar el muro
 * entero. El 3 de noviembre se la subió a una franja arriba, y eso
 * arreglaba el celular pero dejaba vacío el tercio derecho de la
 * pantalla grande, que es justamente donde sobraba lugar. La tarjeta va
 * PRIMERO EN EL HTML —por eso en el celular, que es una sola columna,
 * aparece arriba— y en `lg` el `order` la manda a la columna derecha.
 * Un solo bloque, sin repetirlo ni esconder una copia con CSS.
 *
 * HOY VA APARTE Y EN COLOR. Es la única fila que pide hacer algo
 * —saludar— y antes se leía igual que una de dentro de dos semanas.
 *
 * SIN NADIE EN LA VENTANA NO SE DIBUJA: una tarjeta vacía ocupa lugar
 * para decir que no hay nada.
 */
export function TarjetaEfemerides({ proximas }: { proximas: EfemerideProxima[] }) {
  if (proximas.length === 0) return null;

  return (
    <Tarjeta>
      <TarjetaCabecera>
        <TarjetaTitulo>Cumpleaños y aniversarios</TarjetaTitulo>
      </TarjetaCabecera>
      <TarjetaContenido>
        <ul className="space-y-3">
          {proximas.map((efemeride) => {
            const esHoy = efemeride.faltan === 0;

            return (
              <li
                key={`${efemeride.id}-${efemeride.motivo}`}
                className="flex items-center gap-2.5"
              >
                <Avatar
                  className={`size-8 shrink-0 ${esHoy ? "ring-2 ring-primario" : ""}`}
                >
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

                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-xs ${
                      esHoy ? "font-semibold" : "font-medium"
                    }`}
                  >
                    {efemeride.nombre_completo}
                  </p>
                  <p
                    className={`flex items-center gap-1 text-[11px] ${
                      esHoy ? "font-medium text-primario" : "text-atenuado-contraste"
                    }`}
                  >
                    {efemeride.motivo === "cumpleanos" ? (
                      <Cake className="size-3 shrink-0" />
                    ) : (
                      <PartyPopper className="size-3 shrink-0" />
                    )}
                    <span className="truncate">
                      {motivoEnPalabras(efemeride)} {cuandoEs(efemeride.faltan)}
                    </span>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </TarjetaContenido>
    </Tarjeta>
  );
}
