import type { Metadata } from "next";
import Link from "next/link";
import { Grid3x3, Plus, ShieldAlert } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltrosListado } from "@/components/comunes/filtros-listado";
import { CeldaSiNo, CeldaTexto } from "@/components/comunes/celda-texto";
import { BarrasPorcentaje, Torta } from "@/components/comunes/graficos";
import {
  InsigniaDemostracion,
  InsigniaEstadoRiesgo,
  InsigniaNivelRiesgo,
} from "@/components/comunes/insignias-estado";
import { Boton } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Tarjeta } from "@/components/ui/tarjeta";
import {
  Tabla,
  TablaCabecera,
  TablaCelda,
  TablaCuerpo,
  TablaEncabezado,
  TablaFila,
} from "@/components/ui/tabla";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import {
  ETIQUETAS_EFICACIA,
  ETIQUETAS_ESTADO_RIESGO,
  ETIQUETAS_NIVEL_RIESGO,
  ETIQUETAS_TRATAMIENTO_RIESGO,
  TRATAMIENTOS_VIGENTES,
} from "@/lib/constantes";
import {
  COLOR_ESTADO_RIESGO,
  COLOR_NIVEL_RIESGO,
  etiquetaNivelRiesgo,
  NIVELES_RIESGO,
  ORIGENES_RIESGO,
} from "@/lib/riesgos";
import { formatearFecha } from "@/lib/formato";
import type {
  EstadoRiesgo,
  ResultadoEficacia,
  TipoRiesgo,
  TratamientoRiesgo,
} from "@/lib/tipos";

export const metadata: Metadata = { title: "Riesgos y Oportunidades" };
export const dynamic = "force-dynamic";

interface FilaRiesgo {
  id: string;
  codigo: string;
  titulo: string;
  descripcion: string | null;
  tipo: TipoRiesgo;
  categoria: string | null;
  estado: EstadoRiesgo;
  tratamiento: TratamientoRiesgo | null;
  origen: string | null;
  fecha_identificacion: string;
  causas: string | null;
  consecuencias: string | null;
  asociado_disrupcion: boolean | null;
  probabilidad: number | null;
  severidad: number | null;
  nivel: number | null;
  requiere_accion: boolean;
  accion_planificada: string | null;
  plazo_accion: string | null;
  plazo_accion_permanente: boolean;
  probabilidad_residual: number | null;
  severidad_residual: number | null;
  nivel_residual: number | null;
  fecha_evaluacion_eficacia: string | null;
  eficacia_accion: ResultadoEficacia | null;
  es_demostracion: boolean;
  /** El proceso tal como lo nombra la matriz de Calidad. */
  proceso_declarado: string | null;
  proceso_accion_declarado: string | null;
  /** El responsable tal como lo nombra la matriz: un cargo. */
  responsable_declarado: string | null;
  procesos: { nombre: string } | null;
  responsable: { nombre_completo: string } | null;
}

