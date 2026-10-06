"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Paperclip, Pencil, Plus, TriangleAlert, Trash2 } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Aviso, AvisoDescripcion } from "@/components/ui/aviso";
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
  actualizarHallazgo,
  eliminarHallazgo,
  generarNoConformidad,
} from "@/app/(sgc)/auditorias/acciones";
import { ETIQUETAS_TIPO_HALLAZGO, TIPOS_HALLAZGO_VIGENTES } from "@/lib/constantes";
import { describirTamano } from "@/lib/adjuntos";
import { hoyEnAsuncion, sumarDias } from "@/lib/formato";
import type { TipoHallazgo } from "@/lib/tipos";

interface Hallazgo {
  id: string;
  codigo: string | null;
  tipo: TipoHallazgo;
  requisito: string | null;
  descripcion: string;
  evidencia: string | null;
  proceso_id: string | null;
  no_conformidad_id: string | null;
  procesos: { nombre: string } | null;
  no_conformidad: { codigo: string; estado: string } | null;
  adjuntos?: { id: string; nombre_archivo: string; tamano_bytes: number }[] | null;
}

const VARIANTE: Record<
  TipoHallazgo,
  "peligro" | "atencion" | "advertencia" | "primaria" | "exito" | "contorno"
> = {
  no_conformidad_menor: "atencion",
  no_conformidad_mayor: "peligro",
  observacion: "advertencia",
  otro: "contorno",
  oportunidad_mejora: "primaria",
  fortaleza: "exito",
};

/** Un hallazgo genera no conformidad solo si es NC u observacion. */
function generaNoConformidad(tipo: TipoHallazgo): boolean {
  return (
    tipo === "no_conformidad_mayor" ||
    tipo === "no_conformidad_menor" ||
    tipo === "observacion"
  );
}

