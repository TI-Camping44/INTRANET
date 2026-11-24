"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Minus, RotateCcw } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Entrada } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import { actualizarPaso } from "@/app/(sgc)/informatica/altas-bajas/acciones";
import { ETIQUETAS_ESTADO_PASO, esEstadoPaso } from "@/lib/altas-bajas-ti";

export interface Paso {
  id: string;
  orden: number;
  sistema: string;
  descripcion: string;
  estado: string;
  observacion: string | null;
  resuelto_en: string | null;
  resuelto_por_nombre: string | null;
  resuelto_en_texto: string | null;
}

/**
 * La lista de pasos de un ingreso o una desvinculación.
 *
 * Cada paso se marca solo: «Hecho», «No aplica» con su motivo, o se
 * vuelve a pendiente. La nota se guarda con el estado, así una
 * aclaración —«se le reasignó la licencia de Ruth Franco»— queda pegada
 * al paso al que se refiere.
 */
export function PanelPasos({ pasos, puedeEditar }: { pasos: Paso[]; puedeEditar: boolean }) {
  return (
    <ol className="divide-y divide-borde rounded-md border border-borde">
      {pasos.map((paso) => (
        <FilaPaso key={paso.id} paso={paso} puedeEditar={puedeEditar} />
      ))}
    </ol>
  );
}

function FilaPaso({ paso, puedeEditar }: { paso: Paso; puedeEditar: boolean }) {
  const router = useRouter();
  const [nota, definirNota] = React.useState(paso.observacion ?? "");
  const [guardando, definirGuardando] = React.useState<string | null>(null);

  async function marcar(estado: string) {
    definirGuardando(estado);
    const resultado = await actualizarPaso(paso.id, estado, nota);
    definirGuardando(null);
    if (resultado.exito) {
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  const variante =
    paso.estado === "hecho" ? "exito" : paso.estado === "no_aplica" ? "neutra" : "advertencia";

  return (
    <li className="grid gap-2 p-3 text-xs sm:grid-cols-[1fr_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="tabular text-atenuado-contraste">{paso.orden}.</span>
          <span className="font-semibold">{paso.sistema}</span>
          <Insignia variante={variante}>
            {esEstadoPaso(paso.estado) ? ETIQUETAS_ESTADO_PASO[paso.estado] : paso.estado}
          </Insignia>
        </div>
        <p className="mt-1">{paso.descripcion}</p>
        {paso.resuelto_en_texto ? (
          <p className="mt-1 text-[11px] text-atenuado-contraste">
            {paso.resuelto_en_texto}
            {paso.resuelto_por_nombre ? ` · ${paso.resuelto_por_nombre}` : ""}
          </p>
        ) : null}
        {puedeEditar ? (
          <Entrada
            aria-label={`Nota del paso ${paso.orden}`}
            value={nota}
            onChange={(evento) => definirNota(evento.target.value)}
            placeholder="Nota: qué se hizo o por qué no aplica…"
            className="mt-2 h-8 text-xs"
            maxLength={500}
          />
        ) : paso.observacion ? (
          <p className="mt-1 text-atenuado-contraste">{paso.observacion}</p>
        ) : null}
      </div>
      {puedeEditar ? (
        <div className="flex flex-wrap items-start gap-1.5 sm:justify-end">
          {paso.estado !== "hecho" ? (
            <Boton
              type="button"
              tamano="pequeno"
              cargando={guardando === "hecho"}
              onClick={() => marcar("hecho")}
            >
              <Check aria-hidden /> Hecho
            </Boton>
          ) : null}
          {paso.estado !== "no_aplica" ? (
            <Boton
              type="button"
              tamano="pequeno"
              variante="contorno"
              cargando={guardando === "no_aplica"}
              onClick={() => marcar("no_aplica")}
            >
              <Minus aria-hidden /> No aplica
            </Boton>
          ) : null}
          {paso.estado !== "pendiente" ? (
            <Boton
              type="button"
              tamano="pequeno"
              variante="contorno"
              cargando={guardando === "pendiente"}
              onClick={() => marcar("pendiente")}
            >
              <RotateCcw aria-hidden /> Pendiente
            </Boton>
          ) : null}
          {paso.estado !== "pendiente" && nota !== (paso.observacion ?? "") ? (
            <Boton
              type="button"
              tamano="pequeno"
              variante="contorno"
              cargando={guardando === paso.estado}
              onClick={() => marcar(paso.estado)}
            >
              Guardar nota
            </Boton>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
