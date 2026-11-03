import { Cake, PartyPopper } from "lucide-react";

import { Avatar, AvatarImagen, AvatarRespaldo } from "@/components/ui/avatar";
import {
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaTitulo,
} from "@/components/ui/tarjeta";
import { iniciales } from "@/lib/utilidades";
import {
  cuandoEs,
  mesCorto,
  motivoEnPalabras,
  type EfemerideProxima,
} from "@/lib/efemerides";

/**
 * Los cumpleaños y aniversarios que vienen.
 *
 * VA A LA DERECHA EN PANTALLA GRANDE Y ARRIBA EN EL CELULAR, y las dos
 * cosas a la vez. Estaba a la derecha y en el celular caía debajo de
 * todas las publicaciones: para ver quién cumple había que bajar el muro
 * entero. Se probó subirla a una franja arriba y eso arreglaba el
 * celular pero dejaba vacío el tercio derecho de la pantalla grande. La
 * tarjeta va PRIMERA EN EL HTML —por eso en el celular, que es una sola
 * columna, aparece arriba— y en `lg` el `order` la manda a la derecha.
 *
 * EL RECUADRO CON EL DIA ES LO QUE LA HACE LEGIBLE DE UN VISTAZO. Era
 * una lista de tres renglones grises iguales, donde la fecha venía
 * escrita adentro del texto: había que leer la frase entera para saber
 * cuándo era cada cosa. Con el día y el mes en un recuadro a la derecha,
 * la columna de fechas se escanea sola y el nombre queda como lo
 * primero que se lee. Además devuelve el día del mes, que es el dato que
 * sirve para agendar y que se había perdido al pasar todo a «en N días».
 *
 * HOY SE VE DISTINTO SIN GRITAR: el recuadro pasa a relleno y el renglón
 * toma un fondo apenas teñido. Es la única fila que pide hacer algo
 * —saludar—; el resto es contexto.
 *
 * SIN NADIE EN LA VENTANA NO SE DIBUJA: una tarjeta vacía ocupa lugar
 * para decir que no hay nada.
 */
export function TarjetaEfemerides({ proximas }: { proximas: EfemerideProxima[] }) {
  if (proximas.length === 0) return null;

  return (
    <Tarjeta>
      <TarjetaCabecera>
        <TarjetaTitulo className="flex items-center gap-2">
          <Cake className="size-4 text-primario" aria-hidden="true" />
          Cumpleaños y aniversarios
        </TarjetaTitulo>
      </TarjetaCabecera>

      <TarjetaContenido className="px-2 pb-2">
        <ul className="space-y-0.5">
          {proximas.map((efemeride) => {
            const esHoy = efemeride.faltan === 0;

            return (
              <li
                key={`${efemeride.id}-${efemeride.motivo}`}
                className={`flex items-center gap-3 rounded-lg px-2 py-2 transition-colors ${
                  esHoy ? "bg-primario/5" : "hover:bg-atenuado/50"
                }`}
              >
                <Avatar
                  className={`size-10 shrink-0 ${
                    esHoy ? "ring-2 ring-primario ring-offset-2 ring-offset-tarjeta" : ""
                  }`}
                >
                  {efemeride.url_avatar ? (
                    <AvatarImagen
                      src={efemeride.url_avatar}
                      alt={efemeride.nombre_completo}
                    />
                  ) : null}
                  <AvatarRespaldo className="text-[11px]">
                    {iniciales(efemeride.nombre_completo)}
                  </AvatarRespaldo>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold leading-tight">
                    {efemeride.nombre_completo}
                  </p>
                  <p
                    className={`mt-1 flex items-center gap-1 text-[11px] leading-tight ${
                      esHoy ? "font-medium text-primario" : "text-atenuado-contraste"
                    }`}
                  >
                    {efemeride.motivo === "cumpleanos" ? (
                      <Cake className="size-3 shrink-0" aria-hidden="true" />
                    ) : (
                      <PartyPopper className="size-3 shrink-0" aria-hidden="true" />
                    )}
                    <span className="truncate">
                      {motivoEnPalabras(efemeride)}
                      {esHoy ? "" : ` · ${cuandoEs(efemeride.faltan)}`}
                    </span>
                  </p>
                </div>

                {/* EL DIA Y EL MES, no «en N días»: es lo que sirve para
                    agendar. El «en N días» queda en el renglón de abajo,
                    que es donde se lee después. */}
                <div
                  className={`flex w-11 shrink-0 flex-col items-center justify-center rounded-md border py-1 ${
                    esHoy
                      ? "border-primario bg-primario text-primario-contraste"
                      : "border-borde text-texto"
                  }`}
                >
                  <span className="text-sm font-semibold leading-none tabular">
                    {efemeride.dia}
                  </span>
                  <span
                    className={`mt-0.5 text-[9px] font-medium uppercase leading-none tracking-wide ${
                      esHoy ? "" : "text-atenuado-contraste"
                    }`}
                  >
                    {mesCorto(efemeride.mes)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </TarjetaContenido>
    </Tarjeta>
  );
}
