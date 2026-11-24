"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { ErrorDeFormulario } from "@/components/ui/error-de-formulario";
import { AvisoDeCambiosSinGuardar } from "@/components/ui/aviso-cambios-sin-guardar";
import { crearMovimiento } from "@/app/(sgc)/informatica/altas-bajas/acciones";
import { ETIQUETAS_TIPO_MOVIMIENTO, TIPOS_MOVIMIENTO } from "@/lib/altas-bajas-ti";
import { esDeVitalica, type EmpresaDelGrupo } from "@/lib/empresas";

export interface PersonaDelDirectorio {
  clave: string;
  nombre_completo: string;
  correo: string | null;
  puesto_id: string | null;
  empresa_del_puesto: string | null;
}

export interface PuestoOpcion {
  id: string;
  nombre: string;
  tieneMatriz: boolean;
}

/**
 * Alta de un ingreso o una desvinculación.
 *
 * Elegir a alguien del directorio completa el nombre, el correo, el
 * puesto y la empresa; quien recién entra puede no estar todavía en el
 * padrón, así que todo se puede escribir a mano. El puesto es lo que
 * decide los pasos: sin puesto, o con un puesto que no está en la
 * matriz, los pasos piden definir qué corresponde.
 */
export function FormularioMovimiento({
  personas,
  puestos,
  empresas,
  hoy,
  inicial,
}: {
  personas: PersonaDelDirectorio[];
  puestos: PuestoOpcion[];
  empresas: EmpresaDelGrupo[];
  hoy: string;
  inicial?: { tipo?: string; ticket?: string };
}) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);
  const formulario = React.useRef<HTMLFormElement>(null);

  function elegirPersona(clave: string) {
    const persona = personas.find((p) => p.clave === clave);
    const campos = formulario.current?.elements;
    if (!persona || !campos) return;
    const fijar = (nombre: string, valor: string) => {
      const campo = campos.namedItem(nombre) as HTMLInputElement | HTMLSelectElement | null;
      if (campo) campo.value = valor;
    };
    fijar("persona_nombre", persona.nombre_completo);
    fijar("persona_correo", persona.correo ?? "");
    if (persona.puesto_id) fijar("puesto_id", persona.puesto_id);
    // El padrón escribe la empresa como la exporta Odoo («VITALICA E.A.S.»),
    // así que se compara por el comienzo del nombre, como `esDeVitalica`.
    if (persona.empresa_del_puesto) {
      const vitalica = esDeVitalica(persona.empresa_del_puesto);
      const empresa = empresas.find((e) => esDeVitalica(e.nombre) === vitalica);
      if (empresa) fijar("empresa_de_la_persona_id", empresa.id);
    }
  }

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirEnviando(true);
    definirError(null);
    const resultado = await crearMovimiento(new FormData(evento.currentTarget));
    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Registro creado.");
      router.push(`/informatica/altas-bajas/${resultado.id}`);
      router.refresh();
    } else {
      definirError(resultado.error);
      toast.error(resultado.error);
      definirEnviando(false);
    }
  }

  return (
    <form ref={formulario} onSubmit={enviar}>
      <Tarjeta className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <GrupoCampo etiqueta="Qué es" htmlFor="tipo" requerido>
            <Seleccion id="tipo" name="tipo" required defaultValue={inicial?.tipo ?? "alta"}>
              {TIPOS_MOVIMIENTO.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {ETIQUETAS_TIPO_MOVIMIENTO[tipo]}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Fecha" htmlFor="fecha_efectiva" requerido ayuda="De ingreso o de salida.">
            <Entrada
              id="fecha_efectiva"
              name="fecha_efectiva"
              type="date"
              required
              defaultValue={hoy}
              className="tabular"
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Buscar en el directorio"
            htmlFor="persona_directorio"
            ayuda="Completa los datos de abajo. Si la persona todavía no figura, escríbalos a mano."
            className="sm:col-span-2"
          >
            <Seleccion
              id="persona_directorio"
              defaultValue=""
              onChange={(evento) => elegirPersona(evento.target.value)}
            >
              <option value="">Elegir una persona…</option>
              {personas.map((persona) => (
                <option key={persona.clave} value={persona.clave}>
                  {persona.nombre_completo}
                  {persona.correo ? ` · ${persona.correo}` : ""}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Nombre" htmlFor="persona_nombre" requerido>
            <Entrada id="persona_nombre" name="persona_nombre" required minLength={3} maxLength={160} />
          </GrupoCampo>

          <GrupoCampo etiqueta="Correo" htmlFor="persona_correo" ayuda="El de la empresa, si ya lo tiene.">
            <Entrada id="persona_correo" name="persona_correo" type="email" autoComplete="off" />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Puesto"
            htmlFor="puesto_id"
            ayuda="Decide los pasos, según la matriz de accesos."
          >
            <Seleccion id="puesto_id" name="puesto_id" defaultValue="">
              <option value="">Sin puesto definido</option>
              {puestos.map((puesto) => (
                <option key={puesto.id} value={puesto.id}>
                  {puesto.nombre}
                  {puesto.tieneMatriz ? "" : " (sin fila en la matriz)"}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Empresa" htmlFor="empresa_de_la_persona_id" requerido>
            <Seleccion id="empresa_de_la_persona_id" name="empresa_de_la_persona_id" required defaultValue="">
              <option value="" disabled>
                Elija la empresa
              </option>
              {empresas.map((empresa) => (
                <option key={empresa.id} value={empresa.id}>
                  {empresa.nombre}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Ticket" htmlFor="ticket" ayuda="El de la ticketera, si lo hay.">
            <Entrada
              id="ticket"
              name="ticket"
              maxLength={7}
              defaultValue={inicial?.ticket ?? ""}
              placeholder="TI-0140"
              className="tabular"
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Cómo llegó el aviso" htmlFor="origen">
            <Entrada
              id="origen"
              name="origen"
              maxLength={200}
              placeholder="Correo de Capital Humano del 23/11/2026"
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Observaciones" htmlFor="observaciones" className="sm:col-span-2">
            <AreaTexto
              id="observaciones"
              name="observaciones"
              rows={3}
              placeholder="Equipos a entregar o recibir, accesos especiales, lo que haya que tener en cuenta…"
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
            Crear con sus pasos
          </Boton>
        </div>
      </Tarjeta>
    </form>
  );
}
