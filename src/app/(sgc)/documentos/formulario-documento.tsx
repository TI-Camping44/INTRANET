"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Wand2 } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { SelectorDrive } from "@/components/comunes/selector-drive";
import {
  actualizarDocumento,
  crearDocumento,
  sugerirCodigoDocumento,
} from "@/app/(sgc)/documentos/acciones";
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
 *
 * El mismo formulario edita. Hasta ahora no había forma de corregir un
 * documento ya cargado: si se creaba sin proceso, o con el título mal
 * escrito, quedaba así para siempre. Al editar no se pide el archivo,
 * que se administra en su propio bloque de la ficha.
 */
export interface DocumentoInicial {
  id: string;
  codigo: string | null;
  empresa_documento_id?: string | null;
  proceso_documento_id?: string | null;
  titulo: string;
  tipo: TipoDocumento;
  categoria: string | null;
  proceso_id: string | null;
  responsable_id: string | null;
  periodicidad_revision_meses: number;
}

export function FormularioDocumento({
  usuarioActual,
  categorias,
  procesos,
  manuales,
  empresas,
  personas = [],
  inicial,
}: {
  usuarioActual: string;
  /** Las categorías ya usadas, para ofrecerlas y no duplicarlas. */
  categorias: string[];
  procesos: { id: string; nombre: string; codigo: string }[];
  /** Los manuales de proceso ya cargados. Es a lo que se ata el documento. */
  manuales: { id: string; codigo: string | null; titulo: string }[];
  /** Las dos empresas del grupo, como las devuelve `empresas_del_grupo()`. */
  empresas: { id: string; nombre: string }[];
  /** Solo hace falta al editar: en el alta el responsable es quien carga. */
  personas?: { id: string; nombre_completo: string }[];
  /** Cuando viene, el formulario edita ese documento en vez de crear uno. */
  inicial?: DocumentoInicial;
}) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);
  const [tipo, definirTipo] = React.useState<TipoDocumento>(inicial?.tipo ?? "manual");
  const [codigo, definirCodigo] = React.useState(inicial?.codigo ?? "");
  const [archivo, definirArchivo] = React.useState<File | null>(null);
  const [sinCodigo, definirSinCodigo] = React.useState(
    Boolean(inicial) && !inicial?.codigo,
  );

  // Un manual de proceso ES el proceso, así que no cuelga de otro; y si
  // todavía no hay ninguno cargado no hay de dónde elegir.
  const exigeProceso = tipo !== "manual" && manuales.length > 0;

  async function sugerirCodigo() {
    const sugerido = await sugerirCodigoDocumento(tipo, null);
    definirCodigo(sugerido);
    toast.info(`Código sugerido: ${sugerido}`);
  }

  // Al elegir el tipo se propone el código controlado disponible. Al
  // editar no: el código ya está puesto y proponerle otro sería
  // cambiárselo por haber tocado el desplegable del tipo.
  React.useEffect(() => {
    if (inicial) return;
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

    // El archivo elegido desde Drive no está en ningún campo del
    // formulario: lo bajó el navegador y vive en memoria. Se agrega acá
    // para que llegue por el mismo camino que el de la computadora y
    // pase por las mismas validaciones.
    if (archivo) datos.set("archivo", archivo);

    const resultado = inicial
      ? await actualizarDocumento(inicial.id, datos)
      : await crearDocumento(datos);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Documento creado.");
      router.push(`/documentos/${inicial?.id ?? resultado.id}`);
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

          {/* A QUE EMPRESA DEL GRUPO PERTENECE EL DOCUMENTO. No es
              `empresa_id`: esa acota el acceso por RLS y siempre vale
              Camping 44, porque la misma gente administra las dos. */}
          <GrupoCampo
            etiqueta="Empresa"
            htmlFor="empresa_documento_id"
            requerido
            ayuda="A cuál de las dos empresas del grupo corresponde."
          >
            <Seleccion
              id="empresa_documento_id"
              name="empresa_documento_id"
              required
              defaultValue={inicial?.empresa_documento_id ?? empresas[0]?.id ?? ""}
            >
              <option value="" disabled>
                Elija la empresa…
              </option>
              {empresas.map((empresa) => (
                <option key={empresa.id} value={empresa.id}>
                  {empresa.nombre}
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
                : "Escríbalo conforme al documento original."
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
          {/* EL PROCESO ES UN DOCUMENTO CARGADO, NO UNA LISTA FIJA.
              Hasta el 8 de octubre esto ofrecía los diecinueve procesos
              del mapa, estuvieran o no en Información Documentada. Lo que
              sirve es atar un instructivo, un protocolo o un formulario a
              SU manual de proceso, y ese manual es un documento más: si
              todavía no se cargó ninguno, no hay a qué atarlo y se dice. */}
          {/* OBLIGATORIO, MENOS PARA UN MANUAL DE PROCESO. Un manual
              ES el proceso: pedirle que cuelgue de otro manual sería
              circular. Tampoco se exige cuando todavía no hay ninguno
              cargado, que es el caso del primero. */}
          <GrupoCampo
            etiqueta="Proceso al que pertenece"
            htmlFor="proceso_documento_id"
            className="sm:col-span-2"
            requerido={exigeProceso}
            ayuda={
              manuales.length === 0
                ? "Todavía no hay ningún manual de proceso cargado. Cargue primero el manual y después vuelva a vincularlo."
                : exigeProceso
                  ? "El manual de proceso del que depende este documento."
                  : "Un manual de proceso es el proceso: no cuelga de otro."
            }
          >
            <Seleccion
              id="proceso_documento_id"
              name="proceso_documento_id"
              required={exigeProceso}
              defaultValue={inicial?.proceso_documento_id ?? ""}
              disabled={manuales.length === 0}
            >
              <option value="" disabled={exigeProceso}>
                Sin proceso asociado
              </option>
              {manuales.map((manual) => (
                <option key={manual.id} value={manual.id}>
                  {manual.codigo ? `${manual.codigo} · ` : ""}
                  {manual.titulo}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Categoría"
            htmlFor="categoria"
            className="sm:col-span-2"
            requerido
            ayuda="Cómo se agrupa en la carpeta. Puede escribir una nueva o elegir una ya usada."
          >
            <Entrada
              id="categoria"
              name="categoria"
              list="categorias-usadas"
              required
              defaultValue={inicial?.categoria ?? ""}
              placeholder="Políticas"
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
              defaultValue={inicial?.titulo ?? ""}
              placeholder="Manual de recepción de mercadería"
              required
              minLength={4}
            />
          </GrupoCampo>

          {inicial ? (
            <>
              <GrupoCampo
                etiqueta="Responsable"
                htmlFor="responsable_id"
                requerido
                ayuda="Quien mantiene el documento al día."
              >
                <Seleccion
                  id="responsable_id"
                  name="responsable_id"
                  required
                  defaultValue={inicial.responsable_id ?? ""}
                >
                  <option value="" disabled>
                    Elija a la persona…
                  </option>
                  {personas.map((persona) => (
                    <option key={persona.id} value={persona.id}>
                      {persona.nombre_completo}
                    </option>
                  ))}
                </Seleccion>
              </GrupoCampo>

              <GrupoCampo
                etiqueta="Periodicidad de revisión"
                htmlFor="periodicidad_revision_meses"
                requerido
                ayuda="Cada cuántos meses se revisa."
              >
                <Entrada
                  id="periodicidad_revision_meses"
                  name="periodicidad_revision_meses"
                  type="number"
                  min={1}
                  max={60}
                  required
                  defaultValue={inicial.periodicidad_revision_meses}
                />
              </GrupoCampo>
            </>
          ) : null}

          {inicial ? null : (
          <GrupoCampo
            etiqueta="Archivo del documento"
            htmlFor="archivo"
            className="sm:col-span-2"
            requerido
            ayuda={FORMATO_POR_TIPO[tipo].explicacion}
          >
            {/* Los dos orígenes terminan en el mismo lugar: el archivo
                pasa por las mismas validaciones venga de donde venga. */}
            <div className="flex flex-wrap items-center gap-2">
              <SelectorDrive
                tipoDocumento={tipo}
                onElegir={(elegido) => definirArchivo(elegido)}
                deshabilitado={enviando}
              />
              {/* `required` solo mientras no haya archivo elegido: el
                  que viene de Drive no pasa por este campo —lo bajó el
                  navegador y vive en memoria—, y dejarlo obligatorio
                  trabaría el envío sin decir por qué. */}
              <input
                id="archivo"
                name="archivo"
                type="file"
                required={!archivo}
                accept={extensionesAdmitidas(tipo)}
                onChange={elegirArchivo}
                className="min-w-0 flex-1 cursor-pointer rounded-md border border-borde
                           bg-fondo text-xs text-texto file:mr-3 file:cursor-pointer
                           file:border-0 file:bg-acento file:px-3 file:py-2 file:text-xs
                           file:font-medium file:text-texto"
              />
            </div>
            {archivo ? (
              <p className="mt-1.5 text-[11px] text-atenuado-contraste">
                Se va a subir <span className="font-medium text-texto">{archivo.name}</span>.
              </p>
            ) : null}
          </GrupoCampo>
          )}

          {inicial ? null : (
            <input type="hidden" name="responsable_id" value={usuarioActual} />
          )}
        </div>

        {error ? <p className="mt-4 text-xs text-semaforo-critico">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <Boton type="button" variante="contorno" onClick={() => router.back()}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={enviando}>
            {inicial ? "Guardar cambios" : "Crear documento"}
          </Boton>
        </div>
      </Tarjeta>
    </form>
  );
}
