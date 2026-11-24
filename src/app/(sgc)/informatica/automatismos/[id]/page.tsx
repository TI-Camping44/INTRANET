import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { HistorialBitacora } from "@/components/comunes/historial-bitacora";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import {
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaTitulo,
} from "@/components/ui/tarjeta";
import { obtenerPermisos, requerirModulo } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatearFechaHora } from "@/lib/formato";
import {
  DEFINICION_ESTADO_AUTOMATISMO,
  ETIQUETAS_ESTADO_AUTOMATISMO,
  VARIANTE_ESTADO_AUTOMATISMO,
  codigoParaPegar,
  describirFrecuencia,
  describirHace,
  estadoDelAutomatismo,
} from "@/lib/automatismos-ti";
import { eliminarAutomatismo } from "@/app/(sgc)/informatica/automatismos/acciones";
import { BotonCopiar, BotonEliminar } from "@/app/(sgc)/informatica/boton-eliminar";

export const metadata: Metadata = { title: "Automatismo de TI" };
export const dynamic = "force-dynamic";

interface Automatismo {
  id: string;
  clave: string;
  nombre: string;
  donde_vive: string | null;
  descripcion: string | null;
  frecuencia_horas: number | null;
  vigente: boolean;
  responsable_id: string | null;
  ultimo_latido_en: string | null;
  ultimo_resultado: string | null;
  ultimo_mensaje: string | null;
  errores_7_dias: number;
  latidos_7_dias: number;
}

interface Latido {
  id: number;
  en: string;
  resultado: string;
  mensaje: string | null;
}

