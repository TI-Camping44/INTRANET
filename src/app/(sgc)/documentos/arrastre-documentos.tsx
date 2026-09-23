"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  reordenarCategorias,
  reordenarDocumentos,
} from "@/app/(sgc)/documentos/acciones";
import { cn } from "@/lib/utilidades";

/**
 * Arrastrar y soltar para ordenar la carpeta documental.
 *
 * Las flechas mueven de a un lugar y siguen estando: para bajar un
 * documento dos posiciones son dos toques y no hay nada más simple. Para
 * llevarlo del segundo al vigésimo eran dieciocho, y ahí se arrastra.
 *
 * Se agarra la fila de cualquier parte. Los enlaces del código y del
 * título llevan `draggable={false}` en la página justamente por esto: si
 * no, el navegador entiende que se está arrastrando el enlace y termina
 * pintando el texto de azul en vez de mover la fila.
 *
 * Solo dentro de la misma categoría. Soltar un documento en otra carpeta
 * no es reordenar, es recategorizar, y eso se hace en «Categorías», que
 * es donde se ve el conjunto entero.
 *
 * El estado vive en un contexto para que la página siga siendo un
 * componente de servidor: las filas se dibujan en el servidor y lo único
 * que es cliente es el envoltorio que escucha el arrastre.
 */
/** Una categoría se identifica por su nombre, y «Sin categoría» es null. */
type Categoria = string | null;

interface Arrastre {
  grupos: Record<string, string[]>;
  tomado: { id: string; grupo: string } | null;
  /** Igual que `tomado`, en una referencia. Ver `categoriaTomadaRef`. */
  tomadoRef: React.MutableRefObject<{ id: string; grupo: string } | null>;
  destino: { id: string; encima: boolean } | null;
  tomar: (id: string, grupo: string) => void;
  apuntar: (id: string, encima: boolean) => void;
  soltar: () => void;
  cancelar: () => void;
  guardando: boolean;
  // Las categorías se arrastran igual que las filas, pero entre ellas:
  // se toma el renglón de la carpeta y se suelta sobre otro.
  categorias: Categoria[];
  categoriaTomada: Categoria | undefined;
  /**
   * Lo mismo que `categoriaTomada`, pero en una referencia.
   *
   * `onDragOver` se dispara enseguida de `onDragStart`, antes de que
   * React haya vuelto a dibujar, asi que el controlador todavia ve el
   * estado viejo —«ninguna tomada»— y no llama a `preventDefault`. Sin
   * eso el navegador no admite el soltar y el arrastre no hace nada. El
   * estado sigue para dibujar; la referencia es para decidir.
   */
  categoriaTomadaRef: React.MutableRefObject<Categoria | undefined>;
  categoriaDestino: { categoria: Categoria; encima: boolean } | null;
  tomarCategoria: (categoria: Categoria) => void;
  apuntarCategoria: (categoria: Categoria, encima: boolean) => void;
  soltarCategoria: () => void;
  cancelarCategoria: () => void;
}

const ContextoArrastre = React.createContext<Arrastre | null>(null);

