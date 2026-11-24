import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Plus } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltrosListado } from "@/components/comunes/filtros-listado";
import { TarjetaIndicador } from "@/components/comunes/tarjeta-indicador";
import { Boton } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia } from "@/components/ui/insignia";
import { Tarjeta, TarjetaContenido } from "@/components/ui/tarjeta";
import { obtenerPermisos, requerirModulo } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatearFechaHora } from "@/lib/formato";
import { sinTildes } from "@/lib/utilidades";
import {
  DEFINICION_ESTADO_AUTOMATISMO,
  ETIQUETAS_ESTADO_AUTOMATISMO,
  ORDEN_ESTADO_AUTOMATISMO,
  VARIANTE_ESTADO_AUTOMATISMO,
  describirFrecuencia,
  describirHace,
  estadoDelAutomatismo,
  type EstadoAutomatismo,
} from "@/lib/automatismos-ti";

export const metadata: Metadata = { title: "Automatismos de TI" };
export const dynamic = "force-dynamic";

interface FilaAutomatismo {
  id: string;
  clave: string;
  nombre: string;
  donde_vive: string | null;
  frecuencia_horas: number | null;
  vigente: boolean;
  ultimo_latido_en: string | null;
  ultimo_resultado: string | null;
  ultimo_mensaje: string | null;
  errores_7_dias: number;
}

const ESTADOS: EstadoAutomatismo[] = [
  "caido",
  "con_error",
  "atrasado",
  "sin_conectar",
  "conectado",
  "al_dia",
  "pausado",
];

/**
 * Estado de los automatismos de TI.
 *
 * UN SCRIPT QUE SE CALLA NO AVISA. Si se borra su activador o vence su
 * autorización, Apps Script no manda ningún correo: el script deja de
 * existir y nadie se entera hasta que alguien pregunta por qué no llegó
 * algo. Cada script avisa que corrió, y esta pantalla compara ese aviso
 * con su frecuencia. El trabajo programado de las 11:00 le avisa al
 * responsable de los caídos y de los que fallaron.
 */
