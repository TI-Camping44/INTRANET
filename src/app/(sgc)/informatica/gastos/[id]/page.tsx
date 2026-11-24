import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { HistorialBitacora } from "@/components/comunes/historial-bitacora";
import {
  FormularioGasto,
  type GastoInicial,
} from "@/app/(sgc)/informatica/gastos/formulario-gasto";
import { datosDelFormularioDeGasto } from "@/app/(sgc)/informatica/gastos/datos-formulario";
import { eliminarGasto } from "@/app/(sgc)/informatica/gastos/acciones";
import { BotonEliminar } from "@/app/(sgc)/informatica/boton-eliminar";
import { requerirModuloEditable } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { hoyEnAsuncion } from "@/lib/formato";

export const metadata: Metadata = { title: "Gasto de TI" };
export const dynamic = "force-dynamic";

/** Un gasto se corrige en su propia pantalla, con el formulario del alta. */
export default async function PaginaGasto({ params }: { params: { id: string } }) {
  await requerirModuloEditable("informatica");
  const supabase = crearClienteServidor();

  // Todo lo que el formulario muestra va en el `select`: un campo que no
  // se pide llega vacío y guardar lo borraría.
  const [{ data }, datos] = await Promise.all([
    supabase
      .from("gastos_ti")
      .select(
        "id, fecha, proveedor, concepto, categoria, monto, moneda, empresa_imputada_id, activo_id, " +
          "comprobante, enlace_comprobante, medio_pago, observaciones",
      )
      .eq("id", params.id)
      .maybeSingle(),
    datosDelFormularioDeGasto(),
  ]);

  if (!data) notFound();
  const gasto = data as unknown as GastoInicial;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link
        href="/informatica/gastos"
        className="inline-flex items-center gap-1 text-xs text-atenuado-contraste hover:text-texto"
      >
        <ArrowLeft className="size-3" aria-hidden />
        Gastos de TI
      </Link>
      <EncabezadoPagina
        titulo={gasto.concepto}
        acciones={
          <div className="flex flex-wrap items-center gap-2">
            {gasto.enlace_comprobante ? (
              <a
                href={gasto.enlace_comprobante}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primario hover:underline"
              >
                Ver comprobante
                <ExternalLink className="size-3" aria-hidden />
              </a>
            ) : null}
            <BotonEliminar
              accion={eliminarGasto.bind(null, gasto.id)}
              aviso={`¿Eliminar el gasto «${gasto.concepto}»?\n\nÚselo para un registro duplicado o cargado por error.`}
              volverA="/informatica/gastos"
            />
          </div>
        }
      />
      <FormularioGasto
        {...datos}
        hoy={hoyEnAsuncion()}
        inicial={{ ...gasto, monto: Number(gasto.monto) }}
      />
      <HistorialBitacora tablas={["gastos_ti"]} registroId={gasto.id} />
    </div>
  );
}