export function ProveedorArrastre({
  grupos,
  categorias = [],
  children,
}: {
  /** Los ids de cada categoría, en el orden en que se ven. */
  grupos: Record<string, string[]>;
  /** Las categorías, en el orden global en que están hoy. */
  categorias?: Categoria[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [tomado, definirTomado] = React.useState<{ id: string; grupo: string } | null>(null);
  const [destino, definirDestino] = React.useState<{ id: string; encima: boolean } | null>(null);
  const [guardando, definirGuardando] = React.useState(false);
  // `undefined` es «ninguna tomada»; null es «Sin categoría», que sí se
  // puede tomar. Por eso no alcanza con null para las dos cosas.
  const [categoriaTomada, definirCategoriaTomada] = React.useState<Categoria | undefined>(
    undefined,
  );
  const [categoriaDestino, definirCategoriaDestino] = React.useState<{
    categoria: Categoria;
    encima: boolean;
  } | null>(null);

  const tomadoRef = React.useRef<{ id: string; grupo: string } | null>(null);
  const categoriaTomadaRef = React.useRef<Categoria | undefined>(undefined);

  const tomar = React.useCallback((id: string, grupo: string) => {
    tomadoRef.current = { id, grupo };
    definirTomado({ id, grupo });
    definirDestino(null);
  }, []);

  const apuntar = React.useCallback((id: string, encima: boolean) => {
    definirDestino((actual) =>
      actual?.id === id && actual.encima === encima ? actual : { id, encima },
    );
  }, []);

  const cancelar = React.useCallback(() => {
    tomadoRef.current = null;
    definirTomado(null);
    definirDestino(null);
  }, []);

  const soltar = React.useCallback(async () => {
    const enMano = tomadoRef.current;

    if (!enMano || !destino || enMano.id === destino.id) {
      cancelar();
      return;
    }

    const actuales = grupos[enMano.grupo] ?? [];
    const sinEl = actuales.filter((id) => id !== enMano.id);
    const posicion = sinEl.indexOf(destino.id);

    if (posicion === -1) {
      cancelar();
      return;
    }

    const nuevos = [...sinEl];
    nuevos.splice(destino.encima ? posicion : posicion + 1, 0, enMano.id);

    tomadoRef.current = null;
    definirTomado(null);
    definirDestino(null);
    definirGuardando(true);

    const resultado = await reordenarDocumentos(nuevos);
    if (!resultado.exito) toast.error(resultado.error);
    else router.refresh();

    definirGuardando(false);
  }, [destino, grupos, cancelar, router]);

  const tomarCategoria = React.useCallback((categoria: Categoria) => {
    categoriaTomadaRef.current = categoria;
    definirCategoriaTomada(categoria);
    definirCategoriaDestino(null);
  }, []);

  const apuntarCategoria = React.useCallback((categoria: Categoria, encima: boolean) => {
    definirCategoriaDestino((actual) =>
      actual?.categoria === categoria && actual.encima === encima
        ? actual
        : { categoria, encima },
    );
  }, []);

  const cancelarCategoria = React.useCallback(() => {
    categoriaTomadaRef.current = undefined;
    definirCategoriaTomada(undefined);
    definirCategoriaDestino(null);
  }, []);

  const soltarCategoria = React.useCallback(async () => {
    const tomada = categoriaTomadaRef.current;

    if (tomada === undefined || !categoriaDestino || tomada === categoriaDestino.categoria) {
      cancelarCategoria();
      return;
    }

    const sinElla = categorias.filter((nombre) => nombre !== tomada);
    const posicion = sinElla.indexOf(categoriaDestino.categoria);

    if (posicion === -1) {
      cancelarCategoria();
      return;
    }

    const nuevas = [...sinElla];
    nuevas.splice(categoriaDestino.encima ? posicion : posicion + 1, 0, tomada);

    categoriaTomadaRef.current = undefined;
    definirCategoriaTomada(undefined);
    definirCategoriaDestino(null);
    definirGuardando(true);

    const resultado = await reordenarCategorias(nuevas);
    if (!resultado.exito) toast.error(resultado.error);
    else router.refresh();

    definirGuardando(false);
  }, [categoriaDestino, categorias, cancelarCategoria, router]);

  const valor = React.useMemo(
    () => ({
      grupos,
      tomado,
      tomadoRef,
      destino,
      tomar,
      apuntar,
      soltar,
      cancelar,
      guardando,
      categorias,
      categoriaTomada,
      categoriaTomadaRef,
      categoriaDestino,
      tomarCategoria,
      apuntarCategoria,
      soltarCategoria,
      cancelarCategoria,
    }),
    [
      grupos,
      tomado,
      destino,
      tomar,
      apuntar,
      soltar,
      cancelar,
      guardando,
      categorias,
      categoriaTomada,
      categoriaDestino,
      tomarCategoria,
      apuntarCategoria,
      soltarCategoria,
      cancelarCategoria,
    ],
  );

  return (
    <ContextoArrastre.Provider value={valor}>
      {/* Mientras se arrastra no se puede seleccionar texto: si no, el
          navegador pinta media tabla de azul y parece que se rompió. */}
      <div
        className={cn(
          (tomado || categoriaTomada !== undefined) && "select-none",
          guardando && "pointer-events-none opacity-70",
        )}
      >
        {children}
      </div>
    </ContextoArrastre.Provider>
  );
}

/** Una fila que se puede tomar y soltar. Envuelve al `tr` de siempre. */
export function FilaArrastrable({
  id,
  grupo,
  children,
  className,
}: {
  id: string;
  /** La categoría. Solo se puede soltar dentro de la misma. */
  grupo: string;
  children: React.ReactNode;
  className?: string;
}) {
  const contexto = React.useContext(ContextoArrastre);

  // Sin contexto —listado ordenado por una columna— es una fila común.
  if (!contexto) {
    return (
      <tr className={cn("border-b border-borde transition-colors hover:bg-acento/60", className)}>
        {children}
      </tr>
    );
  }

  const { tomado, tomadoRef, destino, tomar, apuntar, soltar, cancelar } = contexto;
  const esLaTomada = tomado?.id === id;
  const mismoGrupo = tomado?.grupo === grupo;
  const marcada = Boolean(tomado) && mismoGrupo && destino?.id === id && !esLaTomada;

  return (
    <tr
      draggable
      onDragStart={(evento) => {
        // Firefox no inicia el arrastre sin datos en el portapapeles.
        evento.dataTransfer.setData("text/plain", id);
        evento.dataTransfer.effectAllowed = "move";
        tomar(id, grupo);
      }}
      onDragEnd={cancelar}
      onDragOver={(evento) => {
        // Se consulta la referencia y no el estado: en el primer
        // `dragover` React todavia no volvio a dibujar.
        const enMano = tomadoRef.current;
        if (!enMano || enMano.grupo !== grupo || enMano.id === id) return;
        // Sin esto el navegador no admite el soltar.
        evento.preventDefault();
        evento.dataTransfer.dropEffect = "move";
        const caja = evento.currentTarget.getBoundingClientRect();
        apuntar(id, evento.clientY < caja.top + caja.height / 2);
      }}
      onDrop={(evento) => {
        const enMano = tomadoRef.current;
        if (!enMano || enMano.grupo !== grupo) return;
        evento.preventDefault();
        void soltar();
      }}
      className={cn(
        "border-b border-borde transition-colors hover:bg-acento/60",
        tomado ? "cursor-grabbing" : "cursor-grab",
        esLaTomada && "opacity-40",
        // La línea marca dónde va a caer: arriba o abajo de esta fila.
        marcada && destino?.encima && "border-t-2 border-t-primario",
        marcada && !destino?.encima && "border-b-2 border-b-primario",
        className,
      )}
    >
      {children}
    </tr>
  );
}


/**
 * El renglón de una categoría, que se toma y se suelta como una fila.
 *
 * Mueve la carpeta entera: soltar «Políticas» debajo de «Procesos de
 * soporte» deja los procesos arriba y las políticas abajo, con sus
 * documentos. Las flechas del renglón siguen estando para mover de a un
 * lugar; esto es para llevarla lejos de una vez.
 *
 * Solo se suelta sobre otra categoría. Soltarla sobre un documento no
 * significa nada: una carpeta no va dentro de una fila.
 */
export function FilaCategoria({
  categoria,
  children,
}: {
  categoria: Categoria;
  children: React.ReactNode;
}) {
  const contexto = React.useContext(ContextoArrastre);

  if (!contexto) {
    return <tr className="border-b border-borde bg-acento/40">{children}</tr>;
  }

  const {
    categorias,
    categoriaTomada,
    categoriaTomadaRef,
    categoriaDestino,
    tomarCategoria,
    apuntarCategoria,
    soltarCategoria,
    cancelarCategoria,
  } = contexto;

  // Con una sola categoría no hay nada que reordenar, y una fila que se
  // puede tomar y no se puede soltar en ningún lado se siente rota.
  if (categorias.length < 2) {
    return <tr className="border-b border-borde bg-acento/40">{children}</tr>;
  }

  const esLaTomada = categoriaTomada === categoria;
  const hayAlguna = categoriaTomada !== undefined;
  const marcada = hayAlguna && !esLaTomada && categoriaDestino?.categoria === categoria;

  return (
    <tr
      draggable
      onDragStart={(evento) => {
        // Firefox no arranca el arrastre sin datos en el portapapeles.
        evento.dataTransfer.setData("text/plain", categoria ?? "");
        evento.dataTransfer.effectAllowed = "move";
        tomarCategoria(categoria);
      }}
      onDragEnd={cancelarCategoria}
      onDragOver={(evento) => {
        const tomada = categoriaTomadaRef.current;
        if (tomada === undefined || tomada === categoria) return;
        evento.preventDefault();
        evento.dataTransfer.dropEffect = "move";
        const caja = evento.currentTarget.getBoundingClientRect();
        apuntarCategoria(categoria, evento.clientY < caja.top + caja.height / 2);
      }}
      onDrop={(evento) => {
        if (categoriaTomadaRef.current === undefined) return;
        evento.preventDefault();
        void soltarCategoria();
      }}
      className={cn(
        "border-b border-borde bg-acento/40",
        hayAlguna ? "cursor-grabbing" : "cursor-grab",
        esLaTomada && "opacity-40",
        marcada && categoriaDestino?.encima && "border-t-2 border-t-primario",
        marcada && !categoriaDestino?.encima && "border-b-2 border-b-primario",
      )}
    >
      {children}
    </tr>
  );
}
