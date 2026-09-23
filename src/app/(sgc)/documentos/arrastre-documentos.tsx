"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { reordenarDocumentos } from "@/app/(sgc)/documentos/acciones";
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
interface Arrastre {
  grupos: Record<string, string[]>;
  tomado: { id: string; grupo: string } | null;
  destino: { id: string; encima: boolean } | null;
  tomar: (id: string, grupo: string) => void;
  apuntar: (id: string, encima: boolean) => void;
  soltar: () => void;
  cancelar: () => void;
  guardando: boolean;
}

const ContextoArrastre = React.createContext<Arrastre | null>(null);

export function ProveedorArrastre({
  grupos,
  children,
}: {
  /** Los ids de cada categoría, en el orden en que se ven. */
  grupos: Record<string, string[]>;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [tomado, definirTomado] = React.useState<{ id: string; grupo: string } | null>(null);
  const [destino, definirDestino] = React.useState<{ id: string; encima: boolean } | null>(null);
  const [guardando, definirGuardando] = React.useState(false);

  const tomar = React.useCallback((id: string, grupo: string) => {
    definirTomado({ id, grupo });
    definirDestino(null);
  }, []);

  const apuntar = React.useCallback((id: string, encima: boolean) => {
    definirDestino((actual) =>
      actual?.id === id && actual.encima === encima ? actual : { id, encima },
    );
  }, []);

  const cancelar = React.useCallback(() => {
    definirTomado(null);
    definirDestino(null);
  }, []);

  const soltar = React.useCallback(async () => {
    if (!tomado || !destino || tomado.id === destino.id) {
      cancelar();
      return;
    }

    const actuales = grupos[tomado.grupo] ?? [];
    const sinEl = actuales.filter((id) => id !== tomado.id);
    const posicion = sinEl.indexOf(destino.id);

    if (posicion === -1) {
      cancelar();
      return;
    }

    const nuevos = [...sinEl];
    nuevos.splice(destino.encima ? posicion : posicion + 1, 0, tomado.id);

    definirTomado(null);
    definirDestino(null);
    definirGuardando(true);

    const resultado = await reordenarDocumentos(nuevos);
    if (!resultado.exito) toast.error(resultado.error);
    else router.refresh();

    definirGuardando(false);
  }, [tomado, destino, grupos, cancelar, router]);

  const valor = React.useMemo(
    () => ({ grupos, tomado, destino, tomar, apuntar, soltar, cancelar, guardando }),
    [grupos, tomado, destino, tomar, apuntar, soltar, cancelar, guardando],
  );

  return (
    <ContextoArrastre.Provider value={valor}>
      {/* Mientras se arrastra no se puede seleccionar texto: si no, el
          navegador pinta media tabla de azul y parece que se rompió. */}
      <div className={cn(tomado && "select-none", guardando && "pointer-events-none opacity-70")}>
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

  const { tomado, destino, tomar, apuntar, soltar, cancelar } = contexto;
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
        if (!tomado || !mismoGrupo || esLaTomada) return;
        // Sin esto el navegador no admite el soltar.
        evento.preventDefault();
        evento.dataTransfer.dropEffect = "move";
        const caja = evento.currentTarget.getBoundingClientRect();
        apuntar(id, evento.clientY < caja.top + caja.height / 2);
      }}
      onDrop={(evento) => {
        if (!tomado || !mismoGrupo) return;
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
