"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { crearObjetivo } from "@/app/(sgc)/indicadores/acciones";
import {
  AYUDA_TIPO_RESULTADO,
  ETIQUETAS_FRECUENCIA_MEDICION,
  ETIQUETAS_TIPO_RESULTADO,
  FRECUENCIAS_MEDICION,
  TIPOS_RESULTADO,
  type TipoResultadoObjetivo,
} from "@/lib/objetivos";

/**
 * Alta de un objetivo de la calidad.
 *
 * ES LO QUE DIRECCIÓN PIDIÓ DECLARAR el 8 de octubre: qué se mide, de
 * qué empresa, en qué período, contra qué resultado esperado, con qué
 * frecuencia, quién responde, de dónde salen los datos y con qué
 * recursos.
 *
 * EL CÓDIGO NO SE ESCRIBE: lo genera la acción al guardar. Nadie quiere
 * inventarlo, y a mano se repite o se saltea.
 *
 * EL TIPO DE RESULTADO ABRE SOLO LO SUYO. Pedir a la vez el texto
 * esperado y el rango numérico obliga a dejar vacío lo que no
 * corresponde, y un campo vacío se lee como un olvido.
 */
export function FormularioObjetivo({
  empresas,
  usuarios,
  usuarioActual,
}: {
  empresas: { id: string; nombre: string }[];
  usuarios: { id: string; nombre_completo: string }[];
  usuarioActual: string;
}) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);
  const [tipo, definirTipo] = React.useState<TipoResultadoObjetivo | "">("");

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirEnviando(true);
    definirError(null);

    const resultado = await crearObjetivo(new FormData(evento.currentTarget));

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Objetivo creado.");
      // Se abre la ficha directamente: es donde se cargan las acciones y
      // se mueve el estado, que es el paso siguiente natural.
      router.push(`/indicadores/objetivos/${resultado.id}`);
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
          <GrupoCampo
            etiqueta="Denominación del objetivo"
            htmlFor="nombre"
            requerido
            className="sm:col-span-2"
            ayuda="Cómo se lo nombra. Es lo que se lee en el listado y en la Revisión por la Dirección."
          >
            <Entrada id="nombre" name="nombre" required minLength={5} />
          </GrupoCampo>

          <GrupoCampo etiqueta="Empresa" htmlFor="empresa_objetivo_id" requerido>
            <Seleccion
              id="empresa_objetivo_id"
              name="empresa_objetivo_id"
              required
              defaultValue={empresas[0]?.id ?? ""}
            >
              <option value="" disabled>
                Elija la empresa…
              </option>
              {empresas.map((empresa) => (
                <option key={empresa.id} value={empresa.id}>
                  {empresa.nombre}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Responsable del objetivo" htmlFor="responsable_id" requerido>
            <Seleccion
              id="responsable_id"
              name="responsable_id"
              required
              defaultValue={usuarioActual}
            >
              {usuarios.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.nombre_completo}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Inicio de la medición" htmlFor="fecha_inicio_medicion" requerido>
            <Entrada id="fecha_inicio_medicion" name="fecha_inicio_medicion" type="date" required />
          </GrupoCampo>

          <GrupoCampo etiqueta="Fin de la medición" htmlFor="fecha_fin_medicion" requerido>
            <Entrada id="fecha_fin_medicion" name="fecha_fin_medicion" type="date" required />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Tipo de objetivo"
            htmlFor="tipo_resultado"
            requerido
            className="sm:col-span-2"
            ayuda={tipo ? AYUDA_TIPO_RESULTADO[tipo] : "Cómo se declara el resultado esperado."}
          >
            <Seleccion
              id="tipo_resultado"
              name="tipo_resultado"
              required
              value={tipo}
              onChange={(evento) =>
                definirTipo(evento.target.value as TipoResultadoObjetivo | "")
              }
            >
              <option value="" disabled>
                Elija el tipo…
              </option>
              {TIPOS_RESULTADO.map((valor) => (
                <option key={valor} value={valor}>
                  {ETIQUETAS_TIPO_RESULTADO[valor]}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          {tipo === "si_no" ? (
            <GrupoCampo
              etiqueta="Resultado esperado"
              htmlFor="resultado_esperado_si_no"
              requerido
              className="sm:col-span-2"
              ayuda="Cuál de las dos respuestas significa que el objetivo se cumplió."
            >
              <Seleccion
                id="resultado_esperado_si_no"
                name="resultado_esperado_si_no"
                required
                defaultValue="si"
              >
                <option value="si">Sí</option>
                <option value="no">No</option>
              </Seleccion>
            </GrupoCampo>
          ) : null}

          {tipo === "texto" ? (
            <GrupoCampo
              etiqueta="Resultado esperado"
              htmlFor="resultado_esperado_texto"
              requerido
              className="sm:col-span-2"
              ayuda="Descríbalo con palabras."
            >
              <AreaTexto id="resultado_esperado_texto" name="resultado_esperado_texto" rows={2} required />
            </GrupoCampo>
          ) : null}

          {tipo === "numerico" ? (
            <>
              <GrupoCampo etiqueta="Valor mínimo esperable" htmlFor="valor_minimo">
                <Entrada
                  id="valor_minimo"
                  name="valor_minimo"
                  type="number"
                  step="any"
                  className="tabular"
                />
              </GrupoCampo>

              <GrupoCampo etiqueta="Valor máximo esperable" htmlFor="valor_maximo">
                <Entrada
                  id="valor_maximo"
                  name="valor_maximo"
                  type="number"
                  step="any"
                  className="tabular"
                />
              </GrupoCampo>

              <GrupoCampo
                etiqueta="Unidad del valor"
                htmlFor="unidad_valor"
                className="sm:col-span-2"
                ayuda="Por ejemplo %, días, reclamos, guaraníes."
              >
                <Entrada id="unidad_valor" name="unidad_valor" placeholder="%" />
              </GrupoCampo>
            </>
          ) : null}

          <GrupoCampo etiqueta="Frecuencia de medición" htmlFor="frecuencia_medicion" requerido>
            <Seleccion
              id="frecuencia_medicion"
              name="frecuencia_medicion"
              required
              defaultValue="mensual"
            >
              {FRECUENCIAS_MEDICION.map((valor) => (
                <option key={valor} value={valor}>
                  {ETIQUETAS_FRECUENCIA_MEDICION[valor]}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Fuente de datos"
            htmlFor="fuente_datos"
            className="sm:col-span-2"
            ayuda="De dónde sale la información, dónde se le hace seguimiento o dónde debe presentarse el resultado."
          >
            <AreaTexto id="fuente_datos" name="fuente_datos" rows={2} />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Recursos requeridos"
            htmlFor="recursos_requeridos"
            className="sm:col-span-2"
            ayuda="Qué hace falta para poder cumplirlo."
          >
            <AreaTexto id="recursos_requeridos" name="recursos_requeridos" rows={2} />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Quién provee los recursos"
            htmlFor="proveedor_recursos"
            className="sm:col-span-2"
          >
            <Entrada id="proveedor_recursos" name="proveedor_recursos" />
          </GrupoCampo>
        </div>

        {error ? <p className="mt-4 text-xs text-semaforo-critico">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <Boton type="button" variante="contorno" onClick={() => router.back()}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={enviando}>
            Crear objetivo
          </Boton>
        </div>
      </Tarjeta>
    </form>
  );
}
