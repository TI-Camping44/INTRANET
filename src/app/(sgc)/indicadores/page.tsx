import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Target } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltrosListado } from "@/components/comunes/filtros-listado";
import { BarrasPorcentaje, Torta } from "@/components/comunes/graficos";
import { TarjetaIndicador } from "@/components/comunes/tarjeta-indicador";
import { CalendarioObjetivos } from "@/app/(sgc)/indicadores/calendario-objetivos";
import { Boton } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { hoyEnAsuncion } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import {
  ESTADOS_OBJETIVO,
  ETIQUETAS_ESTADO_OBJETIVO,
  ETIQUETAS_FRECUENCIA_MEDICION,
  ETIQUETAS_TIPO_RESULTADO,
  FRECUENCIAS_MEDICION,
  TIPOS_RESULTADO,
  type EstadoObjetivo,
  type FrecuenciaMedicion,
  type MedicionMensual,
  type TipoResultadoObjetivo,
} from "@/lib/objetivos";

export const metadata: Metadata = { title: "Objetivos e Indicadores" };
export const dynamic = "force-dynamic";

/**
 * La pantalla del módulo: los objetivos de la calidad.
 *
 * EL OBJETIVO ES LA UNIDAD, NO EL INDICADOR. Hasta el 8 de octubre esta
 * pantalla era una lista de indicadores con los objetivos abajo, en un
 * panel aparte, y el vínculo entre los dos quedaba librado a que alguien
 * se acordara de elegir el objetivo al dar de alta el indicador. Ahora
 * el objetivo manda: la tabla principal son los objetivos y los
 * indicadores de cada uno se cargan, se editan y se eliminan dentro de
 * su ficha.
 *
 * Y ES UN CALENDARIO: el objetivo y sus doce meses, nada más. Dirección
 * lo pidió así el 8 de octubre. El F-EST-01-05 salió de esta pantalla el
 * mismo día: cruzaba objetivo e indicador con los doce meses y repetía
 * lo que el calendario ya dice, con treinta columnas en vez de doce. La
 * hoja sigue armada en `hoja.ts` y dibujada por `tabla-hoja.tsx`, por si
 * Calidad la vuelve a pedir en su propia pantalla.
 */
const COLOR_ESTADO_OBJETIVO: Record<EstadoObjetivo, string> = {
  identificado: "hsl(var(--atenuado-contraste))",
  a_medir: "hsl(var(--semaforo-medio))",
  en_medicion: "hsl(var(--primario))",
  cerrado: "hsl(var(--semaforo-bajo))",
};

interface FilaObjetivo {
  id: string;
  codigo: string;
  nombre: string;
  estado: EstadoObjetivo;
  empresa_objetivo_id: string | null;
  fecha_inicio_medicion: string | null;
  fecha_fin_medicion: string | null;
  tipo_resultado: TipoResultadoObjetivo | null;
  resultado_esperado_si_no: boolean | null;
  resultado_esperado_texto: string | null;
  valor_minimo: number | null;
  valor_maximo: number | null;
  unidad_valor: string | null;
  frecuencia_medicion: FrecuenciaMedicion | null;
  objetivo_alcanzado: boolean | null;
  responsable: { nombre_completo: string } | null;
}

