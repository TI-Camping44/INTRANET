"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { ErrorDeFormulario } from "@/components/ui/error-de-formulario";
import { AvisoDeCambiosSinGuardar } from "@/components/ui/aviso-cambios-sin-guardar";
import { actualizarGasto, crearGasto } from "@/app/(sgc)/informatica/gastos/acciones";
import {
  CATEGORIAS_GASTO,
  ETIQUETAS_CATEGORIA_GASTO,
  ETIQUETAS_MONEDA,
  MONEDAS,
} from "@/lib/gastos-ti";
import type { EmpresaDelGrupo } from "@/lib/empresas";

export interface GastoInicial {
  id: string;
  fecha: string;
  proveedor: string;
  concepto: string;
  categoria: string;
  monto: number;
  moneda: string;
  empresa_imputada_id: string | null;
  activo_id: string | null;
  comprobante: string | null;
  enlace_comprobante: string | null;
  medio_pago: string | null;
  observaciones: string | null;
}

export interface ActivoOpcion {
  id: string;
  codigo: string;
  nombre: string;
}

/** El mismo formulario para el alta y la edición de un gasto. */
export function FormularioGasto({
  empresas,
  activos,
  proveedores,
  hoy,
  inicial,
  empresaPorOmision,
}: {
  empresas: EmpresaDelGrupo[];
  activos: ActivoOpcion[];
  /** Los proveedores ya usados, para sugerirlos y no escribir OLAM de tres formas. */
  proveedores: string[];
  hoy: string;
  inicial?: GastoInicial;
  empresaPorOmision?: string;
}) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirEnviando(true);
    definirError(null);
    const datos = new FormData(evento.currentTarget);
    const resultado = inicial ? await actualizarGasto(inicial.id, datos) : await crearGasto(datos);
    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Gasto guardado.");
      router.push("/informatica/gastos");
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
          <GrupoCampo etiqueta="Concepto" htmlFor="concepto" requerido className="sm:col-span-2">
            <Entrada
              id="concepto"
              name="concepto"
              required
              minLength={3}
              maxLength={200}
              defaultValue={inicial?.concepto}
              placeholder="Qué se pagó…"
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Proveedor" htmlFor="proveedor" requerido>
            <Entrada
              id="proveedor"
              name="proveedor"
              required
              minLength={2}
              maxLength={120}
              list="proveedores-ti"
              defaultValue={inicial?.proveedor}
              placeholder="OLAM S.R.L."
            />
          </GrupoCampo>
          <datalist id="proveedores-ti">
            {proveedores.map((proveedor) => (
              <option key={proveedor} value={proveedor} />
            ))}
          </datalist>

          <GrupoCampo etiqueta="Fecha" htmlFor="fecha" requerido ayuda="La de la factura o el pago.">
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

          <GrupoCampo etiqueta="Monto" htmlFor="monto" requerido>
            <Entrada
              id="monto"
              name="monto"
              required
              inputMode="decimal"
              defaultValue={inicial ? String(inicial.monto).replace(".", ",") : ""}
              placeholder="504,57"
              className="tabular"
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Moneda" htmlFor="moneda" requerido>
            <Seleccion id="moneda" name="moneda" required defaultValue={inicial?.moneda ?? "USD"}>
              {MONEDAS.map((moneda) => (
                <option key={moneda} value={moneda}>
                  {ETIQUETAS_MONEDA[moneda]}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Categoría" htmlFor="categoria" requerido>
            <Seleccion id="categoria" name="categoria" required defaultValue={inicial?.categoria ?? ""}>
              <option value="" disabled>
                Elija la categoría
              </option>
              {CATEGORIAS_GASTO.map((categoria) => (
                <option key={categoria} value={categoria}>
                  {ETIQUETAS_CATEGORIA_GASTO[categoria]}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Se imputa a"
            htmlFor="empresa_imputada_id"
            ayuda="De qué empresa es el gasto, aunque lo haya pagado la otra."
          >
            <Seleccion
              id="empresa_imputada_id"
              name="empresa_imputada_id"
              defaultValue={inicial ? (inicial.empresa_imputada_id ?? "") : (empresaPorOmision ?? "")}
            >
              {empresas.map((empresa) => (
                <option key={empresa.id} value={empresa.id}>
                  {empresa.nombre}
                </option>
              ))}
              <option value="">Compartido</option>
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Licencia o activo"
            htmlFor="activo_id"
            ayuda="Si el gasto corresponde a una licencia o equipo del inventario."
            className="sm:col-span-2"
          >
            <Seleccion id="activo_id" name="activo_id" defaultValue={inicial?.activo_id ?? ""}>
              <option value="">Ninguno</option>
              {activos.map((activo) => (
                <option key={activo.id} value={activo.id}>
                  {activo.codigo} · {activo.nombre}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Comprobante" htmlFor="comprobante" ayuda="Número de factura o recibo.">
            <Entrada
              id="comprobante"
              name="comprobante"
              maxLength={120}
              defaultValue={inicial?.comprobante ?? ""}
              placeholder="001-005-0009016"
              className="tabular"
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Medio de pago" htmlFor="medio_pago">
            <Entrada
              id="medio_pago"
              name="medio_pago"
              maxLength={120}
              defaultValue={inicial?.medio_pago ?? ""}
              placeholder="Tarjeta de Camping 44"
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Enlace al comprobante"
            htmlFor="enlace_comprobante"
            ayuda="El PDF en Drive o en el portal del proveedor."
            className="sm:col-span-2"
          >
            <Entrada
              id="enlace_comprobante"
              name="enlace_comprobante"
              type="url"
              pattern="https://.*"
              defaultValue={inicial?.enlace_comprobante ?? ""}
              placeholder="https://drive.google.com/…"
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Observaciones" htmlFor="observaciones" className="sm:col-span-2">
            <AreaTexto
              id="observaciones"
              name="observaciones"
              rows={3}
              defaultValue={inicial?.observaciones ?? ""}
              placeholder="Qué incluye, a quién se imputa una parte, qué falta confirmar…"
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
            {inicial ? "Guardar cambios" : "Registrar gasto"}
          </Boton>
        </div>
      </Tarjeta>
    </form>
  );
}
