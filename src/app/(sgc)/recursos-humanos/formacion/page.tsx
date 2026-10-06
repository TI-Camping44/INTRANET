import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { Torta } from "@/components/comunes/graficos";
import { TarjetaIndicador } from "@/components/comunes/tarjeta-indicador";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Tarjeta } from "@/components/ui/tarjeta";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { hoyEnAsuncion } from "@/lib/formato";
import {
  CLASES_ESTADO_FORMACION,
  COLOR_EFICACIA_ACCION,
  COLOR_ESTADO_FORMACION,
  eficaciaDeLaAccion,
  EFICACIAS_ACCION_EN_ORDEN,
  ESTADOS_FORMACION_VIGENTES,
  ETIQUETAS_EFICACIA_ACCION,
  ETIQUETAS_ESTADO_FORMACION,
  ETIQUETAS_TIPO_FORMACION,
  TIPOS_FORMACION_VIGENTES,
  type EvaluacionDeParticipante,
} from "@/lib/formacion";
import { FormularioFormacion } from "@/app/(sgc)/recursos-humanos/formacion/formulario-formacion";
import { TablaFormaciones } from "@/app/(sgc)/recursos-humanos/formacion/tabla-formaciones";
import type { EstadoCapacitacion, ResultadoEficacia, TipoCapacitacion } from "@/lib/tipos";

export const metadata: Metadata = { title: "Formación y Competencia" };
export const dynamic = "force-dynamic";

export interface FilaFormacion {
  id: string;
  nombre: string;
  objetivo: string | null;
  modalidad: string | null;
  tipo: TipoCapacitacion;
  estado: EstadoCapacitacion;
  instructor: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  fecha_nueva: string | null;
  cantidad_sesiones: number | null;
  horas_por_sesion: number | null;
  horas_totales: number | null;
  requiere_eficacia: boolean;
  comentario_estado: string | null;
  formador: { nombre_completo: string } | null;
}

/**
 * Formación y Competencia.
 *
 * El segundo submódulo de Personas: donde Capital Humano planifica las
 * acciones formativas del año y les sigue el rastro.
 *
 * LA VISTA PRINCIPAL ES EL CALENDARIO, como la planilla que venían
 * llevando: una fila por acción y doce columnas de meses, pintadas donde
 * la acción cae. Es lo que permite ver de un barrido si el año está
 * repartido o si todo está amontonado en diciembre.
 *
 * El año se elige: el plan es anual y a fin de año hay que poder mirar
 * el que viene sin perder el que pasó.
 */
