"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { reindexarDocumentos } from "@/app/(sgc)/documentos/acciones";

/**
 * Vuelve a leer el texto de los documentos que quedaron sin indexar.
 *
 * El trabajo de la noche ya hace esto solo. El botón está para no esperar
 * hasta mañana: después de cargar un lote de documentos, o cuando algo
 * falló, se aprieta y listo.
 *
 * Va con `cargando` y no apagado, como todo lo que dispara una acción de
 * servidor en este sistema: lee archivos de verdad y puede tardar
 * bastante. Un botón apagado y sin señal de avance se lee como roto.
 *
 * El aviso de resultado dura más de lo normal a propósito: dice cuántos
 * se leyeron y cuántos quedaron sin texto, y eso no se alcanza a leer en
 * los cuatro segundos de siempre.
 */
export function BotonReindexar() {
  const router = useRouter();
  const [trabajando, definirTrabajando] = React.useState(false);

  async function reindexar() {
    definirTrabajando(true);
    const resultado = await reindexarDocumentos();

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Documentos reindexados.", { duration: 10_000 });
      router.refresh();
    } else {
      toast.error(resultado.error, { duration: 10_000 });
    }

    definirTrabajando(false);
  }

  return (
    <Boton
      variante="contorno"
      cargando={trabajando}
      onClick={reindexar}
      title="Lee el texto de los documentos para que el buscador pueda encontrar por contenido"
    >
      <RefreshCw /> Reindexar
    </Boton>
  );
}
