"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, FileText, Maximize2, Minus, Plus, Unlink } from "lucide-react";
import { moverEnOrganigrama } from "@/app/(sgc)/directorio/acciones";
import { Avatar, AvatarImagen, AvatarRespaldo } from "@/components/ui/avatar";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { iniciales } from "@/lib/utilidades";

export interface NodoOrganigrama {
  clave: string;
  nombre_completo: string;
  puesto_id: string | null;
  puesto: string | null;
  area: string | null;
  url_avatar: string | null;
  ingreso: boolean;
  lider_clave: string | null;
  lider_manual: boolean;
  /** La empresa del puesto, tal como la declara el padrón. */
  empresa: string | null;
}

/**
 * Si el puesto es de la otra empresa del grupo.
 *
 * Se mira la empresa DEL PUESTO, no `empresa_id`, que siempre vale
 * Camping 44 porque es el inquilino de RLS. La gente de Vitalica entra
 * con su propio dominio pero vive bajo el mismo inquilino: si se la
 * marcara por `empresa_id` no se marcaría nunca.
 */
function esDeVitalica(empresa: string | null): boolean {
  return (empresa ?? "").trim().toLowerCase().startsWith("vitalica");
}

interface Rama extends NodoOrganigrama {
  hijos: Rama[];
  /** Cuánta gente cuelga de acá, contando todos los niveles. */
  descendientes: number;
}

/** Hasta qué nivel se abre el árbol al entrar. */
const NIVELES_ABIERTOS = 2;

const ZOOM_MINIMO = 0.4;
const ZOOM_MAXIMO = 1.4;
const PASO_ZOOM = 0.15;

/**
 * Arma el arbol a partir de «de quien depende cada uno».
 *
 * CUIDADO CON LOS CICLOS. Si Odoo declara que A depende de B y B de A
 * —o que alguien es su propio jefe—, una construccion ingenua se cuelga
 * al dibujar. Por eso se recorre desde las raices marcando lo visitado:
 * lo que quede sin visitar es un ciclo, y se devuelve aparte en vez de
 * desaparecer sin avisar.
 */
export function armarOrganigrama(nodos: NodoOrganigrama[]): {
  raices: Rama[];
  sueltos: Rama[];
} {
  const porClave = new Map<string, Rama>(
    nodos.map((nodo) => [nodo.clave, { ...nodo, hijos: [], descendientes: 0 }]),
  );

  const raices: Rama[] = [];

  for (const rama of Array.from(porClave.values())) {
    const jefe = rama.lider_clave ? porClave.get(rama.lider_clave) : undefined;
    if (jefe && jefe.clave !== rama.clave) jefe.hijos.push(rama);
    else raices.push(rama);
  }

  // Cuántos cuelgan de cada uno, de abajo hacia arriba.
  const contar = (rama: Rama, visitados: Set<string>): number => {
    if (visitados.has(rama.clave)) return 0;
    visitados.add(rama.clave);
    rama.descendientes = rama.hijos.reduce((total, hijo) => total + 1 + contar(hijo, visitados), 0);
    return rama.descendientes;
  };
  for (const raiz of raices) contar(raiz, new Set());

  // Primero quien tiene gente, y dentro de eso por nombre.
  const ordenar = (ramas: Rama[]) => {
    ramas.sort(
      (a, b) =>
        b.descendientes - a.descendientes || a.nombre_completo.localeCompare(b.nombre_completo),
    );
    for (const rama of ramas) ordenar(rama.hijos);
  };
  ordenar(raices);

  // Lo alcanzable desde las raices. El resto es un ciclo.
  const vistos = new Set<string>();
  const recorrer = (ramas: Rama[]) => {
    for (const rama of ramas) {
      if (vistos.has(rama.clave)) continue;
      vistos.add(rama.clave);
      recorrer(rama.hijos);
    }
  };
  recorrer(raices);

  const sueltos = Array.from(porClave.values()).filter((rama) => !vistos.has(rama.clave));
  return { raices, sueltos };
}