export default async function PaginaRiesgos({
  searchParams,
}: {
  searchParams: { q?: string; estado?: string; tipo?: string; proceso?: string; nivel?: string };
}) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data: procesos } = await supabase
    .from("procesos")
    .select("id, nombre")
    .eq("activo", true).eq("version", "01")
    .order("nombre");

  let consulta = supabase
    .from("riesgos")
    .select(
      "id, codigo, titulo, descripcion, tipo, categoria, estado, tratamiento, origen, " +
        "fecha_identificacion, causas, consecuencias, asociado_disrupcion, " +
        "probabilidad, severidad, nivel, requiere_accion, accion_planificada, plazo_accion, " +
        "plazo_accion_permanente, probabilidad_residual, severidad_residual, nivel_residual, " +
        "fecha_evaluacion_eficacia, eficacia_accion, es_demostracion, " +
        "proceso_declarado, proceso_accion_declarado, responsable_declarado, " +
        "procesos:proceso_id (nombre), responsable:responsable_id (nombre_completo)",
    )
    .order("nivel", { ascending: false });

  // Solo riesgos. Las oportunidades tienen su propia pantalla porque no
  // se valoran igual: Beneficio x Factibilidad, no Probabilidad x
  // Severidad. Mezcladas, la mitad de las columnas queda vacia en cada
  // fila y el semaforo no significa lo mismo en unas que en otras.
  consulta = consulta.eq("tipo", "riesgo");

  if (searchParams.estado) consulta = consulta.eq("estado", searchParams.estado);
  if (searchParams.proceso) consulta = consulta.eq("proceso_id", searchParams.proceso);
  // «Requieren accion» arranca en medio (5): el bajo llega hasta 4 y se
  // asume. Misma regla que `requiereAcciones` y que la columna generada
  // de la base. 9 es alto y 15 critico, como en el instructivo.
  if (searchParams.nivel === "requieren") consulta = consulta.gte("nivel", 5);
  if (searchParams.nivel === "altos") consulta = consulta.gte("nivel", 9);
  if (searchParams.nivel === "criticos") consulta = consulta.gte("nivel", 15);
  if (searchParams.q) {
    const texto = `%${searchParams.q}%`;
    consulta = consulta.or(`codigo.ilike.${texto},titulo.ilike.${texto}`);
  }

  const { data } = await consulta;
  const riesgos = (data as FilaRiesgo[] | null) ?? [];

  // Los graficos se arman sobre lo que quedo en el listado y no sobre el
  // total: si alguien filtra por proceso, los porcentajes son de ese
  // proceso, que es lo que esta mirando.
  //
  // El nivel es un semaforo y va en torta, igual que el estado: son
  // cuatro y cinco porciones, que se comparan de un vistazo. El proceso,
  // el origen y el tratamiento van en barras: son diecinueve, ocho y
  // siete, y un circulo de diecinueve porciones no se puede leer.
  //
  // Cada uno lleva su tabla de datos al lado, que la ponen los propios
  // componentes: el color nunca es lo unico que identifica una porcion.
  const porNivel = NIVELES_RIESGO.map((nivel) => ({
    etiqueta: ETIQUETAS_NIVEL_RIESGO[nivel],
    valor: riesgos.filter((riesgo) => etiquetaNivelRiesgo(riesgo.nivel) === nivel).length,
    color: COLOR_NIVEL_RIESGO[nivel],
  }));

  const porEstado = Object.entries(ETIQUETAS_ESTADO_RIESGO).map(([valor, etiqueta]) => ({
    etiqueta,
    valor: riesgos.filter((riesgo) => riesgo.estado === valor).length,
    color: COLOR_ESTADO_RIESGO[valor] ?? "hsl(var(--primario))",
  }));

  // Los que no tienen proceso entran como una fila mas. Sin eso, con uno
  // solo clasificado el grafico diria «100%» al lado de un total de
  // siete: el porcentaje tiene que ser sobre lo que se esta mirando.
  const nombresDeProceso = Array.from(
    new Set(
      riesgos
        .map((riesgo) => riesgo.procesos?.nombre)
        .filter((nombre): nombre is string => Boolean(nombre)),
    ),
  );
  const porProceso = [
    ...nombresDeProceso.map((nombre) => ({
      etiqueta: nombre,
      valor: riesgos.filter((riesgo) => riesgo.procesos?.nombre === nombre).length,
    })),
    {
      etiqueta: "Sin proceso asignado",
      valor: riesgos.filter((riesgo) => !riesgo.procesos?.nombre).length,
    },
  ];

  const porOrigen = [
    ...ORIGENES_RIESGO.map((origen) => ({
      etiqueta: origen,
      valor: riesgos.filter((riesgo) => riesgo.origen === origen).length,
    })),
    {
      etiqueta: "Sin origen declarado",
      valor: riesgos.filter(
        (riesgo) => !riesgo.origen || !ORIGENES_RIESGO.includes(riesgo.origen as never),
      ).length,
    },
  ];

  const porTratamiento = [
    ...TRATAMIENTOS_VIGENTES.map((valor) => ({
      etiqueta: ETIQUETAS_TRATAMIENTO_RIESGO[valor],
      valor: riesgos.filter((riesgo) => riesgo.tratamiento === valor).length,
    })),
    {
      etiqueta: "Sin tratamiento definido",
      valor: riesgos.filter((riesgo) => !riesgo.tratamiento).length,
    },
  ];

  return (
    <>
      <EncabezadoPagina
        titulo="Matriz de riesgos"
        acciones={
          <>
            <Boton variante="fantasma" comoHijo>
              <Link href="/oportunidades">Oportunidades</Link>
            </Boton>
            <Boton variante="contorno" comoHijo>
              <Link href="/riesgos/matriz">
                <Grid3x3 /> Ver matriz
              </Link>
            </Boton>
            {puedeGestionar(usuario) ? (
              <Boton comoHijo>
                <Link href="/riesgos/nuevo">
                  <Plus /> Nuevo riesgo
                </Link>
              </Boton>
            ) : null}
          </>
        }
      />

      <FiltrosListado
        campos={[
          {
            nombre: "nivel",
            etiqueta: "Nivel",
            opciones: [
              { valor: "requieren", etiqueta: "Requieren acción (5 o más)" },
              { valor: "altos", etiqueta: "Altos y críticos (9 o más)" },
              { valor: "criticos", etiqueta: "Solo críticos (15 o más)" },
            ],
          },
          {
            nombre: "estado",
            etiqueta: "Estado",
            opciones: Object.entries(ETIQUETAS_ESTADO_RIESGO).map(([valor, etiqueta]) => ({
              valor,
              etiqueta,
            })),
          },
          {
            nombre: "proceso",
            etiqueta: "Proceso",
            opciones: (procesos ?? []).map((proceso: { id: string; nombre: string }) => ({
              valor: proceso.id,
              etiqueta: proceso.nombre,
            })),
          },
        ]}
      />

      {riesgos.length > 0 ? (
        <div className="mb-4 grid gap-3 lg:grid-cols-2">
          <Torta titulo="Por nivel" porciones={porNivel} />
          <Torta titulo="Por estado" porciones={porEstado} />
          <BarrasPorcentaje
            titulo="Por proceso"
            filas={porProceso}
            vacio="Ninguno tiene proceso asignado."
          />
          <BarrasPorcentaje titulo="Por origen" filas={porOrigen} />
          <BarrasPorcentaje
            titulo="Por opción de tratamiento"
            filas={porTratamiento}
            className="lg:col-span-2"
          />
        </div>
      ) : null}

      {riesgos.length === 0 ? (
        <EstadoVacio
          icono={<ShieldAlert className="size-6" />}
          titulo="No hay riesgos que coincidan"
          descripcion="Ajuste los filtros o registre el primer riesgo de la matriz. Las oportunidades están en su propia pantalla."
        />
      ) : (
        <Tarjeta>
          {/* LAS COLUMNAS DE LA HOJA 6.1.2, EN SU ORDEN. Son veinticuatro
              y no caben en una pantalla: la tabla se desplaza en
              horizontal por su cuenta —lo hace `Tabla`— y el código queda
              fijo a la izquierda para no perder de vista de qué fila se
              está leyendo.

              Las columnas de párrafo van recortadas a una línea, con el
              texto entero al señalar: una tabla donde cada fila mide
              cuatro renglones deja de servir para comparar filas, que es
              para lo que existe. El texto completo está en la ficha. */}
          <Tabla>
            <TablaCabecera>
              <TablaFila>
                <TablaEncabezado className="sticky left-0 z-10 w-[7.5rem] bg-fondo">
                  Código
                </TablaEncabezado>
                <TablaEncabezado className="w-[6rem]">Fecha</TablaEncabezado>
                <TablaEncabezado className="w-[12rem]">Proceso</TablaEncabezado>
                <TablaEncabezado className="w-[11rem]">Origen</TablaEncabezado>
                <TablaEncabezado className="w-[16rem]">Descripción del riesgo</TablaEncabezado>
                <TablaEncabezado className="w-[14rem]">Causa potencial</TablaEncabezado>
                <TablaEncabezado className="w-[14rem]">Consecuencia potencial</TablaEncabezado>
                <TablaEncabezado className="w-[5rem] text-center">Disrupción</TablaEncabezado>
                <TablaEncabezado className="w-[4rem] text-center">Prob.</TablaEncabezado>
                <TablaEncabezado className="w-[4rem] text-center">Sev.</TablaEncabezado>
                <TablaEncabezado className="w-[4rem] text-center">Nivel</TablaEncabezado>
                <TablaEncabezado className="w-[8rem]">Clasificación</TablaEncabezado>
                <TablaEncabezado className="w-[6rem] text-center">
                  ¿Requiere acción?
                </TablaEncabezado>
                <TablaEncabezado className="w-[12rem]">Opción de tratamiento</TablaEncabezado>
                <TablaEncabezado className="w-[16rem]">Acción planificada</TablaEncabezado>
                <TablaEncabezado className="w-[12rem]">Responsable</TablaEncabezado>
                <TablaEncabezado className="w-[7rem]">Plazo</TablaEncabezado>
                <TablaEncabezado className="w-[12rem]">Proceso de la acción</TablaEncabezado>
                <TablaEncabezado className="w-[4rem] text-center">Prob. res.</TablaEncabezado>
                <TablaEncabezado className="w-[4rem] text-center">Sev. res.</TablaEncabezado>
                <TablaEncabezado className="w-[8rem]">Nivel residual</TablaEncabezado>
                <TablaEncabezado className="w-[7rem]">Se mide el</TablaEncabezado>
                <TablaEncabezado className="w-[8rem]">¿Acción eficaz?</TablaEncabezado>
                <TablaEncabezado className="w-[8rem]">Estado</TablaEncabezado>
              </TablaFila>
            </TablaCabecera>
            <TablaCuerpo>
              {riesgos.map((riesgo) => (
                <TablaFila key={riesgo.id}>
                  <TablaCelda className="sticky left-0 z-10 bg-fondo font-medium tabular">
                    <Link href={`/riesgos/${riesgo.id}`} className="hover:text-primario">
                      {riesgo.codigo}
                    </Link>
                    {riesgo.es_demostracion ? (
                      <span className="ml-1 align-middle">
                        <InsigniaDemostracion />
                      </span>
                    ) : null}
                  </TablaCelda>

                  <TablaCelda className="text-xs tabular text-atenuado-contraste">
                    {formatearFecha(riesgo.fecha_identificacion)}
                  </TablaCelda>

                  {/* El proceso de la matriz de Calidad va primero: el de
                      `procesos` es el del mapa de la intranet, que todavía
                      no coincide. */}
                  <CeldaTexto ancho="12rem">
                    {riesgo.proceso_declarado ?? riesgo.procesos?.nombre}
                  </CeldaTexto>

                  <CeldaTexto ancho="11rem">{riesgo.origen}</CeldaTexto>

                  <TablaCelda className="text-xs" style={{ maxWidth: "16rem" }}>
                    <Link
                      href={`/riesgos/${riesgo.id}`}
                      className="block truncate hover:text-primario"
                      title={riesgo.descripcion ?? riesgo.titulo}
                    >
                      {riesgo.descripcion ?? riesgo.titulo}
                    </Link>
                  </TablaCelda>

                  <CeldaTexto ancho="14rem">{riesgo.causas}</CeldaTexto>
                  <CeldaTexto ancho="14rem">{riesgo.consecuencias}</CeldaTexto>
                  <CeldaSiNo valor={riesgo.asociado_disrupcion} />

                  <TablaCelda className="text-center text-xs tabular">
                    {riesgo.probabilidad ?? "—"}
                  </TablaCelda>
                  <TablaCelda className="text-center text-xs tabular">
                    {riesgo.severidad ?? "—"}
                  </TablaCelda>
                  <TablaCelda className="text-center text-xs font-medium tabular">
                    {riesgo.nivel ?? "—"}
                  </TablaCelda>
                  <TablaCelda>
                    <InsigniaNivelRiesgo nivel={riesgo.nivel} mostrarValor={false} />
                  </TablaCelda>

                  {/* No se escribe: sale del semáforo. Medio para arriba
                      requiere acciones; el bajo se asume y se vigila. */}
                  <CeldaSiNo valor={riesgo.requiere_accion} />

                  <CeldaTexto ancho="12rem">
                    {riesgo.tratamiento ? ETIQUETAS_TRATAMIENTO_RIESGO[riesgo.tratamiento] : null}
                  </CeldaTexto>

                  {/* Un riesgo que exige plan y no lo tiene es lo primero
                      que mira una auditoría. */}
                  {riesgo.accion_planificada ? (
                    <CeldaTexto ancho="16rem">{riesgo.accion_planificada}</CeldaTexto>
                  ) : (
                    <TablaCelda className="text-xs">
                      {riesgo.requiere_accion ? (
                        <span className="font-medium text-semaforo-critico">Falta el plan</span>
                      ) : (
                        <span className="text-atenuado-contraste">Se asume</span>
                      )}
                    </TablaCelda>
                  )}

                  <CeldaTexto ancho="12rem">
                    {riesgo.responsable_declarado ?? riesgo.responsable?.nombre_completo}
                  </CeldaTexto>

                  {/* «Permanente» es la palabra de la matriz para los
                      controles que no terminan: no es una fecha. */}
                  <TablaCelda className="text-xs tabular text-atenuado-contraste">
                    {riesgo.plazo_accion_permanente
                      ? "Permanente"
                      : riesgo.plazo_accion
                        ? formatearFecha(riesgo.plazo_accion)
                        : "—"}
                  </TablaCelda>

                  <CeldaTexto ancho="12rem">{riesgo.proceso_accion_declarado}</CeldaTexto>

                  <TablaCelda className="text-center text-xs tabular">
                    {riesgo.probabilidad_residual ?? "—"}
                  </TablaCelda>
                  <TablaCelda className="text-center text-xs tabular">
                    {riesgo.severidad_residual ?? "—"}
                  </TablaCelda>
                  <TablaCelda>
                    {riesgo.nivel_residual !== null ? (
                      <InsigniaNivelRiesgo nivel={riesgo.nivel_residual} />
                    ) : (
                      <span className="text-xs text-atenuado-contraste">Sin evaluar</span>
                    )}
                  </TablaCelda>

                  <TablaCelda className="text-xs tabular text-atenuado-contraste">
                    {riesgo.fecha_evaluacion_eficacia
                      ? formatearFecha(riesgo.fecha_evaluacion_eficacia)
                      : "—"}
                  </TablaCelda>

                  <TablaCelda className="text-xs text-atenuado-contraste">
                    {riesgo.eficacia_accion ? ETIQUETAS_EFICACIA[riesgo.eficacia_accion] : "—"}
                  </TablaCelda>

                  <TablaCelda>
                    <InsigniaEstadoRiesgo estado={riesgo.estado} />
                  </TablaCelda>
                </TablaFila>
              ))}
            </TablaCuerpo>
          </Tabla>
        </Tarjeta>
      )}

      <p className="mt-3 text-[11px] text-atenuado-contraste">
        {riesgos.length} riesgo{riesgos.length === 1 ? "" : "s"} en el listado. Las oportunidades
        se valoran por Beneficio × Factibilidad y están en{" "}
        <Link href="/oportunidades" className="text-primario hover:underline">
          su propia pantalla
        </Link>
        .
      </p>
    </>
  );
}
