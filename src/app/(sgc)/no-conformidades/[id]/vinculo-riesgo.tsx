"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Link2, ShieldPlus, Unlink } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { InsigniaNivelRiesgo } from "@/components/comunes/insignias-estado";
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
  crearRiesgoDesdeNoConformidad,
  vincularRiesgoExistente,
} from "@/app/(sgc)/no-conformidades/acciones";
import { ESCALA_IMPACTO, ESCALA_PROBABILIDAD } from "@/lib/constantes";
import { etiquetaNivelRiesgo } from "@/lib/riesgos";
import { ETIQUETAS_NIVEL_RIESGO } from "@/lib/constantes";

interface RiesgoResumen {
  id: string;
  codigo: string;
  titulo: string;
  nivel: number;
}

/**
 * Puente entre No Conformidades y Riesgos. Cuando el analisis de causa
 * raiz revela un riesgo que la matriz no contemplaba, se lo crea desde
 * esta misma pantalla, sin salir del tratamiento de la desviacion.
 */
export function VinculoRiesgo({
  noConformidadId,
  riesgoVinculado,
  riesgosExistentes,
  causaRaiz,
  puedeEditar,
}: {
  noConformidadId: string;
  riesgoVinculado: RiesgoResumen | null;
  riesgosExistentes: RiesgoResumen[];
  causaRaiz: string | null;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [dialogoNuevo, definirDialogoNuevo] = React.useState(false);
  const [dialogoExistente, definirDialogoExistente] = React.useState(false);
  const [procesando, definirProcesando] = React.useState(false);
  const [probabilidad, definirProbabilidad] = React.useState(3);
  const [impacto, definirImpacto] = React.useState(3);
  const [seleccionado, definirSeleccionado] = React.useState("");

  const nivelPrevisto = probabilidad * impacto;
  const etiquetaPrevista = etiquetaNivelRiesgo(nivelPrevisto);

  async function crear(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirProcesando(true);
    const resultado = await crearRiesgoDesdeNoConformidad(
      noConformidadId,
      new FormData(evento.currentTarget),
    );
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Riesgo creado y vinculado.");
      definirDialogoNuevo(false);
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  async function vincular(riesgoId: string | null) {
    definirProcesando(true);
    const resultado = await vincularRiesgoExistente(noConformidadId, riesgoId);
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Vínculo actualizado.");
      definirDialogoExistente(false);
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <div className="space-y-3">
      {riesgoVinculado ? (
        <div className="rounded-md border border-borde p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={`/riesgos/${riesgoVinculado.id}`}
                className="text-xs font-medium hover:text-primario"
              >
                <span className="tabular text-atenuado-contraste">{riesgoVinculado.codigo}</span>{" "}
                {riesgoVinculado.titulo}
              </Link>
              <div className="mt-1.5">
                <InsigniaNivelRiesgo nivel={riesgoVinculado.nivel} />
              </div>
            </div>
            {puedeEditar ? (
              <Boton
                variante="fantasma"
                tamano="iconoPequeno"
                aria-label="Quitar vínculo"
                disabled={procesando}
                onClick={() => vincular(null)}
              >
                <Unlink />
              </Boton>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-[11px] leading-relaxed text-atenuado-contraste">
          Esta no conformidad no está vinculada a ningún riesgo de la matriz. Si el análisis de
          causa raíz reveló un riesgo no contemplado, créelo desde aquí.
        </p>
      )}

      {puedeEditar && !riesgoVinculado ? (
        <div className="flex flex-wrap gap-2">
          <Boton tamano="pequeno" onClick={() => definirDialogoNuevo(true)}>
            <ShieldPlus /> Crear riesgo desde la causa
          </Boton>
          <Boton
            tamano="pequeno"
            variante="contorno"
            onClick={() => definirDialogoExistente(true)}
          >
            <Link2 /> Vincular uno existente
          </Boton>
        </div>
      ) : null}

      {/* Crear riesgo nuevo */}
      <Dialogo open={dialogoNuevo} onOpenChange={definirDialogoNuevo}>
        <DialogoContenido>
          <form onSubmit={crear}>
            <DialogoCabecera>
              <DialogoTitulo>Crear riesgo desde la causa raíz</DialogoTitulo>
              <DialogoDescripcion>
                El riesgo se crea en la matriz con la causa raíz ya cargada y queda vinculado a
                esta no conformidad en ambos sentidos.
              </DialogoDescripcion>
            </DialogoCabecera>

            <div className="mt-4 space-y-3">
              <GrupoCampo etiqueta="Título del riesgo" htmlFor="titulo" requerido>
                <Entrada
                  id="titulo"
                  name="titulo"
                  required
                  minLength={5}
                  placeholder="Diferencias de inventario por conteo sin frecuencia definida"
                />
              </GrupoCampo>

              <GrupoCampo etiqueta="Descripción" htmlFor="descripcion">
                <AreaTexto id="descripcion" name="descripcion" rows={2} />
              </GrupoCampo>

              <GrupoCampo etiqueta="Categoría" htmlFor="categoria">
                <Entrada id="categoria" name="categoria" placeholder="Operativo" />
              </GrupoCampo>

              {causaRaiz ? (
                <div className="rounded-md bg-atenuado/60 p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-atenuado-contraste">
                    Causa raíz que se copiará al riesgo
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed">{causaRaiz}</p>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <GrupoCampo etiqueta="Probabilidad" htmlFor="probabilidad" requerido>
                  <Seleccion
                    id="probabilidad"
                    name="probabilidad"
                    value={probabilidad}
                    onChange={(evento) => definirProbabilidad(Number(evento.target.value))}
                  >
                    {ESCALA_PROBABILIDAD.map((nivel) => (
                      <option key={nivel.valor} value={nivel.valor}>
                        {nivel.valor} · {nivel.etiqueta}
                      </option>
                    ))}
                  </Seleccion>
                </GrupoCampo>

                <GrupoCampo etiqueta="Impacto" htmlFor="impacto" requerido>
                  <Seleccion
                    id="impacto"
                    name="impacto"
                    value={impacto}
                    onChange={(evento) => definirImpacto(Number(evento.target.value))}
                  >
                    {ESCALA_IMPACTO.map((nivel) => (
                      <option key={nivel.valor} value={nivel.valor}>
                        {nivel.valor} · {nivel.etiqueta}
                      </option>
                    ))}
                  </Seleccion>
                </GrupoCampo>
              </div>

              <p className="text-[11px] text-atenuado-contraste">
                Nivel resultante:{" "}
                <span className="font-semibold text-texto">
                  {nivelPrevisto} ·{" "}
                  {etiquetaPrevista ? ETIQUETAS_NIVEL_RIESGO[etiquetaPrevista] : "—"}
                </span>
              </p>
            </div>

            <DialogoPie className="mt-5">
              <DialogoCierre asChild>
                <Boton type="button" variante="contorno">
                  Cancelar
                </Boton>
              </DialogoCierre>
              <Boton type="submit" disabled={procesando}>
                Crear y vincular
              </Boton>
            </DialogoPie>
          </form>
        </DialogoContenido>
      </Dialogo>

      {/* Vincular existente */}
      <Dialogo open={dialogoExistente} onOpenChange={definirDialogoExistente}>
        <DialogoContenido>
          <DialogoCabecera>
            <DialogoTitulo>Vincular un riesgo existente</DialogoTitulo>
            <DialogoDescripcion>
              Seleccione el riesgo de la matriz con el que se relaciona esta desviación.
            </DialogoDescripcion>
          </DialogoCabecera>

          <GrupoCampo etiqueta="Riesgo" htmlFor="riesgo-existente" requerido>
            <Seleccion
              id="riesgo-existente"
              value={seleccionado}
              onChange={(evento) => definirSeleccionado(evento.target.value)}
            >
              <option value="">Seleccione un riesgo</option>
              {riesgosExistentes.map((riesgo) => (
                <option key={riesgo.id} value={riesgo.id}>
                  {riesgo.codigo} · {riesgo.titulo} (nivel {riesgo.nivel})
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <DialogoPie>
            <DialogoCierre asChild>
              <Boton variante="contorno">Cancelar</Boton>
            </DialogoCierre>
            <Boton disabled={procesando || !seleccionado} onClick={() => vincular(seleccionado)}>
              Vincular
            </Boton>
          </DialogoPie>
        </DialogoContenido>
      </Dialogo>
    </div>
  );
}
