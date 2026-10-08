import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FormularioAuditoria } from "@/app/(sgc)/auditorias/formulario-auditoria";
import { puedeGestionarAuditorias, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Nueva auditoría" };
export const dynamic = "force-dynamic";

export default async function PaginaNuevaAuditoria({
  searchParams,
}: {
  searchParams: { programa?: string };
}) {
  const usuario = await requerirUsuario();
  if (!puedeGestionarAuditorias(usuario)) redirect("/sin-acceso?motivo=permisos");

  const supabase = crearClienteServidor();

  // Calidad saco del alta el programa anual, la sede y la norma de
  // referencia: los tres se completaban siempre igual o se dejaban
  // vacios. Las columnas siguen en la tabla y se editan en la ficha.
  //
  // El programa igual se liga solo: al guardar, la auditoria entra al
  // programa del ano de su fecha planificada. Cuando el alta se abre
  // desde la ficha de un programa, ese id viaja por la direccion y manda
  // sobre el calculo por ano.
  const [{ data: usuarios }, { data: documentos }, { data: datosEmpresas }] = await Promise.all([
    supabase
      .from("usuarios")
      .select("id, nombre_completo")
      .eq("activo", true)
      .order("nombre_completo"),
    // La informacion documentada. Hoy la tabla esta vacia y el cuadro lo
    // dice; a medida que Calidad cargue documentos aparecen solos.
    supabase.from("documentos").select("id, codigo, titulo").order("codigo"),
    // Las dos empresas del grupo. Por `empresas_del_grupo()` y no por un
    // select a `empresas`: esa tabla la acota RLS a la propia y Vitalica
    // no aparecería en el desplegable.
    supabase.rpc("empresas_del_grupo"),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <EncabezadoPagina
        titulo="Nueva auditoría interna"
        descripcion="La auditoría se numera automáticamente y queda planificada. Los hallazgos se cargan durante la ejecución."
      />
      <FormularioAuditoria
        documentos={
          (documentos as { id: string; codigo: string | null; titulo: string }[] | null) ?? []
        }
        usuarios={usuarios ?? []}
        empresas={(datosEmpresas as { id: string; nombre: string }[] | null) ?? []}
        usuarioActual={usuario.id}
        programaId={searchParams.programa ?? null}
      />
    </div>
  );
}
