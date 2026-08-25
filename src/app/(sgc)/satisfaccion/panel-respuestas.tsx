"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, MessageSquarePlus } from "lucide-react";
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
  Tabla,
  TablaCabecera,
  TablaCelda,
  TablaCuerpo,
  TablaEncabezado,
  TablaFila,
} from "@/components/ui/tabla";
import {
  generarNoConformidadDesdeRespuesta,
  registrarRespuesta,
} from "@/app/(sgc)/satisfaccion/acciones";
import { formatearFecha, hoyEnAsuncion } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { CANALES_RESPUESTA, etiquetaCategoriaNps, varianteCategoriaNps } from "@/lib/satisfaccion";

/** Cantidad maxima de filas que se dibujan de una sola vez. */
const MAXIMO_FILAS = 50;

type Filtro = "todas" | "con_comentario" | "detractores" | "sin_tratar";

const FILTROS: { clave: Filtro; etiqueta: string }[] = [
  { clave: "todas", etiqueta: "Todas" },
  { clave: "con_comentario", etiqueta: "Con comentario" },
  { clave: "detractores", etiqueta: "Detractores" },
  { clave: "sin_tratar", etiqueta: "Sin tratar" },
];

export interface Respuesta {
  id: string;
  encuesta_id: string;
  fecha: string;
  puntaje: number;
  categoria_nps: string;
  comentario: string | null;
  canal: string | null;
  no_conformidad_id: string | null;
  clientes: { razon_social: string } | null;
  sedes: { nombre: string } | null;
  no_conformidades: { codigo: string } | null;
}

/**
 * Respuestas de las encuestas. Lo que distingue a esta pantalla de un
 * informe es la ultima columna: el comentario de un detractor puede
 * abrirse como no conformidad sin salir de aqui. Medir sin actuar no
 * cierra ningun ciclo.
 */
