"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { Insignia } from "@/components/ui/insignia";
import { Seleccion } from "@/components/ui/campo";
import { definirPuesto } from "@/app/(sgc)/administracion/usuarios/acciones";

/**
 * El puesto de una persona, corregible desde la lista.
 *
 * SE EDITA ACA Y NO EN OTRA PANTALLA porque la pregunta —«¿este cargo es
 * el que ocupa hoy?»— se hace mirando la lista entera, no entrando de a
 * una persona. Odoo tiene cargos desactualizados y corregirlos de a uno,
 * abriendo y cerrando fichas, es el tipo de trabajo que nadie termina.
 *
 * ES UN LAPIZ Y NO UN DESPLEGABLE SIEMPRE ABIERTO: cincuenta y cinco
 * desplegables en una tabla la vuelven ilegible, y la mayoria de los
 * cargos estan bien.
 *
 * El guardado no espera a ningun boton: se elige y se guarda. Es un solo
 * campo y volver a elegir lo corrige, asi que un paso de confirmacion
 * solo agregaria un clic.
 */
export function SelectorPuesto({
  clave,
  puestoActual,
  puestoDeOdoo,
  corregido,
  puestos,
}: {
  /** `usuario:<uuid>` o `nomina:<uuid>`. */
  clave: string;
  /** El id del puesto que tiene hoy, si resuelve contra uno cargado. */
  puestoActual: string | null;
  /** Lo que dice la exportación de Odoo, para poder compararlo. */
  puestoDeOdoo: string | null;
  /** Si alguien ya lo corrigió a mano. */
  corregido: boolean;
  puestos: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [editando, definirEditando] = React.useState(false);
  const [guardando, definirGuardando] = React.useState(false);

  const nombreActual = puestoActual
    ? (puestos.find((p) => p.id === puestoActual)?.nombre ?? null)
    : null;

  async function guardar(valor: string) {
    definirGuardando(true);
    const resultado = await definirPuesto(clave, valor || null);
    definirGuardando(false);

    if (!resultado.exito) {
      toast.error(resultado.error);
      return;
    }

    definirEditando(false);
    toast.success(resultado.mensaje ?? "Puesto actualizado.");
    router.refresh();
  }

  if (editando) {
    return (
      <Seleccion
        autoFocus
        disabled={guardando}
        defaultValue={puestoActual ?? ""}
        aria-label="Puesto"
        className="h-8 w-full min-w-[12rem] text-xs"
        onChange={(evento) => guardar(evento.target.value)}
        onBlur={() => definirEditando(false)}
      >
        <option value="">Sin puesto equivalente</option>
        {puestos.map((puesto) => (
          <option key={puesto.id} value={puesto.id}>
            {puesto.nombre}
          </option>
        ))}
      </Seleccion>
    );
  }

  return (
    <button
      type="button"
      onClick={() => definirEditando(true)}
      className="group flex w-full items-start gap-1.5 text-left text-xs"
      title="Corregir el puesto"
    >
      <span className="min-w-0">
        {nombreActual ?? puestoDeOdoo ?? (
          <span className="text-atenuado-contraste">Sin puesto</span>
        )}

        {/* SI SE CORRIGIO, SE DICE, y se deja a la vista lo que trae el
            ERP. Sin eso nadie puede saber si la diferencia con Odoo es
            una correccion hecha a conciencia o un dato que quedo mal. */}
        {corregido && puestoDeOdoo && puestoDeOdoo !== nombreActual ? (
          <span className="block text-[11px] text-atenuado-contraste">
            Odoo dice: {puestoDeOdoo}
          </span>
        ) : null}

        {!corregido && puestoDeOdoo && !nombreActual ? (
          <Insignia variante="atencion" className="mt-1">
            sin equivalente
          </Insignia>
        ) : null}
      </span>

      <Pencil
        className="mt-0.5 size-3 shrink-0 text-atenuado-contraste opacity-0
                   transition-opacity group-hover:opacity-100"
        aria-hidden="true"
      />
    </button>
  );
}
