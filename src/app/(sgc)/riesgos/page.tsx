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
import { ETIQUETAS_ESTADO_RIESGO, ETIQUETAS_TRATAMIENTO_RIESGO } from "@/lib/constantes";
import { describirVencimiento, diasHasta, formatearFecha } from "@/lib/formato";
import { recortar } from "@/lib/utilidades";
import type { EstadoRiesgo, TipoRiesgo, TratamientoRiesgo } from "@/lib/tipos";

export const metadata: Metadata = { title: "Riesgos" };
export const dynamic = "force-dynamic";

interface FilaRiesgo {
  id: string;
  codigo: string;
  titulo: string;
  tipo: TipoRiesgo;
  categoria: string | null;
  estado: EstadoRiesgo;
  tratamiento: TratamientoRiesgo | null;
  origen: string | null;
  probabilidad: number | null;
  severidad: number | null;
  nivel: number | null;
  requiere_accion: boolean;
  accion_planificada: string | null;
  plazo_accion: string | null;
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
      "id, codigo, titulo, tipo, categoria, estado, tratamiento, origen, " +
        "probabilidad, severidad, nivel, requiere_accion, accion_planificada, plazo_accion, " +
        "nivel_residual, fecha_proxima_revision, es_demostracion, " +
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
  // Los cortes son los del instructivo: 4 ya exige accion planificada, 9
  // es alto y 15 critico. Antes «altos» empezaba en 10.
  if (searchParams.nivel === "requieren") consulta = consulta.gte("nivel", 4);
  if (searchParams.nivel === "altos") consulta = consulta.gte("nivel", 9);
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
        titulo="Matriz de riesgos"
        descripcion="F-EST-01-03. Nivel = Probabilidad × Severidad, con el semáforo del instructivo: 1-3 bajo, 4-8 medio, 9-14 alto, 15-25 crítico. De 4 para arriba hace falta acción planificada."
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
              { valor: "requieren", etiqueta: "Requieren acción (4 o más)" },
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

      {riesgos.length === 0 ? (
        <EstadoVacio
          icono={<ShieldAlert className="size-6" />}
          titulo="No hay riesgos que coincidan"
          descripcion="Ajuste los filtros o registre el primer riesgo de la matriz. Las oportunidades están en su propia pantalla."
        />
      ) : (
        <Tarjeta>
          <Tabla>
            <TablaCabecera>
              <TablaFila>
                <TablaEncabezado className="w-[7.5rem]">Código</TablaEncabezado>
                <TablaEncabezado>Título</TablaEncabezado>
                <TablaEncabezado className="hidden lg:table-cell">Proceso</TablaEncabezado>
                <TablaEncabezado className="hidden xl:table-cell">Origen</TablaEncabezado>
                <TablaEncabezado className="w-[4.5rem] text-center">P × S</TablaEncabezado>
                <TablaEncabezado className="w-[8rem]">Nivel</TablaEncabezado>
                <TablaEncabezado className="hidden xl:table-cell">Residual</TablaEncabezado>
                <TablaEncabezado className="hidden md:table-cell">Tratamiento</TablaEncabezado>
                <TablaEncabezado className="w-[9rem]">Acción</TablaEncabezado>
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
                        {riesgo.es_demostracion ? <InsigniaDemostracion /> : null}
                      </Link>
                    </TablaCelda>
                    <TablaCelda className="hidden text-xs text-atenuado-contraste lg:table-cell">
                      {riesgo.procesos?.nombre ?? "—"}
                    </TablaCelda>
                    <TablaCelda className="hidden text-xs text-atenuado-contraste xl:table-cell">
                      {riesgo.origen ?? "—"}
                    </TablaCelda>
                    <TablaCelda className="text-center text-xs tabular">
                      {riesgo.probabilidad !== null && riesgo.severidad !== null ? (
                        `${riesgo.probabilidad} × ${riesgo.severidad}`
                      ) : (
                        <span className="text-semaforo-alto">Sin valorar</span>
                      )}
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
                      {riesgo.tratamiento ? ETIQUETAS_TRATAMIENTO_RIESGO[riesgo.tratamiento] : "—"}
                    </TablaCelda>
                    {/* Un riesgo que exige plan y no lo tiene es lo
                        primero que mira una auditoría: el instructivo
                        dice que de nivel 4 para arriba hace falta acción
                        con responsable y plazo. */}
                    <TablaCelda className="text-xs">
                      {riesgo.accion_planificada ? (
                        <span className="text-atenuado-contraste">
                          {riesgo.plazo_accion ? formatearFecha(riesgo.plazo_accion) : "Sin plazo"}
                        </span>
                      ) : riesgo.requiere_accion ? (
                        <span className="font-medium text-semaforo-critico">Falta el plan</span>
                      ) : (
                        <span className="text-atenuado-contraste">Se asume</span>
                      )}
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
