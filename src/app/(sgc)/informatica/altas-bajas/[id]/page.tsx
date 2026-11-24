import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { HistorialBitacora } from "@/components/comunes/historial-bitacora";
import { NombreDeEmpresa } from "@/components/comunes/marca-empresa";
import { Insignia } from "@/components/ui/insignia";
import { Progreso } from "@/components/ui/progreso";
import {
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaTitulo,
} from "@/components/ui/tarjeta";
import { obtenerPermisos, requerirModulo } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatearFecha, formatearFechaHora } from "@/lib/formato";
import { nombrePorEmpresa, type EmpresaDelGrupo } from "@/lib/empresas";
import { ETIQUETAS_TIPO_MOVIMIENTO, esTipoMovimiento, pendientes } from "@/lib/altas-bajas-ti";
import { eliminarMovimiento } from "@/app/(sgc)/informatica/altas-bajas/acciones";
import { BotonEliminar } from "@/app/(sgc)/informatica/boton-eliminar";
import { PanelPasos, type Paso } from "@/app/(sgc)/informatica/altas-bajas/[id]/panel-pasos";

export const metadata: Metadata = { title: "Alta o baja de accesos" };
export const dynamic = "force-dynamic";

interface Movimiento {
  id: string;
  tipo: string;
  persona_nombre: string;
  persona_correo: string | null;
  empresa_de_la_persona_id: string | null;
  fecha_efectiva: string;
  ticket: string | null;
  origen: string | null;
  observaciones: string | null;
  puesto: { nombre: string } | null;
  autor: { nombre_completo: string } | null;
  creado_en: string;
}

interface FilaPaso {
  id: string;
  orden: number;
  sistema: string;
  descripcion: string;
  estado: string;
  observacion: string | null;
  resuelto_en: string | null;
  quien: { nombre_completo: string } | null;
}

