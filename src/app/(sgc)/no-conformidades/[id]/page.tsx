import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ListChecks, Pencil } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import {
  InsigniaDemostracion,
  InsigniaSeveridad,
} from "@/components/comunes/insignias-estado";
import { EliminarNoConformidad } from "@/app/(sgc)/no-conformidades/[id]/eliminar-no-conformidad";
import { LineaEstados } from "@/app/(sgc)/no-conformidades/[id]/linea-estados";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import {
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaTitulo,
} from "@/components/ui/tarjeta";
import { esSoloLectura, puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { DEPARTAMENTOS, ETIQUETAS_ORIGEN_NC } from "@/lib/constantes";
import { formatearFecha } from "@/lib/formato";
import {
  cierreSugerido,
  CLASES_TEXTO_PASO_NC,
  estaCerrada,
  estaVencida,
  pasoDeNoConformidad,
  textoDePlazo,
} from "@/lib/no-conformidades";
import { cn } from "@/lib/utilidades";
import type {
  Departamento,
  EstadoNoConformidad,
  OrigenNoConformidad,
  SeveridadNoConformidad,
} from "@/lib/tipos";

export const dynamic = "force-dynamic";

interface ResumenNoConformidad {
  id: string;
  codigo: string;
  titulo: string;
  descripcion: string;
  consecuencias: string | null;
  origen: OrigenNoConformidad;
  severidad: SeveridadNoConformidad;
  estado: EstadoNoConformidad;
  cierre_en_plazo: boolean | null;
  area: Departamento | null;
  hay_nc_similares: boolean | null;
  analisis_horizontal: string | null;
  correccion_inmediata: string | null;
  propuestas_mejora: string[] | null;
  fecha_deteccion: string;
  fecha_limite_cierre: string | null;
  fecha_cierre: string | null;
  es_demostracion: boolean;
  detectado_por: string | null;
  responsable_id: string | null;
  proceso_id: string | null;
  procesos: { nombre: string } | null;
  empresa_afectada: { razon_social: string } | null;
  responsable: { nombre_completo: string } | null;
  detector: { nombre_completo: string } | null;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const supabase = crearClienteServidor();
  const { data } = await supabase
    .from("no_conformidades")
    .select("codigo, titulo")
    .eq("id", params.id)
    .maybeSingle();

  return { title: data ? `${data.codigo} · ${data.titulo}` : "No conformidad" };
}

/**
 * El resumen de la no conformidad.
 *
 * Reemplaza a la ficha anterior, que mostraba en una sola pantalla el
 * análisis de causa raíz, el plan de acción, el control de eficacia y la
 * trazabilidad. Calidad pidió dejar solo lo que se cargó al registrarla:
 * la pantalla se abre para saber qué pasó y en qué anda, no para
 * trabajar la desviación.
 *
 * El análisis y el plan no se perdieron: viven en «Acciones
 * correctivas», que es donde se cargan y donde se siguen. Acá queda el
 * enlace y la cuenta, que es lo que hace falta para decidir el cierre.
 */
export default async function PaginaNoConformidad({ params }: { params: { id: string } }) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data: consulta } = await supabase
    .from("no_conformidades")
    .select(
      "id, codigo, titulo, descripcion, consecuencias, origen, severidad, estado, "
        + "cierre_en_plazo, area, hay_nc_similares, analisis_horizontal, " +
        "correccion_inmediata, propuestas_mejora, fecha_deteccion, fecha_limite_cierre, " +
        "fecha_cierre, es_demostracion, detectado_por, responsable_id, proceso_id, " +
        "procesos:proceso_id (nombre), empresa_afectada:empresa_afectada_id (razon_social), " +
        "responsable:responsable_id (nombre_completo), detector:detectado_por (nombre_completo)",
    )
    .eq("id", params.id)
    .maybeSingle();

  const nc = consulta as unknown as ResumenNoConformidad | null;
  if (!nc) notFound();

  // Las acciones vinculadas: hace falta saber si hay alguna —sin eso no
  // se puede cerrar— y cuándo se cargó la primera, que es lo que decide
  // si el cierre es en plazo o fuera de plazo.
  const { data: acciones } = await supabase
    .from("nc_acciones")
    .select("id, creado_en")
    .eq("no_conformidad_id", params.id)
    .order("creado_en");

  const vinculadas = (acciones as { id: string; creado_en: string }[] | null) ?? [];
  const primera = vinculadas[0]?.creado_en?.slice(0, 10) ?? null;

  const paso = pasoDeNoConformidad(nc.estado, nc.cierre_en_plazo);
  const cerrada = estaCerrada(nc.estado);
  const plazo = textoDePlazo(nc.fecha_deteccion, nc.fecha_cierre, cerrada);
  const vencida = estaVencida(nc.fecha_deteccion, cerrada);
  const sugerencia = cierreSugerido(nc.fecha_deteccion, primera);

  const esCalidad = usuario.rol === "administrador_sgc";
  const gestiona =
    esCalidad ||
    nc.detectado_por === usuario.id ||
    nc.responsable_id === usuario.id ||
    (puedeGestionar(usuario) && nc.proceso_id === usuario.proceso_id);
  const puedeEditar = gestiona && !esSoloLectura(usuario);

  return (
    <div className="mx-auto max-w-4xl">
      <Boton variante="fantasma" tamano="pequeno" comoHijo className="mb-3 -ml-2">
        <Link href="/no-conformidades">
          <ArrowLeft /> Volver al listado
        </Link>
      </Boton>

      <EncabezadoPagina
        titulo={nc.titulo}
        acciones={
          puedeEditar ? (
            <>
              <Boton variante="contorno" tamano="pequeno" comoHijo>
                <Link href={`/no-conformidades/${nc.id}/editar`}>
                  <Pencil /> Editar No Conformidad
                </Link>
              </Boton>
              {esCalidad ? (
                <EliminarNoConformidad noConformidadId={nc.id} codigo={nc.codigo} />
              ) : null}
            </>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Insignia variante="primaria" className="tabular text-xs">
          {nc.codigo}
        </Insignia>
        <InsigniaSeveridad severidad={nc.severidad} />
        <Insignia variante="contorno">{ETIQUETAS_ORIGEN_NC[nc.origen]}</Insignia>
        {nc.es_demostracion ? <InsigniaDemostracion /> : null}
      </div>

      <div className="space-y-4">
        <Tarjeta>
          <TarjetaCabecera className="flex-row items-center justify-between gap-3 space-y-0">
            <TarjetaTitulo>Estado</TarjetaTitulo>
            {/* El indicador de plazo va pegado al estado, como pidió
                Calidad: el estado dice en qué anda y el plazo dice si
                llega. Uno sin el otro no alcanza para decidir nada. */}
            <span
              className={cn(
                "text-xs font-medium",
                vencida ? "text-semaforo-critico" : CLASES_TEXTO_PASO_NC[paso],
              )}
            >
              {plazo}
            </span>
          </TarjetaCabecera>
          <TarjetaContenido>
            <LineaEstados
              noConformidadId={nc.id}
              paso={paso}
              puedeCerrar={puedeEditar}
              tieneAccion={vinculadas.length > 0}
              sugerencia={sugerencia}
              fechaCierre={nc.fecha_cierre}
            />
          </TarjetaContenido>
        </Tarjeta>

        <Tarjeta>
          <TarjetaCabecera>
            <TarjetaTitulo>Descripción de la No Conformidad</TarjetaTitulo>
          </TarjetaCabecera>
          <TarjetaContenido className="space-y-3">
            <p className="whitespace-pre-line text-xs leading-relaxed">{nc.descripcion}</p>

            {/* Las anteriores a este campo no lo tienen y no se les
                inventa: simplemente no aparece. */}
            {nc.consecuencias ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-atenuado-contraste">
                  Consecuencias/Impacto de los eventos que ocasiona
                </p>
                <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed">
                  {nc.consecuencias}
                </p>
              </div>
            ) : null}

            {nc.hay_nc_similares !== null ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-atenuado-contraste">
                  ¿Existen no conformidades similares o que puedan ocurrir?
                </p>
                <p className="mt-0.5 text-xs leading-relaxed">
                  {nc.hay_nc_similares ? "Sí" : "No"}
                </p>
                {nc.analisis_horizontal ? (
                  <p className="mt-1 whitespace-pre-line text-xs leading-relaxed">
                    {nc.analisis_horizontal}
                  </p>
                ) : null}
              </div>
            ) : null}

            {nc.correccion_inmediata ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-atenuado-contraste">
                  Corrección inmediata aplicada
                </p>
                <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed">
                  {nc.correccion_inmediata}
                </p>
              </div>
            ) : null}

            {nc.propuestas_mejora?.length ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-atenuado-contraste">
                  {nc.propuestas_mejora.length === 1
                    ? "Propuesta de mejora"
                    : "Propuestas de mejora"}
                </p>
                <ul className="mt-1 space-y-1">
                  {nc.propuestas_mejora.map((propuesta, indice) => (
                    <li
                      key={indice}
                      className="flex gap-2 whitespace-pre-line text-xs leading-relaxed"
                    >
                      <span className="tabular text-atenuado-contraste">{indice + 1}.</span>
                      <span>{propuesta}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </TarjetaContenido>
        </Tarjeta>

        <Tarjeta>
          <TarjetaCabecera>
            <TarjetaTitulo>Datos del registro</TarjetaTitulo>
          </TarjetaCabecera>
          <TarjetaContenido>
            <dl className="grid gap-x-8 gap-y-2.5 text-xs sm:grid-cols-2">
              <Dato etiqueta="Departamento" valor={nc.area ? DEPARTAMENTOS[nc.area] : "—"} />
              <Dato etiqueta="Empresa" valor={nc.empresa_afectada?.razon_social ?? "—"} />
              <Dato etiqueta="Proceso" valor={nc.procesos?.nombre ?? "—"} />
              <Dato etiqueta="Detectada por" valor={nc.detector?.nombre_completo ?? "—"} />
              <Dato
                etiqueta="Responsable de la AC"
                valor={nc.responsable?.nombre_completo ?? "Sin asignar"}
              />
              <Dato etiqueta="Apertura" valor={formatearFecha(nc.fecha_deteccion)} />
              <Dato
                etiqueta="Límite de cierre"
                valor={formatearFecha(nc.fecha_limite_cierre)}
              />
              <Dato etiqueta="Cierre" valor={formatearFecha(nc.fecha_cierre)} />
            </dl>
          </TarjetaContenido>
        </Tarjeta>

        {/* El plan de acción vive en su módulo. Acá va lo mínimo para
            saber si la desviación tiene con qué cerrarse. */}
        <Tarjeta>
          <TarjetaContenido className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="text-xs text-atenuado-contraste">
              {/* «Acción» pierde la tilde en plural: acciones. Armar el
                  plural pegando «es» al singular daba «acciónes». */}
              {vinculadas.length === 0
                ? "Todavía no tiene ninguna acción correctiva cargada."
                : vinculadas.length === 1
                  ? "1 acción correctiva vinculada."
                  : `${vinculadas.length} acciones correctivas vinculadas.`}
            </p>
            <Boton variante="contorno" tamano="pequeno" comoHijo>
              {/* Lleva a la accion correctiva de esta desviacion. Antes
                  iba al listado filtrado por texto, y ese filtro busca en
                  la descripcion de la accion, no en el codigo de la NC:
                  la pantalla se abria vacia. */}
              <Link
                href={
                  vinculadas.length === 0
                    ? `/acciones/nueva?nc=${nc.id}`
                    : `/acciones/${nc.id}`
                }
              >
                <ListChecks />
                {vinculadas.length === 0 ? "Cargar la acción correctiva" : "Ver la acción correctiva"}
              </Link>
            </Boton>
          </TarjetaContenido>
        </Tarjeta>
      </div>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-borde/60 pb-1.5">
      <dt className="shrink-0 text-atenuado-contraste">{etiqueta}</dt>
      <dd className="text-right font-medium">{valor}</dd>
    </div>
  );
}