/** Ficha de un automatismo: su estado, sus últimos avisos y el código para conectarlo. */
export default async function PaginaAutomatismo({ params }: { params: { id: string } }) {
  await requerirModulo("informatica");
  const permisos = await obtenerPermisos();
  const puedeEditar = permisos.informatica.editar;
  const supabase = crearClienteServidor();

  const { data } = await supabase
    .from("vista_automatismos_ti")
    .select(
      "id, clave, nombre, donde_vive, descripcion, frecuencia_horas, vigente, responsable_id, " +
        "ultimo_latido_en, ultimo_resultado, ultimo_mensaje, errores_7_dias, latidos_7_dias",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!data) notFound();
  const automatismo = data as unknown as Automatismo;

  const [{ data: datosLatidos }, { data: responsable }] = await Promise.all([
    supabase
      .from("automatismo_latidos")
      .select("id, en, resultado, mensaje")
      .eq("automatismo_id", automatismo.id)
      .order("en", { ascending: false })
      .limit(50),
    automatismo.responsable_id
      ? supabase
          .from("usuarios")
          .select("nombre_completo")
          .eq("id", automatismo.responsable_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const latidos = (datosLatidos ?? []) as Latido[];

  const ahora = new Date();
  const estado = estadoDelAutomatismo(automatismo, ahora);
  const codigo = codigoParaPegar(
    automatismo.clave,
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  );

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link
          href="/informatica/automatismos"
          className="inline-flex items-center gap-1 text-xs text-atenuado-contraste hover:text-texto"
        >
          <ArrowLeft className="size-3" aria-hidden />
          Automatismos
        </Link>
      </div>

      <EncabezadoPagina
        titulo={automatismo.nombre}
        descripcion={automatismo.descripcion ?? undefined}
        acciones={
          puedeEditar ? (
            <div className="flex flex-wrap gap-2">
              <Boton comoHijo variante="contorno" tamano="pequeno">
                <Link href={`/informatica/automatismos/${automatismo.id}/editar`}>
                  <Pencil aria-hidden />
                  Editar
                </Link>
              </Boton>
              <BotonEliminar
                accion={eliminarAutomatismo.bind(null, automatismo.id)}
                aviso={
                  `¿Eliminar «${automatismo.nombre}» con todo su historial de avisos?\n\n` +
                  "Úselo para un script que se retiró. Para dejar de controlarlo un tiempo, " +
                  "edítelo y márquelo «Pausado». Si el script sigue avisando, se vuelve a crear solo."
                }
                volverA="/informatica/automatismos"
              />
            </div>
          ) : null
        }
      />

      <Tarjeta>
        <TarjetaContenido className="pt-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-3">
            <div>
              <dt className="text-atenuado-contraste">Estado</dt>
              <dd className="mt-0.5">
                <Insignia variante={VARIANTE_ESTADO_AUTOMATISMO[estado]}>
                  {ETIQUETAS_ESTADO_AUTOMATISMO[estado]}
                </Insignia>
                <span className="mt-1 block text-[11px] text-atenuado-contraste">
                  {DEFINICION_ESTADO_AUTOMATISMO[estado]}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-atenuado-contraste">Último aviso</dt>
              <dd className="mt-0.5 font-medium">
                {describirHace(automatismo.ultimo_latido_en, ahora)}
                {automatismo.ultimo_latido_en ? (
                  <span className="tabular block text-[11px] font-normal text-atenuado-contraste">
                    {formatearFechaHora(automatismo.ultimo_latido_en)}
                  </span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-atenuado-contraste">Frecuencia esperada</dt>
              <dd className="mt-0.5 font-medium">{describirFrecuencia(automatismo.frecuencia_horas)}</dd>
            </div>
            <div>
              <dt className="text-atenuado-contraste">Últimos 7 días</dt>
              <dd className="tabular mt-0.5 font-medium">
                {automatismo.latidos_7_dias} avisos · {automatismo.errores_7_dias} con error
              </dd>
            </div>
            <div>
              <dt className="text-atenuado-contraste">Responsable</dt>
              <dd className="mt-0.5 font-medium">
                {(responsable as { nombre_completo: string } | null)?.nombre_completo ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-atenuado-contraste">Clave</dt>
              <dd className="mt-0.5 font-mono">{automatismo.clave}</dd>
            </div>
            <div className="col-span-2 sm:col-span-3">
              <dt className="text-atenuado-contraste">Dónde vive</dt>
              <dd className="mt-0.5 font-medium">{automatismo.donde_vive ?? "—"}</dd>
            </div>
          </dl>
        </TarjetaContenido>
      </Tarjeta>

      <Tarjeta>
        <TarjetaCabecera>
          <TarjetaTitulo>Últimos avisos</TarjetaTitulo>
        </TarjetaCabecera>
        <TarjetaContenido>
          {latidos.length === 0 ? (
            <p className="text-xs text-atenuado-contraste">
              Todavía no avisó nunca. Pegue el código de abajo en el proyecto del script.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-borde">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-borde bg-atenuado/50 text-left">
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Fecha y hora
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Resultado
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Mensaje
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {latidos.map((latido) => (
                    <tr key={latido.id} className="border-b border-borde last:border-b-0">
                      <td className="tabular whitespace-nowrap px-3 py-1.5">
                        {formatearFechaHora(latido.en)}
                      </td>
                      <td className="px-3 py-1.5">
                        <Insignia variante={latido.resultado === "error" ? "peligro" : "exito"}>
                          {latido.resultado === "error" ? "Error" : "Bien"}
                        </Insignia>
                      </td>
                      <td className="px-3 py-1.5 text-atenuado-contraste">{latido.mensaje ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TarjetaContenido>
      </Tarjeta>

      {puedeEditar ? (
        <Tarjeta>
          <TarjetaCabecera>
            <div className="flex items-center justify-between gap-2">
              <TarjetaTitulo>Cómo se conecta</TarjetaTitulo>
              <BotonCopiar texto={codigo} etiqueta="Copiar código" />
            </div>
          </TarjetaCabecera>
          <TarjetaContenido className="space-y-3 text-xs">
            <ol className="list-decimal space-y-1 pl-5">
              <li>Pegue este código en un archivo nuevo del proyecto de Apps Script.</li>
              <li>
                En Configuración del proyecto → Propiedades de la secuencia de comandos, agregue{" "}
                <code className="font-mono">INTRANET_SECRETO_AUTOMATISMOS</code> con el secreto de los
                automatismos, el que guarda TI.
              </li>
              <li>
                Al final de la función del activador llame a{" "}
                <code className="font-mono">avisarALaIntranet_(&apos;{automatismo.clave}&apos;)</code>, y
                en el <code className="font-mono">catch</code> con{" "}
                <code className="font-mono">&apos;error&apos;</code> y el mensaje.
              </li>
            </ol>
            <pre className="max-h-80 overflow-auto rounded-md border border-borde bg-atenuado/40 p-3 font-mono text-[11px] leading-relaxed">
              {codigo}
            </pre>
          </TarjetaContenido>
        </Tarjeta>
      ) : null}

      <HistorialBitacora tablas={["automatismos_ti"]} registroId={automatismo.id} />
    </div>
  );
}
