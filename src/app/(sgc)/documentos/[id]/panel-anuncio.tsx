"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Megaphone } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo } from "@/components/ui/campo";
import { anunciarDocumento } from "@/app/(sgc)/documentos/acciones";
import { redactarAnuncioDeDocumento } from "@/lib/publicaciones";
import { formatearFechaHora, hoyEnAsuncion } from "@/lib/formato";
import type { EstadoDocumento, TipoDocumento } from "@/lib/tipos";

export interface AnuncioPrevio {
  id: string;
  titulo: string;
  fecha_publicacion: string | null;
}

/**
 * Anunciar el documento en el muro del inicio.
 *
 * Es distinto de la difusión, que está más arriba en esta misma ficha: la
 * difusión notifica a una lista de personas, el anuncio queda a la vista
 * de todos al entrar. Un procedimiento nuevo suele necesitar las dos
 * cosas, y por eso no se reemplazan.
 *
 * El texto llega redactado y se edita. Proponer un borrador y dejar
 * cambiarlo consigue lo que un campo vacío no: que el anuncio se escriba.
 */
export function PanelAnuncio({
  documentoId,
  documento,
  anunciosPrevios,
  puedeGestionar,
}: {
  documentoId: string;
  documento: {
    codigo: string | null;
    titulo: string;
    tipo: TipoDocumento;
    estado: EstadoDocumento;
    version_actual: number;
    fecha_aprobacion: string | null;
  };
  anunciosPrevios: AnuncioPrevio[];
  puedeGestionar: boolean;
}) {
  const router = useRouter();
  const borrador = React.useMemo(() => redactarAnuncioDeDocumento(documento), [documento]);

  const [abierto, definirAbierto] = React.useState(false);
  const [titulo, definirTitulo] = React.useState(borrador.titulo);
  const [cuerpo, definirCuerpo] = React.useState(borrador.cuerpo);
  const [fijada, definirFijada] = React.useState(false);
  const [vencimiento, definirVencimiento] = React.useState("");
  const [publicando, definirPublicando] = React.useState(false);

  async function publicar() {
    definirPublicando(true);

    const datos = new FormData();
    datos.set("titulo", titulo);
    datos.set("cuerpo", cuerpo);
    if (fijada) datos.set("fijada", "si");
    if (vencimiento) datos.set("fecha_vencimiento", vencimiento);

    const resultado = await anunciarDocumento(documentoId, datos);
    definirPublicando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Anuncio publicado.");
      definirAbierto(false);
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <div className="space-y-3">
      {anunciosPrevios.length > 0 ? (
        <div className="space-y-1.5">
          {anunciosPrevios.map((anuncio) => (
            <p key={anuncio.id} className="text-[11px] text-atenuado-contraste">
              Anunciado el{" "}
              {anuncio.fecha_publicacion
                ? formatearFechaHora(anuncio.fecha_publicacion)
                : "—"}
              .{" "}
              <Link href="/inicio" className="font-medium text-primario hover:underline">
                Ver en el inicio
              </Link>
            </p>
          ))}
        </div>
      ) : null}

      {documento.estado !== "vigente" ? (
        <p className="text-xs leading-relaxed text-atenuado-contraste">
          Se anuncia cuando el documento está vigente. Anunciar un borrador es pedirle a la
          gente que aplique algo que todavía puede cambiar.
        </p>
      ) : !puedeGestionar ? (
        <p className="text-xs leading-relaxed text-atenuado-contraste">
          El anuncio lo publica el responsable del documento o Calidad.
        </p>
      ) : !abierto ? (
        <>
          <p className="text-xs leading-relaxed text-atenuado-contraste">
            Publica este documento en el muro del inicio, donde lo ven las cuarenta y nueve
            personas al entrar.
            {anunciosPrevios.length > 0
              ? " Puede volver a anunciarlo si aprobó una versión nueva."
              : ""}
          </p>
          <Boton variante="contorno" tamano="pequeno" onClick={() => definirAbierto(true)}>
            <Megaphone /> {anunciosPrevios.length > 0 ? "Anunciar de nuevo" : "Anunciar en Inicio"}
          </Boton>
        </>
      ) : (
        <>
          <GrupoCampo etiqueta="Título del anuncio" htmlFor="titulo-anuncio" requerido>
            <Entrada
              id="titulo-anuncio"
              value={titulo}
              minLength={5}
              onChange={(evento) => definirTitulo(evento.target.value)}
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Texto"
            htmlFor="cuerpo-anuncio"
            requerido
            ayuda="Viene redactado. Cámbielo por lo que quiera decir."
          >
            <AreaTexto
              id="cuerpo-anuncio"
              rows={6}
              value={cuerpo}
              minLength={10}
              onChange={(evento) => definirCuerpo(evento.target.value)}
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Deja de verse el"
            htmlFor="vencimiento-anuncio"
            ayuda="Opcional. El anuncio sale del muro sin borrarse."
          >
            <Entrada
              id="vencimiento-anuncio"
              type="date"
              min={hoyEnAsuncion()}
              value={vencimiento}
              onChange={(evento) => definirVencimiento(evento.target.value)}
            />
          </GrupoCampo>

          <label className="flex items-start gap-2 text-xs leading-relaxed">
            <input
              type="checkbox"
              className="mt-0.5 size-3.5 shrink-0 accent-[hsl(var(--primario))]"
              checked={fijada}
              onChange={(evento) => definirFijada(evento.target.checked)}
            />
            <span>
              Fijar arriba de todo. Solo puede haber una publicación fijada: si fija esta, se
              suelta la anterior.
            </span>
          </label>

          <div className="flex justify-end gap-2">
            <Boton
              variante="contorno"
              tamano="pequeno"
              onClick={() => {
                definirAbierto(false);
                definirTitulo(borrador.titulo);
                definirCuerpo(borrador.cuerpo);
              }}
            >
              Cancelar
            </Boton>
            <Boton
              tamano="pequeno"
              onClick={publicar}
              cargando={publicando}
              disabled={titulo.trim().length < 5 || cuerpo.trim().length < 10}
            >
              <Megaphone /> Publicar
            </Boton>
          </div>
        </>
      )}
    </div>
  );
}
