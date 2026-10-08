import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Target } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltrosListado } from "@/components/comunes/filtros-listado";
import { BarrasPorcentaje, Torta } from "@/components/comunes/graficos";
import { TarjetaIndicador } from "@/components/comunes/tarjeta-indicador";
import { obtenerHoja } from "@/app/(sgc)/indicadores/hoja";
import { TablaHoja } from "@/app/(sgc)/indicadores/tabla-hoja";
import { Boton } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia } from "@/components/ui/insignia";
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
import { formatearFecha, hoyEnAsuncion } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import {
  ESTADOS_OBJETIVO,
  ETIQUETAS_ESTADO_OBJETIVO,
  ETIQUETAS_FRECUENCIA_MEDICION,
  ETIQUETAS_TIPO_RESULTADO,
  FRECUENCIAS_MEDICION,
  TIPOS_RESULTADO,
  VARIANTE_ESTADO_OBJETIVO,
  resultadoEsperado,
  type EstadoObjetivo,
  type FrecuenciaMedicion,
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
 * El F-EST-01-05 sigue abajo, entero. Es la hoja que Calidad venía
 * llevando en el Drive y la que un auditor pide ver: cruza objetivo e
 * indicador en la misma fila con los doce meses, que es lo que ninguna
 * de las dos pantallas muestra por separado.
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
  // `obtenerHoja`; el año solo manda sobre la hoja del F-EST-01-05.
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

  const [hoja, { data: datosObjetivos }, { data: datosEmpresas }, { data: datosIndicadores }] =
    await Promise.all([
      obtenerHoja(anio),
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

  const nombreDeEmpresa = new Map(empresasDelGrupo.map((empresa) => [empresa.id, empresa.nombre]));

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
        descripcion="Cada objetivo declara qué se quiere lograr, en qué período y contra qué resultado esperado. Los indicadores con los que se mide se cargan dentro de su ficha."
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
        <Tarjeta>
          <Tabla barraSuperior>
            <TablaCabecera>
              <TablaFila>
                <TablaEncabezado className="w-[6.5rem]">Código</TablaEncabezado>
                <TablaEncabezado className="w-[18rem]">Denominación</TablaEncabezado>
                <TablaEncabezado className="hidden w-[11rem] lg:table-cell">
                  Empresa
                </TablaEncabezado>
                <TablaEncabezado className="hidden w-[12rem] xl:table-cell">
                  Responsable
                </TablaEncabezado>
                <TablaEncabezado className="w-[12rem]">Período de medición</TablaEncabezado>
                <TablaEncabezado className="hidden w-[7rem] lg:table-cell">
                  Frecuencia
                </TablaEncabezado>
                <TablaEncabezado className="hidden w-[14rem] xl:table-cell">
                  Resultado esperado
                </TablaEncabezado>
                <TablaEncabezado className="w-[6rem] text-center">Indicadores</TablaEncabezado>
                <TablaEncabezado className="w-[9rem]">Estado</TablaEncabezado>
                <TablaEncabezado className="w-[4.5rem] text-right">Ficha</TablaEncabezado>
              </TablaFila>
            </TablaCabecera>
            <TablaCuerpo>
              {objetivos.map((objetivo) => {
                const cuantos = indicadoresPorObjetivo.get(objetivo.id) ?? 0;

                return (
                  <TablaFila key={objetivo.id}>
                    <TablaCelda className="font-medium tabular">
                      <Link
                        href={`/indicadores/objetivos/${objetivo.id}`}
                        className="hover:text-primario"
                      >
                        {objetivo.codigo}
                      </Link>
                    </TablaCelda>
                    <TablaCelda>
                      <Link
                        href={`/indicadores/objetivos/${objetivo.id}`}
                        className="block text-xs hover:text-primario"
                      >
                        {objetivo.nombre}
                      </Link>
                    </TablaCelda>
                    <TablaCelda className="hidden text-xs text-atenuado-contraste lg:table-cell">
                      {objetivo.empresa_objetivo_id
                        ? (nombreDeEmpresa.get(objetivo.empresa_objetivo_id) ?? "—")
                        : "—"}
                    </TablaCelda>
                    <TablaCelda className="hidden text-xs text-atenuado-contraste xl:table-cell">
                      {objetivo.responsable?.nombre_completo ?? "—"}
                    </TablaCelda>
                    <TablaCelda className="whitespace-nowrap text-xs tabular text-atenuado-contraste">
                      {objetivo.fecha_inicio_medicion && objetivo.fecha_fin_medicion
                        ? `${formatearFecha(objetivo.fecha_inicio_medicion)} al ${formatearFecha(objetivo.fecha_fin_medicion)}`
                        : "—"}
                    </TablaCelda>
                    <TablaCelda className="hidden text-xs text-atenuado-contraste lg:table-cell">
                      {objetivo.frecuencia_medicion
                        ? ETIQUETAS_FRECUENCIA_MEDICION[objetivo.frecuencia_medicion]
                        : "—"}
                    </TablaCelda>
                    <TablaCelda
                      className="hidden text-xs text-atenuado-contraste xl:table-cell"
                      style={{ maxWidth: "14rem" }}
                    >
                      <span className="block truncate" title={resultadoEsperado(objetivo)}>
                        {resultadoEsperado(objetivo)}
                      </span>
                    </TablaCelda>
                    <TablaCelda className="text-center text-xs tabular">
                      {cuantos > 0 ? (
                        cuantos
                      ) : (
                        <span className="font-medium text-semaforo-medio">0</span>
                      )}
                    </TablaCelda>
                    <TablaCelda>
                      <div className="flex flex-wrap items-center gap-1">
                        <Insignia
                          variante={
                            VARIANTE_ESTADO_OBJETIVO[objetivo.estado] as "neutra" | "exito"
                          }
                        >
                          {ETIQUETAS_ESTADO_OBJETIVO[objetivo.estado]}
                        </Insignia>
                        {objetivo.estado === "cerrado" && objetivo.objetivo_alcanzado !== null ? (
                          <Insignia
                            variante={objetivo.objetivo_alcanzado ? "exito" : "peligro"}
                          >
                            {objetivo.objetivo_alcanzado ? "Alcanzado" : "No alcanzado"}
                          </Insignia>
                        ) : null}
                      </div>
                    </TablaCelda>
                    <TablaCelda className="text-right">
                      <Link
                        href={`/indicadores/objetivos/${objetivo.id}`}
                        className="text-xs text-primario hover:underline"
                      >
                        Ver
                      </Link>
                    </TablaCelda>
                  </TablaFila>
                );
              })}
            </TablaCuerpo>
          </Tabla>
        </Tarjeta>
      )}

      <p className="mt-3 text-[11px] text-atenuado-contraste">
        {objetivos.length} objetivo{objetivos.length === 1 ? "" : "s"} en el listado. «Ver» abre la
        ficha, donde se cargan las acciones y los indicadores con los que se mide.
      </p>

      {/* EL F-EST-01-05, ENTERO. Es la hoja que Calidad venía llevando en
          el Drive: cruza el objetivo con su indicador y los doce meses
          del año, que es lo que ninguna de las dos fichas muestra. */}
      <div className="mb-3 mt-8 flex items-end justify-between gap-3 border-b border-borde pb-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">
            Objetivos de la calidad e indicadores · {anio}
          </h2>
          <p className="mt-0.5 text-xs text-atenuado-contraste">
            F-EST-01-05. Las mismas columnas de la hoja: el resultado, el cumplimiento y el
            semáforo los calcula el sistema a partir de los meses cargados.
          </p>
        </div>

        {/* El año, cuando hay más de uno cargado. Enlaces y no un
            desplegable: así la pantalla sigue siendo de servidor y el año
            queda en la dirección, que se puede guardar y compartir. */}
        {aniosConObjetivos.length > 1 ? (
          <div className="flex shrink-0 items-center gap-1">
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
        ) : null}
      </div>

      <TablaHoja hoja={hoja} puedeEditar={gestiona} />
    </>
  );
}
