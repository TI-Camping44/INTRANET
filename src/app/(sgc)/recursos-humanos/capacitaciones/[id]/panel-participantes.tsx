"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, UserPlus } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, GrupoCampo, Seleccion } from "@/components/ui/campo";
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
  Tabla,
  TablaCabecera,
  TablaCelda,
  TablaCuerpo,
  TablaEncabezado,
  TablaFila,
} from "@/components/ui/tabla";
import {
  cambiarEstadoCapacitacion,
  inscribirParticipantes,
  registrarAsistencia,
  verificarEficacia,
} from "@/app/(sgc)/recursos-humanos/acciones";
import { ETIQUETAS_EFICACIA, ETIQUETAS_ESTADO_CAPACITACION } from "@/lib/constantes";
import { formatearFecha, formatearNumero } from "@/lib/formato";
import type { EstadoCapacitacion, ResultadoEficacia } from "@/lib/tipos";

export interface Participante {
  id: string;
  usuario_id: string;
  asistio: boolean;
  calificacion: number | null;
  eficacia: ResultadoEficacia;
  fecha_evaluacion_eficacia: string | null;
  observacion: string | null;
  usuarios: { nombre_completo: string; puestos: { nombre: string } | null } | null;
}

const VARIANTE_EFICACIA: Record<ResultadoEficacia, "exito" | "advertencia" | "peligro" | "neutra"> =
  {
    eficaz: "exito",
    parcialmente_eficaz: "advertencia",
    no_eficaz: "peligro",
    pendiente: "neutra",
  };

/**
 * Participantes de una capacitacion: inscripcion, asistencia y
 * verificacion de eficacia. La eficacia es lo que exige ISO 9001 7.2: no
 * alcanza con dictar el curso, hay que comprobar que sirvio.
 */