export default async function PaginaAutomatismos({
  searchParams,
}: {
  searchParams: { q?: string; estado?: string };
}) {
  await requerirModulo("informatica");
  const permisos = await obtenerPermisos();
  const puedeEditar = permisos.informatica.editar;
  const supabase = crearClienteServidor();

  const { data } = await supabase
    .from("vista_automatismos_ti")
    .select(
      "id, clave, nombre, donde_vive, frecuencia_horas, vigente, ultimo_latido_en, " +
        "ultimo_resultado, ultimo_mensaje, errores_7_dias",
    )
    .order("nombre");

  const ahora = new Date();
  const automatismos = ((data ?? []) as unknown as FilaAutomatismo[])
    .map((fila) => ({ ...fila, estado: estadoDelAutomatismo(fila, ahora) }))
    .sort(
      (a, b) =>
        ORDEN_ESTADO_AUTOMATISMO[a.estado] - ORDEN_ESTADO_AUTOMATISMO[b.estado] ||
        a.nombre.localeCompare(b.nombre, "es"),
    );

  const cuenta = (estado: EstadoAutomatismo) =>
    automatismos.filter((automatismo) => automatismo.estado === estado).length;

  const partes = sinTildes(searchParams.q ?? "")
    .split(/\s+/)
    .filter(Boolean);
  const filtrados = automatismos.filter((automatismo) => {
    if (searchParams.estado && automatismo.estado !== searchParams.estado) return false;
    if (partes.length > 0) {
      const texto = sinTildes(
        `${automatismo.nombre} ${automatismo.clave} ${automatismo.donde_vive ?? ""}`,
      );
      if (!partes.every((parte) => texto.includes(parte))) return false;
    }
    return true;
  });

  const caidos = cuenta("caido");
  const conError = cuenta("con_error");

  return (
    <div className="space-y-5">
      <EncabezadoPagina
        titulo="Automatismos"
        descripcion={
          "Los scripts y automatizaciones de TI, con su último aviso. Un automatismo que deja " +
          "de avisar se marca caído y su responsable recibe el aviso a las 8:00."
        }
        acciones={
          puedeEditar ? (
            <Boton comoHijo tamano="pequeno">
              <Link href="/informatica/automatismos/nuevo">
                <Plus aria-hidden />
                Registrar automatismo
              </Link>
            </Boton>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaIndicador
          titulo="Caídos"
          valor={caidos}
          tono={caidos > 0 ? "peligro" : "neutro"}
          contexto="Dos ciclos o más sin avisar"
          enlace={caidos > 0 ? "/informatica/automatismos?estado=caido" : undefined}
        />
        <TarjetaIndicador
          titulo="Con error"
          valor={conError}
          tono={conError > 0 ? "atencion" : "neutro"}
          contexto="Su último aviso fue un error"
          enlace={conError > 0 ? "/informatica/automatismos?estado=con_error" : undefined}
        />
        <TarjetaIndicador
          titulo="Al día"
          valor={cuenta("al_dia") + cuenta("conectado")}
          tono="exito"
          contexto="Avisan como corresponde"
        />
        <TarjetaIndicador
          titulo="Sin conectar"
          valor={cuenta("sin_conectar")}
          contexto="Todavía no avisaron nunca"
          enlace={
            cuenta("sin_conectar") > 0 ? "/informatica/automatismos?estado=sin_conectar" : undefined
          }
        />
      </div>

      <FiltrosListado
        marcadorBusqueda="Buscar por nombre, clave o dónde vive…"
        campos={[
          {
            nombre: "estado",
            etiqueta: "Estado",
            opciones: ESTADOS.map((estado) => ({
              valor: estado,
              etiqueta: ETIQUETAS_ESTADO_AUTOMATISMO[estado],
            })),
          },
        ]}
      />

      <Tarjeta>
        <TarjetaContenido className="pt-4">
          {filtrados.length === 0 ? (
            <EstadoVacio
              icono={<Activity className="size-6" aria-hidden />}
              titulo={automatismos.length === 0 ? "Todavía no hay automatismos" : "Nada coincide"}
              descripcion={
                automatismos.length === 0
                  ? "Registre los scripts que corren solos para saber cuándo se caen."
                  : "Pruebe con otros filtros o límpielos para ver todo."
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border border-borde">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-borde bg-atenuado/50 text-left">
                      <th scope="col" className="px-3 py-2 font-semibold">
                        Automatismo
                      </th>
                      <th scope="col" className="px-3 py-2 font-semibold">
                        Estado
                      </th>
                      <th scope="col" className="hidden px-3 py-2 font-semibold md:table-cell">
                        Frecuencia
                      </th>
                      <th scope="col" className="hidden whitespace-nowrap px-3 py-2 font-semibold md:table-cell">
                        Último aviso
                      </th>
                      <th scope="col" className="hidden px-3 py-2 text-right font-semibold lg:table-cell">
                        Errores (7 días)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map((automatismo) => (
                      <tr key={automatismo.id} className="border-b border-borde last:border-b-0">
                        <td className="px-3 py-2 align-top">
                          <Link
                            href={`/informatica/automatismos/${automatismo.id}`}
                            className="font-medium hover:underline"
                          >
                            {automatismo.nombre}
                          </Link>
                          <span className="mt-0.5 block text-[11px] text-atenuado-contraste">
                            {automatismo.donde_vive ?? automatismo.clave}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-atenuado-contraste md:hidden">
                            {describirFrecuencia(automatismo.frecuencia_horas)} · Último aviso:{" "}
                            {describirHace(automatismo.ultimo_latido_en, ahora)}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <Insignia
                            variante={VARIANTE_ESTADO_AUTOMATISMO[automatismo.estado]}
                            title={DEFINICION_ESTADO_AUTOMATISMO[automatismo.estado]}
                          >
                            {ETIQUETAS_ESTADO_AUTOMATISMO[automatismo.estado]}
                          </Insignia>
                        </td>
                        <td className="hidden whitespace-nowrap px-3 py-2 align-top md:table-cell">
                          {describirFrecuencia(automatismo.frecuencia_horas)}
                        </td>
                        <td className="hidden whitespace-nowrap px-3 py-2 align-top md:table-cell">
                          <span className="block">{describirHace(automatismo.ultimo_latido_en, ahora)}</span>
                          {automatismo.ultimo_latido_en ? (
                            <span className="tabular block text-[11px] text-atenuado-contraste">
                              {formatearFechaHora(automatismo.ultimo_latido_en)}
                            </span>
                          ) : null}
                        </td>
                        <td className="tabular hidden px-3 py-2 text-right align-top lg:table-cell">
                          {automatismo.errores_7_dias > 0 ? (
                            <span className="font-medium text-semaforo-alto">
                              {automatismo.errores_7_dias}
                            </span>
                          ) : (
                            "0"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[11px] text-atenuado-contraste">
                {filtrados.length === automatismos.length
                  ? `${automatismos.length} ${automatismos.length === 1 ? "automatismo" : "automatismos"}`
                  : `${filtrados.length} de ${automatismos.length} automatismos`}
              </p>
            </>
          )}
        </TarjetaContenido>
      </Tarjeta>

      <Tarjeta>
        <TarjetaContenido className="pt-4">
          <h2 className="text-xs font-semibold">Qué quiere decir cada estado</h2>
          <dl className="mt-2 grid gap-x-6 gap-y-1.5 text-[11px] sm:grid-cols-2">
            {ESTADOS.map((estado) => (
              <div key={estado} className="flex gap-2">
                <dt className="w-24 shrink-0 font-medium">{ETIQUETAS_ESTADO_AUTOMATISMO[estado]}</dt>
                <dd className="text-atenuado-contraste">{DEFINICION_ESTADO_AUTOMATISMO[estado]}</dd>
              </div>
            ))}
          </dl>
        </TarjetaContenido>
      </Tarjeta>
    </div>
  );
}
