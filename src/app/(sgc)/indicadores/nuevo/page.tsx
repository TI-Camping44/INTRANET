import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FormularioIndicador } from "@/app/(sgc)/indicadores/formulario-indicador";
import { requerirRol } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { ROLES_GESTION } from "@/lib/constantes";
import { hoyEnAsuncion } from "@/lib/formato";

export const metadata: Metadata = { title: "Nuevo indicador" };
export const dynamic = "force-dynamic";

/**
 * Alta del indicador.
 *
 * SE ENTRA DESDE LA FICHA DEL OBJETIVO, con `?objetivo=<id>`. Los
 * indicadores de un objetivo se cargan ahí: el objetivo dice qué se
 * quiere lograr y el indicador con qué se mide, y separarlos en dos
 * pantallas obligaba a acordarse de vincularlos después.
 *
 * El id del objetivo se comprueba contra la base antes de usarlo, y la
 * dirección de vuelta se arma acá con ese id: nunca se toma una
 * dirección escrita en la barra del navegador.
 */
export default async function PaginaNuevoIndicador({
  searchParams,
}: {
  searchParams: { objetivo?: string };
}) {
  const usuario = await requerirRol(ROLES_GESTION);
  const supabase = crearClienteServidor();

  const anio = Number(hoyEnAsuncion().slice(0, 4));

  const { data: objetivoDeOrigen } = searchParams.objetivo
    ? await supabase
        .from("objetivos")
        .select("id, codigo, nombre")
        .eq("id", searchParams.objetivo)
        .maybeSingle()
    : { data: null };

  const origen = objetivoDeOrigen as { id: string; codigo: string; nombre: string } | null;

  const [{ data: procesos }, { data: usuarios }, { data: objetivos }, { data: existentes }] =
    await Promise.all([
    supabase.from("procesos").select("id, nombre, codigo").eq("activo", true).eq("version", "01").order("nombre"),
    supabase
      .from("usuarios")
      .select("id, nombre_completo")
      .eq("activo", true)
      .order("nombre_completo"),
    // Los objetivos del ano en curso: son los que puede medir un
    // indicador que se da de alta hoy.
    supabase
      .from("objetivos")
      .select("id, codigo, nombre")
      .eq("anio", anio)
      .order("codigo"),
    supabase.from("indicadores").select("codigo").ilike("codigo", "KPI-%"),
  ]);

  // Se propone el siguiente correlativo disponible.
  const secuencias = ((existentes ?? []) as { codigo: string }[])
    .map((fila) => Number.parseInt(fila.codigo.split("-")[1] ?? "", 10))
    .filter((numero) => !Number.isNaN(numero));
  const siguiente = (secuencias.length ? Math.max(...secuencias) : 0) + 1;

  // El objetivo de origen va en la lista aunque sea de otro año: el año
  // del objetivo es el de su línea base y se sigue midiendo después.
  const listaObjetivos = (objetivos as { id: string; codigo: string; nombre: string }[] | null) ?? [];
  const conOrigen =
    origen && !listaObjetivos.some((candidato) => candidato.id === origen.id)
      ? [origen, ...listaObjetivos]
      : listaObjetivos;

  return (
    <div className="mx-auto max-w-3xl">
      <EncabezadoPagina
        titulo="Nuevo indicador"
        descripcion={
          origen
            ? `Mide el objetivo ${origen.codigo} · ${origen.nombre}. El sentido define cuándo se considera cumplida la meta.`
            : "El sentido define cuándo se considera cumplida la meta; el sistema calcula el cumplimiento con esa misma regla en la base de datos."
        }
      />
      <FormularioIndicador
        procesos={procesos ?? []}
        usuarios={usuarios ?? []}
        objetivos={conOrigen}
        usuarioActual={usuario.id}
        codigoSugerido={`KPI-${String(siguiente).padStart(2, "0")}`}
        objetivoFijo={origen?.id}
        volverA={origen ? `/indicadores/objetivos/${origen.id}` : undefined}
      />
    </div>
  );
}
