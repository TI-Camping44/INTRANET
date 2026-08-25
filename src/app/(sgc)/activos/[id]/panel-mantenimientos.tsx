"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, CheckCircle2, XCircle } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import {
  Dialogo,
  DialogoCabecera,
  DialogoCierre,
  DialogoContenido,
  DialogoDescripcion,
  DialogoPie,
  DialogoTitulo,
} from "@/components/ui/dialogo";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia } from "@/components/ui/insignia";
import {
  cancelarMantenimiento,
  ejecutarMantenimiento,
  programarMantenimiento,
} from "@/app/(sgc)/activos/acciones";
import { describirVencimiento, formatearFecha, formatearGuaranies, hoyEnAsuncion, sumarDias } from "@/lib/formato";

interface Mantenimiento {
  id: string;
  tipo: string;
  descripcion: string | null;
  fecha_programada: string;
  fecha_ejecucion: string | null;
  estado: string;
  costo_gs: number;
  observacion: string | null;
  responsable: { nombre_completo: string } | null;
  proveedores: { razon_social: string } | null;
}

const ETIQUETAS_TIPO: Record<string, string> = {
  preventivo: "Preventivo",
  correctivo: "Correctivo",
  calibracion: "Calibración",
  verificacion: "Verificación",
};

const VARIANTE_ESTADO: Record<string, "neutra" | "advertencia" | "exito" | "peligro" | "contorno"> =
  {
    programado: "advertencia",
    en_curso: "neutra",
    ejecutado: "exito",
    vencido: "peligro",
    cancelado: "contorno",
  };

const ETIQUETAS_ESTADO: Record<string, string> = {
  programado: "Programado",
  en_curso: "En curso",
  ejecutado: "Ejecutado",
  vencido: "Vencido",
  cancelado: "Cancelado",
};

/**
 * Historial y agenda de mantenimientos del activo. Al cerrar uno, el
 * disparador de la base agenda el siguiente segun la frecuencia.
 */
