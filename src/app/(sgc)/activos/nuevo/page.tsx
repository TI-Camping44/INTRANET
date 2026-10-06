import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FormularioActivo } from "@/app/(sgc)/activos/formulario-activo";
import { requerirRol } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { CLASES_ACTIVO, ETIQUETAS_CLASE_ACTIVO, ROLES_GESTION } from "@/lib/constantes";
import type { ClaseActivo } from "@/lib/tipos";

export const metadata: Metadata = { title: "Nuevo activo" };
export const dynamic = "force-dynamic";

/**
 * Alta de un activo.
 *
 * `?clase=edilicio` o `?clase=tecnologico` llega de los dos atajos del
 * menú y deja la clase elegida. Igual se puede cambiar en el formulario:
 * equivocarse de atajo no deberia obligar a empezar de nuevo.
 */
export default async function PaginaNuevoActivo({
  searchParams,
}: {
  searchParams: { clase?: string };
}) {
  await requerirRol(ROLES_GESTION);

  const claseFijada = CLASES_ACTIVO.includes(searchParams.clase as ClaseActivo)
    ? (searchParams.clase as ClaseActivo)
    : undefined;
  const supabase = crearClienteServidor();

  const [{ data: sedes }, { data: personas }, { data: proveedores }, { data: existentes }] =
    await Promise.all([
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
      supabase.from("activos").select("codigo").ilike("codigo", "ACT-%"),
    ]);

  const secuencias = ((existentes ?? []) as { codigo: string }[])
    .map((fila) => Number.parseInt(fila.codigo.split("-")[1] ?? "", 10))
    .filter((numero) => !Number.isNaN(numero));
  const siguiente = (secuencias.length ? Math.max(...secuencias) : 0) + 1;

  return (
    <div className="mx-auto max-w-3xl">
      <EncabezadoPagina
        titulo={claseFijada ? `Nuevo activo ${ETIQUETAS_CLASE_ACTIVO[claseFijada]}` : "Nuevo activo"}
      />
      <FormularioActivo
        sedes={sedes ?? []}
        personas={personas ?? []}
        proveedores={proveedores ?? []}
        codigoSugerido={`ACT-${String(siguiente).padStart(3, "0")}`}
        claseFijada={claseFijada}
      />
    </div>
  );
}
