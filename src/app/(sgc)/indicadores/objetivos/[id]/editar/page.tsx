import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { Boton } from "@/components/ui/boton";
import {
  FormularioObjetivo,
  type ObjetivoInicial,
} from "@/app/(sgc)/indicadores/formulario-objetivo";
import { requerirRol } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { ROLES_GESTION } from "@/lib/constantes";

export const metadata: Metadata = { title: "Editar objetivo" };
export const dynamic = "force-dynamic";

/**
 * Edición de un objetivo de la calidad.
 *
 * ES EL MISMO FORMULARIO DEL ALTA. Con uno propio, la edición termina
 * pidiendo menos campos que el alta y guardar le borra al objetivo lo
 * que no le preguntó. Lo que no se toca —el código y el año— no está
 * en el formulario, así que no hay forma de cambiarlo sin querer.
 */
export default async function PaginaEditarObjetivo({
  params,
}: {
  params: { id: string };
}) {
  const usuario = await requerirRol(ROLES_GESTION);
  const supabase = crearClienteServidor();

  const [{ data }, { data: datosEmpresas }, { data: usuarios }] = await Promise.all([
    supabase
      .from("objetivos")
      .select(
        "id, codigo, nombre, empresa_objetivo_id, responsable_id, fecha_inicio_medicion, " +
          "fecha_fin_medicion, tipo_resultado, resultado_esperado_si_no, " +
          "resultado_esperado_texto, valor_minimo, valor_maximo, unidad_valor, " +
          "frecuencia_medicion, fuente_datos, recursos_requeridos, proveedor_recursos",
      )
      .eq("id", params.id)
      .maybeSingle(),
    // Por `empresas_del_grupo()`: `empresas` la acota RLS a la propia y
    // Vitalica no aparecería en el desplegable.
    supabase.rpc("empresas_del_grupo"),
    supabase
      .from("usuarios")
      .select("id, nombre_completo")
      .eq("activo", true)
      .order("nombre_completo"),
  ]);

  const objetivo = data as ObjetivoInicial | null;
  if (!objetivo) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Boton variante="fantasma" tamano="pequeno" comoHijo className="mb-3 -ml-2">
        <Link href={`/indicadores/objetivos/${params.id}`}>
          <ArrowLeft /> Volver al objetivo
        </Link>
      </Boton>

      <EncabezadoPagina
        titulo={`Editar ${objetivo.codigo}`}
        descripcion="El código y el año no se editan: identifican al objetivo en la hoja de Calidad y en los informes ya emitidos."
      />

      <FormularioObjetivo
        empresas={(datosEmpresas as { id: string; nombre: string }[] | null) ?? []}
        usuarios={(usuarios as { id: string; nombre_completo: string }[] | null) ?? []}
        usuarioActual={usuario.id}
        inicial={objetivo}
      />
    </div>
  );
}
