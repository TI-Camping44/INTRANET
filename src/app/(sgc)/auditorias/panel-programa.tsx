"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, CheckCircle2 } from "lucide-react";
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
import { aprobarPrograma, crearProgramaAuditoria } from "@/app/(sgc)/auditorias/acciones";

/** Alta y aprobacion del programa anual de auditorias internas. */
export function PanelPrograma({
  programaId,
  estado,
  anioSugerido,
  puedeAprobar,
}: {
  programaId: string | null;
  estado: string | null;
  anioSugerido: number;
  puedeAprobar: boolean;
}) {
  const router = useRouter();
  const [abierto, definirAbierto] = React.useState(false);
  const [procesando, definirProcesando] = React.useState(false);

  async function crear(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirProcesando(true);
    const resultado = await crearProgramaAuditoria(new FormData(evento.currentTarget));
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Programa creado.");
      definirAbierto(false);
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  async function aprobar() {
    if (!programaId) return;
    definirProcesando(true);
    const resultado = await aprobarPrograma(programaId);
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Programa aprobado.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {programaId && estado === "planificada" && puedeAprobar ? (
          <Boton tamano="pequeno" onClick={aprobar} disabled={procesando}>
            <CheckCircle2 /> Aprobar programa
          </Boton>
        ) : null}
        <Boton variante="contorno" tamano="pequeno" onClick={() => definirAbierto(true)}>
          <CalendarPlus /> Nuevo programa anual
        </Boton>
      </div>

      <Dialogo open={abierto} onOpenChange={definirAbierto}>
        <DialogoContenido>
          <form onSubmit={crear}>
            <DialogoCabecera>
              <DialogoTitulo>Programa anual de auditorías</DialogoTitulo>
              <DialogoDescripcion>
                Agrupa las auditorías internas del ejercicio. Se aprueba una vez y luego se le
                van sumando las auditorías planificadas.
              </DialogoDescripcion>
            </DialogoCabecera>

            <div className="mt-4 space-y-3">
              <GrupoCampo etiqueta="Año" htmlFor="anio" requerido>
                <Entrada
                  id="anio"
                  name="anio"
                  type="number"
                  min={2000}
                  max={2100}
                  defaultValue={anioSugerido}
                  required
                  className="tabular"
                />
              </GrupoCampo>

              <GrupoCampo etiqueta="Nombre" htmlFor="nombre">
                <Entrada
                  id="nombre"
                  name="nombre"
                  placeholder={`Programa anual de auditorías ${anioSugerido}`}
                />
              </GrupoCampo>

              <GrupoCampo
                etiqueta="Objetivo"
                htmlFor="objetivo"
                ayuda="Qué se busca verificar durante el ejercicio."
              >
                <AreaTexto id="objetivo" name="objetivo" rows={3} />
              </GrupoCampo>
            </div>

            <DialogoPie className="mt-5">
              <DialogoCierre asChild>
                <Boton type="button" variante="contorno">
                  Cancelar
                </Boton>
              </DialogoCierre>
              <Boton type="submit" disabled={procesando}>
                Crear programa
              </Boton>
            </DialogoPie>
          </form>
        </DialogoContenido>
      </Dialogo>
    </>
  );
}
