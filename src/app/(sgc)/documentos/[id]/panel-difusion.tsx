"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import {
  Dialogo,
  DialogoCabecera,
  DialogoCierre,
  DialogoContenido,
  DialogoDescripcion,
  DialogoPie,
  DialogoTitulo,
} from "@/components/ui/dialogo";
import { definirDifusion } from "@/app/(sgc)/documentos/acciones";

interface Elemento {
  id: string;
  nombre: string;
}

/**
 * Lista de difusion: personas y procesos alcanzados por el documento.
 * Son quienes reciben el aviso cuando se publica una version nueva.
 */
export function PanelDifusion({
  documentoId,
  personas,
  procesos,
  usuariosSeleccionados,
  procesosSeleccionados,
  puedeEditar,
}: {
  documentoId: string;
  personas: Elemento[];
  procesos: Elemento[];
  usuariosSeleccionados: string[];
  procesosSeleccionados: string[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [abierto, definirAbierto] = React.useState(false);
  const [procesando, definirProcesando] = React.useState(false);
  const [usuarios, definirUsuarios] = React.useState<string[]>(usuariosSeleccionados);
  const [procesosElegidos, definirProcesosElegidos] =
    React.useState<string[]>(procesosSeleccionados);

  function alternar(
    lista: string[],
    definir: React.Dispatch<React.SetStateAction<string[]>>,
    id: string,
  ) {
    definir(lista.includes(id) ? lista.filter((actual) => actual !== id) : [...lista, id]);
  }

  async function guardar() {
    definirProcesando(true);
    const resultado = await definirDifusion(documentoId, usuarios, procesosElegidos);
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Difusión actualizada.");
      definirAbierto(false);
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  const total = usuariosSeleccionados.length + procesosSeleccionados.length;

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-atenuado-contraste">
          {total === 0
            ? "Sin destinatarios definidos."
            : `${usuariosSeleccionados.length} persona${usuariosSeleccionados.length === 1 ? "" : "s"} y ${procesosSeleccionados.length} proceso${procesosSeleccionados.length === 1 ? "" : "s"} alcanzados.`}
        </p>
        {puedeEditar ? (
          <Boton variante="contorno" tamano="pequeno" onClick={() => definirAbierto(true)}>
            <Users /> Definir
          </Boton>
        ) : null}
      </div>

      <Dialogo open={abierto} onOpenChange={definirAbierto}>
        <DialogoContenido>
          <DialogoCabecera>
            <DialogoTitulo>Lista de difusión</DialogoTitulo>
            <DialogoDescripcion>
              Quienes figuren aquí reciben una notificación cada vez que se publica una versión
              nueva del documento.
            </DialogoDescripcion>
          </DialogoCabecera>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-semibold">Procesos completos</p>
              <div className="max-h-56 overflow-y-auto rounded-md border border-borde p-2">
                {procesos.map((proceso) => (
                  <label
                    key={proceso.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs
                               hover:bg-acento"
                  >
                    <input
                      type="checkbox"
                      className="size-3.5 accent-[#E01E37]"
                      checked={procesosElegidos.includes(proceso.id)}
                      onChange={() =>
                        alternar(procesosElegidos, definirProcesosElegidos, proceso.id)
                      }
                    />
                    {proceso.nombre}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold">Personas puntuales</p>
              <div className="max-h-56 overflow-y-auto rounded-md border border-borde p-2">
                {personas.map((persona) => (
                  <label
                    key={persona.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs
                               hover:bg-acento"
                  >
                    <input
                      type="checkbox"
                      className="size-3.5 accent-[#E01E37]"
                      checked={usuarios.includes(persona.id)}
                      onChange={() => alternar(usuarios, definirUsuarios, persona.id)}
                    />
                    {persona.nombre}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogoPie>
            <DialogoCierre asChild>
              <Boton variante="contorno">Cancelar</Boton>
            </DialogoCierre>
            <Boton onClick={guardar} disabled={procesando}>
              Guardar difusión
            </Boton>
          </DialogoPie>
        </DialogoContenido>
      </Dialogo>
    </>
  );
}
