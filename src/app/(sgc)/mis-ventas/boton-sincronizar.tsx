"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

import { Boton } from "@/components/ui/boton";
import { sincronizarVentasAhora } from "@/app/(sgc)/mis-ventas/acciones";

/**
 * Trae la planilla en el momento. Solo lo ve el Administrador SGC.
 *
 * Va con `cargando` y no con `disabled`: la lectura tarda unos quince
 * segundos porque Google tarda eso en generar los CSV, y un botón apagado
 * y sin señal de avance se lee como roto.
 */
export function BotonSincronizar() {
  const router = useRouter();
  const [trabajando, definirTrabajando] = React.useState(false);

  async function traer() {
    definirTrabajando(true);
    const resultado = await sincronizarVentasAhora();
    definirTrabajando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Planilla traída.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <Boton variante="contorno" tamano="pequeno" cargando={trabajando} onClick={traer}>
      <RefreshCw /> Traer la planilla ahora
    </Boton>
  );
}
