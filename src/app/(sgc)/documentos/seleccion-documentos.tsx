"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, X } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { anularDocumentos } from "@/app/(sgc)/documentos/acciones";

/**
 * Selección múltiple del listado documental.
 *
 * Existe para limpiar lo que no debería haberse cargado: pruebas,
 * duplicados, cargas a medias. Borrar doce de a uno son doce
 * confirmaciones y doce recargas.
 *
 * Solo lo ve el Administrador SGC. La barra aparece cuando hay algo
 * seleccionado y desaparece cuando no: una barra de acciones permanente
 * sobre una tabla que casi nunca se borra es una barra que estorba todos
 * los días para el caso de una vez al mes.
 *
 * El estado vive acá, en un contexto, para que la página siga siendo un
 * componente de servidor: las filas se dibujan en el servidor y solo la
 * casilla de cada una es cliente.
 */
interface Seleccion {
  elegidos: string[];
  alternar: (id: string) => void;
  limpiar: () => void;
}

const ContextoSeleccion = React.createContext<Seleccion | null>(null);

export function ProveedorSeleccion({ children }: { children: React.ReactNode }) {
  const [elegidos, definirElegidos] = React.useState<string[]>([]);

  const alternar = React.useCallback((id: string) => {
    definirElegidos((actuales) =>
      actuales.includes(id) ? actuales.filter((otro) => otro !== id) : [...actuales, id],
    );
  }, []);

  const limpiar = React.useCallback(() => definirElegidos([]), []);

  const valor = React.useMemo(
    () => ({ elegidos, alternar, limpiar }),
    [elegidos, alternar, limpiar],
  );

  return <ContextoSeleccion.Provider value={valor}>{children}</ContextoSeleccion.Provider>;
}

function useSeleccion(): Seleccion {
  const contexto = React.useContext(ContextoSeleccion);
  if (!contexto) {
    throw new Error("La casilla de selección tiene que estar dentro de ProveedorSeleccion.");
  }
  return contexto;
}

/** La casilla de una fila. */
export function CasillaDocumento({ id, titulo }: { id: string; titulo: string }) {
  const { elegidos, alternar } = useSeleccion();

  return (
    <input
      type="checkbox"
      checked={elegidos.includes(id)}
      onChange={() => alternar(id)}
      aria-label={`Seleccionar ${titulo}`}
      className="size-3.5 cursor-pointer accent-primario"
    />
  );
}

/** La barra que aparece cuando hay documentos seleccionados. */
export function BarraSeleccion() {
  const { elegidos, limpiar } = useSeleccion();
  const router = useRouter();
  const [borrando, definirBorrando] = React.useState(false);

  if (elegidos.length === 0) return null;

  // ANULAR, NO ELIMINAR. Un documento que estuvo vigente no se borra:
  // queda fuera de uso, con el motivo escrito, y se sigue pudiendo
  // consultar. El motivo se pide una vez para toda la selección, porque
  // quien anula cinco documentos de una vez lo hace por la misma razón.
  async function anular() {
    const cuantos = elegidos.length;
    const motivo = prompt(
      `Se anulan ${cuantos} documento${cuantos === 1 ? "" : "s"}: quedan fuera de uso y se ` +
        "siguen pudiendo consultar.\n\n¿Por qué se anulan?",
      "",
    );

    if (motivo === null) return;

    definirBorrando(true);
    const resultado = await anularDocumentos(elegidos, motivo);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Documentos anulados.");
      limpiar();
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
    definirBorrando(false);
  }

  return (
    <div
      className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border
                 border-semaforo-alto/40 bg-semaforo-alto/5 px-3 py-2"
    >
      <p className="text-xs">
        <span className="font-medium tabular">{elegidos.length}</span>{" "}
        {elegidos.length === 1 ? "documento seleccionado" : "documentos seleccionados"}
      </p>
      <div className="flex items-center gap-2">
        <Boton variante="fantasma" tamano="pequeno" onClick={limpiar} disabled={borrando}>
          <X /> Quitar la selección
        </Boton>
        <Boton
          variante="contorno"
          tamano="pequeno"
          cargando={borrando}
          onClick={anular}
          className="border-semaforo-alto/40 text-semaforo-alto hover:bg-semaforo-alto/10"
        >
          <Ban /> Anular
        </Boton>
      </div>
    </div>
  );
}
