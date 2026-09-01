"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Archive,
  Award,
  CalendarDays,
  FileText,
  ImagePlus,
  Megaphone,
  PackagePlus,
  Pin,
  PinOff,
  Plus,
  Trophy,
  UserPlus,
} from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import {
  Dialogo,
  DialogoCabecera,
  DialogoCierre,
  DialogoContenido,
  DialogoDescripcion,
  DialogoPie,
  DialogoTitulo,
} from "@/components/ui/dialogo";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia } from "@/components/ui/insignia";
import { Avatar, AvatarImagen, AvatarRespaldo } from "@/components/ui/avatar";
import { Tarjeta } from "@/components/ui/tarjeta";
import {
  cambiarEstadoPublicacion,
  crearPublicacion,
  fijarPublicacion,
} from "@/app/(sgc)/inicio/acciones";
import { formatearFechaHora, hoyEnAsuncion } from "@/lib/formato";
import { ACEPTA_IMAGEN, motivoDeRechazoImagen, TAMANO_MAXIMO_IMAGEN } from "@/lib/imagenes";
import {
  ETIQUETAS_TIPO_PUBLICACION,
  resumirPublicacion,
} from "@/lib/publicaciones";
import { iniciales } from "@/lib/utilidades";
import { cn } from "@/lib/utilidades";
import type { EstadoPublicacion, TipoPublicacion } from "@/lib/tipos";

export interface Publicacion {
  id: string;
  tipo: TipoPublicacion;
  titulo: string;
  cuerpo: string;
  resumen: string | null;
  estado: EstadoPublicacion;
  fijada: boolean;
  fecha_publicacion: string | null;
  fecha_vencimiento: string | null;
  autor: { nombre_completo: string; url_avatar: string | null } | null;
  referido: { nombre_completo: string; url_avatar: string | null } | null;
  procesos: { nombre: string } | null;
  /** Enlace firmado de la imagen, ya resuelto en el servidor. */
  imagen: string | null;
  /** Documento que originó el anuncio, cuando lo hay. */
  documento: { id: string; codigo: string | null; titulo: string } | null;
}

const ICONOS: Record<TipoPublicacion, React.ComponentType<{ className?: string }>> = {
  anuncio: Megaphone,
  novedad_producto: PackagePlus,
  logro: Trophy,
  reconocimiento: Award,
  bienvenida: UserPlus,
  evento: CalendarDays,
};

/**
 * Cada tipo lleva su tono, para poder distinguirlos de un vistazo sin
 * tener que leer la etiqueta. Es la unica parte del sistema donde el
 * color es categorico y no una magnitud.
 */
const TONOS: Record<TipoPublicacion, string> = {
  anuncio: "bg-primario/10 text-primario",
  novedad_producto: "bg-semaforo-medio/15 text-semaforo-medio",
  logro: "bg-semaforo-bajo/15 text-semaforo-bajo",
  reconocimiento: "bg-semaforo-bajo/15 text-semaforo-bajo",
  bienvenida: "bg-primario/10 text-primario",
  evento: "bg-atenuado text-atenuado-contraste",
};

type Filtro = "todas" | TipoPublicacion;

