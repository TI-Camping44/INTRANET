import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import {
  FormularioLicencia,
  type LicenciaInicial,
} from "@/app/(sgc)/informatica/licencias/formulario-licencia";
import { requerirModuloEditable } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatearFecha } from "@/lib/formato";

export const metadata: Metadata = { title: "Licencia" };
export const dynamic = "force-dynamic";

/** Cantidades y costo de una licencia. El permiso es el de Activos, que es donde se escribe. */
export default async function PaginaLicencia({ params }: { params: { id: string } }) {
  await requerirModuloEditable("activos");
  const supabase = crearClienteServidor();
  const { data } = await supabase
    .from("activos")
    .select(
      "id, codigo, nombre, vencimiento_garantia, observaciones, cantidad_contratada, " +
        "cantidad_en_uso, costo_ciclo, moneda_costo, ciclo_meses",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!data) notFound();
  const licencia = data as unknown as LicenciaInicial & {
    codigo: string;
    nombre: string;
    vencimiento_garantia: string | null;
    observaciones: string | null;
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link
        href="/informatica/licencias"
        className="inline-flex items-center gap-1 text-xs text-atenuado-contraste hover:text-texto"
      >
        <ArrowLeft className="size-3" aria-hidden />
        Licencias y vencimientos
      </Link>
      <EncabezadoPagina
        titulo={licencia.nombre}
        descripcion={
          `${licencia.codigo} · Vence: ${formatearFecha(licencia.vencimiento_garantia)}. ` +
          "El vencimiento, el estado y el responsable se editan en la ficha del activo."
        }
        acciones={
          <Link
            href={`/activos/${licencia.id}`}
            className="text-xs font-medium text-primario hover:underline"
          >
            Abrir la ficha del activo
          </Link>
        }
      />
      {licencia.observaciones ? (
        <p className="rounded-md border border-borde bg-atenuado/40 p-3 text-xs text-atenuado-contraste">
          {licencia.observaciones}
        </p>
      ) : null}
      <FormularioLicencia
        inicial={{
          id: licencia.id,
          cantidad_contratada: licencia.cantidad_contratada,
          cantidad_en_uso: licencia.cantidad_en_uso,
          costo_ciclo: licencia.costo_ciclo === null ? null : Number(licencia.costo_ciclo),
          moneda_costo: licencia.moneda_costo,
          ciclo_meses: licencia.ciclo_meses,
        }}
      />
    </div>
  );
}
