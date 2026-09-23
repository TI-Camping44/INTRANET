import type { Metadata } from "next";
import Link from "next/link";
import { Plus, TriangleAlert } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltrosListado } from "@/components/comunes/filtros-listado";
import {
  InsigniaDemostracion,
  InsigniaEstadoNC,
  InsigniaSeveridad,
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
import { esSoloLectura, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import {
  AREAS_ORGANIZACIONALES,
  AREAS_VIGENTES,
  ESTADOS_NC_ABIERTOS,
  ETIQUETAS_ORIGEN_NC,
  ETIQUETAS_SEVERIDAD_NC,
  ORIGENES_NC_VIGENTES,
} from "@/lib/constantes";
import { describirVencimiento, diasHasta, formatearFecha, hoyEnAsuncion } from "@/lib/formato";
import { BarrasPorcentaje, Torta } from "@/app/(sgc)/no-conformidades/graficos";
import {
  condicionDePaso,
  COLOR_PASO_NC,
  ETIQUETAS_PASO_NC,
  pasoDeNoConformidad,
  PASOS_NO_CONFORMIDAD,
} from "@/lib/no-conformidades";
import { recortar } from "@/lib/utilidades";
import type {
  AreaOrganizacional,
  EstadoNoConformidad,
  OrigenNoConformidad,
  SeveridadNoConformidad,
} from "@/lib/tipos";

export const metadata: Metadata = { title: "No conformidades" };
export const dynamic = "force-dynamic";

interface FilaNoConformidad {
  id: string;
  codigo: string;
  titulo: string;
  origen: OrigenNoConformidad;
  severidad: SeveridadNoConformidad;
  estado: EstadoNoConformidad;
  cierre_en_plazo: boolean | null;
  area: AreaOrganizacional | null;
  fecha_deteccion: string;
  fecha_limite_cierre: string | null;
  es_demostracion: boolean;
  nc_acciones: { id: string; estado: string }[] | null;
  procesos: { nombre: string } | null;
  responsable: { nombre_completo: string } | null;
}

export default async function PaginaNoConformidades({
  searchParams,
}: {
  searchParams: {
    q?: string;
    estado?: string;
    severidad?: string;
    origen?: string;
    area?: string;
    proceso?: string;
  };
}) {
  const usuario = await requerirUsuario();
  const soloLectura = esSoloLectura(usuario);
  const supabase = crearClienteServidor();

  const { data: procesos } = await supabase
    .from("procesos")
    .select("id, nombre")
    .eq("activo", true)
    .order("nombre");

  let consulta = supabase
    .from("no_conformidades")
    .select(
      "id, codigo, titulo, origen, severidad, estado, cierre_en_plazo, area, fecha_deteccion, " +
        "fecha_limite_cierre, es_demostracion, nc_acciones (id, estado), " +
        "procesos:proceso_id (nombre), " +
        "responsable:responsable_id (nombre_completo)",
    )
    // Por correlativo ascendente: NC-2026-001, 002, 003. Ordenar por fecha
    // dejaba el listado desordenado a la vista, porque el correlativo y la
    // fecha de deteccion no siempre van juntos.
    .order("codigo", { ascending: true });

  // Los cuatro estados que ve Calidad no son cuatro valores de `estado`:
  // los dos cierres comparten 'cerrada' y se separan por
  // `cierre_en_plazo`. La traduccion vive en `condicionDePaso`.
  const condicion = condicionDePaso(searchParams.estado);
  if (condicion) {
    consulta = consulta.eq("estado", condicion.estado);
    if (condicion.enPlazo === true) consulta = consulta.eq("cierre_en_plazo", true);
    // Un cierre viejo sin clasificar cuenta como fuera de plazo, igual
    // que en `pasoDeNoConformidad`: no se le inventa un cumplimiento.
    if (condicion.enPlazo === false) consulta = consulta.not("cierre_en_plazo", "is", true);
  }
  if (searchParams.severidad) consulta = consulta.eq("severidad", searchParams.severidad);
  if (searchParams.origen) consulta = consulta.eq("origen", searchParams.origen);
  if (searchParams.area) consulta = consulta.eq("area", searchParams.area);
  if (searchParams.proceso) consulta = consulta.eq("proceso_id", searchParams.proceso);
  if (searchParams.q) {
    const texto = `%${searchParams.q}%`;
    consulta = consulta.or(`codigo.ilike.${texto},titulo.ilike.${texto}`);
  }

  const { data } = await consulta;
  const noConformidades = (data as FilaNoConformidad[] | null) ?? [];
  const hoy = hoyEnAsuncion();

  // Los graficos se arman sobre lo que quedo en el listado, no sobre el
  // total: si alguien filtra por area, los porcentajes son de esa area,
  // que es lo que esta mirando.
  const porPaso = PASOS_NO_CONFORMIDAD.map((paso) => ({
    etiqueta: ETIQUETAS_PASO_NC[paso],
    valor: noConformidades.filter(
      (nc) => pasoDeNoConformidad(nc.estado, nc.cierre_en_plazo) === paso,
    ).length,
    color: COLOR_PASO_NC[paso],
  }));

  // La severidad tambien es un semaforo: mayor es lo grave, la
  // observacion es lo que todavia no lo es.
  const COLOR_SEVERIDAD: Record<string, string> = {
    mayor: "hsl(var(--semaforo-critico))",
    menor: "hsl(var(--semaforo-medio))",
    observacion: "hsl(var(--atenuado-contraste))",
  };

  const porSeveridad = Object.entries(ETIQUETAS_SEVERIDAD_NC).map(([valor, etiqueta]) => ({
    etiqueta,
    valor: noConformidades.filter((nc) => nc.severidad === valor).length,
    color: COLOR_SEVERIDAD[valor] ?? "hsl(var(--primario))",
  }));

  // Las que no tienen area entran como una fila mas. Sin eso, con una
  // sola clasificada el grafico decia «100%» al lado de un total de
  // siete, que es exactamente lo contrario de lo que pasa: el porcentaje
  // tiene que ser sobre lo que se esta mirando.
  const porArea = [
    ...AREAS_VIGENTES.map((area) => ({
      etiqueta: AREAS_ORGANIZACIONALES[area],
      valor: noConformidades.filter((nc) => nc.area === area).length,
    })),
    {
      etiqueta: "Sin área asignada",
      valor: noConformidades.filter((nc) => !nc.area).length,
    },
  ];

  const porOrigen = ORIGENES_NC_VIGENTES.map((origen) => ({
    etiqueta: ETIQUETAS_ORIGEN_NC[origen],
    valor: noConformidades.filter((nc) => nc.origen === origen).length,
  }));

  const vencidas = noConformidades.filter(
    (nc) =>
      ESTADOS_NC_ABIERTOS.includes(nc.estado) &&
      nc.fecha_limite_cierre !== null &&
      nc.fecha_limite_cierre < hoy,
  ).length;

  return (
    <>
      <EncabezadoPagina
        titulo="No conformidades y acciones correctivas"
        descripcion="Registro de desviaciones, análisis de causa raíz y plan de acción con seguimiento de vencimientos."
        acciones={
          !soloLectura ? (
            <Boton comoHijo>
              <Link href="/no-conformidades/nueva">
                <Plus /> Nueva No Conformidad
              </Link>
            </Boton>
          ) : null
        }
      />

      <FiltrosListado
        campos={[
          {
            nombre: "estado",
            etiqueta: "Estado",
            // Los cuatro que muestra la ficha, ni mas ni menos: que el
            // filtro ofrezca otros nombres obliga a traducir mentalmente
            // entre dos pantallas del mismo modulo.
            opciones: PASOS_NO_CONFORMIDAD.map((paso) => ({
              valor: paso,
              etiqueta: ETIQUETAS_PASO_NC[paso],
            })),
          },
          {
            nombre: "area",
            etiqueta: "Área",
            opciones: AREAS_VIGENTES.map((valor) => ({
              valor,
              etiqueta: AREAS_ORGANIZACIONALES[valor],
            })),
          },
          {
            nombre: "severidad",
            etiqueta: "Severidad",
            opciones: Object.entries(ETIQUETAS_SEVERIDAD_NC).map(([valor, etiqueta]) => ({
              valor,
              etiqueta,
            })),
          },
          {
            nombre: "origen",
            etiqueta: "Origen",
            opciones: ORIGENES_NC_VIGENTES.map((valor) => ({
              valor,
              etiqueta: ETIQUETAS_ORIGEN_NC[valor],
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

      {noConformidades.length > 0 ? (
        <div className="mb-4 grid gap-3 lg:grid-cols-2">
          <Torta titulo="Por estado" porciones={porPaso} />
          <Torta titulo="Por severidad" porciones={porSeveridad} />
          {/* Area y origen van en barras y no en torta: trece areas en un
              circulo son trece porciones que nadie puede comparar, y el
              largo de una barra el ojo lo mide bien. */}
          <BarrasPorcentaje
            titulo="Por área"
            filas={porArea}
            vacio="Ninguna tiene área asignada."
          />
          <BarrasPorcentaje titulo="Por origen" filas={porOrigen} />
        </div>
      ) : null}

      {noConformidades.length === 0 ? (
        <EstadoVacio
          icono={<TriangleAlert className="size-6" />}
          titulo="No hay no conformidades que coincidan"
          descripcion="Ajuste los filtros o registre una desviación nueva."
        />
      ) : (
        <Tarjeta>
          <Tabla>
            <TablaCabecera>
              <TablaFila>
                <TablaEncabezado className="w-[8rem]">Código</TablaEncabezado>
                <TablaEncabezado>Título</TablaEncabezado>
                <TablaEncabezado className="hidden lg:table-cell">Área</TablaEncabezado>
                <TablaEncabezado className="hidden xl:table-cell">Origen</TablaEncabezado>
                <TablaEncabezado className="w-[6rem]">Severidad</TablaEncabezado>
                <TablaEncabezado className="w-[8rem]">Estado</TablaEncabezado>
                <TablaEncabezado className="hidden md:table-cell">
                  Responsable de la AC
                </TablaEncabezado>
                <TablaEncabezado className="w-[8rem] hidden lg:table-cell">
                  Acción correctiva
                </TablaEncabezado>
                <TablaEncabezado className="w-[9rem]">Límite</TablaEncabezado>
              </TablaFila>
            </TablaCabecera>
            <TablaCuerpo>
              {noConformidades.map((nc) => {
                const dias = diasHasta(nc.fecha_limite_cierre);
                const vencida =
                  ESTADOS_NC_ABIERTOS.includes(nc.estado) && dias !== null && dias < 0;

                return (
                  <TablaFila key={nc.id}>
                    <TablaCelda className="font-medium tabular">
                      <Link
                        href={`/no-conformidades/${nc.id}`}
                        className="hover:text-primario"
                      >
                        {nc.codigo}
                      </Link>
                    </TablaCelda>
                    <TablaCelda>
                      <Link
                        href={`/no-conformidades/${nc.id}`}
                        className="flex items-center gap-2 hover:text-primario"
                      >
                        <span>{recortar(nc.titulo, 70)}</span>
                        {nc.es_demostracion ? <InsigniaDemostracion /> : null}
                      </Link>
                    </TablaCelda>
                    <TablaCelda className="hidden text-xs text-atenuado-contraste lg:table-cell">
                      {nc.area ? AREAS_ORGANIZACIONALES[nc.area] : "—"}
                    </TablaCelda>
                    <TablaCelda className="hidden text-xs text-atenuado-contraste xl:table-cell">
                      {ETIQUETAS_ORIGEN_NC[nc.origen]}
                    </TablaCelda>
                    <TablaCelda>
                      <InsigniaSeveridad severidad={nc.severidad} />
                    </TablaCelda>
                    <TablaCelda>
                      <InsigniaEstadoNC estado={nc.estado} cierreEnPlazo={nc.cierre_en_plazo} />
                    </TablaCelda>
                    <TablaCelda className="hidden text-xs text-atenuado-contraste md:table-cell">
                      {nc.responsable?.nombre_completo ?? "Sin asignar"}
                    </TablaCelda>
                    {/* Si tiene plan cargado y cuánto. Una desviación
                        abierta y sin ninguna acción es la que hay que
                        mirar primero: es la que todavía nadie tomó. */}
                    <TablaCelda className="hidden text-xs lg:table-cell">
                      {(nc.nc_acciones ?? []).length > 0 ? (
                        <Link
                          href={`/no-conformidades/${nc.id}`}
                          className="text-atenuado-contraste hover:text-primario"
                        >
                          {(nc.nc_acciones ?? []).length}{" "}
                          {(nc.nc_acciones ?? []).length === 1 ? "cargada" : "cargadas"}
                        </Link>
                      ) : soloLectura ? (
                        <span className="text-semaforo-alto">Sin plan</span>
                      ) : (
                        <Link
                          href={`/acciones/nueva?nc=${nc.id}`}
                          className="text-semaforo-alto hover:underline"
                        >
                          Cargar acción
                        </Link>
                      )}
                    </TablaCelda>
                    <TablaCelda className="text-xs">
                      {nc.fecha_limite_cierre ? (
                        <span className={vencida ? "font-medium text-semaforo-critico" : ""}>
                          {formatearFecha(nc.fecha_limite_cierre)}
                          <span className="block text-[10px] opacity-80">
                            {describirVencimiento(nc.fecha_limite_cierre)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-atenuado-contraste">—</span>
                      )}
                    </TablaCelda>
                  </TablaFila>
                );
              })}
            </TablaCuerpo>
          </Tabla>
        </Tarjeta>
      )}

      <p className="mt-3 text-[11px] text-atenuado-contraste">
        {noConformidades.length} registro{noConformidades.length === 1 ? "" : "s"}
        {vencidas > 0 ? ` · ${vencidas} fuera de plazo` : ""}.
      </p>
    </>
  );
}
