import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { Boton } from "@/components/ui/boton";
import {
  FormularioActivo,
  type ActivoInicial,
} from "@/app/(sgc)/activos/formulario-activo";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Editar activo" };
export const dynamic = "force-dynamic";

/**
 * Correccion de los datos del activo.
 *
 * EL CODIGO NO SE EDITA: identifica al activo en el inventario y en su
 * historial de mantenimientos.
 *
 * Las fechas de mantenimiento tampoco: las mantiene el disparador cada
 * vez que se registra una ejecucion, y escribirlas a mano seria decir
 * que se hizo un mantenimiento que no quedo registrado.
 */
export default async function PaginaEditarActivo({ params }: { params: { id: string } }) {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) redirect("/sin-acceso?motivo=permisos");

  const supabase = crearClienteServidor();

  const [{ data: consulta }, { data: sedes }, { data: personas }, { data: proveedores }] =
    await Promise.all([
      supabase
        .from("activos")
        .select(
          "id, codigo, nombre, clase, criticidad, estado, categoria, descripcion, sede_id, " +
            "ubicacion, responsable_id, proveedor_id, marca, modelo, numero_serie, " +
            "fecha_adquisicion, vencimiento_garantia, observaciones, valor_gs, " +
            "requiere_mantenimiento, frecuencia_mantenimiento_dias",
        )
        .eq("id", params.id)
        .maybeSingle(),
      supabase.from("sedes").select("id, nombre").eq("activa", true).order("nombre"),
      supabase
        .from("usuarios")
        .select("id, nombre_completo")
        .eq("activo", true)
        .order("nombre_completo"),
      supabase
        .from("proveedores")
        .select("id, razon_social")
        .neq("estado", "inactivo")
        .order("razon_social"),
    ]);

  const activo = consulta as (ActivoInicial & { codigo: string }) | null;
  if (!activo) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Boton variante="fantasma" tamano="pequeno" comoHijo className="mb-3 -ml-2">
        <Link href={`/activos/${params.id}`}>
          <ArrowLeft /> Volver a la ficha
        </Link>
      </Boton>

      <EncabezadoPagina titulo={`Editar ${activo.codigo}`} />

      <FormularioActivo
        sedes={sedes ?? []}
        personas={personas ?? []}
        proveedores={proveedores ?? []}
        inicial={activo}
      />
    </div>
  );
}
