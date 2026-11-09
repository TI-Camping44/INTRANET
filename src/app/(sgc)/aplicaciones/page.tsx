import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Inbox, LayoutGrid, Settings2 } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { Boton } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia } from "@/components/ui/insignia";
import { DEPARTAMENTOS } from "@/lib/constantes";
import { Tarjeta } from "@/components/ui/tarjeta";
import {
  agruparAplicaciones,
  estaOculta,
  ETIQUETAS_PUBLICO,
  ETIQUETAS_TIPO_APLICACION,
  type Aplicacion,
  type EmpresaDelGrupo,
} from "@/lib/aplicaciones";
import { MarcaVitalica } from "@/components/comunes/marca-empresa";
import { esDeVitalica } from "@/lib/empresas";
import { obtenerPermisos, requerirModulo } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Aplicaciones" };
export const dynamic = "force-dynamic";

/**
 * Las aplicaciones que la empresa ya tiene publicadas.
 *
 * No las reemplaza ni las copia: las reúne. Hasta ahora había que
 * conocerlas de memoria o tenerlas en los marcadores del navegador, que
 * es la manera más segura de que quien entra nuevo no se entere de que
 * existen.
 *
 * SE LEE EN DOS NIVELES: el área, que es como la gente busca —«lo mío»—,
 * y adentro qué es cada cosa —solicitudes, catálogos, herramientas,
 * tableros—. Todo en orden alfabético. El `orden` numérico dejó de
 * usarse el 9 de noviembre: sus valores eran restos de cuando la lista
 * era una sola, así que nadie podía explicar por qué una tarjeta iba
 * antes que otra, y «Comercial y marketing» mezclaba ocho cosas de tres
 * clases distintas en un solo bloque sin corte.
 *
 * EL SUBTÍTULO POR TIPO SOLO APARECE DONDE HACE FALTA, que lo decide
 * `agruparAplicaciones()` y no esta pantalla: un grupo de un solo tipo
 * subtitulado diría dos veces lo mismo.
 *
 * QUIÉN VE CADA UNA LO DECIDE LA BASE, no esta pantalla: la política de
 * lectura de `aplicaciones` compara el rol de quien consulta contra
 * `roles_visibles` y directamente no devuelve la fila. Por eso acá no
 * hay ningún filtro por rol: lo que llega es lo que corresponde.
 *
 * La excepción es quien administra la lista, que las recibe todas —si no,
 * no podría volver a habilitar lo que ocultó—. A esa persona, y solo a
 * esa, se le marcan las que no ve nadie.
 *
 * Abren en una pestaña nueva porque son sistemas aparte: quien mira el
 * catálogo no está saliendo de la intranet, está yendo a otra cosa y
 * después vuelve.
 */
