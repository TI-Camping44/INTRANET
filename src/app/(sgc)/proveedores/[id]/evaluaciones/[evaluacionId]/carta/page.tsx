import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Boton } from "@/components/ui/boton";
import { requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatearFecha, formatearNumero, hoyEnAsuncion } from "@/lib/formato";
import { CORREO_RECEPCION, ETIQUETAS_ESTADO_PROVEEDOR } from "@/lib/constantes";
import { logotipoDeEmpresa } from "@/lib/membrete";
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
 * EL MEMBRETE SALE DE LA EMPRESA DEL ASOCIADO DE NEGOCIO, no de una
 * constante: Camping 44 S.A. y Vitalica E.A.S. comparten el sistema y un
 * documento que se entrega a un tercero tiene que salir con el logotipo
 * de la empresa que lo firma. Los dos están en `public/`; si alguna vez
 * faltara uno, el membrete sale con la razón social en tipografía y sin
 * imagen rota.
 *
 * EL MEMBRETE NO LLEVA EL RUC. Dirección lo quitó el 6 de octubre: en el
 * encabezado va el logotipo y la razón social, nada más. El RUC sigue
 * cargado en `empresas` para lo que haga falta.
 *
 * FIRMA QUIEN GENERA LA CARTA, con el puesto que tiene en Personas. No
 * el evaluador: la carta la entrega quien la imprime.
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
      .select("id, codigo, razon_social, empresa_compradora_id")
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("proveedor_evaluaciones")
      .select("*")
      .eq("id", params.evaluacionId)
      .eq("proveedor_id", params.id)
      .maybeSingle(),
  ]);

  if (!datosProveedor || !datosEvaluacion) notFound();

  const proveedor = datosProveedor as {
    id: string;
    codigo: string;
    razon_social: string;
    empresa_compradora_id: string;
  };

  // FIRMA LA EMPRESA A LA QUE SE LE COMPRA, no `empresa_id`: esa es el
  // acotamiento de RLS y siempre vale Camping 44, porque la misma gente
  // administra las dos.
  //
  // Y va por `empresa_del_membrete()` y no por un select a `empresas`:
  // esa tabla la acota RLS a la propia, asi que un Asociado de Negocio
  // de Vitalica devolvia null y la carta salia con el membrete de la
  // otra empresa. Un documento que se entrega a un tercero no puede
  // equivocarse en eso.
  const { data: datosEmpresa } = await supabase.rpc("empresa_del_membrete", {
    id_empresa: proveedor.empresa_compradora_id,
  });

  const empresa = ((datosEmpresa as { razon_social: string; ruc: string | null }[] | null) ??
    [])[0];

  // SIN EMPRESA RESUELTA NO SE ARMA LA CARTA. Antes habia un valor por
  // defecto con Camping 44, que es la forma de que una carta de Vitalica
  // salga firmada por la otra empresa sin que nadie se entere.
  const razonSocial = empresa?.razon_social;
  if (!razonSocial) notFound();

  const logotipo = logotipoDeEmpresa(razonSocial);

  // FIRMA QUIEN GENERA LA CARTA, no quien hizo la evaluacion: la carta
  // la entrega la persona que la imprime, y es su nombre el que tiene
  // que estar debajo de la linea. Si manana la genera otra persona, sale
  // la suya.
  //
  // El cargo sale del puesto que tiene asignado en Personas, no de una
  // constante: en el proyecto hay una sola fuente para eso. Si todavia
  // no tiene puesto asignado, la firma sale sin cargo antes que con uno
  // inventado.
  const { data: datosPuesto } = usuario.puesto_id
    ? await supabase.from("puestos").select("nombre").eq("id", usuario.puesto_id).maybeSingle()
    : { data: null };

  const puestoDeQuienFirma = (datosPuesto as { nombre: string } | null)?.nombre ?? null;

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
  };

  const puntos: Record<CampoCriterio, number> = {
    calidad: evaluacion.calidad,
    logistica: evaluacion.logistica,
    legal: evaluacion.legal,
    servicio: evaluacion.servicio,
  };

  const promedio = promedioDeEvaluacion(evaluacion.puntaje);
  const resultado = evaluacion.resultado ?? "en_evaluacion";

  // El aviso de criterio crítico: cualquiera en 1 pesa por sí solo, más
  // allá del promedio. Lo de «Legal 2 o menos en Material Controlado» no
  // se puede evaluar: el Asociado de Negocio no lleva ninguna marca de
  // material controlado.
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

      {/* La carta. Negro sobre blanco también en modo oscuro: es un
          documento que se entrega, no una pantalla. */}
      <article className="rounded-md border border-borde bg-white p-10 text-[13px] leading-relaxed text-black print:rounded-none print:border-0 print:p-0 print:text-[12px] print:leading-[1.5]">
        {/* MEMBRETE */}
        <header className="imprimir-color flex items-start justify-between gap-6 border-b-2 border-[#E01E37] pb-4 print:pb-3">
          <div className="flex items-center gap-4">
            {logotipo ? (
              // Sin next/image: esto se imprime, y el optimizador entrega
              // un formato que el dialogo de impresion no siempre resuelve
              // a tiempo. El archivo se dibuja una sola vez.
              //
              // SE FIJA LA ALTURA, NO EL ANCHO: los dos logotipos tienen
              // proporciones distintas —el de Camping 44 es casi cuadrado,
              // el de Vitalica es la flor sobre la palabra— y a ancho fijo
              // uno quedaria el doble de alto que el otro.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logotipo} alt="" className="h-16 w-auto print:h-12" />
            ) : null}
            <p className="text-base font-semibold tracking-tight">{razonSocial}</p>
          </div>

          <div className="shrink-0 text-right text-[11px] text-black/60">
            <p className="font-semibold uppercase tracking-wide text-black/80">
              Evaluación de Asociado de Negocio
            </p>
            <p className="mt-0.5">Asunción, {formatearFecha(hoyEnAsuncion())}</p>
          </div>
        </header>

        <p className="mb-4 mt-8 print:mt-6">Estimados señores de {proveedor.razon_social}:</p>

        <p className="mb-4 text-justify">
          En {razonSocial.toUpperCase()} evaluamos periódicamente a nuestros Asociados de
          Negocio, porque su desempeño influye directamente en la calidad de lo que entregamos a
          nuestros clientes. Les compartimos el resultado de la evaluación del período {periodo}.
          Se basa en los registros de recepción, entregas, documentación y atención de ese
          período.
        </p>

        <h2 className="mb-2 mt-6 text-sm font-semibold print:mt-5">Resultado por criterio</h2>

        <table className="w-full border-collapse text-[12px] print:text-[11px]">
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
                <tr key={criterio.campo} className="break-inside-avoid border-b border-black/15 align-top">
                  <td className="py-1.5 font-medium">{criterio.etiqueta}</td>
                  <td className="py-1.5 pr-3">{QUE_EVALUAMOS[criterio.campo]}</td>
                  <td className="py-1.5">
                    <span className="font-semibold tabular">{punto}</span> · {texto}
                  </td>
                </tr>
              );
            })}
            <tr className="border-b-2 border-black/40">
              <td className="py-1.5 font-semibold" colSpan={2}>
                Promedio
              </td>
              <td className="py-1.5 font-semibold tabular">
                {formatearNumero(promedio, 1)} de 5
              </td>
            </tr>
          </tbody>
        </table>

        <p className="mt-2 text-[11px] text-black/70">
          Escala: 5 Excelente · 4 Bueno · 3 Aceptable · 2 Deficiente · 1 Inaceptable.
        </p>

        <p className="mt-5 border-l-2 border-[#E01E37] pl-3 imprimir-color">
          <span className="font-semibold">Resultado final:</span>{" "}
          {ETIQUETAS_ESTADO_PROVEEDOR[resultado as EstadoProveedor]}
          <span className="block text-[12px] text-black/70">
            {ACCION_POR_RESULTADO[resultado] ?? ""}
          </span>
        </p>

        {evaluacion.comentario ? (
          <>
            <h2 className="mb-1 mt-6 text-sm font-semibold">Observaciones del evaluador</h2>
            <p className="whitespace-pre-line text-justify">{evaluacion.comentario}</p>
          </>
        ) : null}

        <p className="mt-5 text-justify">{PARRAFO_POR_RESULTADO[resultado] ?? ""}</p>

        {criticos.length > 0 ? (
          <p className="mt-4 text-justify">
            Independientemente del promedio,{" "}
            {criticos.length === 1 ? "el criterio" : "los criterios"}{" "}
            <span className="font-semibold">{criticos.join(" y ")}</span>{" "}
            {criticos.length === 1 ? "obtuvo" : "obtuvieron"} el puntaje mínimo de la escala, lo
            que según nuestro procedimiento implica la suspensión de nuevas compras hasta
            verificar la corrección.
          </p>
        ) : null}

        <p className="mt-4 text-justify">
          Si tienen dudas sobre esta evaluación o desean presentar descargos o evidencias, pueden
          escribirnos a <span className="font-medium">{CORREO_RECEPCION}</span> dentro de los 10
          días hábiles siguientes a su recepción. Revisaremos cada caso y, si corresponde,
          ajustaremos el resultado.
        </p>

        <p className="mt-4">Agradecemos su compromiso y esperamos seguir trabajando juntos.</p>

        <div className="mt-12 break-inside-avoid print:mt-8">
          <p>Atentamente,</p>
          <div className="mt-12 w-64 border-t border-black/50 pt-1 print:mt-8">
            <p className="font-semibold">{usuario.nombre_completo}</p>
            {puestoDeQuienFirma ? (
              <p className="text-[12px] text-black/70">{puestoDeQuienFirma}</p>
            ) : null}
          </div>
        </div>
      </article>
    </div>
  );
}
