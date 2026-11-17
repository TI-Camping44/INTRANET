import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { ArrowLeft } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { BotonImprimirEtiquetas } from "@/app/(sgc)/activos/etiquetas/boton-imprimir-etiquetas";
import { requerirModulo } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import {
  FORMATOS_ETIQUETA,
  MAXIMO_ETIQUETAS_POR_TANDA,
  esFormatoEtiqueta,
  llevaEtiqueta,
  type FormatoEtiqueta,
} from "@/lib/etiquetas-activos";
import { ETIQUETAS_CLASE_ACTIVO } from "@/lib/constantes";
import { cn } from "@/lib/utilidades";
import type { ClaseActivo } from "@/lib/tipos";

export const metadata: Metadata = { title: "Etiquetas de activos" };
export const dynamic = "force-dynamic";

interface ActivoEtiqueta {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string | null;
  numero_serie: string | null;
}

/**
 * Etiquetas imprimibles de los activos, con su código y un QR que abre la
 * ficha en la Intranet.
 *
 * NACE DE LA NC-2026-015: las etiquetas no existían o no coincidían con
 * el registro. Que la etiqueta salga del registro es lo que hace que no
 * se puedan separar: el código impreso es el de la Intranet, y si el
 * registro cambia, se reimprime.
 *
 * Qué se imprime sale de la dirección:
 *   `?ids=a,b,c`         esos activos (desde la ficha, uno solo);
 *   `?clase=tecnologico`  y los demás filtros del listado, todo lo filtrado.
 * Los intangibles —licencias, certificados, dominios— se saltean: no hay
 * dónde pegarles nada.
 */
