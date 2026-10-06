"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Send } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { GrupoCampo, Seleccion } from "@/components/ui/campo";
import {
  Dialogo,
  DialogoCabecera,
  DialogoCierre,
  DialogoContenido,
  DialogoDescripcion,
  DialogoPie,
  DialogoTitulo,
} from "@/components/ui/dialogo";
import {
  aprobarPlan,
  aprobarPrograma,
  solicitarAprobacionPlan,
  solicitarAprobacionPrograma,
} from "@/app/(sgc)/auditorias/acciones";

/**
 * Solicitud y aprobación del programa anual y del plan de auditoría.
 *
 * EL BOTÓN ERA «APROBAR» Y LO APRETABA QUIEN ESTUVIERA MIRANDO. Eso no
 * es una aprobación: es un cambio de estado. Dirección pidió el 6 de
 * octubre que se le pida a alguien, que a esa persona le llegue el
 * aviso, y que el botón de aprobar aparezca recién para ella.
 *
 * El mismo componente sirve al programa y al plan porque el recorrido es
 * idéntico; lo único que cambia es a qué acción llama y cómo se nombra
 * lo que se aprueba.
 *
 * QUIÉN PUEDE APROBAR LO DECIDE LA ACCIÓN DE SERVIDOR, no este
 * componente. Acá solo se decide qué botón mostrar: ocultar uno no es un
 * control de acceso.
 */
export function PanelAprobacion({
  entidad,
  id,
  usuarios,
  usuarioActualId,
  esAdministrador,
  solicitadaA,
  aprobada,
  puedeSolicitar,
}: {
  entidad: "programa" | "plan";
  id: string;
  usuarios: { id: string; nombre_completo: string }[];
  usuarioActualId: string;
  esAdministrador: boolean;
  /** A quién se le pidió la aprobación, si ya se pidió. */
  solicitadaA: string | null;
  aprobada: boolean;
  puedeSolicitar: boolean;
}) {
  const router = useRouter();
  const [abierto, definirAbierto] = React.useState(false);
  const [procesando, definirProcesando] = React.useState(false);
  const [elegido, definirElegido] = React.useState(solicitadaA ?? "");

  const comoSeLlama = entidad === "programa" ? "el programa" : "el plan";

  async function solicitar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirProcesando(true);
    const resultado =
      entidad === "programa"
        ? await solicitarAprobacionPrograma(id, elegido)
        : await solicitarAprobacionPlan(id, elegido);
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Aprobación solicitada.");
      definirAbierto(false);
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  async function aprobar() {
    definirProcesando(true);
    const resultado =
      entidad === "programa" ? await aprobarPrograma(id) : await aprobarPlan(id);
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Aprobado.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  if (aprobada) return null;

  // El botón de aprobar, solo para quien tiene que aprobar. El
  // Administrador SGC lo ve siempre: es quien destraba una aprobación que
  // quedó pedida a alguien que ya no está.
  const puedeAprobar = solicitadaA === usuarioActualId || esAdministrador;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {puedeAprobar ? (
          <Boton tamano="pequeno" onClick={aprobar} cargando={procesando}>
            <CheckCircle2 /> Aprobar {entidad === "programa" ? "programa" : "plan"}
          </Boton>
        ) : null}

        {puedeSolicitar ? (
          <Boton variante="contorno" tamano="pequeno" onClick={() => definirAbierto(true)}>
            <Send /> {solicitadaA ? "Cambiar quién aprueba" : "Solicitar aprobación"}
          </Boton>
        ) : null}
      </div>

      <Dialogo open={abierto} onOpenChange={definirAbierto}>
        <DialogoContenido>
          <form onSubmit={solicitar}>
            <DialogoCabecera>
              <DialogoTitulo>
                Solicitar la aprobación {entidad === "programa" ? "del programa" : "del plan"}
              </DialogoTitulo>
              <DialogoDescripcion>
                A la persona que elija le llega una notificación con el enlace, y pasa a ser
                quien puede aprobar {comoSeLlama}.
              </DialogoDescripcion>
            </DialogoCabecera>

            <div className="mt-4">
              <GrupoCampo etiqueta="Quién aprueba" htmlFor={`aprobador-${id}`} requerido>
                <Seleccion
                  id={`aprobador-${id}`}
                  value={elegido}
                  required
                  onChange={(evento) => definirElegido(evento.target.value)}
                >
                  <option value="">Elija a la persona…</option>
                  {usuarios.map((persona) => (
                    <option key={persona.id} value={persona.id}>
                      {persona.nombre_completo}
                    </option>
                  ))}
                </Seleccion>
              </GrupoCampo>
            </div>

            <DialogoPie className="mt-5">
              <DialogoCierre asChild>
                <Boton type="button" variante="contorno">
                  Cancelar
                </Boton>
              </DialogoCierre>
              <Boton type="submit" cargando={procesando}>
                Enviar solicitud
              </Boton>
            </DialogoPie>
          </form>
        </DialogoContenido>
      </Dialogo>
    </>
  );
}