export function MuroPublicaciones({
  publicaciones,
  personas,
  procesos,
  puedeGestionar,
}: {
  publicaciones: Publicacion[];
  personas: { id: string; nombre_completo: string }[];
  procesos: { id: string; nombre: string }[];
  puedeGestionar: boolean;
}) {
  const router = useRouter();
  const [procesando, definirProcesando] = React.useState(false);
  const [abierto, definirAbierto] = React.useState(false);
  const entradaImagen = React.useRef<HTMLInputElement>(null);
  const [nombreImagen, definirNombreImagen] = React.useState<string | null>(null);
  const [filtro, definirFiltro] = React.useState<Filtro>("todas");
  const [abierta, definirAbierta] = React.useState<string | null>(null);

  const tiposPresentes = React.useMemo(() => {
    const vistos = new Set<TipoPublicacion>();
    publicaciones.forEach((publicacion) => vistos.add(publicacion.tipo));
    return Array.from(vistos);
  }, [publicaciones]);

  const visibles = publicaciones.filter(
    (publicacion) => filtro === "todas" || publicacion.tipo === filtro,
  );

  async function ejecutar(tarea: () => Promise<{ exito: boolean; mensaje?: string; error?: string }>) {
    definirProcesando(true);
    const resultado = await tarea();
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Listo.");
      router.refresh();
      return true;
    }
    toast.error(resultado.error ?? "No se pudo completar la operación.");
    return false;
  }

  async function publicar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (await ejecutar(() => crearPublicacion(new FormData(evento.currentTarget)))) {
      definirAbierto(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          <BotonFiltro activo={filtro === "todas"} onClick={() => definirFiltro("todas")}>
            Todo
          </BotonFiltro>
          {tiposPresentes.map((tipo) => (
            <BotonFiltro
              key={tipo}
              activo={filtro === tipo}
              onClick={() => definirFiltro(tipo)}
            >
              {ETIQUETAS_TIPO_PUBLICACION[tipo]}
            </BotonFiltro>
          ))}
        </div>

        {puedeGestionar ? (
          <Boton tamano="pequeno" onClick={() => definirAbierto(true)}>
            <Plus /> Publicar
          </Boton>
        ) : null}
      </div>

      {visibles.length === 0 ? (
        <EstadoVacio
          icono={<Megaphone className="size-6" />}
          titulo={
            publicaciones.length === 0 ? "Todavía no hay publicaciones" : "Nada de ese tipo"
          }
          descripcion={
            publicaciones.length === 0
              ? "Los anuncios, logros y novedades de la empresa se ven acá."
              : "Pruebe con otro filtro."
          }
        />
      ) : (
        <div className="space-y-3">
          {visibles.map((publicacion) => {
            const Icono = ICONOS[publicacion.tipo];
            const desplegada = abierta === publicacion.id;

            return (
              <Tarjeta
                key={publicacion.id}
                className={cn(
                  "p-4 transition-colors",
                  publicacion.fijada && "border-primario/40",
                )}
              >
                <div className="flex gap-3">
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-md",
                      TONOS[publicacion.tipo],
                    )}
                  >
                    <Icono className="size-4" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Insignia variante="contorno">
                        {ETIQUETAS_TIPO_PUBLICACION[publicacion.tipo]}
                      </Insignia>
                      {publicacion.fijada ? (
                        <Insignia variante="primaria">
                          <Pin className="mr-1 size-3" /> Fijada
                        </Insignia>
                      ) : null}
                      {publicacion.estado !== "publicada" ? (
                        <Insignia variante="advertencia">
                          {publicacion.estado === "borrador" ? "Borrador" : "Archivada"}
                        </Insignia>
                      ) : null}
                      {publicacion.procesos ? (
                        <span className="text-[11px] text-atenuado-contraste">
                          {publicacion.procesos.nombre}
                        </span>
                      ) : null}
                    </div>

                    <h3 className="mt-1.5 text-sm font-semibold leading-snug">
                      {publicacion.titulo}
                    </h3>

                    {publicacion.imagen ? (
                      // Sin next/image: la direccion es un enlace firmado
                      // que cambia en cada carga, asi que el optimizador no
                      // tendria nada estable que cachear.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={publicacion.imagen}
                        alt=""
                        className="mt-2 max-h-72 w-full rounded-md border border-borde object-cover"
                        loading="lazy"
                      />
                    ) : null}

                    <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-atenuado-contraste">
                      {desplegada
                        ? publicacion.cuerpo
                        : resumirPublicacion(publicacion.cuerpo, publicacion.resumen)}
                    </p>

                    {publicacion.cuerpo.length > 180 ? (
                      <button
                        type="button"
                        onClick={() => definirAbierta(desplegada ? null : publicacion.id)}
                        className="mt-1 text-[11px] font-medium text-primario hover:underline"
                      >
                        {desplegada ? "Ver menos" : "Leer todo"}
                      </button>
                    ) : null}

                    {/* En su propia fila: si no, queda pegado al «Leer
                        todo», que es un boton inline. */}
                    {publicacion.documento ? (
                      <div className="mt-2">
                        <Link
                          href={`/documentos/${publicacion.documento.id}`}
                          className="inline-flex items-center gap-1.5 text-[11px] font-medium
                                     text-primario hover:underline"
                        >
                          <FileText className="size-3.5" />
                          Ver{" "}
                          {publicacion.documento.codigo
                            ? publicacion.documento.codigo
                            : publicacion.documento.titulo}
                        </Link>
                      </div>
                    ) : null}

                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      {publicacion.referido ? (
                        <span className="flex items-center gap-1.5 text-[11px] text-atenuado-contraste">
                          <Avatar className="size-5">
                            {publicacion.referido.url_avatar ? (
                              <AvatarImagen
                                src={publicacion.referido.url_avatar}
                                alt={publicacion.referido.nombre_completo}
                              />
                            ) : null}
                            <AvatarRespaldo className="text-[9px]">
                              {iniciales(publicacion.referido.nombre_completo)}
                            </AvatarRespaldo>
                          </Avatar>
                          {publicacion.referido.nombre_completo}
                        </span>
                      ) : null}

                      <span className="text-[11px] text-atenuado-contraste">
                        {publicacion.autor?.nombre_completo ?? "Sistema"}
                        {publicacion.fecha_publicacion
                          ? ` · ${formatearFechaHora(publicacion.fecha_publicacion)}`
                          : ""}
                      </span>
                    </div>
                  </div>

                  {puedeGestionar ? (
                    <div className="flex shrink-0 flex-col gap-1">
                      <Boton
                        variante="fantasma"
                        tamano="iconoPequeno"
                        disabled={procesando || publicacion.estado !== "publicada"}
                        title={publicacion.fijada ? "Quitar de arriba" : "Fijar arriba"}
                        onClick={() => ejecutar(() => fijarPublicacion(publicacion.id))}
                      >
                        {publicacion.fijada ? <PinOff /> : <Pin />}
                      </Boton>
                      <Boton
                        variante="fantasma"
                        tamano="iconoPequeno"
                        disabled={procesando || publicacion.estado === "archivada"}
                        title="Archivar"
                        onClick={() =>
                          ejecutar(() => cambiarEstadoPublicacion(publicacion.id, "archivada"))
                        }
                      >
                        <Archive />
                      </Boton>
                    </div>
                  ) : null}
                </div>
              </Tarjeta>
            );
          })}
        </div>
      )}

      <Dialogo open={abierto} onOpenChange={definirAbierto}>
        <DialogoContenido className="max-w-xl">
          <form onSubmit={publicar}>
            <DialogoCabecera>
              <DialogoTitulo>Nueva publicación</DialogoTitulo>
              <DialogoDescripcion>
                Lo que escriba acá lo ven las cuarenta y nueve personas al entrar.
              </DialogoDescripcion>
            </DialogoCabecera>

            <div className="my-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <GrupoCampo etiqueta="Tipo" htmlFor="tipo" requerido>
                  <Seleccion id="tipo" name="tipo" defaultValue="anuncio">
                    {(Object.keys(ETIQUETAS_TIPO_PUBLICACION) as TipoPublicacion[]).map(
                      (clave) => (
                        <option key={clave} value={clave}>
                          {ETIQUETAS_TIPO_PUBLICACION[clave]}
                        </option>
                      ),
                    )}
                  </Seleccion>
                </GrupoCampo>

                <GrupoCampo
                  etiqueta="Deja de verse el"
                  htmlFor="fecha_vencimiento"
                  ayuda="Opcional. Para avisos con fecha, como un cierre contable."
                >
                  <Entrada
                    id="fecha_vencimiento"
                    name="fecha_vencimiento"
                    type="date"
                    min={hoyEnAsuncion()}
                  />
                </GrupoCampo>
              </div>

              <GrupoCampo etiqueta="Título" htmlFor="titulo" requerido>
                <Entrada id="titulo" name="titulo" required minLength={5} />
              </GrupoCampo>

              <GrupoCampo
                etiqueta="Resumen"
                htmlFor="resumen"
                ayuda="Opcional. Es lo que se lee en la tarjeta; si lo deja vacío se recorta el cuerpo."
              >
                <Entrada id="resumen" name="resumen" />
              </GrupoCampo>

              <GrupoCampo etiqueta="Cuerpo" htmlFor="cuerpo" requerido>
                <AreaTexto id="cuerpo" name="cuerpo" rows={6} required minLength={10} />
              </GrupoCampo>

              <GrupoCampo
                etiqueta="Imagen"
                htmlFor="imagen"
                ayuda={`Opcional. PNG, JPG o WebP, hasta ${TAMANO_MAXIMO_IMAGEN / (1024 * 1024)} MB. Se ve en la tarjeta del muro.`}
              >
                <div className="flex items-center gap-2">
                  <Boton
                    type="button"
                    variante="contorno"
                    tamano="pequeno"
                    onClick={() => entradaImagen.current?.click()}
                  >
                    <ImagePlus /> Elegir imagen
                  </Boton>
                  <span className="min-w-0 truncate text-[11px] text-atenuado-contraste">
                    {nombreImagen ?? "Ninguna elegida"}
                  </span>
                </div>
                <input
                  ref={entradaImagen}
                  id="imagen"
                  name="imagen"
                  type="file"
                  accept={ACEPTA_IMAGEN}
                  className="sr-only"
                  onChange={(evento) => {
                    const elegida = evento.target.files?.[0];
                    if (!elegida) return definirNombreImagen(null);

                    // El control de verdad esta en la accion de servidor.
                    // Este evita que alguien espere una subida de 20 MB
                    // para que despues se la rechacen.
                    const motivo = motivoDeRechazoImagen(elegida.name, elegida.size);
                    if (motivo) {
                      toast.error(motivo);
                      evento.target.value = "";
                      definirNombreImagen(null);
                      return;
                    }
                    definirNombreImagen(elegida.name);
                  }}
                />
              </GrupoCampo>

              <div className="grid gap-3 sm:grid-cols-2">
                <GrupoCampo
                  etiqueta="Sobre quién"
                  htmlFor="usuario_referido_id"
                  ayuda="Para bienvenidas y reconocimientos."
                >
                  <Seleccion id="usuario_referido_id" name="usuario_referido_id" defaultValue="">
                    <option value="">Nadie en particular</option>
                    {personas.map((persona) => (
                      <option key={persona.id} value={persona.id}>
                        {persona.nombre_completo}
                      </option>
                    ))}
                  </Seleccion>
                </GrupoCampo>

                <GrupoCampo etiqueta="Área" htmlFor="proceso_id">
                  <Seleccion id="proceso_id" name="proceso_id" defaultValue="">
                    <option value="">Toda la empresa</option>
                    {procesos.map((proceso) => (
                      <option key={proceso.id} value={proceso.id}>
                        {proceso.nombre}
                      </option>
                    ))}
                  </Seleccion>
                </GrupoCampo>
              </div>

              <div className="space-y-1.5 rounded-md border border-borde p-3">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    name="publicar"
                    value="si"
                    defaultChecked
                    className="size-3.5 accent-[hsl(var(--primario))]"
                  />
                  Publicar ahora
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    name="fijada"
                    value="si"
                    className="size-3.5 accent-[hsl(var(--primario))]"
                  />
                  Fijar arriba de todo
                </label>
                <p className="text-[11px] leading-relaxed text-atenuado-contraste">
                  Solo puede haber una publicación fijada. Si fija esta, se suelta la anterior:
                  con cinco cosas destacadas no hay nada destacado.
                </p>
              </div>
            </div>

            <DialogoPie className="mt-5">
              <DialogoCierre asChild>
                <Boton type="button" variante="contorno">
                  Cancelar
                </Boton>
              </DialogoCierre>
              <Boton type="submit" cargando={procesando}>
                Guardar
              </Boton>
            </DialogoPie>
          </form>
        </DialogoContenido>
      </Dialogo>
    </div>
  );
}

function BotonFiltro({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors",
        activo
          ? "border-primario/30 bg-primario/10 text-primario"
          : "border-borde text-atenuado-contraste hover:text-texto",
      )}
    >
      {children}
    </button>
  );
}
