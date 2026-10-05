"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Entrada, GrupoCampo } from "@/components/ui/campo";
import {
  Dialogo,
  DialogoCabecera,
  DialogoCierre,
  DialogoContenido,
  DialogoPie,
  DialogoTitulo,
} from "@/components/ui/dialogo";
import {
  actualizarPuesto,
  crearPuestoDePerfil,
  eliminarPuesto,
} from "@/app/(sgc)/recursos-humanos/puestos/acciones";
import type { FilaPuesto } from "@/app/(sgc)/recursos-humanos/puestos/page";

/**
 * Alta, edición y baja de un puesto.
 *
 * DOS CAMPOS Y NADA MÁS: nombre del puesto y departamento. Lo pidió
 * Dirección el 5 de octubre. Salieron el código —los P-101 los definió
 * el proyecto y Calidad nunca los confirmó—, el proceso y la misión del
 * puesto: lo que describe el puesto es el perfil firmado, que se adjunta
 * en PDF, no un campo de texto que nadie mantiene.
 *
 * Al dar de alta se puede subir el perfil en el mismo paso, para no
 * obligar a guardar y volver a entrar.
 */
export function FormularioPuesto({ puesto }: { puesto?: FilaPuesto }) {
  const router = useRouter();
  const [abierto, definirAbierto] = React.useState(false);
  const [procesando, definirProcesando] = React.useState(false);
  const editando = Boolean(puesto);

  async function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    definirProcesando(true);
    const resultado = editando
      ? await actualizarPuesto(puesto!.id, datos)
      : await crearPuestoDePerfil(datos);
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Guardado.");
      definirAbierto(false);
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  async function borrar() {
    if (!puesto) return;
    if (!confirm(`¿Eliminar el puesto «${puesto.nombre}» y su perfil? No se puede deshacer.`)) {
      return;
    }

    definirProcesando(true);
    const resultado = await eliminarPuesto(puesto.id);
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Eliminado.");
      definirAbierto(false);
      router.push("/recursos-humanos/puestos");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <>
      {editando ? (
        <Boton variante="contorno" tamano="pequeno" onClick={() => definirAbierto(true)}>
          <Pencil /> Editar puesto
        </Boton>
      ) : (
        <Boton onClick={() => definirAbierto(true)}>
          <Plus /> Nuevo puesto
        </Boton>
      )}

      <Dialogo open={abierto} onOpenChange={definirAbierto}>
        <DialogoContenido>
          <form onSubmit={guardar}>
            <DialogoCabecera>
              <DialogoTitulo>{editando ? "Editar el puesto" : "Nuevo puesto"}</DialogoTitulo>
            </DialogoCabecera>

            <div className="mt-4 space-y-3">
              <GrupoCampo etiqueta="Nombre del puesto" htmlFor="nombre" requerido>
                <Entrada
                  id="nombre"
                  name="nombre"
                  required
                  minLength={3}
                  placeholder="Vendedor de salón"
                  defaultValue={puesto?.nombre ?? ""}
                />
              </GrupoCampo>

              <GrupoCampo etiqueta="Departamento" htmlFor="area">
                <Entrada
                  id="area"
                  name="area"
                  placeholder="Comercial"
                  defaultValue={puesto?.area ?? ""}
                />
              </GrupoCampo>

              {editando ? null : (
                <GrupoCampo
                  etiqueta="Perfil del puesto"
                  htmlFor="perfil"
                  ayuda="En PDF. Se puede subir después, desde la ficha del puesto."
                >
                  <input
                    id="perfil"
                    type="file"
                    name="perfil"
                    multiple
                    accept="application/pdf,.pdf"
                    className="block w-full text-xs file:mr-2 file:rounded file:border file:border-borde file:bg-acento file:px-2 file:py-1 file:text-xs"
                  />
                </GrupoCampo>
              )}
            </div>

            <DialogoPie className="mt-5 sm:justify-between">
              {editando ? (
                <Boton
                  type="button"
                  variante="contorno"
                  onClick={borrar}
                  cargando={procesando}
                  className="text-semaforo-critico hover:text-semaforo-critico"
                >
                  <Trash2 /> Eliminar
                </Boton>
              ) : (
                <span />
              )}

              <span className="flex gap-2">
                <DialogoCierre asChild>
                  <Boton type="button" variante="contorno">
                    Cancelar
                  </Boton>
                </DialogoCierre>
                <Boton type="submit" cargando={procesando}>
                  {editando ? "Guardar cambios" : "Crear puesto"}
                </Boton>
              </span>
            </DialogoPie>
          </form>
        </DialogoContenido>
      </Dialogo>
    </>
  );
}
