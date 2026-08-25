import type { Metadata } from "next";
import Link from "next/link";
import { Cake, PartyPopper } from "lucide-react";
import { Avatar, AvatarImagen, AvatarRespaldo } from "@/components/ui/avatar";
import {
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaTitulo,
} from "@/components/ui/tarjeta";
import { obtenerResumenPanel } from "@/app/(sgc)/panel/datos";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { hoyEnAsuncion } from "@/lib/formato";
import { PUBLICACIONES_EN_INICIO, estaVigente } from "@/lib/publicaciones";
import { iniciales } from "@/lib/utilidades";
import { MuroPublicaciones, type Publicacion } from "./muro-publicaciones";

export const metadata: Metadata = { title: "Inicio" };
export const dynamic = "force-dynamic";

interface Efemeride {
  id: string;
  nombre_completo: string;
  url_avatar: string | null;
  puesto: string | null;
  motivo: string;
  mes: number;
  dia: number;
  anos: number | null;
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export default async function PaginaInicio() {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const [{ data: publicaciones }, { data: efemerides }, { data: personas }, { data: procesos }, resumen] =
    await Promise.all([
      supabase
        .from("publicaciones")
        .select(
          "id, tipo, titulo, cuerpo, resumen, estado, fijada, fecha_publicacion," +
            " fecha_vencimiento, autor:creado_por (nombre_completo, url_avatar)," +
            " referido:usuario_referido_id (nombre_completo, url_avatar)," +
            " procesos:proceso_id (nombre)",
        )
        .order("fijada", { ascending: false })
        .order("fecha_publicacion", { ascending: false, nullsFirst: false })
        .limit(60),
      supabase.from("vista_efemerides").select("*"),
      supabase
        .from("usuarios")
        .select("id, nombre_completo")
        .eq("activo", true)
        .order("nombre_completo"),
      supabase.from("procesos").select("id, nombre").order("nombre"),
      obtenerResumenPanel(usuario),
    ]);

  const hoy = hoyEnAsuncion();
  const mesActual = Number(hoy.slice(5, 7));
  const diaActual = Number(hoy.slice(8, 10));

  // El muro muestra lo publicado y vigente. El borrador propio y lo
  // archivado se ven, pero mas abajo: RLS ya filtro lo que no corresponde.
  const listaPublicaciones = ((publicaciones ?? []) as unknown as Publicacion[])
    .filter(
      (publicacion) =>
        publicacion.estado !== "publicada" ||
        estaVigente(publicacion.fecha_vencimiento, hoy),
    )
    .slice(0, PUBLICACIONES_EN_INICIO);

  // Del mes en curso, y de hoy en adelante: un cumpleanos de hace dos
  // semanas ya no sirve para saludar.
  const delMes = ((efemerides ?? []) as unknown as Efemeride[])
    .filter((efemeride) => efemeride.mes === mesActual && efemeride.dia >= diaActual)
    .sort((a, b) => a.dia - b.dia)
    .slice(0, 8);

  const gestiona = puedeGestionar(usuario);
  const primerNombre = usuario.nombre_completo.split(" ")[0];

  return (
    <>
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">Hola, {primerNombre}</h1>
        <p className="mt-1 text-sm text-atenuado-contraste">
          Lo que pasa en Camping 44, en un solo lugar.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <MuroPublicaciones
            publicaciones={listaPublicaciones}
            personas={(personas ?? []) as { id: string; nombre_completo: string }[]}
            procesos={(procesos ?? []) as { id: string; nombre: string }[]}
            puedeGestionar={gestiona}
          />
        </div>

        <div className="min-w-0 space-y-4">
          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Este mes</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              {delMes.length === 0 ? (
                <p className="text-xs text-atenuado-contraste">
                  No quedan cumpleaños ni aniversarios en {MESES[mesActual - 1]}.
                </p>
              ) : (
                <ul className="space-y-3">
                  {delMes.map((efemeride) => (
                    <li
                      key={`${efemeride.id}-${efemeride.motivo}`}
                      className="flex items-center gap-2.5"
                    >
                      <Avatar className="size-8 shrink-0">
                        {efemeride.url_avatar ? (
                          <AvatarImagen
                            src={efemeride.url_avatar}
                            alt={efemeride.nombre_completo}
                          />
                        ) : null}
                        <AvatarRespaldo className="text-[10px]">
                          {iniciales(efemeride.nombre_completo)}
                        </AvatarRespaldo>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">
                          {efemeride.nombre_completo}
                        </p>
                        <p className="flex items-center gap-1 text-[11px] text-atenuado-contraste">
                          {efemeride.motivo === "cumpleanos" ? (
                            <>
                              <Cake className="size-3" />
                              Cumple el {efemeride.dia}
                            </>
                          ) : (
                            <>
                              <PartyPopper className="size-3" />
                              {efemeride.anos} año{efemeride.anos === 1 ? "" : "s"} el{" "}
                              {efemeride.dia}
                            </>
                          )}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </TarjetaContenido>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Calidad hoy</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              <dl className="space-y-2 text-xs">
                <Cifra
                  etiqueta="No conformidades abiertas"
                  valor={resumen.ncAbiertas}
                  enlace="/no-conformidades"
                  alerta={resumen.ncVencidas > 0}
                  nota={resumen.ncVencidas > 0 ? `${resumen.ncVencidas} vencidas` : undefined}
                />
                <Cifra
                  etiqueta="Riesgos altos y críticos"
                  valor={resumen.riesgosAltos}
                  enlace="/riesgos"
                />
                <Cifra
                  etiqueta="Documentos por revisar"
                  valor={resumen.documentosPorRevisar}
                  enlace="/documentos"
                />
                <Cifra
                  etiqueta="Indicadores fuera de meta"
                  valor={resumen.indicadoresFueraDeMeta}
                  enlace="/indicadores"
                />
              </dl>
              <p className="mt-3 border-t border-borde pt-3 text-[11px] leading-relaxed text-atenuado-contraste">
                El detalle completo está en{" "}
                <Link href="/panel" className="text-primario hover:underline">
                  el panel de calidad
                </Link>
                .
              </p>
            </TarjetaContenido>
          </Tarjeta>
        </div>
      </div>
    </>
  );
}

function Cifra({
  etiqueta,
  valor,
  enlace,
  alerta,
  nota,
}: {
  etiqueta: string;
  valor: number;
  enlace: string;
  alerta?: boolean;
  nota?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-atenuado-contraste">
        <Link href={enlace} className="hover:text-primario hover:underline">
          {etiqueta}
        </Link>
        {nota ? <span className="ml-1 text-semaforo-critico">· {nota}</span> : null}
      </dt>
      <dd
        className={
          "shrink-0 font-semibold tabular " + (alerta ? "text-semaforo-critico" : "text-texto")
        }
      >
        {valor}
      </dd>
    </div>
  );
}