export function PanelMantenimientos({
  activoId,
  mantenimientos,
  personas,
  proveedores,
  frecuenciaDias,
  puedeEditar,
}: {
  activoId: string;
  mantenimientos: Mantenimiento[];
  personas: { id: string; nombre_completo: string }[];
  proveedores: { id: string; razon_social: string }[];
  frecuenciaDias: number | null;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [dialogoAlta, definirDialogoAlta] = React.useState(false);
  const [cerrando, definirCerrando] = React.useState<Mantenimiento | null>(null);
  const [procesando, definirProcesando] = React.useState(false);
  const hoy = hoyEnAsuncion();

  async function programar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirProcesando(true);
    const resultado = await programarMantenimiento(activoId, new FormData(evento.currentTarget));
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Mantenimiento programado.");
      definirDialogoAlta(false);
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  async function ejecutar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!cerrando) return;
    definirProcesando(true);
    const resultado = await ejecutarMantenimiento(
      cerrando.id,
      activoId,
      new FormData(evento.currentTarget),
    );
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Mantenimiento ejecutado.");
      definirCerrando(null);
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  async function cancelar(mantenimiento: Mantenimiento) {
    if (!confirm("¿Cancelar este mantenimiento programado?")) return;
    const resultado = await cancelarMantenimiento(mantenimiento.id, activoId);
    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Mantenimiento cancelado.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <div className="space-y-3">
      {mantenimientos.length === 0 ? (
        <EstadoVacio
          titulo="Sin mantenimientos registrados"
          descripcion="Programe el primero para que el activo entre en el calendario preventivo."
        />
      ) : (
        <ul className="space-y-2">
          {mantenimientos.map((mantenimiento) => {
            const abierto =
              mantenimiento.estado === "programado" ||
              mantenimiento.estado === "en_curso" ||
              mantenimiento.estado === "vencido";
            const vencido = abierto && mantenimiento.fecha_programada < hoy;

            return (
              <li
                key={mantenimiento.id}
                className={`rounded-md border p-3 ${
                  vencido ? "border-semaforo-critico/40 bg-semaforo-critico/5" : "border-borde"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <Insignia variante="contorno">
                        {ETIQUETAS_TIPO[mantenimiento.tipo] ?? mantenimiento.tipo}
                      </Insignia>
                      <Insignia variante={VARIANTE_ESTADO[mantenimiento.estado] ?? "neutra"}>
                        {ETIQUETAS_ESTADO[mantenimiento.estado] ?? mantenimiento.estado}
                      </Insignia>
                    </p>
                    <p className="mt-1.5 text-xs leading-snug">
                      {mantenimiento.descripcion ?? "Sin detalle."}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-atenuado-contraste">
                      <span className={vencido ? "font-medium text-semaforo-critico" : ""}>
                        Programado: {formatearFecha(mantenimiento.fecha_programada)}
                        {abierto ? ` · ${describirVencimiento(mantenimiento.fecha_programada)}` : ""}
                      </span>
                      {mantenimiento.fecha_ejecucion ? (
                        <span>· Ejecutado: {formatearFecha(mantenimiento.fecha_ejecucion)}</span>
                      ) : null}
                      <span>· {mantenimiento.responsable?.nombre_completo ?? "Sin responsable"}</span>
                      {mantenimiento.proveedores ? (
                        <span>· {mantenimiento.proveedores.razon_social}</span>
                      ) : null}
                      {mantenimiento.costo_gs > 0 ? (
                        <span>· {formatearGuaranies(mantenimiento.costo_gs)}</span>
                      ) : null}
                    </p>
                    {mantenimiento.observacion ? (
                      <p className="mt-1.5 rounded bg-atenuado/60 p-2 text-[11px] leading-relaxed">
                        {mantenimiento.observacion}
                      </p>
                    ) : null}
                  </div>
                </div>

                {puedeEditar && abierto ? (
                  <div className="mt-2.5 flex flex-wrap gap-2 border-t border-borde pt-2.5">
                    <Boton
                      tamano="pequeno"
                      disabled={procesando}
                      onClick={() => definirCerrando(mantenimiento)}
                    >
                      <CheckCircle2 /> Registrar ejecución
                    </Boton>
                    <Boton
                      tamano="pequeno"
                      variante="fantasma"
                      disabled={procesando}
                      onClick={() => cancelar(mantenimiento)}
                    >
                      <XCircle /> Cancelar
                    </Boton>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {puedeEditar ? (
        <div className="flex justify-end">
          <Boton tamano="pequeno" variante="contorno" onClick={() => definirDialogoAlta(true)}>
            <CalendarPlus /> Programar mantenimiento
          </Boton>
        </div>
      ) : null}

      {/* Programación */}
      <Dialogo open={dialogoAlta} onOpenChange={definirDialogoAlta}>
        <DialogoContenido>
          <form onSubmit={programar}>
            <DialogoCabecera>
              <DialogoTitulo>Programar mantenimiento</DialogoTitulo>
              <DialogoDescripcion>
                Entra al calendario y su responsable recibe el aviso. El trabajo programado
                notifica de nuevo la semana previa.
              </DialogoDescripcion>
            </DialogoCabecera>

            <div className="mt-4 space-y-3">
              <GrupoCampo etiqueta="Tipo" htmlFor="tipo" requerido>
                <Seleccion id="tipo" name="tipo" defaultValue="preventivo">
                  {Object.entries(ETIQUETAS_TIPO).map(([valor, etiqueta]) => (
                    <option key={valor} value={valor}>
                      {etiqueta}
                    </option>
                  ))}
                </Seleccion>
              </GrupoCampo>

              <GrupoCampo etiqueta="Descripción" htmlFor="descripcion">
                <AreaTexto
                  id="descripcion"
                  name="descripcion"
                  rows={2}
                  placeholder="Limpieza de filtros y verificación de funcionamiento."
                />
              </GrupoCampo>

              <GrupoCampo
                etiqueta="Fecha programada"
                htmlFor="fecha_programada"
                requerido
                ayuda={
                  frecuenciaDias
                    ? `La frecuencia del activo es de ${frecuenciaDias} días.`
                    : undefined
                }
              >
                <Entrada
                  id="fecha_programada"
                  name="fecha_programada"
                  type="date"
                  defaultValue={sumarDias(hoy, frecuenciaDias ?? 30)}
                  required
                />
              </GrupoCampo>

              <GrupoCampo etiqueta="Responsable" htmlFor="responsable_id">
                <Seleccion id="responsable_id" name="responsable_id">
                  <option value="">Sin asignar</option>
                  {personas.map((persona) => (
                    <option key={persona.id} value={persona.id}>
                      {persona.nombre_completo}
                    </option>
                  ))}
                </Seleccion>
              </GrupoCampo>

              <GrupoCampo etiqueta="Proveedor del servicio" htmlFor="proveedor_id">
                <Seleccion id="proveedor_id" name="proveedor_id">
                  <option value="">Interno</option>
                  {proveedores.map((proveedor) => (
                    <option key={proveedor.id} value={proveedor.id}>
                      {proveedor.razon_social}
                    </option>
                  ))}
                </Seleccion>
              </GrupoCampo>

              <GrupoCampo etiqueta="Costo estimado (Gs.)" htmlFor="costo_gs">
                <Entrada id="costo_gs" name="costo_gs" inputMode="numeric" className="tabular" />
              </GrupoCampo>
            </div>

            <DialogoPie className="mt-5">
              <DialogoCierre asChild>
                <Boton type="button" variante="contorno">
                  Cancelar
                </Boton>
              </DialogoCierre>
              <Boton type="submit" disabled={procesando}>
                Programar
              </Boton>
            </DialogoPie>
          </form>
        </DialogoContenido>
      </Dialogo>

      {/* Ejecución */}
      <Dialogo open={cerrando !== null} onOpenChange={(abre) => !abre && definirCerrando(null)}>
        <DialogoContenido>
          <form onSubmit={ejecutar}>
            <DialogoCabecera>
              <DialogoTitulo>Registrar la ejecución</DialogoTitulo>
              <DialogoDescripcion>
                Al cerrarlo, el siguiente mantenimiento queda agendado según la frecuencia del
                activo, y el activo vuelve a estar operativo si estaba en mantenimiento.
              </DialogoDescripcion>
            </DialogoCabecera>

            <div className="mt-4 space-y-3">
              <GrupoCampo etiqueta="Fecha de ejecución" htmlFor="fecha_ejecucion" requerido>
                <Entrada
                  id="fecha_ejecucion"
                  name="fecha_ejecucion"
                  type="date"
                  defaultValue={hoy}
                  max={hoy}
                  required
                />
              </GrupoCampo>

              <GrupoCampo etiqueta="Costo real (Gs.)" htmlFor="costo_gs">
                <Entrada
                  id="costo_gs"
                  name="costo_gs"
                  inputMode="numeric"
                  defaultValue={cerrando?.costo_gs || ""}
                  className="tabular"
                />
              </GrupoCampo>

              <GrupoCampo
                etiqueta="Observación"
                htmlFor="observacion"
                ayuda="Qué se hizo y qué quedó pendiente. Es la evidencia del mantenimiento."
              >
                <AreaTexto id="observacion" name="observacion" rows={3} />
              </GrupoCampo>
            </div>

            <DialogoPie className="mt-5">
              <DialogoCierre asChild>
                <Boton type="button" variante="contorno">
                  Cancelar
                </Boton>
              </DialogoCierre>
              <Boton type="submit" disabled={procesando}>
                Registrar ejecución
              </Boton>
            </DialogoPie>
          </form>
        </DialogoContenido>
      </Dialogo>
    </div>
  );
}
