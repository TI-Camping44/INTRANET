import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import {
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaTitulo,
} from "@/components/ui/tarjeta";
import { obtenerPermisos, requerirModulo } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { hoyEnAsuncion } from "@/lib/formato";
import {
  ETIQUETAS_ESTADO_PERIODO,
  ETIQUETAS_FRECUENCIA,
  VARIANTE_ESTADO_PERIODO,
  describirPeriodo,
  esFrecuencia,
  estadoDelPeriodo,
  periodosPendientes,
  proximoPeriodo,
} from "@/lib/controles-ti";
import {
  PanelEjecuciones,
  type EjecucionDelControl,
} from "@/app/(sgc)/informatica/controles/[id]/panel-ejecuciones";

export const metadata: Metadata = { title: "Control de TI" };
export const dynamic = "force-dynamic";

interface Control {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  documento_origen: string | null;
  formulario: string | null;
  frecuencia_meses: number;
  primer_periodo: string;
  vigente: boolean;
  responsable: { nombre_completo: string } | null;
}

/**
 * Ficha del control: qué es, de dónde sale, cuándo toca y el historial
 * de cada vez que se hizo, con su evidencia.
 */
export default async function PaginaControl({ params }: { params: { id: string } }) {
  await requerirModulo("informatica");
  const permisos = await obtenerPermisos();
  const puedeEditar = permisos.informatica.editar;
  const supabase = crearClienteServidor();

  const { data } = await supabase
    .from("controles_ti")
    .select(
      "id, codigo, nombre, descripcion, documento_origen, formulario, frecuencia_meses, " +
        "primer_periodo, vigente, responsable:responsable_id (nombre_completo)",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!data) notFound();
  const control = data as unknown as Control;

  const { data: datosEjecuciones } = await supabase
    .from("control_ti_ejecuciones")
    .select(
      "id, periodo, fecha_ejecucion, resultado, observaciones, " +
        "ejecutor:ejecutado_por (nombre_completo)",
    )
    .eq("control_id", control.id)
    .order("periodo", { ascending: false });

  const filas = (datosEjecuciones ?? []) as unknown as Omit<EjecucionDelControl, "evidencias">[];

  // La evidencia se busca aparte, en una sola consulta para todo el
  // historial: `adjuntos` es genérica y no tiene una clave foránea que
  // PostgREST sepa seguir.
  const { data: datosAdjuntos } = filas.length
    ? await supabase
        .from("adjuntos")
        .select("id, entidad_id, nombre_archivo, tamano_bytes")
        .eq("entidad", "control_ti_ejecuciones")
        .in(
          "entidad_id",
          filas.map((fila) => fila.id),
        )
        .order("creado_en")
    : { data: [] };

  const adjuntos = (datosAdjuntos ?? []) as {
    id: string;
    entidad_id: string;
    nombre_archivo: string;
    tamano_bytes: number | null;
  }[];

  const ejecuciones: EjecucionDelControl[] = filas.map((fila) => ({
    ...fila,
    evidencias: adjuntos.filter((adjunto) => adjunto.entidad_id === fila.id),
  }));

  const hoy = hoyEnAsuncion();
  const ejecutados = new Set(ejecuciones.map((ejecucion) => ejecucion.periodo));
  const pendientes = control.vigente ? periodosPendientes(control, ejecutados, hoy) : [];
  const proximo = control.vigente ? proximoPeriodo(control, ejecutados, hoy) : null;
  const estadoProximo = proximo ? estadoDelPeriodo(proximo, false, hoy) : null;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link
          href="/informatica/controles"
          className="inline-flex items-center gap-1 text-xs text-atenuado-contraste hover:text-texto"
        >
          <ArrowLeft className="size-3" aria-hidden />
          Cronograma
        </Link>
      </div>

      <EncabezadoPagina
        titulo={`${control.codigo} · ${control.nombre}`}
        descripcion={control.descripcion ?? undefined}
        acciones={
          puedeEditar ? (
            <Boton comoHijo variante="contorno" tamano="pequeno">
              <Link href={`/informatica/controles/${control.id}/editar`}>
                <Pencil aria-hidden />
                Editar
              </Link>
            </Boton>
          ) : null
        }
      />

      <Tarjeta>
        <TarjetaContenido className="pt-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-3">
            <div>
              <dt className="text-atenuado-contraste">Proceso que lo exige</dt>
              <dd className="mt-0.5 font-medium">{control.documento_origen ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-atenuado-contraste">Formulario</dt>
              <dd className="mt-0.5 font-medium">{control.formulario ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-atenuado-contraste">Frecuencia</dt>
              <dd className="mt-0.5 font-medium">
                {esFrecuencia(control.frecuencia_meses)
                  ? ETIQUETAS_FRECUENCIA[control.frecuencia_meses]
                  : `Cada ${control.frecuencia_meses} meses`}
                <span className="font-normal text-atenuado-contraste">
                  {" "}
                  · desde {describirPeriodo(control.primer_periodo)}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-atenuado-contraste">Responsable</dt>
              <dd className="mt-0.5 font-medium">
                {control.responsable?.nombre_completo ?? "Sin responsable"}
              </dd>
            </div>
            <div>
              <dt className="text-atenuado-contraste">Próximo período</dt>
              <dd className="mt-0.5 flex flex-wrap items-center gap-1.5 font-medium">
                {proximo && estadoProximo ? (
                  <>
                    {describirPeriodo(proximo)}
                    <Insignia variante={VARIANTE_ESTADO_PERIODO[estadoProximo]}>
                      {ETIQUETAS_ESTADO_PERIODO[estadoProximo]}
                    </Insignia>
                  </>
                ) : (
                  "No se programa"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-atenuado-contraste">Estado</dt>
              <dd className="mt-0.5">
                <Insignia variante={control.vigente ? "exito" : "neutra"}>
                  {control.vigente ? "Vigente" : "No vigente"}
                </Insignia>
              </dd>
            </div>
          </dl>
        </TarjetaContenido>
      </Tarjeta>

      <Tarjeta>
        <TarjetaCabecera>
          <TarjetaTitulo>Ejecuciones</TarjetaTitulo>
        </TarjetaCabecera>
        <TarjetaContenido>
          <PanelEjecuciones
            controlId={control.id}
            ejecuciones={ejecuciones}
            pendientes={pendientes}
            hoy={hoy}
            puedeEditar={puedeEditar}
          />
        </TarjetaContenido>
      </Tarjeta>
    </div>
  );
}
