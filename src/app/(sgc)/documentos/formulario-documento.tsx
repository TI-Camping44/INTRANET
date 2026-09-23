"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Wand2 } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { crearDocumento, sugerirCodigoDocumento } from "@/app/(sgc)/documentos/acciones";
import { ETIQUETAS_TIPO_DOCUMENTO, TIPOS_DOCUMENTO_VIGENTES } from "@/lib/constantes";
import { extensionesAdmitidas, FORMATO_POR_TIPO, motivoDeRechazo } from "@/lib/adjuntos";
import type { TipoDocumento } from "@/lib/tipos";

/**
 * Alta de un documento: cuatro campos y el archivo.
 *
 * Calidad pidió sacar la descripción, el proceso asociado, la norma de
 * referencia, el responsable y la periodicidad de revisión. Los tres
 * últimos tienen valor por defecto —quien carga queda de responsable, la
 * revisión a doce meses— y se corrigen en la ficha cuando hace falta.
 * Un alta de nueve campos es un alta que no se hace.
 *
 * El archivo va acá y no después. Un documento sin archivo es un código
 * en una tabla: el listado lo muestra y al tocarlo no hay nada que abrir.
 */
export function FormularioDocumento({
  usuarioActual,
  categorias,
}: {
  usuarioActual: string;
  /** Las categorías ya usadas, para ofrecerlas y no duplicarlas. */
  categorias: string[];
}) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);
  const [tipo, definirTipo] = React.useState<TipoDocumento>("manual");
  const [codigo, definirCodigo] = React.useState("");
  const [archivo, definirArchivo] = React.useState<File | null>(null);
  const [sinCodigo, definirSinCodigo] = React.useState(false);

  async function sugerirCodigo() {
    const sugerido = await sugerirCodigoDocumento(tipo, null);
    definirCodigo(sugerido);
    toast.info(`Código sugerido: ${sugerido}`);
  }

  // Al elegir el tipo se propone el código controlado disponible.
  React.useEffect(() => {
    let vigente = true;
    sugerirCodigoDocumento(tipo, null).then((sugerido) => {
      if (vigente) definirCodigo((actual) => (actual ? actual : sugerido));
    });
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo]);

  function elegirArchivo(evento: React.ChangeEvent<HTMLInputElement>) {
    const elegido = evento.target.files?.[0] ?? null;
    if (!elegido) {
      definirArchivo(null);
      return;
    }

    // Se avisa acá para no hacerle esperar la subida de un archivo que la
    // acción va a rechazar igual. El control que vale es el del servidor.
    const motivo = motivoDeRechazo(tipo, elegido.name, elegido.size);
    if (motivo) {
      toast.error(motivo);
      evento.target.value = "";
      definirArchivo(null);
      return;
    }

    definirArchivo(elegido);
  }

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirEnviando(true);
    definirError(null);

    const datos = new FormData(evento.currentTarget);
    const resultado = await crearDocumento(datos);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Documento creado.");
      router.push(`/documentos/${resultado.id}`);
      router.refresh();
    } else {
      definirError(resultado.error);
      toast.error(resultado.error);
      definirEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar}>
      <Tarjeta className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <GrupoCampo
            etiqueta="Tipo de documento"
            htmlFor="tipo"
            requerido
            ayuda="Define el prefijo del código controlado."
          >
            <Seleccion
              id="tipo"
              name="tipo"
              value={tipo}
              onChange={(evento) => definirTipo(evento.target.value as TipoDocumento)}
            >
              {TIPOS_DOCUMENTO_VIGENTES.map((valor) => (
                <option key={valor} value={valor}>
                  {ETIQUETAS_TIPO_DOCUMENTO[valor]}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          {/* No todo documento lleva código controlado: los de contexto
              y las políticas no lo tienen. Antes había que dejarlo en
              blanco, y un campo obligatorio vacío se lee como un olvido.
              Ahora se dice. */}
          <GrupoCampo
            etiqueta="Código controlado"
            htmlFor="codigo"
            requerido={!sinCodigo}
            ayuda={
              sinCodigo
                ? "Este documento va sin código controlado."
                : "Formato MP-SOP-01 o F-COM-01-02. Puede editarlo."
            }
          >
            <div className="flex gap-2">
              <Entrada
                id="codigo"
                name="codigo"
                value={sinCodigo ? "" : codigo}
                onChange={(evento) => definirCodigo(evento.target.value.toUpperCase())}
                placeholder={sinCodigo ? "No aplica" : "MP-SOP-01"}
                required={!sinCodigo}
                disabled={sinCodigo}
                className="tabular"
              />
              <Boton
                type="button"
                variante="contorno"
                tamano="icono"
                onClick={sugerirCodigo}
                disabled={sinCodigo}
                aria-label="Sugerir código"
                title="Sugerir el siguiente código disponible"
              >
                <Wand2 />
              </Boton>
            </div>
            <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-[11px]">
              <input
                type="checkbox"
                name="sin_codigo"
                checked={sinCodigo}
                onChange={(evento) => definirSinCodigo(evento.target.checked)}
                className="size-3.5 accent-primario"
              />
              No aplica
            </label>
          </GrupoCampo>

          {/* Libre a propósito: la agrupación la decide Calidad según
              le sirva al auditor, y una lista cerrada obligaría a pedirle
              a TI cada categoría nueva. Las ya usadas se ofrecen para no
              terminar con «Compras» y «compras» como dos carpetas. */}
          <GrupoCampo
            etiqueta="Categoría"
            htmlFor="categoria"
            className="sm:col-span-2"
            ayuda="Cómo se agrupa en la carpeta. Puede escribir una nueva o elegir una ya usada."
          >
            <Entrada
              id="categoria"
              name="categoria"
              list="categorias-usadas"
              placeholder="Sin categoría"
            />
            <datalist id="categorias-usadas">
              {categorias.map((nombre) => (
                <option key={nombre} value={nombre} />
              ))}
            </datalist>
          </GrupoCampo>

          <GrupoCampo etiqueta="Título" htmlFor="titulo" requerido className="sm:col-span-2">
            <Entrada
              id="titulo"
              name="titulo"
              placeholder="Manual de recepción de mercadería"
              required
              minLength={4}
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Archivo del documento"
            htmlFor="archivo"
            className="sm:col-span-2"
            ayuda={FORMATO_POR_TIPO[tipo].explicacion}
          >
            <input
              id="archivo"
              name="archivo"
              type="file"
              accept={extensionesAdmitidas(tipo)}
              onChange={elegirArchivo}
              className="block w-full cursor-pointer rounded-md border border-borde bg-fondo
                         text-xs text-texto file:mr-3 file:cursor-pointer file:border-0
                         file:bg-acento file:px-3 file:py-2 file:text-xs file:font-medium
                         file:text-texto"
            />
            {archivo ? (
              <p className="mt-1.5 text-[11px] text-atenuado-contraste">
                Se va a subir <span className="font-medium text-texto">{archivo.name}</span>.
              </p>
            ) : null}
          </GrupoCampo>

          <input type="hidden" name="responsable_id" value={usuarioActual} />
        </div>

        {error ? <p className="mt-4 text-xs text-semaforo-critico">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <Boton type="button" variante="contorno" onClick={() => router.back()}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={enviando}>
            Crear documento
          </Boton>
        </div>
      </Tarjeta>
    </form>
  );
}
