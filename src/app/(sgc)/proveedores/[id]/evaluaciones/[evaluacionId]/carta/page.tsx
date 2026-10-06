import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Boton } from "@/components/ui/boton";
import { requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatearFecha, formatearNumero } from "@/lib/formato";
import { ETIQUETAS_ESTADO_PROVEEDOR } from "@/lib/constantes";
import {
  ACCION_POR_RESULTADO,
  CRITERIOS_EVALUACION,
  ESCALAS_EVALUACION,
  promedioDeEvaluacion,
  type CampoCriterio,
} from "@/lib/proveedores";
import type { EstadoProveedor } from "@/lib/tipos";
import { BotonImprimir } from "./boton-imprimir";

export const metadata: Metadata = { title: "Carta de evaluación" };
export const dynamic = "force-dynamic";

/** Qué se evalúa en cada criterio. Es el texto de la carta, de Calidad. */
const QUE_EVALUAMOS: Record<CampoCriterio, string> = {
  calidad:
    "Que lo recibido cumpla lo solicitado: especificación, estado y funcionamiento, o " +
    "trabajo bien hecho a la primera.",
  logistica: "Cumplimiento de plazo, cantidad y lugar acordados.",
  legal: "Documentación y requisitos legales vigentes.",
  servicio: "Rapidez de respuesta, resolución de reclamos y garantía.",
};

/**
 * El párrafo que cierra el resultado. Sale de la columna «Acción» de la
 * tabla de Calidad, dicho en la segunda persona de la carta.
 */
const PARRAFO_POR_RESULTADO: Record<string, string> = {
  aprobado_preferente:
    "El resultado los ubica como Asociado de Negocio aprobado preferente. No se requiere " +
    "ninguna acción de su parte: seguimos trabajando con normalidad.",
  aprobado:
    "El resultado los ubica como Asociado de Negocio aprobado. Continuamos con el " +
    "seguimiento normal previsto en nuestro procedimiento.",
  condicional:
    "El resultado los ubica como Asociado de Negocio condicionado. Les solicitamos un plan " +
    "de mejora, y volveremos a evaluarlos dentro de los tres meses.",
  rechazado:
    "El resultado los ubica como Asociado de Negocio no aprobado. En consecuencia, y " +
    "conforme a nuestro procedimiento, suspendemos las compras hasta que la situación se " +
    "revierta.",
};

/**
 * Carta de evaluación del Asociado de Negocio, lista para imprimir.
 *
 * EL PDF LO ARMA EL NAVEGADOR. El botón abre el diálogo de impresión y
 * «Guardar como PDF» produce el archivo. El proyecto no tiene librería
 * de PDF; agregarla para esto significaba posicionar cada línea a mano,
 * con peor tipografía y un mantenimiento aparte cada vez que la carta
 * cambie una palabra.
 *
 * El texto es el que pasó Dirección el 6 de octubre. Tres partes salen
 * solo si corresponde, como pide ese texto: las observaciones del
 * evaluador, el aviso de criterio crítico, y los hechos registrados del
 * período —que hoy NO se imprimen nunca, porque el sistema no lleva
 * registro de incidencias por Asociado de Negocio: no hay de dónde
 * sacarlos y una lista vacía diría que no hubo, que es distinto—.
 */
