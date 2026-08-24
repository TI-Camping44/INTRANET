import type { Metadata } from "next";
import Link from "next/link";
import { Grid3x3, Plus, ShieldAlert } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltrosListado } from "@/components/comunes/filtros-listado";
import {
  InsigniaDemostracion,
  InsigniaEstadoRiesgo,
  InsigniaNivelRiesgo,
} from "@/components/comunes/insignias-estado";
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
import {
  ETIQUETAS_ESTADO_RIESGO,
  ETIQUETAS_TIPO_RIESGO,
  ETIQUETAS_TRATAMIENTO_RIESGO,
} from "@/lib/constantes";
import { describirVencimiento, diasHasta, formatearFecha } from "@/lib/formato";
import { recortar } from "@/lib/utilidades";
import type { EstadoRiesgo, TipoRiesgo, TratamientoRiesgo } from "@/lib/tipos";

export const metadata: Metadata = { title: "Riesgos y oportunidades" };
export const dynamic = "force-dynamic";

interface FilaRiesgo {
  id: string;
  codigo: string;
  titulo: string;
  tipo: TipoRiesgo;
  categoria: string | null;
  estado: EstadoRiesgo;
  tratamiento: TratamientoRiesgo;
  probabilidad: number;
  impacto: number;
  nivel: number;
  nivel_residual: number | null;
  fecha_proxima_revision: string | null;
  es_demostracion: boolean;
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
    .eq("activo", true)
    .order("nombre");

  let consulta = supabase
    .from("riesgos")
    .select(
      "id, codigo, titulo, tipo, categoria, estado, tratamiento, probabilidad, impacto, nivel, " +
        "nivel_residual, fecha_proxima_revision, es_demostracion, " +
        "procesos:proceso_id (nombre), responsable:responsable_id (nombre_completo)",
    )
    .order("nivel", { ascending: false });

  if (searchParams.estado) consulta = consulta.eq("estado", searchParams.estado);
  if (searchParams.tipo) consulta = consulta.eq("tipo", searchParams.tipo);
  if (searchParams.proceso) consulta = consulta.eq("proceso_id", searchParams.proceso);
  if (searchParams.nivel === "altos") consulta = consulta.gte("nivel", 10);
  if (searchParams.nivel === "criticos") consulta = consulta.gte("nivel", 15);
  if (searchParams.q) {
    const texto = `%${searchParams.q}%`;
    consulta = consulta.or(`codigo.ilike.${texto},titulo.ilike.${texto}`);
  }

  const { data } = await consulta;
  const riesgos = (data as FilaRiesgo[] | null) ?? [];

  return (
    <>
      <EncabezadoPagina
        titulo="Gestión de riesgos y oportunidades"
        descripcion="Matriz 5×5 con cálculo automático del nivel (Probabilidad × Impacto) y reevaluación periódica según el semáforo."
        acciones={
          <>
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
              { valor: "altos", etiqueta: "Altos y críticos (10 o más)" },
              { valor: "criticos", etiqueta: "Solo críticos (15 o más)" },
            ],
          },
          {
            nombre: "tipo",
            etiqueta: "Tipo",
            opciones: Object.entries(ETIQUETAS_TIPO_RIESGO).map(([valor, etiqueta]) => ({
              valor,
              etiqueta,
            })),
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

      {riesgos.length === 0 ? (
        <EstadoVacio
          icono={<ShieldAlert className="size-6" />}
          titulo="No hay riesgos que coincidan"
          descripcion="Ajuste los filtros o registre el primer riesgo de la matriz."
        />
      ) : (
        <Tarjeta>
          <Tabla>
            <TablaCabecera>
              <TablaFila>
                <TablaEncabezado className="w-[7.5rem]">Código</TablaEncabezado>
                <TablaEncabezado>Título</TablaEncabezado>
                <TablaEncabezado className="hidden lg:table-cell">Proceso</TablaEncabezado>
                <TablaEncabezado className="w-[4.5rem] text-center">P × I</TablaEncabezado>
                <TablaEncabezado className="w-[8rem]">Nivel</TablaEncabezado>
                <TablaEncabezado className="hidden xl:table-cell">Residual</TablaEncabezado>
                <TablaEncabezado className="hidden md:table-cell">Tratamiento</TablaEncabezado>
                <TablaEncabezado className="w-[8rem]">Estado</TablaEncabezado>
                <TablaEncabezado className="hidden xl:table-cell">Reevaluación</TablaEncabezado>
              </TablaFila>
            </TablaCabecera>
            <TablaCuerpo>
              {riesgos.map((riesgo) => {
                const dias = diasHasta(riesgo.fecha_proxima_revision);
                const vencida = dias !== null && dias <= 0;

                return (
                  <TablaFila key={riesgo.id}>
                    <TablaCelda className="font-medium tabular">
                      <Link href={`/riesgos/${riesgo.id}`} className="hover:text-primario">
                        {riesgo.codigo}
                      </Link>
                    </TablaCelda>
                    <TablaCelda>
                      <Link
                        href={`/riesgos/${riesgo.id}`}
                        className="flex flex-wrap items-center gap-2 hover:text-primario"
                      >
                        <span>{recortar(riesgo.titulo, 65)}</span>
                        {riesgo.tipo === "oportunidad" ? (
                          <Insignia variante="primaria">Oportunidad</Insignia>
                        ) : null}
                        {riesgo.es_demostracion ? <InsigniaDemostracion /> : null}
                      </Link>
                    </TablaCelda>
                    <TablaCelda className="hidden text-xs text-atenuado-contraste lg:table-cell">
                      {riesgo.procesos?.nombre ?? "—"}
                    </TablaCelda>
                    <TablaCelda className="text-center text-xs tabular">
                      {riesgo.probabilidad} × {riesgo.impacto}
                    </TablaCelda>
                    <TablaCelda>
                      <InsigniaNivelRiesgo nivel={riesgo.nivel} />
                    </TablaCelda>
                    <TablaCelda className="hidden xl:table-cell">
                      {riesgo.nivel_residual !== null ? (
                        <InsigniaNivelRiesgo nivel={riesgo.nivel_residual} />
                      ) : (
                        <span className="text-xs text-atenuado-contraste">Sin evaluar</span>
                      )}
                    </TablaCelda>
                    <TablaCelda className="hidden text-xs text-atenuado-contraste md:table-cell">
                      {ETIQUETAS_TRATAMIENTO_RIESGO[riesgo.tratamiento]}
                    </TablaCelda>
                    <TablaCelda>
                      <InsigniaEstadoRiesgo estado={riesgo.estado} />
                    </TablaCelda>
                    <TablaCelda className="hidden text-xs xl:table-cell">
                      {riesgo.fecha_proxima_revision ? (
                        <span className={vencida ? "font-medium text-semaforo-alto" : ""}>
                          {formatearFecha(riesgo.fecha_proxima_revision)}
                          <span className="block text-[10px] opacity-80">
                            {describirVencimiento(riesgo.fecha_proxima_revision)}
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
        {riesgos.length} registro{riesgos.length === 1 ? "" : "s"} en el listado.
      </p>
    </>
  );
}
