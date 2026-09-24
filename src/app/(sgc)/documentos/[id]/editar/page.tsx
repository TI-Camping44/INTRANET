import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { Boton } from "@/components/ui/boton";
import {
  FormularioDocumento,
  type DocumentoInicial,
} from "@/app/(sgc)/documentos/formulario-documento";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Editar documento" };
export const dynamic = "force-dynamic";

/**
 * Edicion del documento, con el mismo formulario del alta.
 *
 * Hasta ahora no habia forma de corregir un documento ya cargado: si se
 * creaba sin proceso o con el titulo mal escrito, quedaba asi. La accion
 * de servidor existia desde el principio y no tenia pantalla.
 *
 * El archivo no se toca desde aca: tiene su propio bloque en la ficha,
 * donde se sube y se borra.
 */
export default async function PaginaEditarDocumento({
  params,
}: {
  params: { id: string };
}) {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) redirect("/sin-acceso?motivo=permisos");

  const supabase = crearClienteServidor();

  const [{ data: documento }, { data: usadas }, { data: procesos }, { data: personas }] =
    await Promise.all([
      supabase
        .from("documentos")
        .select(
          "id, codigo, titulo, tipo, categoria, proceso_id, responsable_id, " +
            "periodicidad_revision_meses",
        )
        .eq("id", params.id)
        .maybeSingle(),
      supabase.from("documentos").select("categoria").not("categoria", "is", null),
      supabase.from("procesos").select("id, nombre, codigo").eq("activo", true).order("codigo"),
      supabase
        .from("usuarios")
        .select("id, nombre_completo")
        .eq("activo", true)
        .order("nombre_completo"),
    ]);

  if (!documento) notFound();

  const categorias = Array.from(
    new Set(((usadas as { categoria: string }[] | null) ?? []).map((fila) => fila.categoria)),
  ).sort((una, otra) => una.localeCompare(otra, "es"));

  return (
    <div className="mx-auto max-w-3xl">
      <Boton variante="fantasma" tamano="pequeno" comoHijo className="mb-3 -ml-2">
        <Link href={`/documentos/${params.id}`}>
          <ArrowLeft /> Volver al documento
        </Link>
      </Boton>

      <EncabezadoPagina
        titulo="Editar documento"
        descripcion="Los cambios quedan registrados en la trazabilidad del documento, con quién los hizo y cuándo."
      />

      <FormularioDocumento
        usuarioActual={usuario.id}
        categorias={categorias}
        procesos={procesos ?? []}
        personas={(personas as { id: string; nombre_completo: string }[] | null) ?? []}
        inicial={documento as unknown as DocumentoInicial}
      />
    </div>
  );
}
