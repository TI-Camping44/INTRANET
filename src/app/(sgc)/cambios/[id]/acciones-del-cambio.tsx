"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";

import { Boton } from "@/components/ui/boton";
import { eliminarCambio } from "@/app/(sgc)/cambios/acciones";

/**
 * Editar y eliminar el cambio, desde su ficha.
 *
 * Los dos a la vista. Esconder «Eliminar» adentro del diálogo de
 * edición ya pasó en Auditoría y nadie lo encontró.
 *
 * UN CAMBIO CERRADO NO SE EDITA: quedó con su resultado y su
 * observación de seguimiento, y corregir el plan después de saber si
 * funcionó deja el registro diciendo que se planificó algo que en
 * realidad se escribió al final. Eliminarlo sí se puede, pero solo el
 * Administrador SGC, y eso lo decide la acción de servidor.
 */
export function AccionesDelCambio({
  cambioId,
  codigo,
  estado,
}: {
  cambioId: string;
  codigo: string;
  estado: string;
}) {
  const router = useRouter();
  const [procesando, definirProcesando] = React.useState(false);

  async function borrar() {
    if (!confirm(`¿Eliminar el cambio ${codigo}? No se puede deshacer.`)) return;

    definirProcesando(true);
    const resultado = await eliminarCambio(cambioId);
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Cambio eliminado.");
      router.push("/cambios");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <span className="flex flex-wrap gap-2">
      {estado === "cerrado" ? null : (
        <Boton variante="contorno" tamano="pequeno" comoHijo>
          <Link href={`/cambios/${cambioId}/editar`}>
            <Pencil /> Editar
          </Link>
        </Boton>
      )}

      <Boton
        variante="contorno"
        tamano="pequeno"
        onClick={borrar}
        cargando={procesando}
        className="text-semaforo-critico hover:text-semaforo-critico"
      >
        <Trash2 /> Eliminar
      </Boton>
    </span>
  );
}
