import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
    .select("id, codigo, titulo, nc_acciones(id)")
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

  // LA QUE YA SE RESPONDIO NO SE VUELVE A RESPONDER. Lo pidió Calidad el
  // 4 de noviembre. El desplegable filtraba por estado, y responder una
  // desviación la deja «En tratamiento», que es un estado abierto: las
  // nueve ya respondidas seguían eligiéndose. Elegir una de esas no
  // editaba su respuesta, cargaba UNA SEGUNDA EN PARALELO —otro
  // descargo, otras acciones— sobre la misma desviación.
  //
  // El corte es «¿tiene alguna acción cargada?», el mismo que usa la
  // tarjeta «No conformidades sin plan de acción» del listado, para que
  // las dos pantallas no puedan decir cosas distintas.
  const todas =
    (noConformidades as (OpcionNoConformidad & { nc_acciones: { id: string }[] | null })[] | null) ??
    [];

  const yaRespondidas = new Set(
    todas.filter((nc) => (nc.nc_acciones ?? []).length > 0).map((nc) => nc.id),
  );

  const opciones: OpcionNoConformidad[] = todas
    .filter((nc) => !yaRespondidas.has(nc.id))
    .map((nc) => ({ id: nc.id, codigo: nc.codigo, titulo: nc.titulo }));

  // Quien llega con `?nc=` de una ya respondida —un enlace guardado, el
  // botón de atrás— va a su acción correctiva en vez de encontrarse el
  // selector vacío. Es lo mismo que decide la ficha de la desviación.
  if (searchParams.nc && yaRespondidas.has(searchParams.nc)) {
    redirect(`/acciones/${searchParams.nc}`);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <EncabezadoPagina
        titulo="Nueva acción correctiva"
        descripcion={
          soloLectura
            ? "Elija la desviación que tiene a su cargo y cargue la acción correctiva."
            : "Elija la no conformidad por su código y cargue la acción. Se listan las que todavía no tienen respuesta, y puede cargarla también sobre una que no esté a su nombre."
        }
      />

      {opciones.length === 0 ? (
        <EstadoVacio
          titulo={
            soloLectura
              ? "No tiene desviaciones a su cargo sin responder"
              : "No hay no conformidades sin responder"
          }
          descripcion={
            soloLectura
              ? "Su perfil carga la acción correctiva de las desviaciones en las que figura como responsable, y en este momento no hay ninguna a su nombre que siga sin respuesta."
              : "Una acción correctiva se carga sobre una desviación que todavía no tenga respuesta, y en este momento todas las abiertas ya la tienen. Para corregir una respuesta ya cargada, entre por la desviación."
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
