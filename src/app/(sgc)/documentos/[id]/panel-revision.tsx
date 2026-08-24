"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, GrupoCampo } from "@/components/ui/campo";
import { Aviso, AvisoDescripcion, AvisoTitulo } from "@/components/ui/aviso";
import { responderRevision } from "@/app/(sgc)/documentos/acciones";

/** Panel que ve el revisor asignado a la version en curso. */
export function PanelRevision({
  revisionId,
  etiquetaVersion,
}: {
  revisionId: string;
  etiquetaVersion: string;
}) {
  const router = useRouter();
  const [comentario, definirComentario] = React.useState("");
  const [procesando, definirProcesando] = React.useState(false);

  async function responder(aprueba: boolean) {
    definirProcesando(true);
    const resultado = await responderRevision(revisionId, aprueba, comentario);
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Revisión registrada.");
      definirComentario("");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <Aviso variante="advertencia" className="flex-col">
      <AvisoTitulo>Tiene esta revisión pendiente</AvisoTitulo>
      <AvisoDescripcion className="w-full">
        Revise el contenido de la versión {etiquetaVersion} y registre su respuesta.
      </AvisoDescripcion>

      <div className="mt-3 w-full">
        <GrupoCampo
          etiqueta="Comentario"
          htmlFor="comentario-revision"
          ayuda="Obligatorio al rechazar; el elaborador recibe el detalle."
        >
          <AreaTexto
            id="comentario-revision"
            rows={2}
            value={comentario}
            onChange={(evento) => definirComentario(evento.target.value)}
            className="bg-fondo"
          />
        </GrupoCampo>

        <div className="mt-3 flex gap-2">
          <Boton tamano="pequeno" disabled={procesando} onClick={() => responder(true)}>
            <ThumbsUp /> Aprobar
          </Boton>
          <Boton
            tamano="pequeno"
            variante="contorno"
            disabled={procesando}
            onClick={() => responder(false)}
          >
            <ThumbsDown /> Rechazar con observaciones
          </Boton>
        </div>
      </div>
    </Aviso>
  );
}
