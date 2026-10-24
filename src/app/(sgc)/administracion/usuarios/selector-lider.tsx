"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { Insignia } from "@/components/ui/insignia";
import { Seleccion } from "@/components/ui/campo";
import { moverEnOrganigrama } from "@/app/(sgc)/directorio/acciones";

/**
 * El líder inmediato de una persona, corregible desde la lista.
 *
 * SE EDITA ACA POR LO MISMO QUE EL PUESTO: la línea de reporte que trae
 * Odoo no siempre es la real —a alguien le falta el gerente, a otro Odoo
 * lo declara su propio jefe— y la pregunta «¿este jefe es el que
 * corresponde?» se hace mirando la lista entera. Hasta ahora solo se
 * podía arrastrando en el organigrama, que sirve para ver el árbol pero
 * no para repasar 55 filas de a una.
 *
 * NO ESCRIBE: LLAMA A `moverEnOrganigrama()`, la misma acción que usa el
 * organigrama. Es a propósito y es lo único que hay que respetar si esto
 * se toca: esa acción resuelve en cuál de las dos tablas cae la persona,
 * sincroniza `usuarios.superior_id` —que es lo que lee el escalamiento
 * de acciones vencidas— y corta los ciclos antes de escribir. Con un
 * camino de escritura propio quedarían dos jerarquías: la que se ve acá
 * y la que manda el correo.
 *
 * QUIEN NO ESTA EN EL PADRON NO SE PUEDE COLGAR DE NADIE: el ajuste vive
 * en `personas_nomina` y esa persona no tiene fila ahí. En vez de
 * ofrecer un desplegable que la base va a rechazar, se muestra el dato
 * sin lápiz.
 */
export function SelectorLider({
  clave,
  liderClave,
  liderNombre,
  gerenteDeOdoo,
  corregido,
  enElPadron,
  candidatos,
}: {
  /** `usuario:<uuid>` o `nomina:<uuid>`. */
  clave: string;
  /** La clave de quien es hoy su líder, si resuelve contra alguien. */
  liderClave: string | null;
  /** El nombre de ese líder, ya resuelto. */
  liderNombre: string | null;
  /** Lo que dice la exportación de Odoo, para poder compararlo. */
  gerenteDeOdoo: string | null;
  /** Si alguien ya lo corrigió a mano. */
  corregido: boolean;
  /** Si tiene fila en el padrón. Sin eso no se le puede fijar líder. */
  enElPadron: boolean;
  candidatos: { clave: string; nombre: string }[];
}) {
  const router = useRouter();
  const [editando, definirEditando] = React.useState(false);
  const [guardando, definirGuardando] = React.useState(false);

  async function guardar(valor: string) {
    definirGuardando(true);
    const resultado = await moverEnOrganigrama(clave, valor || null);
    definirGuardando(false);

    if (!resultado.exito) {
      toast.error(resultado.error);
      return;
    }

    definirEditando(false);
    toast.success(resultado.mensaje ?? "Líder actualizado.");
    router.refresh();
  }

  const cuerpo = (
    <span className="min-w-0">
      {liderNombre ?? gerenteDeOdoo ?? (
        <span className="text-atenuado-contraste">Sin líder declarado</span>
      )}

      {/* SI SE CORRIGIO, SE DICE, igual que con el puesto: sin eso nadie
          puede saber si la diferencia con Odoo es una corrección hecha a
          conciencia o un dato que quedó mal. */}
      {corregido && gerenteDeOdoo && gerenteDeOdoo !== liderNombre ? (
        <span className="block text-[11px] text-atenuado-contraste">
          Odoo dice: {gerenteDeOdoo}
        </span>
      ) : null}

      {/* El jefe que declara Odoo no está en el padrón: no se le va a
          poder escalar una acción vencida. */}
      {!liderClave && gerenteDeOdoo ? (
        <Insignia variante="atencion" className="mt-1">
          fuera del padrón
        </Insignia>
      ) : null}
    </span>
  );

  if (!enElPadron) {
    return <span className="flex w-full items-start text-xs">{cuerpo}</span>;
  }

  if (editando) {
    return (
      <Seleccion
        autoFocus
        disabled={guardando}
        defaultValue={liderClave ?? ""}
        aria-label="Líder inmediato"
        className="h-8 w-full min-w-[12rem] text-xs"
        onChange={(evento) => guardar(evento.target.value)}
        onBlur={() => definirEditando(false)}
      >
        <option value="">Sin líder</option>
        {candidatos
          .filter((candidato) => candidato.clave !== clave)
          .map((candidato) => (
            <option key={candidato.clave} value={candidato.clave}>
              {candidato.nombre}
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
      title="Corregir el líder inmediato"
    >
      {cuerpo}

      <Pencil
        className="mt-0.5 size-3 shrink-0 text-atenuado-contraste opacity-0
                   transition-opacity group-hover:opacity-100"
        aria-hidden="true"
      />
    </button>
  );
}
