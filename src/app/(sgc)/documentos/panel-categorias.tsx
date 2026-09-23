"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FolderPlus, Search } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Entrada, GrupoCampo } from "@/components/ui/campo";
import {
  Dialogo,
  DialogoCabecera,
  DialogoContenido,
  DialogoDescripcion,
  DialogoDisparador,
  DialogoPie,
  DialogoTitulo,
} from "@/components/ui/dialogo";
import { guardarCategoria } from "@/app/(sgc)/documentos/acciones";

export interface DocumentoParaCategorizar {
  id: string;
  codigo: string | null;
  titulo: string;
  categoria: string | null;
}

/**
 * Arma una categoría de la lista maestra.
 *
 * Se escribe el nombre y se marcan los documentos que van adentro. Una
 * categoría que ya existe se elige del desplegable y llega con sus
 * documentos marcados: así se le agregan o se le sacan sin volver a
 * armarla de cero.
 *
 * Están todos los documentos, no solo los de la pestaña abierta. La
 * agrupación es de la lista maestra: un formulario en borrador y un
 * manual vigente pueden ir en la misma carpeta, y si la pantalla solo
 * mostrara la pestaña en la que se está, la mitad de la carpeta quedaría
 * afuera sin que se note.
 *
 * Desmarcar saca el documento de la categoría; no lo borra ni lo mueve a
 * otra. Es la única forma de sacarlo, y por eso se dice en pantalla.
 */
export function PanelCategorias({
  documentos,
  categorias,
}: {
  documentos: DocumentoParaCategorizar[];
  categorias: string[];
}) {
  const router = useRouter();
  const [abierto, definirAbierto] = React.useState(false);
  const [nombre, definirNombre] = React.useState("");
  const [busqueda, definirBusqueda] = React.useState("");
  const [elegidos, definirElegidos] = React.useState<string[]>([]);
  const [guardando, definirGuardando] = React.useState(false);

  // Al escribir el nombre de una categoría que ya existe, se marcan sus
  // documentos. Sin esto, guardar una categoría existente para agregarle
  // uno solo le sacaría todos los demás.
  React.useEffect(() => {
    const limpio = nombre.trim();
    if (!limpio) return;
    const suyos = documentos.filter((documento) => documento.categoria === limpio);
    if (suyos.length > 0) definirElegidos(suyos.map((documento) => documento.id));
  }, [nombre, documentos]);

  function alternar(id: string) {
    definirElegidos((actuales) =>
      actuales.includes(id) ? actuales.filter((otro) => otro !== id) : [...actuales, id],
    );
  }

  function reiniciar() {
    definirNombre("");
    definirBusqueda("");
    definirElegidos([]);
  }

  async function guardar() {
    const limpio = nombre.trim();

    // El orden de la lista manda, no el orden en que se fueron tocando
    // las casillas: es el que se ve, y es el que queda en la carpeta.
    const dentro = documentos
      .filter((documento) => elegidos.includes(documento.id))
      .map((documento) => documento.id);

    const fuera = documentos
      .filter(
        (documento) => documento.categoria === limpio && !elegidos.includes(documento.id),
      )
      .map((documento) => documento.id);

    definirGuardando(true);
    const resultado = await guardarCategoria(limpio, dentro, fuera);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Categoría guardada.");
      definirAbierto(false);
      reiniciar();
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
    definirGuardando(false);
  }

  const filtro = busqueda.trim().toLowerCase();
  const visibles = filtro
    ? documentos.filter(
        (documento) =>
          documento.titulo.toLowerCase().includes(filtro) ||
          (documento.codigo ?? "").toLowerCase().includes(filtro),
      )
    : documentos;

  return (
    <Dialogo
      open={abierto}
      onOpenChange={(estado) => {
        definirAbierto(estado);
        if (!estado) reiniciar();
      }}
    >
      <DialogoDisparador asChild>
        <Boton variante="contorno">
          <FolderPlus /> Categorías
        </Boton>
      </DialogoDisparador>

      <DialogoContenido className="max-w-2xl">
        <DialogoCabecera>
          <DialogoTitulo>Agrupar la lista maestra</DialogoTitulo>
          <DialogoDescripcion>
            Escriba el nombre de la categoría y marque los documentos que van adentro. Si elige
            una que ya existe, llega con los suyos marcados: desmarcar uno lo saca de la
            categoría.
          </DialogoDescripcion>
        </DialogoCabecera>

        <div className="grid gap-3">
          <GrupoCampo
            etiqueta="Categoría"
            htmlFor="nombre-categoria"
            requerido
            ayuda="Por ejemplo: Políticas, Manuales de proceso, Formularios de compras."
          >
            <Entrada
              id="nombre-categoria"
              list="categorias-existentes"
              value={nombre}
              onChange={(evento) => definirNombre(evento.target.value)}
              placeholder="Políticas"
              autoComplete="off"
            />
            <datalist id="categorias-existentes">
              {categorias.map((categoria) => (
                <option key={categoria} value={categoria} />
              ))}
            </datalist>
          </GrupoCampo>

          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2
                         text-atenuado-contraste"
            />
            <Entrada
              value={busqueda}
              onChange={(evento) => definirBusqueda(evento.target.value)}
              placeholder="Buscar por código o título…"
              className="pl-8"
              aria-label="Buscar en la lista de documentos"
            />
          </div>

          <div className="max-h-[45vh] overflow-y-auto rounded-md border border-borde">
            {visibles.length === 0 ? (
              <p className="p-3 text-xs text-atenuado-contraste">
                Ningún documento coincide con la búsqueda.
              </p>
            ) : (
              visibles.map((documento) => {
                const marcado = elegidos.includes(documento.id);
                const enOtra =
                  documento.categoria !== null && documento.categoria !== nombre.trim();

                return (
                  <label
                    key={documento.id}
                    className="flex cursor-pointer items-center gap-2 border-b border-borde
                               px-3 py-1.5 text-xs last:border-b-0 hover:bg-acento/50"
                  >
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={() => alternar(documento.id)}
                      className="size-3.5 shrink-0 cursor-pointer accent-primario"
                    />
                    <span className="w-28 shrink-0 tabular text-atenuado-contraste">
                      {documento.codigo ?? "—"}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{documento.titulo}</span>
                    {/* Avisa que sacarlo de donde está es parte de esto.
                        Sin esto, un documento se mueve de carpeta sin que
                        quien lo marca se dé cuenta de que lo sacó de otra. */}
                    {enOtra ? (
                      <span className="shrink-0 text-[10px] text-atenuado-contraste">
                        en «{documento.categoria}»
                      </span>
                    ) : null}
                  </label>
                );
              })
            )}
          </div>

          <p className="text-[11px] text-atenuado-contraste">
            <span className="font-medium tabular text-texto">{elegidos.length}</span> marcado
            {elegidos.length === 1 ? "" : "s"} de {documentos.length}. Quedan en el orden en que
            se ven acá; después se acomodan con las flechas del listado.
          </p>
        </div>

        <DialogoPie>
          <Boton variante="contorno" onClick={() => definirAbierto(false)} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton onClick={guardar} cargando={guardando} disabled={nombre.trim().length < 2}>
            Guardar categoría
          </Boton>
        </DialogoPie>
      </DialogoContenido>
    </Dialogo>
  );
}