/** Las claves de todo el árbol, para abrir o cerrar de una. */
function todasLasClaves(ramas: Rama[]): string[] {
  return ramas.flatMap((rama) => [rama.clave, ...todasLasClaves(rama.hijos)]);
}

/** Las claves de los que quedan cerrados al entrar. */
function cerradasPorNivel(ramas: Rama[], nivel = 1): string[] {
  return ramas.flatMap((rama) =>
    rama.hijos.length === 0
      ? []
      : nivel >= NIVELES_ABIERTOS
        ? [rama.clave, ...cerradasPorNivel(rama.hijos, nivel + 1)]
        : cerradasPorNivel(rama.hijos, nivel + 1),
  );
}

function Caja({
  nodo,
  cerrado,
  alternar,
  edicion,
}: {
  nodo: Rama;
  cerrado: boolean;
  alternar: (clave: string) => void;
  edicion: Edicion | null;
}) {
  const recibiendo = edicion?.sobre === nodo.clave;
  const moviendose = edicion?.arrastrado === nodo.clave;
  const vitalica = esDeVitalica(nodo.empresa);

  return (
    <div
      draggable={Boolean(edicion)}
      onDragStart={() => edicion?.tomar(nodo.clave)}
      onDragEnd={() => edicion?.soltarTodo()}
      onDragOver={(evento) => {
        if (!edicion || !edicion.arrastrado || edicion.arrastrado === nodo.clave) return;
        evento.preventDefault();
        edicion.apuntar(nodo.clave);
      }}
      onDragLeave={() => edicion?.apuntar(null)}
      onDrop={(evento) => {
        evento.preventDefault();
        edicion?.colgarDe(nodo.clave);
      }}
      className={`relative flex w-[10.5rem] flex-col items-center gap-1 overflow-hidden
                  rounded-lg border bg-tarjeta px-2 py-2 text-center ${
                    edicion ? "cursor-grab" : ""
                  } ${
                    recibiendo
                      ? "border-primario ring-2 ring-primario/30"
                      : moviendose
                        ? "border-dashed border-primario/60 opacity-60"
                        : vitalica
                          ? "border-vitalica/50"
                          : "border-borde"
                  }`}
      title={edicion ? "Arrastre esta caja sobre otra para cambiar de quién depende" : undefined}
    >
      {/* UNA FRANJA, NO UN RELLENO. El color tiene que distinguir sin
          competir con el texto, que es lo que se viene a leer. */}
      {vitalica ? (
        <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-vitalica" />
      ) : null}

      <Avatar className="size-7">
        {nodo.url_avatar ? (
          <AvatarImagen src={nodo.url_avatar} alt={nodo.nombre_completo} />
        ) : null}
        <AvatarRespaldo className="text-[10px]">{iniciales(nodo.nombre_completo)}</AvatarRespaldo>
      </Avatar>

      <p className="text-[11px] font-semibold leading-tight">{nodo.nombre_completo}</p>

      {nodo.puesto ? (
        nodo.puesto_id ? (
          <Link
            href={`/recursos-humanos/puestos/${nodo.puesto_id}`}
            className="flex items-center justify-center gap-1 text-[10px] leading-tight
                       text-atenuado-contraste hover:text-primario"
            title="Ver el perfil del puesto"
          >
            <span>{nodo.puesto}</span>
            <FileText className="size-2.5 shrink-0" />
          </Link>
        ) : (
          <p className="text-[10px] leading-tight text-atenuado-contraste">{nodo.puesto}</p>
        )
      ) : null}

      {/* EL ÁREA, que es la otra mitad de la jerarquía: mover una caja
          dice de quién depende y dónde queda ubicada. */}
      {nodo.area ? (
        <span className="rounded-sm bg-atenuado px-1 py-px text-[9px] leading-tight text-atenuado-contraste">
          {nodo.area}
        </span>
      ) : null}

      {!nodo.ingreso ? (
        <span className="text-[9px] text-atenuado-contraste">Sin ingresar</span>
      ) : null}

      {vitalica ? (
        <span className="text-[9px] font-semibold uppercase tracking-wide text-vitalica">
          Vitalica
        </span>
      ) : null}

      {nodo.lider_manual ? (
        <span className="text-[9px] text-atenuado-contraste" title="La línea de reporte se corrigió a mano; Odoo ya no manda sobre ella">
          Ajustado a mano
        </span>
      ) : null}

      {/* ABRIR Y CERRAR LA RAMA. Con 55 personas el árbol entero no entra
          en ninguna pantalla; se recorre de a una rama. El número dice
          cuánta gente hay debajo, para saber qué se está abriendo. */}
      {nodo.hijos.length > 0 ? (
        <button
          type="button"
          onClick={() => alternar(nodo.clave)}
          className="mt-0.5 flex items-center gap-1 rounded-full border border-borde bg-fondo
                     px-1.5 py-0.5 text-[9px] font-semibold text-atenuado-contraste
                     transition-colors hover:border-primario/40 hover:text-primario"
          aria-expanded={!cerrado}
          aria-label={`${cerrado ? "Abrir" : "Cerrar"} el equipo de ${nodo.nombre_completo}`}
        >
          {cerrado ? <ChevronRight className="size-2.5" /> : <ChevronDown className="size-2.5" />}
          {nodo.descendientes} {nodo.descendientes === 1 ? "persona" : "personas"}
        </button>
      ) : null}
    </div>
  );
}

