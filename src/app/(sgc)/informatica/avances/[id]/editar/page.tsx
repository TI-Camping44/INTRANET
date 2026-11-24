import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import {
  FormularioAvance,
  type AvanceInicial,
} from "@/app/(sgc)/informatica/avances/formulario-avance";
import { requerirModuloEditable } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { hoyEnAsuncion } from "@/lib/formato";
import type { EmpresaDelGrupo } from "@/lib/empresas";

export const metadata: Metadata = { title: "Editar avance de TI" };
export const dynamic = "force-dynamic";

export default async function PaginaEditarAvance({ params }: { params: { id: string } }) {
  await requerirModuloEditable("informatica");
  const supabase = crearClienteServidor();

  // EL SELECT PIDE TODO LO QUE EL FORMULARIO MUESTRA: un campo que no se
  // pide llega `undefined`, el formulario lo dibuja vacío y guardar lo
  // borra. Pasó con `departamento_que_resuelve` y con `puesto_manual_id`.
  const [{ data: avance }, { data: empresas }] = await Promise.all([
    supabase
      .from("avances_ti")
      .select(
        "id, fecha, titulo, tipo, sistema, empresa_afectada_id, ticket, descripcion, impacto, " +
          "entorno, aprobado_por, como_revertir, verificacion",
      )
      .eq("id", params.id)
      .maybeSingle(),
    supabase.rpc("empresas_del_grupo"),
  ]);

  if (!avance) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <EncabezadoPagina titulo="Editar avance de TI" />
      <FormularioAvance
        empresas={(empresas as EmpresaDelGrupo[] | null) ?? []}
        hoy={hoyEnAsuncion()}
        inicial={avance as unknown as AvanceInicial}
      />
    </div>
  );
}
