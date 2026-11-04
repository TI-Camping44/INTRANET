import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import {
  FormularioAccion,
  type OpcionNoConformidad,
} from "@/app/(sgc)/acciones/formulario-accion";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { esSoloLectura, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { ESTADOS_NC_ABIERTOS } from "@/lib/constantes";

export const metadata: Metadata = { title: "Nueva acción correctiva" };
export const dynamic = "force-dynamic";

export default async function PaginaNuevaAccion({
  searchParams,
}: {
  searchParams: { nc?: string };
}) {
  const usuario = await requerirUsuario();
  const soloLectura = esSoloLectura(usuario);

  const supabase = crearClienteServidor();

  // Solo las que siguen abiertas: cargar una acción sobre una no
  // conformidad ya cerrada no tiene sentido, y la lista se vuelve
  // impracticable si arrastra el histórico.
  //
  // DIRECCIÓN SOLO VE LAS SUYAS EN ESTE SELECTOR. El rol es de solo
  // lectura en todo el sistema salvo dos excepciones escritas, y esta es
  // una: responde la desviación que tiene a su cargo y ninguna otra.
  // Antes la pantalla lo rebotaba entero a «Sin acceso», así que un
  // tratamiento asignado a Dirección no se podía cargar.
  //
  // El filtro NO es el control —ese lo hace RLS, que exige ser el
  // responsable—: es lo que evita ofrecerle una lista de desviaciones
  // que después la base le va a rechazar.
  const abiertas = supabase
    .from("no_conformidades")
    .select("id, codigo, titulo")
    .in("estado", ESTADOS_NC_ABIERTOS)
    .order("codigo", { ascending: true });

  const [{ data: noConformidades }, { data: personas }] = await Promise.all([
    soloLectura ? abiertas.eq("responsable_id", usuario.id) : abiertas,
    supabase
      .from("usuarios")
      .select("id, nombre_completo")
      .eq("activo", true)
      .order("nombre_completo"),
  ]);

  const opciones = (noConformidades as OpcionNoConformidad[] | null) ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <EncabezadoPagina
        titulo="Nueva acción correctiva"
        descripcion={
          soloLectura
            ? "Elija la desviación que tiene a su cargo y cargue la acción correctiva."
            : "Elija la no conformidad por su código y cargue la acción. Puede hacerlo también sobre una desviación que no esté a su nombre."
        }
      />

      {opciones.length === 0 ? (
        <EstadoVacio
          titulo={
            soloLectura
              ? "No tiene desviaciones a su cargo"
              : "No hay no conformidades abiertas"
          }
          descripcion={
            soloLectura
              ? "Su perfil carga la acción correctiva de las desviaciones en las que figura como responsable, y en este momento no hay ninguna abierta a su nombre."
              : "Una acción correctiva se carga sobre una desviación abierta o en tratamiento, y en este momento no hay ninguna."
          }
        />
      ) : (
        <FormularioAccion
          noConformidades={opciones}
          personas={(personas as { id: string; nombre_completo: string }[] | null) ?? []}
          usuarioActual={usuario.id}
          noConformidadInicial={searchParams.nc}
        />
      )}
    </div>
  );
}
