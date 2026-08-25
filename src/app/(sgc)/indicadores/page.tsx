import type { Metadata } from "next";
import Link from "next/link";
import { Plus, TrendingUp } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltrosListado } from "@/components/comunes/filtros-listado";
import { TarjetaIndicador } from "@/components/comunes/tarjeta-indicador";
import { PanelObjetivos } from "@/app/(sgc)/indicadores/panel-objetivos";
import { Aviso, AvisoDescripcion, AvisoTitulo } from "@/components/ui/aviso";
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
import { ETIQUETAS_FRECUENCIA, ETIQUETAS_SENTIDO } from "@/lib/constantes";
import { formatearMes, formatearNumero, hoyEnAsuncion } from "@/lib/formato";
import type { FrecuenciaMedicion, SentidoIndicador } from "@/lib/tipos";

export const metadata: Metadata = { title: "Indicadores y objetivos" };
export const dynamic = "force-dynamic";

export default async function PaginaIndicadores({
  searchParams,
}: {
  searchParams: { q?: string; proceso?: string; cumplimiento?: string };
}) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();
  const anio = Number(hoyEnAsuncion().slice(0, 4));

  let consulta = supabase
    .from("indicadores")
    .select(
      "id, codigo, nombre, unidad, frecuencia, sentido, meta, meta_minima, meta_maxima, activo, " +
        "procesos:proceso_id (nombre), responsable:responsable_id (nombre_completo)",
    )
    .eq("activo", true)
    .order("codigo");

  if (searchParams.proceso) consulta = consulta.eq("proceso_id", searchParams.proceso);
  if (searchParams.q) {
    const texto = `%${searchParams.q}%`;
    consulta = consulta.or(`codigo.ilike.${texto},nombre.ilike.${texto}`);
  }

  const [{ data: indicadoresDatos }, { data: mediciones }, { data: objetivos }, { data: procesos }] =
    await Promise.all([
      consulta,
      supabase
        .from("vista_indicadores_looker")
        .select("indicador_codigo, periodo, valor_real, meta, cumple_meta, unidad")
        .order("periodo", { ascending: false })
        .limit(400),
      supabase
        .from("objetivos")
        .select("*, procesos:proceso_id (nombre), responsable:responsable_id (nombre_completo)")
        .eq("anio", anio)
        .order("codigo"),
      supabase.from("procesos").select("id, nombre").eq("activo", true).order("nombre"),
    ]);

  const indicadores = (indicadoresDatos as any[] | null) ?? [];
  const filas = (mediciones as any[] | null) ?? [];

  // Última medición de cada indicador.
  const ultima = new Map<string, any>();
  for (const fila of filas) {
    if (!ultima.has(fila.indicador_codigo)) ultima.set(fila.indicador_codigo, fila);
  }

  const visibles = indicadores.filter((indicador) => {
    if (!searchParams.cumplimiento) return true;
    const dato = ultima.get(indicador.codigo);
    if (searchParams.cumplimiento === "fuera") return dato?.cumple_meta === false;
    if (searchParams.cumplimiento === "en_meta") return dato?.cumple_meta === true;
    return dato === undefined;
  });

  const delAnio = filas.filter((fila) => String(fila.periodo).startsWith(String(anio)));
  const fueraDeMeta = delAnio.filter((fila) => fila.cumple_meta === false).length;
  const enMeta = delAnio.filter((fila) => fila.cumple_meta === true).length;
  const sinMedir = indicadores.filter((indicador) => !ultima.has(indicador.codigo)).length;

  const gestiona = puedeGestionar(usuario);

  return (
    <>
      <EncabezadoPagina
        titulo="Indicadores y objetivos"
        descripcion="Medición de desempeño por proceso, con meta contra real y tendencia. Las mediciones se exponen a Looker Studio sin duplicar la lógica del semáforo."
        acciones={
          gestiona ? (
            <Boton comoHijo>
              <Link href="/indicadores/nuevo">
                <Plus /> Nuevo indicador
              </Link>
            </Boton>
          ) : null
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaIndicador titulo="Indicadores activos" valor={indicadores.length} />
        <TarjetaIndicador
          titulo={`En meta · ${anio}`}
          valor={enMeta}
          contexto={`De ${delAnio.length} mediciones`}
          tono="exito"
        />
        <TarjetaIndicador
          titulo={`Fuera de meta · ${anio}`}
          valor={fueraDeMeta}
          contexto={`De ${delAnio.length} mediciones`}
          tono={fueraDeMeta > 0 ? "atencion" : "exito"}
          enlace="/indicadores?cumplimiento=fuera"
        />
        <TarjetaIndicador
          titulo="Sin medir"
          valor={sinMedir}
          contexto="Indicadores sin ninguna carga"
          tono={sinMedir > 0 ? "advertencia" : "exito"}
        />
      </div>

      <FiltrosListado
        marcadorBusqueda="Buscar por código o nombre…"
        campos={[
          {
            nombre: "cumplimiento",
            etiqueta: "Cumplimiento",
            opciones: [
              { valor: "en_meta", etiqueta: "En meta" },
              { valor: "fuera", etiqueta: "Fuera de meta" },
              { valor: "sin_medir", etiqueta: "Sin medir" },
            ],
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

      {visibles.length === 0 ? (
        <EstadoVacio
          icono={<TrendingUp className="size-6" />}
          titulo="No hay indicadores que coincidan"
          descripcion="Ajuste los filtros o defina el primer indicador de desempeño."
        />
      ) : (
        <Tarjeta>
          <Tabla>
            <TablaCabecera>
              <TablaFila>
                <TablaEncabezado className="w-[6.5rem]">Código</TablaEncabezado>
                <TablaEncabezado>Indicador</TablaEncabezado>
                <TablaEncabezado className="hidden lg:table-cell">Proceso</TablaEncabezado>
                <TablaEncabezado className="hidden xl:table-cell">Frecuencia</TablaEncabezado>
                <TablaEncabezado className="w-[6.5rem] text-right">Meta</TablaEncabezado>
                <TablaEncabezado className="w-[7rem] text-right">Último real</TablaEncabezado>
                <TablaEncabezado className="w-[8rem]">Período</TablaEncabezado>
                <TablaEncabezado className="w-[7.5rem]">Cumple</TablaEncabezado>
              </TablaFila>
            </TablaCabecera>
            <TablaCuerpo>
              {visibles.map((indicador) => {
                const dato = ultima.get(indicador.codigo);
                const metaTexto =
                  indicador.sentido === "rango"
                    ? `${formatearNumero(indicador.meta_minima, 0)} a ${formatearNumero(indicador.meta_maxima, 0)}`
                    : formatearNumero(indicador.meta, 0);

                return (
                  <TablaFila key={indicador.id}>
                    <TablaCelda className="font-medium tabular">
                      <Link href={`/indicadores/${indicador.id}`} className="hover:text-primario">
                        {indicador.codigo}
                      </Link>
                    </TablaCelda>
                    <TablaCelda>
                      <Link href={`/indicadores/${indicador.id}`} className="hover:text-primario">
                        <p className="text-xs font-medium">{indicador.nombre}</p>
                        <p className="text-[11px] text-atenuado-contraste">
                          {ETIQUETAS_SENTIDO[indicador.sentido as SentidoIndicador]}
                        </p>
                      </Link>
                    </TablaCelda>
                    <TablaCelda className="hidden text-xs text-atenuado-contraste lg:table-cell">
                      {indicador.procesos?.nombre ?? "—"}
                    </TablaCelda>
                    <TablaCelda className="hidden text-xs text-atenuado-contraste xl:table-cell">
                      {ETIQUETAS_FRECUENCIA[indicador.frecuencia as FrecuenciaMedicion]}
                    </TablaCelda>
                    <TablaCelda className="text-right text-xs tabular">
                      {metaTexto} {indicador.unidad}
                    </TablaCelda>
                    <TablaCelda className="text-right text-xs font-medium tabular">
                      {dato ? `${formatearNumero(dato.valor_real)} ${indicador.unidad}` : "—"}
                    </TablaCelda>
                    <TablaCelda className="text-xs text-atenuado-contraste">
                      {dato ? formatearMes(dato.periodo) : "Sin mediciones"}
                    </TablaCelda>
                    <TablaCelda>
                      {dato?.cumple_meta === true ? (
                        <Insignia variante="exito">En meta</Insignia>
                      ) : dato?.cumple_meta === false ? (
                        <Insignia variante="peligro">Fuera de meta</Insignia>
                      ) : (
                        <span className="text-xs text-atenuado-contraste">—</span>
                      )}
                    </TablaCelda>
                  </TablaFila>
                );
              })}
            </TablaCuerpo>
          </Tabla>
        </Tarjeta>
      )}

      <h2 className="mb-3 mt-6 text-sm font-semibold">Objetivos de calidad {anio}</h2>
      <PanelObjetivos
        objetivos={(objetivos as any[] | null) ?? []}
        procesos={(procesos as { id: string; nombre: string }[] | null) ?? []}
        anio={anio}
        puedeEditar={gestiona}
      />

      <Aviso className="mt-5">
        <div>
          <AvisoTitulo>Consumo desde Looker Studio</AvisoTitulo>
          <AvisoDescripcion>
            La vista <code>vista_indicadores_looker</code> entrega el valor real, la meta del
            período y si se cumplió, ya calculado. Looker se conecta a esa vista por PostgreSQL con
            un usuario de solo lectura; los pasos están en <code>docs/despliegue.md</code>.
          </AvisoDescripcion>
        </div>
      </Aviso>
    </>
  );
}
