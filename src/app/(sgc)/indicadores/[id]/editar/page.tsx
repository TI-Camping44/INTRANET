import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import {
  FormularioIndicador,
  type IndicadorEditable,
} from "@/app/(sgc)/indicadores/formulario-indicador";
import { requerirRol } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { ROLES_GESTION } from "@/lib/constantes";

export const metadata: Metadata = { title: "Editar indicador" };
export const dynamic = "force-dynamic";

/**
 * Edición del indicador.
 *
 * `actualizarIndicador` existía desde el principio y ninguna pantalla la
 * llamaba: un indicador cargado con la meta equivocada solo se podía
 * corregir desde el panel de Supabase. Esta página es la que faltaba.
 *
 * SE OFRECEN LOS OBJETIVOS DEL AÑO DEL QUE YA TIENE, no los del año en
 * curso. El año del objetivo es el de su línea base, y un indicador de
 * 2026 se sigue midiendo en 2027: mostrarle los de 2027 lo dejaría sin
 * su objetivo en el desplegable y, al guardar, colgado de nada.
 */
export default async function PaginaEditarIndicador({
  params,
  searchParams,
}: {
  params: { id: string };
  /** `volver=objetivo` devuelve a la ficha del objetivo que mide. */
  searchParams: { volver?: string };
}) {
  const usuario = await requerirRol(ROLES_GESTION);
  const supabase = crearClienteServidor();

  const { data: consulta } = await supabase
    .from("indicadores")
    .select(
      "id, codigo, nombre, descripcion, formula, unidad, frecuencia, sentido, meta," +
        " meta_minima, meta_maxima, proceso_id, responsable_id, objetivo_id, linea_base," +
        " fuente_dato, consolidacion",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!consulta) notFound();
  const indicador = consulta as unknown as Omit<IndicadorEditable, "mediciones">;

  const [{ data: procesos }, { data: usuarios }, { count: mediciones }] = await Promise.all([
    supabase
      .from("procesos")
      .select("id, nombre, codigo")
      .eq("activo", true)
      .eq("version", "01")
      .order("nombre"),
    supabase
      .from("usuarios")
      .select("id, nombre_completo")
      .eq("activo", true)
      .order("nombre_completo"),
    // Cuántas mediciones tiene: es lo que se pierde al eliminarlo, y la
    // confirmación lo dice antes de que la persona acepte.
    supabase
      .from("indicador_mediciones")
      .select("id", { count: "exact", head: true })
      .eq("indicador_id", params.id),
  ]);

  // El año del objetivo que ya tiene; si no tiene ninguno, todos.
  const { data: suObjetivo } = indicador.objetivo_id
    ? await supabase
        .from("objetivos")
        .select("anio")
        .eq("id", indicador.objetivo_id)
        .maybeSingle()
    : { data: null };

  let consultaObjetivos = supabase.from("objetivos").select("id, codigo, nombre");
  const anio = (suObjetivo as { anio: number } | null)?.anio;
  if (anio) consultaObjetivos = consultaObjetivos.eq("anio", anio);

  const { data: objetivos } = await consultaObjetivos.order("codigo");

  return (
    <div className="mx-auto max-w-3xl">
      <EncabezadoPagina
        titulo={`Editar ${indicador.codigo}`}
        descripcion="El código no se edita: identifica al indicador en la hoja de Calidad y en los informes ya emitidos."
      />
      <FormularioIndicador
        procesos={procesos ?? []}
        usuarios={usuarios ?? []}
        objetivos={objetivos ?? []}
        usuarioActual={usuario.id}
        codigoSugerido={indicador.codigo}
        indicador={{ ...indicador, mediciones: mediciones ?? 0 }}
        volverA={
          searchParams.volver === "objetivo" && indicador.objetivo_id
            ? `/indicadores/objetivos/${indicador.objetivo_id}`
            : undefined
        }
      />
    </div>
  );
}