/** Ficha de un ingreso o una desvinculación: sus datos y los pasos de cada sistema. */
export default async function PaginaMovimiento({ params }: { params: { id: string } }) {
  await requerirModulo("informatica");
  const permisos = await obtenerPermisos();
  const puedeEditar = permisos.informatica.editar;
  const supabase = crearClienteServidor();

  const [{ data }, { data: datosPasos }, { data: datosEmpresas }] = await Promise.all([
    supabase
      .from("movimientos_accesos_ti")
      .select(
        "id, tipo, persona_nombre, persona_correo, empresa_de_la_persona_id, fecha_efectiva, " +
          "ticket, origen, observaciones, creado_en, puesto:puesto_id (nombre), " +
          "autor:creado_por (nombre_completo)",
      )
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("movimiento_accesos_pasos")
      .select(
        "id, orden, sistema, descripcion, estado, observacion, resuelto_en, " +
          "quien:resuelto_por (nombre_completo)",
      )
      .eq("movimiento_id", params.id)
      .order("orden"),
    supabase.rpc("empresas_del_grupo"),
  ]);

  if (!data) notFound();
  const movimiento = data as unknown as Movimiento;
  const filas = (datosPasos ?? []) as unknown as FilaPaso[];
  const empresas = nombrePorEmpresa((datosEmpresas as EmpresaDelGrupo[] | null) ?? []);

  const pasos: Paso[] = filas.map((fila) => ({
    id: fila.id,
    orden: fila.orden,
    sistema: fila.sistema,
    descripcion: fila.descripcion,
    estado: fila.estado,
    observacion: fila.observacion,
    resuelto_en: fila.resuelto_en,
    resuelto_por_nombre: fila.quien?.nombre_completo ?? null,
    resuelto_en_texto: fila.resuelto_en ? formatearFechaHora(fila.resuelto_en) : null,
  }));

  const faltan = pendientes(pasos);
  const resueltos = pasos.length - faltan;
  const tipo = esTipoMovimiento(movimiento.tipo)
    ? ETIQUETAS_TIPO_MOVIMIENTO[movimiento.tipo]
    : movimiento.tipo;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link
        href="/informatica/altas-bajas"
        className="inline-flex items-center gap-1 text-xs text-atenuado-contraste hover:text-texto"
      >
        <ArrowLeft className="size-3" aria-hidden />
        Altas y bajas
      </Link>

      <EncabezadoPagina
        titulo={`${tipo} · ${movimiento.persona_nombre}`}
        acciones={
          puedeEditar ? (
            <BotonEliminar
              accion={eliminarMovimiento.bind(null, movimiento.id)}
              aviso={
                `¿Eliminar el registro de ${movimiento.persona_nombre} con todos sus pasos?\n\n` +
                "Úselo para un registro cargado por error: es la evidencia de lo que se hizo."
              }
              volverA="/informatica/altas-bajas"
            />
          ) : null
        }
      />

      <Tarjeta>
        <TarjetaContenido className="pt-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-3">
            <div>
              <dt className="text-atenuado-contraste">Situación</dt>
              <dd className="mt-0.5">
                <Insignia variante={faltan === 0 ? "exito" : "advertencia"}>
                  {faltan === 0 ? "Completo" : `${faltan} ${faltan === 1 ? "paso pendiente" : "pasos pendientes"}`}
                </Insignia>
              </dd>
            </div>
            <div>
              <dt className="text-atenuado-contraste">Fecha</dt>
              <dd className="tabular mt-0.5 font-medium">{formatearFecha(movimiento.fecha_efectiva)}</dd>
            </div>
            <div>
              <dt className="text-atenuado-contraste">Empresa</dt>
              <dd className="mt-0.5 font-medium">
                <NombreDeEmpresa
                  nombre={
                    movimiento.empresa_de_la_persona_id
                      ? (empresas.get(movimiento.empresa_de_la_persona_id) ?? null)
                      : null
                  }
                  vacio="—"
                />
              </dd>
            </div>
            <div>
              <dt className="text-atenuado-contraste">Puesto</dt>
              <dd className="mt-0.5 font-medium">{movimiento.puesto?.nombre ?? "Sin puesto definido"}</dd>
            </div>
            <div>
              <dt className="text-atenuado-contraste">Correo</dt>
              <dd className="mt-0.5 break-all font-medium">{movimiento.persona_correo ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-atenuado-contraste">Ticket</dt>
              <dd className="tabular mt-0.5 font-medium">
                {movimiento.ticket ? (
                  <Link href={`/informatica/tickets/${movimiento.ticket}`} className="hover:underline">
                    {movimiento.ticket}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div className="col-span-2 sm:col-span-3">
              <dt className="text-atenuado-contraste">Cómo llegó el aviso</dt>
              <dd className="mt-0.5">{movimiento.origen ?? "—"}</dd>
            </div>
            {movimiento.observaciones ? (
              <div className="col-span-2 sm:col-span-3">
                <dt className="text-atenuado-contraste">Observaciones</dt>
                <dd className="mt-0.5 whitespace-pre-line">{movimiento.observaciones}</dd>
              </div>
            ) : null}
          </dl>
        </TarjetaContenido>
      </Tarjeta>

      <Tarjeta>
        <TarjetaCabecera>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TarjetaTitulo>Pasos</TarjetaTitulo>
            <span className="tabular text-[11px] text-atenuado-contraste">
              {resueltos} de {pasos.length} resueltos
            </span>
          </div>
          <Progreso
            value={pasos.length === 0 ? 0 : Math.round((resueltos * 100) / pasos.length)}
            className="mt-2"
            aria-label="Pasos resueltos"
          />
        </TarjetaCabecera>
        <TarjetaContenido>
          <PanelPasos pasos={pasos} puedeEditar={puedeEditar} />
          <p className="mt-2 text-[11px] text-atenuado-contraste">
            Los pasos salieron de la matriz de accesos del puesto el{" "}
            {formatearFecha(movimiento.creado_en)}
            {movimiento.autor ? `, al registrarlo ${movimiento.autor.nombre_completo}` : ""}. Si la
            matriz cambia después, estos pasos no cambian.
          </p>
        </TarjetaContenido>
      </Tarjeta>

      <HistorialBitacora
        tablas={["movimientos_accesos_ti", "movimiento_accesos_pasos"]}
        registroId={movimiento.id}
        registrosRelacionados={pasos.map((paso) => paso.id)}
        etiquetas={Object.fromEntries(pasos.map((paso) => [paso.id, `Paso ${paso.orden} · ${paso.sistema}`]))}
        limite={40}
      />
    </div>
  );
}
