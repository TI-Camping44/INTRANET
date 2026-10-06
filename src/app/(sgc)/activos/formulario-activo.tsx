"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { actualizarActivo, crearActivo } from "@/app/(sgc)/activos/acciones";
import { hoyEnAsuncion } from "@/lib/formato";
import {
  CLASES_ACTIVO,
  CRITICIDADES_ACTIVO,
  ESTADOS_ACTIVO,
  ETIQUETAS_CLASE_ACTIVO,
  ETIQUETAS_CRITICIDAD_ACTIVO,
  ETIQUETAS_ESTADO_ACTIVO,
  SIGNIFICADO_ESTADO_ACTIVO,
} from "@/lib/constantes";
import type { ClaseActivo, CriticidadActivo, EstadoActivo } from "@/lib/tipos";

interface Opcion {
  id: string;
  nombre?: string;
  nombre_completo?: string;
  razon_social?: string;
}

/** Los datos del activo que este formulario edita. */
export interface ActivoInicial {
  id: string;
  nombre: string;
  clase: ClaseActivo;
  criticidad: CriticidadActivo;
  estado: EstadoActivo;
  categoria: string | null;
  descripcion: string | null;
  sede_id: string | null;
  ubicacion: string | null;
  responsable_id: string | null;
  proveedor_id: string | null;
  marca: string | null;
  modelo: string | null;
  numero_serie: string | null;
  fecha_adquisicion: string | null;
  vencimiento_garantia: string | null;
  observaciones: string | null;
  valor_gs: number | null;
  requiere_mantenimiento: boolean;
  frecuencia_mantenimiento_dias: number | null;
}

/**
 * El mismo formulario sirve para el alta y para la edición.
 *
 * EL CÓDIGO SOLO SE ESCRIBE AL DAR DE ALTA: identifica al activo en el
 * inventario y en su historial de mantenimientos.
 */
