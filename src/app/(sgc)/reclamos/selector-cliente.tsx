"use client";

import * as React from "react";
import { Loader2, Search, X } from "lucide-react";

import { Entrada } from "@/components/ui/campo";
import { buscarClientes } from "@/app/(sgc)/reclamos/acciones";

export interface ClienteBuscable {
  id: string;
  razon_social: string;
  /** RUC de la empresa o cédula del consumidor final. */
  ruc: string | null;
}

/** Cuánto se espera antes de consultar, para no pedir en cada tecla. */
const ESPERA_ANTES_DE_BUSCAR = 250;

/**
 * Elige el cliente escribiendo, no desplegando.
 *
 * ERA UN `<select>` Y NO SERVÍA. Con la cartera entera adentro —8.551
 * contactos— encontrar a alguien es bajar por una lista interminable:
 * nadie lo hace, y por eso el formulario tenía al lado un campo para
 * escribir el nombre a mano. Dos lugares para lo mismo, y el de la
 * derecha ganaba siempre, así que el reclamo quedaba sin cliente
 * identificado; sin cliente no hay forma de detectar la reincidencia,
 * que es lo que sube el plan de nivel.
 *
 * LA BÚSQUEDA VA AL SERVIDOR. Mandar los 8.551 al navegador para
 * filtrarlos con JavaScript es casi un mega de JSON cada vez que se abre
 * el formulario, y esto se usa desde el celular en piso de venta.
 *
 * SE BUSCA POR NOMBRE Y POR RUC O CÉDULA, sin tildes y por partes:
 * «carlos lopez» encuentra «LÓPEZ, Carlos Alberto». En el mostrador el
 * dato que se tiene a mano es el documento, no la razón social como la
 * escribió Odoo: quien atiende tiene la factura adelante.
 */
export function SelectorCliente({
  inicial,
}: {
  /** El cliente que ya tenía el reclamo, al editar. */
  inicial?: ClienteBuscable | null;
}) {
  const [elegido, definirElegido] = React.useState<ClienteBuscable | null>(inicial ?? null);
  const [texto, definirTexto] = React.useState("");
  const [abierto, definirAbierto] = React.useState(false);
  const [buscando, definirBuscando] = React.useState(false);
  const [sugerencias, definirSugerencias] = React.useState<ClienteBuscable[]>([]);

  const contenedor = React.useRef<HTMLDivElement>(null);

  // SE CIERRA AL TOCAR AFUERA. Sin esto la lista queda tapando los
  // campos de abajo y en el celular no hay forma de sacarla.
  //
  // Va en `mousedown` del documento y no en el `blur` del campo: `blur`
  // dispara antes que el click de la opción, así que cerrar ahí
  // desmontaría el botón antes de que llegue a elegirse.
  React.useEffect(() => {
    if (!abierto) return;

    function alTocar(evento: MouseEvent) {
      if (!contenedor.current?.contains(evento.target as Node)) definirAbierto(false);
    }

    document.addEventListener("mousedown", alTocar);
    return () => document.removeEventListener("mousedown", alTocar);
  }, [abierto]);

  // SE ESPERA ANTES DE CONSULTAR. Sin esto cada tecla es una consulta, y
  // las respuestas pueden llegar desordenadas: la de «car» después de la
  // de «carlos», dejando en pantalla el resultado de lo que ya no está
  // escrito. El `vigente` descarta la respuesta que llega tarde.
  React.useEffect(() => {
    if (!abierto || elegido) return;

    let vigente = true;
    definirBuscando(true);

    const reloj = setTimeout(() => {
      buscarClientes(texto)
        .then((encontrados) => {
          if (!vigente) return;
          definirSugerencias(encontrados);
        })
        .finally(() => {
          if (vigente) definirBuscando(false);
        });
    }, ESPERA_ANTES_DE_BUSCAR);

    return () => {
      vigente = false;
      clearTimeout(reloj);
    };
  }, [abierto, elegido, texto]);

  return (
    <div className="relative" ref={contenedor}>
      {/* El id y el nombre viajan juntos: el nombre queda escrito en el
          reclamo tal como estaba el día que se registró, aunque después
          el cliente se renombre en Odoo. */}
      <input type="hidden" name="cliente_id" value={elegido?.id ?? ""} />
      <input type="hidden" name="cliente_nombre" value={elegido?.razon_social ?? ""} />

      {elegido ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-borde bg-acento/40 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{elegido.razon_social}</p>
            {elegido.ruc ? (
              <p className="truncate text-[11px] tabular text-atenuado-contraste">{elegido.ruc}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              definirElegido(null);
              definirTexto("");
              definirSugerencias([]);
            }}
            className="shrink-0 rounded p-1 text-atenuado-contraste hover:text-primario"
            aria-label="Elegir otro cliente"
            title="Elegir otro cliente"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-atenuado-contraste" />
            <Entrada
              id="buscar-cliente"
              value={texto}
              onChange={(evento) => {
                definirTexto(evento.target.value);
                definirAbierto(true);
              }}
              onFocus={() => definirAbierto(true)}
              placeholder="Nombre, RUC o cédula"
              className="pl-8 pr-8"
              autoComplete="off"
            />
            {buscando ? (
              <Loader2 className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-atenuado-contraste" />
            ) : null}
          </div>

          {abierto ? (
            <ul
              className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border
                         border-borde bg-emergente p-1 shadow-md"
            >
              {sugerencias.length === 0 ? (
                <li className="px-2 py-3 text-[11px] text-atenuado-contraste">
                  {buscando
                    ? "Buscando…"
                    : texto.trim() === ""
                      ? "Escriba el nombre, el RUC o la cédula."
                      : "Ningún cliente coincide. Pruebe con el RUC o con otra parte del nombre."}
                </li>
              ) : (
                sugerencias.map((cliente) => (
                  <li key={cliente.id}>
                    <button
                      type="button"
                      onClick={() => {
                        definirElegido(cliente);
                        definirTexto("");
                        definirAbierto(false);
                      }}
                      className="flex w-full flex-col items-start gap-0.5 rounded px-2 py-1.5
                                 text-left hover:bg-acento"
                    >
                      <span className="text-xs">{cliente.razon_social}</span>
                      {cliente.ruc ? (
                        <span className="text-[11px] tabular text-atenuado-contraste">
                          {cliente.ruc}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
}
