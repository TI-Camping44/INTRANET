"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MailCheck, Send } from "lucide-react";
import { toast } from "sonner";

import { Boton } from "@/components/ui/boton";
import {
  enviarInvitacionDePrueba,
  invitarAlSistema,
  invitarAPendientes,
} from "@/app/(sgc)/administracion/usuarios/invitaciones";

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

/**
 * Manda el aviso al propio administrador, para verlo antes de mandárselo
 * a nadie.
 *
 * VA PRIMERO Y EN SECUNDARIO. Primero porque es lo que corresponde hacer
 * antes de tocar el otro botón; en secundario porque el que importa es el
 * que invita de verdad, y dos botones iguales al lado dejan la pantalla
 * sin decir cuál es cuál.
 */
export function BotonProbarCorreo() {
  const [enviando, definirEnviando] = React.useState(false);

  async function enviar() {
    definirEnviando(true);
    const resultado = await enviarInvitacionDePrueba();
    definirEnviando(false);

    if (!resultado.exito) {
      toast.error(resultado.error);
      return;
    }

    toast.success(resultado.mensaje ?? "Prueba enviada.");
  }

  return (
    <Boton
      variante="contorno"
      cargando={enviando}
      onClick={enviar}
      title="Se lo manda a usted mismo, sin tocar el padrón"
    >
      {enviando ? null : <MailCheck className="size-4" />}
      Probar el correo conmigo
    </Boton>
  );
}
