import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquareWarning, Plus } from "lucide-react";

import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltrosListado } from "@/components/comunes/filtros-listado";
import { Torta } from "@/components/comunes/graficos";
import { Boton } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia } from "@/components/ui/insignia";
import { Tarjeta } from "@/components/ui/tarjeta";
import {
  Tabla,
  TablaCabecera,
  TablaCelda,
  TablaCuerpo,
  TablaEncabezado,
  TablaFila,
} from "@/components/ui/tabla";
import { puedeGestionar, requerirModulo } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatearFecha } from "@/lib/formato";
import { sinTildes } from "@/lib/utilidades";
import {
  casoCerrado,
  CLASES_ESTADO_RECLAMO,
  COLOR_ESTADO_RECLAMO,
  COLOR_GRAVEDAD_RECLAMO,
  estaFueraDePlazo,
  ETIQUETAS_ESTADO_RECLAMO,
  ETIQUETAS_GRAVEDAD_RECLAMO,
  ETIQUETAS_PLAN_RECLAMO,
  GRAVEDADES_RECLAMO,
  type EstadoReclamo,
  type GravedadReclamo,
  type PlanReclamo,
} from "@/lib/reclamos";

export const metadata: Metadata = { title: "Reclamos de Clientes" };
export const dynamic = "force-dynamic";

interface FilaReclamo {
  id: string;
  codigo: string;
  titulo: string;
  cliente_nombre: string;
  gravedad: GravedadReclamo;
  plan: PlanReclamo;
  estado: EstadoReclamo;
  es_reincidencia: boolean;
  material_controlado: boolean;
  tramite_digemabel: boolean;
  fecha_limite_contacto: string;
  fecha_contacto: string | null;
  fecha_limite_resolucion: string;
  fecha_resolucion: string | null;
}

const PLANES_RECLAMO: PlanReclamo[] = ["a", "b", "c"];

/**
 * Los reclamos de clientes.
 *
 * UNA SOLA VISTA. Hasta el 12 de octubre la pantalla arrancaba en
 * «Abiertos» y las otras tres —«Fuera de plazo», «Cerrados» y «Todos»—
 * eran pestañas: para saber cuántos reclamos hay en el sistema había que
 * cambiar de vista, y un caso cerrado no aparecía en la pantalla
 * principal. Ahora el listado trae todo y lo que acota es la barra de
 * filtros, que es la misma de riesgos y activos y escribe en la
 * dirección: el filtro se comparte y sobrevive a una recarga.
 *
 * «Fuera de plazo» no se perdió: es una opción del filtro Situación, y
 * sigue siendo LA PREGUNTA QUE JUSTIFICA EL MÓDULO —los casos cuyo
 * primer contacto o cuya resolución vencieron sin hacerse—. El
 * procedimiento pone plazos de horas para el primer contacto, y un plazo
 * que nadie mira es un plazo que no existe.
 */