export function PanelHallazgos({
  auditoriaId,
  hallazgos,
  procesos,
  personas,
  puedeEditar,
}: {
  auditoriaId: string;
  hallazgos: Hallazgo[];
  procesos: { id: string; nombre: string }[];
  personas: { id: string; nombre_completo: string }[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [generando, definirGenerando] = React.useState<Hallazgo | null>(null);
  const [editando, definirEditando] = React.useState<Hallazgo | null>(null);
  const [procesando, definirProcesando] = React.useState(false);
  const [responsable, definirResponsable] = React.useState("");
  const [fechaLimite, definirFechaLimite] = React.useState(sumarDias(hoyEnAsuncion(), 30));

  const pendientes = hallazgos.filter(
    (hallazgo) => hallazgo.tipo.startsWith("no_conformidad") && !hallazgo.no_conformidad_id,
  ).length;

  async function generar() {
    if (!generando) return;
    definirProcesando(true);
    const resultado = await generarNoConformidad(
      generando.id,
      auditoriaId,
      responsable || null,
      fechaLimite || null,
    );
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "No conformidad generada.");
      definirGenerando(null);
      definirResponsable("");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  async function guardarEdicion(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!editando) return;

    definirProcesando(true);
    const resultado = await actualizarHallazgo(
      editando.id,
      auditoriaId,
      new FormData(evento.currentTarget),
    );
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Hallazgo actualizado.");
      definirEditando(null);
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  async function borrar(hallazgo: Hallazgo) {
    if (!confirm(`¿Eliminar el hallazgo ${hallazgo.codigo ?? ""}?`)) return;
    const resultado = await eliminarHallazgo(hallazgo.id, auditoriaId);
    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Hallazgo eliminado.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <div className="space-y-3">
      {pendientes > 0 ? (
        <Aviso variante="advertencia">
          <TriangleAlert />
          <AvisoDescripcion>
            Hay {pendientes} hallazgo{pendientes === 1 ? "" : "s"} de no conformidad sin su NC
            generada. La auditoría no se puede cerrar hasta tratarlos.
          </AvisoDescripcion>
        </Aviso>
      ) : null}

      {hallazgos.length === 0 ? (
        <EstadoVacio
          titulo="Sin hallazgos registrados"
          descripcion="«Registrar hallazgo» abre el módulo de No Conformidades, con el origen y el proceso de esta auditoría ya puestos."
        />
      ) : (
        <ul className="space-y-2">
          {hallazgos.map((hallazgo) => (
            <li key={hallazgo.id} className="rounded-md border border-borde p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    {hallazgo.codigo ? (
                      <span className="text-xs font-semibold tabular">{hallazgo.codigo}</span>
                    ) : null}
                    <Insignia variante={VARIANTE[hallazgo.tipo]}>
                      {ETIQUETAS_TIPO_HALLAZGO[hallazgo.tipo]}
                    </Insignia>
                    {hallazgo.requisito ? (
                      <span className="text-[11px] text-atenuado-contraste">
                        {hallazgo.requisito}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed">{hallazgo.descripcion}</p>
                  {hallazgo.evidencia ? (
                    <p className="mt-1.5 rounded bg-atenuado/60 p-2 text-[11px] leading-relaxed">
                      <span className="font-medium">Evidencia: </span>
                      {hallazgo.evidencia}
                    </p>
                  ) : null}
                  {hallazgo.adjuntos && hallazgo.adjuntos.length > 0 ? (
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {hallazgo.adjuntos.map((adjunto) => (
                        <li key={adjunto.id}>
                          {/* El enlace firmado se genera en el clic, en
                              la ruta /adjuntos/[id]. Acá solo va el id. */}
                          <a
                            href={`/adjuntos/${adjunto.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 rounded border border-borde
                                       px-2 py-1 text-[11px] transition-colors hover:bg-acento/60"
                          >
                            <Paperclip className="size-3 shrink-0 text-atenuado-contraste" />
                            <span className="max-w-[16rem] truncate">{adjunto.nombre_archivo}</span>
                            <span className="text-atenuado-contraste">
                              {describirTamano(adjunto.tamano_bytes)}
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {hallazgo.procesos ? (
                    <p className="mt-1 text-[11px] text-atenuado-contraste">
                      Proceso: {hallazgo.procesos.nombre}
                    </p>
                  ) : null}
                </div>

                {puedeEditar ? (
                  <span className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => definirEditando(hallazgo)}
                      className="text-atenuado-contraste transition-colors hover:text-primario"
                      aria-label="Editar hallazgo"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    {hallazgo.no_conformidad_id ? null : (
                      <button
                        type="button"
                        onClick={() => borrar(hallazgo)}
                        className="text-atenuado-contraste transition-colors hover:text-semaforo-critico"
                        aria-label="Eliminar hallazgo"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </span>
                ) : null}
              </div>

              {/* Puente con el módulo de No Conformidades */}
              <div className="mt-2.5 border-t border-borde pt-2.5">
                {hallazgo.no_conformidad_id ? (
                  <p className="text-[11px]">
                    <span className="text-atenuado-contraste">Generó la no conformidad </span>
                    <Link
                      href={`/no-conformidades/${hallazgo.no_conformidad_id}`}
                      className="font-medium text-primario hover:underline"
                    >
                      {hallazgo.no_conformidad?.codigo ?? "ver ficha"}
                    </Link>
                  </p>
                ) : generaNoConformidad(hallazgo.tipo) ? (
                  puedeEditar ? (
                    <Boton
                      tamano="pequeno"
                      variante="contorno"
                      onClick={() => definirGenerando(hallazgo)}
                    >
                      <TriangleAlert /> Generar no conformidad
                    </Boton>
                  ) : (
                    <p className="text-[11px] text-atenuado-contraste">
                      Pendiente de generar la no conformidad.
                    </p>
                  )
                ) : (
                  <p className="text-[11px] text-atenuado-contraste">
                    Este tipo de hallazgo no genera no conformidad.
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* «REGISTRAR HALLAZGO» ABRE EL MODULO DE NO CONFORMIDADES.
          Lo pidió Dirección el 6 de octubre. La NC se carga allá, con el
          origen y el proceso de esta auditoría ya puestos, y desde el
          encabezado de esa pantalla se vuelve acá.

          Queda sabido y aceptado lo que esto deja afuera: la auditoría no
          registra más hallazgos propios, así que no hay dónde anotar una
          observación, una oportunidad de mejora o una fortaleza, que no
          generan no conformidad. Los hallazgos ya cargados se siguen
          viendo y se siguen pudiendo editar y eliminar. */}
      {puedeEditar ? (
        <div className="flex justify-end">
          <Boton tamano="pequeno" variante="contorno" comoHijo>
            <Link href={`/no-conformidades/nueva?auditoria=${auditoriaId}`}>
              <Plus /> Registrar hallazgo
            </Link>
          </Boton>
        </div>
      ) : null}

      {/* Edición de un hallazgo ya registrado. Los archivos de evidencia
          no se tocan acá: se suman al registrarlo y se quitan desde su
          propia lista. */}
      <Dialogo
        open={editando !== null}
        onOpenChange={(abre) => (abre ? null : definirEditando(null))}
      >
        <DialogoContenido>
          {editando ? (
            <form onSubmit={guardarEdicion}>
              <DialogoCabecera>
                <DialogoTitulo>Editar el hallazgo {editando.codigo ?? ""}</DialogoTitulo>
                <DialogoDescripcion>
                  {editando.no_conformidad_id
                    ? "Ya generó una no conformidad: el tipo queda fijo para que las dos digan lo mismo. El texto sí se corrige."
                    : "El tipo decide si el hallazgo deriva en una no conformidad."}
                </DialogoDescripcion>
              </DialogoCabecera>

              <div className="mt-4 space-y-3">
                <GrupoCampo etiqueta="Tipo de hallazgo" htmlFor="tipo-editar" requerido>
                  <Seleccion
                    id="tipo-editar"
                    name="tipo"
                    defaultValue={editando.tipo}
                    disabled={Boolean(editando.no_conformidad_id)}
                  >
                    {TIPOS_HALLAZGO_VIGENTES.map((valor) => (
                      <option key={valor} value={valor}>
                        {ETIQUETAS_TIPO_HALLAZGO[valor]}
                      </option>
                    ))}
                  </Seleccion>
                </GrupoCampo>

                <GrupoCampo etiqueta="Descripción" htmlFor="descripcion-editar" requerido>
                  <AreaTexto
                    id="descripcion-editar"
                    name="descripcion"
                    rows={3}
                    required
                    minLength={15}
                    defaultValue={editando.descripcion}
                  />
                </GrupoCampo>

                <GrupoCampo
                  etiqueta="Evidencia objetiva"
                  htmlFor="evidencia-editar"
                  ayuda="Qué se verificó y cómo. Sostiene el hallazgo ante una auditoría externa."
                >
                  <AreaTexto
                    id="evidencia-editar"
                    name="evidencia"
                    rows={2}
                    defaultValue={editando.evidencia ?? ""}
                  />
                </GrupoCampo>

                <GrupoCampo etiqueta="Proceso" htmlFor="proceso-editar">
                  <Seleccion
                    id="proceso-editar"
                    name="proceso_id"
                    defaultValue={editando.proceso_id ?? ""}
                  >
                    <option value="">El de la auditoría</option>
                    {procesos.map((proceso) => (
                      <option key={proceso.id} value={proceso.id}>
                        {proceso.nombre}
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
                  Guardar cambios
                </Boton>
              </DialogoPie>
            </form>
          ) : null}
      </DialogoContenido>
      </Dialogo>

      {/* Generación de la no conformidad */}
      <Dialogo open={generando !== null} onOpenChange={(abre) => !abre && definirGenerando(null)}>
        <DialogoContenido>
          <DialogoCabecera>
            <DialogoTitulo>Generar no conformidad</DialogoTitulo>
            <DialogoDescripcion>
              Se crea la NC con la descripción y la evidencia del hallazgo, numerada
              automáticamente y vinculada a esta auditoría en ambos sentidos.
            </DialogoDescripcion>
          </DialogoCabecera>

          {generando ? (
            <div className="rounded-md bg-atenuado/60 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-atenuado-contraste">
                {generando.codigo} · {ETIQUETAS_TIPO_HALLAZGO[generando.tipo]}
              </p>
              <p className="mt-1 text-xs leading-relaxed">{generando.descripcion}</p>
            </div>
          ) : null}

          <div className="space-y-3">
            <GrupoCampo
              etiqueta="Responsable del tratamiento"
              htmlFor="responsable-nc"
              ayuda="Recibe la notificación de asignación."
            >
              <Seleccion
                id="responsable-nc"
                value={responsable}
                onChange={(evento) => definirResponsable(evento.target.value)}
              >
                <option value="">Asignar más adelante</option>
                {personas.map((persona) => (
                  <option key={persona.id} value={persona.id}>
                    {persona.nombre_completo}
                  </option>
                ))}
              </Seleccion>
            </GrupoCampo>

            <GrupoCampo etiqueta="Fecha límite de cierre" htmlFor="limite-nc">
              <Entrada
                id="limite-nc"
                type="date"
                min={hoyEnAsuncion()}
                value={fechaLimite}
                onChange={(evento) => definirFechaLimite(evento.target.value)}
              />
            </GrupoCampo>
          </div>

          <DialogoPie>
            <DialogoCierre asChild>
              <Boton variante="contorno">Cancelar</Boton>
            </DialogoCierre>
            <Boton onClick={generar} disabled={procesando}>
              Generar no conformidad
            </Boton>
          </DialogoPie>
        </DialogoContenido>
      </Dialogo>
    </div>
  );
}