export function PanelParticipantes({
  capacitacionId,
  participantes,
  personas,
  puedeEditar,
}: {
  capacitacionId: string;
  participantes: Participante[];
  personas: { id: string; nombre_completo: string }[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [procesando, definirProcesando] = React.useState(false);
  const [abiertoInscribir, definirAbiertoInscribir] = React.useState(false);
  const [enEficacia, definirEnEficacia] = React.useState<Participante | null>(null);

  const inscriptos = new Set(participantes.map((participante) => participante.usuario_id));
  const disponibles = personas.filter((persona) => !inscriptos.has(persona.id));

  async function ejecutar(tarea: () => Promise<{ exito: boolean; mensaje?: string; error?: string }>) {
    definirProcesando(true);
    const resultado = await tarea();
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Listo.");
      router.refresh();
      return true;
    }

    toast.error(resultado.error ?? "No se pudo completar la operación.");
    return false;
  }

  async function inscribir(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    const nuevos = datos.getAll("usuarios").map(String).filter(Boolean);

    if (nuevos.length === 0) {
      toast.error("Seleccione al menos una persona.");
      return;
    }

    const completos = [...participantes.map((participante) => participante.usuario_id), ...nuevos];
    if (await ejecutar(() => inscribirParticipantes(capacitacionId, completos))) {
      definirAbiertoInscribir(false);
    }
  }

  async function guardarEficacia(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!enEficacia) return;

    const datos = new FormData(evento.currentTarget);
    const resultado = datos.get("eficacia") as ResultadoEficacia;
    const observacion = String(datos.get("observacion") ?? "");

    if (
      await ejecutar(() =>
        verificarEficacia(enEficacia.id, capacitacionId, resultado, observacion),
      )
    ) {
      definirEnEficacia(null);
    }
  }

  return (
    <div className="space-y-3">
      {puedeEditar ? (
        <div className="flex justify-end">
          <Boton
            tamano="pequeno"
            onClick={() => definirAbiertoInscribir(true)}
            disabled={disponibles.length === 0}
          >
            <UserPlus /> Inscribir personas
          </Boton>
        </div>
      ) : null}

      {participantes.length === 0 ? (
        <EstadoVacio
          titulo="Sin participantes inscriptos"
          descripcion="Inscriba a quienes deban asistir; el sistema les avisa por correo y en la campana."
        />
      ) : (
        <div className="overflow-x-auto">
          <Tabla>
            <TablaCabecera>
              <TablaFila>
                <TablaEncabezado>Persona</TablaEncabezado>
                <TablaEncabezado className="hidden md:table-cell">Puesto</TablaEncabezado>
                <TablaEncabezado className="w-[6rem] text-center">Asistió</TablaEncabezado>
                <TablaEncabezado className="w-[7rem] text-right">Calificación</TablaEncabezado>
                <TablaEncabezado className="w-[11rem]">Eficacia</TablaEncabezado>
                {puedeEditar ? <TablaEncabezado className="w-[7rem]" /> : null}
              </TablaFila>
            </TablaCabecera>
            <TablaCuerpo>
              {participantes.map((participante) => (
                <TablaFila key={participante.id}>
                  <TablaCelda className="text-xs font-medium">
                    {participante.usuarios?.nombre_completo ?? "—"}
                  </TablaCelda>
                  <TablaCelda className="hidden text-xs text-atenuado-contraste md:table-cell">
                    {participante.usuarios?.puestos?.nombre ?? "—"}
                  </TablaCelda>
                  <TablaCelda className="text-center">
                    {puedeEditar ? (
                      <input
                        type="checkbox"
                        checked={participante.asistio}
                        disabled={procesando}
                        aria-label={`Asistencia de ${participante.usuarios?.nombre_completo ?? ""}`}
                        className="size-4 accent-[hsl(var(--primario))]"
                        onChange={(evento) =>
                          ejecutar(() =>
                            registrarAsistencia(
                              participante.id,
                              capacitacionId,
                              evento.target.checked,
                              participante.calificacion,
                            ),
                          )
                        }
                      />
                    ) : (
                      <span className="text-xs">{participante.asistio ? "Sí" : "No"}</span>
                    )}
                  </TablaCelda>
                  <TablaCelda className="text-right text-xs tabular">
                    {participante.calificacion === null
                      ? "—"
                      : formatearNumero(Number(participante.calificacion), 1)}
                  </TablaCelda>
                  <TablaCelda>
                    <Insignia variante={VARIANTE_EFICACIA[participante.eficacia]}>
                      {ETIQUETAS_EFICACIA[participante.eficacia]}
                    </Insignia>
                    {participante.fecha_evaluacion_eficacia ? (
                      <span className="ml-2 text-[10px] tabular text-atenuado-contraste">
                        {formatearFecha(participante.fecha_evaluacion_eficacia)}
                      </span>
                    ) : null}
                  </TablaCelda>
                  {puedeEditar ? (
                    <TablaCelda>
                      <Boton
                        variante="fantasma"
                        tamano="pequeno"
                        disabled={!participante.asistio || procesando}
                        onClick={() => definirEnEficacia(participante)}
                      >
                        <CheckCircle2 /> Verificar
                      </Boton>
                    </TablaCelda>
                  ) : null}
                </TablaFila>
              ))}
            </TablaCuerpo>
          </Tabla>
        </div>
      )}

      {participantes.some(
        (participante) => participante.asistio && participante.eficacia === "pendiente",
      ) ? (
        <p className="text-[11px] text-atenuado-contraste">
          Quedan asistentes sin verificar la eficacia. La capacitación no se considera cerrada
          hasta que cada uno tenga su resultado registrado.
        </p>
      ) : null}

      <Dialogo open={abiertoInscribir} onOpenChange={definirAbiertoInscribir}>
        <DialogoContenido>
          <form onSubmit={inscribir}>
            <DialogoCabecera>
              <DialogoTitulo>Inscribir personas</DialogoTitulo>
              <DialogoDescripcion>
                Cada persona inscripta recibe un aviso con la fecha prevista.
              </DialogoDescripcion>
            </DialogoCabecera>

            <div className="my-4 max-h-72 space-y-1.5 overflow-y-auto rounded-md border border-borde p-3">
              {disponibles.map((persona) => (
                <label
                  key={persona.id}
                  className="flex items-center gap-2 text-xs hover:text-primario"
                >
                  <input
                    type="checkbox"
                    name="usuarios"
                    value={persona.id}
                    className="size-3.5 accent-[hsl(var(--primario))]"
                  />
                  {persona.nombre_completo}
                </label>
              ))}
            </div>

            <DialogoPie className="mt-5">
              <DialogoCierre asChild>
                <Boton type="button" variante="contorno">
                  Cancelar
                </Boton>
              </DialogoCierre>
              <Boton type="submit" disabled={procesando}>
                Inscribir
              </Boton>
            </DialogoPie>
          </form>
        </DialogoContenido>
      </Dialogo>

      <Dialogo
        open={enEficacia !== null}
        onOpenChange={(abierto) => {
          if (!abierto) definirEnEficacia(null);
        }}
      >
        <DialogoContenido>
          <form onSubmit={guardarEficacia}>
            <DialogoCabecera>
              <DialogoTitulo>Verificar eficacia</DialogoTitulo>
              <DialogoDescripcion>
                {enEficacia?.usuarios?.nombre_completo ?? ""} · indique cómo se comprobó que la
                capacitación sirvió.
              </DialogoDescripcion>
            </DialogoCabecera>

            <div className="my-4 space-y-3">
              <GrupoCampo etiqueta="Resultado" htmlFor="eficacia" requerido>
                <Seleccion id="eficacia" name="eficacia" defaultValue={enEficacia?.eficacia}>
                  {(Object.keys(ETIQUETAS_EFICACIA) as ResultadoEficacia[]).map((clave) => (
                    <option key={clave} value={clave}>
                      {ETIQUETAS_EFICACIA[clave]}
                    </option>
                  ))}
                </Seleccion>
              </GrupoCampo>

              <GrupoCampo
                etiqueta="Cómo se verificó"
                htmlFor="observacion"
                ayuda="Observación en el puesto, examen, indicador que mejoró, auditoría interna."
              >
                <AreaTexto
                  id="observacion"
                  name="observacion"
                  rows={3}
                  defaultValue={enEficacia?.observacion ?? ""}
                />
              </GrupoCampo>
            </div>

            <DialogoPie className="mt-5">
              <Boton type="button" variante="contorno" onClick={() => definirEnEficacia(null)}>
                Cancelar
              </Boton>
              <Boton type="submit" disabled={procesando}>
                Guardar
              </Boton>
            </DialogoPie>
          </form>
        </DialogoContenido>
      </Dialogo>
    </div>
  );
}

/**
 * Cambia el estado de la capacitacion. Es un control aparte porque el
 * ciclo (planificada, en curso, finalizada) es del curso, no de cada
 * participante.
 */
export function SelectorEstadoCapacitacion({
  capacitacionId,
  estado,
}: {
  capacitacionId: string;
  estado: EstadoCapacitacion;
}) {
  const router = useRouter();
  const [procesando, definirProcesando] = React.useState(false);

  return (
    <Seleccion
      value={estado}
      disabled={procesando}
      aria-label="Estado de la capacitación"
      className="h-8 w-auto text-xs"
      onChange={async (evento) => {
        definirProcesando(true);
        const resultado = await cambiarEstadoCapacitacion(capacitacionId, evento.target.value);
        definirProcesando(false);

        if (resultado.exito) {
          toast.success(resultado.mensaje ?? "Estado actualizado.");
          router.refresh();
        } else {
          toast.error(resultado.error);
        }
      }}
    >
      {(Object.keys(ETIQUETAS_ESTADO_CAPACITACION) as EstadoCapacitacion[]).map((clave) => (
        <option key={clave} value={clave}>
          {ETIQUETAS_ESTADO_CAPACITACION[clave]}
        </option>
      ))}
    </Seleccion>
  );
}