export default async function PaginaReclamos({
  searchParams,
}: {
  searchParams: {
    q?: string;
    situacion?: string;
    estado?: string;
    gravedad?: string;
    plan?: string;
  };
}) {
  const usuario = await requerirModulo("reclamos");
  const supabase = crearClienteServidor();

  const { data } = await supabase
    .from("reclamos")
    .select(
      "id, codigo, titulo, cliente_nombre, gravedad, plan, estado, es_reincidencia, " +
        "material_controlado, tramite_digemabel, fecha_limite_contacto, fecha_contacto, " +
        "fecha_limite_resolucion, fecha_resolucion",
    )
    .order("creado_en", { ascending: false });

  const todos = (data as unknown as FilaReclamo[] | null) ?? [];

  // La regla de «fuera de plazo» no se repite acá: es la misma que usa la
  // ficha, y cuando el listado tenía la suya propia marcaba en rojo casos
  // que la ficha mostraba como suspendidos por trámite ante la DIGEMABEL.
  const estaCerrado = (r: FilaReclamo) => casoCerrado(r.estado);
  const fueraDePlazo = (r: FilaReclamo) => estaFueraDePlazo(r);

  // El filtrado se hace acá y no en la consulta por dos razones: «fuera
  // de plazo» es una regla de TypeScript —compara plazos y mira el
  // trámite— que no existe en SQL, y la búsqueda tiene que ignorar las
  // tildes, que es justo lo que `ilike` no hace: «lopez» no encuentra
  // «LÓPEZ», que en una cartera paraguaya es la mitad de los apellidos.
  const partes = sinTildes(searchParams.q ?? "")
    .split(/\s+/)
    .filter(Boolean);

  const reclamos = todos.filter((reclamo) => {
    if (searchParams.situacion === "abiertos" && estaCerrado(reclamo)) return false;
    if (searchParams.situacion === "cerrados" && !estaCerrado(reclamo)) return false;
    if (searchParams.situacion === "fuera_de_plazo" && !fueraDePlazo(reclamo)) return false;
    if (searchParams.estado && reclamo.estado !== searchParams.estado) return false;
    if (searchParams.gravedad && reclamo.gravedad !== searchParams.gravedad) return false;
    if (searchParams.plan && reclamo.plan !== searchParams.plan) return false;

    if (partes.length > 0) {
      const texto = sinTildes(`${reclamo.codigo} ${reclamo.titulo} ${reclamo.cliente_nombre}`);
      if (!partes.every((parte) => texto.includes(parte))) return false;
    }

    return true;
  });

  const hayFiltros = reclamos.length !== todos.length;

  // Los colores salen de `lib/reclamos.ts` y no de acá: son la misma
  // escala que usa el resto del módulo, y ahí está escrito por qué
  // «registrado» no puede ir con `--primario` —vale exactamente lo mismo
  // que `--semaforo-critico`, así que daba dos porciones del mismo rojo—.
  const porGravedad = GRAVEDADES_RECLAMO.map((gravedad) => ({
    etiqueta: ETIQUETAS_GRAVEDAD_RECLAMO[gravedad],
    valor: reclamos.filter((reclamo) => reclamo.gravedad === gravedad).length,
    color: COLOR_GRAVEDAD_RECLAMO[gravedad],
  }));

  const porEstado = (Object.keys(ETIQUETAS_ESTADO_RECLAMO) as EstadoReclamo[]).map((estado) => ({
    etiqueta: ETIQUETAS_ESTADO_RECLAMO[estado],
    valor: reclamos.filter((reclamo) => reclamo.estado === estado).length,
    color: COLOR_ESTADO_RECLAMO[estado],
  }));

  return (
    <div>
      <EncabezadoPagina
        titulo="Reclamos de Clientes"
        descripcion="Fuente única del caso: la gravedad del hecho define el plan, y cada plan trae sus plazos."
        acciones={
          puedeGestionar(usuario) ? (
            <Boton comoHijo>
              <Link href="/reclamos/nuevo">
                <Plus /> Nuevo Reclamo
              </Link>
            </Boton>
          ) : null
        }
      />

      {/* LA BARRA DE FILTROS REEMPLAZA A LAS CUATRO PESTAÑAS. «Situación»
          es la que trae lo que antes eran vistas; las otras tres acotan
          por los datos que la tabla ya muestra en sus columnas. */}
      <FiltrosListado
        marcadorBusqueda="Buscar por código, caso o cliente…"
        campos={[
          {
            nombre: "situacion",
            etiqueta: "Situación",
            opciones: [
              { valor: "abiertos", etiqueta: "Abiertos" },
              { valor: "fuera_de_plazo", etiqueta: "Fuera de plazo" },
              { valor: "cerrados", etiqueta: "Cerrados" },
            ],
          },
          {
            nombre: "estado",
            etiqueta: "Estado",
            opciones: (Object.keys(ETIQUETAS_ESTADO_RECLAMO) as EstadoReclamo[]).map((estado) => ({
              valor: estado,
              etiqueta: ETIQUETAS_ESTADO_RECLAMO[estado],
            })),
          },
          {
            nombre: "gravedad",
            etiqueta: "Gravedad",
            opciones: GRAVEDADES_RECLAMO.map((gravedad) => ({
              valor: gravedad,
              etiqueta: ETIQUETAS_GRAVEDAD_RECLAMO[gravedad],
            })),
          },
          {
            nombre: "plan",
            etiqueta: "Plan",
            opciones: PLANES_RECLAMO.map((plan) => ({
              valor: plan,
              etiqueta: ETIQUETAS_PLAN_RECLAMO[plan].split(" · ")[0],
            })),
          },
        ]}
      />

      {/* LAS DOS TORTAS, sobre lo que quedó en el listado y no sobre el
          total: si alguien filtra, los porcentajes son de lo que está
          mirando.

          Van en torta y no en barras porque son tres y cinco porciones:
          se comparan de un vistazo. Cada una lleva su tabla de datos al
          lado —la ponen los propios componentes— y el total en el
          agujero, que es «Total de reclamos» sin una tarjeta aparte que
          repita el número. */}
      {reclamos.length > 0 ? (
        <div className="mb-4 grid gap-3 lg:grid-cols-2">
          <Torta titulo="Por gravedad" porciones={porGravedad} />
          <Torta titulo="Por estado" porciones={porEstado} />
        </div>
      ) : null}

      {reclamos.length === 0 ? (
        <EstadoVacio
          icono={<MessageSquareWarning className="size-6" />}
          titulo={todos.length === 0 ? "Todavía no hay reclamos" : "Ningún reclamo coincide"}
          descripcion={
            todos.length === 0
              ? "Acá se registran los reclamos de clientes por cualquier vía: encuestas, reseñas, devoluciones, errores de facturación, fallas de entrega o de servicio técnico, y quejas verbales aunque no sean formales."
              : "Pruebe con otros filtros o límpielos para ver todos los reclamos."
          }
        />
      ) : (
        <Tarjeta>
          <Tabla>
            <TablaCabecera>
              <TablaFila>
                <TablaEncabezado>Código</TablaEncabezado>
                <TablaEncabezado>Caso</TablaEncabezado>
                <TablaEncabezado className="hidden md:table-cell">Cliente</TablaEncabezado>
                <TablaEncabezado>Plan</TablaEncabezado>
                {/* «Gestor» salió el 12 de octubre: el gestor no se
                    pregunta al registrar, así que la columna estaba
                    vacía en casi todas las filas. */}
                <TablaEncabezado>Resolución</TablaEncabezado>
                <TablaEncabezado>Estado</TablaEncabezado>
              </TablaFila>
            </TablaCabecera>
            <TablaCuerpo>
              {reclamos.map((reclamo) => {
                const atrasado = fueraDePlazo(reclamo);
                return (
                  <TablaFila key={reclamo.id}>
                    <TablaCelda className="whitespace-nowrap text-xs font-medium">
                      <Link href={`/reclamos/${reclamo.id}`} className="hover:underline">
                        {reclamo.codigo}
                      </Link>
                    </TablaCelda>
                    <TablaCelda className="text-xs">
                      <Link href={`/reclamos/${reclamo.id}`} className="hover:underline">
                        {reclamo.titulo}
                      </Link>
                      <span className="ml-1.5 whitespace-nowrap text-[10px]">
                        {reclamo.es_reincidencia ? (
                          <span className="text-semaforo-alto">reincidencia</span>
                        ) : null}
                        {reclamo.material_controlado ? (
                          <span className="ml-1 text-semaforo-medio">material controlado</span>
                        ) : null}
                      </span>
                      {/* El cliente se esconde en el celular, pero no se
                          pierde: reaparece acá abajo. */}
                      <span className="block text-[10px] text-atenuado-contraste md:hidden">
                        {reclamo.cliente_nombre}
                      </span>
                    </TablaCelda>
                    <TablaCelda className="hidden text-xs text-atenuado-contraste md:table-cell">
                      {reclamo.cliente_nombre}
                    </TablaCelda>
                    <TablaCelda className="whitespace-nowrap text-xs">
                      {ETIQUETAS_PLAN_RECLAMO[reclamo.plan].split(" · ")[0]}
                      <span className="ml-1 text-[10px] text-atenuado-contraste">
                        {ETIQUETAS_GRAVEDAD_RECLAMO[reclamo.gravedad]}
                      </span>
                    </TablaCelda>
                    {/* RESOLUCION ES CUANDO SE CERRO, no cuándo vencía.
                        La columna mostraba el límite, así que un caso ya
                        cerrado seguía anunciando una fecha futura como
                        si faltara algo. Mientras el caso está abierto se
                        muestra el límite, que ahí sí es el dato que
                        importa, y se dice que es un vencimiento. */}
                    <TablaCelda
                      className={`whitespace-nowrap text-xs tabular ${
                        atrasado && !reclamo.fecha_resolucion
                          ? "font-semibold text-semaforo-critico"
                          : ""
                      }`}
                    >
                      {reclamo.fecha_resolucion ? (
                        formatearFecha(reclamo.fecha_resolucion)
                      ) : (
                        <>
                          <span className="text-atenuado-contraste">vence </span>
                          {formatearFecha(reclamo.fecha_limite_resolucion)}
                        </>
                      )}
                      {/* Un caso pasado de fecha y sin marcar en rojo
                          necesita decir por que: el tramite lo detuvo. */}
                      {reclamo.tramite_digemabel ? (
                        <span className="ml-1 text-[10px] font-normal text-semaforo-medio">
                          suspendido
                        </span>
                      ) : null}
                    </TablaCelda>
                    <TablaCelda>
                      <Insignia variante="contorno">
                        <span className={CLASES_ESTADO_RECLAMO[reclamo.estado]}>
                          {ETIQUETAS_ESTADO_RECLAMO[reclamo.estado]}
                        </span>
                      </Insignia>
                    </TablaCelda>
                  </TablaFila>
                );
              })}
            </TablaCuerpo>
          </Tabla>
          {/* El pie dice cuántos hay en el listado, y cuando hay filtros
              puestos también sobre cuántos: sin el total, un listado
              acotado se lee como si fuera todo lo que existe. */}
          <p className="border-t border-borde px-3 py-2 text-xs text-atenuado-contraste">
            {hayFiltros
              ? `${reclamos.length} de ${todos.length} reclamos`
              : `${reclamos.length} ${reclamos.length === 1 ? "reclamo" : "reclamos"}`}
          </p>
        </Tarjeta>
      )}
    </div>
  );
}
