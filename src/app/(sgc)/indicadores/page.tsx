import type { Metadata } from "next";
import { TrendingUp } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { ModuloEnConstruccion } from "@/components/comunes/modulo-en-construccion";
import { Aviso, AvisoDescripcion, AvisoTitulo } from "@/components/ui/aviso";
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
import { requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { entradaPorRuta } from "@/lib/navegacion";
import { ETIQUETAS_FRECUENCIA, ETIQUETAS_SENTIDO } from "@/lib/constantes";
import { formatearMes, formatearNumero } from "@/lib/formato";
import type { FrecuenciaMedicion, SentidoIndicador } from "@/lib/tipos";

export const metadata: Metadata = { title: "Indicadores y objetivos" };
export const dynamic = "force-dynamic";

export default async function PaginaIndicadores() {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  const [{ data: indicadores }, { data: mediciones }] = await Promise.all([
    supabase
      .from("indicadores")
      .select(
        "id, codigo, nombre, unidad, frecuencia, sentido, meta, " +
          "procesos:proceso_id (nombre), responsable:responsable_id (nombre_completo)",
      )
      .eq("activo", true)
      .order("codigo"),
    supabase
      .from("vista_indicadores_looker")
      .select("*")
      .order("periodo", { ascending: false })
      .limit(200),
  ]);

  const lista = (indicadores ?? []) as any[];
  const filasMedicion = (mediciones ?? []) as any[];

  // Última medición cargada de cada indicador.
  const ultimaPorIndicador = new Map<string, any>();
  for (const fila of filasMedicion) {
    if (!ultimaPorIndicador.has(fila.indicador_codigo)) {
      ultimaPorIndicador.set(fila.indicador_codigo, fila);
    }
  }

  const fueraDeMeta = filasMedicion.filter((fila) => fila.cumple_meta === false).length;

  return (
    <>
      <EncabezadoPagina
        titulo="Indicadores y objetivos"
        descripcion="Medición de desempeño por proceso, con meta contra real y tendencia."
      />

      <ModuloEnConstruccion nota={entradaPorRuta("/indicadores")?.notaFase} />

      <Aviso className="mb-4">
        <div>
          <AvisoTitulo>Consumo desde Looker Studio</AvisoTitulo>
          <AvisoDescripcion>
            Las mediciones ya se exponen en la vista <code>vista_indicadores_looker</code>, que
            entrega el valor real, la meta del período y si se cumplió. Looker Studio se conecta
            directamente a esa vista por PostgreSQL, sin duplicar la lógica del semáforo fuera del
            sistema de gestión. Los pasos están en <code>docs/despliegue.md</code>.
          </AvisoDescripcion>
        </div>
      </Aviso>

      {lista.length === 0 ? (
        <EstadoVacio
          icono={<TrendingUp className="size-6" />}
          titulo="Sin indicadores definidos"
          descripcion="Los indicadores por proceso se cargan cuando el módulo entre en operación."
        />
      ) : (
        <Tarjeta>
          <Tabla>
            <TablaCabecera>
              <TablaFila>
                <TablaEncabezado className="w-[7rem]">Código</TablaEncabezado>
                <TablaEncabezado>Indicador</TablaEncabezado>
                <TablaEncabezado className="hidden lg:table-cell">Proceso</TablaEncabezado>
                <TablaEncabezado className="hidden xl:table-cell">Frecuencia</TablaEncabezado>
                <TablaEncabezado className="w-[6rem] text-right">Meta</TablaEncabezado>
                <TablaEncabezado className="w-[7rem] text-right">Último real</TablaEncabezado>
                <TablaEncabezado className="w-[8rem]">Período</TablaEncabezado>
                <TablaEncabezado className="w-[7rem]">Cumple</TablaEncabezado>
              </TablaFila>
            </TablaCabecera>
            <TablaCuerpo>
              {lista.map((indicador) => {
                const ultima = ultimaPorIndicador.get(indicador.codigo);

                return (
                  <TablaFila key={indicador.id}>
                    <TablaCelda className="font-medium tabular">{indicador.codigo}</TablaCelda>
                    <TablaCelda>
                      <p className="text-xs font-medium">{indicador.nombre}</p>
                      <p className="text-[11px] text-atenuado-contraste">
                        {ETIQUETAS_SENTIDO[indicador.sentido as SentidoIndicador]}
                      </p>
                    </TablaCelda>
                    <TablaCelda className="hidden text-xs text-atenuado-contraste lg:table-cell">
                      {indicador.procesos?.nombre ?? "—"}
                    </TablaCelda>
                    <TablaCelda className="hidden text-xs text-atenuado-contraste xl:table-cell">
                      {ETIQUETAS_FRECUENCIA[indicador.frecuencia as FrecuenciaMedicion]}
                    </TablaCelda>
                    <TablaCelda className="text-right text-xs tabular">
                      {formatearNumero(indicador.meta)} {indicador.unidad}
                    </TablaCelda>
                    <TablaCelda className="text-right text-xs font-medium tabular">
                      {ultima ? `${formatearNumero(ultima.valor_real)} ${indicador.unidad}` : "—"}
                    </TablaCelda>
                    <TablaCelda className="text-xs text-atenuado-contraste">
                      {ultima ? formatearMes(ultima.periodo) : "Sin mediciones"}
                    </TablaCelda>
                    <TablaCelda>
                      {ultima?.cumple_meta === true ? (
                        <Insignia variante="exito">En meta</Insignia>
                      ) : ultima?.cumple_meta === false ? (
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

      <p className="mt-3 text-[11px] text-atenuado-contraste">
        {lista.length} indicadores activos · {filasMedicion.length} mediciones cargadas ·{" "}
        {fueraDeMeta} fuera de meta.
      </p>
    </>
  );
}
