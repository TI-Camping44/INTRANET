import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FormularioProveedor } from "@/app/(sgc)/proveedores/formulario-proveedor";
import { requerirRol } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { ROLES_GESTION } from "@/lib/constantes";

export const metadata: Metadata = { title: "Nuevo Asociado de Negocio" };
export const dynamic = "force-dynamic";

/**
 * Alta de un Asociado de Negocio.
 *
 * EL CÓDIGO NO SE PROPONE NI SE ESCRIBE: lo genera la acción de
 * servidor al guardar. Antes esta pantalla calculaba el siguiente y lo
 * dejaba escrito en el formulario, que es la forma de que dos altas
 * simultáneas propongan el mismo. Calculado al guardar, el índice único
 * de la base es el que decide, y si dos coinciden el mensaje lo dice.
 */
export default async function PaginaNuevoProveedor() {
  await requerirRol(ROLES_GESTION);

  // Las empresas van por `empresas_del_grupo()` y no por un select a
  // `empresas`: esa tabla la acota RLS a la propia, así que Vitálica no
  // aparecería y no habría forma de cargarle un Asociado de Negocio.
  const supabase = crearClienteServidor();
  const { data: datosEmpresas } = await supabase.rpc("empresas_del_grupo");
  const empresas = (datosEmpresas as { id: string; nombre: string }[] | null) ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <EncabezadoPagina
        titulo="Nuevo Asociado de Negocio"
        descripcion="El Asociado de Negocio ingresa en evaluación. Su calificación y su estado se definen al registrar la primera evaluación."
      />
      <FormularioProveedor empresas={empresas} />
    </div>
  );
}
