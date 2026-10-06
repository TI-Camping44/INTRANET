import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { Boton } from "@/components/ui/boton";
import {
  FormularioProveedor,
  type ProveedorInicial,
} from "@/app/(sgc)/proveedores/formulario-proveedor";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Editar Asociado de Negocio" };
export const dynamic = "force-dynamic";

/**
 * Correccion de los datos del Asociado de Negocio.
 *
 * EL CODIGO NO SE EDITA: lo genero el alta y es lo que identifica al
 * Asociado en el padron; cambiarlo despues rompe la trazabilidad de sus
 * evaluaciones.
 *
 * LA CALIFICACION Y EL ESTADO TAMPOCO: salen de las evaluaciones, que
 * las sincroniza un disparador. Para cambiarlos se registra una
 * evaluacion nueva desde la ficha, que es lo que deja constancia de
 * quien evaluo, cuando y con que puntaje.
 */
export default async function PaginaEditarProveedor({
  params,
}: {
  params: { id: string };
}) {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) redirect("/sin-acceso?motivo=permisos");

  const supabase = crearClienteServidor();

  const [{ data: consulta }, { data: datosEmpresas }] = await Promise.all([
    supabase
      .from("proveedores")
      .select(
        "id, codigo, empresa_compradora_id, razon_social, nombre_comercial, ruc, rubro, " +
          "correo, contacto, contacto_secundario, ciudad, pais, periodicidad_evaluacion_meses",
      )
      .eq("id", params.id)
      .maybeSingle(),
    // Por `empresas_del_grupo()`: `empresas` la acota RLS a la propia y
    // Vitalica no aparecería en el desplegable.
    supabase.rpc("empresas_del_grupo"),
  ]);

  const proveedor = consulta as (ProveedorInicial & { codigo: string }) | null;
  if (!proveedor) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Boton variante="fantasma" tamano="pequeno" comoHijo className="mb-3 -ml-2">
        <Link href={`/proveedores/${params.id}`}>
          <ArrowLeft /> Volver a la ficha
        </Link>
      </Boton>

      <EncabezadoPagina
        titulo={`Editar ${proveedor.codigo}`}
        descripcion="Se corrigen los datos de contacto y la empresa del grupo. El código, la calificación y el estado no se tocan desde acá: salen de las evaluaciones."
      />

      <FormularioProveedor
        empresas={(datosEmpresas as { id: string; nombre: string }[] | null) ?? []}
        inicial={proveedor}
      />
    </div>
  );
}
