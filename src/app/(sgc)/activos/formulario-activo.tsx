"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { crearActivo } from "@/app/(sgc)/activos/acciones";
import { hoyEnAsuncion } from "@/lib/formato";

interface Opcion {
  id: string;
  nombre?: string;
  nombre_completo?: string;
  razon_social?: string;
}

export function FormularioActivo({
  sedes,
  personas,
  proveedores,
  codigoSugerido,
}: {
  sedes: Opcion[];
  personas: Opcion[];
  proveedores: Opcion[];
  codigoSugerido: string;
}) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);
  const [requiere, definirRequiere] = React.useState(false);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirEnviando(true);
    definirError(null);

    const resultado = await crearActivo(new FormData(evento.currentTarget));

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Activo registrado.");
      router.push(`/activos/${resultado.id}`);
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
          <GrupoCampo etiqueta="Código" htmlFor="codigo" requerido>
            <Entrada
              id="codigo"
              name="codigo"
              defaultValue={codigoSugerido}
              required
              className="tabular"
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Categoría" htmlFor="categoria">
            <Entrada id="categoria" name="categoria" placeholder="Equipamiento informático" />
          </GrupoCampo>

          <GrupoCampo etiqueta="Nombre" htmlFor="nombre" requerido className="sm:col-span-2">
            <Entrada id="nombre" name="nombre" required minLength={3} />
          </GrupoCampo>

          <GrupoCampo etiqueta="Descripción" htmlFor="descripcion" className="sm:col-span-2">
            <AreaTexto id="descripcion" name="descripcion" rows={2} />
          </GrupoCampo>

          <GrupoCampo etiqueta="Sede" htmlFor="sede_id">
            <Seleccion id="sede_id" name="sede_id">
              <option value="">Sin sede</option>
              {sedes.map((sede) => (
                <option key={sede.id} value={sede.id}>
                  {sede.nombre}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Ubicación" htmlFor="ubicacion">
            <Entrada id="ubicacion" name="ubicacion" placeholder="Sala de servidores" />
          </GrupoCampo>

          <GrupoCampo etiqueta="Responsable" htmlFor="responsable_id">
            <Seleccion id="responsable_id" name="responsable_id">
              <option value="">Sin asignar</option>
              {personas.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.nombre_completo}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Proveedor" htmlFor="proveedor_id">
            <Seleccion id="proveedor_id" name="proveedor_id">
              <option value="">Sin proveedor</option>
              {proveedores.map((proveedor) => (
                <option key={proveedor.id} value={proveedor.id}>
                  {proveedor.razon_social}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Marca" htmlFor="marca">
            <Entrada id="marca" name="marca" />
          </GrupoCampo>

          <GrupoCampo etiqueta="Modelo" htmlFor="modelo">
            <Entrada id="modelo" name="modelo" />
          </GrupoCampo>

          <GrupoCampo etiqueta="Número de serie" htmlFor="numero_serie">
            <Entrada id="numero_serie" name="numero_serie" className="tabular" />
          </GrupoCampo>

          <GrupoCampo etiqueta="Fecha de adquisición" htmlFor="fecha_adquisicion">
            <Entrada
              id="fecha_adquisicion"
              name="fecha_adquisicion"
              type="date"
              max={hoyEnAsuncion()}
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Valor (Gs.)"
            htmlFor="valor_gs"
            ayuda="Solo números; se muestra formateado en el listado."
          >
            <Entrada id="valor_gs" name="valor_gs" inputMode="numeric" className="tabular" />
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
                defaultValue={90}
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
          <Boton type="submit" disabled={enviando}>
            {enviando ? "Registrando…" : "Registrar activo"}
          </Boton>
        </div>
      </Tarjeta>
    </form>
  );
}
