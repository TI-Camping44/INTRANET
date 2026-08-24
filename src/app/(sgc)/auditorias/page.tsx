import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { ModuloEnConstruccion } from "@/components/comunes/modulo-en-construccion";
import { InsigniaEstadoAuditoria } from "@/components/comunes/insignias-estado";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia } from "@/components/ui/insignia";
import { Progreso } from "@/components/ui/progreso";
import {
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaTitulo,
} from "@/components/ui/tarjeta";
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
import { ETIQUETAS_TIPO_HALLAZGO } from "@/lib/constantes";
import { formatearFecha } from "@/lib/formato";
import type { EstadoAuditoria, TipoHallazgo } from "@/lib/tipos";

export const metadata: Metadata = { title: "Auditorías internas" };
export const dynamic = "force-dynamic";

export default async function PaginaAuditorias() {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  const [{ data: programas }, { data: auditorias }, { data: hallazgos }] = await Promise.all([
    supabase.from("programas_auditoria").select("*").order("anio", { ascending: false }),
    supabase
      .from("auditorias")
      .select(
        "id, codigo, tipo, objetivo, fecha_planificada, fecha_inicio, estado, " +
          "procesos:proceso_id (nombre), auditor:auditor_lider_id (nombre_completo)",
      )
      .order("fecha_planificada", { ascending: true }),
    supabase
      .from("auditoria_hallazgos")
      .select("id, tipo, descripcion, no_conformidad_id, auditorias:auditoria_id (codigo)")
      .order("creado_en", { ascending: false })
      .limit(10),
  ]);

  const lista = (auditorias ?? []) as any[];
  const cerradas = lista.filter((auditoria) => auditoria.estado === "cerrada").length;
  const avance = lista.length > 0 ? Math.round((cerradas / lista.length) * 100) : 0;

  return (
    <>
      <EncabezadoPagina
        titulo="Auditorías internas"
        descripcion="Programa anual, planes de auditoría, hallazgos e informes."
      />

      <ModuloEnConstruccion nota={entradaPorRuta("/auditorias")?.notaFase} />

      {(programas ?? []).length > 0 ? (
        <Tarjeta className="mb-4 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold">
                {(programas as any[])[0].nombre} · {(programas as any[])[0].anio}
              </p>
              <p className="mt-0.5 text-[11px] text-atenuado-contraste">
                {(programas as any[])[0].objetivo ?? "Sin objetivo declarado"}
              </p>
            </div>
            <span className="text-2xl font-semibold tabular">{avance}%</span>
          </div>
          <Progreso value={avance} className="mt-3" />
          <p className="mt-2 text-[11px] text-atenuado-contraste">
            {cerradas} de {lista.length} auditorías cerradas.
          </p>
        </Tarjeta>
      ) : null}

      {lista.length === 0 ? (
        <EstadoVacio
          icono={<ClipboardCheck className="size-6" />}
          titulo="Sin auditorías registradas"
          descripcion="El programa anual se carga cuando el módulo entre en operación."
        />
      ) : (
        <Tarjeta>
          <Tabla>
            <TablaCabecera>
              <TablaFila>
                <TablaEncabezado className="w-[8rem]">Código</TablaEncabezado>
                <TablaEncabezado>Objetivo</TablaEncabezado>
                <TablaEncabezado className="hidden md:table-cell">Proceso</TablaEncabezado>
                <TablaEncabezado className="hidden lg:table-cell">Auditor líder</TablaEncabezado>
                <TablaEncabezado className="w-[8rem]">Fecha</TablaEncabezado>
                <TablaEncabezado className="w-[9rem]">Estado</TablaEncabezado>
              </TablaFila>
            </TablaCabecera>
            <TablaCuerpo>
              {lista.map((auditoria) => (
                <TablaFila key={auditoria.id}>
                  <TablaCelda className="font-medium tabular">{auditoria.codigo}</TablaCelda>
                  <TablaCelda className="text-xs">{auditoria.objetivo ?? "—"}</TablaCelda>
                  <TablaCelda className="hidden text-xs text-atenuado-contraste md:table-cell">
                    {auditoria.procesos?.nombre ?? "—"}
                  </TablaCelda>
                  <TablaCelda className="hidden text-xs text-atenuado-contraste lg:table-cell">
                    {auditoria.auditor?.nombre_completo ?? "—"}
                  </TablaCelda>
                  <TablaCelda className="text-xs tabular">
                    {formatearFecha(auditoria.fecha_inicio ?? auditoria.fecha_planificada)}
                  </TablaCelda>
                  <TablaCelda>
                    <InsigniaEstadoAuditoria estado={auditoria.estado as EstadoAuditoria} />
                  </TablaCelda>
                </TablaFila>
              ))}
            </TablaCuerpo>
          </Tabla>
        </Tarjeta>
      )}

      {(hallazgos ?? []).length > 0 ? (
        <Tarjeta className="mt-4">
          <TarjetaCabecera>
            <TarjetaTitulo>Últimos hallazgos</TarjetaTitulo>
          </TarjetaCabecera>
          <TarjetaContenido>
            <ul className="space-y-2">
              {(hallazgos as any[]).map((hallazgo) => (
                <li
                  key={hallazgo.id}
                  className="flex items-start justify-between gap-3 border-b border-borde pb-2
                             last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-xs">{hallazgo.descripcion}</p>
                    <p className="mt-0.5 text-[11px] text-atenuado-contraste">
                      {hallazgo.auditorias?.codigo ?? ""}
                      {hallazgo.no_conformidad_id ? (
                        <>
                          {" · "}
                          <Link
                            href={`/no-conformidades/${hallazgo.no_conformidad_id}`}
                            className="text-primario hover:underline"
                          >
                            Generó una no conformidad
                          </Link>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <Insignia
                    variante={
                      hallazgo.tipo.startsWith("no_conformidad")
                        ? "peligro"
                        : hallazgo.tipo === "observacion"
                          ? "advertencia"
                          : "exito"
                    }
                  >
                    {ETIQUETAS_TIPO_HALLAZGO[hallazgo.tipo as TipoHallazgo]}
                  </Insignia>
                </li>
              ))}
            </ul>
          </TarjetaContenido>
        </Tarjeta>
      ) : null}
    </>
  );
}
