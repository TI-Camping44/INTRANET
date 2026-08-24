import type { Metadata } from "next";
import { Users } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { ModuloEnConstruccion } from "@/components/comunes/modulo-en-construccion";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia } from "@/components/ui/insignia";
import {
  Pestanas,
  PestanaContenido,
  PestanaDisparador,
  PestanasLista,
} from "@/components/ui/pestanas";
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
import { ETIQUETAS_EFICACIA } from "@/lib/constantes";
import { formatearFecha, formatearGuaranies, formatearNumero } from "@/lib/formato";
import type { ResultadoEficacia } from "@/lib/tipos";

export const metadata: Metadata = { title: "Recursos humanos" };
export const dynamic = "force-dynamic";

export default async function PaginaRecursosHumanos() {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  const [{ data: puestos }, { data: competencias }, { data: capacitaciones }] = await Promise.all([
    supabase
      .from("puestos")
      .select("*, procesos:proceso_id (nombre)")
      .eq("activo", true)
      .order("nombre"),
    supabase.from("competencias").select("*").order("codigo"),
    supabase.from("capacitaciones").select("*").order("fecha_inicio", { ascending: false }),
  ]);

  const listaPuestos = (puestos ?? []) as any[];
  const listaCompetencias = (competencias ?? []) as any[];
  const listaCapacitaciones = (capacitaciones ?? []) as any[];

  return (
    <>
      <EncabezadoPagina
        titulo="Recursos humanos"
        descripcion="Puestos y perfiles, matriz de competencias, capacitaciones y verificación de su eficacia."
      />

      <ModuloEnConstruccion nota={entradaPorRuta("/recursos-humanos")?.notaFase} />

      <Pestanas defaultValue="puestos">
        <PestanasLista>
          <PestanaDisparador value="puestos">Puestos ({listaPuestos.length})</PestanaDisparador>
          <PestanaDisparador value="competencias">
            Competencias ({listaCompetencias.length})
          </PestanaDisparador>
          <PestanaDisparador value="capacitaciones">
            Capacitaciones ({listaCapacitaciones.length})
          </PestanaDisparador>
        </PestanasLista>

        <PestanaContenido value="puestos">
          {listaPuestos.length === 0 ? (
            <EstadoVacio
              icono={<Users className="size-6" />}
              titulo="Sin puestos definidos"
              descripcion="Los perfiles de puesto se importan desde Sofidya o se cargan manualmente."
            />
          ) : (
            <Tarjeta>
              <Tabla>
                <TablaCabecera>
                  <TablaFila>
                    <TablaEncabezado className="w-[7rem]">Código</TablaEncabezado>
                    <TablaEncabezado>Puesto</TablaEncabezado>
                    <TablaEncabezado className="hidden md:table-cell">Área</TablaEncabezado>
                    <TablaEncabezado className="hidden lg:table-cell">Proceso</TablaEncabezado>
                    <TablaEncabezado>Misión</TablaEncabezado>
                  </TablaFila>
                </TablaCabecera>
                <TablaCuerpo>
                  {listaPuestos.map((puesto) => (
                    <TablaFila key={puesto.id}>
                      <TablaCelda className="font-medium tabular">{puesto.codigo}</TablaCelda>
                      <TablaCelda className="text-xs font-medium">{puesto.nombre}</TablaCelda>
                      <TablaCelda className="hidden text-xs text-atenuado-contraste md:table-cell">
                        {puesto.area ?? "—"}
                      </TablaCelda>
                      <TablaCelda className="hidden text-xs text-atenuado-contraste lg:table-cell">
                        {puesto.procesos?.nombre ?? "—"}
                      </TablaCelda>
                      <TablaCelda className="text-xs text-atenuado-contraste">
                        {puesto.mision ?? "—"}
                      </TablaCelda>
                    </TablaFila>
                  ))}
                </TablaCuerpo>
              </Tabla>
            </Tarjeta>
          )}
        </PestanaContenido>

        <PestanaContenido value="competencias">
          {listaCompetencias.length === 0 ? (
            <EstadoVacio
              titulo="Sin competencias definidas"
              descripcion="La matriz de competencias por puesto se construye en la próxima fase."
            />
          ) : (
            <Tarjeta>
              <Tabla>
                <TablaCabecera>
                  <TablaFila>
                    <TablaEncabezado className="w-[7rem]">Código</TablaEncabezado>
                    <TablaEncabezado>Competencia</TablaEncabezado>
                    <TablaEncabezado className="w-[8rem]">Tipo</TablaEncabezado>
                    <TablaEncabezado>Descripción</TablaEncabezado>
                  </TablaFila>
                </TablaCabecera>
                <TablaCuerpo>
                  {listaCompetencias.map((competencia) => (
                    <TablaFila key={competencia.id}>
                      <TablaCelda className="font-medium tabular">{competencia.codigo}</TablaCelda>
                      <TablaCelda className="text-xs font-medium">{competencia.nombre}</TablaCelda>
                      <TablaCelda>
                        <Insignia variante="contorno">{competencia.tipo}</Insignia>
                      </TablaCelda>
                      <TablaCelda className="text-xs text-atenuado-contraste">
                        {competencia.descripcion ?? "—"}
                      </TablaCelda>
                    </TablaFila>
                  ))}
                </TablaCuerpo>
              </Tabla>
            </Tarjeta>
          )}
        </PestanaContenido>

        <PestanaContenido value="capacitaciones">
          {listaCapacitaciones.length === 0 ? (
            <EstadoVacio
              titulo="Sin capacitaciones registradas"
              descripcion="El plan anual de capacitación se carga cuando el módulo entre en operación."
            />
          ) : (
            <Tarjeta>
              <Tabla>
                <TablaCabecera>
                  <TablaFila>
                    <TablaEncabezado className="w-[7rem]">Código</TablaEncabezado>
                    <TablaEncabezado>Capacitación</TablaEncabezado>
                    <TablaEncabezado className="hidden md:table-cell">Tipo</TablaEncabezado>
                    <TablaEncabezado className="w-[7rem]">Fecha</TablaEncabezado>
                    <TablaEncabezado className="w-[5rem] text-right">Horas</TablaEncabezado>
                    <TablaEncabezado className="w-[9rem] text-right">Costo</TablaEncabezado>
                    <TablaEncabezado className="w-[8rem]">Estado</TablaEncabezado>
                  </TablaFila>
                </TablaCabecera>
                <TablaCuerpo>
                  {listaCapacitaciones.map((capacitacion) => (
                    <TablaFila key={capacitacion.id}>
                      <TablaCelda className="font-medium tabular">
                        {capacitacion.codigo}
                      </TablaCelda>
                      <TablaCelda className="text-xs font-medium">
                        {capacitacion.nombre}
                      </TablaCelda>
                      <TablaCelda className="hidden text-xs text-atenuado-contraste md:table-cell">
                        {capacitacion.tipo}
                      </TablaCelda>
                      <TablaCelda className="text-xs tabular">
                        {formatearFecha(capacitacion.fecha_inicio)}
                      </TablaCelda>
                      <TablaCelda className="text-right text-xs tabular">
                        {formatearNumero(capacitacion.horas, 1)}
                      </TablaCelda>
                      <TablaCelda className="text-right text-xs tabular">
                        {formatearGuaranies(capacitacion.costo_gs)}
                      </TablaCelda>
                      <TablaCelda>
                        <Insignia variante="contorno">{capacitacion.estado}</Insignia>
                      </TablaCelda>
                    </TablaFila>
                  ))}
                </TablaCuerpo>
              </Tabla>
            </Tarjeta>
          )}
        </PestanaContenido>
      </Pestanas>

      <p className="mt-3 text-[11px] text-atenuado-contraste">
        La verificación de eficacia de las capacitaciones usa la escala{" "}
        {Object.values(ETIQUETAS_EFICACIA)
          .filter((etiqueta) => etiqueta !== ETIQUETAS_EFICACIA["pendiente" as ResultadoEficacia])
          .join(" · ")}
        .
      </p>
    </>
  );
}
