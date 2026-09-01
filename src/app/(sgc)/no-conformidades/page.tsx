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
  ESTADOS_NC_ABIERTOS,
  ESTADOS_NC_VIGENTES,
  ETIQUETAS_ESTADO_NC,
  ETIQUETAS_ORIGEN_NC,
  ETIQUETAS_SEVERIDAD_NC,
  ORIGENES_NC_VIGENTES,
} from "@/lib/constantes";
import { describirVencimiento, diasHasta, formatearFecha, hoyEnAsuncion } from "@/lib/formato";
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
  area: AreaOrganizacional | null;
  fecha_deteccion: string;
  fecha_limite_cierre: string | null;
  es_demostracion: boolean;
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
  const supabase = crearClienteServidor();

  const { data: procesos } = await supabase
    .from("procesos")
    .select("id, nombre")
    .eq("activo", true)
    .order("nombre");

  let consulta = supabase
    .from("no_conformidades")
    .select(
      "id, codigo, titulo, origen, severidad, estado, area, fecha_deteccion, " +
        "fecha_limite_cierre, es_demostracion, procesos:proceso_id (nombre), " +
        "responsable:responsable_id (nombre_completo)",
    )
    // Por correlativo ascendente: NC-2026-001, 002, 003. Ordenar por fecha
    // dejaba el listado desordenado a la vista, porque el correlativo y la
    // fecha de deteccion no siempre van juntos.
    .order("codigo", { ascending: true });

  if (searchParams.estado === "abiertas") {
    consulta = consulta.in("estado", ESTADOS_NC_ABIERTOS);
  } else if (searchParams.estado) {
    consulta = consulta.eq("estado", searchParams.estado);
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
          !esSoloLectura(usuario) ? (
            <Boton comoHijo>
              <Link href="/no-conformidades/nueva">
                <Plus /> Registrar desviación
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
            opciones: [
              { valor: "abiertas", etiqueta: "Todas las abiertas" },
              ...ESTADOS_NC_VIGENTES.map((valor) => ({
                valor,
                etiqueta: ETIQUETAS_ESTADO_NC[valor],
              })),
            ],
          },
          {
            nombre: "area",
            etiqueta: "Área",
            opciones: Object.entries(AREAS_ORGANIZACIONALES).map(([valor, etiqueta]) => ({
              valor,
              etiqueta,
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
                      <InsigniaEstadoNC estado={nc.estado} />
                    </TablaCelda>
                    <TablaCelda className="hidden text-xs text-atenuado-contraste md:table-cell">
                      {nc.responsable?.nombre_completo ?? "Sin asignar"}
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
