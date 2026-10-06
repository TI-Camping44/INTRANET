import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Plus } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { CalendarioAnual, type DiaMarcado } from "@/components/comunes/calendario-anual";
import { InsigniaEstadoAuditoria } from "@/components/comunes/insignias-estado";
import { TarjetaIndicador } from "@/components/comunes/tarjeta-indicador";
import { Boton } from "@/components/ui/boton";
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
import { puedeGestionarAuditorias, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { ETIQUETAS_TIPO_AUDITORIA } from "@/lib/constantes";
import { formatearFecha, hoyEnAsuncion } from "@/lib/formato";
import { PanelFichaPrograma } from "@/app/(sgc)/auditorias/programas/[id]/panel-ficha-programa";
import type { EstadoAuditoria } from "@/lib/tipos";

export const dynamic = "force-dynamic";

interface Programa {
  id: string;
  anio: number;
  nombre: string;
  objetivo: string | null;
  estado: string;
  fecha_aprobacion: string | null;
}

interface AuditoriaDelPrograma {
  id: string;
  codigo: string;
  tipo: string;
  objetivo: string | null;
  fecha_planificada: string | null;
  fecha_inicio: string | null;
  estado: EstadoAuditoria;
  procesos: { nombre: string } | null;
  auditor: { nombre_completo: string } | null;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const supabase = crearClienteServidor();
  const { data } = await supabase
    .from("programas_auditoria")
    .select("nombre")
    .eq("id", params.id)
    .maybeSingle();

  return { title: data ? (data as { nombre: string }).nombre : "Programa de auditorías" };
}

/**
 * La ficha del programa anual de auditorías.
 *
 * ES LO QUE FALTABA PARA QUE CREAR UN PROGRAMA SIRVIERA DE ALGO. Hasta
 * hoy el programa se creaba, se aprobaba y ahí terminaba: no había
 * adónde entrar. Peor todavía, el alta de la auditoría no mandaba
 * `programa_id` —Calidad sacó ese campo del formulario porque se
 * completaba siempre igual— y el programa quedaba sin una sola auditoría
 * adentro aunque el año tuviera diez.
 *
 * Ahora la auditoría se liga sola al programa de su año, y acá se ve el
 * calendario de los doce meses con los días agendados. De cada día se
 * entra a la auditoría, que es donde se completa su plan.
 *
 * EL CALENDARIO VA ARRIBA Y LA TABLA DEBAJO, las dos con los mismos
 * datos. El calendario contesta «cuándo» —y sobre todo, qué meses
 * quedaron vacíos—; la tabla contesta «qué» y «quién», que en una
 * cuadrícula de días no entra.
 */
export default async function PaginaPrograma({ params }: { params: { id: string } }) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();
  const gestiona = puedeGestionarAuditorias(usuario);
  const hoy = hoyEnAsuncion();

  const [{ data: consulta }, { data: datosAuditorias }] = await Promise.all([
    supabase
      .from("programas_auditoria")
      .select("id, anio, nombre, objetivo, estado, fecha_aprobacion")
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("auditorias")
      .select(
        "id, codigo, tipo, objetivo, fecha_planificada, fecha_inicio, estado, " +
          "procesos:proceso_id (nombre), auditor:auditor_lider_id (nombre_completo)",
      )
      .eq("programa_id", params.id)
      .order("fecha_planificada", { ascending: true }),
  ]);

  const programa = consulta as Programa | null;
  if (!programa) notFound();

  const auditorias = (datosAuditorias as unknown as AuditoriaDelPrograma[] | null) ?? [];
  const cerradas = auditorias.filter((auditoria) => auditoria.estado === "cerrada").length;
  const avance =
    auditorias.length > 0 ? Math.round((cerradas / auditorias.length) * 100) : 0;

  // El día que se marca es el de ejecución si ya empezó, y el planificado
  // si todavía no: el calendario tiene que mostrar cuándo pasó de verdad.
  const dias = auditorias.flatMap<DiaMarcado>((auditoria) => {
    const fecha = auditoria.fecha_inicio ?? auditoria.fecha_planificada;
    if (!fecha) return [];

    return [
      {
        fecha,
        codigo: auditoria.codigo,
        detalle: auditoria.objetivo ?? "Sin objetivo declarado",
        enlace: `/auditorias/${auditoria.id}`,
        tono:
          auditoria.estado === "cerrada"
            ? "cumplido"
            : auditoria.estado === "planificada" && fecha < hoy
              ? "atencion"
              : "normal",
      },
    ];
  });

  const atrasadas = dias.filter((dia) => dia.tono === "atencion").length;

  return (
    <div className="mx-auto max-w-6xl">
      <Boton variante="fantasma" tamano="pequeno" comoHijo className="mb-3 -ml-2">
        <Link href="/auditorias">
          <ArrowLeft /> Volver a Auditoría
        </Link>
      </Boton>

      <EncabezadoPagina
        titulo={programa.nombre}
        descripcion={programa.objetivo ?? undefined}
        acciones={
          gestiona ? (
            <div className="flex flex-wrap gap-2">
              <PanelFichaPrograma
                programa={programa}
                cuantasAuditorias={auditorias.length}
                puedeAprobar={usuario.rol === "administrador_sgc"}
              />
              <Boton tamano="pequeno" comoHijo>
                <Link href={`/auditorias/nueva?programa=${programa.id}`}>
                  <Plus /> Nueva auditoría
                </Link>
              </Boton>
            </div>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Insignia variante="primaria" className="tabular text-xs">
          {programa.anio}
        </Insignia>
        <InsigniaEstadoAuditoria estado={programa.estado as EstadoAuditoria} />
        {programa.fecha_aprobacion ? (
          <span className="text-[11px] text-atenuado-contraste">
            Aprobado el {formatearFecha(programa.fecha_aprobacion)}
          </span>
        ) : (
          <span className="text-[11px] text-semaforo-medio">
            Pendiente de aprobación del Administrador SGC
          </span>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <TarjetaIndicador
          titulo={`Avance ${programa.anio}`}
          valor={`${avance}%`}
          contexto={`${cerradas} de ${auditorias.length} cerradas`}
          tono={avance >= 75 ? "exito" : avance >= 40 ? "advertencia" : "atencion"}
        />
        <TarjetaIndicador titulo="Auditorías del programa" valor={auditorias.length} />
        <TarjetaIndicador
          titulo="Vencidas sin ejecutar"
          valor={atrasadas}
          contexto={atrasadas > 0 ? "Pasó la fecha planificada" : "Ninguna atrasada"}
          tono={atrasadas > 0 ? "peligro" : "exito"}
        />
      </div>

      <Progreso value={avance} className="mb-5" />

      <Tarjeta className="mb-4 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <CalendarDays className="size-3.5" />
            Calendario {programa.anio}
          </p>
          <span className="flex flex-wrap items-center gap-3 text-[10px] text-atenuado-contraste">
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded bg-primario" /> Agendada
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded bg-semaforo-alto" /> Vencida sin ejecutar
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded bg-semaforo-bajo" /> Cerrada
            </span>
          </span>
        </div>

        <CalendarioAnual anio={programa.anio} dias={dias} />
      </Tarjeta>

      <Tarjeta>
        <TarjetaCabecera className="flex-row items-center justify-between">
          <TarjetaTitulo>Auditorías del programa</TarjetaTitulo>
          <span className="text-[11px] text-atenuado-contraste">
            {auditorias.length} planificada{auditorias.length === 1 ? "" : "s"}
          </span>
        </TarjetaCabecera>
        <TarjetaContenido>
          {auditorias.length === 0 ? (
            <EstadoVacio
              icono={<CalendarDays className="size-6" />}
              titulo="El programa todavía no tiene auditorías"
              descripcion="Cada auditoría que se planifique con fecha de este año entra sola al programa."
              accion={
                gestiona ? (
                  <Boton comoHijo tamano="pequeno">
                    <Link href={`/auditorias/nueva?programa=${programa.id}`}>
                      <Plus /> Nueva auditoría
                    </Link>
                  </Boton>
                ) : null
              }
            />
          ) : (
            <Tabla>
              <TablaCabecera>
                <TablaFila>
                  <TablaEncabezado className="w-[8.5rem]">Código</TablaEncabezado>
                  <TablaEncabezado>Objetivo</TablaEncabezado>
                  <TablaEncabezado className="hidden lg:table-cell">Proceso</TablaEncabezado>
                  <TablaEncabezado className="hidden xl:table-cell">
                    Auditor líder
                  </TablaEncabezado>
                  <TablaEncabezado className="w-[9rem]">Estado</TablaEncabezado>
                  <TablaEncabezado className="w-[8rem]">Fecha</TablaEncabezado>
                </TablaFila>
              </TablaCabecera>
              <TablaCuerpo>
                {auditorias.map((auditoria) => (
                  <TablaFila key={auditoria.id}>
                    <TablaCelda className="text-xs font-medium tabular">
                      <Link href={`/auditorias/${auditoria.id}`} className="hover:text-primario">
                        {auditoria.codigo}
                      </Link>
                    </TablaCelda>
                    <TablaCelda className="text-xs">
                      <Link href={`/auditorias/${auditoria.id}`} className="hover:text-primario">
                        {auditoria.objetivo ?? "—"}
                      </Link>
                      <span className="mt-0.5 block text-[10px] text-atenuado-contraste">
                        {ETIQUETAS_TIPO_AUDITORIA[auditoria.tipo] ?? auditoria.tipo}
                      </span>
                    </TablaCelda>
                    <TablaCelda className="hidden text-xs text-atenuado-contraste lg:table-cell">
                      {auditoria.procesos?.nombre ?? "—"}
                    </TablaCelda>
                    <TablaCelda className="hidden text-xs text-atenuado-contraste xl:table-cell">
                      {auditoria.auditor?.nombre_completo ?? "—"}
                    </TablaCelda>
                    <TablaCelda>
                      <InsigniaEstadoAuditoria estado={auditoria.estado} />
                    </TablaCelda>
                    <TablaCelda className="text-xs text-atenuado-contraste">
                      {formatearFecha(auditoria.fecha_inicio ?? auditoria.fecha_planificada)}
                    </TablaCelda>
                  </TablaFila>
                ))}
              </TablaCuerpo>
            </Tabla>
          )}
        </TarjetaContenido>
      </Tarjeta>
    </div>
  );
}
