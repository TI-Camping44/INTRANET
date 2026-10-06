import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { Boton } from "@/components/ui/boton";
import {
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaTitulo,
} from "@/components/ui/tarjeta";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatearFecha } from "@/lib/formato";
import {
  CLASES_ESTADO_FORMACION,
  ETIQUETAS_ESTADO_FORMACION,
  ETIQUETAS_MODALIDAD,
  ETIQUETAS_TIPO_FORMACION,
  HORAS_PARA_EXIGIR_EFICACIA,
  type ModalidadFormacion,
} from "@/lib/formacion";
import { cn } from "@/lib/utilidades";
import { FormularioFormacion } from "@/app/(sgc)/recursos-humanos/formacion/formulario-formacion";
import { PanelEstado } from "@/app/(sgc)/recursos-humanos/formacion/[id]/panel-estado";
import { PanelEjecucion } from "@/app/(sgc)/recursos-humanos/formacion/[id]/panel-ejecucion";
import type { FilaFormacion } from "@/app/(sgc)/recursos-humanos/formacion/page";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const supabase = crearClienteServidor();
  const { data } = await supabase
    .from("capacitaciones")
    .select("nombre")
    .eq("id", params.id)
    .maybeSingle();

  return { title: data ? (data as { nombre: string }).nombre : "Formación" };
}

/**
 * La ficha de una acción formativa.
 *
 * Es donde se mueve el estado y donde queda la evidencia de que la
 * acción pasó. Tres caminos, según a dónde se la mueva:
 *
 *   · Ejecutada → se abre el registro de participación: quién asistió, y
 *     los certificados y demás evidencias que lo respalden.
 *   · No ejecutada o Pospuesta → se pide el motivo, y para la segunda
 *     también la nueva fecha prevista.
 *   · Planificada → es el estado en que nace y al que se puede volver.
 */
export default async function PaginaFormacion({ params }: { params: { id: string } }) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();
  const gestiona = puedeGestionar(usuario);

  const [{ data: consulta }, { data: participantes }, { data: archivos }, { data: personas }] =
    await Promise.all([
      supabase
        .from("capacitaciones")
        .select(
          "id, nombre, objetivo, modalidad, tipo, estado, instructor, fecha_inicio, fecha_fin, " +
            "fecha_nueva, cantidad_sesiones, horas_por_sesion, horas_totales, " +
            "requiere_eficacia, comentario_estado, formador:formador_id (nombre_completo)",
        )
        .eq("id", params.id)
        .maybeSingle(),
      supabase
        .from("capacitacion_participantes")
        .select("id, usuario_id, asistio, eficacia, usuarios:usuario_id (nombre_completo, correo)")
        .eq("capacitacion_id", params.id),
      supabase
        .from("adjuntos")
        .select("id, nombre_archivo, tamano_bytes, descripcion, creado_en")
        .eq("entidad", "capacitaciones")
        .eq("entidad_id", params.id)
        .order("creado_en", { ascending: false }),
      supabase
        .from("usuarios")
        .select("id, nombre_completo")
        .eq("activo", true)
        .order("nombre_completo"),
    ]);

  const formacion = consulta as unknown as FilaFormacion | null;
  if (!formacion) notFound();

  const participantesDeLaAccion =
    (participantes as
      | {
          id: string;
          usuario_id: string;
          asistio: boolean | null;
          eficacia: string | null;
          usuarios: { nombre_completo: string; correo: string } | null;
        }[]
      | null) ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <Boton variante="fantasma" tamano="pequeno" comoHijo className="mb-3 -ml-2">
        <Link href="/recursos-humanos/formacion">
          <ArrowLeft /> Volver al plan de formación
        </Link>
      </Boton>

      <EncabezadoPagina
        titulo={formacion.nombre}
        descripcion={formacion.objetivo ?? undefined}
        acciones={
          gestiona ? (
            <FormularioFormacion
              personas={(personas as { id: string; nombre_completo: string }[]) ?? []}
              formacion={formacion}
              participantesActuales={participantesDeLaAccion.map((fila) => fila.usuario_id)}
            />
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="space-y-4">
          <PanelEjecucion
            formacionId={formacion.id}
            estado={formacion.estado}
            requiereEficacia={formacion.requiere_eficacia}
            participantes={participantesDeLaAccion}
            archivos={
              (archivos as
                | {
                    id: string;
                    nombre_archivo: string;
                    tamano_bytes: number;
                    descripcion: string | null;
                    creado_en: string;
                  }[]
                | null) ?? []
            }
            puedeEditar={gestiona}
          />
        </div>

        <div className="space-y-4">
          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Estado</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido className="space-y-3">
              <div>
                <span
                  className={cn(
                    "inline-flex rounded border px-2 py-0.5 text-xs font-medium",
                    CLASES_ESTADO_FORMACION[formacion.estado],
                  )}
                >
                  {ETIQUETAS_ESTADO_FORMACION[formacion.estado] ?? formacion.estado}
                </span>
                {formacion.comentario_estado ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-atenuado-contraste">
                    {formacion.comentario_estado}
                  </p>
                ) : null}
                {formacion.fecha_nueva ? (
                  <p className="mt-1 text-[11px] text-atenuado-contraste">
                    Nueva fecha prevista:{" "}
                    <span className="font-medium">{formatearFecha(formacion.fecha_nueva)}</span>
                  </p>
                ) : null}
              </div>

              {gestiona ? (
                <PanelEstado formacionId={formacion.id} estado={formacion.estado} />
              ) : null}
            </TarjetaContenido>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Ficha</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido className="space-y-1.5 text-xs">
              <Dato etiqueta="Tipo" valor={ETIQUETAS_TIPO_FORMACION[formacion.tipo]} />
              <Dato
                etiqueta="Modalidad"
                valor={
                  formacion.modalidad
                    ? ETIQUETAS_MODALIDAD[formacion.modalidad as ModalidadFormacion]
                    : null
                }
              />
              <Dato
                etiqueta="Formador"
                valor={formacion.formador?.nombre_completo ?? formacion.instructor}
              />
              <Dato
                etiqueta="Desde"
                valor={formacion.fecha_inicio ? formatearFecha(formacion.fecha_inicio) : null}
              />
              <Dato
                etiqueta="Hasta"
                valor={formacion.fecha_fin ? formatearFecha(formacion.fecha_fin) : null}
              />
              <Dato
                etiqueta="Sesiones"
                valor={formacion.cantidad_sesiones ? String(formacion.cantidad_sesiones) : null}
              />
              <Dato
                etiqueta="Horas por sesión"
                valor={
                  formacion.horas_por_sesion ? String(Number(formacion.horas_por_sesion)) : null
                }
              />
              <Dato
                etiqueta="Horas totales"
                valor={formacion.horas_totales ? String(Number(formacion.horas_totales)) : null}
              />

              {formacion.requiere_eficacia ? (
                <p className="mt-2 rounded-md border border-semaforo-medio/40 bg-semaforo-medio/10 p-2 text-[11px] leading-relaxed text-semaforo-medio">
                  Supera las {HORAS_PARA_EXIGIR_EFICACIA} horas: exige Evaluación de Eficacia de
                  la Formación, que se verifica por persona.
                </p>
              ) : null}
            </TarjetaContenido>
          </Tarjeta>
        </div>
      </div>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null | undefined }) {
  return (
    <p className="flex items-baseline justify-between gap-3">
      <span className="text-atenuado-contraste">{etiqueta}</span>
      <span className="text-right font-medium">{valor ?? "—"}</span>
    </p>
  );
}
