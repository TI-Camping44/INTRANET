"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { ErrorDeFormulario } from "@/components/ui/error-de-formulario";
import { AvisoDeCambiosSinGuardar } from "@/components/ui/aviso-cambios-sin-guardar";
import { actualizarAvance, crearAvance } from "@/app/(sgc)/informatica/avances/acciones";
import {
  DEFINICION_TIPO_AVANCE,
  ETIQUETAS_SISTEMA_AVANCE,
  ETIQUETAS_TIPO_AVANCE,
  SISTEMAS_AVANCE,
  TIPOS_AVANCE,
} from "@/lib/avances-ti";
import type { EmpresaDelGrupo } from "@/lib/empresas";

/** Los datos del registro que este formulario edita. */
export interface AvanceInicial {
  id: string;
  fecha: string;
  titulo: string;
  tipo: string;
  sistema: string;
  empresa_afectada_id: string | null;
  ticket: string | null;
  descripcion: string;
  impacto: string | null;
}

/**
 * El mismo formulario sirve para el alta y para la edición: con uno para
 * cada cosa, el de edición termina pidiendo menos campos y guardar borra
 * lo que no preguntó.
 *
 * El tipo lleva su definición en cada opción, como la gravedad del
 * reclamo: la definición hace falta mientras se compara una opción con
 * la otra, no después de elegir.
 */
export function FormularioAvance({
  empresas,
  hoy,
  inicial,
}: {
  empresas: EmpresaDelGrupo[];
  hoy: string;
  inicial?: AvanceInicial;
}) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirEnviando(true);
    definirError(null);

    const datos = new FormData(evento.currentTarget);
    const resultado = inicial
      ? await actualizarAvance(inicial.id, datos)
      : await crearAvance(datos);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Registro guardado.");
      router.push(`/informatica/avances/${inicial?.id ?? resultado.id}`);
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
          <GrupoCampo etiqueta="Título" htmlFor="titulo" requerido className="sm:col-span-2">
            <Entrada
              id="titulo"
              name="titulo"
              defaultValue={inicial?.titulo}
              required
              minLength={5}
              maxLength={200}
              placeholder="Qué cambió, en una línea…"
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Fecha" htmlFor="fecha" requerido>
            <Entrada
              id="fecha"
              name="fecha"
              type="date"
              required
              max={hoy}
              defaultValue={inicial?.fecha ?? hoy}
              className="tabular"
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Ticket"
            htmlFor="ticket"
            ayuda="El de la ticketera, si el cambio salió de un pedido."
          >
            <Entrada
              id="ticket"
              name="ticket"
              defaultValue={inicial?.ticket ?? ""}
              maxLength={7}
              placeholder="TI-0142"
              className="tabular"
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Tipo" htmlFor="tipo" requerido>
            <Seleccion id="tipo" name="tipo" required defaultValue={inicial?.tipo ?? ""}>
              <option value="" disabled>
                Elija el tipo
              </option>
              {TIPOS_AVANCE.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {ETIQUETAS_TIPO_AVANCE[tipo]} — {DEFINICION_TIPO_AVANCE[tipo]}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Sistema" htmlFor="sistema" requerido>
            <Seleccion id="sistema" name="sistema" required defaultValue={inicial?.sistema ?? ""}>
              <option value="" disabled>
                Elija el sistema
              </option>
              {SISTEMAS_AVANCE.map((sistema) => (
                <option key={sistema} value={sistema}>
                  {ETIQUETAS_SISTEMA_AVANCE[sistema]}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Empresa"
            htmlFor="empresa_afectada_id"
            ayuda="De qué empresa del grupo es el cambio."
          >
            <Seleccion
              id="empresa_afectada_id"
              name="empresa_afectada_id"
              defaultValue={inicial?.empresa_afectada_id ?? ""}
            >
              <option value="">Las dos</option>
              {empresas.map((empresa) => (
                <option key={empresa.id} value={empresa.id}>
                  {empresa.nombre}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Qué se hizo"
            htmlFor="descripcion"
            requerido
            className="sm:col-span-2"
          >
            <AreaTexto
              id="descripcion"
              name="descripcion"
              rows={6}
              required
              minLength={10}
              defaultValue={inicial?.descripcion ?? ""}
              placeholder="La causa si fue una corrección, qué se cambió y cómo se verificó…"
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Qué cambia para la gente"
            htmlFor="impacto"
            ayuda="A quién afecta y qué tiene que hacer distinto. Déjelo vacío si no se nota desde afuera."
            className="sm:col-span-2"
          >
            <AreaTexto
              id="impacto"
              name="impacto"
              rows={3}
              defaultValue={inicial?.impacto ?? ""}
              placeholder="Quién lo nota y qué hace distinto desde ahora…"
            />
          </GrupoCampo>
        </div>

        <AvisoDeCambiosSinGuardar />
        {error ? <ErrorDeFormulario error={error} className="mt-4" /> : null}

        <div className="mt-6 flex justify-end gap-2">
          <Boton type="button" variante="contorno" onClick={() => router.back()}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={enviando}>
            {inicial ? "Guardar cambios" : "Registrar avance"}
          </Boton>
        </div>
      </Tarjeta>
    </form>
  );
}
