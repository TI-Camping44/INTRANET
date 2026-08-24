import type { Metadata } from "next";
import { Smile } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { ModuloEnConstruccion } from "@/components/comunes/modulo-en-construccion";
import { TarjetaIndicador } from "@/components/comunes/tarjeta-indicador";
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
import { formatearFecha } from "@/lib/formato";
import { recortar } from "@/lib/utilidades";

export const metadata: Metadata = { title: "Satisfacción del cliente" };
export const dynamic = "force-dynamic";

export default async function PaginaSatisfaccion() {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  const [{ data: encuestas }, { data: respuestas }] = await Promise.all([
    supabase.from("encuestas").select("*").order("fecha_inicio", { ascending: false }),
    supabase
      .from("encuesta_respuestas")
      .select("*, clientes:cliente_id (razon_social)")
      .order("fecha", { ascending: false })
      .limit(50),
  ]);

  const filas = (respuestas ?? []) as any[];
  const promotores = filas.filter((fila) => fila.categoria_nps === "promotor").length;
  const detractores = filas.filter((fila) => fila.categoria_nps === "detractor").length;
  const pasivos = filas.length - promotores - detractores;

  // NPS = % promotores − % detractores.
  const nps =
    filas.length > 0
      ? Math.round(((promotores - detractores) / filas.length) * 100)
      : null;

  return (
    <>
      <EncabezadoPagina
        titulo="Satisfacción del cliente"
        descripcion="Encuestas y NPS de Camping 44."
      />

      <ModuloEnConstruccion nota={entradaPorRuta("/satisfaccion")?.notaFase} />

      <Aviso className="mb-4">
        <div>
          <AvisoTitulo>El panel de NPS actual sigue siendo la fuente</AvisoTitulo>
          <AvisoDescripcion>
            Camping 44 ya opera un panel de NPS propio sobre Apps Script y GitHub Pages. Este
            módulo no lo reemplaza: el esquema incorpora los campos <code>fuente_externa</code> y{" "}
            <code>referencia_externa</code> para ingerir esas respuestas más adelante sin
            duplicarlas. Lo que se muestra aquí son datos de demostración.
          </AvisoDescripcion>
        </div>
      </Aviso>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaIndicador
          titulo="NPS"
          valor={nps === null ? "—" : nps}
          contexto={`Sobre ${filas.length} respuestas`}
          tono={nps === null ? "neutro" : nps >= 50 ? "exito" : nps >= 0 ? "advertencia" : "peligro"}
        />
        <TarjetaIndicador titulo="Promotores" valor={promotores} tono="exito" />
        <TarjetaIndicador titulo="Pasivos" valor={pasivos} tono="advertencia" />
        <TarjetaIndicador titulo="Detractores" valor={detractores} tono="peligro" />
      </div>

      {(encuestas ?? []).length === 0 ? (
        <EstadoVacio
          icono={<Smile className="size-6" />}
          titulo="Sin encuestas registradas"
          descripcion="Las campañas de medición se cargan cuando el módulo entre en operación."
        />
      ) : (
        <Tarjeta>
          <Tabla>
            <TablaCabecera>
              <TablaFila>
                <TablaEncabezado className="w-[7rem]">Fecha</TablaEncabezado>
                <TablaEncabezado className="hidden md:table-cell">Cliente</TablaEncabezado>
                <TablaEncabezado className="w-[5rem] text-center">Puntaje</TablaEncabezado>
                <TablaEncabezado className="w-[7rem]">Categoría</TablaEncabezado>
                <TablaEncabezado>Comentario</TablaEncabezado>
                <TablaEncabezado className="hidden lg:table-cell">Canal</TablaEncabezado>
              </TablaFila>
            </TablaCabecera>
            <TablaCuerpo>
              {filas.map((fila) => (
                <TablaFila key={fila.id}>
                  <TablaCelda className="text-xs tabular">{formatearFecha(fila.fecha)}</TablaCelda>
                  <TablaCelda className="hidden text-xs md:table-cell">
                    {fila.clientes?.razon_social ?? "Anónimo"}
                  </TablaCelda>
                  <TablaCelda className="text-center text-xs font-semibold tabular">
                    {fila.puntaje}
                  </TablaCelda>
                  <TablaCelda>
                    <Insignia
                      variante={
                        fila.categoria_nps === "promotor"
                          ? "exito"
                          : fila.categoria_nps === "pasivo"
                            ? "advertencia"
                            : "peligro"
                      }
                    >
                      {fila.categoria_nps === "promotor"
                        ? "Promotor"
                        : fila.categoria_nps === "pasivo"
                          ? "Pasivo"
                          : "Detractor"}
                    </Insignia>
                  </TablaCelda>
                  <TablaCelda className="text-xs text-atenuado-contraste">
                    {recortar(fila.comentario, 90) || "—"}
                  </TablaCelda>
                  <TablaCelda className="hidden text-xs text-atenuado-contraste lg:table-cell">
                    {fila.canal ?? "—"}
                  </TablaCelda>
                </TablaFila>
              ))}
            </TablaCuerpo>
          </Tabla>
        </Tarjeta>
      )}
    </>
  );
}