export default async function PaginaFormacion({
  searchParams,
}: {
  searchParams: { anio?: string };
}) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();
  const gestiona = puedeGestionar(usuario);

  const anioPedido = Number(searchParams.anio);
  const anio = Number.isInteger(anioPedido)
    ? anioPedido
    : Number(hoyEnAsuncion().slice(0, 4));

  const [{ data: datos }, { data: personas }, { data: participaciones }] = await Promise.all([
    supabase
      .from("capacitaciones")
      .select(
        "id, nombre, objetivo, modalidad, tipo, estado, instructor, fecha_inicio, fecha_fin, " +
          "fecha_nueva, cantidad_sesiones, horas_por_sesion, horas_totales, requiere_eficacia, " +
          "comentario_estado, formador:formador_id (nombre_completo)",
      )
      .order("fecha_inicio", { nullsFirst: false }),
    supabase
      .from("usuarios")
      .select("id, nombre_completo")
      .eq("activo", true)
      .order("nombre_completo"),
    supabase
      .from("capacitacion_participantes")
      .select("capacitacion_id, usuario_id, eficacia, eficacia_inicial"),
  ]);

  const todas = (datos as FilaFormacion[] | null) ?? [];

  // Del año elegido: las que empiezan o terminan en él. Una acción que
  // cruza el fin de año aparece en los dos, que es lo correcto: ocupa
  // meses de los dos calendarios.
  const formaciones = todas.filter((formacion) => {
    const desde = formacion.fecha_inicio ?? formacion.fecha_fin;
    const hasta = formacion.fecha_fin ?? formacion.fecha_inicio;
    if (!desde || !hasta) return true; // Sin fecha: se muestra siempre, falta cargarla.
    return Number(desde.slice(0, 4)) <= anio && Number(hasta.slice(0, 4)) >= anio;
  });

  const anios = Array.from(
    new Set(
      todas
        .map((formacion) => formacion.fecha_inicio?.slice(0, 4) ?? formacion.fecha_fin?.slice(0, 4))
        .filter((valor): valor is string => Boolean(valor))
        .map(Number)
        .concat(Number(hoyEnAsuncion().slice(0, 4))),
    ),
  ).sort((uno, otro) => otro - uno);

  // Cuántos participantes tiene cada acción, y con qué resultado. Lo
  // segundo es lo que decide la eficacia de la acción: no se guarda en
  // ninguna columna, se deduce de su gente cada vez que se mira.
  const participantesPor = new Map<string, number>();
  const evaluacionesPor = new Map<string, EvaluacionDeParticipante[]>();

  for (const fila of (participaciones as
    | {
        capacitacion_id: string;
        eficacia: ResultadoEficacia;
        eficacia_inicial: ResultadoEficacia | null;
      }[]
    | null) ?? []) {
    participantesPor.set(fila.capacitacion_id, (participantesPor.get(fila.capacitacion_id) ?? 0) + 1);
    evaluacionesPor.set(fila.capacitacion_id, [
      ...(evaluacionesPor.get(fila.capacitacion_id) ?? []),
      { eficacia: fila.eficacia, eficacia_inicial: fila.eficacia_inicial },
    ]);
  }

  // Los gráficos se arman sobre el año que se está mirando, no sobre el
  // total: si alguien elige 2027, los porcentajes son de 2027.
  const porEstado = ESTADOS_FORMACION_VIGENTES.map((estado) => ({
    etiqueta: ETIQUETAS_ESTADO_FORMACION[estado],
    valor: formaciones.filter((formacion) => formacion.estado === estado).length,
    color: COLOR_ESTADO_FORMACION[estado] ?? "hsl(var(--primario))",
  }));

  const porTipo = TIPOS_FORMACION_VIGENTES.map((tipo) => ({
    etiqueta: ETIQUETAS_TIPO_FORMACION[tipo],
    valor: formaciones.filter((formacion) => formacion.tipo === tipo).length,
    color:
      tipo === "interna" ? "hsl(var(--semaforo-bajo))" : "hsl(var(--primario))",
  }));

  // LA EFICACIA, EN LUGAR DE LA MODALIDAD. La modalidad ya está en la
  // tabla, columna propia, y repetirla en un gráfico no agregaba nada:
  // saber que el 100 % fue presencial no cambia ninguna decisión. La
  // eficacia sí: es lo que la Revisión por la Dirección pregunta del
  // plan de formación.
  //
  // Solo entran las que EXIGEN evaluarla —más de 2 horas—. Contar las
  // que no la exigen como «pendientes» llenaría el gráfico de acciones
  // que nunca van a tener resultado, y el número dejaría de significar
  // algo.
  const conEficaciaExigida = formaciones.filter((formacion) => formacion.requiere_eficacia);

  const porEficacia = EFICACIAS_ACCION_EN_ORDEN.map((resultado) => ({
    etiqueta: ETIQUETAS_EFICACIA_ACCION[resultado],
    valor: conEficaciaExigida.filter(
      (formacion) => eficaciaDeLaAccion(evaluacionesPor.get(formacion.id) ?? []) === resultado,
    ).length,
    color: COLOR_EFICACIA_ACCION[resultado],
  }));

  // LOS CUATRO NUMEROS SE CUENTAN POR ESTADO, sobre el año que se está
  // mirando. Al contarse así no hay nada que mantener sincronizado: una
  // acción que pasa de «No ejecutada» a «Ejecutada» deja de sumar en una
  // tarjeta y suma en la otra sola, porque las dos miran el mismo campo.
  const cuantasEn = (estado: EstadoCapacitacion) =>
    formaciones.filter((formacion) => formacion.estado === estado).length;

  const ejecutadas = cuantasEn("ejecutada");
  const noEjecutadas = cuantasEn("no_ejecutada");
  const pospuestas = cuantasEn("pospuesta");

  const porcentajeDelPlan = (cuantas: number) =>
    formaciones.length > 0
      ? `${Math.round((cuantas * 100) / formaciones.length)} % del plan`
      : undefined;

  return (
    <>
      <EncabezadoPagina
        titulo="Formación y Competencia"
        descripcion="El plan anual de acciones formativas y su calendario de impartición."
        acciones={
          gestiona ? (
            <FormularioFormacion
              personas={(personas as { id: string; nombre_completo: string }[]) ?? []}
            />
          ) : null
        }
      />

      {/* El año. Enlaces y no un desplegable: así la pantalla sigue
          siendo de servidor y el año queda en la dirección. */}
      {anios.length > 1 ? (
        <div className="mb-4 flex items-center gap-1">
          {anios.map((valor) => (
            <Link
              key={valor}
              href={`/recursos-humanos/formacion?anio=${valor}`}
              className={
                valor === anio
                  ? "rounded border border-primario bg-primario/10 px-2 py-1 text-xs font-medium tabular text-primario"
                  : "rounded border border-borde px-2 py-1 text-xs tabular text-atenuado-contraste transition-colors hover:text-texto"
              }
            >
              {valor}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaIndicador titulo={`Acciones del ${anio}`} valor={formaciones.length} />
        <TarjetaIndicador
          titulo="Ejecutadas"
          valor={ejecutadas}
          contexto={porcentajeDelPlan(ejecutadas)}
          tono={ejecutadas > 0 ? "exito" : undefined}
        />
        <TarjetaIndicador
          titulo="No ejecutadas"
          valor={noEjecutadas}
          contexto={porcentajeDelPlan(noEjecutadas)}
          tono={noEjecutadas > 0 ? "peligro" : undefined}
        />
        <TarjetaIndicador
          titulo="Pospuestas"
          valor={pospuestas}
          contexto={porcentajeDelPlan(pospuestas)}
          tono={pospuestas > 0 ? "advertencia" : undefined}
        />
      </div>

      {formaciones.length > 0 ? (
        <div className="mb-4 grid gap-3 lg:grid-cols-3">
          <Torta titulo="Por estado" porciones={porEstado} />
          <Torta titulo="Interna o externa" porciones={porTipo} />
          <Torta titulo="Eficacia de la acción" porciones={porEficacia} />
        </div>
      ) : null}

      {formaciones.length === 0 ? (
        <EstadoVacio
          icono={<GraduationCap className="size-6" />}
          titulo={`Sin acciones formativas en ${anio}`}
          descripcion="Planifique la primera. Cada acción lleva su objetivo, su formador, sus participantes y su calendario."
          accion={
            gestiona ? (
              <FormularioFormacion
                personas={(personas as { id: string; nombre_completo: string }[]) ?? []}
              />
            ) : null
          }
        />
      ) : (
        <Tarjeta>
          <TablaFormaciones
            formaciones={formaciones}
            participantes={Object.fromEntries(participantesPor)}
            eficacias={Object.fromEntries(
              formaciones.map((formacion) => [
                formacion.id,
                eficaciaDeLaAccion(evaluacionesPor.get(formacion.id) ?? []),
              ]),
            )}
            anio={anio}
            clasesEstado={CLASES_ESTADO_FORMACION}
            etiquetasEstado={ETIQUETAS_ESTADO_FORMACION}
          />
        </Tarjeta>
      )}
    </>
  );
}