export default async function PaginaEtiquetas({
  searchParams,
}: {
  searchParams: {
    ids?: string;
    clase?: string;
    categoria?: string;
    q?: string;
    formato?: string;
  };
}) {
  await requerirModulo("activos");
  const supabase = crearClienteServidor();

  const formato: FormatoEtiqueta = esFormatoEtiqueta(searchParams.formato)
    ? searchParams.formato
    : "a4";
  const definicion = FORMATOS_ETIQUETA[formato];

  const ids = (searchParams.ids ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id));

  let consulta = supabase
    .from("activos")
    .select("id, codigo, nombre, categoria, numero_serie")
    .neq("estado", "dado_de_baja")
    .order("codigo")
    .limit(MAXIMO_ETIQUETAS_POR_TANDA + 50);

  if (ids.length > 0) {
    consulta = consulta.in("id", ids);
  } else {
    if (searchParams.clase === "tecnologico" || searchParams.clase === "edilicio") {
      consulta = consulta.eq("clase", searchParams.clase);
    }
    if (searchParams.categoria) consulta = consulta.eq("categoria", searchParams.categoria);
    if (searchParams.q) {
      const texto = `%${searchParams.q}%`;
      consulta = consulta.or(`codigo.ilike.${texto},nombre.ilike.${texto}`);
    }
  }

  const { data } = await consulta;
  const todos = ((data ?? []) as ActivoEtiqueta[]).filter((activo) => llevaEtiqueta(activo.categoria));
  const activos = todos.slice(0, MAXIMO_ETIQUETAS_POR_TANDA);
  const recortados = todos.length - activos.length;

  // La dirección del QR sale del sitio publicado y, si no está
  // declarado, de la petición: así funciona igual en una vista previa.
  const encabezados = headers();
  const origen =
    process.env.NEXT_PUBLIC_SITIO_URL?.replace(/\/$/, "") ??
    `${encabezados.get("x-forwarded-proto") ?? "https"}://${encabezados.get("host")}`;

  const etiquetas = await Promise.all(
    activos.map(async (activo) => ({
      ...activo,
      qr: await QRCode.toString(`${origen}/activos/${activo.id}`, {
        type: "svg",
        margin: 0,
        errorCorrectionLevel: "M",
      }),
    })),
  );

  const parametrosSinFormato = new URLSearchParams(
    Object.entries(searchParams).filter(
      (entrada): entrada is [string, string] => entrada[0] !== "formato" && Boolean(entrada[1]),
    ),
  );
  const enlaceFormato = (valor: FormatoEtiqueta) => {
    const parametros = new URLSearchParams(parametrosSinFormato);
    parametros.set("formato", valor);
    return `/activos/etiquetas?${parametros.toString()}`;
  };

  const volver =
    ids.length === 1
      ? `/activos/${ids[0]}`
      : `/activos${parametrosSinFormato.toString() ? `?${parametrosSinFormato.toString()}` : ""}`;

  const claseMirada =
    searchParams.clase === "tecnologico" || searchParams.clase === "edilicio"
      ? ETIQUETAS_CLASE_ACTIVO[searchParams.clase as ClaseActivo]
      : null;

  return (
    <div>
      {/* El `@page` del formato. Va después del de `globals.css`, así que
          gana: la hoja A4 de la carta no sirve para una cinta de 62 mm. */}
      <style>{`@media print { @page { ${definicion.pagina} } }`}</style>

      <div className="no-imprimir mb-5 space-y-3">
        <Boton variante="fantasma" tamano="pequeno" comoHijo className="-ml-2">
          <Link href={volver}>
            <ArrowLeft aria-hidden /> Volver
          </Link>
        </Boton>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Etiquetas de activos</h1>
            <p className="mt-0.5 text-xs text-atenuado-contraste">
              {activos.length} {activos.length === 1 ? "etiqueta" : "etiquetas"}
              {claseMirada ? ` · activos ${claseMirada.toLowerCase()}s` : ""}. El código es el
              de la Intranet y el QR abre la ficha del activo. Las licencias, los certificados
              y los dominios no llevan etiqueta.
            </p>
            {recortados > 0 ? (
              <p className="mt-1 text-xs text-semaforo-alto">
                Se muestran las primeras {MAXIMO_ETIQUETAS_POR_TANDA}; quedan {recortados}.
                Filtre el listado por categoría para imprimirlas en otra tanda.
              </p>
            ) : null}
          </div>
          <BotonImprimirEtiquetas cantidad={activos.length} />
        </div>

        <nav aria-label="Formato de la etiqueta" className="flex flex-wrap gap-2">
          {(Object.keys(FORMATOS_ETIQUETA) as FormatoEtiqueta[]).map((valor) => (
            <Link
              key={valor}
              href={enlaceFormato(valor)}
              aria-current={valor === formato ? "page" : undefined}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs transition-colors",
                valor === formato
                  ? "border-primario bg-primario/10 font-medium text-primario"
                  : "border-borde hover:bg-acento",
              )}
            >
              {FORMATOS_ETIQUETA[valor].nombre}
              <span className="ml-1.5 text-atenuado-contraste">
                {FORMATOS_ETIQUETA[valor].descripcion}
              </span>
            </Link>
          ))}
        </nav>
        <p className="text-[11px] text-atenuado-contraste">
          Al imprimir, elija «Tamaño real» o escala 100 % y desactive los encabezados y pies de
          página del navegador: si no, las etiquetas no caen sobre las de la hoja.
        </p>
      </div>

      {/* Las etiquetas. Negro sobre blanco también en modo oscuro: es lo
          que se pega en el equipo. */}
      <div
        className={cn(
          "bg-white text-black",
          formato === "a4"
            ? "grid w-[210mm] grid-cols-[repeat(3,70mm)] print:w-auto"
            : "flex flex-wrap gap-3 print:block",
        )}
      >
        {etiquetas.map((etiqueta) => (
          <div
            key={etiqueta.id}
            style={{ width: `${definicion.ancho}mm`, height: `${definicion.alto}mm` }}
            className={cn(
              "flex items-center gap-[2.5mm] overflow-hidden px-[3mm]",
              "outline outline-1 outline-dashed outline-neutral-300 print:outline-none",
              formato === "cinta" ? "break-after-page" : "break-inside-avoid",
            )}
          >
            <div
              aria-hidden
              className="shrink-0 [&>svg]:h-full [&>svg]:w-full"
              style={{
                width: `${definicion.alto - 8}mm`,
                height: `${definicion.alto - 8}mm`,
              }}
              dangerouslySetInnerHTML={{ __html: etiqueta.qr }}
            />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-[6.5pt] font-semibold uppercase tracking-wide">
                Camping 44 S.A.
              </p>
              <p className="mt-[0.8mm] font-mono text-[10.5pt] font-bold tabular">
                {etiqueta.codigo}
              </p>
              <p className="mt-[0.8mm] line-clamp-2 text-[7pt]">{etiqueta.nombre}</p>
              {etiqueta.numero_serie ? (
                <p className="mt-[0.5mm] truncate text-[6pt]">S/N {etiqueta.numero_serie}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
