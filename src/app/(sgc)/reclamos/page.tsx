import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquareWarning, Plus } from "lucide-react";

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
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatearFecha } from "@/lib/formato";
import {
  CLASES_ESTADO_RECLAMO,
  ETIQUETAS_ESTADO_RECLAMO,
  ETIQUETAS_GRAVEDAD_RECLAMO,
  ETIQUETAS_PLAN_RECLAMO,
  vencido,
  type EstadoReclamo,
  type GravedadReclamo,
  type PlanReclamo,
} from "@/lib/reclamos";

export const metadata: Metadata = { title: "Reclamos de Clientes" };
export const dynamic = "force-dynamic";

interface FilaReclamo {
  id: string;
  codigo: string;
  titulo: string;
  cliente_nombre: string;
  gravedad: GravedadReclamo;
  plan: PlanReclamo;
  estado: EstadoReclamo;
  es_reincidencia: boolean;
  material_controlado: boolean;
  fecha_limite_contacto: string;
  fecha_contacto: string | null;
  fecha_limite_resolucion: string;
  fecha_resolucion: string | null;
  gestor: { nombre_completo: string } | null;
}

/**
 * Los reclamos de clientes.
 *
 * LA VISTA QUE JUSTIFICA EL MÓDULO es «Fuera de plazo»: los casos cuyo
 * primer contacto o cuya resolución vencieron sin hacerse. El
 * procedimiento pone plazos de horas para el primer contacto, y un plazo
 * que nadie mira es un plazo que no existe.
 */
export default async function PaginaReclamos({
  searchParams,
}: {
  searchParams: { vista?: string };
}) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data } = await supabase
    .from("reclamos")
    .select(
      "id, codigo, titulo, cliente_nombre, gravedad, plan, estado, es_reincidencia, " +
        "material_controlado, fecha_limite_contacto, fecha_contacto, " +
        "fecha_limite_resolucion, fecha_resolucion, gestor:gestor_id (nombre_completo)",
    )
    .order("creado_en", { ascending: false });

  const todos = (data as unknown as FilaReclamo[] | null) ?? [];
  const vista = searchParams.vista ?? "abiertos";

  const estaCerrado = (r: FilaReclamo) =>
    r.estado === "cerrado" || r.estado === "no_conciliado";

  const fueraDePlazo = (r: FilaReclamo) =>
    !estaCerrado(r) &&
    (vencido(r.fecha_limite_contacto, r.fecha_contacto) ||
      vencido(r.fecha_limite_resolucion, r.fecha_resolucion));

  const reclamos =
    vista === "plazo"
      ? todos.filter(fueraDePlazo)
      : vista === "cerrados"
        ? todos.filter(estaCerrado)
        : vista === "todos"
          ? todos
          : todos.filter((r) => !estaCerrado(r));

  const contadores = {
    abiertos: todos.filter((r) => !estaCerrado(r)).length,
    plazo: todos.filter(fueraDePlazo).length,
    cerrados: todos.filter(estaCerrado).length,
    todos: todos.length,
  };

  return (
    <div>
      <EncabezadoPagina
        titulo="Reclamos de Clientes"
        descripcion="Fuente única del caso: la gravedad del hecho define el plan, y cada plan trae sus plazos."
        acciones={
          puedeGestionar(usuario) ? (
            <Boton comoHijo>
              <Link href="/reclamos/nuevo">
                <Plus /> Nuevo Reclamo
              </Link>
            </Boton>
          ) : null
        }
      />

      <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
        {[
          { clave: "abiertos", texto: `Abiertos (${contadores.abiertos})` },
          { clave: "plazo", texto: `Fuera de plazo (${contadores.plazo})` },
          { clave: "cerrados", texto: `Cerrados (${contadores.cerrados})` },
          { clave: "todos", texto: `Todos (${contadores.todos})` },
        ].map((opcion) => (
          <Link
            key={opcion.clave}
            href={opcion.clave === "abiertos" ? "/reclamos" : `/reclamos?vista=${opcion.clave}`}
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

      {reclamos.length === 0 ? (
        <EstadoVacio
          icono={<MessageSquareWarning className="size-6" />}
          titulo={vista === "abiertos" ? "No hay reclamos abiertos" : "Nada en esta vista"}
          descripcion={
            vista === "abiertos"
              ? "Acá se registran los reclamos de clientes por cualquier vía: encuestas, reseñas, devoluciones, errores de facturación, fallas de entrega o de servicio técnico, y quejas verbales aunque no sean formales."
              : "Pruebe con otra vista."
          }
        />
      ) : (
        <Tarjeta>
          <Tabla>
            <TablaCabecera>
              <TablaFila>
                <TablaEncabezado>Código</TablaEncabezado>
                <TablaEncabezado>Caso</TablaEncabezado>
                <TablaEncabezado className="hidden md:table-cell">Cliente</TablaEncabezado>
                <TablaEncabezado>Plan</TablaEncabezado>
                <TablaEncabezado className="hidden lg:table-cell">Gestor</TablaEncabezado>
                <TablaEncabezado>Resolución</TablaEncabezado>
                <TablaEncabezado>Estado</TablaEncabezado>
              </TablaFila>
            </TablaCabecera>
            <TablaCuerpo>
              {reclamos.map((reclamo) => {
                const atrasado = fueraDePlazo(reclamo);
                return (
                  <TablaFila key={reclamo.id}>
                    <TablaCelda className="whitespace-nowrap text-xs font-medium">
                      <Link href={`/reclamos/${reclamo.id}`} className="hover:underline">
                        {reclamo.codigo}
                      </Link>
                    </TablaCelda>
                    <TablaCelda className="text-xs">
                      <Link href={`/reclamos/${reclamo.id}`} className="hover:underline">
                        {reclamo.titulo}
                      </Link>
                      <span className="ml-1.5 whitespace-nowrap text-[10px]">
                        {reclamo.es_reincidencia ? (
                          <span className="text-semaforo-alto">reincidencia</span>
                        ) : null}
                        {reclamo.material_controlado ? (
                          <span className="ml-1 text-semaforo-medio">material controlado</span>
                        ) : null}
                      </span>
                    </TablaCelda>
                    <TablaCelda className="hidden text-xs text-atenuado-contraste md:table-cell">
                      {reclamo.cliente_nombre}
                    </TablaCelda>
                    <TablaCelda className="whitespace-nowrap text-xs">
                      {ETIQUETAS_PLAN_RECLAMO[reclamo.plan].split(" · ")[0]}
                      <span className="ml-1 text-[10px] text-atenuado-contraste">
                        {ETIQUETAS_GRAVEDAD_RECLAMO[reclamo.gravedad]}
                      </span>
                    </TablaCelda>
                    <TablaCelda className="hidden whitespace-nowrap text-xs lg:table-cell">
                      {reclamo.gestor?.nombre_completo ?? "—"}
                    </TablaCelda>
                    <TablaCelda
                      className={`whitespace-nowrap text-xs tabular ${
                        atrasado ? "font-semibold text-semaforo-critico" : ""
                      }`}
                    >
                      {formatearFecha(reclamo.fecha_limite_resolucion)}
                    </TablaCelda>
                    <TablaCelda>
                      <Insignia variante="contorno">
                        <span className={CLASES_ESTADO_RECLAMO[reclamo.estado]}>
                          {ETIQUETAS_ESTADO_RECLAMO[reclamo.estado]}
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
