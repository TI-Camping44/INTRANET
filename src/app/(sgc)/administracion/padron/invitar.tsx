"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { Boton } from "@/components/ui/boton";
import {
  invitarAlSistema,
  invitarAPendientes,
} from "@/app/(sgc)/administracion/padron/acciones";

/**
 * Los dos botones que mandan el aviso de ingreso.
 *
 * VAN CON `cargando` Y NO CON `disabled`: mandar un correo puede tardar
 * hasta seis segundos, y un botón apagado sin señal de avance se lee como
 * roto. Es la misma regla que en el resto del sistema.
 */

/** El aviso a una persona, desde su fila del padrón. */
export function BotonInvitar({
  personaId,
  nombre,
  yaInvitada,
}: {
  personaId: string;
  nombre: string;
  /** Cambia la palabra del botón: no es lo mismo avisar que insistir. */
  yaInvitada: boolean;
}) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);

  async function enviar() {
    definirEnviando(true);
    const resultado = await invitarAlSistema(personaId);
    definirEnviando(false);

    if (!resultado.exito) {
      toast.error(resultado.error);
      return;
    }

    toast.success(resultado.mensaje ?? `Aviso enviado a ${nombre}.`);
    router.refresh();
  }

  return (
    <Boton
      variante="contorno"
      tamano="pequeno"
      cargando={enviando}
      onClick={enviar}
      title={`Enviar a ${nombre} el aviso para que ingrese`}
    >
      {enviando ? null : <Send className="size-3" />}
      {yaInvitada ? "Reenviar" : "Invitar"}
    </Boton>
  );
}

/**
 * El aviso a todos los pendientes, de a tandas.
 *
 * El número de la tanda lo decide el servidor, no esta pantalla: acá solo
 * se muestra lo que contestó.
 */
export function BotonInvitarAPendientes({ pendientes }: { pendientes: number }) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);

  async function enviar() {
    definirEnviando(true);
    const resultado = await invitarAPendientes();
    definirEnviando(false);

    if (!resultado.exito) {
      toast.error(resultado.error);
      return;
    }

    toast.success(resultado.mensaje ?? "Avisos enviados.");
    router.refresh();
  }

  if (pendientes === 0) return null;

  return (
    <Boton cargando={enviando} onClick={enviar}>
      {enviando ? null : <Send className="size-4" />}
      Invitar a los pendientes
    </Boton>
  );
}
