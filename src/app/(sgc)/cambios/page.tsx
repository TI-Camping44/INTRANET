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
  ETIQUETAS_TIPO_CAMBIO,
  seguimientoVencido,
  type EstadoCambio,
  type TipoCambio,
} from "@/lib/cambios";
import { puedeGestionar } from "@/lib/sesion";

export const metadata: Metadata = { title: "Planificación y Gestión de Cambios" };
export const dynamic = "force-dynamic";

interface FilaCambio {
  id: string;
  codigo: string;
  titulo: string;
  tipo: TipoCambio;
  estado: EstadoCambio;
  fecha_revision: string;
  afecta_material_controlado: boolean;
  procesos: { nombre: string } | null;
  responsable: { nombre_completo: string } | null;
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
      "id, codigo, titulo, tipo, estado, fecha_revision, afecta_material_controlado, " +
        "procesos:proceso_id (nombre), responsable:responsable_id (nombre_completo)",
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
          <Tabla>
            <TablaCabecera>
              <TablaFila>
                <TablaEncabezado>Código</TablaEncabezado>
                <TablaEncabezado>Cambio</TablaEncabezado>
                <TablaEncabezado className="hidden md:table-cell">Tipo</TablaEncabezado>
                <TablaEncabezado className="hidden lg:table-cell">Responsable</TablaEncabezado>
                <TablaEncabezado>Revisión</TablaEncabezado>
                <TablaEncabezado>Estado</TablaEncabezado>
              </TablaFila>
            </TablaCabecera>
            <TablaCuerpo>
              {cambios.map((cambio) => {
                const vencido = seguimientoVencido(cambio.estado, cambio.fecha_revision);
                return (
                  <TablaFila key={cambio.id}>
                    <TablaCelda className="whitespace-nowrap text-xs font-medium">
                      <Link href={`/cambios/${cambio.id}`} className="hover:underline">
                        {cambio.codigo}
                      </Link>
                    </TablaCelda>
                    <TablaCelda className="text-xs">
                      <Link href={`/cambios/${cambio.id}`} className="hover:underline">
                        {cambio.titulo}
                      </Link>
                      {cambio.afecta_material_controlado ? (
                        <span className="ml-1.5 text-[10px] text-semaforo-medio">
                          material controlado
                        </span>
                      ) : null}
                    </TablaCelda>
                    <TablaCelda className="hidden text-xs text-atenuado-contraste md:table-cell">
                      {ETIQUETAS_TIPO_CAMBIO[cambio.tipo]}
                    </TablaCelda>
                    <TablaCelda className="hidden whitespace-nowrap text-xs lg:table-cell">
                      {cambio.responsable?.nombre_completo ?? "—"}
                    </TablaCelda>
                    <TablaCelda
                      className={`whitespace-nowrap text-xs tabular ${
                        vencido ? "font-semibold text-semaforo-critico" : ""
                      }`}
                    >
                      {formatearFecha(cambio.fecha_revision)}
                    </TablaCelda>
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
