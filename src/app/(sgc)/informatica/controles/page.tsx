import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { TarjetaIndicador } from "@/components/comunes/tarjeta-indicador";
import { Boton } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import {
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaTitulo,
} from "@/components/ui/tarjeta";
import { obtenerPermisos, requerirModulo } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatearFecha, hoyEnAsuncion } from "@/lib/formato";
import {
  ETIQUETAS_ESTADO_PERIODO,
  ETIQUETAS_FRECUENCIA,
  NOMBRES_MES,
  NOMBRES_MES_CORTO,
  describirPeriodo,
  esFrecuencia,
  estadoDelPeriodo,
  periodoDe,
  periodosDelAnio,
  periodosPendientes,
  tocaEnPeriodo,
  type EstadoPeriodo,
} from "@/lib/controles-ti";
import { cn } from "@/lib/utilidades";

export const metadata: Metadata = { title: "Controles periódicos de TI" };
export const dynamic = "force-dynamic";

interface FilaControl {
  id: string;
  codigo: string;
  nombre: string;
  documento_origen: string | null;
  formulario: string | null;
  frecuencia_meses: number;
  primer_periodo: string;
  vigente: boolean;
  responsable: { nombre_completo: string } | null;
}

interface FilaEjecucion {
  control_id: string;
  periodo: string;
  fecha_ejecucion: string;
  resultado: string;
}

/**
 * El color de cada celda del cronograma. NUNCA SOLO EL COLOR: la celda
 * lleva además el estado en palabras o la fecha, así se lee igual en
 * blanco y negro y con lector de pantalla.
 */
const CLASES_CELDA: Record<EstadoPeriodo, string> = {
  ejecutado: "border-semaforo-bajo/40 bg-semaforo-bajo/15 text-semaforo-bajo",
  vencido: "border-semaforo-critico/40 bg-semaforo-critico/15 text-semaforo-critico",
  en_curso: "border-semaforo-medio/50 bg-semaforo-medio/15 text-semaforo-medio",
  programado: "border-borde bg-atenuado/60 text-atenuado-contraste",
};

/**
 * Cronograma de los controles periódicos de TI.
 *
 * ES LA RESPUESTA A LA NC-2026-022, que pidió «programar en el módulo de
 * TI de la Intranet el cronograma de controles que establece el
 * proceso». Una fila por control y una columna por mes: de un vistazo se
 * ve qué toca, qué se hizo y qué quedó sin hacer.
 *
 * Los vencidos se cuentan desde que el control existe, no solo en el año
 * que se mira: un control de agosto sin hacer no deja de deberse porque
 * la pantalla esté en el año siguiente.
 */