export default async function PaginaCartaEvaluacion({
  params,
}: {
  params: { id: string; evaluacionId: string };
}) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const [{ data: datosProveedor }, { data: datosEvaluacion }] = await Promise.all([
    supabase
      .from("proveedores")
      .select("id, codigo, razon_social")
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("proveedor_evaluaciones")
      .select("*, evaluador:evaluado_por (nombre_completo, correo)")
      .eq("id", params.evaluacionId)
      .eq("proveedor_id", params.id)
      .maybeSingle(),
  ]);

  if (!datosProveedor || !datosEvaluacion) notFound();

  const proveedor = datosProveedor as { id: string; codigo: string; razon_social: string };
  const evaluacion = datosEvaluacion as unknown as {
    id: string;
    fecha: string;
    periodo: string | null;
    periodo_desde: string | null;
    periodo_hasta: string | null;
    calidad: number;
    logistica: number;
    legal: number;
    servicio: number;
    puntaje: number;
    resultado: EstadoProveedor | null;
    comentario: string | null;
    evaluador: { nombre_completo: string; correo: string } | null;
  };

  const puntos: Record<CampoCriterio, number> = {
    calidad: evaluacion.calidad,
    logistica: evaluacion.logistica,
    legal: evaluacion.legal,
    servicio: evaluacion.servicio,
  };

  const promedio = promedioDeEvaluacion(evaluacion.puntaje);
  const resultado = evaluacion.resultado ?? "en_evaluacion";

  // El aviso de criterio crítico: cualquiera en 1 pesa por sí solo,
  // más allá del promedio. Lo de «Legal 2 o menos en Material
  // Controlado» no se puede evaluar: el Asociado de Negocio no lleva
  // ninguna marca de material controlado.
  const criticos = CRITERIOS_EVALUACION.filter(
    (criterio) => puntos[criterio.campo] === 1,
  ).map((criterio) => criterio.etiqueta);

  // El período. Si la evaluación es anterior al cambio a dos fechas,
  // queda el texto viejo.
  const periodo =
    evaluacion.periodo_desde && evaluacion.periodo_hasta
      ? `${formatearFecha(evaluacion.periodo_desde)} al ${formatearFecha(evaluacion.periodo_hasta)}`
      : (evaluacion.periodo ?? formatearFecha(evaluacion.fecha));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-imprimir mb-4 flex flex-wrap items-center justify-between gap-2">
        <Boton variante="fantasma" tamano="pequeno" comoHijo className="-ml-2">
          <Link href={`/proveedores/${proveedor.id}`}>
            <ArrowLeft /> Volver al Asociado de Negocio
          </Link>
        </Boton>
        <BotonImprimir />
      </div>

      {/* La carta. Texto en negro sobre blanco también en modo oscuro:
          es un documento que se entrega, no una pantalla. */}
      <article className="rounded-md border border-borde bg-white p-8 text-[13px] leading-relaxed text-black print:border-0 print:p-0">
        <p className="mb-4">Estimados señores de {proveedor.razon_social}:</p>

        <p className="mb-4 text-justify">
          En CAMPING 44 S.A. evaluamos periódicamente a nuestros Asociados de Negocio, porque su
          desempeño influye directamente en la calidad de lo que entregamos a nuestros clientes.
          Les compartimos el resultado de la evaluación del período {periodo}. Se basa en los
          registros de recepción, entregas, documentación y atención de ese período.
        </p>

        <h2 className="mb-2 mt-6 text-sm font-semibold">Resultado por criterio</h2>

        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-y border-black/30">
              <th className="w-[5.5rem] py-1.5 text-left font-semibold">Criterio</th>
              <th className="py-1.5 text-left font-semibold">Qué evaluamos</th>
              <th className="w-[13rem] py-1.5 text-left font-semibold">Puntaje</th>
            </tr>
          </thead>
          <tbody>
            {CRITERIOS_EVALUACION.map((criterio) => {
              const punto = puntos[criterio.campo];
              const texto = ESCALAS_EVALUACION[criterio.campo].find(
                (opcion) => opcion.valor === punto,
              )?.texto;

              return (
                <tr key={criterio.campo} className="border-b border-black/15 align-top">
                  <td className="py-1.5 font-medium">{criterio.etiqueta}</td>
                  <td className="py-1.5 pr-3 text-justify">{QUE_EVALUAMOS[criterio.campo]}</td>
                  <td className="py-1.5">
                    <span className="font-semibold tabular">{punto}</span> · {texto}
                  </td>
                </tr>
              );
            })}
            <tr className="border-b border-black/30">
              <td className="py-1.5 font-semibold" colSpan={2}>
                Promedio
              </td>
              <td className="py-1.5 font-semibold tabular">
                {formatearNumero(promedio, 1)} de 5
              </td>
            </tr>
          </tbody>
        </table>

        <p className="mt-2 text-[11px]">
          Escala: 5 Excelente · 4 Bueno · 3 Aceptable · 2 Deficiente · 1 Inaceptable.
        </p>

        <p className="mt-4">
          <span className="font-semibold">Resultado final:</span>{" "}
          {ETIQUETAS_ESTADO_PROVEEDOR[resultado as EstadoProveedor]} ·{" "}
          {ACCION_POR_RESULTADO[resultado] ?? ""}
        </p>

        {evaluacion.comentario ? (
          <>
            <h2 className="mb-1 mt-6 text-sm font-semibold">Observaciones del evaluador</h2>
            <p className="whitespace-pre-line text-justify">{evaluacion.comentario}</p>
          </>
        ) : null}

        <p className="mt-4 text-justify">{PARRAFO_POR_RESULTADO[resultado] ?? ""}</p>

        {criticos.length > 0 ? (
          <p className="mt-4 text-justify">
            Independientemente del promedio, {criticos.length === 1 ? "el criterio" : "los criterios"}{" "}
            <span className="font-semibold">{criticos.join(" y ")}</span>{" "}
            {criticos.length === 1 ? "obtuvo" : "obtuvieron"} el puntaje mínimo de la escala, lo
            que según nuestro procedimiento implica la suspensión de nuevas compras hasta
            verificar la corrección.
          </p>
        ) : null}

        <p className="mt-4 text-justify">
          Si tienen dudas sobre esta evaluación o desean presentar descargos o evidencias, pueden
          escribirnos a {evaluacion.evaluador?.correo ?? usuario.correo} dentro de los 10 días
          hábiles siguientes a su recepción. Revisaremos cada caso y, si corresponde, ajustaremos
          el resultado.
        </p>

        <p className="mt-4">
          Agradecemos su compromiso y esperamos seguir trabajando juntos.
        </p>

        <div className="mt-10">
          <p>Atentamente,</p>
          <p className="mt-8 font-semibold">
            {evaluacion.evaluador?.nombre_completo ?? usuario.nombre_completo}
          </p>
          <p>Calidad</p>
          <p>CAMPING 44 S.A.</p>
        </div>

        <p className="mt-8 text-[10px] text-black/50">
          {proveedor.codigo} · Evaluación del {formatearFecha(evaluacion.fecha)} · F-SOP-08-01
        </p>
      </article>
    </div>
  );
}
