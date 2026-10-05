import type { Metadata } from "next";
import Link from "next/link";
import { GitBranch, Plus } from "lucide-react";

import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
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
import { requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatearFecha } from "@/lib/formato";
import {
  CLASES_ESTADO_CAMBIO,
  ETIQUETAS_ESTADO_CAMBIO,
  ETIQUETAS_RESULTADO_CAMBIO,
  ETIQUETAS_TIPO_CAMBIO,
  seguimientoVencido,
  type EstadoCambio,
  type ResultadoCambio,
  type TipoCambio,
} from "@/lib/cambios";
import { puedeGestionar } from "@/lib/sesion";
import { CeldaTexto } from "@/components/comunes/celda-texto";

export const metadata: Metadata = { title: "Planificación y Gestión de Cambios" };
export const dynamic = "force-dynamic";

interface FilaCambio {
  id: string;
  codigo: string;
  titulo: string;
  tipo: TipoCambio;
  estado: EstadoCambio;
  fecha_solicitud: string | null;
  proposito: string | null;
  consecuencias_potenciales: string | null;
  impacto_integridad_sgc: string | null;
  recursos_necesarios: string | null;
  responsabilidades: string | null;
  comunicacion_a_quien: string | null;
  comunicacion_cuando: string | null;
  comunicacion_canal: string | null;
  indicador_exito: string | null;
  criterio_exito: string | null;
  fecha_revision: string;
  documentos_afectados: string | null;
  fecha_aprobacion: string | null;
  fecha_implementacion: string | null;
  seguimiento_observacion: string | null;
  resultado_revision: string | null;
  resultado: ResultadoCambio | null;
  acciones_adicionales: string | null;
  afecta_material_controlado: boolean;
  proceso_declarado: string | null;
  procesos: { nombre: string } | null;
  responsable: { nombre_completo: string } | null;
  solicitante: { nombre_completo: string } | null;
  aprobador: { nombre_completo: string } | null;
}

/**
 * Los cambios significativos al SGC.
 *
 * TRES VISTAS, que son las tres preguntas que Calidad hace: todos, los
 * que esperan una firma, y los que ya se implementaron y cuya fecha de
 * revisión pasó sin que nadie los mirara. La tercera es la razón de ser
 * del módulo: un cambio implementado y olvidado es exactamente lo que el
 * procedimiento quiere evitar.
 */