export function PanelRespuestas({
  respuestas,
  encuestas,
  clientes,
  sedes,
  responsables,
  puedeGestionar,
  encuestaFija,
}: {
  respuestas: Respuesta[];
  encuestas: { id: string; codigo: string; nombre: string }[];
  clientes: { id: string; razon_social: string }[];
  sedes: { id: string; nombre: string }[];
  responsables: { id: string; nombre_completo: string }[];
  puedeGestionar: boolean;
  encuestaFija?: string;
}) {
  const router = useRouter();
  const [procesando, definirProcesando] = React.useState(false);
  const [abiertoAlta, definirAbiertoAlta] = React.useState(false);
  const [enReclamo, definirEnReclamo] = React.useState<Respuesta | null>(null);
  const [filtro, definirFiltro] = React.useState<Filtro>("todas");

  const filtradas = React.useMemo(() => {
    if (filtro === "detractores") {
      return respuestas.filter((respuesta) => respuesta.categoria_nps === "detractor");
    }
    if (filtro === "sin_tratar") {
      return respuestas.filter(
        (respuesta) =>
          respuesta.categoria_nps === "detractor" &&
          respuesta.comentario !== null &&
          respuesta.no_conformidad_id === null,
      );
    }
    if (filtro === "con_comentario") {
      return respuestas.filter((respuesta) => respuesta.comentario !== null);
    }
    return respuestas;
  }, [respuestas, filtro]);

  // Un listado de cientos de filas no se lee: se muestran las mas
  // recientes y los filtros llevan al resto.
  const visibles = filtradas.slice(0, MAXIMO_FILAS);

  async function cargar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirProcesando(true);
    const resultado = await registrarRespuesta(new FormData(evento.currentTarget));
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Respuesta registrada.");
      definirAbiertoAlta(false);
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  async function abrirReclamo(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!enReclamo) return;

    const datos = new FormData(evento.currentTarget);
    definirProcesando(true);
    const resultado = await generarNoConformidadDesdeRespuesta(
      enReclamo.id,
      enReclamo.encuesta_id,
      String(datos.get("responsable_id") ?? "") || null,
    );
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "No conformidad abierta.");
      definirEnReclamo(null);
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {FILTROS.map((opcion) => (
            <button
              key={opcion.clave}
              type="button"
              onClick={() => definirFiltro(opcion.clave)}
              className={cn(
                "rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors",
                filtro === opcion.clave
                  ? "border-primario/30 bg-primario/10 text-primario"
                  : "border-borde text-atenuado-contraste hover:text-texto",
              )}
            >
              {opcion.etiqueta}
            </button>
          ))}
        </div>
        {puedeGestionar ? (
          <Boton
            tamano="pequeno"
            variante="contorno"
            onClick={() => definirAbiertoAlta(true)}
            disabled={encuestas.length === 0}
          >
            <MessageSquarePlus /> Cargar respuesta
          </Boton>
        ) : null}
      </div>

      <p className="text-[11px] leading-relaxed text-atenuado-contraste">
        {filtradas.length === respuestas.length
          ? `${respuestas.length} respuesta${respuestas.length === 1 ? "" : "s"}`
          : `${filtradas.length} de ${respuestas.length} respuestas`}
        {visibles.length < filtradas.length ? `; se muestran las ${MAXIMO_FILAS} más recientes` : ""}
        . Un puntaje de 0 a 6 es un cliente detractor y su comentario puede abrirse como no
        conformidad.
      </p>

      {filtradas.length === 0 ? (
        <EstadoVacio
          titulo={
            respuestas.length === 0
              ? "Sin respuestas registradas"
              : "Ninguna respuesta cumple ese filtro"
          }
          descripcion={
            respuestas.length === 0
              ? "Las respuestas llegan por la ingesta del panel de NPS o se cargan a mano."
              : "Pruebe con otro filtro."
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <Tabla>
            <TablaCabecera>
              <TablaFila>
                <TablaEncabezado className="w-[6.5rem]">Fecha</TablaEncabezado>
                <TablaEncabezado className="hidden md:table-cell">Cliente</TablaEncabezado>
                <TablaEncabezado className="w-[4.5rem] text-center">Puntaje</TablaEncabezado>
                <TablaEncabezado className="w-[6.5rem]">Categoría</TablaEncabezado>
                <TablaEncabezado>Comentario</TablaEncabezado>
                <TablaEncabezado className="hidden w-[7rem] lg:table-cell">Canal</TablaEncabezado>
                <TablaEncabezado className="w-[11rem]">Tratamiento</TablaEncabezado>
              </TablaFila>
            </TablaCabecera>
            <TablaCuerpo>
              {visibles.map((respuesta) => (
                <TablaFila key={respuesta.id}>
                  <TablaCelda className="text-xs tabular">
                    {formatearFecha(respuesta.fecha)}
                  </TablaCelda>
                  <TablaCelda className="hidden text-xs md:table-cell">
                    {respuesta.clientes?.razon_social ?? "Anónimo"}
                  </TablaCelda>
                  <TablaCelda className="text-center text-xs font-semibold tabular">
                    {respuesta.puntaje}
                  </TablaCelda>
                  <TablaCelda>
                    <Insignia variante={varianteCategoriaNps(respuesta.categoria_nps)}>
                      {etiquetaCategoriaNps(respuesta.categoria_nps)}
                    </Insignia>
                  </TablaCelda>
                  <TablaCelda className="text-xs text-atenuado-contraste">
                    {respuesta.comentario ?? "Sin comentario"}
                  </TablaCelda>
                  <TablaCelda className="hidden text-xs text-atenuado-contraste lg:table-cell">
                    {respuesta.canal ?? "—"}
                  </TablaCelda>
                  <TablaCelda>
                    {respuesta.no_conformidad_id ? (
                      <Link
                        href={`/no-conformidades/${respuesta.no_conformidad_id}`}
                        className="text-xs tabular text-primario hover:underline"
                      >
                        {respuesta.no_conformidades?.codigo ?? "Ver no conformidad"}
                      </Link>
                    ) : respuesta.categoria_nps === "detractor" &&
                      respuesta.comentario &&
                      puedeGestionar ? (
                      <Boton
                        variante="fantasma"
                        tamano="pequeno"
                        disabled={procesando}
                        onClick={() => definirEnReclamo(respuesta)}
                      >
                        <AlertTriangle /> Abrir reclamo
                      </Boton>
                    ) : (
                      <span className="text-[11px] text-atenuado-contraste">—</span>
                    )}
                  </TablaCelda>
                </TablaFila>
              ))}
            </TablaCuerpo>
          </Tabla>
        </div>
      )}

      {/* Alta manual de una respuesta */}
      <Dialogo open={abiertoAlta} onOpenChange={definirAbiertoAlta}>
        <DialogoContenido>
          <form onSubmit={cargar}>
            <DialogoCabecera>
              <DialogoTitulo>Cargar respuesta</DialogoTitulo>
              <DialogoDescripcion>
                Para la respuesta que llega por teléfono o en el mostrador y que si no se carga se
                pierde.
              </DialogoDescripcion>
            </DialogoCabecera>

            <div className="my-4 space-y-3">
              {encuestaFija ? (
                <input type="hidden" name="encuesta_id" value={encuestaFija} />
              ) : (
                <GrupoCampo etiqueta="Encuesta" htmlFor="encuesta_id" requerido>
                  <Seleccion id="encuesta_id" name="encuesta_id" required>
                    {encuestas.map((encuesta) => (
                      <option key={encuesta.id} value={encuesta.id}>
                        {encuesta.codigo} · {encuesta.nombre}
                      </option>
                    ))}
                  </Seleccion>
                </GrupoCampo>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <GrupoCampo
                  etiqueta="Puntaje"
                  htmlFor="puntaje"
                  requerido
                  ayuda="De 0 a 10, como lo respondió el cliente."
                >
                  <Entrada
                    id="puntaje"
                    name="puntaje"
                    type="number"
                    min={0}
                    max={10}
                    required
                    className="tabular"
                  />
                </GrupoCampo>
                <GrupoCampo etiqueta="Fecha" htmlFor="fecha" requerido>
                  <Entrada
                    id="fecha"
                    name="fecha"
                    type="date"
                    defaultValue={hoyEnAsuncion()}
                    max={hoyEnAsuncion()}
                    required
                  />
                </GrupoCampo>
              </div>

              <GrupoCampo etiqueta="Cliente" htmlFor="cliente_id">
                <Seleccion id="cliente_id" name="cliente_id" defaultValue="">
                  <option value="">Anónimo</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.razon_social}
                    </option>
                  ))}
                </Seleccion>
              </GrupoCampo>

              <div className="grid gap-3 sm:grid-cols-2">
                <GrupoCampo etiqueta="Canal" htmlFor="canal">
                  <Seleccion id="canal" name="canal" defaultValue="">
                    <option value="">Sin indicar</option>
                    {CANALES_RESPUESTA.map((canal) => (
                      <option key={canal} value={canal}>
                        {canal}
                      </option>
                    ))}
                  </Seleccion>
                </GrupoCampo>
                <GrupoCampo etiqueta="Sede" htmlFor="sede_id">
                  <Seleccion id="sede_id" name="sede_id" defaultValue="">
                    <option value="">Sin indicar</option>
                    {sedes.map((sede) => (
                      <option key={sede.id} value={sede.id}>
                        {sede.nombre}
                      </option>
                    ))}
                  </Seleccion>
                </GrupoCampo>
              </div>

              <GrupoCampo
                etiqueta="Comentario"
                htmlFor="comentario"
                ayuda="Transcríbalo tal como lo dijo el cliente: es la evidencia del reclamo."
              >
                <AreaTexto id="comentario" name="comentario" rows={3} />
              </GrupoCampo>
            </div>

            <DialogoPie className="mt-5">
              <DialogoCierre asChild>
                <Boton type="button" variante="contorno">
                  Cancelar
                </Boton>
              </DialogoCierre>
              <Boton type="submit" cargando={procesando}>
                Registrar
              </Boton>
            </DialogoPie>
          </form>
        </DialogoContenido>
      </Dialogo>

      {/* Del detractor al reclamo formal */}
      <Dialogo
        open={enReclamo !== null}
        onOpenChange={(abierto) => {
          if (!abierto) definirEnReclamo(null);
        }}
      >
        <DialogoContenido>
          <form onSubmit={abrirReclamo}>
            <DialogoCabecera>
              <DialogoTitulo>Abrir no conformidad</DialogoTitulo>
              <DialogoDescripcion>
                Se crea con origen «reclamo de cliente» y el comentario como evidencia objetiva.
              </DialogoDescripcion>
            </DialogoCabecera>

            <div className="my-4 space-y-3">
              <blockquote className="border-l-2 border-primario bg-atenuado p-3 text-xs leading-relaxed">
                «{enReclamo?.comentario}»
                <footer className="mt-1.5 text-[11px] text-atenuado-contraste">
                  {enReclamo?.clientes?.razon_social ?? "Cliente anónimo"} · puntaje{" "}
                  {enReclamo?.puntaje} de 10 ·{" "}
                  {enReclamo ? formatearFecha(enReclamo.fecha) : ""}
                </footer>
              </blockquote>

              <GrupoCampo
                etiqueta="Responsable del tratamiento"
                htmlFor="responsable_id"
                ayuda="Puede asignarse después, pero sin responsable la no conformidad no avanza."
              >
                <Seleccion id="responsable_id" name="responsable_id" defaultValue="">
                  <option value="">Sin asignar por ahora</option>
                  {responsables.map((persona) => (
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
                Abrir no conformidad
              </Boton>
            </DialogoPie>
          </form>
        </DialogoContenido>
      </Dialogo>
    </div>
  );
}