export default async function PaginaIndicadores({
  searchParams,
}: {
  searchParams: {
    q?: string;
    estado?: string;
    empresa?: string;
    frecuencia?: string;
    anio?: string;
  };
}) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  // EL AÑO SE ELIGE, y los que se ofrecen son el de hoy y los que tengan
  // objetivos declarados. El de hoy va siempre: Calidad registra el
  // objetivo una vez, con el año de su línea base, y lo sigue midiendo
  // los años siguientes. Cuáles rigen en cada año lo resuelve
  // `obtenerHoja`. Acá el año es el del calendario.
  const { data: anios } = await supabase
    .from("objetivos")
    .select("anio")
    .order("anio", { ascending: false });

  const anioDeHoy = Number(hoyEnAsuncion().slice(0, 4));
  const aniosConObjetivos = Array.from(
    new Set([anioDeHoy, ...((anios as { anio: number }[] | null) ?? []).map((fila) => fila.anio)]),
  ).sort((uno, otro) => otro - uno);

  const anioPedido = Number(searchParams.anio);
  const anio =
    Number.isInteger(anioPedido) && aniosConObjetivos.includes(anioPedido)
      ? anioPedido
      : (aniosConObjetivos[0] ?? anioDeHoy);

  // LOS OBJETIVOS NO SE FILTRAN POR AÑO. Un objetivo de 2026 que se mide
  // hasta marzo de 2027 tiene que seguir viéndose en 2027: el período de
  // medición es el que manda, y está en la tabla.
  let consulta = supabase
    .from("objetivos")
    .select(
      "id, codigo, nombre, estado, empresa_objetivo_id, fecha_inicio_medicion, " +
        "fecha_fin_medicion, tipo_resultado, resultado_esperado_si_no, " +
        "resultado_esperado_texto, valor_minimo, valor_maximo, unidad_valor, " +
        "frecuencia_medicion, objetivo_alcanzado, responsable:responsable_id (nombre_completo)",
    )
    .order("codigo");

  if (searchParams.estado) consulta = consulta.eq("estado", searchParams.estado);
  if (searchParams.empresa) consulta = consulta.eq("empresa_objetivo_id", searchParams.empresa);
  if (searchParams.frecuencia) {
    consulta = consulta.eq("frecuencia_medicion", searchParams.frecuencia);
  }
  if (searchParams.q) {
    const texto = `%${searchParams.q}%`;
    consulta = consulta.or(`codigo.ilike.${texto},nombre.ilike.${texto}`);
  }

  const [{ data: datosObjetivos }, { data: datosEmpresas }, { data: datosIndicadores }] =
    await Promise.all([
      consulta,
      supabase.rpc("empresas_del_grupo"),
      // Para decir cuántos indicadores mide cada objetivo. Una consulta,
      // no una por fila.
      supabase.from("indicadores").select("id, objetivo_id").eq("activo", true),
    ]);

  const objetivos = (datosObjetivos as unknown as FilaObjetivo[] | null) ?? [];
  const empresasDelGrupo = (datosEmpresas as { id: string; nombre: string }[] | null) ?? [];

  const indicadoresPorObjetivo = new Map<string, number>();
  for (const indicador of (datosIndicadores as { objetivo_id: string | null }[] | null) ?? []) {
    if (!indicador.objetivo_id) continue;
    indicadoresPorObjetivo.set(
      indicador.objetivo_id,
      (indicadoresPorObjetivo.get(indicador.objetivo_id) ?? 0) + 1,
    );
  }

  // Los resultados mensuales de los objetivos que quedaron en el
  // listado. Una consulta, no una por fila.
  const { data: datosMediciones } = objetivos.length
    ? await supabase
        .from("objetivo_mediciones")
        .select("objetivo_id, anio, mes, valor_numerico, resultado_si_no, resultado_texto, comentario")
        .eq("anio", anio)
        .in(
          "objetivo_id",
          objetivos.map((objetivo) => objetivo.id),
        )
    : { data: [] };

  const medicionesPorObjetivo = new Map<string, MedicionMensual[]>();
  for (const fila of (datosMediciones as (MedicionMensual & { objetivo_id: string })[] | null) ??
    []) {
    const suyas = medicionesPorObjetivo.get(fila.objetivo_id) ?? [];
    suyas.push(fila);
    medicionesPorObjetivo.set(fila.objetivo_id, suyas);
  }

  // Los gráficos se arman sobre lo que quedó en el listado y no sobre el
  // total: si alguien filtra, los porcentajes son de lo que está mirando.
  //
  // El estado va en torta —son cuatro y se comparan de un vistazo— y la
  // empresa, la frecuencia y el tipo en barras. Cada uno lleva su tabla
  // de datos al lado, que la ponen los propios componentes.
  const porEstado = ESTADOS_OBJETIVO.map((estado) => ({
    etiqueta: ETIQUETAS_ESTADO_OBJETIVO[estado],
    valor: objetivos.filter((objetivo) => objetivo.estado === estado).length,
    color: COLOR_ESTADO_OBJETIVO[estado],
  }));

  const porEmpresa = [
    ...empresasDelGrupo.map((empresa) => ({
      etiqueta: empresa.nombre,
      valor: objetivos.filter((objetivo) => objetivo.empresa_objetivo_id === empresa.id).length,
    })),
    {
      etiqueta: "Sin empresa declarada",
      valor: objetivos.filter((objetivo) => !objetivo.empresa_objetivo_id).length,
    },
  ];

  const porFrecuencia = [
    ...FRECUENCIAS_MEDICION.map((frecuencia) => ({
      etiqueta: ETIQUETAS_FRECUENCIA_MEDICION[frecuencia],
      valor: objetivos.filter((objetivo) => objetivo.frecuencia_medicion === frecuencia).length,
    })),
    {
      etiqueta: "Sin frecuencia declarada",
      valor: objetivos.filter((objetivo) => !objetivo.frecuencia_medicion).length,
    },
  ];

  const porTipo = [
    ...TIPOS_RESULTADO.map((tipo) => ({
      etiqueta: ETIQUETAS_TIPO_RESULTADO[tipo],
      valor: objetivos.filter((objetivo) => objetivo.tipo_resultado === tipo).length,
    })),
    {
      etiqueta: "Sin tipo declarado",
      valor: objetivos.filter((objetivo) => !objetivo.tipo_resultado).length,
    },
  ];

  const enMedicion = objetivos.filter((objetivo) => objetivo.estado === "en_medicion").length;
  const cerrados = objetivos.filter((objetivo) => objetivo.estado === "cerrado");
  const alcanzados = cerrados.filter((objetivo) => objetivo.objetivo_alcanzado === true).length;
  const sinIndicador = objetivos.filter(
    (objetivo) => (indicadoresPorObjetivo.get(objetivo.id) ?? 0) === 0,
  ).length;

  const gestiona = puedeGestionar(usuario);

  return (
    <>
      <EncabezadoPagina
        titulo="Objetivos e Indicadores"
        acciones={
          gestiona ? (
            <Boton comoHijo>
              <Link href="/indicadores/objetivos/nuevo">
                <Plus /> Nuevo objetivo
              </Link>
            </Boton>
          ) : null
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaIndicador titulo="Objetivos" valor={objetivos.length} />
        <TarjetaIndicador
          titulo="En medición"
          valor={enMedicion}
          contexto="Con la medición en curso"
          tono="exito"
        />
        <TarjetaIndicador
          titulo="Cerrados"
          valor={cerrados.length}
          contexto={`${alcanzados} alcanzado${alcanzados === 1 ? "" : "s"}`}
        />
        <TarjetaIndicador
          titulo="Sin indicador"
          valor={sinIndicador}
          contexto="Objetivos sin con qué medirse"
          tono={sinIndicador > 0 ? "advertencia" : "exito"}
        />
      </div>

      {objetivos.length > 0 ? (
        <div className="mb-4 grid gap-3 lg:grid-cols-2">
          <Torta titulo="Por estado" porciones={porEstado} />
          <BarrasPorcentaje titulo="Por empresa" filas={porEmpresa} />
          <BarrasPorcentaje titulo="Por frecuencia de medición" filas={porFrecuencia} />
          <BarrasPorcentaje titulo="Por tipo de objetivo" filas={porTipo} />
        </div>
      ) : null}

      {/* EL AÑO DEL CALENDARIO. Enlaces y no un desplegable: así la
          pantalla sigue siendo de servidor y el año queda en la
          dirección, que se puede guardar y compartir. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-wide text-atenuado-contraste">
          Año del calendario
        </span>
        {aniosConObjetivos.map((valor) => (
          <Link
            key={valor}
            href={`/indicadores?anio=${valor}`}
            className={cn(
              "rounded border px-2 py-1 text-xs tabular transition-colors",
              valor === anio
                ? "border-primario bg-primario/10 font-medium text-primario"
                : "border-borde text-atenuado-contraste hover:text-texto",
            )}
          >
            {valor}
          </Link>
        ))}
      </div>

      <FiltrosListado
        marcadorBusqueda="Buscar por código o denominación…"
        campos={[
          {
            nombre: "estado",
            etiqueta: "Estado",
            opciones: ESTADOS_OBJETIVO.map((valor) => ({
              valor,
              etiqueta: ETIQUETAS_ESTADO_OBJETIVO[valor],
            })),
          },
          {
            nombre: "empresa",
            etiqueta: "Empresa",
            opciones: empresasDelGrupo.map((empresa) => ({
              valor: empresa.id,
              etiqueta: empresa.nombre,
            })),
          },
          {
            nombre: "frecuencia",
            etiqueta: "Frecuencia",
            opciones: FRECUENCIAS_MEDICION.map((valor) => ({
              valor,
              etiqueta: ETIQUETAS_FRECUENCIA_MEDICION[valor],
            })),
          },
        ]}
      />

      {objetivos.length === 0 ? (
        <EstadoVacio
          icono={<Target className="size-6" />}
          titulo="No hay objetivos que coincidan"
          descripcion="Ajuste los filtros o declare el primer objetivo de la calidad."
          accion={
            gestiona ? (
              <Boton comoHijo tamano="pequeno">
                <Link href="/indicadores/objetivos/nuevo">
                  <Plus /> Nuevo objetivo
                </Link>
              </Boton>
            ) : null
          }
        />
      ) : (
        <CalendarioObjetivos
          objetivos={objetivos.map((objetivo) => ({
            id: objetivo.id,
            codigo: objetivo.codigo,
            nombre: objetivo.nombre,
            fecha_inicio_medicion: objetivo.fecha_inicio_medicion,
            fecha_fin_medicion: objetivo.fecha_fin_medicion,
            frecuencia_medicion: objetivo.frecuencia_medicion,
            tipo_resultado: objetivo.tipo_resultado,
            resultado_esperado_si_no: objetivo.resultado_esperado_si_no,
            valor_minimo: objetivo.valor_minimo,
            valor_maximo: objetivo.valor_maximo,
            unidad_valor: objetivo.unidad_valor,
            mediciones: medicionesPorObjetivo.get(objetivo.id) ?? [],
          }))}
          anio={anio}
          puedeEditar={gestiona}
        />
      )}

      <p className="mt-3 text-[11px] text-atenuado-contraste">
        {objetivos.length} objetivo{objetivos.length === 1 ? "" : "s"} en el listado, con sus doce
        meses de {anio}. Toque un mes para registrar o corregir el resultado; el nombre del
        objetivo abre su ficha, donde se cargan las acciones y los indicadores.
      </p>

    </>
  );
}
