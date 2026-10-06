"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo } from "@/components/ui/campo";
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
  actualizarProgramaAuditoria,
  eliminarProgramaAuditoria,
} from "@/app/(sgc)/auditorias/acciones";

/**
 * Edición y baja del programa anual, desde su ficha.
 *
 * La aprobación no está acá: vive en `PanelAprobacion`, que es el mismo
 * recorrido para el programa y para el plan de cada auditoría.
 *
 * EL AÑO NO ESTÁ EN EL FORMULARIO. Es lo que ata cada auditoría a su
 * programa: cambiarlo movería todas las del ejercicio de una sola vez,
 * sin que nadie lo pidiera. Un programa de otro año es otro programa.
 */
export function PanelFichaPrograma({
  programa,
  cuantasAuditorias,
}: {
  programa: { id: string; anio: number; nombre: string; objetivo: string | null; estado: string };
  cuantasAuditorias: number;
}) {
  const router = useRouter();
  const [abierto, definirAbierto] = React.useState(false);
  const [procesando, definirProcesando] = React.useState(false);

  async function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirProcesando(true);
    const resultado = await actualizarProgramaAuditoria(
      programa.id,
      new FormData(evento.currentTarget),
    );
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Guardado.");
      definirAbierto(false);
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  async function borrar() {
    if (
      !confirm(
        `¿Eliminar el programa «${programa.nombre}»? No se puede deshacer.`,
      )
    ) {
      return;
    }

    definirProcesando(true);
    const resultado = await eliminarProgramaAuditoria(programa.id);
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Programa eliminado.");
      definirAbierto(false);
      router.push("/auditorias");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <>
      <Boton variante="contorno" tamano="pequeno" onClick={() => definirAbierto(true)}>
        <Pencil /> Editar programa
      </Boton>

      <Dialogo open={abierto} onOpenChange={definirAbierto}>
        <DialogoContenido>
          <form onSubmit={guardar}>
            <DialogoCabecera>
              <DialogoTitulo>Programa anual {programa.anio}</DialogoTitulo>
              <DialogoDescripcion>
                El año no se edita: es lo que agrupa a las {cuantasAuditorias} auditoría
                {cuantasAuditorias === 1 ? "" : "s"} del ejercicio.
              </DialogoDescripcion>
            </DialogoCabecera>

            <div className="mt-4 space-y-3">
              <GrupoCampo etiqueta="Nombre" htmlFor="nombre" requerido>
                <Entrada
                  id="nombre"
                  name="nombre"
                  required
                  minLength={3}
                  defaultValue={programa.nombre}
                />
              </GrupoCampo>

              <GrupoCampo
                etiqueta="Objetivo"
                htmlFor="objetivo"
                ayuda="Qué se busca verificar durante el ejercicio."
              >
                <AreaTexto
                  id="objetivo"
                  name="objetivo"
                  rows={3}
                  defaultValue={programa.objetivo ?? ""}
                />
              </GrupoCampo>
            </div>

            <DialogoPie className="mt-5 sm:justify-between">
              <Boton
                type="button"
                variante="contorno"
                onClick={borrar}
                cargando={procesando}
                className="text-semaforo-critico hover:text-semaforo-critico"
              >
                <Trash2 /> Eliminar
              </Boton>

              <span className="flex gap-2">
                <DialogoCierre asChild>
                  <Boton type="button" variante="contorno">
                    Cancelar
                  </Boton>
                </DialogoCierre>
                <Boton type="submit" cargando={procesando}>
                  Guardar cambios
                </Boton>
              </span>
            </DialogoPie>
          </form>
        </DialogoContenido>
      </Dialogo>
    </>
  );
}
