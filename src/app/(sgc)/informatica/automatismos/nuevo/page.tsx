import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import {
  FormularioAutomatismo,
  type PersonaOpcion,
} from "@/app/(sgc)/informatica/automatismos/formulario-automatismo";
import { requerirModuloEditable } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Registrar automatismo" };
export const dynamic = "force-dynamic";

/**
 * Alta de un automatismo. No hace falta para conectar uno nuevo: el
 * primer aviso de un script lo crea solo. Sirve para registrarlo antes,
 * con su frecuencia, así figura «sin conectar» hasta que avise.
 */
export default async function PaginaNuevoAutomatismo() {
  const usuario = await requerirModuloEditable("informatica");
  const supabase = crearClienteServidor();
  const { data } = await supabase
    .from("usuarios")
    .select("id, nombre_completo")
    .eq("activo", true)
    .order("nombre_completo");

  return (
    <div className="mx-auto max-w-3xl">
      <EncabezadoPagina
        titulo="Registrar automatismo"
        descripcion="Un script o una automatización que corre sola y tiene que avisar que corrió."
      />
      <FormularioAutomatismo
        personas={(data ?? []) as PersonaOpcion[]}
        responsablePorOmision={usuario.id}
      />
    </div>
  );
}