export default async function PaginaCambios({
  searchParams,
}: {
  searchParams: { vista?: string };
}) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data } = await supabase
    .from("cambios")
    .select(
      "id, codigo, titulo, tipo, estado, fecha_solicitud, proposito, " +
        "consecuencias_potenciales, impacto_integridad_sgc, recursos_necesarios, " +
        "responsabilidades, comunicacion_a_quien, comunicacion_cuando, comunicacion_canal, " +
        "indicador_exito, criterio_exito, fecha_revision, documentos_afectados, " +
        "fecha_aprobacion, fecha_implementacion, seguimiento_observacion, " +
        "resultado_revision, resultado, acciones_adicionales, " +
        "afecta_material_controlado, proceso_declarado, " +
        "procesos:proceso_id (nombre), responsable:responsable_id (nombre_completo), " +
        "solicitante:solicitante_id (nombre_completo), aprobador:aprobado_por (nombre_completo)",
    )
    .order("creado_en", { ascending: false });

  const todos = (data as unknown as FilaCambio[] | null) ?? [];
  const vista = searchParams.vista ?? "todos";

  const cambios =
    vista === "aprobacion"
      ? todos.filter((c) => c.estado === "en_aprobacion")
      : vista === "vencidos"
        ? todos.filter((c) => seguimientoVencido(c.estado, c.fecha_revision))
        : todos;

  const vencidos = todos.filter((c) => seguimientoVencido(c.estado, c.fecha_revision)).length;

  return (
    <div>
      <EncabezadoPagina
        titulo="Planificación y Gestión de Cambios"
        descripcion="Todo cambio significativo al SGC se registra antes de hacerse, y se revisa en una fecha fijada de antemano."
        acciones={
          puedeGestionar(usuario) ? (
            <Boton comoHijo>
              <Link href="/cambios/nuevo">
                <Plus /> Nuevo Cambio
              </Link>
            </Boton>
          ) : null
        }
      />

      {/* Atajos, con la misma forma que los demás módulos. */}
      <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
        {[
          { clave: "todos", texto: `Todos (${todos.length})` },
          {
            clave: "aprobacion",
            texto: `En aprobación (${todos.filter((c) => c.estado === "en_aprobacion").length})`,
          },
          { clave: "vencidos", texto: `Seguimiento vencido (${vencidos})` },
        ].map((opcion) => (
          <Link
            key={opcion.clave}
            href={opcion.clave === "todos" ? "/cambios" : `/cambios?vista=${opcion.clave}`}
            className={`rounded-md border px-2.5 py-1 ${
              vista === opcion.clave
                ? "border-primario bg-primario/10 text-primario"
                : "border-borde text-atenuado-contraste hover:bg-acento"
            }`}
          >
            {opcion.texto}
          </Link>
        ))}
      </div>

      {cambios.length === 0 ? (
        <EstadoVacio
          icono={<GitBranch className="size-6" />}
          titulo={vista === "todos" ? "Todavía no hay cambios registrados" : "Nada en esta vista"}
          descripcion={
            vista === "todos"
              ? "Acá se registran los cambios significativos al SGC: alta o baja de un proceso, cambio de responsable, de sistema, de habilitación, mudanzas, nuevas líneas de productos controlados y cambios normativos."
              : "Pruebe con otra vista."
          }
        />
      ) : (
        <Tarjeta>
          {/* LAS COLUMNAS DE LA HOJA 6.3, EN SU ORDEN. Los incisos del
              apartado 6.3 de la norma llevan su letra en el rótulo, como
              en el formulario de Calidad: es como los busca un auditor.

              El plan de comunicación son tres columnas de la tabla —a
              quién, cuándo y por qué canal— y en la hoja es una sola
              celda: se arman juntas, separadas por puntos. El indicador y
              el criterio de éxito, igual. */}
          <Tabla>
            <TablaCabecera>
              <TablaFila>
                <TablaEncabezado className="sticky left-0 z-10 w-[8rem] bg-fondo">
                  Código
                </TablaEncabezado>
                <TablaEncabezado className="w-[7rem]">Fecha de solicitud</TablaEncabezado>
                <TablaEncabezado className="w-[11rem]">Solicitante</TablaEncabezado>
                <TablaEncabezado className="w-[18rem]">Descripción del cambio</TablaEncabezado>
                <TablaEncabezado className="w-[12rem]">Tipo de cambio</TablaEncabezado>
                <TablaEncabezado className="w-[14rem]">a) Propósito</TablaEncabezado>
                <TablaEncabezado className="w-[14rem]">
                  a) Consecuencias potenciales
                </TablaEncabezado>
                <TablaEncabezado className="w-[14rem]">
                  b) Impacto en la integridad del SGC
                </TablaEncabezado>
                <TablaEncabezado className="w-[13rem]">
                  c) Recursos e información
                </TablaEncabezado>
                <TablaEncabezado className="w-[13rem]">d) Responsabilidades</TablaEncabezado>
                <TablaEncabezado className="w-[15rem]">e) Plan de comunicación</TablaEncabezado>
                <TablaEncabezado className="w-[15rem]">
                  f) Indicador y criterio de éxito
                </TablaEncabezado>
                <TablaEncabezado className="w-[7rem]">g) Revisión prevista</TablaEncabezado>
                <TablaEncabezado className="w-[13rem]">Documentos afectados</TablaEncabezado>
                <TablaEncabezado className="w-[11rem]">Aprobado por</TablaEncabezado>
                <TablaEncabezado className="w-[7rem]">Fecha de aprobación</TablaEncabezado>
                <TablaEncabezado className="w-[7rem]">Implementación</TablaEncabezado>
                <TablaEncabezado className="w-[14rem]">
                  f) Seguimiento de eficacia
                </TablaEncabezado>
                <TablaEncabezado className="w-[14rem]">
                  g) Resultado de la revisión
                </TablaEncabezado>
                <TablaEncabezado className="w-[8rem]">¿Fue eficaz?</TablaEncabezado>
                <TablaEncabezado className="w-[14rem]">Acciones adicionales</TablaEncabezado>
                <TablaEncabezado className="w-[9rem]">Estado</TablaEncabezado>
              </TablaFila>
            </TablaCabecera>
            <TablaCuerpo>
              {cambios.map((cambio) => {
                const vencido = seguimientoVencido(cambio.estado, cambio.fecha_revision);

                // En la hoja el plan de comunicación es una celda; acá
                // son tres columnas. Se unen con puntos y se saltan las
                // vacías, para no mostrar «· · ».
                const comunicacion =
                  [cambio.comunicacion_a_quien, cambio.comunicacion_cuando, cambio.comunicacion_canal]
                    .filter((parte) => parte?.trim())
                    .join(" · ") || null;

                const exito =
                  [cambio.indicador_exito, cambio.criterio_exito]
                    .filter((parte) => parte?.trim())
                    .join(" · ") || null;

                return (
                  <TablaFila key={cambio.id}>
                    <TablaCelda className="sticky left-0 z-10 whitespace-nowrap bg-fondo text-xs font-medium tabular">
                      <Link href={`/cambios/${cambio.id}`} className="hover:underline">
                        {cambio.codigo}
                      </Link>
                      {cambio.afecta_material_controlado ? (
                        <span className="block text-[10px] font-normal text-semaforo-medio">
                          material controlado
                        </span>
                      ) : null}
                    </TablaCelda>

                    <TablaCelda className="text-xs tabular text-atenuado-contraste">
                      {cambio.fecha_solicitud ? formatearFecha(cambio.fecha_solicitud) : "—"}
                    </TablaCelda>

                    <CeldaTexto ancho="11rem">{cambio.solicitante?.nombre_completo}</CeldaTexto>

                    <TablaCelda className="text-xs" style={{ maxWidth: "18rem" }}>
                      <Link
                        href={`/cambios/${cambio.id}`}
                        className="block truncate hover:underline"
                        title={cambio.titulo}
                      >
                        {cambio.titulo}
                      </Link>
                      {/* El proceso va debajo del título: en la hoja no
                          tiene columna propia, pero sin él no se sabe
                          dónde cae el cambio. */}
                      {cambio.proceso_declarado ?? cambio.procesos?.nombre ? (
                        <span className="block truncate text-[11px] text-atenuado-contraste">
                          {cambio.proceso_declarado ?? cambio.procesos?.nombre}
                        </span>
                      ) : null}
                    </TablaCelda>

                    <CeldaTexto ancho="12rem">{ETIQUETAS_TIPO_CAMBIO[cambio.tipo]}</CeldaTexto>
                    <CeldaTexto ancho="14rem">{cambio.proposito}</CeldaTexto>
                    <CeldaTexto ancho="14rem">{cambio.consecuencias_potenciales}</CeldaTexto>
                    <CeldaTexto ancho="14rem">{cambio.impacto_integridad_sgc}</CeldaTexto>
                    <CeldaTexto ancho="13rem">{cambio.recursos_necesarios}</CeldaTexto>
                    <CeldaTexto ancho="13rem">{cambio.responsabilidades}</CeldaTexto>
                    <CeldaTexto ancho="15rem">{comunicacion}</CeldaTexto>
                    <CeldaTexto ancho="15rem">{exito}</CeldaTexto>

                    <TablaCelda
                      className={`whitespace-nowrap text-xs tabular ${
                        vencido ? "font-semibold text-semaforo-critico" : ""
                      }`}
                    >
                      {formatearFecha(cambio.fecha_revision)}
                    </TablaCelda>

                    <CeldaTexto ancho="13rem">{cambio.documentos_afectados}</CeldaTexto>
                    <CeldaTexto ancho="11rem">{cambio.aprobador?.nombre_completo}</CeldaTexto>

                    <TablaCelda className="text-xs tabular text-atenuado-contraste">
                      {cambio.fecha_aprobacion ? formatearFecha(cambio.fecha_aprobacion) : "—"}
                    </TablaCelda>
                    <TablaCelda className="text-xs tabular text-atenuado-contraste">
                      {cambio.fecha_implementacion
                        ? formatearFecha(cambio.fecha_implementacion)
                        : "—"}
                    </TablaCelda>

                    <CeldaTexto ancho="14rem">{cambio.seguimiento_observacion}</CeldaTexto>
                    <CeldaTexto ancho="14rem">{cambio.resultado_revision}</CeldaTexto>

                    <TablaCelda className="text-xs">
                      {cambio.resultado && cambio.resultado !== "pendiente" ? (
                        <span
                          className={
                            cambio.resultado === "eficaz"
                              ? "text-semaforo-bajo"
                              : "text-semaforo-critico"
                          }
                        >
                          {ETIQUETAS_RESULTADO_CAMBIO[cambio.resultado]}
                        </span>
                      ) : (
                        <span className="text-atenuado-contraste">Pendiente</span>
                      )}
                    </TablaCelda>

                    <CeldaTexto ancho="14rem">{cambio.acciones_adicionales}</CeldaTexto>

                    <TablaCelda>
                      <Insignia variante="contorno">
                        <span className={CLASES_ESTADO_CAMBIO[cambio.estado]}>
                          {ETIQUETAS_ESTADO_CAMBIO[cambio.estado]}
                        </span>
                      </Insignia>
                    </TablaCelda>
                  </TablaFila>
                );
              })}
            </TablaCuerpo>
          </Tabla>
        </Tarjeta>
      )}
    </div>
  );
}