export function FormularioActivo({
  sedes,
  personas,
  proveedores,
  codigoSugerido,
  claseFijada,
  inicial,
}: {
  sedes: Opcion[];
  personas: Opcion[];
  proveedores: Opcion[];
  codigoSugerido?: string;
  /** Viene de «+ Nuevo Activo Edilicio» o «… Tecnológico». */
  claseFijada?: ClaseActivo;
  inicial?: ActivoInicial;
}) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);
  const [requiere, definirRequiere] = React.useState(
    inicial?.requiere_mantenimiento ?? false,
  );
  const [estado, definirEstado] = React.useState<EstadoActivo>(inicial?.estado ?? "operativo");

  const editando = Boolean(inicial);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirEnviando(true);
    definirError(null);

    const datos = new FormData(evento.currentTarget);
    const resultado = inicial
      ? await actualizarActivo(inicial.id, datos)
      : await crearActivo(datos);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Activo registrado.");
      router.push(`/activos/${inicial?.id ?? resultado.id}`);
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
          {editando ? null : (
            <GrupoCampo etiqueta="Código" htmlFor="codigo" requerido>
              <Entrada
                id="codigo"
                name="codigo"
                defaultValue={codigoSugerido}
                required
                className="tabular"
              />
            </GrupoCampo>
          )}

          {/* EDILICIO O TECNOLÓGICO. Dirección los lleva por separado.
              Cuando se entra por «+ Nuevo Activo Edilicio» o por su par
              tecnológico, viene elegido: igual se puede cambiar, porque
              equivocarse de atajo no debería obligar a empezar de nuevo. */}
          <GrupoCampo etiqueta="Clase" htmlFor="clase" requerido>
            <Seleccion
              id="clase"
              name="clase"
              required
              defaultValue={inicial?.clase ?? claseFijada ?? "tecnologico"}
            >
              {CLASES_ACTIVO.map((valor) => (
                <option key={valor} value={valor}>
                  {ETIQUETAS_CLASE_ACTIVO[valor]}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Criticidad"
            htmlFor="criticidad"
            requerido
            ayuda="Cuánto duele que este activo falle."
          >
            <Seleccion
              id="criticidad"
              name="criticidad"
              required
              defaultValue={inicial?.criticidad ?? "media"}
            >
              {CRITICIDADES_ACTIVO.map((valor) => (
                <option key={valor} value={valor}>
                  {ETIQUETAS_CRITICIDAD_ACTIVO[valor]}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          {/* El significado del estado elegido se muestra debajo: son
              seis y dos se parecen lo suficiente como para elegir mal. */}
          <GrupoCampo
            etiqueta="Estado"
            htmlFor="estado"
            requerido
            ayuda={SIGNIFICADO_ESTADO_ACTIVO[estado]}
          >
            <Seleccion
              id="estado"
              name="estado"
              required
              value={estado}
              onChange={(evento) => definirEstado(evento.target.value as EstadoActivo)}
            >
              {ESTADOS_ACTIVO.map((valor) => (
                <option key={valor} value={valor}>
                  {ETIQUETAS_ESTADO_ACTIVO[valor]}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Categoría" htmlFor="categoria">
            <Entrada
              id="categoria"
              name="categoria"
              placeholder="Equipamiento informático"
              defaultValue={inicial?.categoria ?? ""}
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Nombre" htmlFor="nombre" requerido className="sm:col-span-2">
            <Entrada
              id="nombre"
              name="nombre"
              required
              minLength={3}
              defaultValue={inicial?.nombre ?? ""}
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Descripción" htmlFor="descripcion" className="sm:col-span-2">
            <AreaTexto
              id="descripcion"
              name="descripcion"
              rows={2}
              defaultValue={inicial?.descripcion ?? ""}
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Sede" htmlFor="sede_id">
            <Seleccion id="sede_id" name="sede_id" defaultValue={inicial?.sede_id ?? ""}>
              <option value="">Sin sede</option>
              {sedes.map((sede) => (
                <option key={sede.id} value={sede.id}>
                  {sede.nombre}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Ubicación" htmlFor="ubicacion">
            <Entrada
              id="ubicacion"
              name="ubicacion"
              placeholder="Sala de servidores"
              defaultValue={inicial?.ubicacion ?? ""}
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Responsable" htmlFor="responsable_id">
            <Seleccion
              id="responsable_id"
              name="responsable_id"
              defaultValue={inicial?.responsable_id ?? ""}
            >
              <option value="">Sin asignar</option>
              {personas.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.nombre_completo}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Proveedor" htmlFor="proveedor_id">
            <Seleccion
              id="proveedor_id"
              name="proveedor_id"
              defaultValue={inicial?.proveedor_id ?? ""}
            >
              <option value="">Sin proveedor</option>
              {proveedores.map((proveedor) => (
                <option key={proveedor.id} value={proveedor.id}>
                  {proveedor.razon_social}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Marca" htmlFor="marca">
            <Entrada id="marca" name="marca" defaultValue={inicial?.marca ?? ""} />
          </GrupoCampo>

          <GrupoCampo etiqueta="Modelo" htmlFor="modelo">
            <Entrada id="modelo" name="modelo" defaultValue={inicial?.modelo ?? ""} />
          </GrupoCampo>

          <GrupoCampo etiqueta="Número de serie" htmlFor="numero_serie">
            <Entrada
              id="numero_serie"
              name="numero_serie"
              className="tabular"
              defaultValue={inicial?.numero_serie ?? ""}
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Fecha de adquisición" htmlFor="fecha_adquisicion">
            <Entrada
              id="fecha_adquisicion"
              name="fecha_adquisicion"
              type="date"
              max={hoyEnAsuncion()}
              defaultValue={inicial?.fecha_adquisicion ?? ""}
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Valor (Gs.)"
            htmlFor="valor_gs"
            ayuda="Solo números; se muestra formateado en el listado."
          >
            <Entrada
              id="valor_gs"
              name="valor_gs"
              inputMode="numeric"
              className="tabular"
              defaultValue={inicial?.valor_gs != null ? String(inicial.valor_gs) : ""}
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Vencimiento de garantía o licencia"
            htmlFor="vencimiento_garantia"
            ayuda="Lo que corresponda al activo. Vacío si no tiene."
          >
            <Entrada
              id="vencimiento_garantia"
              name="vencimiento_garantia"
              type="date"
              defaultValue={inicial?.vencimiento_garantia ?? ""}
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Observaciones" htmlFor="observaciones" className="sm:col-span-2">
            <AreaTexto
              id="observaciones"
              name="observaciones"
              rows={2}
              defaultValue={inicial?.observaciones ?? ""}
            />
          </GrupoCampo>

          <div className="sm:col-span-2">
            <label className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                name="requiere_mantenimiento"
                className="mt-0.5 size-4 accent-[#E01E37]"
                checked={requiere}
                onChange={(evento) => definirRequiere(evento.target.checked)}
              />
              <span>
                <span className="font-medium">Requiere mantenimiento preventivo</span>
                <span className="block text-atenuado-contraste">
                  Entra al calendario y el sistema agenda el siguiente automáticamente cada vez que
                  se registra una ejecución.
                </span>
              </span>
            </label>
          </div>

          {requiere ? (
            <GrupoCampo
              etiqueta="Frecuencia (días)"
              htmlFor="frecuencia_mantenimiento_dias"
              requerido
              ayuda="Por ejemplo 90 para trimestral, 180 semestral, 365 anual."
            >
              <Entrada
                id="frecuencia_mantenimiento_dias"
                name="frecuencia_mantenimiento_dias"
                type="number"
                min={1}
                defaultValue={inicial?.frecuencia_mantenimiento_dias ?? 90}
                required
                className="tabular"
              />
            </GrupoCampo>
          ) : null}
        </div>

        {error ? <p className="mt-4 text-xs text-semaforo-critico">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <Boton type="button" variante="contorno" onClick={() => router.back()}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={enviando}>
            {editando ? "Guardar cambios" : "Registrar activo"}
          </Boton>
        </div>
      </Tarjeta>
    </form>
  );
}
