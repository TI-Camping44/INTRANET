"use client";

import * as React from "react";
import { Search, X } from "lucide-react";

import { Entrada } from "@/components/ui/campo";
import { sinTildes } from "@/lib/utilidades";

export interface ClienteBuscable {
  id: string;
  razon_social: string;
  /** RUC de la empresa o cédula del consumidor final. */
  ruc: string | null;
}

/** Cuántos coincidentes se listan. Más que esto ya no se lee: se escribe. */
const MAXIMO_SUGERENCIAS = 8;

/**
 * Elige el cliente escribiendo, no desplegando.
 *
 * ERA UN `<select>` Y NO SERVÍA. Con la cartera de clientes entera
 * adentro, encontrar a alguien es bajar por una lista de miles: nadie
 * lo hace, y por eso el formulario tenía al lado un campo para escribir
 * el nombre a mano. Dos lugares para lo mismo, y el de la derecha
 * ganaba siempre, así que el reclamo quedaba sin cliente identificado y
 * sin cliente no hay forma de detectar la reincidencia, que es lo que
 * sube el plan de nivel.
 *
 * SE BUSCA POR NOMBRE Y POR RUC O CÉDULA. En el mostrador el dato que
 * se tiene a mano es el documento, no la razón social como la escribió
 * Odoo: quien atiende tiene la factura adelante.
 *
 * La comparación va sin tildes ni mayúsculas, y por partes: escribir
 * «carlos lopez» encuentra «LÓPEZ, Carlos Alberto». Buscar la cadena
 * entera obligaría a escribir el nombre en el orden en que está
 * guardado, que es justo lo que no se sabe.
 */
export function SelectorCliente({
  clientes,
  inicialId,
  inicialNombre,
}: {
  clientes: ClienteBuscable[];
  inicialId?: string | null;
  inicialNombre?: string | null;
}) {
  const elegidoInicial = inicialId
    ? (clientes.find((cliente) => cliente.id === inicialId) ?? null)
    : null;

  const [elegido, definirElegido] = React.useState<ClienteBuscable | null>(elegidoInicial);
  const [texto, definirTexto] = React.useState("");
  const [abierto, definirAbierto] = React.useState(false);
  const contenedor = React.useRef<HTMLDivElement>(null);

  // SE CIERRA AL TOCAR AFUERA. Sin esto la lista queda abierta tapando
  // los campos de abajo, y en el celular no hay forma de sacarla.
  //
  // Va en `mousedown` y no en `blur` del campo: `blur` dispara antes que
  // el click de la opción, así que cerrar ahí desmontaría el botón antes
  // de que llegue a elegirse.
  React.useEffect(() => {
    if (!abierto) return;

    function alTocar(evento: MouseEvent) {
      if (!contenedor.current?.contains(evento.target as Node)) definirAbierto(false);
    }

    document.addEventListener("mousedown", alTocar);
    return () => document.removeEventListener("mousedown", alTocar);
  }, [abierto]);

  // El índice de búsqueda de cada cliente, calculado una sola vez: con
  // miles de filas, normalizar en cada tecla se nota.
  const indice = React.useMemo(
    () =>
      clientes.map((cliente) => ({
        cliente,
        texto: sinTildes(`${cliente.razon_social} ${cliente.ruc ?? ""}`),
      })),
    [clientes],
  );

  // SIN ESCRIBIR NADA TAMBIÉN MUESTRA. Al tocar el campo aparecen los
  // primeros de la lista, como un desplegable de toda la vida: si solo
  // mostrara al escribir, quien no sabe cómo está cargado el cliente ve
  // un campo vacío y no sabe si el buscador anda o si no hay nada.
  const sugerencias = React.useMemo(() => {
    const partes = sinTildes(texto).split(/\s+/).filter(Boolean);
    if (partes.length === 0) return clientes.slice(0, MAXIMO_SUGERENCIAS);

    const encontrados: ClienteBuscable[] = [];
    for (const fila of indice) {
      if (partes.every((parte) => fila.texto.includes(parte))) {
        encontrados.push(fila.cliente);
        if (encontrados.length === MAXIMO_SUGERENCIAS) break;
      }
    }
    return encontrados;
  }, [clientes, indice, texto]);

  function elegir(cliente: ClienteBuscable) {
    definirElegido(cliente);
    definirTexto("");
    definirAbierto(false);
  }

  return (
    <div className="relative" ref={contenedor}>
      {/* El id y el nombre viajan juntos: el nombre queda escrito en el
          reclamo tal como estaba el día que se registró, aunque después
          el cliente se renombre en Odoo. */}
      <input type="hidden" name="cliente_id" value={elegido?.id ?? ""} />
      <input
        type="hidden"
        name="cliente_nombre"
        value={elegido?.razon_social ?? inicialNombre ?? ""}
      />

      {elegido ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-borde bg-acento/40 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{elegido.razon_social}</p>
            {elegido.ruc ? (
              <p className="truncate text-[11px] tabular text-atenuado-contraste">
                {elegido.ruc}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => definirElegido(null)}
            className="shrink-0 rounded p-1 text-atenuado-contraste hover:text-primario"
            aria-label="Elegir otro cliente"
            title="Elegir otro cliente"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <>
          {/* La lista vacía se avisa en el campo, no solo al desplegar:
              un buscador que no encuentra nada se lee como roto. */}
          {clientes.length === 0 ? (
            <p className="mb-1 text-[11px] text-semaforo-alto">
              No hay clientes cargados todavía. Hasta que se carguen no se puede registrar un
              reclamo.
            </p>
          ) : null}

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
              placeholder={
                clientes.length === 0
                  ? "Sin clientes cargados"
                  : `Nombre, RUC o cédula — ${clientes.length} cargados`
              }
              className="pl-8"
              autoComplete="off"
            />
          </div>

          {abierto ? (
            <ul
              className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border
                         border-borde bg-emergente p-1 shadow-md"
            >
              {sugerencias.length === 0 ? (
                <li className="px-2 py-3 text-[11px] text-atenuado-contraste">
                  {clientes.length === 0
                    ? "Todavía no hay clientes cargados. Se cargan desde la exportación de Odoo, con «npm run importar-clientes»."
                    : "Ningún cliente coincide. Pruebe con el RUC o con otra parte del nombre."}
                </li>
              ) : (
                sugerencias.map((cliente) => (
                  <li key={cliente.id}>
                    <button
                      type="button"
                      onClick={() => elegir(cliente)}
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