interface Edicion {
  arrastrado: string | null;
  sobre: string | null;
  tomar: (clave: string) => void;
  apuntar: (clave: string | null) => void;
  soltarTodo: () => void;
  colgarDe: (clave: string | null) => void;
}

function Nivel({
  ramas,
  cerradas,
  alternar,
  edicion,
}: {
  ramas: Rama[];
  cerradas: Set<string>;
  alternar: (clave: string) => void;
  edicion: Edicion | null;
}) {
  return (
    <ul>
      {ramas.map((rama) => {
        const cerrado = cerradas.has(rama.clave);
        return (
          <li key={rama.clave}>
            <Caja nodo={rama} cerrado={cerrado} alternar={alternar} edicion={edicion} />
            {rama.hijos.length > 0 && !cerrado ? (
              <Nivel
                ramas={rama.hijos}
                cerradas={cerradas}
                alternar={alternar}
                edicion={edicion}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * El organigrama, de arriba hacia abajo.
 *
 * CON 55 PERSONAS NO HAY PANTALLA QUE ALCANCE, así que el árbol se
 * recorre en vez de mirarse entero: cada caja con gente a cargo se abre
 * y se cierra, se puede acercar y alejar, y se arrastra con el mouse
 * como un mapa. Al entrar quedan abiertos los dos primeros niveles, que
 * es la foto que casi siempre se busca.
 *
 * La línea de reporte sale del padrón y, cuando el Administrador SGC la
 * cargó a mano, de `usuarios.superior_id`. Quien no tiene jefe declarado
 * aparece como raíz: la raíz con más gente debajo es la Presidencia y va
 * arriba; las demás son datos que faltan y se muestran aparte.
 */
export function Organigrama({
  nodos,
  puedeEditar = false,
}: {
  nodos: NodoOrganigrama[];
  puedeEditar?: boolean;
}) {
  const { raices, sueltos } = React.useMemo(() => armarOrganigrama(nodos), [nodos]);
  const router = useRouter();

  const principal = raices[0];
  const otras = raices.slice(1);

  const [cerradas, definirCerradas] = React.useState<Set<string>>(
    () => new Set(principal ? cerradasPorNivel([principal]) : []),
  );
  const [zoom, definirZoom] = React.useState(1);

  // QUIÉN SE ESTÁ ARRASTRANDO Y SOBRE QUIÉN. `sobre` es solo para
  // pintar el destino; la decisión se toma al soltar.
  const [arrastrado, definirArrastrado] = React.useState<string | null>(null);
  const [sobre, definirSobre] = React.useState<string | null>(null);
  const [guardando, definirGuardando] = React.useState(false);

  const deVitalica = nodos.filter((nodo) => esDeVitalica(nodo.empresa)).length;

  const edicion: Edicion | null = puedeEditar
    ? {
        arrastrado,
        sobre,
        tomar: (clave) => definirArrastrado(clave),
        apuntar: (clave) => definirSobre(clave),
        soltarTodo: () => {
          definirArrastrado(null);
          definirSobre(null);
        },
        colgarDe: (claveJefe) => {
          const quien = arrastrado;
          definirArrastrado(null);
          definirSobre(null);
          if (!quien || quien === claveJefe || guardando) return;

          definirGuardando(true);
          void moverEnOrganigrama(quien, claveJefe).then((resultado) => {
            definirGuardando(false);
            if (resultado.exito) {
              toast.success(resultado.mensaje ?? "Organigrama actualizado.");
              router.refresh();
            } else {
              toast.error(resultado.error);
            }
          });
        },
      }
    : null;

  const lienzo = React.useRef<HTMLDivElement>(null);
  const arrastre = React.useRef<{ x: number; y: number; izq: number; arr: number } | null>(null);

  function alternar(clave: string) {
    definirCerradas((actuales) => {
      const nuevas = new Set(actuales);
      if (nuevas.has(clave)) nuevas.delete(clave);
      else nuevas.add(clave);
      return nuevas;
    });
  }

  // ARRASTRAR COMO UN MAPA. En el celular el dedo ya desplaza el
  // contenedor; esto es para el mouse, que si no obliga a usar la barra.
  function alPresionar(evento: React.MouseEvent) {
    if (!lienzo.current) return;
    if ((evento.target as HTMLElement).closest("a,button")) return;
    arrastre.current = {
      x: evento.clientX,
      y: evento.clientY,
      izq: lienzo.current.scrollLeft,
      arr: lienzo.current.scrollTop,
    };
  }

  function alMover(evento: React.MouseEvent) {
    if (!arrastre.current || !lienzo.current) return;
    lienzo.current.scrollLeft = arrastre.current.izq - (evento.clientX - arrastre.current.x);
    lienzo.current.scrollTop = arrastre.current.arr - (evento.clientY - arrastre.current.y);
  }

  function soltar() {
    arrastre.current = null;
  }

  const todoCerrado = principal
    ? todasLasClaves([principal]).every(
        (clave) => cerradas.has(clave) || !nodos.some((n) => n.lider_clave === clave),
      )
    : false;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Boton
          type="button"
          variante="contorno"
          tamano="pequeno"
          onClick={() =>
            definirCerradas(
              todoCerrado ? new Set() : new Set(principal ? todasLasClaves([principal]) : []),
            )
          }
        >
          {todoCerrado ? "Abrir todo" : "Cerrar todo"}
        </Boton>

        <div className="flex items-center gap-1">
          <Boton
            type="button"
            variante="contorno"
            tamano="iconoPequeno"
            aria-label="Alejar"
            onClick={() => definirZoom((z) => Math.max(ZOOM_MINIMO, z - PASO_ZOOM))}
          >
            <Minus />
          </Boton>
          <span className="w-10 text-center text-[11px] tabular text-atenuado-contraste">
            {Math.round(zoom * 100)} %
          </span>
          <Boton
            type="button"
            variante="contorno"
            tamano="iconoPequeno"
            aria-label="Acercar"
            onClick={() => definirZoom((z) => Math.min(ZOOM_MAXIMO, z + PASO_ZOOM))}
          >
            <Plus />
          </Boton>
          <Boton
            type="button"
            variante="contorno"
            tamano="iconoPequeno"
            aria-label="Volver al tamaño normal"
            onClick={() => definirZoom(1)}
          >
            <Maximize2 />
          </Boton>
        </div>

        {/* La referencia del color. Un color sin su referencia es una
            mancha: hay que decir qué significa. */}
        {deVitalica > 0 ? (
          <span className="flex items-center gap-1.5 text-[11px] text-atenuado-contraste">
            <span aria-hidden className="h-2.5 w-4 rounded-sm bg-vitalica" />
            {deVitalica} de Vitalica E.A.S.
          </span>
        ) : null}

        <p className="text-[11px] text-atenuado-contraste">
          Arrastre el fondo para moverse. Toque el número de una caja para abrir o cerrar su
          equipo.
          {puedeEditar
            ? " Para cambiar de quién depende alguien, arrastre su caja sobre la de su líder."
            : ""}
          {guardando ? " Guardando…" : ""}
        </p>
      </div>

      <div
        ref={lienzo}
        onMouseDown={alPresionar}
        onMouseMove={alMover}
        onMouseUp={soltar}
        onMouseLeave={soltar}
        className="desplazable-x max-h-[72vh] cursor-grab overflow-auto rounded-lg border
                   border-borde bg-fondo p-4 active:cursor-grabbing"
      >
        <div
          className="organigrama inline-block min-w-full"
          style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
        >
          {principal ? (
            <Nivel
              ramas={[principal]}
              cerradas={cerradas}
              alternar={alternar}
              edicion={edicion}
            />
          ) : null}
        </div>
      </div>

      {/* SIN LÍDER DECLARADO, AL COSTADO Y COMO ZONA DE DESCARGA.
          Son los que no cuelgan de nadie: o el dato falta en Odoo, o su
          jefe no está en la nómina. Se arrastran desde acá hasta su
          líder en el árbol de arriba, y al revés: soltar una caja acá la
          desprende del árbol. */}
      {otras.length > 0 || puedeEditar ? (
        <div
          onDragOver={(evento) => {
            if (!edicion?.arrastrado) return;
            evento.preventDefault();
            edicion.apuntar("__sueltos__");
          }}
          onDragLeave={() => edicion?.apuntar(null)}
          onDrop={(evento) => {
            evento.preventDefault();
            edicion?.colgarDe(null);
          }}
          className={`rounded-lg border p-3 transition-colors ${
            sobre === "__sueltos__" ? "border-primario bg-primario/5" : "border-borde"
          }`}
        >
          <h2 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-atenuado-contraste">
            <Unlink className="size-3" />
            Sin líder declarado ({otras.length})
          </h2>
          <p className="mb-3 text-[11px] leading-relaxed text-atenuado-contraste">
            {otras.length === 0
              ? "No queda nadie suelto."
              : `${otras.length === 1 ? "Esta persona no cuelga" : "Estas personas no cuelgan"} de nadie: o el dato falta en Odoo, o su jefe no está en la nómina. Hasta que se corrija, no se les puede escalar una acción vencida.`}
            {puedeEditar
              ? " Arrástrelas hasta su líder en el árbol de arriba. Soltar una caja acá la desprende del árbol."
              : ""}
          </p>

          {otras.length > 0 ? (
            <div className="desplazable-x overflow-x-auto">
              <div className="organigrama inline-block min-w-full">
                <Nivel ramas={otras} cerradas={cerradas} alternar={alternar} edicion={edicion} />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {sueltos.length > 0 ? (
        <p className="text-[11px] leading-relaxed text-semaforo-alto">
          Hay {sueltos.length} persona{sueltos.length === 1 ? "" : "s"} en un círculo de reporte
          —alguien depende de quien depende de ella— y por eso no se dibuja
          {sueltos.length === 1 ? "" : "n"}. Hay que corregir la jerarquía en Odoo.
        </p>
      ) : null}
    </div>
  );
}