export default async function PaginaControlesTi({
  searchParams,
}: {
  searchParams: { anio?: string };
}) {
  await requerirModulo("informatica");
  const permisos = await obtenerPermisos();
  const puedeEditar = permisos.informatica.editar;
  const supabase = crearClienteServidor();

  const hoy = hoyEnAsuncion();
  const anioActual = Number(hoy.slice(0, 4));
  const anioPedido = Number.parseInt(searchParams.anio ?? "", 10);
  const anio =
    Number.isFinite(anioPedido) && anioPedido >= 2020 && anioPedido <= 2100
      ? anioPedido
      : anioActual;

  const [{ data: datosControles }, { data: datosEjecuciones }] = await Promise.all([
    supabase
      .from("controles_ti")
      .select(
        "id, codigo, nombre, documento_origen, formulario, frecuencia_meses, primer_periodo, " +
          "vigente, responsable:responsable_id (nombre_completo)",
      )
      .order("codigo"),
    supabase
      .from("control_ti_ejecuciones")
      .select("control_id, periodo, fecha_ejecucion, resultado"),
  ]);

  const controles = (datosControles ?? []) as unknown as FilaControl[];
  const ejecuciones = (datosEjecuciones ?? []) as FilaEjecucion[];
  const vigentes = controles.filter((control) => control.vigente);

  const ejecucionPorClave = new Map<string, FilaEjecucion>();
  const ejecutadosPorControl = new Map<string, Set<string>>();
  for (const ejecucion of ejecuciones) {
    ejecucionPorClave.set(`${ejecucion.control_id}|${ejecucion.periodo}`, ejecucion);
    const periodos = ejecutadosPorControl.get(ejecucion.control_id) ?? new Set<string>();
    periodos.add(ejecucion.periodo);
    ejecutadosPorControl.set(ejecucion.control_id, periodos);
  }

  // Los números de arriba. Los del año miran el año elegido; los
  // vencidos y lo de este mes miran el día de hoy.
  let programadosDelAnio = 0;
  let ejecutadosDelAnio = 0;
  for (const control of vigentes) {
    for (const periodo of periodosDelAnio(control, anio)) {
      programadosDelAnio += 1;
      if (ejecucionPorClave.has(`${control.id}|${periodo}`)) ejecutadosDelAnio += 1;
    }
  }

  const mesActual = periodoDe(hoy);
  const vencidos = vigentes.flatMap((control) =>
    periodosPendientes(control, ejecutadosPorControl.get(control.id) ?? new Set(), hoy)
      .filter((periodo) => periodo < mesActual)
      .map((periodo) => ({ control, periodo })),
  );
  const tocaEsteMes = vigentes.filter(
    (control) =>
      tocaEnPeriodo(control, mesActual) &&
      !ejecucionPorClave.has(`${control.id}|${mesActual}`),
  );

  return (
    <div className="space-y-5">
      <EncabezadoPagina
        titulo="Controles periódicos de TI"
        descripcion={
          "Cronograma de los controles que exigen el MP-SOP-03 Infraestructura y " +
          "Tecnología y el MP-SOP-07 Seguridad Informática, con el registro y la " +
          "evidencia de cada ejecución."
        }
        acciones={
          puedeEditar ? (
            <Boton comoHijo tamano="pequeno">
              <Link href="/informatica/controles/nuevo">
                <Plus aria-hidden />
                Nuevo control
              </Link>
            </Boton>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaIndicador
          titulo={`Programados ${anio}`}
          valor={programadosDelAnio}
          contexto={`${vigentes.length} controles vigentes`}
        />
        <TarjetaIndicador
          titulo={`Ejecutados ${anio}`}
          valor={ejecutadosDelAnio}
          tono={ejecutadosDelAnio > 0 ? "exito" : "neutro"}
          contexto={
            programadosDelAnio > 0
              ? `${Math.round((ejecutadosDelAnio / programadosDelAnio) * 100)} % de lo programado`
              : "Sin programación en el año"
          }
        />
        <TarjetaIndicador
          titulo="Vencidos"
          valor={vencidos.length}
          tono={vencidos.length > 0 ? "peligro" : "exito"}
          contexto={vencidos.length > 0 ? "Meses que terminaron sin registro" : "Nada atrasado"}
        />
        <TarjetaIndicador
          titulo="Toca este mes"
          valor={tocaEsteMes.length}
          tono={tocaEsteMes.length > 0 ? "advertencia" : "neutro"}
          contexto={describirPeriodo(mesActual)}
        />
      </div>

      {vencidos.length > 0 ? (
        <Tarjeta className="border-semaforo-critico/40 p-4">
          <p className="text-xs font-semibold">Controles vencidos</p>
          <ul className="mt-2 space-y-1 text-xs">
            {vencidos.map(({ control, periodo }) => (
              <li key={`${control.id}|${periodo}`}>
                <Link
                  href={`/informatica/controles/${control.id}`}
                  className="font-medium hover:underline"
                >
                  <span className="tabular">{control.codigo}</span> · {control.nombre}
                </Link>{" "}
                <span className="text-atenuado-contraste">— {describirPeriodo(periodo)}</span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      ) : null}

      <Tarjeta>
        <TarjetaCabecera className="flex-row flex-wrap items-center justify-between gap-2">
          <TarjetaTitulo className="text-sm">Cronograma {anio}</TarjetaTitulo>
          <nav aria-label="Año del cronograma" className="flex items-center gap-1">
            <Boton comoHijo variante="contorno" tamano="iconoPequeno">
              <Link href={`/informatica/controles?anio=${anio - 1}`} aria-label={`Ver ${anio - 1}`}>
                <ChevronLeft aria-hidden />
              </Link>
            </Boton>
            {anio !== anioActual ? (
              <Boton comoHijo variante="contorno" tamano="pequeno">
                <Link href="/informatica/controles">Año actual</Link>
              </Boton>
            ) : null}
            <Boton comoHijo variante="contorno" tamano="iconoPequeno">
              <Link href={`/informatica/controles?anio=${anio + 1}`} aria-label={`Ver ${anio + 1}`}>
                <ChevronRight aria-hidden />
              </Link>
            </Boton>
          </nav>
        </TarjetaCabecera>
        <TarjetaContenido>
          {controles.length === 0 ? (
            <EstadoVacio
              icono={<CalendarCheck className="size-6" aria-hidden />}
              titulo="Todavía no hay controles programados"
              descripcion="Cargue los controles que exige el proceso para que entren en el cronograma."
            />
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border border-borde">
                <table className="w-full min-w-[960px] border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-borde bg-atenuado/50 text-left">
                      <th
                        scope="col"
                        className="sticky left-0 z-10 min-w-[220px] bg-atenuado px-3 py-2 font-semibold"
                      >
                        Control
                      </th>
                      <th scope="col" className="px-2 py-2 font-semibold">
                        Frecuencia
                      </th>
                      {NOMBRES_MES_CORTO.map((mes, indice) => (
                        <th
                          key={mes}
                          scope="col"
                          className={cn(
                            "px-1 py-2 text-center font-semibold",
                            `${anio}-${String(indice + 1).padStart(2, "0")}-01` === mesActual
                              ? "text-primario"
                              : "",
                          )}
                        >
                          <abbr title={NOMBRES_MES[indice]} className="no-underline">
                            {mes}
                          </abbr>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {controles.map((control) => (
                      <tr
                        key={control.id}
                        className={cn(
                          "border-b border-borde last:border-b-0",
                          control.vigente ? "" : "opacity-60",
                        )}
                      >
                        <th
                          scope="row"
                          className="sticky left-0 z-10 bg-tarjeta px-3 py-2 text-left font-normal"
                        >
                          <Link
                            href={`/informatica/controles/${control.id}`}
                            className="font-medium hover:underline"
                          >
                            <span className="tabular text-atenuado-contraste">
                              {control.codigo}
                            </span>{" "}
                            {control.nombre}
                          </Link>
                          <span className="mt-0.5 block text-[11px] text-atenuado-contraste">
                            {[control.documento_origen, control.formulario]
                              .filter(Boolean)
                              .join(" · ") || "Sin proceso declarado"}
                            {control.vigente ? "" : " · No vigente"}
                          </span>
                        </th>
                        <td className="whitespace-nowrap px-2 py-2 text-atenuado-contraste">
                          {esFrecuencia(control.frecuencia_meses)
                            ? ETIQUETAS_FRECUENCIA[control.frecuencia_meses]
                            : `${control.frecuencia_meses} meses`}
                        </td>
                        {NOMBRES_MES_CORTO.map((mes, indice) => {
                          const periodo = `${anio}-${String(indice + 1).padStart(2, "0")}-01`;
                          if (!control.vigente || !tocaEnPeriodo(control, periodo)) {
                            return (
                              <td key={mes} className="px-1 py-2 text-center text-borde">
                                <span aria-hidden>·</span>
                              </td>
                            );
                          }
                          const ejecucion = ejecucionPorClave.get(`${control.id}|${periodo}`);
                          const estado = estadoDelPeriodo(periodo, Boolean(ejecucion), hoy);
                          return (
                            <td key={mes} className="px-1 py-1.5 text-center">
                              <Link
                                href={`/informatica/controles/${control.id}`}
                                title={`${control.codigo} · ${NOMBRES_MES[indice]} ${anio}: ${ETIQUETAS_ESTADO_PERIODO[estado]}`}
                                className={cn(
                                  "block rounded border px-1 py-1 text-[10px] font-semibold leading-tight",
                                  CLASES_CELDA[estado],
                                )}
                              >
                                {ejecucion
                                  ? formatearFecha(ejecucion.fecha_ejecucion).slice(0, 5)
                                  : estado === "vencido"
                                    ? "Vencido"
                                    : estado === "en_curso"
                                      ? "Toca"
                                      : "Prog."}
                              </Link>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-atenuado-contraste">
                <li className="flex items-center gap-1.5">
                  <span className={cn("rounded border px-1 font-semibold", CLASES_CELDA.ejecutado)}>
                    17/11
                  </span>
                  Ejecutado, con su fecha
                </li>
                <li className="flex items-center gap-1.5">
                  <span className={cn("rounded border px-1 font-semibold", CLASES_CELDA.en_curso)}>
                    Toca
                  </span>
                  Toca este mes
                </li>
                <li className="flex items-center gap-1.5">
                  <span className={cn("rounded border px-1 font-semibold", CLASES_CELDA.vencido)}>
                    Vencido
                  </span>
                  El mes terminó sin registro
                </li>
                <li className="flex items-center gap-1.5">
                  <span className={cn("rounded border px-1 font-semibold", CLASES_CELDA.programado)}>
                    Prog.
                  </span>
                  Programado
                </li>
              </ul>
            </>
          )}
        </TarjetaContenido>
      </Tarjeta>
    </div>
  );
}
