import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { redirect } from "next/navigation";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FormularioNoConformidad } from "@/app/(sgc)/no-conformidades/formulario-no-conformidad";
import { esSoloLectura, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Nueva No Conformidad" };
export const dynamic = "force-dynamic";

/**
 * Alta de la no conformidad.
 *
 * SE ENTRA TAMBIEN DESDE UNA AUDITORIA. Direccion pidio el 6 de octubre
 * que «Registrar hallazgo» abriera este modulo en vez del dialogo propio
 * de la auditoria. Cuando se llega por ahi, la direccion trae el id de
 * la auditoria y la pantalla abre con el origen y el proceso ya puestos,
 * y lo dice en el encabezado: una NC que sale de una auditoria tiene que
 * poder rastrearse hasta ella.
 */
export default async function PaginaNuevaNoConformidad({
  searchParams,
}: {
  searchParams: { auditoria?: string };
}) {
  const usuario = await requerirUsuario();
  if (esSoloLectura(usuario)) redirect("/sin-acceso?motivo=permisos");

  const supabase = crearClienteServidor();

  // Las dos empresas del grupo se ofrecen aunque una este inactiva:
  // Calidad lleva el sistema de las dos y una desviacion de Vitalica
  // E.A.S. se registra igual.
  //
  // Va por `empresas_del_grupo()` y no por un select a `empresas`: la
  // politica RLS de esa tabla solo deja ver la empresa propia, asi que el
  // selector mostraba Camping 44 y nada mas. La funcion devuelve id y
  // razon social, sin RUC ni el resto de la ficha.
  // La auditoria de la que viene, si viene de una.
  const { data: auditoria } = searchParams.auditoria
    ? await supabase
        .from("auditorias")
        .select("id, codigo, tipo, objetivo, proceso_id")
        .eq("id", searchParams.auditoria)
        .maybeSingle()
    : { data: null };

  const deLaAuditoria = auditoria as {
    id: string;
    codigo: string;
    tipo: string;
    objetivo: string | null;
    proceso_id: string | null;
  } | null;

  const [{ data: procesos }, { data: empresas }, { data: usuarios }] = await Promise.all([
    supabase.from("procesos").select("id, nombre, codigo").eq("activo", true).eq("version", "01").order("nombre"),
    supabase.rpc("empresas_del_grupo"),
    supabase
      .from("usuarios")
      .select("id, nombre_completo")
      .eq("activo", true)
      .order("nombre_completo"),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      {deLaAuditoria ? (
        <Boton variante="fantasma" tamano="pequeno" comoHijo className="mb-3 -ml-2">
          <Link href={`/auditorias/${deLaAuditoria.id}`}>
            <ArrowLeft /> Volver a la auditoría {deLaAuditoria.codigo}
          </Link>
        </Boton>
      ) : null}

      <EncabezadoPagina
        titulo="Nueva No Conformidad"
        descripcion={
          deLaAuditoria
            ? `Detectada en la auditoría ${deLaAuditoria.codigo}. Se numera automáticamente y queda abierta; el descargo, el análisis de causa raíz y la acción correctiva se cargan después, desde «Acciones correctivas».`
            : "La no conformidad se numera automáticamente y queda abierta. El descargo, el análisis de causa raíz y la acción correctiva se cargan después, desde «Acciones correctivas»."
        }
      />
      <FormularioNoConformidad
        procesos={procesos ?? []}
        empresas={empresas ?? []}
        usuarios={usuarios ?? []}
        sugerido={
          deLaAuditoria
            ? {
                // Una auditoría a terceros o a un proveedor no es una
                // auditoría interna: el origen sale del tipo.
                origen:
                  deLaAuditoria.tipo === "externa"
                    ? "auditoria_externa"
                    : deLaAuditoria.tipo === "proveedor" || deLaAuditoria.tipo === "terceros"
                      ? "proveedor"
                      : "auditoria_interna",
                proceso_id: deLaAuditoria.proceso_id,
              }
            : undefined
        }
      />
    </div>
  );
}
