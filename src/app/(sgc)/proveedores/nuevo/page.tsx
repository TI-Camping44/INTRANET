import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FormularioProveedor } from "@/app/(sgc)/proveedores/formulario-proveedor";
import { requerirRol } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { ROLES_GESTION } from "@/lib/constantes";

export const metadata: Metadata = { title: "Nuevo proveedor" };
export const dynamic = "force-dynamic";

export default async function PaginaNuevoProveedor() {
  await requerirRol(ROLES_GESTION);
  const supabase = crearClienteServidor();

  const { data: existentes } = await supabase
    .from("proveedores")
    .select("codigo")
    .ilike("codigo", "PRV-%");

  const secuencias = ((existentes ?? []) as { codigo: string }[])
    .map((fila) => Number.parseInt(fila.codigo.split("-")[1] ?? "", 10))
    .filter((numero) => !Number.isNaN(numero));
  const siguiente = (secuencias.length ? Math.max(...secuencias) : 0) + 1;

  return (
    <div className="mx-auto max-w-3xl">
      <EncabezadoPagina
        titulo="Nuevo proveedor"
        descripcion="El proveedor ingresa en evaluación. Su calificación y su estado se definen al registrar la primera evaluación."
      />
      <FormularioProveedor codigoSugerido={`PRV-${String(siguiente).padStart(3, "0")}`} />
    </div>
  );
}