export default async function PaginaAplicaciones() {
  await requerirModulo("aplicaciones");
  const permisos = await obtenerPermisos();
  const puedeAdministrar = permisos.aplicaciones.editar;

  const supabase = crearClienteServidor();

  // LAS EMPRESAS VAN POR `empresas_del_grupo()` y no por un `select` a
  // `empresas` ni por una relación en la consulta: RLS acota esa tabla a
  // la propia, así que la fila de Vitalica volvería vacía y ninguna
  // aplicación quedaría marcada.
  //
  // El orden lo pone `agruparAplicaciones()`, por nombre: la consulta ya
  // no pide `.order("orden")` porque esa columna salió de la pantalla.
  const [{ data }, { data: empresas }] = await Promise.all([
    supabase
      .from("aplicaciones")
      .select(
        "id, nombre, descripcion, url, publico, tipo, orden, roles_visibles, " +
          "usuarios_visibles, empresa_de_la_aplicacion_id, departamento_que_resuelve",
      ),
    supabase.rpc("empresas_del_grupo"),
  ]);

  const aplicaciones = (data as unknown as Aplicacion[] | null) ?? [];
  const grupos = agruparAplicaciones(aplicaciones);

  const nombrePorEmpresa = new Map(
    ((empresas as EmpresaDelGrupo[] | null) ?? []).map((empresa) => [
      empresa.id,
      empresa.nombre,
    ]),
  );

  /**
   * Una tarjeta.
   *
   * Vive acá y no en un componente aparte porque necesita
   * `nombrePorEmpresa` y `puedeAdministrar` del alcance, y porque las
   * dos ramas del dibujo —con subtítulo y sin— tienen que dibujar
   * exactamente lo mismo: con dos copias, una columna agregada a la
   * tarjeta aparecería en un grupo y no en el otro.
   */
  const dibujarTarjeta = (aplicacion: Aplicacion) => {
    // VITALICA SE DISTINGUE POR COLOR, no por una pantalla aparte:
    // franja naranja arriba y la palabra, igual que en el organigrama.
    // El naranja es `--vitalica` y no `--semaforo-alto`, que es del
    // mismo tono: un semáforo dice «cuidado», y acá el color solo dice
    // de qué empresa es la aplicación.
    const deVitalica = esDeVitalica(
      nombrePorEmpresa.get(aplicacion.empresa_de_la_aplicacion_id ?? ""),
    );

    return (
      <Tarjeta
        key={aplicacion.id}
        className={`relative min-w-0 overflow-hidden ${
          deVitalica ? "border-vitalica/50" : ""
        }`}
      >
        {deVitalica ? (
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-1 bg-vitalica"
          />
        ) : null}
        <a
          href={aplicacion.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-full flex-col gap-1.5 p-4 transition-colors hover:bg-acento/40"
        >
          <span className="flex items-start justify-between gap-2">
            <span className="text-sm font-medium">
              {aplicacion.nombre}
              {deVitalica ? <MarcaVitalica className="ml-1.5" /> : null}
            </span>
            <ExternalLink
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-atenuado-contraste"
              aria-hidden
            />
          </span>
          <span className="text-xs leading-relaxed text-atenuado-contraste">
            {aplicacion.descripcion}
          </span>

          {/* QUÉ ÁREA RESUELVE EL PEDIDO. La mayoría de las
            solicitudes lo lleva en el nombre —«para
            Logística»— pero no todas: «Nota de Retiro de
            Equipos» es de Informática y no había forma de
            saberlo sin abrirla. El dato va en la tarjeta y
            no un caso especial para Informática, así que
            la columna se escanea entera y una solicitud
            nueva se ubica sola. Donde no está cargado no
            se dibuja nada: un recuadro vacío diría que
            falta un dato que puede no corresponder. */}
          {aplicacion.departamento_que_resuelve ? (
            <span className="mt-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-atenuado-contraste">
              <Inbox className="size-3 shrink-0" aria-hidden />
              <span className="truncate">
                Lo resuelve{" "}
                {DEPARTAMENTOS[aplicacion.departamento_que_resuelve]}
              </span>
            </span>
          ) : null}
          {/* Solo le aparece a quien administra la lista: es
            la unica persona que recibe las ocultas, y sin
            esto las vería mezcladas con las demás y
            creería que todos las ven. */}
          {estaOculta(aplicacion) ? (
            <span className="mt-auto pt-1.5">
              <Insignia variante="contorno">Oculta para todos</Insignia>
            </span>
          ) : null}
        </a>
      </Tarjeta>
    );
  };

  return (
    <>
      <EncabezadoPagina
        titulo="Aplicaciones"
        descripcion="Los formularios, catálogos, tableros e informes de Camping 44, en un solo lugar."
        acciones={
          puedeAdministrar ? (
            <Boton variante="contorno" comoHijo>
              <Link href="/aplicaciones/administrar">
                <Settings2 /> Administrar
              </Link>
            </Boton>
          ) : null
        }
      />

      {grupos.length === 0 ? (
        <EstadoVacio
          icono={<LayoutGrid className="size-6" />}
          titulo="No hay aplicaciones para mostrar"
          descripcion={
            puedeAdministrar
              ? "Agregue la primera desde Administrar: un nombre, para qué sirve, la dirección y a qué roles se les muestra."
              : "Todavía no se habilitó ninguna aplicación para su rol. Consulte con el Administrador SGC."
          }
        />
      ) : (
        <div className="space-y-8">
          {grupos.map((grupo) => (
            <section key={grupo.publico}>
              <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-atenuado-contraste">
                {ETIQUETAS_PUBLICO[grupo.publico]}
              </h2>

              {grupo.subtitular ? (
                <div className="space-y-5">
                  {grupo.tramos.map((tramo) => (
                    <div key={tramo.tipo}>
                      <h3 className="mb-2 text-xs font-medium text-texto">
                        {ETIQUETAS_TIPO_APLICACION[tramo.tipo]}
                      </h3>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {tramo.aplicaciones.map(dibujarTarjeta)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {grupo.aplicaciones.map(dibujarTarjeta)}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
