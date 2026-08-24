"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Wand2 } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { crearDocumento, sugerirCodigoDocumento } from "@/app/(sgc)/documentos/acciones";
import { ETIQUETAS_TIPO_DOCUMENTO } from "@/lib/constantes";
import type { TipoDocumento } from "@/lib/tipos";

interface Opcion {
  id: string;
  nombre?: string;
  codigo?: string;
  nombre_completo?: string;
}

export function FormularioDocumento({
  procesos,
  normas,
  usuarios,
  usuarioActual,
}: {
  procesos: Opcion[];
  normas: Opcion[];
  usuarios: Opcion[];
  usuarioActual: string;
}) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);
  const [tipo, definirTipo] = React.useState<TipoDocumento>("procedimiento");
  const [procesoId, definirProcesoId] = React.useState("");
  const [codigo, definirCodigo] = React.useState("");

  async function sugerirCodigo() {
    const sugerido = await sugerirCodigoDocumento(tipo, procesoId || null);
    definirCodigo(sugerido);
    toast.info(`Código sugerido: ${sugerido}`);
  }

  // Al elegir tipo y proceso se propone el código controlado disponible.
  React.useEffect(() => {
    let vigente = true;
    sugerirCodigoDocumento(tipo, procesoId || null).then((sugerido) => {
      if (vigente) definirCodigo((actual) => (actual ? actual : sugerido));
    });
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, procesoId]);

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
              {Object.entries(ETIQUETAS_TIPO_DOCUMENTO).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Código controlado"
            htmlFor="codigo"
            requerido
            ayuda="Formato MP-SOP-01 o F-COM-01-02. Puede editarlo."
          >
            <div className="flex gap-2">
              <Entrada
                id="codigo"
                name="codigo"
                value={codigo}
                onChange={(evento) => definirCodigo(evento.target.value.toUpperCase())}
                placeholder="MP-SOP-01"
                required
                className="tabular"
              />
              <Boton
                type="button"
                variante="contorno"
                tamano="icono"
                onClick={sugerirCodigo}
                aria-label="Sugerir código"
                title="Sugerir el siguiente código disponible"
              >
                <Wand2 />
              </Boton>
            </div>
          </GrupoCampo>

          <GrupoCampo etiqueta="Título" htmlFor="titulo" requerido className="sm:col-span-2">
            <Entrada
              id="titulo"
              name="titulo"
              placeholder="Procedimiento de recepción de mercadería"
              required
              minLength={4}
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Descripción / objeto"
            htmlFor="descripcion"
            className="sm:col-span-2"
            ayuda="Para qué sirve el documento y a qué alcance aplica."
          >
            <AreaTexto id="descripcion" name="descripcion" rows={3} />
          </GrupoCampo>

          <GrupoCampo etiqueta="Proceso asociado" htmlFor="proceso_id">
            <Seleccion
              id="proceso_id"
              name="proceso_id"
              value={procesoId}
              onChange={(evento) => definirProcesoId(evento.target.value)}
            >
              <option value="">Sin proceso asociado</option>
              {procesos.map((proceso) => (
                <option key={proceso.id} value={proceso.id}>
                  {proceso.codigo} · {proceso.nombre}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Norma de referencia" htmlFor="norma_id">
            <Seleccion id="norma_id" name="norma_id">
              <option value="">Sin norma asociada</option>
              {normas.map((norma) => (
                <option key={norma.id} value={norma.id}>
                  {norma.codigo}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Responsable del documento"
            htmlFor="responsable_id"
            requerido
            ayuda="Quien mantiene el contenido actualizado."
          >
            <Seleccion id="responsable_id" name="responsable_id" defaultValue={usuarioActual}>
              {usuarios.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.nombre_completo}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Periodicidad de revisión (meses)"
            htmlFor="periodicidad_revision_meses"
            ayuda="Se usa para calcular la fecha de próxima revisión al aprobar."
          >
            <Entrada
              id="periodicidad_revision_meses"
              name="periodicidad_revision_meses"
              type="number"
              min={1}
              max={60}
              defaultValue={12}
            />
          </GrupoCampo>
        </div>

        {error ? <p className="mt-4 text-xs text-semaforo-critico">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <Boton type="button" variante="contorno" onClick={() => router.back()}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={enviando}>
            {enviando ? "Creando…" : "Crear documento"}
          </Boton>
        </div>
      </Tarjeta>
    </form>
  );
}
