"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import type { ResultadoAccion } from "@/lib/tipos";

/**
 * Botón de eliminar de los registros de Informática, con confirmación.
 *
 * Recibe la acción de servidor ya atada al registro, así cada módulo
 * escribe su propio aviso —qué se pierde y qué conserva la bitácora— y no
 * se copia el mismo componente tres veces.
 */
export function BotonEliminar({
  accion,
  aviso,
  volverA,
}: {
  accion: () => Promise<ResultadoAccion>;
  aviso: string;
  volverA: string;
}) {
  const router = useRouter();
  const [borrando, definirBorrando] = React.useState(false);

  async function eliminar() {
    if (!confirm(`${aviso}\n\nEsta acción no se puede deshacer; la bitácora conserva lo que se borró.`)) {
      return;
    }
    definirBorrando(true);
    const resultado = await accion();
    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Registro eliminado.");
      router.push(volverA);
      router.refresh();
    } else {
      toast.error(resultado.error);
      definirBorrando(false);
    }
  }

  return (
    <Boton
      variante="contorno"
      tamano="pequeno"
      cargando={borrando}
      onClick={eliminar}
      className="border-semaforo-critico/40 text-semaforo-critico hover:bg-semaforo-critico/10"
    >
      <Trash2 /> Eliminar
    </Boton>
  );
}

/** Copia un texto al portapapeles y lo confirma. */
export function BotonCopiar({ texto, etiqueta = "Copiar" }: { texto: string; etiqueta?: string }) {
  const [copiado, definirCopiado] = React.useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      definirCopiado(true);
      setTimeout(() => definirCopiado(false), 2000);
    } catch {
      toast.error("No se pudo copiar. Seleccione el texto y cópielo a mano.");
    }
  }

  return (
    <Boton type="button" variante="contorno" tamano="pequeno" onClick={copiar}>
      {copiado ? "Copiado" : etiqueta}
    </Boton>
  );
}
