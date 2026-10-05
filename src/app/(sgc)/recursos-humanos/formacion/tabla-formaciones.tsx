import Link from "next/link";
import {
  Tabla,
  TablaCabecera,
  TablaCelda,
  TablaCuerpo,
  TablaEncabezado,
  TablaFila,
} from "@/components/ui/tabla";
import { CeldaTexto } from "@/components/comunes/celda-texto";
import { formatearFecha } from "@/lib/formato";
import {
  ETIQUETAS_MODALIDAD,
  ETIQUETAS_TIPO_FORMACION,
  MESES_CORTOS,
  mesesQueOcupa,
  type ModalidadFormacion,
} from "@/lib/formacion";
import { cn } from "@/lib/utilidades";
import type { FilaFormacion } from "@/app/(sgc)/recursos-humanos/formacion/page";

/**
 * El plan anual, como la planilla que Capital Humano venía llevando.
 *
 * Una fila por acción formativa y doce columnas de meses, pintadas donde
 * la acción cae. Es lo que permite ver de un barrido si el año está
 * repartido o si todo se amontonó en diciembre.
 *
 * LAS CELDAS DE MES SE PINTAN DEL COLOR DEL ESTADO, no de un color fijo.
 * Así el calendario dice dos cosas a la vez —cuándo y cómo salió— sin
 * una leyenda aparte: verde lo que se dictó, rojo lo que no, ámbar lo
 * pospuesto y gris lo que todavía está por delante.
 *
 * Es un componente de servidor: no tiene estado ni interacción. El
 * detalle al señalar lo da el `title` de cada celda, que el navegador
 * muestra solo.
 */
export function TablaFormaciones({
  formaciones,
  convocados,
  anio,
  clasesEstado,
  etiquetasEstado,
}: {
  formaciones: FilaFormacion[];
  convocados: Record<string, number>;
  anio: number;
  clasesEstado: Record<string, string>;
  etiquetasEstado: Record<string, string>;
}) {
  return (
    <Tabla>
      <TablaCabecera>
        <TablaFila>
          <TablaEncabezado className="sticky left-0 z-10 w-[20rem] bg-fondo">
            Acción formativa
          </TablaEncabezado>
          <TablaEncabezado className="w-[6rem]">Tipo</TablaEncabezado>
          <TablaEncabezado className="w-[8rem]">Modalidad</TablaEncabezado>
          <TablaEncabezado className="w-[11rem]">Formador</TablaEncabezado>
          <TablaEncabezado className="w-[9rem]">Estado</TablaEncabezado>
          <TablaEncabezado className="w-[5rem] text-center">Eficacia</TablaEncabezado>
          <TablaEncabezado className="w-[7rem]">Inicio</TablaEncabezado>
          <TablaEncabezado className="w-[7rem]">Finalización</TablaEncabezado>
          <TablaEncabezado className="w-[5rem] text-center">Personas</TablaEncabezado>
          {MESES_CORTOS.map((mes) => (
            <TablaEncabezado key={mes} className="w-9 text-center">
              {mes}
            </TablaEncabezado>
          ))}
        </TablaFila>
      </TablaCabecera>
      <TablaCuerpo>
        {formaciones.map((formacion) => {
          const meses = mesesQueOcupa(formacion.fecha_inicio, formacion.fecha_fin, anio);
          const relleno = RELLENO_DEL_MES[formacion.estado] ?? RELLENO_DEL_MES.planificada;

          return (
            <TablaFila key={formacion.id}>
              <TablaCelda className="sticky left-0 z-10 bg-fondo text-xs font-medium">
                <Link
                  href={`/recursos-humanos/formacion/${formacion.id}`}
                  className="block truncate hover:text-primario"
                  title={formacion.nombre}
                >
                  {formacion.nombre}
                </Link>
                {formacion.objetivo ? (
                  <span
                    className="block truncate text-[11px] font-normal text-atenuado-contraste"
                    title={formacion.objetivo}
                  >
                    {formacion.objetivo}
                  </span>
                ) : null}
              </TablaCelda>

              <TablaCelda className="text-xs text-atenuado-contraste">
                {ETIQUETAS_TIPO_FORMACION[formacion.tipo] ?? formacion.tipo}
              </TablaCelda>

              <TablaCelda className="text-xs text-atenuado-contraste">
                {formacion.modalidad
                  ? (ETIQUETAS_MODALIDAD[formacion.modalidad as ModalidadFormacion] ??
                    formacion.modalidad)
                  : "—"}
              </TablaCelda>

              {/* Interna: la persona de la casa. Externa: el nombre escrito. */}
              <CeldaTexto ancho="11rem">
                {formacion.formador?.nombre_completo ?? formacion.instructor}
              </CeldaTexto>

              <TablaCelda>
                <span
                  className={cn(
                    "inline-flex whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] font-medium",
                    clasesEstado[formacion.estado],
                  )}
                  title={formacion.comentario_estado ?? undefined}
                >
                  {etiquetasEstado[formacion.estado] ?? formacion.estado}
                </span>
                {formacion.fecha_nueva ? (
                  <span className="block text-[10px] text-atenuado-contraste">
                    Nueva fecha: {formatearFecha(formacion.fecha_nueva)}
                  </span>
                ) : null}
              </TablaCelda>

              {/* Más de dos horas exige Evaluación de Eficacia de la
                  Formación. Lo calcula la base, no la pantalla. */}
              <TablaCelda className="text-center text-xs">
                {formacion.requiere_eficacia ? (
                  <span
                    className="text-semaforo-medio"
                    title={`${Number(formacion.horas_totales ?? 0)} h en total: exige Evaluación de Eficacia de la Formación.`}
                  >
                    Exige
                  </span>
                ) : (
                  <span className="text-atenuado-contraste">—</span>
                )}
              </TablaCelda>

              <TablaCelda className="text-xs tabular text-atenuado-contraste">
                {formacion.fecha_inicio ? formatearFecha(formacion.fecha_inicio) : "—"}
              </TablaCelda>
              <TablaCelda className="text-xs tabular text-atenuado-contraste">
                {formacion.fecha_fin ? formatearFecha(formacion.fecha_fin) : "—"}
              </TablaCelda>

              <TablaCelda className="text-center text-xs tabular">
                {convocados[formacion.id] ?? 0}
              </TablaCelda>

              {meses.map((ocupa, indice) => (
                <TablaCelda key={indice} className="p-1">
                  <span
                    className={cn(
                      "block h-5 rounded-sm",
                      ocupa ? relleno : "bg-acento/40",
                    )}
                    title={
                      ocupa
                        ? `${MESES_CORTOS[indice]} · ${etiquetasEstado[formacion.estado] ?? formacion.estado}`
                        : undefined
                    }
                  />
                </TablaCelda>
              ))}
            </TablaFila>
          );
        })}
      </TablaCuerpo>
    </Tabla>
  );
}

/**
 * El relleno de la celda del mes, según el estado.
 *
 * Sale de las variables del tema, así el calendario funciona igual en
 * modo claro y oscuro.
 */
const RELLENO_DEL_MES: Record<string, string> = {
  planificada: "bg-primario/50",
  ejecutada: "bg-semaforo-bajo/60",
  no_ejecutada: "bg-semaforo-critico/50",
  pospuesta: "bg-semaforo-medio/60",
};
